import type { ProcessResult } from '../types'

interface Props {
  result: ProcessResult
  projectName: string
  dateStr: string
  onReset: () => void
}

function b64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

function downloadExcel(b64: string, filename: string) {
  const bytes = b64ToBytes(b64)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsView({ result, projectName, dateStr, onReset }: Props) {
  const { components, page_count, excel_quote, excel_parts, boq_mode } = result
  const total = components.length
  const matched = components.filter(c => c.price_found).length
  const unmatched = total - matched
  const grandTotal = components.reduce((sum, c) => sum + c.qty * c.price, 0)
  const projectSlug = projectName.replace(/\s+/g, '_').slice(0, 30)
  const dateSlug = dateStr.replace(/\//g, '-')

  return (
    <div className="space-y-6 py-4">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">{boq_mode ? 'תוצאות כתב כמויות' : 'תוצאות ניתוח שרטוט'}</h1>
          <p className="text-slate-400 text-sm">{projectName} · {dateStr}</p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 bg-primary text-background-dark font-bold px-5 py-2.5 rounded-lg hover:brightness-110 transition-all"
        >
          <span className="material-symbols-outlined text-[18px] select-none">add_circle</span>
          <span>{boq_mode ? 'עבד קובץ נוסף' : 'עבד שרטוט נוסף'}</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          !boq_mode ? { label: 'עמודי PDF', value: page_count, color: 'text-primary', warn: false } : null,
          { label: boq_mode ? 'פריטים בכתב' : 'רכיבים שזוהו', value: total, color: 'text-primary', warn: false },
          { label: 'תואמו למחיר', value: matched, color: 'text-success', warn: false },
          { label: 'ללא מחיר', value: unmatched, color: unmatched > 0 ? 'text-warning' : 'text-success', warn: unmatched > 0 },
        ] as const).filter((s): s is NonNullable<typeof s> => s !== null).map((s, i) => (
          <div
            key={i}
            className={`p-6 rounded-xl border ${s.warn ? 'bg-warning/5 border-warning/30' : 'bg-primary/5 border-primary/10'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-medium ${s.warn ? 'text-warning' : 'text-slate-400'}`}>{s.label}</p>
              {s.warn && <span className="material-symbols-outlined text-warning text-sm select-none">warning</span>}
            </div>
            <p className={`mono-font text-4xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {unmatched > 0 && (
        <div className="flex items-center gap-3 bg-warning/5 border border-warning/30 rounded-xl px-5 py-3 text-warning text-sm font-medium">
          <span className="material-symbols-outlined text-[18px] select-none flex-shrink-0">warning</span>
          <span>{unmatched} רכיבים ללא מחיר — מסומנים בצהוב בקובץ האקסל. יש למלא ידנית.</span>
        </div>
      )}

      {/* Data table */}
      <div className="bg-primary/5 border border-primary/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-primary/10 border-b border-primary/10 text-slate-300 text-sm font-semibold">
                {([
                  { h: 'תיאור',     hide: false },
                  { h: 'מק"ט',      hide: true  },
                  { h: 'יצרן',      hide: true  },
                  { h: 'כמות',      hide: false },
                  { h: 'יחידה',     hide: true  },
                  { h: "מחיר יח'",  hide: false },
                  { h: 'סה"כ',      hide: false },
                  { h: 'סטטוס',     hide: false },
                ] as const).map(({ h, hide }, i) => (
                  <th key={i} className={`px-5 py-4 font-semibold${hide ? ' table-hide-mobile' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-primary/5">
              {components.map((c, i) => (
                <tr
                  key={i}
                  className={c.price_found ? 'hover:bg-primary/5 transition-colors' : 'bg-warning/5'}
                >
                  <td className="px-5 py-4 font-medium text-slate-200 max-w-[220px]">{c.description}</td>
                  <td className="px-5 py-4 mono-font text-xs text-primary table-hide-mobile whitespace-nowrap">{c.catalog || '—'}</td>
                  <td className="px-5 py-4 text-slate-400 table-hide-mobile whitespace-nowrap">{c.manufacturer || '—'}</td>
                  <td className="px-5 py-4 mono-font text-center text-slate-200">{c.qty}</td>
                  <td className="px-5 py-4 text-center text-slate-400 table-hide-mobile">{c.unit}</td>
                  <td className="px-5 py-4 mono-font whitespace-nowrap" style={{ direction: 'ltr', textAlign: 'left' }}>
                    <span className={c.price_found ? 'text-slate-200' : 'text-warning'}>
                      {c.price > 0 ? `₪${c.price.toFixed(2)}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 mono-font font-semibold whitespace-nowrap" style={{ direction: 'ltr', textAlign: 'left' }}>
                    {c.price > 0 ? `₪${(c.qty * c.price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {c.price_found ? (
                      <span className="inline-flex items-center justify-center bg-success/20 text-success px-3 py-1 rounded-full text-xs font-bold">תקין</span>
                    ) : (
                      <span className="inline-flex items-center justify-center bg-warning/20 text-warning px-3 py-1 rounded-full text-xs font-bold">חסר מחיר</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand total bar */}
      <div className="bg-primary flex flex-wrap items-center justify-between gap-2 px-5 sm:px-8 py-4 rounded-xl shadow-lg">
        <span className="text-background-dark font-bold text-base sm:text-lg">סה&quot;כ משוער לפרויקט</span>
        <div className="flex items-baseline gap-2" style={{ direction: 'ltr' }}>
          <span className="text-background-dark/70 text-sm font-bold">₪</span>
          <span className="mono-font text-2xl sm:text-3xl font-bold text-background-dark">
            {grandTotal.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Downloads */}
      <div>
        <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary select-none">download</span>
          הורדת דוחות וסיכומים
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: boq_mode ? 'כתב כמויות ממולא' : 'הצעת מחיר',
              desc: boq_mode ? 'הקובץ המקורי עם מחירים מולאו — פריטים ללא מחיר מסומנים בצהוב' : '5 עמודות עם נוסחאות Excel',
              b64: excel_quote,
              filename: boq_mode ? `כתב_כמויות_ממולא_${projectSlug}_${dateSlug}.xlsx` : `הצעת_מחיר_${projectSlug}_${dateSlug}.xlsx`,
              icon: boq_mode ? 'price_check' : 'description',
              iconBg: 'bg-blue-900/30 text-blue-400',
            },
            !boq_mode ? {
              title: 'כתב חלקים (BOM)',
              desc: 'פירוט טכני מלא עם מק"ט ויצרן',
              b64: excel_parts,
              filename: `כתב_חלקים_${projectSlug}_${dateSlug}.xlsx`,
              icon: 'list_alt',
              iconBg: 'bg-success/10 text-success',
            } : null,
          ].filter((dl): dl is NonNullable<typeof dl> => dl !== null).map((dl, i) => (
            <div
              key={i}
              className="bg-primary/5 border border-primary/10 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dl.iconBg}`}>
                  <span className="material-symbols-outlined text-3xl select-none">{dl.icon}</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">{dl.title}</h4>
                  <p className="text-slate-400 text-xs mt-0.5">{dl.desc}</p>
                </div>
              </div>
              <button
                onClick={() => downloadExcel(dl.b64, dl.filename)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-background-dark border border-primary/30 text-primary px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] select-none">download</span>
                <span>הורד Excel</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reset link */}
      <div className="flex justify-center border-t border-primary/10 pt-8 pb-4">
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors font-medium"
        >
          <span className="material-symbols-outlined select-none">restart_alt</span>
          <span>נקה הכל והתחל מחדש</span>
        </button>
      </div>

    </div>
  )
}
