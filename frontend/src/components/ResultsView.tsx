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
  const { components, page_count, excel_quote, excel_parts } = result
  const total = components.length
  const matched = components.filter(c => c.price_found).length
  const unmatched = total - matched
  const grandTotal = components.reduce((sum, c) => sum + c.qty * c.price, 0)
  const projectSlug = projectName.replace(/\s+/g, '_').slice(0, 30)
  const dateSlug = dateStr.replace(/\//g, '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* Stat cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-2)' }}>
        {[
          { num: page_count, label: 'עמודי PDF', color: 'var(--text-mid)' },
          { num: total, label: 'רכיבים', color: 'var(--text)' },
          { num: matched, label: 'תואמו למחיר', color: 'var(--success)' },
          { num: unmatched, label: 'ללא מחיר', color: unmatched > 0 ? 'var(--warning)' : 'var(--success)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: 'var(--sp-3)' }}>
            <div style={{
              fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: s.color, lineHeight: 1, marginBottom: '4px',
            }}>
              {s.num}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {unmatched > 0 && (
        <div style={{
          background: 'var(--warning-dim)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRight: '3px solid var(--warning)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          fontSize: '0.85rem',
          color: 'var(--warning)',
          fontWeight: 500,
        }}>
          ⚠️ {unmatched} רכיבים ללא מחיר — מסומנים בצהוב בקובץ האקסל. יש למלא ידנית.
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['תיאור', 'מק"ט', 'יצרן', 'כמות', 'יחידה', 'מחיר', 'סה"כ', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: 'right', fontWeight: 600,
                    color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.05em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                    fontFamily: i >= 3 ? 'var(--font-mono)' : 'var(--font-ui)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--border)',
                  background: c.price_found ? 'transparent' : 'rgba(245,158,11,0.05)',
                }}>
                  <td style={{ padding: '9px 14px', color: 'var(--text)', maxWidth: '240px' }}>{c.description}</td>
                  <td className="table-hide-mobile" style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{c.catalog}</td>
                  <td className="table-hide-mobile" style={{ padding: '9px 14px', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{c.manufacturer}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--text)' }}>{c.qty}</td>
                  <td className="table-hide-mobile" style={{ padding: '9px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>{c.unit}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'left', direction: 'ltr', color: c.price_found ? 'var(--text)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
                    {c.price > 0 ? `₪${c.price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', textAlign: 'left', direction: 'ltr', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {c.price > 0 ? `₪${(c.qty * c.price).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {!c.price_found && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--warning)', background: 'var(--warning-dim)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        חסר מחיר
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand total */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>סה"כ לפרויקט</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
            ₪{grandTotal.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Downloads */}
      <div className="downloads-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        {[
          {
            title: 'הצעת מחיר',
            desc: '5 עמודות עם נוסחאות Excel',
            b64: excel_quote,
            filename: `הצעת_מחיר_${projectSlug}_${dateSlug}.xlsx`,
            icon: '📄',
          },
          {
            title: 'כתב חלקים',
            desc: 'רשימה מפורטת עם מק"ט ויצרן',
            b64: excel_parts,
            filename: `כתב_חלקים_${projectSlug}_${dateSlug}.xlsx`,
            icon: '📋',
          },
        ].map((dl, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dl.icon} {dl.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dl.desc}</div>
            <button
              className="btn btn-download"
              onClick={() => downloadExcel(dl.b64, dl.filename)}
            >
              ⬇ הורד Excel
            </button>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={{ textAlign: 'center', paddingTop: 'var(--sp-2)' }}>
        <button className="btn btn-ghost" onClick={onReset}>
          ↩ עבד שרטוט נוסף
        </button>
      </div>
    </div>
  )
}
