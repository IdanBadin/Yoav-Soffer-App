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
