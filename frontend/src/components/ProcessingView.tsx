import { useEffect, useState } from 'react'

interface Props {
  step: number
}

const STEP_DEFS = [
  {
    label: 'קורא קובץ PDF',
    sublabel: 'מחלץ טקסט, טבלאות ונתונים',
    messages: [
      'פותח קובץ PDF...',
      'מזהה מבנה ועמודים...',
      'מחלץ טקסט גולמי...',
      'מחלץ טבלאות וכותרות...',
      'מסיים קריאת קובץ...',
    ],
    doneLabel: 'PDF נקרא בהצלחה',
  },
  {
    label: 'Claude AI מנתח רכיבים',
    sublabel: 'מזהה רכיבי חשמל ומחלץ נתונים',
    messages: [
      'מתחבר ל-Claude AI...',
      'שולח נתוני שרטוט לניתוח...',
      'Claude AI קורא את השרטוט...',
      'מזהה רכיבי חשמל...',
      'מחלץ מספרי קטלוג...',
      'מסווג יצרנים ודגמים...',
      'מחלץ כמויות ויחידות מידה...',
      'בודק עקביות הנתונים...',
      'מאמת תוצאות...',
      'ניתוח AI הושלם',
    ],
    doneLabel: 'רכיבים זוהו בהצלחה',
  },
  {
    label: 'מתאים מחירים ובונה Excel',
    sublabel: 'שולב מחירון ומייצר קבצים',
    messages: [
      'מחפש מחירים במחירון...',
      'מתאים לפי מספר קטלוג...',
      'בודק התאמות יצרן...',
      'מחשב סה"כ...',
      'בונה הצעת מחיר...',
      'בונה כתב חלקים...',
      'מסיים וממתין לאישור שרת...',
    ],
    doneLabel: 'קבצי Excel הופקו בהצלחה',
  },
]

const STEP_INTERVALS = [800, 3800, 700]

function SpinnerSvg() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.9s linear infinite' }}
    >
      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,0.2)" />
      <path d="M12 3 A9 9 0 0 1 21 12" stroke="currentColor" />
    </svg>
  )
}

export function ProcessingView({ step }: Props) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [logLines, setLogLines] = useState<string[]>([])

  useEffect(() => {
    setMsgIndex(0)
    setElapsed(0)
    setLogLines([])
  }, [step])

  useEffect(() => {
    const msgs = STEP_DEFS[step]?.messages ?? []
    if (msgIndex >= msgs.length - 1) return
    const t = setTimeout(() => {
      setMsgIndex(i => i + 1)
      setLogLines(prev => [...prev.slice(-6), msgs[msgIndex]])
    }, STEP_INTERVALS[step] ?? 1000)
    return () => clearTimeout(t)
  }, [step, msgIndex])

  useEffect(() => {
    if (step !== 1) return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [step])

  const progress = ((step + (msgIndex / ((STEP_DEFS[step]?.messages.length ?? 1) - 1)) * 0.9) / STEP_DEFS.length) * 100
  const currentMsg = STEP_DEFS[step]?.messages[msgIndex] ?? ''

  return (
    <div className="processing-wrap">
      <div className="card processing-card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>מעבד שרטוט...</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {STEP_DEFS[step]?.sublabel}
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            color: 'var(--accent)',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(246,201,14,0.2)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontWeight: 600,
          }}>
            {Math.min(Math.round(progress), 99)}%
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '4px',
          background: 'var(--border)',
          borderRadius: '2px',
          marginBottom: 'var(--sp-3)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(246,201,14,0.15), transparent)',
            animation: 'shimmer 2s infinite',
          }} />
          <div style={{
            height: '100%',
            width: `${Math.min(progress, 99)}%`,
            background: 'linear-gradient(90deg, #E5B800, var(--accent), #fdd733)',
            borderRadius: '2px',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 12px rgba(246,201,14,0.4)',
          }} />
        </div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 'var(--sp-3)' }}>
          {STEP_DEFS.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                background: active ? 'rgba(246,201,14,0.06)' : done ? 'rgba(34,197,94,0.05)' : 'transparent',
                border: `1px solid ${active ? 'rgba(246,201,14,0.2)' : done ? 'rgba(34,197,94,0.12)' : 'var(--border)'}`,
                transition: 'all 0.4s ease',
              }}>
                {/* Step circle */}
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: done ? '0.85rem' : '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  background: done
                    ? 'var(--success)'
                    : active
                    ? 'var(--accent)'
                    : 'var(--surface-2)',
                  color: done || active ? '#0D0F12' : 'var(--text-muted)',
                  border: active ? '2px solid rgba(246,201,14,0.4)' : done ? '2px solid rgba(34,197,94,0.4)' : '2px solid var(--border-med)',
                  transition: 'all 0.3s ease',
                }}>
                  {done ? '✓' : active ? (
                    <SpinnerSvg />
                  ) : i + 1}
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-muted)',
                    transition: 'color 0.3s ease',
                  }}>
                    {s.label}
                  </div>
                  {active && (
                    <div style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      marginTop: '3px',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      overflow: 'hidden',
                    }}>
                      <span style={{ color: 'var(--accent)', opacity: 0.7, flexShrink: 0 }}>›</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentMsg}
                      </span>
                      <span className="blink-cursor" style={{ flexShrink: 0 }}>█</span>
                    </div>
                  )}
                  {done && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '2px', opacity: 0.8 }}>
                      {s.doneLabel}
                    </div>
                  )}
                </div>

                {/* Time for Claude step */}
                {active && step === 1 && elapsed > 0 && (
                  <div style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                  }}>
                    {elapsed}s
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Terminal log */}
        <div className="terminal-log">
          <div className="terminal-header">
            <span className="terminal-dot" style={{ background: '#EF4444' }} />
            <span className="terminal-dot" style={{ background: '#F59E0B' }} />
            <span className="terminal-dot" style={{ background: '#22C55E' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: 'auto' }}>לוג מערכת</span>
          </div>
          <div className="terminal-body">
            {[...logLines, currentMsg].slice(-4).map((line, i, arr) => (
              <div key={i} style={{
                display: 'flex',
                gap: '8px',
                opacity: i === arr.length - 1 ? 1 : 0.35 + (i / arr.length) * 0.45,
                color: i === arr.length - 1 ? 'var(--text-mid)' : 'var(--text-muted)',
                transition: 'opacity 0.3s',
              }}>
                <span style={{ color: 'var(--accent)', opacity: 0.6, userSelect: 'none' }}>$</span>
                <span>{line}</span>
                {i === arr.length - 1 && <span className="blink-cursor">█</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .processing-wrap { max-width: 540px; margin: 0 auto; width: 100%; }
        .processing-card { padding: var(--sp-4); }
        .blink-cursor { animation: blink 1s step-end infinite; }
        .terminal-log {
          background: #0a0c0f;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          overflow: hidden;
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: '6px';
          padding: 7px 12px;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          gap: 5px;
        }
        .terminal-dot { width: 8px; height: 8px; border-radius: 50%; }
        .terminal-body {
          padding: 10px 14px;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 72px;
          justify-content: flex-end;
        }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes shimmer {
          0% { transform: translateX(200%) }
          100% { transform: translateX(-100%) }
        }
      `}</style>
    </div>
  )
}
