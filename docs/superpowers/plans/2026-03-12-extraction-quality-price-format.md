# Extraction Quality + Price Format Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix over-extraction of noise items in Vision API (reduces inflated totals from ~50k to ~20k) and ensure both unit_price and total columns are filled in BoQ Excel output.

**Architecture:** Two targeted edits to `backend/main.py`:
1. Harden the Claude Vision prompt to exclude cables/dimensions/annotations, then add a Python post-filter as a safety net.
2. Fix `_fill_boq_excel` to always write total (qty × price) even when a dedicated total column isn't detected in the template.

**Tech Stack:** Python, FastAPI, Claude Vision API (`claude-sonnet-4-5`), openpyxl

---

## Chunk 1: Vision Prompt Hardening + Post-Extraction Filter

### Task 1: Harden Vision Prompt in `_vision_extract_page`

**Files:**
- Modify: `backend/main.py` — `_vision_extract_page` function (around line 455)

**Context:** The current prompt includes "cables (כבל)" in INCLUDE, which is wrong — cables in AutoCAD panel drawings are cross-section references (e.g., "3×6", "5×4"), not purchasable items. It also doesn't explicitly warn against: shaft dimensions (ציר קוטר), travel/labor items (נסיעה), dimensional annotations (mm, cm values), IP/temperature ratings appearing inline with component labels.

- [ ] **Step 1: Read the current prompt** in `_vision_extract_page` (line ~455 in main.py) to confirm exact text before editing.

- [ ] **Step 2: Replace the prompt** with the hardened version below.

```python
prompt = (
    "You are analyzing an AutoCAD electrical panel (לוח חשמל) drawing.\n\n"
    "Extract ONLY purchasable electrical components — physical items that a supplier would sell and appear in a bill of materials.\n\n"
    "INCLUDE (examples only — include similar items):\n"
    "  circuit breakers (מפסק אוטומטי), contactors (מגען), motor protection relays (מגן מנוע), "
    "residual current devices (מפסק פחת), terminals (מסוף/קלמה), busbars (שפה/בוסבר), "
    "meters (מד), pilot lights (נורה), selector switches (בורר), timers (טיימר), "
    "transformers (שנאי/טרנספורמטור), fuses (פיוז), surge protectors (מוגן ברק), "
    "enclosures (ארון חשמל/לוח), DIN rails, cable ducts (מרזב), "
    "push buttons (לחצן), relays (ממסר), soft starters (מתנע רך), VFDs (ממיר תדר).\n\n"
    "NEVER EXTRACT — these are drawing annotations, not purchasable items:\n"
    "  • Cables / cross-sections — any text like 'כבל', 'NYY', 'NYM', 'כבלים', '3×6', '5×4', '2×2.5', cable cross-section references\n"
    "  • Shaft / mechanical dimensions — 'ציר', 'קוטר', 'אורך', any item with mm/cm dimensions as primary description\n"
    "  • Labor / travel — 'נסיעה', 'עבודה', 'התקנה', 'הנדסה'\n"
    "  • Drawing metadata — standards (IEC/EN/ISO), IP ratings, temperature ratings, drawing titles, revision numbers, company names\n"
    "  • Pure notes — section headers, comments, calculation values\n\n"
    "For each component return a JSON object:\n"
    '  "description": string — component name + key specs (type, poles, rating in A/V/kW)\n'
    '  "qty": number — integer quantity (default 1)\n'
    '  "unit": string — use "יח\'" for pieces, "מ\'" for meters\n'
    '  "catalog": string — model/catalog number if visible, else ""\n\n'
    "Return ONLY a JSON array, no markdown, no explanation. Example:\n"
    '[{"description":"מפסק אוטומטי 3P 63A","qty":2,"unit":"יח\'","catalog":""},\n'
    ' {"description":"מגן מנוע 11-16A","qty":1,"unit":"יח\'","catalog":"GV2ME16"}]\n\n'
    "If no purchasable components are visible on this page, return []."
)
```

Key changes vs. current:
- Removed `כבל / cables` from INCLUDE
- Added explicit NEVER EXTRACT section with Hebrew terms and examples
- Added labor/travel items (`נסיעה`, `עבודה`) to NEVER EXTRACT
- Added shaft/dimension items (`ציר`, `קוטר`) to NEVER EXTRACT
- Kept cable ducts (מרזב) and DIN rails in INCLUDE — these ARE purchasable hardware

- [ ] **Step 3: Test locally with a sample PDF**

```bash
cd /Users/idanbadin/Desktop/Yoav\ Sofer
# Kill any stale backend
lsof -ti :8000 | xargs kill -9 2>/dev/null; sleep 1
cd backend && uvicorn main:app --port 8000 --reload &
sleep 3

# Upload sample PDF via curl (absolute path avoids CWD ambiguity)
curl -s -X POST http://localhost:8000/process \
  -F "file=@/Users/idanbadin/Desktop/Yoav Sofer/sample_files/שרטוט לדוגמא AutoCAD.pdf" \
  -F "project_name=Test" \
  -F "manager_name=Test" \
  -F "date=2026-03-12" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
comps = data.get('components', [])
print(f'Total components: {len(comps)}')
for c in comps:
    print(f'  [{c.get(\"match_type\",\"?\"):8}] qty={c.get(\"qty\",0):3} | {c.get(\"description\",\"\")[:60]}')
"
```

Expected: no items with "כבל", "נסיעה", "ציר", "קוטר" in descriptions.

---

### Task 2: Add AI-Powered Post-Extraction Validation (Dynamic, not hardcoded)

**Files:**
- Modify: `backend/main.py` — add `_validate_components_ai()` function + call it in `_process_pdf_vision`

**Context:** Even with a better prompt, Claude Vision can occasionally include noise items that differ between drawings, companies, and languages. Instead of a static regex blacklist (fragile, language-dependent), we use a second Claude AI call (claude-haiku-4-5-20251001 — fast and cheap) to validate the extracted list.

This approach is **dynamic**: it works for any drawing in any language and handles edge cases that hardcoded rules would miss. The Haiku model is used to keep latency + cost minimal (one batch call, not per-item).

**Design:**
```
Vision extracts items → Claude Haiku validates list → keep only real components → dedup → price match
```

- [ ] **Step 1: Add `_validate_components_ai()` function** after `_vision_extract_page` and before `_process_pdf_vision`:

```python
def _validate_components_ai(items: list, api_key: str) -> list:
    """
    Use Claude to filter out non-purchasable drawing annotations from Vision-extracted items.

    Dynamic validation — works for any drawing without hardcoded rules.
    Uses claude-haiku for speed + cost efficiency (one batch call).
    Returns the filtered list of real purchasable components.
    """
    if not items:
        return items

    client = _anthropic.Anthropic(api_key=api_key)

    items_json = json.dumps(
        [{"idx": i, "desc": item.get("description", ""), "catalog": item.get("catalog", "")}
         for i, item in enumerate(items)],
        ensure_ascii=False
    )

    prompt = (
        "You are an expert in Israeli electrical panel drawings (לוחות חשמל).\n\n"
        "Below is a list of items extracted from an AutoCAD drawing. "
        "Some are real purchasable electrical components; others are drawing annotations, "
        "cable cross-section references, dimensional notes, or labor items.\n\n"
        "Return a JSON array of ONLY the indices of items that are real purchasable components "
        "(circuit breakers, contactors, terminals, busbars, meters, relays, enclosures, etc.).\n\n"
        "EXCLUDE indices for:\n"
        "- Cable cross-sections (e.g., '3×6', 'NYY 5×4', 'כבל 3×2.5')\n"
        "- Shaft / mechanical dimensions (ציר, קוטר, mm dimensions)\n"
        "- Labor / travel items (נסיעה, עבודה, התקנה)\n"
        "- Drawing metadata (titles, standards, IP ratings, dates, revision notes)\n\n"
        f"Items:\n{items_json}\n\n"
        "Return ONLY a JSON array of indices to keep, e.g.: [0, 1, 3, 5]\n"
        "No explanation, no markdown."
    )

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        # Extract JSON array from response
        match = re.search(r'\[[\d\s,]*\]', text)
        if not match:
            logger.warning("AI validation: no valid index array returned, keeping all items")
            return items
        keep_indices = set(json.loads(match.group()))
        filtered = [item for i, item in enumerate(items) if i in keep_indices]
        logger.info(f"AI validation: kept {len(filtered)}/{len(items)} items")
        return filtered
    except Exception as e:
        logger.warning(f"AI validation failed ({e}), keeping all items")
        return items  # Graceful fallback: never break the main flow
```

- [ ] **Step 2: Call `_validate_components_ai()`** in `_process_pdf_vision`, right after flattening page results.

Find (around line 555):
```python
    all_items: list = [item for page in page_results for item in page]
```

Replace with:
```python
    all_items_raw: list = [item for page in page_results for item in page]
    logger.info(f"Vision PDF: {len(all_items_raw)} raw items before AI validation")
    all_items = _validate_components_ai(all_items_raw, api_key)
```

- [ ] **Step 3: Re-run the test from Task 1** to verify noise items are removed and count is reasonable:

```bash
curl -s -X POST http://localhost:8000/process \
  -F "file=@/Users/idanbadin/Desktop/Yoav Sofer/sample_files/שרטוט לדוגמא AutoCAD.pdf" \
  -F "project_name=Test" -F "manager_name=Test" -F "date=2026-03-12" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
comps = data.get('components', [])
print(f'Total after AI validation: {len(comps)}')
for c in comps:
    print(f'  {c.get(\"description\",\"\")[:60]}')
"
```

Expected: no cable cross-sections, no dimensions, no labor items in list.

- [ ] **Step 4: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add backend/main.py
git commit -m "fix: harden Vision prompt + add AI-powered component validation

- Remove cables from Vision INCLUDE (cross-section refs, not components)
- Add explicit NEVER EXTRACT section with Hebrew + English examples
- Add _validate_components_ai() — uses claude-haiku to dynamically filter
  noise items from any drawing without hardcoded language rules
- Graceful fallback: AI validation failure keeps all items, never breaks flow"
```

---

## Chunk 2: BoQ Price Format Fix

### Task 3: Fix `_fill_boq_excel` — Always Write Total

**Files:**
- Modify: `backend/main.py` — `_fill_boq_excel` function (around line 331)

**Context:** When a BoQ template has only one price column (e.g., "מחיר" without a separate "סה"כ"), `total_col` is `None` and only unit_price is written. Note: `_detect_boq_structure` already uses a positional fallback that sets `col_total = 5` for files with ≥6 columns — so `total_col is None` is an edge case for very narrow templates. The fix ensures total is written in either case: if total_col is detected, use it; otherwise write to price_col+1. For templates that already have both columns detected, behavior is unchanged.

- [ ] **Step 1: Read `_fill_boq_excel`** (around line 331) to confirm current logic before editing.

- [ ] **Step 2: Update the price-writing block** inside `_fill_boq_excel`:

Find:
```python
        if match.get('price_found') and match.get('price', 0) > 0:
            ws.cell(row=row_idx, column=price_col).value = match['price']
            if total_col:
                ws.cell(row=row_idx, column=total_col).value = item['qty'] * match['price']
        else:
            ws.cell(row=row_idx, column=desc_col).fill = YELLOW
```

Replace with:
```python
        if match.get('price_found') and match.get('price', 0) > 0:
            unit_price = match['price']
            total_price = item['qty'] * unit_price
            ws.cell(row=row_idx, column=price_col).value = unit_price
            if total_col:
                ws.cell(row=row_idx, column=total_col).value = total_price
            else:
                # No dedicated total column detected — write total to the column right of price
                ws.cell(row=row_idx, column=price_col + 1).value = total_price
        else:
            ws.cell(row=row_idx, column=desc_col).fill = YELLOW
```

- [ ] **Step 3: Test with a BoQ sample file**

```bash
curl -s -X POST http://localhost:8000/process \
  -F "file=@/Users/idanbadin/Desktop/Yoav Sofer/sample_files/דוגמא לכתב כמויות.xlsx" \
  | python3 -c "
import json, sys, base64
data = json.load(sys.stdin)
comps = data.get('components', [])
print(f'BoQ mode: {data.get(\"boq_mode\")}')
print(f'Components: {len(comps)}')
matched = [c for c in comps if c.get('price_found')]
print(f'Matched: {len(matched)}/{len(comps)}')
# Save filled Excel to disk
excel_b64 = data.get('excel_quote', '')
if excel_b64:
    with open('/tmp/boq_filled.xlsx', 'wb') as f:
        f.write(base64.b64decode(excel_b64))
    print('Saved filled BoQ to /tmp/boq_filled.xlsx — open and verify unit_price + total columns')
"
```

Open `/tmp/boq_filled.xlsx` and manually verify:
- Matched rows have unit_price in price_col
- The column to the right has qty × unit_price

- [ ] **Step 4: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add backend/main.py
git commit -m "fix: BoQ fill always writes unit_price + total

When no dedicated total column detected, writes total (qty×price)
to the column immediately right of price_col"
```

---

## Chunk 3: Deploy + Verify

### Task 4: Push and Verify Production

- [ ] **Step 1: Push to GitHub** (triggers Railway + Netlify auto-deploy)

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git push origin main
```

- [ ] **Step 2: Confirm Railway build succeeds**

```bash
# Watch Railway deploy logs:
# Go to https://railway.app → Yoav Soffer App → Deployments → latest
# Or use Railway CLI if available: railway logs
```

Expected: build completes, no Python errors, poppler-utils installed via aptPkgs.

- [ ] **Step 3: Production smoke test — PDF**

Upload `שרטוט לדוגמא AutoCAD (2).pdf` at https://yoavsofferapp.netlify.app and verify:
- No cable items in component list
- No dimension annotations in list
- Total matches closer to expected (manual count)
- Download Excel — D column = unit_price, E column = total

- [ ] **Step 4: Production smoke test — BoQ**

Upload `דוגמא לכתב כמויות.xlsx` at https://yoavsofferapp.netlify.app and verify:
- Price col = unit price from price list
- Next column = qty × unit_price

---

## Summary of Changes

| File | Function | Change |
|------|----------|--------|
| `backend/main.py` | `_vision_extract_page` | Hardened prompt — cables removed from INCLUDE, added NEVER EXTRACT section |
| `backend/main.py` | top-level | Added `_NOISE_PATTERNS`, `_NOISE_RE`, `_is_noise_component()` |
| `backend/main.py` | `_process_pdf_vision` | Apply noise filter after collecting page results |
| `backend/main.py` | `_fill_boq_excel` | Write total to price_col+1 when total_col is None |

**No frontend changes required.** The component list and Excel format changes are backend-only.
