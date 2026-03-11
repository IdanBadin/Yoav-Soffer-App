# Flow 2: Excel Bill of Quantities (BoQ) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept an Excel bill of quantities (כתב כמויות), match each component against the Google Sheets price list, fill in prices in-place, and return the filled Excel for download.

**Architecture:** Extend the existing `/process` endpoint to detect `.xlsx` uploads and route to a new BoQ processing pipeline. All logic goes in `backend/main.py`. The response shape stays identical to the PDF flow (`components`, `page_count`, `excel_quote`, `excel_parts`) so the frontend needs no logic changes.

**Tech Stack:** Python/FastAPI, openpyxl (already in requirements.txt), existing `match_prices` + `_semantic_match_unmatched` helpers already in `main.py`.

---

## Context: What Already Exists

- `/process` endpoint currently accepts `.pdf` only — we extend it to also accept `.xlsx`
- `match_prices(components, price_index)` in `utils/sheets_client.py` — takes list of dicts with `description`, `catalog_number`, `manufacturer`, `qty` keys; returns same list with `price`, `unit`, `match_type`, `price_found` added
- `_semantic_match_unmatched(unmatched, raw_records, api_key)` already in `main.py` — batch Claude call for unmatched items
- `_price_index` and `_price_records_raw` are loaded at startup

## Context: BoQ File Formats (from real sample files)

All three formats share the same column pattern:

| Column | Content | Notes |
|--------|---------|-------|
| A | Hierarchical code (08.003.0050) | May be None on note rows |
| B | Description (Hebrew, full sentence) | Main field for matching |
| C | Unit (יח', מ"ר, מ"א, מטר, הערה, קומפ) | "הערה" = note row, skip |
| D | Quantity (numeric) | None on note rows |
| E | Price | **EMPTY — fill this** |
| F | Total | **EMPTY or formula — fill/preserve** |

**Row classification:**
- **Skip:** unit == "הערה", OR qty is None/0, OR description is None/empty
- **Keep:** has description + numeric qty + unit != "הערה"

**Header row detection:** Scan first 5 rows for row containing "כמות" or "מחיר" — that's row index H. Data rows start at H+1.

---

## File Changes

| File | Action | What changes |
|------|--------|--------------|
| `backend/main.py` | Modify | Add 4 helper functions + extend `/process` to detect `.xlsx` |
| `frontend/src/components/UploadZone.tsx` | Modify (JSX only) | Accept `.xlsx` in addition to `.pdf` |
| `frontend/src/components/ResultsView.tsx` | Modify (JSX only) | Hide `excel_parts` download when it's empty; rename download button for BoQ |
| `frontend/src/types.ts` | Modify | Add `boq_mode?: boolean` to `ProcessResult` |

---

## Chunk 1: Backend — BoQ Processing Pipeline

### Task 1: BoQ Column/Structure Detection

**File:** `backend/main.py` — add `_detect_boq_structure(ws)` before `/process` endpoint

- [ ] **Add the function** after `_semantic_match_unmatched`:

```python
def _detect_boq_structure(ws) -> dict:
    """
    Detect header row and column positions in a BoQ worksheet.
    Returns: {
        'header_row': int (1-indexed),
        'col_code': int | None,
        'col_desc': int,        # required
        'col_unit': int | None,
        'col_qty': int,         # required
        'col_price': int,       # required
        'col_total': int | None,
    }
    Raises ValueError if required columns not found.
    """
    DESC_KW  = {'תיאור', 'פירוט', 'description', 'שם'}
    QTY_KW   = {'כמות', 'qty', 'quantity'}
    PRICE_KW = {'מחיר', 'price'}
    UNIT_KW  = {"יח'", 'יחידה', 'unit', "יח' מידה", "יח"}
    TOTAL_KW = {'סהכ', 'סה"כ', 'סה כ', 'total'}
    CODE_KW  = {'סעיף', 'מספר', 'קוד', 'code', 'number'}

    header_row = None
    for row_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=8, values_only=True), start=1):
        vals = [str(v).strip().lower() if v is not None else '' for v in row]
        # A header row has at least 2 of: qty, price, description keyword
        hits = 0
        for v in vals:
            if any(kw.lower() in v for kw in QTY_KW | PRICE_KW | DESC_KW):
                hits += 1
        if hits >= 2:
            header_row = row_idx
            header_vals = [str(v).strip() if v is not None else '' for v in row]
            break

    if header_row is None:
        # Fallback: assume row 1 is header
        header_row = 1
        header_vals = [str(v).strip() if v is not None else ''
                       for v in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]

    col_desc = col_qty = col_price = None
    col_code = col_unit = col_total = None

    for i, v in enumerate(header_vals):
        vl = v.lower()
        if col_code is None  and any(k.lower() in vl for k in CODE_KW):  col_code  = i
        if col_desc is None  and any(k.lower() in vl for k in DESC_KW):  col_desc  = i
        if col_unit is None  and any(k.lower() in vl for k in UNIT_KW):  col_unit  = i
        if col_qty  is None  and any(k.lower() in vl for k in QTY_KW):   col_qty   = i
        if col_price is None and any(k.lower() in vl for k in PRICE_KW): col_price = i
        if col_total is None and any(k.lower() in vl for k in TOTAL_KW): col_total = i

    # Fallback for formats where header detection misses: use positional heuristic
    # Formats observed: [code(0), desc(1), unit(2), qty(3), price(4), total(5)]
    if col_desc is None:  col_desc  = 1
    if col_qty  is None:  col_qty   = 3
    if col_price is None: col_price = 4
    if col_unit is None:  col_unit  = 2
    if col_total is None and ws.max_column >= 6: col_total = 5

    return {
        'header_row': header_row,
        'col_code':   col_code,
        'col_desc':   col_desc,
        'col_unit':   col_unit,
        'col_qty':    col_qty,
        'col_price':  col_price,
        'col_total':  col_total,
    }
```

- [ ] **Verify function** with a quick local test:
```bash
cd backend && python3 -c "
import openpyxl, sys
sys.path.insert(0,'.')
from main import _detect_boq_structure
for f in [
    '../sample_files/דוגמא לכתב כמויות.xlsx',
    '../sample_files/דוגמא לכתב כמויות (2).xlsx',
    '../sample_files/דוגמא לכתב כמויות (3).xlsx',
]:
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb.active
    print(f.split('/')[-1], _detect_boq_structure(ws))
"
```
Expected: all three return `col_desc=1, col_qty=3, col_price=4` (or close).

---

### Task 2: BoQ Item Extraction

**File:** `backend/main.py` — add `_extract_boq_items(ws, structure)` after Task 1 function

- [ ] **Add the function:**

```python
def _extract_boq_items(ws, structure: dict) -> list:
    """
    Extract priceable component rows from a BoQ worksheet.
    Returns list of:
    {
        'row_idx': int (1-indexed, for writing back),
        'description': str,
        'qty': float,
        'unit': str,
        'code': str,
        'catalog_number': str,   # same as code, for match_prices compat
        'manufacturer': str,
        'price_col': int,        # 0-indexed column for writing price back
        'total_col': int | None, # 0-indexed column for writing total back
    }
    """
    SKIP_UNITS = {'הערה', 'note', 'notes', ''}
    items = []
    data_start = structure['header_row'] + 1

    c_desc  = structure['col_desc']
    c_qty   = structure['col_qty']
    c_unit  = structure['col_unit']
    c_code  = structure['col_code']
    c_price = structure['col_price']
    c_total = structure['col_total']

    for row_idx, row in enumerate(
        ws.iter_rows(min_row=data_start, values_only=True), start=data_start
    ):
        if len(row) <= max(c_desc, c_qty, c_price):
            continue

        desc = row[c_desc] if c_desc is not None else None
        qty_raw = row[c_qty] if c_qty is not None else None
        unit_raw = row[c_unit] if c_unit is not None else ''
        code_raw = row[c_code] if c_code is not None else ''

        # Skip empty rows
        if desc is None or str(desc).strip() == '':
            continue

        desc_str = str(desc).strip()
        unit_str = str(unit_raw).strip() if unit_raw is not None else ''

        # Skip note rows
        if unit_str in SKIP_UNITS:
            continue
        if len(desc_str) < 3:
            continue

        # Parse quantity
        try:
            qty = float(str(qty_raw).replace(',', '.').strip()) if qty_raw is not None else 0.0
        except (ValueError, TypeError):
            qty = 0.0

        if qty <= 0:
            continue

        code_str = str(code_raw).strip() if code_raw is not None else ''

        items.append({
            'row_idx':       row_idx,
            'description':   desc_str,
            'qty':           qty,
            'unit':          unit_str or "יח'",
            'code':          code_str,
            'catalog_number': code_str,   # for match_prices compatibility
            'manufacturer':  '',
            'price_col':     c_price,
            'total_col':     c_total,
        })

    return items
```

- [ ] **Verify extraction count** with test:
```bash
cd backend && python3 -c "
import openpyxl, sys
sys.path.insert(0,'.')
from main import _detect_boq_structure, _extract_boq_items
for f in [
    '../sample_files/דוגמא לכתב כמויות.xlsx',
    '../sample_files/דוגמא לכתב כמויות (2).xlsx',
    '../sample_files/דוגמא לכתב כמויות (3).xlsx',
]:
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb.active
    s = _detect_boq_structure(ws)
    items = _extract_boq_items(ws, s)
    print(f'{f.split(\"/\")[-1]}: {len(items)} items')
    for item in items[:2]:
        print(f'  {item[\"row_idx\"]}: qty={item[\"qty\"]} [{item[\"unit\"]}] {item[\"description\"][:50]}')
"
```
Expected: Format A ~38 items, Format B ~100+, Format C ~100+.

---

### Task 3: BoQ Price Filling

**File:** `backend/main.py` — add `_fill_boq_excel(file_bytes, items, matched)` after Task 2

- [ ] **Add the function:**

```python
def _fill_boq_excel(file_bytes: bytes, items: list, matched: list) -> bytes:
    """
    Write matched prices back into the Excel file.
    - matched[i] has same structure as items[i] but with 'price', 'price_found' added
    - Unmatched items: highlight description cell yellow
    - Returns modified Excel as bytes
    """
    import io
    from openpyxl import load_workbook
    from openpyxl.styles import PatternFill

    YELLOW = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")

    wb = load_workbook(io.BytesIO(file_bytes))
    ws = wb.active

    for item, match in zip(items, matched):
        row_idx   = item['row_idx']
        price_col = item['price_col'] + 1   # openpyxl is 1-indexed
        desc_col  = 2                        # description is always col B (index 1 → col 2)
        total_col = (item['total_col'] + 1) if item['total_col'] is not None else None

        if match.get('price_found') and match.get('price', 0) > 0:
            ws.cell(row=row_idx, column=price_col).value = match['price']
            if total_col:
                qty = item['qty']
                price = match['price']
                ws.cell(row=row_idx, column=total_col).value = qty * price
        else:
            # Highlight unmatched rows in yellow
            ws.cell(row=row_idx, column=desc_col).fill = YELLOW
            # Add a note in the price cell
            ws.cell(row=row_idx, column=price_col).value = None

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
```

- [ ] **Test fill function** (without real price data — just verify it writes without error):
```bash
cd backend && python3 -c "
import openpyxl, io, sys
sys.path.insert(0,'.')
from main import _detect_boq_structure, _extract_boq_items, _fill_boq_excel

path = '../sample_files/דוגמא לכתב כמויות.xlsx'
with open(path, 'rb') as f:
    file_bytes = f.read()

wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
ws = wb.active
s = _detect_boq_structure(ws)
items = _extract_boq_items(ws, s)

# Fake match: mark all as unmatched
fake_matched = [{**item, 'price': 0.0, 'price_found': False} for item in items]
result = _fill_boq_excel(file_bytes, items, fake_matched)
print(f'Output size: {len(result)} bytes (original: {len(file_bytes)})')
assert len(result) > 0
print('OK')
"
```

---

### Task 4: BoQ Main Flow Function

**File:** `backend/main.py` — add `_process_boq_flow(file_bytes, filename, price_index, price_records_raw, api_key)` after Task 3

- [ ] **Add the function:**

```python
def _process_boq_flow(
    file_bytes: bytes,
    price_index: Optional[dict],
    price_records_raw: Optional[list],
    api_key: str,
) -> dict:
    """
    Full BoQ processing pipeline.
    Returns dict matching /process response shape:
    { components, page_count, excel_quote, excel_parts, boq_mode }
    """
    import io
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    structure = _detect_boq_structure(ws)
    items = _extract_boq_items(ws, structure)

    if not items:
        raise ValueError("לא נמצאו פריטים בכתב הכמויות. ודא שהקובץ מכיל עמודות כמות ומחיר.")

    logger.info(f"BoQ: extracted {len(items)} priceable items")

    # Build components in the format that match_prices expects
    components_for_match = [
        {
            "description": item["description"],
            "catalog_number": item["catalog_number"],
            "manufacturer": item["manufacturer"],
            "qty": item["qty"],
        }
        for item in items
    ]

    # Step 1-3: match_prices (exact + normalized + fuzzy)
    if price_index:
        matched = match_prices(components_for_match, price_index)
    else:
        matched = [
            {**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
            for c in components_for_match
        ]

    # Step 4: semantic matching for unmatched
    unmatched = [(i, c) for i, c in enumerate(matched) if not c.get("price_found")]
    if unmatched and price_records_raw and api_key:
        try:
            semantic = _semantic_match_unmatched(unmatched, price_records_raw, api_key)
            for idx, match_data in semantic.items():
                matched[idx] = {**matched[idx], **match_data}
            logger.info(f"BoQ semantic matching resolved {len(semantic)} of {len(unmatched)} unmatched")
        except Exception as e:
            logger.warning(f"BoQ semantic matching skipped: {e}")

    # Merge qty and unit back for display
    for i, item in enumerate(items):
        matched[i] = {
            **matched[i],
            "qty": item["qty"],
            "unit": matched[i].get("unit") or item["unit"],
        }

    # Fill prices into Excel
    filled_bytes = _fill_boq_excel(file_bytes, items, matched)

    # Build component list for frontend display
    components_display = [
        {
            "description":   item["description"],
            "catalog_number": item["catalog_number"],
            "manufacturer":  matched[i].get("manufacturer", ""),
            "qty":           item["qty"],
            "unit":          matched[i].get("unit", item["unit"]),
            "price":         matched[i].get("price", 0.0),
            "match_type":    matched[i].get("match_type", "none"),
            "price_found":   matched[i].get("price_found", False),
        }
        for i, item in enumerate(items)
    ]

    matched_count = sum(1 for c in components_display if c["price_found"])
    logger.info(f"BoQ: {matched_count}/{len(items)} items matched")

    excel_b64 = base64.b64encode(filled_bytes).decode("utf-8")

    return {
        "components":  components_display,
        "page_count":  0,
        "excel_quote": excel_b64,
        "excel_parts": "",
        "boq_mode":    True,
    }
```

---

### Task 5: Extend `/process` to Handle Excel Files

**File:** `backend/main.py` — modify the existing `/process` endpoint

- [ ] **Change the file validation** from PDF-only to PDF+XLSX. Replace the existing check:

```python
# BEFORE (line ~348):
if not file.filename or not file.filename.lower().endswith(".pdf"):
    raise HTTPException(status_code=422, detail="יש להעלות קובץ PDF בלבד. סוג הקובץ שהועלה אינו נתמך.")
```

With:
```python
fname_lower = (file.filename or "").lower()
is_pdf  = fname_lower.endswith(".pdf")
is_xlsx = fname_lower.endswith(".xlsx") or fname_lower.endswith(".xls")

if not is_pdf and not is_xlsx:
    raise HTTPException(
        status_code=422,
        detail="יש להעלות קובץ PDF (שרטוט) או Excel (כתב כמויות). סוג הקובץ שהועלה אינו נתמך."
    )
```

- [ ] **Add BoQ routing** in the main `try` block, right after `content = await file.read()` and the size checks. Insert BEFORE the existing `with tempfile.NamedTemporaryFile` block:

```python
# ── Excel BoQ flow ───────────────────────────────────────
if is_xlsx:
    logger.info(f"Processing BoQ Excel: {file.filename} ({len(content) / 1024:.0f} KB)")
    boq_result = _process_boq_flow(
        content,
        _price_index,
        _price_records_raw,
        api_key,
    )
    return boq_result
# ── PDF flow continues below ──────────────────────────────
```

- [ ] **Verify the backend handles both file types** by starting the server and testing with curl:

```bash
# Start backend (kill existing first)
lsof -ti :8000 | xargs kill -9 2>/dev/null
cd backend && uvicorn main:app --port 8000 --reload &
sleep 4

# Test BoQ with Format A
curl -s -X POST http://localhost:8000/process \
  -F "file=@../sample_files/דוגמא לכתב כמויות.xlsx" \
  -F "project_name=Test" \
  -F "manager_name=Test" \
  -F "date=2026-03-11" | python3 -c "
import json, sys, base64
d = json.load(sys.stdin)
print('boq_mode:', d.get('boq_mode'))
print('components:', len(d['components']))
print('matched:', sum(1 for c in d['components'] if c['price_found']))
print('excel_quote length:', len(d['excel_quote']))
# Save filled file for manual inspection
with open('/tmp/boq_filled_test.xlsx', 'wb') as f:
    f.write(base64.b64decode(d['excel_quote']))
print('Saved to /tmp/boq_filled_test.xlsx')
"
```

Expected output:
- `boq_mode: True`
- `components: ~38` (Format A)
- `matched: N` (some number > 0)
- `excel_quote length: >1000`

- [ ] **Open `/tmp/boq_filled_test.xlsx`** in Excel/LibreOffice and verify:
  - Prices are filled in column E for matched items
  - Unmatched rows have yellow highlight in description cell
  - Original formatting preserved

- [ ] **Test with PDF to ensure no regression:**

```bash
curl -s -X POST http://localhost:8000/process \
  -F "file=@../sample_files/שרטוט לדוגמא AutoCAD.pdf" \
  -F "project_name=Test" \
  -F "manager_name=Test" \
  -F "date=2026-03-11" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('page_count:', d['page_count'])
print('components:', len(d['components']))
print('excel_quote exists:', bool(d['excel_quote']))
print('boq_mode:', d.get('boq_mode', 'absent - correct'))
"
```

Expected: `boq_mode: absent`, `components > 0`, no errors.

---

## Chunk 2: Frontend — Accept Excel + BoQ-aware UI

### Task 6: Allow Excel Uploads in UploadZone

**File:** `frontend/src/components/UploadZone.tsx`

- [ ] **Read the file first:**

```bash
cat frontend/src/components/UploadZone.tsx
```

- [ ] **Find the file input `accept` attribute** — it currently restricts to PDF. Change it to also accept `.xlsx`:

Look for: `accept=".pdf"` or `accept="application/pdf"`
Change to: `accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`

- [ ] **Update the drag-drop description text** (JSX only) to mention both file types:
  - Look for any text like "PDF בלבד" or "גרור PDF" and update to "PDF או Excel (כתב כמויות)"

- [ ] **Update the file icon or label** to reflect both types (optional polish).

- [ ] **Verify build compiles:**
```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

---

### Task 7: Update ProcessResult Type and ResultsView

**File:** `frontend/src/types.ts`

- [ ] **Add `boq_mode` optional field** to `ProcessResult`:

```typescript
export interface ProcessResult {
  components: Component[]
  page_count: number
  excel_quote: string
  excel_parts: string
  boq_mode?: boolean    // ← add this
}
```

**File:** `frontend/src/components/ResultsView.tsx`

- [ ] **Read the file:**
```bash
cat frontend/src/components/ResultsView.tsx
```

- [ ] **Find the `excel_parts` download button** (JSX). Add a conditional to hide it when it's empty or when `boq_mode` is true:

```tsx
// BEFORE:
<button onClick={() => downloadExcel(result.excel_parts, `חלקים-${projectName}.xlsx`)}>
  הורד רשימת חלקים
</button>

// AFTER (JSX change only):
{result.excel_parts && !result.boq_mode && (
  <button onClick={() => downloadExcel(result.excel_parts, `חלקים-${projectName}.xlsx`)}>
    הורד רשימת חלקים
  </button>
)}
```

- [ ] **Rename the main download button** for BoQ mode (JSX only):

```tsx
// Label changes based on mode:
{result.boq_mode ? 'הורד כתב כמויות ממולא' : 'הורד הצעת מחיר'}
```

- [ ] **Verify build:**
```bash
cd frontend && npm run build 2>&1 | tail -5
```

---

### Task 8: End-to-End Test

- [ ] **Start both servers:**
```bash
# Kill stale processes
lsof -ti :8000 | xargs kill -9 2>/dev/null

# Backend
cd backend && uvicorn main:app --port 8000 --reload > /tmp/backend.log 2>&1 &
sleep 4 && curl -s http://localhost:8000/health

# Frontend
cd frontend && npm run dev > /tmp/frontend.log 2>&1 &
sleep 3 && cat /tmp/frontend.log | tail -5
```

- [ ] **Upload `דוגמא לכתב כמויות.xlsx` via browser** (http://localhost:5175):
  - Drag the file to the upload zone
  - Fill in project details and submit
  - Verify processing screen appears
  - Verify results show the component table
  - Verify only one download button appears: "הורד כתב כמויות ממולא"
  - Download and open the file — check prices are filled

- [ ] **Upload `דוגמא לכתב כמויות (2).xlsx` and `(3).xlsx`** — verify both work

- [ ] **Upload a PDF** — verify the PDF flow still works normally (both download buttons appear)

---

## Chunk 3: Commit and Deploy

### Task 9: Git Commit

- [ ] **Check git status:**
```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer" && git status
```

- [ ] **Stage files:**
```bash
git add backend/main.py \
        frontend/src/components/UploadZone.tsx \
        frontend/src/components/ResultsView.tsx \
        frontend/src/types.ts
```

- [ ] **Commit:**
```bash
git commit -m "feat: Flow 2 — Excel BoQ price filling

- POST /process now accepts .xlsx (bill of quantities) in addition to .pdf
- Auto-detects BoQ column structure (header scanning + positional fallback)
- Extracts priceable items (skips note rows, rows without qty)
- Matches via existing 4-step pipeline (exact→normalized→fuzzy→semantic)
- Fills prices in-place, highlights unmatched rows in yellow
- Returns filled Excel as excel_quote; frontend shows correct download button
- Frontend UploadZone now accepts .pdf and .xlsx"
```

- [ ] **Push to GitHub:**
```bash
git push
```

- [ ] **Monitor Railway deployment** — check logs at https://railway.app dashboard

---

## Notes & Risks

### Matching quality expectation
BoQ descriptions are full Hebrew sentences like "מאמ"ת בגודל 3x160/100A עם הגנות אלקטרוניות L.S.I". The fuzzy matcher (difflib) will match partial descriptions poorly. The **semantic match (Claude API)** will handle most of these. Expect ~60-80% match rate on a real BoQ.

### openpyxl and merged cells
If the BoQ has merged cells, writing to a merged cell range will raise an error. The `_fill_boq_excel` function writes to the first cell in any row — this is safe as long as merged cells don't span the price column. If this becomes an issue, wrap the write in a try/except per cell.

### Format B specifics
Format B has section headers (rows where col A is an integer like `1`, `2` and col B is a category name). These rows have no qty and will be correctly skipped by `_extract_boq_items`.

### Total column formulas
Some files have existing `=D*C` formulas in the total column. `data_only=True` reads the cached value, not the formula. When we write prices back with openpyxl, we overwrite the cell value (not formula). This is acceptable — the client gets a static price, not a formula. If formula preservation is needed in the future, use `load_workbook(data_only=False)` and inspect cell.data_type.

### The `excel_parts` empty string
When `boq_mode=True`, `excel_parts=""`. The frontend hides this button via JSX condition. The `Component` type doesn't need changing — the same fields are populated.
