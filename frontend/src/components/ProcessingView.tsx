import { useEffect, useState } from 'react'

interface Props {
  step: number
}

const STEP_DEFS = [
  {
    label: 'קורא קובץ PDF',
    sublabel: 'מחלץ טקסט, טבלאות ונתונים',
    icon: 'picture_as_pdf',
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
    icon: 'psychology',
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
    icon: 'table_chart',
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
    <div className="max-w-2xl mx-auto w-full space-y-6 py-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-mono font-medium text-slate-100">מעבד שרטוט...</h1>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-primary/20 text-primary text-sm mono-font rounded-full border border-primary/30">
              {Math.min(Math.round(progress), 99)}% הושלם
            </span>
            <span className="text-slate-400 text-sm">{STEP_DEFS[step]?.sublabel}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-primary/10 rounded-full h-1 overflow-hidden">
        <div
          className="shimmer h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(progress, 99)}%` }}
        />
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {STEP_DEFS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div
              key={i}
              className={[
                'flex items-center justify-between p-5 rounded-xl border transition-all',
                done  ? 'bg-success/5 border-success/20' :
                active ? 'bg-primary/5 border-primary/30' :
                'bg-slate-800/20 border-slate-700/30 opacity-60',
              ].join(' ')}
            >
              <div className="flex items-center gap-4">
                <div className={[
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  done  ? 'bg-success/20 text-success' :
                  active ? 'bg-primary/20 text-primary' :
                  'bg-slate-700/20 text-slate-500',
                ].join(' ')}>
                  {done ? (
                    <span className="material-symbols-outlined text-[20px] select-none">check_circle</span>
                  ) : active ? (
                    <span className="material-symbols-outlined text-[20px] spin-animation select-none">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[20px] select-none">{s.icon}</span>
                  )}
                </div>

                <div>
                  <p className={`font-semibold text-sm ${done ? 'text-success' : active ? 'text-primary' : 'text-slate-400'}`}>
                    {s.label}
                  </p>
                  {active && (
                    <p className="text-xs text-primary/60 mono-font flex items-center gap-1 mt-0.5">
                      <span>›</span>
                      <span className="truncate max-w-[280px]">{currentMsg}</span>
                      <span className="blink-cursor">█</span>
                    </p>
                  )}
                  {done && (
                    <p className="text-xs text-success/70 mt-0.5">{s.doneLabel}</p>
                  )}
                </div>
              </div>

              {active && step === 1 && elapsed > 0 && (
                <span className="text-xs mono-font text-slate-400 bg-background-dark border border-slate-700 rounded px-2 py-1 flex-shrink-0">
                  {elapsed}s
                </span>
              )}
              {active && step !== 1 && (
                <div className="flex gap-1 flex-shrink-0">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Terminal log */}
      <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
        <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-success/80" />
          </div>
          <span className="text-[10px] text-slate-400 mono-font uppercase tracking-widest">לוג מערכת</span>
        </div>
        <div className="bg-black p-5 mono-font text-sm leading-relaxed min-h-[120px] flex flex-col justify-end gap-1.5">
          {[...logLines, currentMsg].slice(-4).map((line, i, arr) => (
            <div
              key={i}
              className="flex gap-3"
              style={{ opacity: i === arr.length - 1 ? 1 : 0.35 + (i / arr.length) * 0.45 }}
            >
              <span className="text-primary/80 select-none">$</span>
              <span className={i === arr.length - 1 ? 'text-slate-200' : 'text-slate-400'}>
                {line}
              </span>
              {i === arr.length - 1 && (
                <span className="blink-cursor text-primary">█</span>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
