interface Props {
  step: number
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
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  {s.label}
                  {active && (
                    <span style={{ animation: 'pulse 1.2s ease-in-out infinite', fontSize: '0.6rem' }}>●</span>
                  )}
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
