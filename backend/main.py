"""
FastAPI backend — thin wrapper around existing utils.
Single endpoint: POST /process
"""

import base64
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from utils.pdf_parser import parse_pdf
from utils.sheets_client import build_price_index, load_price_sheet, match_prices
from utils.excel_generator import generate_quote, generate_parts_list

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Price index cache (module-level, loaded once at startup) ─────────────────
_price_index: Optional[dict] = None


def _get_credentials_path() -> Optional[str]:
    """
    Returns path to google_credentials.json.
    On Railway: writes it from GOOGLE_CREDENTIALS_B64 env var to a temp file.
    Locally: uses config/google_credentials.json.
    """
    b64 = os.getenv("GOOGLE_CREDENTIALS_B64", "")
    if b64:
        tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w")
        tmp.write(base64.b64decode(b64).decode("utf-8"))
        tmp.close()
        return tmp.name

    local_path = "config/google_credentials.json"
    if os.path.exists(local_path):
        return local_path

    return None


def _load_price_index() -> Optional[dict]:
    """Load price index from Google Sheets. Returns None if not configured."""
    creds_path = _get_credentials_path()
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "מחירון")

    if not creds_path or not sheet_id:
        logger.warning("Google Sheets not configured — prices will be 0")
        return None

    try:
        records = load_price_sheet(creds_path, sheet_id, sheet_name)
        index = build_price_index(records)
        logger.info(f"Price index loaded: {len(records)} records")
        return index
    except Exception as e:
        logger.error(f"Failed to load price sheet: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _price_index
    _price_index = _load_price_index()
    yield


app = FastAPI(title="י. סופר — Quote Automation API", lifespan=lifespan)

# ── CORS — allow Netlify domain ───────────────────────────────────────────────
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "prices_loaded": _price_index is not None,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/refresh-prices")
async def refresh_prices():
    """Reload price index from Google Sheets."""
    global _price_index
    _price_index = _load_price_index()
    return {"status": "ok", "prices_loaded": _price_index is not None}


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    manager_name: str = Form(""),
    date: str = Form(...),
):
    """
    Main endpoint.
    Accepts: PDF file + project metadata
    Returns: JSON with component list + base64 Excel files
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="יש להעלות קובץ PDF בלבד")

    tmp_path = None
    try:
        # Save uploaded PDF to temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Step 1: Parse PDF
        logger.info(f"Processing PDF: {file.filename}")
        result = parse_pdf(tmp_path, api_key)

        all_components = result["components"] + result["flagged"]

        if not all_components:
            raise HTTPException(
                status_code=422,
                detail="לא זוהו רכיבים בשרטוט. ודא שהקובץ הנכון הועלה."
            )

        # Step 2: Match prices
        if _price_index:
            priced = match_prices(all_components, _price_index)
        else:
            priced = [
                {**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
                for c in all_components
            ]

        # Step 3: Generate Excel files
        excel_quote_bytes = generate_quote(priced, project_name, manager_name, date)
        excel_parts_bytes = generate_parts_list(priced, project_name, manager_name, date)

        return {
            "components": priced,
            "page_count": result["page_count"],
            "excel_quote": base64.b64encode(excel_quote_bytes).decode("utf-8"),
            "excel_parts": base64.b64encode(excel_parts_bytes).decode("utf-8"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        err = str(e)
        if "credit balance" in err.lower() or "too low" in err.lower():
            raise HTTPException(
                status_code=500,
                detail="יתרת הקרדיטים ב-Anthropic נמוכה מדי. יש להוסיף קרדיטים ב-console.anthropic.com"
            )
        raise HTTPException(status_code=500, detail="שגיאה בעיבוד השרטוט. נסה שנית.")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
