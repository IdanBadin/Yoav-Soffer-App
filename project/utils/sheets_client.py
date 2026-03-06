"""
Google Sheets client — loads price database and matches components to prices.
Price matching priority:
  1. Exact catalog number (case-insensitive)
  2. Manufacturer + catalog combined
  3. Fuzzy match on description (difflib, cutoff=0.7)
  4. No match → price=0, flagged=True
"""

import difflib
import logging
from datetime import datetime
from typing import Any

import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Expected column names in the Google Sheet (case-insensitive matching)
COL_CATALOG = "catalog_number"
COL_NAME = "item_name"
COL_PRICE = "unit_price"
COL_UNIT = "unit"
COL_MFG = "manufacturer"


def load_price_sheet(credentials_path: str, sheet_id: str, sheet_name: str) -> list[dict]:
    """
    Load all rows from the Google Sheet price database.
    Returns list of dicts with normalized keys.
    """
    creds = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    client = gspread.authorize(creds)

    spreadsheet = client.open_by_key(sheet_id)
    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        # Fall back to first sheet
        worksheet = spreadsheet.get_worksheet(0)
        logger.warning(f"Sheet '{sheet_name}' not found — using first sheet")

    records = worksheet.get_all_records()
    logger.info(f"Loaded {len(records)} price records from Google Sheets")
    return records


def _normalize(text: str) -> str:
    return str(text or "").strip().upper().replace(" ", "").replace("-", "")


def build_price_index(records: list[dict]) -> dict[str, Any]:
    """Build lookup indexes for fast price matching."""
    # Find actual column keys (case-insensitive)
    if not records:
        return {"by_catalog": {}, "by_mfg_catalog": {}, "records": []}

    sample = records[0]

    def find_col(target: str) -> str:
        for k in sample.keys():
            if k.lower().replace("_", "").replace(" ", "") == target.replace("_", "").replace(" ", "").lower():
                return k
        return target

    col_catalog = find_col(COL_CATALOG)
    col_price = find_col(COL_PRICE)
    col_unit = find_col(COL_UNIT)
    col_mfg = find_col(COL_MFG)
    col_name = find_col(COL_NAME)

    by_catalog: dict[str, dict] = {}
    by_mfg_catalog: dict[str, dict] = {}
    normalized_records = []

    for row in records:
        catalog = str(row.get(col_catalog, "")).strip()
        mfg = str(row.get(col_mfg, "")).strip()
        name = str(row.get(col_name, "")).strip()
        try:
            price = float(str(row.get(col_price, 0)).replace(",", ".") or 0)
        except (ValueError, TypeError):
            price = 0.0
        unit = str(row.get(col_unit, "יח'")).strip()

        entry = {
            "catalog": catalog,
            "manufacturer": mfg,
            "name": name,
            "price": price,
            "unit": unit,
        }

        if catalog:
            by_catalog[_normalize(catalog)] = entry
        if mfg and catalog:
            by_mfg_catalog[_normalize(mfg) + "|" + _normalize(catalog)] = entry

        normalized_records.append(entry)

    return {
        "by_catalog": by_catalog,
        "by_mfg_catalog": by_mfg_catalog,
        "records": normalized_records,
    }


def lookup_price(component: dict, index: dict) -> dict:
    """
    Match a BOM component to a price.
    Returns component enriched with: price, unit, match_type, price_found.
    """
    catalog = component.get("catalog", "")
    mfg = component.get("manufacturer", "")
    description = component.get("description", "")

    # 1. Exact catalog match
    key = _normalize(catalog)
    if key and key in index["by_catalog"]:
        entry = index["by_catalog"][key]
        return {**component, "price": entry["price"], "unit": entry["unit"],
                "match_type": "exact_catalog", "price_found": True}

    # 2. Manufacturer + catalog combined
    mfg_key = _normalize(mfg) + "|" + _normalize(catalog)
    if mfg_key and mfg_key in index["by_mfg_catalog"]:
        entry = index["by_mfg_catalog"][mfg_key]
        return {**component, "price": entry["price"], "unit": entry["unit"],
                "match_type": "mfg_catalog", "price_found": True}

    # 3. Fuzzy match on description
    if description and index["records"]:
        names = [r["name"] for r in index["records"] if r["name"]]
        matches = difflib.get_close_matches(description, names, n=1, cutoff=0.7)
        if matches:
            matched_name = matches[0]
            entry = next(r for r in index["records"] if r["name"] == matched_name)
            return {**component, "price": entry["price"], "unit": entry["unit"],
                    "match_type": "fuzzy_description", "price_found": True}

    # 4. No match
    return {**component, "price": 0.0, "unit": "יח'",
            "match_type": "none", "price_found": False}


def match_prices(components: list[dict], index: dict) -> list[dict]:
    """Apply price lookup to all components."""
    return [lookup_price(c, index) for c in components]


def get_last_refresh_time() -> str:
    return datetime.now().strftime("%d/%m/%Y %H:%M")
