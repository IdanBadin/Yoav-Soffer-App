import { useState } from 'react'
import { Header } from './components/Header'
import { UploadZone } from './components/UploadZone'
import { ProjectForm } from './components/ProjectForm'
import { ProcessingView } from './components/ProcessingView'
import { ResultsView } from './components/ResultsView'
import { PriceListView } from './components/PriceListView'
import type { ActiveView, AppState, ProcessResult, ProjectMeta } from './types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

interface AppError {
  title: string
  message: string
  type: 'validation' | 'auth' | 'network' | 'rate' | 'server' | 'timeout'
  hint?: string
}

function parseError(e: unknown, status?: number): AppError {
  const msg = e instanceof Error ? e.message : String(e)

  if (e instanceof Error && e.name === 'AbortError') {
    return {
      type: 'timeout',
      title: 'פג תוקף הבקשה',
      message: 'העיבוד לקח יותר מדי זמן (מעל 3 דקות).',
      hint: 'ייתכן שהשרת עמוס. נסה שנית בעוד מספר דקות, או נסה קובץ PDF קטן יותר.',
    }
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
    return {
      type: 'network',
      title: 'שגיאת חיבור לשרת',
      message: 'לא ניתן להגיע לשרת העיבוד.',
      hint: 'ודא שיש חיבור לאינטרנט. אם הבעיה נמשכת, ייתכן שהשרת כבוי זמנית.',
    }
  }
  if (status === 401) {
    return {
      type: 'auth',
      title: 'שגיאת אימות',
      message: msg,
      hint: 'יש לעדכן את מפתח ה-API בהגדרות Railway.',
    }
  }
  if (status === 402) {
    return {
      type: 'auth',
      title: 'אזל הקרדיט ב-Anthropic',
      message: msg,
      hint: 'יש להוסיף קרדיטים בכתובת console.anthropic.com',
    }
  }
  if (status === 422) {
    return {
      type: 'validation',
      title: 'קובץ לא תקין',
      message: msg,
      hint: 'ודא שהקובץ הוא PDF תקין של שרטוט AutoCAD המכיל רשימת ציוד.',
    }
  }
  if (status === 429) {
    return {
      type: 'rate',
      title: 'מגבלת קריאות',
      message: msg,
      hint: 'המתן מספר שניות ונסה שנית.',
    }
  }
  if (status === 503) {
    return {
      type: 'network',
      title: 'שרת Claude AI לא זמין',
      message: msg,
      hint: 'בעיית חיבור זמנית ל-Anthropic. נסה שנית.',
    }
  }
  return {
    type: 'server',
    title: 'שגיאת שרת',
    message: msg,
    hint: 'אם הבעיה חוזרת, צור קשר עם מנהל המערכת.',
  }
}

const ERROR_STYLES: Record<AppError['type'], { border: string; bg: string; icon: string; iconColor: string }> = {
  validation: { border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.07)', icon: '⚠', iconColor: 'var(--warning)' },
  auth:       { border: 'rgba(239,68,68,0.4)',  bg: 'var(--error-dim)',      icon: '🔑', iconColor: 'var(--error)' },
  network:    { border: 'rgba(107,122,153,0.4)', bg: 'rgba(107,122,153,0.07)', icon: '⚡', iconColor: 'var(--text-muted)' },
  rate:       { border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.07)', icon: '⏱', iconColor: 'var(--warning)' },
  server:     { border: 'rgba(239,68,68,0.4)',  bg: 'var(--error-dim)',      icon: '✕',  iconColor: 'var(--error)' },
  timeout:    { border: 'rgba(107,122,153,0.4)', bg: 'rgba(107,122,153,0.07)', icon: '⏳', iconColor: 'var(--text-muted)' },
}

function ErrorDisplay({ error, onClose }: { error: AppError; onClose: () => void }) {
  const s = ERROR_STYLES[error.type]
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRight: `3px solid ${s.border}`,
      borderRadius: 'var(--r-lg)',
      padding: '16px 20px',
      display: 'flex',
      gap: '14px',
      alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{s.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: s.iconColor, marginBottom: '4px' }}>
          {error.title}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginBottom: error.hint ? '6px' : 0, wordBreak: 'break-word' }}>
          {error.message}
        </div>
        {error.hint && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
            <span style={{ flexShrink: 0 }}>›</span>
            {error.hint}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, flexShrink: 0, padding: '2px' }}
      >
        ✕
      </button>
    </div>
  )
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('main')
  const [appState, setAppState] = useState<AppState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [meta, setMeta] = useState<ProjectMeta | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  const handleFile = (f: File) => {
    // Client-side size check (50 MB)
    if (f.size > 50 * 1024 * 1024) {
      setError({
        type: 'validation',
        title: 'קובץ גדול מדי',
        message: `גודל הקובץ הוא ${(f.size / (1024 * 1024)).toFixed(1)} MB.`,
        hint: 'הגודל המקסימלי הוא 50 MB. נסה לדחוס את הקובץ או לפצל אותו.',
      })
      return
    }
    if (f.size === 0) {
      setError({ type: 'validation', title: 'קובץ ריק', message: 'הקובץ שנבחר ריק.', hint: 'ודא שהקובץ תקין ונסה שנית.' })
      return
    }
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

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000) // 3 minutes

    const t1 = setTimeout(() => setProcessingStep(1), 2000)
    const t2 = setTimeout(() => setProcessingStep(2), 5000)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_name', projectMeta.projectName)
      formData.append('manager_name', projectMeta.managerName)
      formData.append('date', projectMeta.date)

      const response = await fetch(`${API_URL}/process`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(timeout)
      setProcessingStep(2)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `שגיאת שרת ${response.status}` }))
        const detail = (err as { detail?: string }).detail ?? `שגיאת שרת: ${response.status}`
        setError(parseError(new Error(detail), response.status))
        setAppState('ready')
        return
      }

      const data = await response.json() as ProcessResult
      setResult(data)
      setAppState('results')

    } catch (e: unknown) {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(timeout)
      setError(parseError(e))
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
    setError(null)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header activeView={activeView} onViewChange={setActiveView} />
      <main className="page-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {activeView === 'prices' ? (
          <PriceListView apiUrl={API_URL} />
        ) : (
          <>
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

            {error && <ErrorDisplay error={error} onClose={() => setError(null)} />}

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
          </>
        )}
      </main>
    </div>
  )
}
