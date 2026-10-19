from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]

def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else (BASE_DIR / path).resolve()

APP_NAME = os.getenv("APP_NAME", "SoloOps AI Backend")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'data' / 'soloops.db').as_posix()}")
UPLOAD_DIR = _resolve_path(os.getenv("UPLOAD_DIR", "./data/uploads"))
MAX_UPLOAD_MB = max(1, int(os.getenv("MAX_UPLOAD_MB", "12")))
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in {"1", "true", "yes"}
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
