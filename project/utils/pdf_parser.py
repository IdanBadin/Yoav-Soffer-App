"""
PDF Parser — extracts BOM from AutoCAD electrical drawing PDFs.
Strategy: pdfplumber (raw extraction) → Claude API (intelligent parsing) → validation
"""

import json
import logging
from typing import Any

import pdfplumber
import anthropic

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert at parsing electrical panel Bill of Materials from AutoCAD drawing exports.
The text below was extracted from a PDF and may be messy, multi-column, or partially garbled due to AutoCAD's layout.

Your job: extract EVERY component listed in the BOM table.
The BOM table has these columns: QTY, CATALOG number, USER1 (internal code), MFG (manufacturer), DESCRIPTION.

Rules:
- Include EVERY row — do not skip any component
- If a value is unclear, make your best interpretation
- Ignore: title blocks, revision tables, drawing metadata, page headers/footers
- Return ONLY a JSON array, no other text

Format:
[{"qty": number, "catalog": string, "user1": string, "manufacturer": string, "description": string}]"""


def _extract_raw_text(pdf_path: str) -> tuple[str, str]:
    """Extract raw text and table data from all pages using pdfplumber."""
    all_text_parts = []
    all_table_parts = []

    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)
        logger.info(f"PDF has {page_count} pages")

        for i, page in enumerate(pdf.pages):
            page_num = i + 1
            # Raw text extraction
            text = page.extract_text() or ""
            if text.strip():
                all_text_parts.append(f"=== PAGE {page_num} TEXT ===\n{text}")

            # Table extraction
            tables = page.extract_tables() or []
            for t_idx, table in enumerate(tables):
                rows = []
                for row in table:
                    clean_row = [str(cell or "").strip() for cell in row]
                    if any(cell for cell in clean_row):
                        rows.append(" | ".join(clean_row))
                if rows:
                    all_table_parts.append(
                        f"=== PAGE {page_num} TABLE {t_idx + 1} ===\n" + "\n".join(rows)
                    )

    raw_text = "\n\n".join(all_text_parts)
    raw_tables = "\n\n".join(all_table_parts)
    return raw_text, raw_tables


def _call_claude(raw_text: str, raw_tables: str, api_key: str) -> list[dict]:
    """Send extracted content to Claude API for intelligent BOM parsing."""
    client = anthropic.Anthropic(api_key=api_key)

    user_content = f"""Below is content extracted from an AutoCAD electrical drawing PDF.
Please extract all BOM components.

--- RAW TEXT ---
{raw_text}

--- TABLE DATA ---
{raw_tables}
"""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    response_text = message.content[0].text.strip()

    # Strip markdown code fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return json.loads(response_text)


def _validate_components(raw_components: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Validate parsed components.
    Returns (valid_components, flagged_components).
    """
    valid = []
    flagged = []

    for item in raw_components:
        issues = []

        # Normalize fields
        try:
            qty = float(str(item.get("qty", 0)).replace(",", "."))
        except (ValueError, TypeError):
            qty = 0
            issues.append("qty not numeric")

        catalog = str(item.get("catalog", "")).strip()
        user1 = str(item.get("user1", "")).strip()
        manufacturer = str(item.get("manufacturer", "")).strip()
        description = str(item.get("description", "")).strip()

        if qty <= 0:
            issues.append("qty must be positive")
        if not catalog:
            issues.append("catalog is empty")

        normalized = {
            "qty": qty,
            "catalog": catalog,
            "user1": user1,
            "manufacturer": manufacturer,
            "description": description,
        }

        if issues:
            normalized["_issues"] = issues
            flagged.append(normalized)
        else:
            valid.append(normalized)

    return valid, flagged


def _deduplicate(components: list[dict]) -> list[dict]:
    """
    Deduplicate by (catalog, qty) combination.
    Keeps first occurrence.
    """
    seen: set[tuple] = set()
    result = []
    for item in components:
        key = (item["catalog"].upper(), item["qty"])
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def parse_pdf(pdf_path: str, api_key: str) -> dict[str, Any]:
    """
    Main entry point. Extracts BOM from an AutoCAD PDF.

    Returns:
        {
            "components": [{"qty", "catalog", "user1", "manufacturer", "description"}, ...],
            "flagged": [...],   # rows with validation issues (still included)
            "page_count": int,
            "total_extracted": int,
        }
    """
    # Step 1: Raw extraction
    logger.info("Extracting text from PDF...")
    raw_text, raw_tables = _extract_raw_text(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)

    # Step 2: Claude API parsing
    logger.info("Sending to Claude API for parsing...")
    raw_components = _call_claude(raw_text, raw_tables, api_key)

    # Step 3: Validate
    logger.info(f"Claude returned {len(raw_components)} components. Validating...")
    valid, flagged = _validate_components(raw_components)

    # Step 4: Deduplicate
    all_components = _deduplicate(valid)
    all_flagged = _deduplicate(flagged)

    total = len(all_components) + len(all_flagged)
    logger.info(
        f"Final: {len(all_components)} valid, {len(all_flagged)} flagged, {total} total"
    )

    return {
        "components": all_components,
        "flagged": all_flagged,
        "page_count": page_count,
        "total_extracted": total,
    }
