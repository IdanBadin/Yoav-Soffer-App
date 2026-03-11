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

function ErrorDisplay({ error, onClose }: { error: AppError; onClose: () => void }) {
  const typeStyles: Record<AppError['type'], { border: string; text: string; icon: string }> = {
    validation: { border: 'border-warning/40 bg-warning/5',       text: 'text-warning',    icon: 'warning' },
    auth:       { border: 'border-error/40 bg-error/5',           text: 'text-error',      icon: 'key' },
    network:    { border: 'border-slate-600/40 bg-slate-800/30',  text: 'text-slate-400',  icon: 'wifi_off' },
    rate:       { border: 'border-warning/40 bg-warning/5',       text: 'text-warning',    icon: 'timer' },
    server:     { border: 'border-error/40 bg-error/5',           text: 'text-error',      icon: 'error' },
    timeout:    { border: 'border-slate-600/40 bg-slate-800/30',  text: 'text-slate-400',  icon: 'hourglass_empty' },
  }
  const s = typeStyles[error.type]
  return (
    <div className={`flex gap-4 items-start border rounded-xl px-5 py-4 ${s.border}`}>
      <span className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 select-none ${s.text}`}>{s.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm mb-1 ${s.text}`}>{error.title}</p>
        <p className="text-slate-400 text-sm break-words">{error.message}</p>
        {error.hint && (
          <p className="text-slate-500 text-xs mt-1.5 flex gap-1">
            <span>›</span><span>{error.hint}</span>
          </p>
        )}
      </div>
      <button onClick={onClose} className="flex items-center justify-center flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors">
        <span className="material-symbols-outlined text-[18px] select-none">close</span>
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
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minutes (multi-page PDFs)

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
    <div className="min-h-screen flex flex-col bg-background-dark">
      <Header activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {activeView === 'prices' ? (
          <PriceListView apiUrl={API_URL} />
        ) : (
          <>
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
      <footer className="py-6 border-t border-primary/10 text-center">
        <p className="text-xs text-slate-500">כל הזכויות שמורות לי. סופר מערכות חשמל בע&quot;מ © {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
