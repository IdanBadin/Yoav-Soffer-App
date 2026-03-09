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

import anthropic as _anthropic
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
_price_records_raw: Optional[list] = None  # Original records for semantic matching

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
    global _price_records_raw
    creds_path = _get_credentials_path()
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "מחירון")
    if not creds_path or not sheet_id:
        logger.warning("Google Sheets not configured — prices will be 0")
        return None
    try:
        records = load_price_sheet(creds_path, sheet_id, sheet_name)
        _price_records_raw = records
        index = build_price_index(records)
        logger.info(f"Price index loaded: {len(records)} records")
        return index
    except Exception as e:
        logger.error(f"Failed to load price sheet: {e}")
        return None


def _semantic_match_unmatched(
    unmatched: list,   # [(original_index, component), ...]
    raw_records: list,
    api_key: str,
) -> dict:            # {original_index: {price, unit, match_type, price_found}}
    """Send unmatched components to Claude for cross-language semantic matching."""
    import json, re

    # Build compact price list string
    price_lines = []
    for i, r in enumerate(raw_records):
        cat = r.get("catalog_number", "") or ""
        name = r.get("item_name", "") or ""
        category = r.get("category", "") or ""
        price = r.get("unit_price", 0) or 0
        price_lines.append(f'[{i}] cat:"{cat}" "{name}" [{category}] ₪{price}')
    price_list_str = "\n".join(price_lines)

    # Build compact components string
    comp_lines = []
    for local_i, (orig_i, c) in enumerate(unmatched):
        cat = c.get("catalog_number", "") or ""
        mfg = c.get("manufacturer", "") or ""
        desc = c.get("description", "") or ""
        comp_lines.append(f'[{local_i}] cat:"{cat}" mfg:"{mfg}" "{desc}"')
    comp_str = "\n".join(comp_lines)

    prompt = f"""You are an expert in electrical panels and components used in Israel.

Match each schematic component to the best price list item.
Component names may be in English; price list names are in Hebrew.
Common mappings: Circuit Breaker=מאמת, Residual Current=פחת/מאזם, Contactor=מגע, Motor Protection=הגנת מנוע, Selector=בורר, Timer=טיימר, Relay=ממסר, Capacitor=קבל, Current Transformer=משנז"ר, Surge Protection=כולא ברק

PRICE LIST (index | catalog | name | category | price):
{price_list_str}

COMPONENTS TO MATCH (index | catalog | manufacturer | description):
{comp_str}

Rules:
1. Match by component TYPE + SPECIFICATIONS (poles, amperage, mA rating)
2. Only return matches with HIGH confidence (>85%)
3. For no confident match → use -1

Return ONLY valid JSON, no text:
{{"m": [[0, 15], [1, 22], [2, -1]]}}
where each pair is [component_index, price_list_index] (-1 = no match)"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    # Extract JSON — handle markdown code blocks
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        raise ValueError(f"No JSON found in Claude response: {raw[:200]}")
    data = json.loads(json_match.group())

    result = {}
    for pair in data.get("m", []):
        local_i, price_list_i = pair[0], pair[1]
        if price_list_i == -1:
            continue
        if local_i < 0 or local_i >= len(unmatched):
            continue
        if price_list_i < 0 or price_list_i >= len(raw_records):
            continue
        orig_i = unmatched[local_i][0]
        rec = raw_records[price_list_i]
        try:
            price_val = float(str(rec.get("unit_price", 0) or 0).replace(",", "."))
        except (ValueError, TypeError):
            price_val = 0.0
        result[orig_i] = {
            "price": price_val,
            "unit": str(rec.get("unit", "יח'") or "יח'"),
            "match_type": "semantic",
            "price_found": True,
        }
    return result


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
    category: str = ""


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
                "category": str(r.get("category", "") or ""),
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
            "category": data.category,
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
            data.category,
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
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY לא מוגדר בסביבת הייצור. יש להגדיר אותו ב-Railway Variables."
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="יש להעלות קובץ PDF בלבד. סוג הקובץ שהועלה אינו נתמך.")

    MAX_SIZE = 50 * 1024 * 1024  # 50 MB
    tmp_path = None
    try:
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=422, detail="הקובץ שהועלה ריק. ודא שהקובץ תקין ונסה שנית.")

        if len(content) > MAX_SIZE:
            size_mb = len(content) / (1024 * 1024)
            raise HTTPException(
                status_code=422,
                detail=f"הקובץ גדול מדי ({size_mb:.1f} MB). הגודל המקסימלי הוא 50 MB."
            )

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        logger.info(f"Processing PDF: {file.filename} ({len(content) / 1024:.0f} KB)")
        result = parse_pdf(tmp_path, api_key)
        all_components = result["components"] + result["flagged"]

        if not all_components:
            raise HTTPException(
                status_code=422,
                detail="לא זוהו רכיבי חשמל בשרטוט. ודא שהקובץ הנכון הועלה ושהוא מכיל רשימת ציוד."
            )

        if _price_index:
            priced = match_prices(all_components, _price_index)
        else:
            priced = [
                {**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
                for c in all_components
            ]

        # Step 4: Semantic matching for still-unmatched components
        unmatched = [(i, c) for i, c in enumerate(priced) if not c["price_found"]]
        if unmatched and _price_records_raw and api_key:
            try:
                semantic = _semantic_match_unmatched(unmatched, _price_records_raw, api_key)
                for idx, match in semantic.items():
                    priced[idx] = {**priced[idx], **match}
                logger.info(f"Semantic matching resolved {len(semantic)} of {len(unmatched)} unmatched components")
            except Exception as e:
                logger.warning(f"Semantic matching skipped: {e}")

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
    except _anthropic.AuthenticationError:
        logger.error("Anthropic authentication failed")
        raise HTTPException(
            status_code=401,
            detail="מפתח ה-API של Anthropic אינו תקין. יש לעדכן את ANTHROPIC_API_KEY ב-Railway Variables."
        )
    except _anthropic.RateLimitError:
        logger.error("Anthropic rate limit hit")
        raise HTTPException(
            status_code=429,
            detail="חרגת ממגבלת הקריאות ל-Claude AI. המתן מספר שניות ונסה שנית."
        )
    except _anthropic.APIConnectionError as e:
        logger.error(f"Anthropic connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="לא ניתן להתחבר ל-Claude AI. ייתכן ויש בעיית רשת זמנית — נסה שנית."
        )
    except _anthropic.BadRequestError as e:
        logger.error(f"Anthropic bad request: {e}")
        raise HTTPException(
            status_code=422,
            detail="קובץ ה-PDF מכיל יותר מדי נתונים לעיבוד בבת אחת. נסה לפצל את הקובץ לחלקים."
        )
    except MemoryError:
        logger.error("MemoryError during processing")
        raise HTTPException(
            status_code=500,
            detail="קובץ ה-PDF גדול מדי לעיבוד. נסה קובץ קטן יותר."
        )
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        err = str(e)
        if "credit balance" in err.lower() or "too low" in err.lower():
            raise HTTPException(
                status_code=402,
                detail="יתרת הקרדיטים ב-Anthropic אזלה. יש להוסיף קרדיטים בכתובת console.anthropic.com"
            )
        if "could not be decoded" in err.lower() or "unable to" in err.lower() or "pdf" in err.lower():
            raise HTTPException(
                status_code=422,
                detail="קובץ ה-PDF פגום או מוצפן ולא ניתן לקרוא אותו. נסה לייצא את הקובץ מחדש."
            )
        raise HTTPException(status_code=500, detail=f"שגיאה בעיבוד השרטוט: {err[:200]}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
