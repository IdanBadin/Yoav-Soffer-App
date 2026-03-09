# Task: Claude Semantic Price Matching — Testing & Deploy
Date: 2026-03-09

## Goal
Verify that the new semantic matching step dramatically improves component match rate, then deploy to production.

## Plan
- [ ] Upload problem PDF (the one with ~27 unmatched) at http://localhost:5175
- [ ] Check backend logs for: "Semantic matching resolved X of Y unmatched components"
- [ ] Verify `match_type: "semantic"` appears in the results table UI
- [ ] Spot-check 3 matched items — right product + right price?
- [ ] Upload a PDF with 0 unmatched → confirm no extra API call (no semantic log line)
- [ ] `git push` → Railway auto-deploys → test on production URL

## Notes
- Backend already running: http://localhost:8000 (253 records loaded)
- Frontend already running: http://localhost:5175
- All code changes are in `backend/main.py` only (utils/ untouched)
- Semantic matching is gracefully degrading — any failure returns {} and main flow continues
- Plan file: `/Users/idanbadin/.claude/plans/curried-fluttering-cook.md`

## Previous Task (completed)
- [x] Import 254 items from Excel into Google Sheets with category support
- [x] Backend: `category` field in PriceRecord + all CRUD endpoints
- [x] Frontend: category grouping/display/add/edit in PriceListView
- [x] TypeScript build passes
- [ ] Push to GitHub ← still pending!
