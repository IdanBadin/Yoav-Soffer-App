"""
מערכת אוטומציה לייצור הצעות מחיר — י. סופר מערכות חשמל
"""

import os
import tempfile
from datetime import date

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from utils.pdf_parser import parse_pdf
from utils.sheets_client import build_price_index, get_last_refresh_time, load_price_sheet, match_prices
from utils.excel_generator import generate_quote, generate_parts_list

load_dotenv()
APP_VERSION = "1.0.0"


def ui_error(msg: str):
    st.markdown(f"""
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-right:4px solid #DC2626;
                border-radius:10px;padding:0.85rem 1.1rem;direction:rtl;text-align:right;
                font-family:'Heebo',sans-serif;font-size:0.9rem;color:#7F1D1D;
                font-weight:500;margin:0.5rem 0;">
      <strong style="color:#991B1B;">שגיאה:</strong> {msg}
    </div>""", unsafe_allow_html=True)


def ui_warning(msg: str):
    st.markdown(f"""
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-right:4px solid #F59E0B;
                border-radius:10px;padding:0.85rem 1.1rem;direction:rtl;text-align:right;
                font-family:'Heebo',sans-serif;font-size:0.9rem;color:#78350F;
                font-weight:500;margin:0.5rem 0;">
      ⚠️ {msg}
    </div>""", unsafe_allow_html=True)


def ui_info(msg: str):
    st.markdown(f"""
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-right:4px solid #3B82F6;
                border-radius:10px;padding:0.85rem 1.1rem;direction:rtl;text-align:right;
                font-family:'Heebo',sans-serif;font-size:0.9rem;color:#1E3A5F;
                font-weight:500;margin:0.5rem 0;">
      ℹ️ {msg}
    </div>""", unsafe_allow_html=True)

st.set_page_config(
    page_title="י. סופר — מערכת הצעות מחיר",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
# DESIGN SYSTEM — Industrial Precision
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; }

:root {
  --navy:        #0F2340;
  --navy-mid:    #1A3558;
  --navy-light:  #234878;
  --blue:        #2E86AB;
  --blue-bright: #3FA0C8;
  --bg:          #EEF1F6;
  --bg-dark:     #E3E8F0;
  --card:        #FFFFFF;
  --border:      rgba(15,35,64,0.10);
  --border-med:  rgba(15,35,64,0.18);
  --text:        #0F2340;
  --text-mid:    #3D5A80;
  --text-muted:  #7A90AB;
  --success:     #1A8754;
  --warning:     #C8780A;
  --error:       #C0392B;
  --yellow-bg:   #FFFBEB;
  --yellow-bd:   #F59E0B;
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --shadow-sm:   0 1px 3px rgba(15,35,64,0.08), 0 1px 2px rgba(15,35,64,0.06);
  --shadow-md:   0 4px 16px rgba(15,35,64,0.10), 0 2px 6px rgba(15,35,64,0.06);
  --shadow-lg:   0 12px 40px rgba(15,35,64,0.14), 0 4px 12px rgba(15,35,64,0.08);
}

html, body { direction: rtl; }

.stApp {
  font-family: 'Heebo', sans-serif !important;
  background: var(--bg) !important;
  direction: rtl;
}

/* ── Hide Streamlit chrome ── */
#MainMenu, footer, header { visibility: hidden; }
.block-container {
  padding-top: 0 !important;
  padding-bottom: 3rem !important;
  max-width: 1280px !important;
}

/* ── Sidebar ── */
section[data-testid="stSidebar"] {
  background: var(--navy) !important;
  border-left: none !important;
  border-right: 1px solid rgba(255,255,255,0.06) !important;
}
section[data-testid="stSidebar"] > div {
  padding: 0 !important;
}
.sidebar-inner {
  padding: 2rem 1.5rem;
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.sidebar-logo-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1.3;
}
.sidebar-logo-sub {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.45);
  font-weight: 400;
  margin-top: 1px;
}
.sidebar-section-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 1.5rem 0 0.75rem;
}
.sidebar-info-block {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
  padding: 1rem;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.7;
  direction: rtl;
}
.sidebar-info-block strong { color: rgba(255,255,255,0.9); }
.sidebar-version {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 0.72rem;
  color: rgba(255,255,255,0.25);
  text-align: center;
}
.sidebar-refresh-ts {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
  margin-top: 0.5rem;
  text-align: right;
}

/* Fix sidebar collapse button RTL direction */
[data-testid="stSidebarCollapsedControl"] svg,
button[data-testid="stBaseButton-headerNoPadding"] svg {
  transform: scaleX(-1);
}

/* Sidebar Streamlit elements override */
section[data-testid="stSidebar"] p,
section[data-testid="stSidebar"] span,
section[data-testid="stSidebar"] label,
section[data-testid="stSidebar"] div {
  font-family: 'Heebo', sans-serif !important;
  color: rgba(255,255,255,0.85) !important;
  direction: rtl !important;
}
section[data-testid="stSidebar"] .stButton > button {
  background: rgba(255,255,255,0.08) !important;
  color: rgba(255,255,255,0.9) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  font-weight: 600 !important;
  font-size: 0.875rem !important;
  width: 100% !important;
  min-height: 40px !important;
  transition: background 0.2s ease, border-color 0.2s ease !important;
}
section[data-testid="stSidebar"] .stButton > button:hover {
  background: rgba(255,255,255,0.14) !important;
  border-color: rgba(255,255,255,0.25) !important;
}

/* ── Page header ── */
.page-header {
  background: linear-gradient(105deg, var(--navy) 0%, var(--navy-mid) 60%, #1D4E8F 100%);
  margin: 0 -1rem 2.5rem;
  padding: 2rem 3rem;
  position: relative;
  overflow: hidden;
}
.page-header::before {
  content: '';
  position: absolute;
  top: -60px; left: -60px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(46,134,171,0.25) 0%, transparent 70%);
  pointer-events: none;
}
.page-header::after {
  content: '';
  position: absolute;
  bottom: -40px; right: 5%;
  width: 300px; height: 200px;
  background: radial-gradient(circle, rgba(46,134,171,0.12) 0%, transparent 70%);
  pointer-events: none;
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: relative;
  z-index: 1;
}
.header-icon-wrap {
  width: 52px; height: 52px;
  background: rgba(46,134,171,0.2);
  border: 1px solid rgba(46,134,171,0.35);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(46,134,171,0.3);
}
.header-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.3px;
  line-height: 1.2;
}
.header-sub {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.5);
  font-weight: 400;
  margin-top: 3px;
  letter-spacing: 0.02em;
}

/* ── Section heading ── */
.section-heading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin: 2rem 0 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}
.section-heading-dot {
  width: 6px; height: 6px;
  background: var(--blue);
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Card ── */
.ui-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  padding: 1.75rem 2rem;
  margin-bottom: 1.25rem;
}
.ui-card-tight { padding: 1.25rem 1.5rem; }

/* ── Upload zone ── */
.upload-wrap {
  background: var(--card);
  border: 2px dashed rgba(46,134,171,0.35);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  text-align: center;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  cursor: pointer;
  position: relative;
}
.upload-wrap:hover {
  border-color: var(--blue);
  background: rgba(46,134,171,0.025);
  box-shadow: 0 0 0 4px rgba(46,134,171,0.08);
}
.upload-icon-wrap {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, rgba(46,134,171,0.12), rgba(46,134,171,0.06));
  border: 1px solid rgba(46,134,171,0.2);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1rem;
}
.upload-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.3rem;
}
.upload-sub {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── File pill ── */
.file-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(46,134,171,0.08);
  color: var(--blue);
  border: 1px solid rgba(46,134,171,0.2);
  border-radius: 20px;
  padding: 0.3rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.75rem;
}

/* ── Form card ── */
.form-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  padding: 1.75rem 2rem 1.5rem;
  margin-bottom: 1.25rem;
}

/* ── Input fields ── */
.stTextInput > div > div > input {
  border: 1.5px solid var(--border-med) !important;
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  font-size: 0.9rem !important;
  color: var(--text) !important;
  background: var(--bg) !important;
  text-align: right !important;
  padding: 0.55rem 0.85rem !important;
  min-height: 44px !important;
  transition: border-color 0.18s, box-shadow 0.18s !important;
  direction: rtl !important;
}
.stTextInput > div > div > input:focus {
  border-color: var(--blue) !important;
  box-shadow: 0 0 0 3px rgba(46,134,171,0.12) !important;
  background: #FFFFFF !important;
}
.stDateInput > div > div > input {
  border: 1.5px solid var(--border-med) !important;
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  font-size: 0.9rem !important;
  min-height: 44px !important;
  background: var(--bg) !important;
  text-align: right !important;
  direction: rtl !important;
}
.stTextInput label, .stDateInput label, .stFileUploader label {
  font-family: 'Heebo', sans-serif !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  color: var(--text-mid) !important;
  letter-spacing: 0.03em !important;
  direction: rtl !important;
  text-align: right !important;
  display: block !important;
  margin-bottom: 0.3rem !important;
}

/* ── Primary button ── */
.stButton > button {
  background: var(--navy) !important;
  color: #FFFFFF !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  letter-spacing: 0.02em !important;
  padding: 0.65rem 1.75rem !important;
  min-height: 44px !important;
  width: 100% !important;
  transition: background 0.18s, box-shadow 0.18s, transform 0.15s !important;
  box-shadow: 0 2px 8px rgba(15,35,64,0.2) !important;
}
.stButton > button:hover {
  background: var(--navy-light) !important;
  box-shadow: 0 6px 20px rgba(15,35,64,0.28) !important;
  transform: translateY(-1px) !important;
}
.stButton > button:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 6px rgba(15,35,64,0.2) !important;
}

/* ── Download buttons ── */
.stDownloadButton > button {
  background: var(--navy) !important;
  color: #FFFFFF !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  padding: 0.7rem 1.5rem !important;
  min-height: 48px !important;
  width: 100% !important;
  transition: background 0.18s, box-shadow 0.18s, transform 0.15s !important;
  box-shadow: 0 2px 8px rgba(15,35,64,0.2) !important;
}
.stDownloadButton > button:hover {
  background: var(--navy-light) !important;
  box-shadow: 0 6px 20px rgba(15,35,64,0.3) !important;
  transform: translateY(-1px) !important;
}

/* ── Alert / error messages — VISIBLE TEXT ── */
div[data-testid="stAlert"] {
  border-radius: var(--radius-md) !important;
  font-family: 'Heebo', sans-serif !important;
  direction: rtl !important;
  text-align: right !important;
}
div[data-testid="stAlert"] p,
div[data-testid="stAlert"] div,
div[data-testid="stAlert"] span {
  font-family: 'Heebo', sans-serif !important;
  direction: rtl !important;
  text-align: right !important;
}
/* Error — dark red text on light red bg */
div[data-testid="stAlert"][data-baseweb="notification"][aria-label*="error"],
div[data-testid="stNotification"][kind="error"],
.stAlert.st-emotion-cache-error,
[data-testid="stAlert"] {
  background: #FFF2F2 !important;
  border: 1px solid #FECACA !important;
  border-right: 4px solid var(--error) !important;
}
/* Override ALL text in alerts to be dark */
div[data-testid="stAlert"] * {
  color: #1A1A1A !important;
}
div[data-testid="stStatusWidget"] { display: none !important; }

/* ── Spinner ── */
.stSpinner > div { border-top-color: var(--blue) !important; }

/* ── Progress bar ── */
.stProgress { margin: 0.5rem 0 !important; }
.stProgress > div > div > div > div {
  background: linear-gradient(90deg, var(--navy-light), var(--blue-bright)) !important;
  border-radius: 4px !important;
  transition: width 0.4s ease !important;
}

/* ── Status message ── */
.status-msg {
  background: rgba(46,134,171,0.06);
  border: 1px solid rgba(46,134,171,0.2);
  border-right: 3px solid var(--blue);
  border-radius: var(--radius-md);
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--navy-mid);
  direction: rtl;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ── Stat cards ── */
.stats-row { display: flex; gap: 1rem; margin: 1.25rem 0; }
.stat-box {
  flex: 1;
  background: var(--card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  padding: 1.2rem 1rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.stat-box::before {
  content: '';
  position: absolute;
  top: 0; right: 0; left: 0;
  height: 3px;
  background: var(--blue);
  border-radius: 3px 3px 0 0;
}
.stat-box.green::before { background: var(--success); }
.stat-box.amber::before { background: var(--warning); }
.stat-box.navy::before  { background: var(--navy); }
.stat-num {
  font-size: 2.1rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1;
  margin-bottom: 0.3rem;
}
.stat-num.green { color: var(--success); }
.stat-num.amber { color: var(--warning); }
.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Warning banner ── */
.warn-banner {
  background: var(--yellow-bg);
  border: 1px solid rgba(245,158,11,0.3);
  border-right: 4px solid var(--yellow-bd);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #92400E;
  direction: rtl;
  text-align: right;
  margin: 0.75rem 0;
}

/* ── Grand total bar ── */
.total-bar {
  background: var(--navy);
  border-radius: var(--radius-md);
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  box-shadow: var(--shadow-md);
}
.total-bar-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
}
.total-bar-amount {
  font-size: 1.4rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.5px;
}

/* ── Download card ── */
.dl-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem 1.75rem;
}
.dl-card-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-mid);
  margin-bottom: 0.35rem;
}
.dl-card-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

/* ── Divider ── */
.ui-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.75rem 0;
}

/* ── Dataframe container ── */
.stDataFrame {
  border-radius: var(--radius-md) !important;
  overflow: hidden !important;
  box-shadow: var(--shadow-sm) !important;
  border: 1px solid var(--border) !important;
}
.stDataFrame thead tr th {
  background: var(--navy) !important;
  color: white !important;
  font-family: 'Heebo', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.8rem !important;
}

/* ── File uploader ── */
[data-testid="stFileUploader"] {
  background: transparent !important;
}
[data-testid="stFileUploader"] > div {
  background: transparent !important;
  border: none !important;
}
[data-testid="stFileUploaderDropzone"] {
  background: var(--card) !important;
  border: 2px dashed rgba(46,134,171,0.35) !important;
  border-radius: var(--radius-lg) !important;
  padding: 1.5rem 1rem !important;
  transition: all 0.2s ease !important;
}
[data-testid="stFileUploaderDropzone"]:hover {
  border-color: var(--blue) !important;
  background: rgba(46,134,171,0.02) !important;
}
[data-testid="stFileUploaderDropzone"] span,
[data-testid="stFileUploaderDropzone"] p,
[data-testid="stFileUploaderDropzone"] small {
  font-family: 'Heebo', sans-serif !important;
  color: var(--text-muted) !important;
}

/* ── Expander ── */
details summary {
  font-family: 'Heebo', sans-serif !important;
  font-size: 0.85rem !important;
  font-weight: 600 !important;
  color: var(--text-mid) !important;
  direction: rtl !important;
}

/* ── Column layout fix for RTL ── */
.stColumns { direction: rtl; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .page-header { padding: 1.5rem 1.25rem; margin: 0 -0.5rem 1.5rem; }
  .header-title { font-size: 1.2rem; }
  .block-container { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
  .stats-row { flex-wrap: wrap; }
  .stat-box { min-width: calc(50% - 0.5rem); }
  .ui-card { padding: 1.25rem; }
}
</style>
""", unsafe_allow_html=True)

# ─── Session state ─────────────────────────────────────────────────────────────
for key, default in [("price_index", None), ("last_refresh", None), ("result", None)]:
    if key not in st.session_state:
        st.session_state[key] = default

# ─── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"""
    <div class="sidebar-inner">
      <div class="sidebar-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
                fill="#F6C90E" stroke="#E5B800" stroke-width="0.5" stroke-linejoin="round"/>
        </svg>
        <div>
          <div class="sidebar-logo-text">י. סופר מערכות חשמל</div>
          <div class="sidebar-logo-sub">מערכת ניהול הצעות מחיר</div>
        </div>
      </div>

      <div class="sidebar-section-label">מאגר מחירים</div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("↻ רענן מאגר מחירים", use_container_width=True):
        st.session_state.price_index = None
        st.session_state.last_refresh = None
        st.rerun()

    if st.session_state.last_refresh:
        st.markdown(f'<div class="sidebar-refresh-ts">עודכן: {st.session_state.last_refresh}</div>',
                    unsafe_allow_html=True)
    else:
        st.markdown('<div class="sidebar-refresh-ts">טרם נטען</div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="sidebar-inner" style="padding-top:0">
      <div class="sidebar-section-label">הוראות שימוש</div>
      <div class="sidebar-info-block">
        <strong>1.</strong> העלה שרטוט PDF<br>
        <strong>2.</strong> מלא פרטי פרויקט<br>
        <strong>3.</strong> לחץ <em>עבד שרטוט</em><br>
        <strong>4.</strong> הורד קבצי Excel
      </div>
      <div class="sidebar-version">גרסה """ + APP_VERSION + """ &nbsp;·&nbsp; י. סופר © 2026</div>
    </div>
    """, unsafe_allow_html=True)


# ─── Load prices (cached) ──────────────────────────────────────────────────────
def _load_prices():
    creds_path = "config/google_credentials.json"
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "מחירון")
    if not os.path.exists(creds_path) or not sheet_id:
        return None
    try:
        records = load_price_sheet(creds_path, sheet_id, sheet_name)
        index = build_price_index(records)
        st.session_state.last_refresh = get_last_refresh_time()
        return index
    except Exception as e:
        st.sidebar.markdown('<div style="color:#FCA5A5;font-size:0.8rem;padding:0.5rem 0;font-family:Heebo,sans-serif;">⚠️ שגיאה בחיבור למאגר המחירים</div>', unsafe_allow_html=True)
        return None

if st.session_state.price_index is None:
    st.session_state.price_index = _load_prices()


# ─── Header ───────────────────────────────────────────────────────────────────
st.markdown("""
<div class="page-header">
  <div class="header-inner">
    <div class="header-icon-wrap">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="#F6C90E" stroke="#E5B800" stroke-width="0.5" stroke-linejoin="round"/>
      </svg>
    </div>
    <div>
      <div class="header-title">י. סופר מערכות חשמל</div>
      <div class="header-sub">מערכת אוטומציה לייצור הצעות מחיר מתוך שרטוטי AutoCAD</div>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)


# ─── Upload ────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="section-heading">
  <span class="section-heading-dot"></span>
  העלאת שרטוט
</div>
""", unsafe_allow_html=True)

uploaded_file = st.file_uploader(
    "שרטוט חשמלי (AutoCAD PDF)",
    type=["pdf"],
    help="העלה קובץ PDF של שרטוט חשמלי — ה-BOM יחולץ אוטומטית מעמוד 2",
    label_visibility="collapsed",
)

if not uploaded_file:
    st.markdown("""
    <div class="upload-wrap">
      <div class="upload-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9,15 12,12 15,15"/>
        </svg>
      </div>
      <div class="upload-title">גרור קובץ PDF לכאן או לחץ לבחירה</div>
      <div class="upload-sub">שרטוטי AutoCAD בלבד — הקובץ יעובד אוטומטית</div>
    </div>
    """, unsafe_allow_html=True)
else:
    st.markdown(f'<div class="file-pill">📄 {uploaded_file.name}</div>', unsafe_allow_html=True)


# ─── Project form ──────────────────────────────────────────────────────────────
if uploaded_file:
    st.markdown("""
    <div class="section-heading" style="margin-top:2rem">
      <span class="section-heading-dot"></span>
      פרטי הפרויקט
    </div>
    """, unsafe_allow_html=True)

    with st.container():
        st.markdown('<div class="form-card">', unsafe_allow_html=True)
        col1, col2, col3 = st.columns([2, 2, 1])
        with col1:
            project_name = st.text_input("שם הפרויקט", placeholder="לדוגמה: תעשייה אווירית מבנה 118")
        with col2:
            manager_name = st.text_input("מנהל הפרויקט", placeholder="לדוגמה: סתיו כהן")
        with col3:
            quote_date = st.date_input("תאריך", value=date.today())
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
    process_btn = st.button("⚡  עבד שרטוט וייצר קבצים", use_container_width=True)

    # ─── Processing ────────────────────────────────────────────────────────────
    if process_btn:
        if not project_name.strip():
            ui_error("נא למלא שם פרויקט לפני המשך.")
            st.stop()

        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            ui_error("מפתח ANTHROPIC_API_KEY לא מוגדר בקובץ .env")
            st.stop()

        progress_bar = st.progress(0)
        status_slot = st.empty()

        def show_status(msg, pct):
            progress_bar.progress(pct)
            status_slot.markdown(f'<div class="status-msg">⚙ {msg}</div>', unsafe_allow_html=True)

        try:
            show_status("קורא קובץ PDF...", 10)

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(uploaded_file.getbuffer())
                tmp_path = tmp.name

            show_status("מחלץ רשימת רכיבים באמצעות AI...", 30)
            result = parse_pdf(tmp_path, api_key)
            os.unlink(tmp_path)

            if not result["components"] and not result["flagged"]:
                progress_bar.empty()
                status_slot.empty()
                ui_error("לא זוהו רכיבים בשרטוט. ודא שהקובץ הנכון הועלה.")
                st.stop()

            show_status("מתאים מחירים ממאגר Google Sheets...", 65)
            all_comps = result["components"] + result["flagged"]

            if st.session_state.price_index:
                priced = match_prices(all_comps, st.session_state.price_index)
            else:
                priced = [{**c, "price": 0.0, "unit": "יח'", "match_type": "none", "price_found": False}
                          for c in all_comps]

            show_status("מייצר קבצי Excel...", 85)
            date_str = quote_date.strftime("%d/%m/%Y")
            excel_quote = generate_quote(priced, project_name, manager_name, date_str)
            excel_parts = generate_parts_list(priced, project_name, manager_name, date_str)

            progress_bar.progress(100)
            status_slot.empty()
            progress_bar.empty()

            st.session_state.result = {
                "components": priced,
                "excel_quote": excel_quote,
                "excel_parts": excel_parts,
                "page_count": result["page_count"],
                "project_name": project_name,
                "manager_name": manager_name,
                "date_str": date_str,
            }

        except Exception as e:
            progress_bar.empty()
            status_slot.empty()
            err_str = str(e)
            if "credit balance" in err_str.lower() or "too low" in err_str.lower():
                ui_error("יתרת הקרדיטים ב-Anthropic נמוכה מדי. כנס ל-console.anthropic.com → Plans & Billing והוסף קרדיטים.")
            else:
                ui_error("שגיאה בעיבוד השרטוט. נסה שנית.")
            with st.expander("פרטי שגיאה לאבחון"):
                st.markdown(f'<div style="font-family:monospace;font-size:0.8rem;color:#1A1A1A;direction:ltr;text-align:left;white-space:pre-wrap;background:#F8F8F8;padding:1rem;border-radius:8px;">{err_str}</div>', unsafe_allow_html=True)
            st.stop()


# ─── Results ───────────────────────────────────────────────────────────────────
if st.session_state.result:
    r = st.session_state.result
    components = r["components"]
    total = len(components)
    matched = sum(1 for c in components if c.get("price_found"))
    unmatched = total - matched
    grand_total = sum(c.get("qty", 0) * c.get("price", 0) for c in components)

    st.markdown("""
    <div class="section-heading" style="margin-top:2rem">
      <span class="section-heading-dot"></span>
      תוצאות העיבוד
    </div>
    """, unsafe_allow_html=True)

    # Stats
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(f'<div class="stat-box navy"><div class="stat-num">{r["page_count"]}</div><div class="stat-label">עמודי PDF</div></div>', unsafe_allow_html=True)
    with col2:
        st.markdown(f'<div class="stat-box"><div class="stat-num">{total}</div><div class="stat-label">רכיבים זוהו</div></div>', unsafe_allow_html=True)
    with col3:
        st.markdown(f'<div class="stat-box green"><div class="stat-num green">{matched}</div><div class="stat-label">תואמו למחיר</div></div>', unsafe_allow_html=True)
    with col4:
        cls = "amber" if unmatched > 0 else "green"
        st.markdown(f'<div class="stat-box {cls}"><div class="stat-num {cls}">{unmatched}</div><div class="stat-label">ללא מחיר</div></div>', unsafe_allow_html=True)

    if unmatched > 0:
        st.markdown(f'<div class="warn-banner">⚠️ {unmatched} רכיבים ללא מחיר — שורות אלו מסומנות בצהוב בקובץ האקסל. יש למלא ידנית.</div>', unsafe_allow_html=True)

    st.markdown("<div style='height:1rem'></div>", unsafe_allow_html=True)

    # Table
    df = pd.DataFrame([{
        "תיאור": c.get("description", ""),
        'מק"ט': c.get("catalog", ""),
        "יצרן": c.get("manufacturer", ""),
        "כמות": c.get("qty", 0),
        "יחידה": c.get("unit", "יח'"),
        "מחיר": c.get("price", 0),
        'סה"כ': round(c.get("qty", 0) * c.get("price", 0), 2),
        "סטטוס": "✅" if c.get("price_found") else "⚠️",
    } for c in components])

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        height=min(400, 56 + len(df) * 35),
        column_config={
            "מחיר": st.column_config.NumberColumn(format="₪%.2f"),
            'סה"כ': st.column_config.NumberColumn(format="₪%.2f"),
            "כמות": st.column_config.NumberColumn(format="%.0f"),
        },
    )

    st.markdown(f"""
    <div class="total-bar">
      <span class="total-bar-label">סה"כ לפרויקט</span>
      <span class="total-bar-amount">₪{grand_total:,.2f}</span>
    </div>
    """, unsafe_allow_html=True)

    # Downloads
    st.markdown("""
    <div class="section-heading" style="margin-top:2.5rem">
      <span class="section-heading-dot"></span>
      הורדת קבצים
    </div>
    """, unsafe_allow_html=True)

    project_slug = r["project_name"].replace(" ", "_")[:30]
    date_slug = r["date_str"].replace("/", "-")

    col_dl1, col_dl2 = st.columns(2)
    with col_dl1:
        st.markdown("""
        <div class="dl-card">
          <div class="dl-card-title">הצעת מחיר / חשבון</div>
          <div class="dl-card-desc">קובץ Excel בפורמט הצעת מחיר — 5 עמודות עם נוסחאות</div>
        </div>
        """, unsafe_allow_html=True)
        st.download_button(
            label="⬇  הורד הצעת מחיר",
            data=r["excel_quote"],
            file_name=f"הצעת_מחיר_{project_slug}_{date_slug}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )

    with col_dl2:
        st.markdown("""
        <div class="dl-card">
          <div class="dl-card-title">כתב חלקים</div>
          <div class="dl-card-desc">רשימת רכיבים מפורטת עם מק"ט, יצרן ומחיר יחידה</div>
        </div>
        """, unsafe_allow_html=True)
        st.download_button(
            label="⬇  הורד כתב חלקים",
            data=r["excel_parts"],
            file_name=f"כתב_חלקים_{project_slug}_{date_slug}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )
