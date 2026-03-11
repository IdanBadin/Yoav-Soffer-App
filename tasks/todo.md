# Active Task: Flow 2 — Excel BoQ Implementation
Plan: docs/plans/2026-03-11-boq-excel-flow.md

## Chunks
- [x] Chunk 1: Backend pipeline (Tasks 1-5) — 84% match on Format A, 238 prices loaded
- [x] Chunk 2: Frontend (Tasks 6-7) — TS build passes, both servers running
- [ ] Chunk 3: E2E test + commit (Tasks 8-9)

---

# Previous Task (completed): Excel → Google Sheets full sync + new columns
Date: 2026-03-11

## Goal
Replace Google Sheets price data with complete updated Excel, adding new columns (עלות, הערות), and display them in the PriceListView.

## Excel Schema (מחירון לוחות י.סופר 10.2025.xlsx)
- A: מס"ד (serial number)
- B: ספק (manufacturer)
- C: מק"ט (catalog_number)
- D: תיאור (item_name) — category headers too
- E: יח' מידה (unit)
- F: כמות (quantity) — mostly empty
- G: עלות (cost — purchase price) — NEW
- H: מחיר (unit_price — sell price)
- I: הערות (notes) — NEW

## Current Google Sheets columns
catalog_number | item_name | unit_price | unit | manufacturer | category

## New Google Sheets columns to add
catalog_number | item_name | unit_price | unit | manufacturer | category | cost | notes

## Plan
- [ ] Step 1: Update scripts/import_pricelist.py to include cost + notes columns
- [ ] Step 2: Test parse locally (dry run, no write)
- [ ] Step 3: Run import to replace Google Sheets data
- [ ] Step 4: Update backend/main.py to expose cost + notes in API
- [ ] Step 5: Update frontend types.ts to include cost + notes
- [ ] Step 6: Update frontend PriceListView.tsx to show cost + notes columns
- [ ] Step 7: Start local dev servers for verification

## Notes
- cost (עלות) is col G - can be string (formulas) or float
- notes (הערות) is col I - plain text
- Category headers: row has seq number, no supplier, no price → current_category updates
- Last rows (286-290) are workflow instructions, not price data → skip
- import_pricelist.py will clear and re-import → safe to run
