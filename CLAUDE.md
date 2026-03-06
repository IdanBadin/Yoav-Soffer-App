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
**Company:** י. סופר מערכות חשמל
**Status:** Built & working (2026-03-05)

## To run the app:
```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer/project"
streamlit run app.py
```
App available at: http://localhost:8501

## Architecture
- `project/app.py` — Streamlit UI (RTL Hebrew, Heebo font, navy/blue design)
- `project/utils/pdf_parser.py` — pdfplumber + Claude claude-sonnet-4-5 BOM extraction
- `project/utils/sheets_client.py` — Google Sheets price lookup (3-tier: exact/mfg+catalog/fuzzy)
- `project/utils/excel_generator.py` — openpyxl generates 2 Excel files as BytesIO
- `project/.env` — ANTHROPIC_API_KEY + GOOGLE_SHEET_ID (never commit)
- `project/config/google_credentials.json` — Google service account

## Two Excel outputs
1. **הצעת מחיר** — 5 cols: סעיף|הערה|כמות|מחיר|סה"כ (Calibri Light, blue header)
2. **כתב חלקים** — 8 cols: מס'|תיאור|מק"ט|יצרן|כמות|יחידה|מחיר יחידה|סה"כ

## Google Sheets schema
catalog_number | item_name | unit_price | unit | manufacturer
Tab should be named: מחירון

## Known next steps
- Fill Google Sheet with actual prices
- Consider adding manual price-edit step in UI before Excel generation
- sample_files/ contains reference PDFs and Excel templates
