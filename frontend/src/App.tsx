import { useState } from 'react'
import { Header } from './components/Header'
import { UploadZone } from './components/UploadZone'
import { ProjectForm } from './components/ProjectForm'
import { ProcessingView } from './components/ProcessingView'
import { ResultsView } from './components/ResultsView'
import { PriceListView } from './components/PriceListView'
import type { ActiveView, AppState, ProcessResult, ProjectMeta } from './types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{
      background: 'var(--error-dim)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRight: '3px solid var(--error)',
      borderRadius: 'var(--r-md)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      fontSize: '0.875rem', color: 'var(--error)',
    }}>
      <span>⚠ {message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
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
  const [error, setError] = useState<string | null>(null)

  const handleFile = (f: File) => {
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
      })

      clearTimeout(t1)
      clearTimeout(t2)
      setProcessingStep(2)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'שגיאה לא ידועה' }))
        throw new Error((err as { detail?: string }).detail ?? `שגיאת שרת: ${response.status}`)
      }

      const data = await response.json() as ProcessResult
      setResult(data)
      setAppState('results')

    } catch (e: unknown) {
      clearTimeout(t1)
      clearTimeout(t2)
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה'
      setError(msg)
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

            {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

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
