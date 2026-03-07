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
**Status:** Production web app — live, UI fully redesigned (2026-03-07)

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
    PriceListView.tsx  — Full CRUD for Google Sheets prices
  public/
    logo.png           — Company logo (white bg, dark navy)
    favicon.svg        — Lightning bolt in circle, electric blue
  tailwind.config.js   — primary:#3b82f6, background-dark:#0f172a
  vite.config.ts       — /api proxy → Railway (local dev only)
backend/   — FastAPI Python (NEVER touch utils/)
  utils/   — pdf_parser.py, sheets_client.py, excel_generator.py
```

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
Only JSX/CSS may be changed. Never touch:
- fetch calls, state declarations, useEffect hooks
- handleSubmit, handleFile, handleReset, handleEditSave, handleDelete, handleAddSave
- parseError function, b64ToBytes, downloadExcel

## Local Dev
```bash
cd frontend && npm run dev   # → http://localhost:5173
# proxies /api → Railway backend automatically
```

## Backend API
- POST /process — PDF → JSON + base64 Excel files
- GET/POST/PUT/DELETE /prices — Google Sheets CRUD
- POST /refresh-prices — reload price index

## Railway env vars required
ANTHROPIC_API_KEY, GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_CREDENTIALS_B64, ALLOWED_ORIGINS

## Google Sheets Price List
- 258 rows, schema: catalog_number | item_name | unit_price | unit | manufacturer
- Sheet ID: 1EckbrWL5jpqLf4Nczq7_b_Euvmq7bExNNQwut5BtXYA

## Critical deployment notes
- Railway Root Directory MUST be `/backend` in service Settings → Source
- VITE_API_URL must be set in Netlify env vars BEFORE building (baked into bundle)
- After any Railway env var change → redeploy triggers automatically
- Footer year is dynamic: `{new Date().getFullYear()}` — never hardcode
