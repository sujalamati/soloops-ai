# SoloOps AI — Backend

A local-first receipt/invoice processing backend for Hacktoberfest 2026 Week 2. It accepts PDF and image documents, extracts text with PDF text parsing/OCR, uses an Ollama open-weight model to produce structured expense fields, runs deterministic checks, persists records in SQLite, supports human review, and exports approved expenses to CSV.

> **MVP / security note:** this is a local development project, not a production accounting system. It has no authentication or user isolation. Bind the server to `127.0.0.1`, don't expose it to the public internet, use synthetic/redacted demo documents, and don't commit real receipts, `.env`, database files, or uploads. Local inference does not mean a hosted deployment is private.

## Features

- PDF text extraction with PyMuPDF; OCR fallback for scanned PDF pages.
- OCR for PNG, JPG/JPEG, TIFF, and WEBP with Tesseract.
- Ollama model extraction using a Pydantic JSON schema.
- Deterministic checks for required fields, future dates, subtotal + tax mismatch, and possible duplicates.
- SQLite persistence for extracted fields, review state, source filename, and processing failures.
- Exact-file duplicate uploads reuse the existing record.
- Edit, approve, list, delete, and approved-only CSV export endpoints.
- Swagger UI at `/docs` and pytest tests.

## 1. Prerequisites (Linux / Ubuntu)

Check Python:

```bash
python3 --version
```

Python 3.10+ is recommended. Install OCR and common build prerequisites:

```bash
sudo apt update
sudo apt install -y tesseract-ocr
```

Install Ollama using the instructions at https://ollama.com/download. Start the Ollama service, then pull a small model. The default configured model is `gemma4:e4b`:

```bash
ollama pull gemma4:e4b
ollama run gemma4:e4b
```

Type a quick prompt, then exit the interactive session. Keep Ollama running in the background. If this model is too large for your hardware, choose a smaller compatible model and update `OLLAMA_MODEL` in `.env`. Check the model's license and hardware requirements before distributing it.

## 2. Create the Python environment

From this `backend/` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

If `python3 -m venv` fails on Ubuntu, install `python3-venv` with apt and retry. On Windows, use `.venv\\Scripts\\activate` instead of `source .venv/bin/activate`.

Review `.env`. For local development, the defaults are appropriate. `DEMO_MODE=false` means Ollama is required for AI extraction. Do not turn on demo mode for quality measurements; it uses a deliberately simplistic deterministic fallback and is only useful for plumbing tests.

## 3. Run the API

Make sure you are in `backend/`, your virtual environment is active, and Ollama is running:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

Health returns `status=ok` when Ollama responds, or `status=degraded` when the API is up but Ollama is unreachable. The SQLite database and upload directory are created automatically under `backend/data/`.

## 4. Test the API manually

### Upload one or more documents

In Swagger UI, open `POST /documents`, choose one or more `.pdf`, `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, or `.webp` files, and execute. Or use curl:

```bash
curl -X POST http://127.0.0.1:8000/documents \
  -F 'files=@/absolute/path/to/receipt.pdf'
```

A successful upload returns a record ID. A document that could not be processed returns a `failed` record with a useful error. The API intentionally records failures so the UI can display them.

### List and inspect expenses

```bash
curl 'http://127.0.0.1:8000/expenses'
curl 'http://127.0.0.1:8000/expenses?status=needs_review'
curl 'http://127.0.0.1:8000/expenses/1'
```

### Correct a record

Use the actual ID returned by your upload. Fields omitted from the patch are unchanged.

```bash
curl -X PATCH http://127.0.0.1:8000/expenses/1 \
  -H 'Content-Type: application/json' \
  -d '{"merchant":"Example Stationery","expense_date":"2026-10-15","currency":"INR","subtotal":"100.00","tax":"18.00","total":"118.00","category":"office_supplies"}'
```

Supported categories: `software`, `office_supplies`, `travel`, `meals`, `utilities`, `marketing`, `professional_services`, `equipment`, `other`.

### Approve after review

Approval requires merchant, date, total, and currency. The user is responsible for checking any remaining warnings first.

```bash
curl -X POST http://127.0.0.1:8000/expenses/1/approve
```

### Export approved expenses

```bash
curl -L http://127.0.0.1:8000/export.csv -o soloops-expenses.csv
```

Only records whose status is `approved` are exported.

### Delete a record

```bash
curl -X DELETE http://127.0.0.1:8000/expenses/1
```

This deletes the database record and its stored upload, if the stored file is inside the configured upload directory.

## 5. Run tests

From `backend/` with the virtual environment active:

```bash
pytest -q
```

Tests cover API basics and validation rules. They do not require a live model for the validation tests. For an end-to-end model test, run Ollama and test with synthetic sample receipts.

## API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | API metadata |
| GET | `/health` | API + Ollama status |
| POST | `/documents` | Upload one or more documents |
| GET | `/expenses` | List records; optional `status`, `limit`, `offset` |
| GET | `/expenses/{id}` | Get one record |
| PATCH | `/expenses/{id}` | Edit fields and recalculate warnings |
| POST | `/expenses/{id}/approve` | Explicitly approve a reviewed record |
| GET | `/export.csv` | Export approved records only |
| DELETE | `/expenses/{id}` | Delete record and stored file |

## How the processing flow works

1. API checks extension and size limits.
2. Backend hashes the file; exact duplicate file uploads return the existing record.
3. PDF text is extracted directly when possible. Scanned PDF pages and images use Tesseract OCR.
4. OCR text is sent to the local Ollama model with a JSON schema and a prompt that treats document content as untrusted input.
5. Pydantic validates the model response.
6. Deterministic checks create review warnings.
7. The record is saved as `needs_review`; it is never automatically approved.
8. User edits and approves it; only approved records appear in CSV export.

## Known MVP limitations / next steps

- No authentication, multi-user tenancy, background job queue, rate limiting, or audit log yet. Do not expose this API publicly as-is.
- Exact file hashing detects identical uploads, while merchant/date/amount matching only flags likely duplicates.
- OCR quality depends on scan quality and installed Tesseract language packs.
- Model output is not guaranteed to be correct; always review extracted data.
- Add migrations (Alembic), structured logging, retention controls, authentication, per-user storage, and robust integration tests before production use.
- For a hosted demo, don't claim documents remain on the user's machine if they are uploaded to a remote server. Consider a local-only demo video for the privacy story.

## License

This project scaffold is provided under the MIT License. The chosen model has its own license; review that separately.

## 8. Run the React frontend

The `frontend/` directory contains the SoloOps dashboard connected to this API. It supports summary metrics, multi-file receipt upload, expense search/filter, edit, approve, delete, and CSV export.

Requirements: Node.js 18.18+ (Node 20 LTS recommended). In a second terminal, from the project root:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Keep the backend running at <http://127.0.0.1:8000> in another terminal. The backend's default `CORS_ORIGINS` already allows `http://localhost:5173` and `http://127.0.0.1:5173`. If you change the frontend origin or API URL, update `frontend/.env` and `backend/.env` accordingly, then restart the relevant servers.

Build the frontend for a production bundle with `npm run build`; Vite writes it to `frontend/dist/`.

## 9. Frontend functionality and API mapping

- Dashboard and table: `GET /expenses` and `GET /health`
- Receipt upload: `POST /documents` with multipart field `files` (PDF and image formats supported by the backend)
- Edit: `PATCH /expenses/{id}`
- Approve: `POST /expenses/{id}/approve`
- Delete: `DELETE /expenses/{id}`
- Export: `GET /export.csv` (approved records only)

The frontend uses the backend as the source of truth. An expense is not considered approved until the API confirms it.

