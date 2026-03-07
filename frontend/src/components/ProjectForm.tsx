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
    <div className="flex flex-col gap-4">

      {/* File pill */}
      <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 w-fit">
        <span className="material-symbols-outlined text-primary text-[16px] leading-none select-none">description</span>
        <span className="text-sm font-bold text-primary truncate max-w-xs">{fileName}</span>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-primary/10 rounded-xl p-6 flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

          {/* Project name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              שם הפרויקט *
            </label>
            <input
              type="text"
              placeholder="לדוגמה: תעשייה אווירית מבנה 118"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              required
              className="w-full bg-background-dark border border-slate-700 rounded-lg py-2.5 px-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm font-medium"
            />
          </div>

          {/* Manager name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              מנהל הפרויקט
            </label>
            <input
              type="text"
              placeholder="לדוגמה: סתיו כהן"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className="w-full bg-background-dark border border-slate-700 rounded-lg py-2.5 px-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm font-medium"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              תאריך
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-background-dark border border-slate-700 rounded-lg py-2.5 px-4 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm font-medium"
              style={{ direction: 'ltr', textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !projectName.trim()}
          className="flex items-center justify-center gap-2 w-full bg-primary text-background-dark font-bold py-3 px-6 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[18px] spin-animation select-none">progress_activity</span>
              <span>מעבד...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px] select-none">bolt</span>
              <span>עבד שרטוט</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
