import { useState } from 'react'
import type { FormEvent } from 'react'
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

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 'var(--sp-2)', alignItems: 'end' }}>
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

        <div>
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
