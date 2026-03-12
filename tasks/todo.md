# Active Task: Flow 1 — Vision API PDF Processing
Plan: docs/plans/2026-03-11-vision-api-pdf-flow.md
Date: 2026-03-12

## Chunks
- [x] Chunk 1: pdf2image + poppler dep — 0aeeb62
- [x] Chunk 2: _vision_extract_page() + _process_pdf_vision() + parallel processing — 65645ad
- [x] Chunk 3: BOM Excel output — included in Chunk 2
- [x] Chunk 4: Deploy fixes — 9d5a411 (aptPkgs), f75384a (JSON fix), a070851 (parallel+prompt+batching)

## Results (local testing)
- AutoCAD samples (2-5): 72-86% match, single-page, fast
- לוח מבנה 118.pdf (17 pages): 49% match, ~2min total
- JSON backslash bug fixed, semantic batch bug fixed, parallel processing working

## Pending Verification
- [ ] Railway production build: verify aptPkgs installs poppler correctly
- [ ] Production smoke test: upload real PDF on https://yoavsofferapp.netlify.app

---

# Completed: Flow 2 — Excel BoQ Implementation
Commit: fb03d57 — 2026-03-11

---

# Completed: Excel → Google Sheets sync + cost/notes columns
Commit: part of fb03d57 — 2026-03-11
