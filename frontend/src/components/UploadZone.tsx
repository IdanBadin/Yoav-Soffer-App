import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {/* Upload drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          textAlign: 'center',
          cursor: 'pointer',
          padding: 'var(--sp-8) var(--sp-4)',
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-med)'}`,
          borderRadius: 'var(--r-xl)',
          background: dragging
            ? 'rgba(246,201,14,0.06)'
            : 'linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Corner accents */}
        <span style={{ position: 'absolute', top: '12px', right: '12px', color: dragging ? 'var(--accent)' : 'var(--border-med)', fontSize: '1rem', lineHeight: 1, transition: 'color 0.2s' }}>◤</span>
        <span style={{ position: 'absolute', top: '12px', left: '12px', color: dragging ? 'var(--accent)' : 'var(--border-med)', fontSize: '1rem', lineHeight: 1, transition: 'color 0.2s' }}>◥</span>
        <span style={{ position: 'absolute', bottom: '12px', right: '12px', color: dragging ? 'var(--accent)' : 'var(--border-med)', fontSize: '1rem', lineHeight: 1, transition: 'color 0.2s' }}>◣</span>
        <span style={{ position: 'absolute', bottom: '12px', left: '12px', color: dragging ? 'var(--accent)' : 'var(--border-med)', fontSize: '1rem', lineHeight: 1, transition: 'color 0.2s' }}>◢</span>

        {/* Icon */}
        <div style={{
          width: '72px', height: '72px',
          background: dragging ? 'rgba(246,201,14,0.15)' : 'var(--accent-dim)',
          border: `1.5px solid ${dragging ? 'rgba(246,201,14,0.5)' : 'rgba(246,201,14,0.2)'}`,
          borderRadius: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--sp-3)',
          transition: 'all 0.2s ease',
          boxShadow: dragging ? '0 0 24px rgba(246,201,14,0.2)' : 'none',
        }}>
          {dragging ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="8,17 12,21 16,17" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9,15 12,12 15,15"/>
            </svg>
          )}
        </div>

        <div style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          {dragging ? 'שחרר כדי להעלות' : 'גרור קובץ PDF לכאן'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-3)' }}>
          {dragging ? 'קובץ PDF של שרטוט AutoCAD' : 'או לחץ לבחירת קובץ מהמחשב'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {['PDF בלבד', 'שרטוטי AutoCAD', 'כל גודל'].map(tag => (
            <span key={tag} style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '3px 10px',
              fontFamily: 'var(--font-mono)',
            }}>
              {tag}
            </span>
          ))}
        </div>

        <input ref={inputRef} type="file" accept=".pdf" onChange={handleChange} style={{ display: 'none' }} />
      </div>

      {/* How it works */}
      <div>
        <div className="section-label" style={{ marginBottom: 'var(--sp-2)' }}>איך זה עובד</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            {
              num: '01',
              title: 'העלאת שרטוט',
              desc: 'העלה קובץ PDF של שרטוט AutoCAD עם רשימת הציוד',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
              ),
            },
            {
              num: '02',
              title: 'ניתוח Claude AI',
              desc: 'בינה מלאכותית מחלצת את כל הרכיבים, יצרנים ומספרי קטלוג',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
              ),
            },
            {
              num: '03',
              title: 'Excel מוכן להגשה',
              desc: 'הצעת מחיר וכתב חלקים עם מחירים מעודכנים, מוכנים להגשה ללקוח',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              ),
            },
          ].map(step => (
            <div key={step.num} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: 'var(--sp-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(246,201,14,0.2)',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)',
                }}>
                  {step.icon}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--border-med)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}>
                  {step.num}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>{step.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
