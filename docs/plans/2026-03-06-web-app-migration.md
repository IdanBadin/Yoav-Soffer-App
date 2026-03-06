# Web App Migration — Streamlit → React + FastAPI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Streamlit app with a React + Vite frontend (Netlify) and FastAPI backend (Railway), keeping all Python utils completely unchanged.

**Architecture:** Static React SPA on Netlify calls a single `POST /process` endpoint on FastAPI (Railway). Backend copies all existing `utils/` as-is and wraps them in a thin FastAPI layer. Google Credentials are loaded from env var (base64) on Railway.

**Tech Stack:** React 18 + Vite + TypeScript, FastAPI + Uvicorn, existing Python utils (pdfplumber, anthropic, gspread, openpyxl), IBM Plex Mono + Heebo fonts.

---

## Project Structure (final state)

```
Yoav Sofer/
├── backend/
│   ├── main.py
│   ├── utils/              ← COPIED from project/utils/, zero edits
│   │   ├── __init__.py
│   │   ├── pdf_parser.py
│   │   ├── sheets_client.py
│   │   └── excel_generator.py
│   ├── config/             ← gitignored
│   │   └── google_credentials.json
│   ├── requirements.txt
│   ├── Procfile
│   └── .env
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── netlify.toml
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types.ts
        ├── globals.css
        └── components/
            ├── Header.tsx
            ├── UploadZone.tsx
            ├── ProjectForm.tsx
            ├── ProcessingView.tsx
            └── ResultsView.tsx
```

---

## Task 1: Create backend scaffold and copy utils

**Files:**
- Create: `backend/` directory with utils copied from `project/utils/`

**Step 1: Create backend directory and copy utils**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
mkdir -p backend/utils backend/config
cp project/utils/__init__.py backend/utils/
cp project/utils/pdf_parser.py backend/utils/
cp project/utils/sheets_client.py backend/utils/
cp project/utils/excel_generator.py backend/utils/
cp project/config/google_credentials.json backend/config/ 2>/dev/null || true
cp project/.env backend/.env 2>/dev/null || true
```

**Step 2: Verify copy**

```bash
ls backend/utils/
# Expected: __init__.py  excel_generator.py  pdf_parser.py  sheets_client.py
```

**Step 3: Create `backend/requirements.txt`**

```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
python-multipart>=0.0.9
pdfplumber>=0.11.0
anthropic>=0.25.0
gspread>=6.0.0
google-auth>=2.29.0
openpyxl>=3.1.2
python-dotenv>=1.0.0
pandas>=2.2.0
```

**Step 4: Create `backend/Procfile`**

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Step 5: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git init || true
git add backend/utils/ backend/requirements.txt backend/Procfile
git commit -m "feat: add backend scaffold with copied utils"
```

---

## Task 2: Write FastAPI main.py

**Files:**
- Create: `backend/main.py`

**Step 1: Write `backend/main.py`**

```python
"""
FastAPI backend — thin wrapper around existing utils.
Single endpoint: POST /process
"""

import base64
import json
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from utils.pdf_parser import parse_pdf
from utils.sheets_client import build_price_index, load_price_sheet, match_prices
from utils.excel_generator import generate_quote, generate_parts_list

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Price index cache (module-level, loaded once at startup) ─────────────────
_price_index: Optional[dict] = None


def _get_credentials_path() -> Optional[str]:
    """
    Returns path to google_credentials.json.
    On Railway: writes it from GOOGLE_CREDENTIALS_B64 env var to a temp file.
    Locally: uses config/google_credentials.json.
    """
    b64 = os.getenv("GOOGLE_CREDENTIALS_B64", "")
    if b64:
        tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w")
        tmp.write(base64.b64decode(b64).decode("utf-8"))
        tmp.close()
        return tmp.name

    local_path = "config/google_credentials.json"
    if os.path.exists(local_path):
        return local_path

    return None


def _load_price_index() -> Optional[dict]:
    """Load price index from Google Sheets. Returns None if not configured."""
    creds_path = _get_credentials_path()
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "מחירון")

    if not creds_path or not sheet_id:
        logger.warning("Google Sheets not configured — prices will be 0")
        return None

    try:
        records = load_price_sheet(creds_path, sheet_id, sheet_name)
        index = build_price_index(records)
        logger.info(f"Price index loaded: {len(records)} records")
        return index
    except Exception as e:
        logger.error(f"Failed to load price sheet: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _price_index
    _price_index = _load_price_index()
    yield


app = FastAPI(title="י. סופר — Quote Automation API", lifespan=lifespan)

# ── CORS — allow Netlify domain ───────────────────────────────────────────────
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "prices_loaded": _price_index is not None,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/refresh-prices")
async def refresh_prices():
    """Reload price index from Google Sheets."""
    global _price_index
    _price_index = _load_price_index()
    return {"status": "ok", "prices_loaded": _price_index is not None}


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    manager_name: str = Form(""),
    date: str = Form(...),
):
    """
    Main endpoint.
    Accepts: PDF file + project metadata
    Returns: JSON with component list + base64 Excel files
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="יש להעלות קובץ PDF בלבד")

    # Save uploaded PDF to temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Step 1: Parse PDF
        logger.info(f"Processing PDF: {file.filename}")
        result = parse_pdf(tmp_path, api_key)
        os.unlink(tmp_path)

        all_components = result["components"] + result["flagged"]

        if not all_components:
            raise HTTPException(
                status_code=422,
                detail="לא זוהו רכיבים בשרטוט. ודא שהקובץ הנכון הועלה."
            )

        # Step 2: Match prices
        if _price_index:
            priced = match_prices(all_components, _price_index)
        else:
            priced = [
                {**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
                for c in all_components
            ]

        # Step 3: Generate Excel files
        excel_quote_bytes = generate_quote(priced, project_name, manager_name, date)
        excel_parts_bytes = generate_parts_list(priced, project_name, manager_name, date)

        return {
            "components": priced,
            "page_count": result["page_count"],
            "excel_quote": base64.b64encode(excel_quote_bytes).decode("utf-8"),
            "excel_parts": base64.b64encode(excel_parts_bytes).decode("utf-8"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        err = str(e)
        if "credit balance" in err.lower() or "too low" in err.lower():
            raise HTTPException(
                status_code=500,
                detail="יתרת הקרדיטים ב-Anthropic נמוכה מדי. יש להוסיף קרדיטים ב-console.anthropic.com"
            )
        raise HTTPException(status_code=500, detail="שגיאה בעיבוד השרטוט. נסה שנית.")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
```

**Step 2: Test backend locally**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer/backend"
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Expected: INFO: Application startup complete.
# Visit: http://localhost:8000/health
# Expected JSON: {"status":"ok","prices_loaded":true/false,...}
```

**Step 3: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add backend/main.py
git commit -m "feat: add FastAPI main.py with /process endpoint"
```

---

## Task 3: Scaffold React + Vite frontend

**Files:**
- Create: `frontend/` directory with Vite + React + TypeScript

**Step 1: Create Vite project**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Install no extra dependencies** (only built-in Vite + React — no UI libraries, no state management)

```bash
# No extra packages needed — design system is pure CSS
```

**Step 3: Create `frontend/netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Step 4: Update `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

**Step 5: Update `frontend/index.html`** — add RTL, fonts, title

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>י. סופר — מערכת הצעות מחיר</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create `frontend/src/types.ts`**

```typescript
export interface Component {
  qty: number
  catalog: string
  user1: string
  manufacturer: string
  description: string
  price: number
  unit: string
  match_type: string
  price_found: boolean
  _issues?: string[]
}

export interface ProcessResult {
  components: Component[]
  page_count: number
  excel_quote: string  // base64
  excel_parts: string  // base64
}

export type AppState = 'idle' | 'ready' | 'processing' | 'results'

export interface ProjectMeta {
  projectName: string
  managerName: string
  date: string
}
```

**Step 7: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add frontend/
git commit -m "feat: scaffold React + Vite frontend"
```

---

## Task 4: Design system (globals.css)

**Files:**
- Replace: `frontend/src/globals.css` (delete default Vite CSS)
- Delete: `frontend/src/App.css`, `frontend/src/index.css`

**Step 1: Delete default CSS files**

```bash
rm -f frontend/src/App.css frontend/src/index.css
```

**Step 2: Create `frontend/src/globals.css`**

```css
/* ── Design Tokens ─────────────────────────────────────────────────────── */
:root {
  /* Colors */
  --bg:           #0D0F12;
  --surface:      #141720;
  --surface-2:    #1A1F2E;
  --border:       #1E2330;
  --border-med:   #2A3045;
  --accent:       #F6C90E;
  --accent-dim:   rgba(246, 201, 14, 0.12);
  --accent-glow:  rgba(246, 201, 14, 0.20);
  --text:         #F0F2F5;
  --text-mid:     #A8B3CC;
  --text-muted:   #6B7A99;
  --success:      #22C55E;
  --success-dim:  rgba(34, 197, 94, 0.12);
  --warning:      #F59E0B;
  --warning-dim:  rgba(245, 158, 11, 0.12);
  --error:        #EF4444;
  --error-dim:    rgba(239, 68, 68, 0.12);

  /* Spacing (8px grid) */
  --sp-1: 8px;
  --sp-2: 16px;
  --sp-3: 24px;
  --sp-4: 32px;
  --sp-5: 40px;
  --sp-6: 48px;
  --sp-8: 64px;

  /* Border radius */
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);

  /* Typography */
  --font-ui: 'Heebo', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

/* ── Reset ──────────────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  direction: rtl;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: var(--font-ui);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.5;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Typography ─────────────────────────────────────────────────────────── */
h1, h2, h3, h4 {
  font-family: var(--font-ui);
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
}

/* ── Utilities ──────────────────────────────────────────────────────────── */
.mono { font-family: var(--font-mono); }
.text-muted { color: var(--text-muted); }
.text-mid { color: var(--text-mid); }
.text-accent { color: var(--accent); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-error { color: var(--error); }

/* ── Card ───────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: var(--sp-4);
}

/* ── Button ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  padding: 10px 20px;
  min-height: 40px;
}

.btn-primary {
  background: var(--accent);
  color: #0D0F12;
}
.btn-primary:hover {
  background: #fdd733;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--accent-glow);
}
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  background: transparent;
  color: var(--text-mid);
  border: 1px solid var(--border-med);
}
.btn-ghost:hover {
  background: var(--surface-2);
  color: var(--text);
  border-color: var(--border-med);
}

.btn-download {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border-med);
  width: 100%;
  padding: 12px 20px;
}
.btn-download:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

/* ── Input ──────────────────────────────────────────────────────────────── */
.input {
  width: 100%;
  font-family: var(--font-ui);
  font-size: 0.9rem;
  color: var(--text);
  background: var(--bg);
  border: 1.5px solid var(--border-med);
  border-radius: var(--r-md);
  padding: 10px 14px;
  min-height: 40px;
  text-align: right;
  direction: rtl;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.input::placeholder { color: var(--text-muted); }
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

label.field-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* ── Section heading ────────────────────────────────────────────────────── */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: var(--sp-2);
}
.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* ── Divider ────────────────────────────────────────────────────────────── */
.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: var(--sp-4) 0;
}

/* ── Responsive layout ──────────────────────────────────────────────────── */
.page-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--sp-4) var(--sp-3);
  flex: 1;
}

@media (max-width: 640px) {
  .page-wrap {
    padding: var(--sp-3) var(--sp-2);
  }
  .card {
    padding: var(--sp-3);
  }
}
```

**Step 3: Update `frontend/src/main.tsx`** — import globals.css

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Step 4: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add frontend/src/globals.css frontend/src/main.tsx frontend/index.html
git commit -m "feat: add design system tokens and globals.css"
```

---

## Task 5: Header component

**Files:**
- Create: `frontend/src/components/Header.tsx`

**Step 1: Create `frontend/src/components/Header.tsx`**

```tsx
export function Header() {
  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--sp-3)',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(246,201,14,0.25)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
                    fill="#F6C90E" stroke="#E5B800" strokeWidth="0.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
              י. סופר מערכות חשמל
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1 }}>
              מערכת הצעות מחיר
            </div>
          </div>
        </div>

        {/* Version badge */}
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '3px 8px',
        }}>
          v2.0
        </div>
      </div>
    </header>
  )
}
```

---

## Task 6: UploadZone component

**Files:**
- Create: `frontend/src/components/UploadZone.tsx`

**Step 1: Create `frontend/src/components/UploadZone.tsx`**

```tsx
import { useRef, useState, DragEvent, ChangeEvent } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.toLowerCase().endsWith('.pdf')) onFile(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className="card"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        textAlign: 'center',
        cursor: 'pointer',
        padding: 'var(--sp-8) var(--sp-4)',
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-med)'}`,
        background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '48px', height: '48px',
        background: 'var(--accent-dim)',
        border: '1px solid rgba(246,201,14,0.2)',
        borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto var(--sp-3)',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9,15 12,12 15,15"/>
        </svg>
      </div>

      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
        גרור קובץ PDF לכאן
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--sp-3)' }}>
        או לחץ לבחירת קובץ
      </div>
      <div style={{
        display: 'inline-block',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '3px 10px',
        fontFamily: 'var(--font-mono)',
      }}>
        PDF בלבד · שרטוטי AutoCAD
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
```

---

## Task 7: ProjectForm component

**Files:**
- Create: `frontend/src/components/ProjectForm.tsx`

**Step 1: Create `frontend/src/components/ProjectForm.tsx`**

```tsx
import { useState, FormEvent } from 'react'
import type { ProjectMeta } from '../types'

interface Props {
  fileName: string
  onSubmit: (meta: ProjectMeta) => void
  loading: boolean
}

export function ProjectForm({ fileName, onSubmit, loading }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [projectName, setProjectName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [date, setDate] = useState(today)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    // Convert YYYY-MM-DD to DD/MM/YYYY for Excel
    const [y, m, d] = date.split('-')
    onSubmit({ projectName: projectName.trim(), managerName: managerName.trim(), date: `${d}/${m}/${y}` })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* File pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: 'var(--accent-dim)',
        border: '1px solid rgba(246,201,14,0.25)',
        borderRadius: '20px',
        padding: '5px 14px',
        width: 'fit-content',
        fontSize: '0.82rem',
        fontWeight: 600,
        color: 'var(--accent)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        {fileName}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--sp-2)', alignItems: 'end' }}>
          {/* Project name */}
          <div>
            <label className="field-label">שם הפרויקט *</label>
            <input
              className="input"
              type="text"
              placeholder="לדוגמה: תעשייה אווירית מבנה 118"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              required
            />
          </div>

          {/* Manager name */}
          <div>
            <label className="field-label">מנהל הפרויקט</label>
            <input
              className="input"
              type="text"
              placeholder="לדוגמה: סתיו כהן"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <label className="field-label">תאריך</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ direction: 'ltr', textAlign: 'center', minWidth: '140px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !projectName.trim()}
          >
            {loading ? (
              <>
                <SpinnerIcon />
                מעבד...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/>
                </svg>
                עבד שרטוט
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
```

**Step 2: Responsive fix for mobile grid** — add to `globals.css`

Append to `frontend/src/globals.css`:

```css
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr !important;
  }
}
```

And update the grid div in ProjectForm to have `className="form-grid"` in addition to the inline style.

---

## Task 8: ProcessingView component

**Files:**
- Create: `frontend/src/components/ProcessingView.tsx`

**Step 1: Create `frontend/src/components/ProcessingView.tsx`**

```tsx
interface Props {
  step: number  // 0=reading, 1=extracting, 2=generating
}

const STEPS = [
  { label: 'קורא קובץ PDF', sub: 'מחלץ טקסט וטבלאות' },
  { label: 'מחלץ רכיבים', sub: 'Claude AI מנתח את השרטוט' },
  { label: 'מייצר קבצים', sub: 'מתאים מחירים ובונה Excel' },
]

export function ProcessingView({ step }: Props) {
  return (
    <div className="card" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
        מעבד את השרטוט...
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        background: 'var(--border)',
        borderRadius: '2px',
        marginBottom: 'var(--sp-4)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.round(((step + 1) / STEPS.length) * 100)}%`,
          background: 'var(--accent)',
          borderRadius: '2px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              background: active ? 'var(--accent-dim)' : done ? 'var(--success-dim)' : 'transparent',
              border: `1px solid ${active ? 'rgba(246,201,14,0.2)' : done ? 'rgba(34,197,94,0.15)' : 'transparent'}`,
              transition: 'all 0.3s ease',
            }}>
              {/* Step indicator */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
                background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)',
                color: done || active ? '#0D0F12' : 'var(--text-muted)',
                fontWeight: 700,
              }}>
                {done ? '✓' : i + 1}
              </div>

              <div>
                <div style={{
                  fontSize: '0.875rem', fontWeight: 600,
                  color: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {s.label}
                  {active && <span style={{ marginRight: '6px', animation: 'pulse 1.2s ease-in-out infinite' }}>●</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {s.sub}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}
```

---

## Task 9: ResultsView component

**Files:**
- Create: `frontend/src/components/ResultsView.tsx`

**Step 1: Create `frontend/src/components/ResultsView.tsx`**

```tsx
import type { ProcessResult } from '../types'

interface Props {
  result: ProcessResult
  projectName: string
  dateStr: string
  onReset: () => void
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function downloadExcel(b64: string, filename: string) {
  const bytes = b64ToBytes(b64)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsView({ result, projectName, dateStr, onReset }: Props) {
  const { components, page_count, excel_quote, excel_parts } = result
  const total = components.length
  const matched = components.filter(c => c.price_found).length
  const unmatched = total - matched
  const grandTotal = components.reduce((sum, c) => sum + c.qty * c.price, 0)
  const projectSlug = projectName.replace(/\s+/g, '_').slice(0, 30)
  const dateSlug = dateStr.replace(/\//g, '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-2)' }}>
        {[
          { num: page_count, label: 'עמודי PDF', color: 'var(--text-mid)' },
          { num: total, label: 'רכיבים', color: 'var(--text)' },
          { num: matched, label: 'תואמו למחיר', color: 'var(--success)' },
          { num: unmatched, label: 'ללא מחיר', color: unmatched > 0 ? 'var(--warning)' : 'var(--success)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: 'var(--sp-3)' }}>
            <div style={{
              fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: s.color, lineHeight: 1, marginBottom: '4px',
            }}>
              {s.num}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {unmatched > 0 && (
        <div style={{
          background: 'var(--warning-dim)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRight: '3px solid var(--warning)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          fontSize: '0.85rem',
          color: 'var(--warning)',
          fontWeight: 500,
        }}>
          ⚠️ {unmatched} רכיבים ללא מחיר — מסומנים בצהוב בקובץ האקסל. יש למלא ידנית.
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['תיאור', 'מק"ט', 'יצרן', 'כמות', 'יחידה', 'מחיר', 'סה"כ', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: 'right', fontWeight: 600,
                    color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.05em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                    fontFamily: i >= 3 ? 'var(--font-mono)' : 'var(--font-ui)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--border)',
                  background: c.price_found ? 'transparent' : 'rgba(245,158,11,0.05)',
                }}>
                  <td style={{ padding: '9px 14px', color: 'var(--text)', maxWidth: '240px' }}>{c.description}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{c.catalog}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{c.manufacturer}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--text)' }}>{c.qty}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>{c.unit}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'left', direction: 'ltr', color: c.price_found ? 'var(--text)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
                    {c.price > 0 ? `₪${c.price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'left', direction: 'ltr', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {c.price > 0 ? `₪${(c.qty * c.price).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {!c.price_found && <span style={{ fontSize: '0.7rem', color: 'var(--warning)', background: 'var(--warning-dim)', borderRadius: '4px', padding: '2px 6px' }}>חסר מחיר</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand total */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>סה"כ לפרויקט</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
            ₪{grandTotal.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Downloads */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        {[
          {
            title: 'הצעת מחיר',
            desc: '5 עמודות עם נוסחאות Excel',
            b64: excel_quote,
            filename: `הצעת_מחיר_${projectSlug}_${dateSlug}.xlsx`,
            icon: '📄',
          },
          {
            title: 'כתב חלקים',
            desc: 'רשימה מפורטת עם מק"ט ויצרן',
            b64: excel_parts,
            filename: `כתב_חלקים_${projectSlug}_${dateSlug}.xlsx`,
            icon: '📋',
          },
        ].map((dl, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dl.icon} {dl.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dl.desc}</div>
            <button
              className="btn btn-download"
              onClick={() => downloadExcel(dl.b64, dl.filename)}
            >
              ⬇ הורד Excel
            </button>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={{ textAlign: 'center', paddingTop: 'var(--sp-2)' }}>
        <button className="btn btn-ghost" onClick={onReset}>
          ↩ עבד שרטוט נוסף
        </button>
      </div>
    </div>
  )
}
```

---

## Task 10: App.tsx — main state machine

**Files:**
- Replace: `frontend/src/App.tsx`

**Step 1: Write `frontend/src/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { UploadZone } from './components/UploadZone'
import { ProjectForm } from './components/ProjectForm'
import { ProcessingView } from './components/ProcessingView'
import { ResultsView } from './components/ResultsView'
import type { AppState, ProcessResult, ProjectMeta } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{
      background: 'var(--error-dim)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRight: '3px solid var(--error)',
      borderRadius: 'var(--r-md)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      fontSize: '0.875rem', color: 'var(--error)',
    }}>
      <span>⚠ {message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  )
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [meta, setMeta] = useState<ProjectMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setError(null)
    setAppState('ready')
  }

  const handleSubmit = async (projectMeta: ProjectMeta) => {
    if (!file) return
    setMeta(projectMeta)
    setError(null)
    setAppState('processing')
    setProcessingStep(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_name', projectMeta.projectName)
      formData.append('manager_name', projectMeta.managerName)
      formData.append('date', projectMeta.date)

      // Simulate step progression for UX
      const t1 = setTimeout(() => setProcessingStep(1), 1500)
      const t2 = setTimeout(() => setProcessingStep(2), 4000)

      const response = await fetch(`${API_URL}/process`, {
        method: 'POST',
        body: formData,
      })

      clearTimeout(t1)
      clearTimeout(t2)
      setProcessingStep(2)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'שגיאה לא ידועה' }))
        throw new Error(err.detail || `שגיאת שרת: ${response.status}`)
      }

      const data: ProcessResult = await response.json()
      setResult(data)
      setAppState('results')

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה'
      setError(msg)
      setAppState('ready')
    }
  }

  const handleReset = () => {
    setAppState('idle')
    setFile(null)
    setResult(null)
    setMeta(null)
    setError(null)
    setProcessingStep(0)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="page-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {/* Page title */}
        {appState !== 'results' && (
          <div style={{ paddingTop: 'var(--sp-2)' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '4px' }}>
              ייצור הצעות מחיר
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              העלה שרטוט AutoCAD PDF וקבל קבצי Excel מוכנים להגשה
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {/* States */}
        {appState === 'idle' && <UploadZone onFile={handleFile} />}

        {appState === 'ready' && file && (
          <ProjectForm
            fileName={file.name}
            onSubmit={handleSubmit}
            loading={false}
          />
        )}

        {appState === 'processing' && <ProcessingView step={processingStep} />}

        {appState === 'results' && result && meta && (
          <ResultsView
            result={result}
            projectName={meta.projectName}
            dateStr={meta.date}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
```

**Step 2: Verify app builds**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer/frontend"
npm run build
# Expected: ✓ built in XXXms, no errors
```

**Step 3: Commit**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add frontend/src/
git commit -m "feat: add all React components and App state machine"
```

---

## Task 11: Responsive fixes for mobile

**Files:**
- Modify: `frontend/src/globals.css` — add responsive overrides

**Step 1: Append to `frontend/src/globals.css`**

```css
/* ── Mobile responsive ──────────────────────────────────────────────────── */
@media (max-width: 640px) {
  /* Stats grid: 2x2 on mobile */
  .stats-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  /* Downloads: single column on mobile */
  .downloads-grid {
    grid-template-columns: 1fr !important;
  }
  /* Form grid: stack on mobile */
  .form-grid {
    grid-template-columns: 1fr !important;
  }
  /* Table: hide less important columns */
  .table-hide-mobile {
    display: none;
  }
}
```

**Step 2: Update the grid containers in ResultsView** — add `className="stats-grid"` to stats grid, `className="downloads-grid"` to downloads grid. Update ProjectForm to use `className="form-grid"` on the grid div.

---

## Task 12: End-to-end local test

**Step 1: Run backend**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer/backend"
uvicorn main:app --reload --port 8000
```

**Step 2: Run frontend (separate terminal)**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer/frontend"
npm run dev
# Visit: http://localhost:5173
```

**Step 3: Test with a sample PDF**

```
1. Open http://localhost:5173
2. Upload a PDF from sample_files/
3. Fill: שם פרויקט = "טסט", מנהל = "יוסי", date = today
4. Click עבד שרטוט
5. Verify: components table appears, grand total shows
6. Verify: both Excel downloads work and open correctly in Excel
```

---

## Task 13: Deployment — GitHub repo

**Step 1: Ensure .gitignore covers secrets**

Create `/Users/idanbadin/Desktop/Yoav Sofer/.gitignore`:
```
# Secrets
backend/.env
backend/config/google_credentials.json
# Python
__pycache__/
*.pyc
.venv/
# Node
node_modules/
frontend/dist/
# Mac
.DS_Store
```

**Step 2: Push to GitHub**

```bash
cd "/Users/idanbadin/Desktop/Yoav Sofer"
git add .
git commit -m "feat: complete web app migration — React + FastAPI"
# Then: create repo on GitHub and push
gh repo create yoav-sofer-quotes --private && git push -u origin main
```

---

## Task 14: Deploy backend to Railway

**Step 1: Create Railway account** at railway.app, connect GitHub

**Step 2: New project → Deploy from GitHub repo → select backend/ directory**

Railway detects Python + Procfile automatically.

**Step 3: Set environment variables in Railway dashboard:**

```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_NAME=מחירון
ALLOWED_ORIGINS=https://your-app.netlify.app
GOOGLE_CREDENTIALS_B64=<base64 of google_credentials.json>
```

To get GOOGLE_CREDENTIALS_B64:
```bash
base64 -i backend/config/google_credentials.json | tr -d '\n'
```

**Step 4: Note the Railway URL** (e.g., `https://yoav-sofer-api.railway.app`)

---

## Task 15: Deploy frontend to Netlify

**Step 1: Create Netlify account**, connect GitHub repo

**Step 2: New site → Import from GitHub → select frontend/ directory**

Build settings:
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`

**Step 3: Set environment variable in Netlify dashboard:**

```
VITE_API_URL=https://yoav-sofer-api.railway.app
```

**Step 4: Trigger deploy** → get your public URL

**Step 5: Update Railway ALLOWED_ORIGINS** with the actual Netlify URL

---

## Task 16: Smoke test production

1. Visit Netlify URL
2. Upload a sample PDF
3. Process it — verify Excel downloads work
4. Verify Hebrew RTL renders correctly on mobile (Chrome DevTools)

---

## Summary of files changed

| File | Action |
|------|--------|
| `backend/utils/*` | Copied from `project/utils/` — **zero edits** |
| `backend/main.py` | **New** — FastAPI wrapper |
| `backend/requirements.txt` | **New** |
| `backend/Procfile` | **New** |
| `frontend/src/App.tsx` | **New** |
| `frontend/src/types.ts` | **New** |
| `frontend/src/globals.css` | **New** |
| `frontend/src/components/*` | **New** (5 files) |
| `frontend/index.html` | **New** |
| `frontend/netlify.toml` | **New** |
| `project/app.py` | **Untouched** |
| `project/utils/*` | **Untouched** |
