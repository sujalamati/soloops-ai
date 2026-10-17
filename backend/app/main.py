from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import csv
import io
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from . import models
from .config import ALLOWED_EXTENSIONS, APP_NAME, CORS_ORIGINS, MAX_UPLOAD_MB, UPLOAD_DIR, OLLAMA_MODEL
from .database import Base, engine, get_db
from .models import ExpenseRecord
from .schemas import ExpenseOut, ExpensePatch, HealthOut, UploadItemResult
from .services.extraction_service import ollama_reachable
from .services.pipeline import process_upload
from .services.validation_service import validate_expense
from .schemas import ExpenseExtracted

Base.metadata.create_all(bind=engine)
app = FastAPI(title=APP_NAME, version="0.1.0", description="Local-first AI expense extraction and review API")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["*"])

from fastapi import FastAPI, UploadFile as UF, File
from typing import Annotated
from pydantic import WithJsonSchema

UploadFile = Annotated[UF, WithJsonSchema({"type": "string", "format": "binary"})]

@app.get("/", tags=["system"])
def root():
    return {"name": APP_NAME, "docs": "/docs", "health": "/health"}

@app.get("/health", response_model=HealthOut, tags=["system"])
def health():
    reachable = ollama_reachable()
    return HealthOut(status="ok" if reachable else "degraded", app=APP_NAME, ollama_reachable=reachable, model=OLLAMA_MODEL)

@app.post("/documents", response_model=list[UploadItemResult], status_code=status.HTTP_201_CREATED, tags=["documents"])
def upload_documents(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    if not files:
        raise HTTPException(400, "Upload at least one file.")
    if len(files) > 20:
        raise HTTPException(413, "Upload at most 20 files per request.")
    results: list[UploadItemResult] = []
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    for upload in files:
        filename = Path(upload.filename or "upload").name
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            results.append(UploadItemResult(id=None, filename=filename, status="rejected", message=f"Unsupported file extension. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"))
            continue
        contents = upload.file.read(max_bytes + 1)
        if len(contents) > max_bytes:
            results.append(UploadItemResult(id=None, filename=filename, status="rejected", message=f"File exceeds the {MAX_UPLOAD_MB} MB limit."))
            continue
        try:
            record = process_upload(db, filename, contents)
            message = "Record available. Review extracted fields before approval; exact duplicate uploads reuse the existing record."
            results.append(UploadItemResult(id=record.id, filename=filename, status=record.status, message=message))
        except Exception as exc:
            results.append(UploadItemResult(id=None, filename=filename, status="failed", message=f"Upload failed: {type(exc).__name__}: {exc}"))
        finally:
            upload.file.close()
    return results

@app.get("/expenses", response_model=list[ExpenseOut], tags=["expenses"])
def list_expenses(status_filter: str | None = Query(default=None, alias="status", pattern="^(needs_review|approved|failed|processing)$"), limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    query = db.query(ExpenseRecord)
    if status_filter:
        query = query.filter(ExpenseRecord.status == status_filter)
    return query.order_by(ExpenseRecord.created_at.desc()).offset(offset).limit(limit).all()

@app.get("/expenses/{expense_id}", response_model=ExpenseOut, tags=["expenses"])
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    record = db.get(ExpenseRecord, expense_id)
    if not record:
        raise HTTPException(404, "Expense not found.")
    return record

def _to_extracted(record: ExpenseRecord) -> ExpenseExtracted:
    return ExpenseExtracted(
        merchant=record.merchant,
        expense_date=record.expense_date,
        currency=record.currency,
        subtotal=Decimal(record.subtotal) if record.subtotal is not None else None,
        tax=Decimal(record.tax) if record.tax is not None else None,
        total=Decimal(record.total) if record.total is not None else None,
        category=record.category,
    )

@app.patch("/expenses/{expense_id}", response_model=ExpenseOut, tags=["expenses"])
def update_expense(expense_id: int, patch: ExpensePatch, db: Session = Depends(get_db)):
    record = db.get(ExpenseRecord, expense_id)
    if not record:
        raise HTTPException(404, "Expense not found.")
    if record.status == "failed":
        raise HTTPException(409, "This document failed processing. Upload it again after fixing the underlying issue.")
    for key, value in patch.model_dump(exclude_unset=True).items():
        setattr(record, key, str(value) if value is not None else None)
    extracted = _to_extracted(record)
    existing = db.query(ExpenseRecord).filter(ExpenseRecord.id != record.id).all()
    record.review_reasons = validate_expense(extracted, record.raw_text, existing)
    record.status = "needs_review"
    record.updated_at = datetime.now(timezone.utc)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.post("/expenses/{expense_id}/approve", response_model=ExpenseOut, tags=["expenses"])
def approve_expense(expense_id: int, db: Session = Depends(get_db)):
    record = db.get(ExpenseRecord, expense_id)
    if not record:
        raise HTTPException(404, "Expense not found.")
    if record.status == "failed":
        raise HTTPException(409, "Failed documents cannot be approved.")
    if not record.merchant or not record.expense_date or not record.total or not record.currency:
        raise HTTPException(422, "Merchant, date, total, and currency are required before approval. Edit the record and try again.")
    # Explicit approval is the user's acknowledgement of any remaining warnings.
    record.status = "approved"
    record.updated_at = datetime.now(timezone.utc)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/export.csv", tags=["exports"])
def export_csv(db: Session = Depends(get_db)):
    records = db.query(ExpenseRecord).filter(ExpenseRecord.status == "approved").order_by(ExpenseRecord.expense_date.asc()).all()
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(["id", "merchant", "expense_date", "currency", "subtotal", "tax", "total", "category", "source_filename", "approved_at"])
    for record in records:
        writer.writerow([record.id, record.merchant, record.expense_date, record.currency, record.subtotal, record.tax, record.total, record.category, record.original_filename, record.updated_at.isoformat() if record.updated_at else ""])
    content = io.BytesIO(buffer.getvalue().encode("utf-8-sig"))
    return StreamingResponse(content, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=soloops-expenses.csv"})

@app.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["expenses"])
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    record = db.get(ExpenseRecord, expense_id)
    if not record:
        raise HTTPException(404, "Expense not found.")
    # Remove only a file located under the configured upload directory.
    stored = Path(record.stored_path).resolve()
    root_dir = UPLOAD_DIR.resolve()
    if stored.is_relative_to(root_dir) and stored.is_file():
        stored.unlink(missing_ok=True)
    db.delete(record)
    db.commit()
    return None
