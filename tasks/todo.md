# Task: Electrical Panel Quote Automation System
Date: 2026-03-05

## Goal
Build a Streamlit app that accepts an AutoCAD PDF electrical drawing, extracts the BOM via Claude API,
matches prices from Google Sheets, and generates two pixel-perfect Excel files matching Y. Sofer's existing format.

---

## File Analysis Summary (from sample_files/)

### EXCEL OUTPUT FORMAT — File 1: הצעת מחיר/חשבון (5 columns)
| Col | Header | Width | Notes |
|-----|--------|-------|-------|
| A | סעיף | 35.375 | Description, Calibri Light 12pt, center, wrap |
| B | הערה | 11.25 | Unit (מר'/יח'), center |
| C | כמות | 12.5 | Quantity, numeric |
| D | מחיר | 12.125 | Unit price, numeric |
| E | סה"כ | 12.875 | =D*C formula |

Layout:
- Rows 1-3: Header block — A1:A3 merged (company), D1=date, D2=project name, D3=manager
- Row 4: Title bar — merged A4:E4, Calibri Light 18pt bold, theme:3 fill (blue), center
- Row 5: Column headers — Calibri Light 12pt bold, theme:3 fill, center
- Data rows 6+: Calibri Light 12pt, no fill, thin borders
- Total row: =SUM(E6:E...), bold, medium bottom border
- Row heights: 1-3=15.75pt, 4=23.25pt, 5=22.5pt, data=15.75pt, total=26.25pt
- Borders: data left=medium, right=medium, inner=thin

### EXCEL OUTPUT FORMAT — File 2: כתב חלקים (8 columns)
מס' | תיאור | מק"ט | יצרן | כמות | יחידה | מחיר יחידה | סה"כ
(Detailed BOM parts list with catalog numbers, manufacturers, prices)

### PDF BOM STRUCTURE (confirmed across 4 sample drawings)
- Page 2: always the BOM table — columns: QTY | CATALOG | USER1 | MFG | DESCRIPTION
- Pages 3+: wiring diagrams (ignore for BOM purposes)
- Common MFGs: ABB, IDEC-KAHANE, SOCOMEC-NOS, N_O_S, HAGER, GIC, PHOENIX, SATEC, LS-BECHOR
- Typical catalog patterns: S201M-C16, F204-A-40/0.03, ACS580-01-02A7, XT1C-160-TMD-100A

---

## Build Plan

### Phase 1 — Project Setup
- [ ] 1.1 Create directory structure: project/config/, project/utils/
- [ ] 1.2 Write requirements.txt
- [ ] 1.3 Write .env.example
- [ ] 1.4 Write .gitignore

### Phase 2 — PDF Parser (utils/pdf_parser.py)
- [ ] 2.1 Extract text + tables from ALL pages with pdfplumber
- [ ] 2.2 Send to Claude API (claude-sonnet-4-5) with exact system prompt
- [ ] 2.3 Validate JSON response: qty positive, catalog not empty, flag bad rows
- [ ] 2.4 Deduplicate across pages by catalog+qty
- [ ] 2.5 Return list of dicts: {qty, catalog, user1, manufacturer, description}
- [ ] STOP → show extracted results to user for confirmation

### Phase 3 — Google Sheets Client (utils/sheets_client.py)
- [ ] 3.1 Connect via gspread + service account JSON
- [ ] 3.2 Load sheet data, cache in st.session_state
- [ ] 3.3 Price matching: (1) exact catalog, (2) mfg+catalog, (3) fuzzy description (cutoff=0.7)
- [ ] 3.4 Return price=0 + flag=True if no match found

### Phase 4 — Excel Generator (utils/excel_generator.py)
- [ ] 4.1 FILE 1 (הצעת מחיר): exact pixel-perfect format matching samples
  - Merged header rows 1-3, blue title row 4, column headers row 5
  - Data rows with =D*C formulas, total row with =SUM()
  - Exact column widths, row heights, fonts (Calibri Light), borders, RTL
- [ ] 4.2 FILE 2 (כתב חלקים): 8-column BOM table with matching style
- [ ] 4.3 Yellow fill for unmatched price rows (price=0)
- [ ] 4.4 Return BytesIO objects (no temp files on disk)
- [ ] STOP → visual comparison with sample Excel files

### Phase 5 — Streamlit App (app.py)
- [ ] 5.1 Custom CSS: Heebo font, RTL direction, full color palette
- [ ] 5.2 Header: navy bar, company name, lightning SVG, tagline
- [ ] 5.3 Upload zone: dashed card with animation
- [ ] 5.4 Project form: שם פרויקט / שם מנהל / תאריך
- [ ] 5.5 Processing: animated progress with Hebrew messages
- [ ] 5.6 Results: stats + DataFrame + amber highlighting + download buttons
- [ ] 5.7 Sidebar: version, refresh prices, timestamp
- [ ] 5.8 All error messages in Hebrew + debug expander
- [ ] 5.9 Responsive at 390px / 768px / 1024px / 1440px

### Phase 6 — End-to-End Test
- [ ] 6.1 Test with all 4 sample PDFs
- [ ] 6.2 Verify Excel outputs match samples
- [ ] 6.3 Confirm Hebrew rendering + RTL correct
- [ ] 6.4 Confirm download buttons work

---

## Credentials (will STOP and guide step by step)
1. ANTHROPIC_API_KEY — console.anthropic.com
2. config/google_credentials.json — Google Cloud service account
3. GOOGLE_SHEET_ID — from Sheet URL

## Notes
- claude-sonnet-4-5 as specified for the Claude API calls
- Both Excel files generated as BytesIO (in-memory, never written to disk)
- BOM always on page 2, but all pages processed defensively
- Hebrew font = Heebo from Google Fonts
- Unmatched prices flagged yellow in preview table AND in Excel output

## Review
[To be filled after completion]
