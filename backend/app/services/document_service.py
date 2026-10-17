from pathlib import Path
import io
import fitz
import pytesseract
from PIL import Image, ImageOps

class DocumentTextError(Exception):
    pass

def extract_text(path: Path) -> str:
    """Extract embedded PDF text first, OCR pages/images when needed."""
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            chunks: list[str] = []
            with fitz.open(path) as pdf:
                if pdf.is_encrypted:
                    raise DocumentTextError("Password-protected PDFs are not supported.")
                for page in pdf:
                    page_text = page.get_text("text").strip()
                    if len(page_text) < 15:
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                        image = Image.open(io.BytesIO(pix.tobytes("png")))
                        page_text = pytesseract.image_to_string(image)
                    chunks.append(page_text)
            result = "\n\n".join(chunks).strip()
        else:
            with Image.open(path) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
                result = pytesseract.image_to_string(image).strip()
    except DocumentTextError:
        raise
    except pytesseract.TesseractNotFoundError as exc:
        raise DocumentTextError("Tesseract OCR is not installed or is not on PATH.") from exc
    except Exception as exc:
        raise DocumentTextError(f"Could not read document: {type(exc).__name__}: {exc}") from exc
    if not result:
        raise DocumentTextError("No readable text found. Try a clearer scan or a text-based PDF.")
    return result
