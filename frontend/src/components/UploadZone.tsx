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
