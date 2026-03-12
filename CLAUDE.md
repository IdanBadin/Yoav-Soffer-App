# CLAUDE.md

## 🚀 Session Start (MANDATORY — Do This Before Anything Else)

Run the following shell commands immediately when a session begins:

```bash
mkdir -p tasks
touch tasks/todo.md tasks/lessons.md
```

Then confirm to the user:
> "✅ Session initialized. `tasks/todo.md` and `tasks/lessons.md` are ready."

Also read `tasks/lessons.md` now and internalize any existing lessons before proceeding.

**Do not respond to any user request until these steps are complete.**

---

## 📋 Task Management

Every non-trivial task follows this exact sequence — no exceptions:

### Step 1 — Write the Plan
Write a detailed plan to `tasks/todo.md` using this template:

```markdown
# Task: [Short task name]
Date: [today's date]

## Goal
[One sentence describing what success looks like]

## Plan
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
...

## Notes
[Any assumptions, risks, or open questions]

## Review
[Filled in after completion — what worked, what didn't]
```

### Step 2 — Check In Before Building
After writing the plan, stop and say:
> "Here's my plan. Should I proceed?"

Wait for confirmation before writing any code.

### Step 3 — Track Progress
Check off each item in `tasks/todo.md` as you complete it. Never skip ahead.

### Step 4 — Explain Changes
After each meaningful step, give a brief high-level summary of what changed and why.

### Step 5 — Verify Before Marking Done
Never mark a task complete without proving it works. Run tests, check logs, or demonstrate correctness.
Ask yourself: *"Would a staff engineer approve this?"*

### Step 6 — Capture Lessons
After any correction from the user, immediately update `tasks/lessons.md`:

```markdown
## Lesson — [date]
**Mistake:** [What went wrong]
**Fix:** [What the correct approach is]
**Rule:** [One-line rule to prevent this in future]
```

---

## 🧠 Workflow Principles

### Plan Mode
- Enter plan mode for ANY task with 3+ steps or architectural decisions.
- If something goes sideways mid-task: **STOP. Re-plan. Don't keep pushing.**
- Use plan mode for verification steps too, not just building.

### Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- One focused task per subagent — never mix concerns.
- For complex problems, spawn more subagents rather than cramming into one context.

### Self-Improvement Loop
- Read `tasks/lessons.md` at the start of every session.
- After ANY user correction: update lessons immediately, don't wait until the end.
- Write rules for yourself that prevent the same mistake from recurring.
- If the same mistake happens twice, escalate the rule (make it more prominent in lessons).

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding.
- Use logs, errors, and failing tests as your guide.
- Zero context-switching required from the user.
- Fix failing CI tests without being explicitly told how.

### Demand Elegance (Balanced)
- For non-trivial changes: pause and ask *"Is there a more elegant way?"*
- If a fix feels hacky: *"Knowing everything I know now, implement the elegant solution."*
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.

---

## ⚙️ Core Coding Standards

- **Simplicity First** — Make every change as simple as possible. Minimal footprint.
- **No Laziness** — Find root causes. No temporary patches. Senior developer standards.
- **Minimal Impact** — Only touch what's necessary. Avoid introducing side effects.
- **No Guessing** — If something is unclear, ask before implementing. Wrong assumptions waste both our time.
- **Prove It Works** — Never say "this should work." Show that it does.

---

## ❌ Never Do These

- Never start implementation without a written plan for non-trivial tasks.
- Never mark a task complete without verification.
- Never make the same mistake twice without updating `tasks/lessons.md`.
- Never keep pushing when stuck — stop and re-plan.
- Never touch code outside the scope of the current task.

---
---

# ─────────────────────────────────────────────────────────────
# PROJECT-SPECIFIC CONTEXT
# ─────────────────────────────────────────────────────────────

## Project: Electrical Panel Quote Automation System
**Company:** י. סופר מערכות חשמל בע"מ
**Status:** Production web app — live, UI fully redesigned + semantic matching added (2026-03-09)

## Live URLs
- Frontend: https://yoavsofferapp.netlify.app (Netlify)
- Backend: https://yoav-soffer-app-production.up.railway.app (Railway)
- GitHub: https://github.com/IdanBadin/Yoav-Soffer-App

## Stack
- Frontend: React 19 + Vite 7 + TypeScript + Tailwind CSS v3
- Backend: FastAPI Python (Railway, Root Dir: /backend)
- Icons: Material Symbols Outlined (Google Fonts variable font)
- Fonts: Heebo (UI/Hebrew) + IBM Plex Mono (numbers) — `.mono-font` class

## Architecture
```
frontend/  — React + Vite + TypeScript → Netlify
  src/components/
    Header.tsx         — Company PNG logo + name + nav tabs
    UploadZone.tsx     — Drag-drop upload + "how it works"
    ProjectForm.tsx    — Project metadata form
    ProcessingView.tsx — Animated steps + terminal log
    ResultsView.tsx    — Stats, table, downloads
    PriceListView.tsx  — Full CRUD for Google Sheets prices (with category grouping)
  public/
    logo.png           — Company logo (white bg, dark navy)
    favicon.svg        — Lightning bolt in circle, electric blue
  tailwind.config.js   — primary:#3b82f6, background-dark:#0f172a
  vite.config.ts       — /api proxy → Railway (local dev only)
backend/   — FastAPI Python (NEVER touch utils/)
  main.py              — ALL custom logic lives here (lifespan, CRUD, /process, semantic matching)
  utils/   — pdf_parser.py, sheets_client.py, excel_generator.py (NEVER TOUCH)
  scripts/ — import_pricelist.py (one-time Excel import utility)
```

## Price Matching Pipeline (4 steps, in order)
The `/process` endpoint matches PDF components to prices in 4 steps:
1. **Exact catalog match** — catalog_number exact string match
2. **Normalized catalog match** — stripped/lowercased catalog match
3. **Fuzzy description match** — difflib, cutoff=0.7 (fails cross-language)
4. **Semantic match (NEW)** — Claude API batch call for unmatched components
   - Function: `_semantic_match_unmatched()` in `backend/main.py`
   - One API call per PDF, only when step 1-3 leaves unmatched items
   - Model: `claude-sonnet-4-5`, returns `match_type: "semantic"`
   - Graceful fallback: any exception → `{}`, main flow never breaks
   - Globals: `_price_records_raw` (raw list) + `_price_index` (built index)

## Google Sheets Price List
- 253 rows (as of 2026-03-09), schema: catalog_number | item_name | unit_price | unit | manufacturer | category
- Sheet ID: 1EckbrWL5jpqLf4Nczq7_b_Euvmq7bExNNQwut5BtXYA
- **category field added** — 35 categories imported from Excel מחירון לוחות י.סופר 10.2025.xlsx
- Import script: `scripts/import_pricelist.py` (one-time use, do not re-run without backing up sheet)

## Design System (Tailwind)
- Primary: #3b82f6 (Electric Blue)
- Background: #0f172a (Deep Slate) | Surface: #1e293b
- Success: #22c55e | Warning: #f59e0b | Error: #ef4444
- Spacing: 8px grid — use gap-2/4/6/8 (never gap-1/3/5)
- RTL: `<html lang="he" dir="rtl" class="dark">`
- Mobile breakpoints: sm=640px, md=768px, lg=1024px
- `.table-hide-mobile` — hides columns on <640px

## Responsive Rules
- ResultsView table: hides מק"ט, יצרן, יחידה on mobile (header + cells)
- PriceListView table: hides יצרן, יחידה on mobile (header + cells + edit row)
- Header: logo always visible; company name text `hidden sm:flex`
- Stats cards: icon must have `flex-shrink-0` + `gap-3` to prevent crowding

## LOGIC IMMUTABILITY RULE
Only JSX/CSS may be changed in frontend. Never touch:
- fetch calls, state declarations, useEffect hooks
- handleSubmit, handleFile, handleReset, handleEditSave, handleDelete, handleAddSave
- parseError function, b64ToBytes, downloadExcel

## Local Dev
```bash
# Kill stale backend if port busy:
lsof -ti :8000 | xargs kill -9

# Backend (needed for semantic matching + price CRUD):
cd backend && uvicorn main:app --port 8000 --reload

# Frontend:
cd frontend && npm run dev   # → usually http://localhost:5175 (5173/5174 often in use)
# frontend/.env.local already set to VITE_API_URL=http://localhost:8000
```

## Backend API
- POST /process — PDF → JSON + base64 Excel files (4-step price matching)
- GET/POST/PUT/DELETE /prices — Google Sheets CRUD
- POST /refresh-prices — reload price index (also refreshes _price_records_raw)

## Railway env vars required
ANTHROPIC_API_KEY, GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_CREDENTIALS_B64, ALLOWED_ORIGINS

## Critical deployment notes
- Railway Root Directory MUST be `/backend` in service Settings → Source
- VITE_API_URL must be set in Netlify env vars BEFORE building (baked into bundle)
- After any Railway env var change → redeploy triggers automatically
- Footer year is dynamic: `{new Date().getFullYear()}` — never hardcode

## Price Matching Pipeline — FULL (as of 2026-03-12)
The `/process` endpoint now has TWO flows:

### Flow 1 — PDF (AutoCAD drawings)
Replaces old pdfplumber with **Claude Vision API** (`_process_pdf_vision` in main.py):
1. `pdf2image` converts each page to PNG (150 DPI, resize to max 7500px)
2. All pages processed **in parallel** via `asyncio.gather` + `asyncio.to_thread`
3. Claude Vision (`claude-sonnet-4-5`) extracts purchasable components from each page
4. Deduplication by description (sum qty for duplicates)
5. 4-step price matching: exact → normalized → fuzzy → semantic (batched, 80/batch)
- Result: 17-page real panel drawing → 49% match, ~37s Vision + ~90s semantic = ~2min total

### Flow 2 — Excel BoQ (כתב כמויות)
`_process_boq_flow` in main.py:
1. Auto-detect header row + column positions (keyword scan + positional fallback)
2. Extract priceable rows (skip notes/headers/zero-qty)
3. 4-step price matching same as PDF flow
4. Fill prices in-place + yellow highlight for unmatched
5. Returns `boq_mode: True` → frontend shows BoQ-specific UI

### Semantic Matching Details
- Function: `_semantic_match_unmatched()` — `max_tokens=4096`, batches of 80
- Uses `json.JSONDecoder.raw_decode()` to handle markdown fences + extra text
- Graceful fallback per batch: exception → skip batch, continue
- BoQ + Vision both use same semantic function

## Google Sheets Price List
- 238 rows (updated 2026-03-11), schema: catalog_number | item_name | unit_price | unit | manufacturer | category | cost | notes
- Sheet ID: 1EckbrWL5jpqLf4Nczq7_b_Euvmq7bExNNQwut5BtXYA
- 33 categories, cost (עלות קנייה) + notes (הערות) added
- Import script: `scripts/import_pricelist.py` (one-time use, do not re-run without backing up)

## Railway Deployment (as of 2026-03-12)
- `backend/railway.toml`: `aptPkgs = ["poppler-utils"]` — DO NOT change to nixPkgs (breaks Python)
- `backend/requirements.txt` includes `pdf2image>=1.17.0`
- Last successful deploy: commit a070851 is deploying now (poppler fix)
- Previous deploys 65645ad + f75384a failed with "python: command not found" due to nixPkgs override

## Frontend Changes (2026-03-12)
- `UploadZone.tsx` — accepts .xlsx in addition to PDF
- `ResultsView.tsx` — boq_mode aware (labels, stat cards, downloads)
- `PriceListView.tsx` — cost/notes columns with full CRUD
- `types.ts` — PriceRow has cost/notes; ProcessResult has boq_mode
- `App.tsx` — request timeout 3min → **10min** (for multi-page PDFs)

## Sample Files
```
sample_files/
  שרטוט לדוגמא AutoCAD (2-5).pdf  — real panel drawings (77-86% match)
  דוגמא לכתב כמויות.xlsx           — BoQ format A (84% match)
  דוגמא לכתב כמויות (2-3).xlsx     — BoQ formats B+C
  דוגמא לפורמט ריק של הצעת מחיר.xlsx — blank quote template
```
Real test file: `/Users/idanbadin/Downloads/תיקיה לעידן בדין.../לוח מבנה 118.pdf` (17 pages, 49% match)

## Known Issues / Next Steps
- [ ] Railway production test: verify poppler installs with aptPkgs (commit 9d5a411 / a070851)
- [ ] לוח מבנה 118.pdf on production: expect ~2 min processing, 49%+ match
- [ ] Improve Vision extraction for very dense/complex multi-page drawings
- [ ] CORS still defaults to "*" in main.py — medium security risk (not urgent)
