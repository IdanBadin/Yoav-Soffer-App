# Design: Migration from Streamlit to React + FastAPI Web App

Date: 2026-03-06

## Goal
Convert the Streamlit app to a production-grade web application — React + Vite frontend on Netlify, FastAPI Python backend on Railway — while keeping all backend logic (PDF parsing, Google Sheets, Excel generation) completely unchanged.

---

## Architecture

```
User → https://your-app.netlify.app (Netlify)
              ↓
        React + Vite (SPA)
              ↓ POST /process (multipart/form-data)
        FastAPI Python (Railway)
              ↓
        utils/ — UNCHANGED
        ├── pdf_parser.py
        ├── sheets_client.py
        └── excel_generator.py
```

### Frontend (Netlify)
- React + Vite + TypeScript
- No router needed (single page, 4 states)
- Fetch API for backend calls
- No external state management library

### Backend (Railway)
- FastAPI with one endpoint: `POST /process`
- Accepts: multipart/form-data (PDF file + project_name + manager_name + date)
- Returns: JSON with base64-encoded Excel files + component data
- CORS configured to allow Netlify domain
- All `utils/` files copied as-is, zero changes

---

## Design System

### Colors (CSS Variables)
```css
--bg:         #0D0F12   /* page background */
--surface:    #141720   /* cards */
--border:     #1E2330   /* borders */
--accent:     #F6C90E   /* yellow — brand */
--text:       #F0F2F5   /* primary text */
--text-muted: #6B7A99   /* secondary text */
--success:    #22C55E
--error:      #EF4444
```

### Typography
- Heebo (400/500/700/800) — Hebrew + UI text
- IBM Plex Mono (400/500) — catalog numbers, prices, technical data

### Spacing (8px grid)
- xs: 8px | sm: 16px | md: 24px | lg: 32px | xl: 48px | 2xl: 64px

### Border Radius
- sharp: 4px | default: 8px | card: 12px | large: 16px

### RTL
- `<html dir="rtl">` globally
- All layouts right-to-left

---

## App States & UI

### State 1: Idle (upload)
- Full-width upload card with dashed border
- Drag & drop + click to browse
- Lightning bolt icon (brand)
- Hebrew instructions

### State 2: Form (after file selected)
- File pill showing filename
- 3 inputs: שם פרויקט / שם מנהל / תאריך
- "עבד שרטוט" submit button
- Smooth slide-in animation

### State 3: Processing
- 3 progress steps with icons:
  1. קורא קובץ PDF
  2. מחלץ רכיבים באמצעות AI
  3. מתאים מחירים ומייצר Excel
- Simple progress bar
- Current step highlighted in yellow

### State 4: Results
- 4 stat cards: עמודי PDF / רכיבים / תואמו / ללא מחיר
- Data table (dark, IBM Plex Mono for numbers)
- Warning banner if unmatched prices > 0
- Grand total bar
- 2 download cards side by side
- "עבד שרטוט נוסף" button to reset

---

## File Structure

```
project/
├── frontend/
│   ├── src/
│   │   ├── App.tsx          — main app + state machine
│   │   ├── components/
│   │   │   ├── UploadZone.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   ├── ProcessingView.tsx
│   │   │   └── ResultsView.tsx
│   │   ├── styles/
│   │   │   └── globals.css  — design system variables + base
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── netlify.toml
└── backend/
    ├── main.py              — FastAPI app (NEW)
    ├── utils/               — COPIED AS-IS, ZERO CHANGES
    │   ├── __init__.py
    │   ├── pdf_parser.py
    │   ├── sheets_client.py
    │   └── excel_generator.py
    ├── config/
    │   └── google_credentials.json
    ├── requirements.txt     — adds fastapi, uvicorn, python-multipart
    ├── .env                 — ANTHROPIC_API_KEY, GOOGLE_SHEET_ID
    └── Procfile             — for Railway: web: uvicorn main:app
```

---

## API Contract

### POST /process
Request: `multipart/form-data`
- `file`: PDF binary
- `project_name`: string
- `manager_name`: string
- `date`: string (DD/MM/YYYY)

Response: `application/json`
```json
{
  "components": [...],
  "page_count": 3,
  "excel_quote": "<base64>",
  "excel_parts": "<base64>"
}
```

Error responses: 422 (validation), 500 (processing error) — Hebrew error messages

---

## Deployment

### Backend (Railway)
1. Push `backend/` to GitHub repo
2. Connect Railway to repo
3. Set env vars: ANTHROPIC_API_KEY, GOOGLE_SHEET_ID, GOOGLE_SHEET_NAME
4. Upload google_credentials.json as file or env var (base64)
5. Railway auto-deploys → gets URL like `https://xxx.railway.app`

### Frontend (Netlify)
1. Push `frontend/` to GitHub repo
2. Connect Netlify to repo, set build: `npm run build`, publish: `dist`
3. Set env var: `VITE_API_URL=https://xxx.railway.app`
4. Netlify deploys → public URL

---

## Non-Goals
- No database
- No user authentication
- No file storage (everything in-memory)
- No changes to pdf_parser.py, sheets_client.py, excel_generator.py
