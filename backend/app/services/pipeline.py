import hashlib
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from ..config import UPLOAD_DIR
from ..models import ExpenseRecord
from .document_service import extract_text, DocumentTextError
from .extraction_service import extract_expense, ExtractionError
from .validation_service import validate_expense

class UploadError(Exception):
    pass

def _as_string(value):
    return str(value) if value is not None else None

def process_upload(db: Session, filename: str, contents: bytes) -> ExpenseRecord:
    if not contents:
        raise UploadError("The uploaded file is empty.")
    digest = hashlib.sha256(contents).hexdigest()
    # Avoid saving the same exact file twice. Return the existing record for review.
    existing_file = db.query(ExpenseRecord).filter(ExpenseRecord.file_sha256 == digest).first()
    if existing_file:
        return existing_file

    safe_name = Path(filename or "upload").name
    suffix = Path(safe_name).suffix.lower()
    stored_name = f"{digest}{suffix}"
    stored_path = UPLOAD_DIR / stored_name
    stored_path.write_bytes(contents)
    record = ExpenseRecord(
        original_filename=safe_name[:255], stored_path=str(stored_path), file_sha256=digest,
        status="processing", raw_text="", review_reasons=[]
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        text = extract_text(stored_path)
        record.raw_text = text
        extracted, model_used = extract_expense(text)
        # Check against other records, excluding the current record.
        existing_records = db.query(ExpenseRecord).filter(ExpenseRecord.id != record.id).all()
        reasons = validate_expense(extracted, text, existing_records)
        record.merchant = extracted.merchant
        record.expense_date = _as_string(extracted.expense_date)
        record.currency = extracted.currency
        record.subtotal = _as_string(extracted.subtotal)
        record.tax = _as_string(extracted.tax)
        record.total = _as_string(extracted.total)
        record.category = extracted.category
        record.review_reasons = reasons
        record.status = "needs_review"
        record.processing_error = None
    except (DocumentTextError, ExtractionError) as exc:
        record.status = "failed"
        record.processing_error = str(exc)[:2000]
        record.review_reasons = ["Processing failed. Fix the issue and upload the document again."]
    except Exception as exc:
        record.status = "failed"
        record.processing_error = f"Unexpected processing error: {type(exc).__name__}: {exc}"[:2000]
        record.review_reasons = ["Processing failed unexpectedly. Check backend logs."]
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def delete_stored_file(path_string: str) -> None:
    path = Path(path_string).resolve()
    root = UPLOAD_DIR.resolve()
    if path.is_relative_to(root) and path.exists() and path.is_file():
        path.unlink(missing_ok=True)
