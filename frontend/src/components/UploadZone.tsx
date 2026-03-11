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
    if (!file) return
    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf') || name.endsWith('.xlsx')) onFile(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div className="flex flex-col items-center text-center gap-12 py-8">

      {/* Hero heading */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-100 leading-tight">
          עיבוד שרטוטים אוטומטי
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          העלה שרטוט AutoCAD PDF וקבל הצעת מחיר וכתב חלקים מוכנים תוך שניות.
        </p>
      </div>

      {/* Drop zone with corner brackets */}
      <div className="w-full relative group">
        {/* Corner brackets */}
        <div className={`absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 rounded-tr-lg transition-opacity ${dragging ? 'border-primary opacity-100' : 'border-primary opacity-40 group-hover:opacity-100'}`} />
        <div className={`absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg transition-opacity ${dragging ? 'border-primary opacity-100' : 'border-primary opacity-40 group-hover:opacity-100'}`} />
        <div className={`absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 rounded-br-lg transition-opacity ${dragging ? 'border-primary opacity-100' : 'border-primary opacity-40 group-hover:opacity-100'}`} />
        <div className={`absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 rounded-bl-lg transition-opacity ${dragging ? 'border-primary opacity-100' : 'border-primary opacity-40 group-hover:opacity-100'}`} />

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            'border-2 border-dashed rounded-xl p-8 sm:p-16 flex flex-col items-center gap-6 cursor-pointer transition-all',
            dragging
              ? 'border-primary bg-primary/10'
              : 'border-primary/30 hover:border-primary/60 hover:bg-primary/5',
          ].join(' ')}
        >
          {/* Upload icon */}
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border transition-all ${dragging ? 'bg-primary/20 border-primary/40' : 'bg-primary/10 border-primary/20'}`}>
            <span className="material-symbols-outlined text-4xl sm:text-5xl text-primary select-none" style={{ fontVariationSettings: "'FILL' 1" }}>
              {dragging ? 'download' : 'cloud_upload'}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
              {dragging ? 'שחרר כדי להעלות' : 'גרור קובץ PDF או Excel לכאן'}
            </h3>
            <p className="text-slate-400">
              {dragging ? 'שרטוט AutoCAD (PDF) או כתב כמויות (Excel)' : 'או לחץ לבחירת קובץ מהמחשב'}
            </p>
          </div>

          {/* Tag badges */}
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            {['PDF / Excel', 'שרטוטי AutoCAD', 'כתב כמויות'].map(tag => (
              <span
                key={tag}
                className="mono-font px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      </div>

      {/* How it works */}
      <div className="w-full space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-primary/20" />
          <h2 className="text-base font-bold text-slate-400 uppercase tracking-widest px-4">
            איך זה עובד
          </h2>
          <div className="h-px flex-1 bg-primary/20" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: '01', title: 'העלאת קובץ', desc: 'שרטוט AutoCAD (PDF) לחילוץ ציוד, או כתב כמויות (Excel) למילוי מחירים', icon: 'upload_file' },
            { num: '02', title: 'ניתוח Claude AI', desc: 'בינה מלאכותית מחלצת רכיבים ומתאימה כל פריט למחירון החברה', icon: 'psychology' },
            { num: '03', title: 'Excel מוכן להגשה', desc: 'הצעת מחיר ממולאת עם מחירים מעודכנים, מוכנה להגשה ללקוח', icon: 'table_view' },
          ].map(step => (
            <div
              key={step.num}
              className="bg-primary/5 border border-primary/10 rounded-xl p-8 space-y-4 hover:border-primary/30 transition-all text-right"
            >
              <div className="flex justify-between items-start">
                <span className="mono-font text-3xl font-black text-primary/30">{step.num}</span>
                <span className="material-symbols-outlined text-primary text-3xl select-none">{step.icon}</span>
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-slate-100">{step.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
