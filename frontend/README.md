# SoloOps AI frontend

React + Vite frontend for the FastAPI backend in `../backend`.

## Features

- Dashboard totals for approved expenses, pending review, processed documents, and unreviewed amounts.
- Upload multiple PDF/image receipts using the backend's `files` multipart field.
- Search and filter expenses by status.
- Edit extracted fields and save changes back to FastAPI.
- Approve expenses after confirmation; backend validation remains authoritative.
- Delete an expense and its stored upload after confirmation.
- Export approved expenses as CSV.
- Backend/Ollama health indicator and API error notifications.
- Responsive layout for desktop and mobile.

## Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- The SoloOps FastAPI backend running at `http://127.0.0.1:8000`

## Setup

From this `frontend/` directory:

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://127.0.0.1:5173>.

`VITE_API_BASE_URL` configures the backend origin. If you change it, make sure the backend's `CORS_ORIGINS` includes the frontend origin. Vite environment variables are read when the dev server starts; restart it after changing `.env`.

## Start the backend in another terminal

```bash
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Make sure Ollama is running and the configured model is available. The dashboard can display and manage existing records if Ollama is down, but new extraction may fail.

## Production build

```bash
npm run build
npm run preview
```

The output is written to `dist/`. This MVP has no authentication or per-user isolation; keep the backend private and do not expose it to the public internet.
