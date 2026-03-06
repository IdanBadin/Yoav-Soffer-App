"""
FastAPI backend — thin wrapper around existing utils.
Endpoints: POST /process, GET/POST/PUT/DELETE /prices, GET /health, POST /refresh-prices
"""

import base64
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import gspread
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.service_account import Credentials
from pydantic import BaseModel

from utils.pdf_parser import parse_pdf
from utils.sheets_client import build_price_index, load_price_sheet, match_prices
from utils.excel_generator import generate_quote, generate_parts_list

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_price_index: Optional[dict] = None

READ_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]
WRITE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_credentials_path() -> Optional[str]:
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


def _get_worksheet(write: bool = False):
    """Get gspread worksheet with read or write access."""
    creds_path = _get_credentials_path()
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "מחירון")
    if not creds_path or not sheet_id:
        raise HTTPException(status_code=500, detail="Google Sheets לא מוגדר")
    scopes = WRITE_SCOPES if write else READ_SCOPES
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    gc = gspread.authorize(creds)
    ss = gc.open_by_key(sheet_id)
    try:
        return ss.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        return ss.get_worksheet(0)


def _load_price_index() -> Optional[dict]:
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

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class PriceRecord(BaseModel):
    catalog_number: str = ""
    item_name: str = ""
    unit_price: float = 0.0
    unit: str = "יח'"
    manufacturer: str = ""


@app.get("/health")
async def health():
    count = len(_price_index.get("records", [])) if _price_index else 0
    return {
        "status": "ok",
        "prices_loaded": _price_index is not None,
        "price_count": count,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/refresh-prices")
async def refresh_prices():
    global _price_index
    _price_index = _load_price_index()
    count = len(_price_index.get("records", [])) if _price_index else 0
    return {"status": "ok", "prices_loaded": _price_index is not None, "count": count}


# ── Price CRUD ────────────────────────────────────────────────────────────────

@app.get("/prices")
async def get_prices():
    """Return all rows from the Google Sheet price list."""
    try:
        ws = _get_worksheet(write=False)
        records = ws.get_all_records()
        result = []
        for i, r in enumerate(records, start=2):
            try:
                price_val = float(str(r.get("unit_price", 0) or 0).replace(",", "."))
            except (ValueError, TypeError):
                price_val = 0.0
            result.append({
                "row": i,
                "catalog_number": str(r.get("catalog_number", "") or ""),
                "item_name": str(r.get("item_name", "") or ""),
                "unit_price": price_val,
                "unit": str(r.get("unit", "יח'") or "יח'"),
                "manufacturer": str(r.get("manufacturer", "") or ""),
            })
        return {"records": result, "count": len(result)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="שגיאה בטעינת המחירון")


@app.put("/prices/{row}")
async def update_price(row: int, data: PriceRecord):
    """Update an existing price row by spreadsheet row number."""
    try:
        ws = _get_worksheet(write=True)
        headers = ws.row_values(1)
        col_map = {h.lower().strip(): idx + 1 for idx, h in enumerate(headers)}
        values = {
            "catalog_number": data.catalog_number,
            "item_name": data.item_name,
            "unit_price": data.unit_price,
            "unit": data.unit,
            "manufacturer": data.manufacturer,
        }
        cell_updates = []
        for field, col in col_map.items():
            if field in values:
                cell_updates.append({
                    "range": gspread.utils.rowcol_to_a1(row, col),
                    "values": [[values[field]]],
                })
        if cell_updates:
            ws.batch_update(cell_updates)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating price row {row}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="שגיאה בעדכון המחיר")


@app.post("/prices")
async def add_price(data: PriceRecord):
    """Append a new price row to the sheet."""
    try:
        ws = _get_worksheet(write=True)
        ws.append_row([
            data.catalog_number,
            data.item_name,
            data.unit_price,
            data.unit,
            data.manufacturer,
        ])
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding price: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="שגיאה בהוספת פריט")


@app.delete("/prices/{row}")
async def delete_price(row: int):
    """Delete a price row by spreadsheet row number."""
    try:
        ws = _get_worksheet(write=True)
        ws.delete_rows(row)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting price row {row}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="שגיאה במחיקת הפריט")


# ── Main processing endpoint ──────────────────────────────────────────────────

@app.post("/process")
async def process(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    manager_name: str = Form(""),
    date: str = Form(...),
):
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="יש להעלות קובץ PDF בלבד")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        logger.info(f"Processing PDF: {file.filename}")
        result = parse_pdf(tmp_path, api_key)
        all_components = result["components"] + result["flagged"]

        if not all_components:
            raise HTTPException(
                status_code=422,
                detail="לא זוהו רכיבים בשרטוט. ודא שהקובץ הנכון הועלה."
            )

        if _price_index:
            priced = match_prices(all_components, _price_index)
        else:
            priced = [
                {**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
                for c in all_components
            ]

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
