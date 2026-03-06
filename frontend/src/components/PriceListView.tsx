import { useEffect, useState, useCallback } from 'react'
import type { PriceRow } from '../types'

interface Props {
  apiUrl: string
}

const EMPTY_ROW: Omit<PriceRow, 'row'> = {
  catalog_number: '',
  item_name: '',
  unit_price: 0,
  unit: "יח'",
  manufacturer: '',
}

export function PriceListView({ apiUrl }: Props) {
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editData, setEditData] = useState<Omit<PriceRow, 'row'>>(EMPTY_ROW)
  const [isAdding, setIsAdding] = useState(false)
  const [newRowData, setNewRowData] = useState<Omit<PriceRow, 'row'>>(EMPTY_ROW)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [sortCol, setSortCol] = useState<keyof PriceRow>('catalog_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const fetchPrices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/prices`)
      if (!res.ok) throw new Error('שגיאה בטעינת המחירון')
      const data = await res.json() as { records: PriceRow[] }
      setRows(data.records)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת המחירון')
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  const handleRefreshIndex = async () => {
    setRefreshing(true)
    try {
      await fetch(`${apiUrl}/refresh-prices`, { method: 'POST' })
      await fetchPrices()
    } catch {
      setError('שגיאה בריענון המחירון')
    } finally {
      setRefreshing(false)
    }
  }

  const handleEditStart = (row: PriceRow) => {
    setEditingRow(row.row)
    setEditData({
      catalog_number: row.catalog_number,
      item_name: row.item_name,
      unit_price: row.unit_price,
      unit: row.unit,
      manufacturer: row.manufacturer,
    })
    setIsAdding(false)
  }

  const handleEditSave = async () => {
    if (editingRow === null) return
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices/${editingRow}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (!res.ok) throw new Error('שגיאה בשמירה')
      setRows(prev => prev.map(r =>
        r.row === editingRow ? { row: editingRow, ...editData } : r
      ))
      setEditingRow(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: number) => {
    if (deleteConfirm !== row) {
      setDeleteConfirm(row)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices/${row}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('שגיאה במחיקה')
      // After deletion, rows shift — refetch to get accurate row numbers
      await fetchPrices()
      setDeleteConfirm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה במחיקה')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRowData),
      })
      if (!res.ok) throw new Error('שגיאה בהוספה')
      await fetchPrices()
      setIsAdding(false)
      setNewRowData(EMPTY_ROW)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהוספה')
    } finally {
      setSaving(false)
    }
  }

  const handleSort = (col: keyof PriceRow) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = rows
    .filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        r.catalog_number.toLowerCase().includes(q) ||
        r.item_name.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv), 'he')
      return sortDir === 'asc' ? cmp : -cmp
    })

  return (
    <div style={{ paddingTop: 'var(--sp-2)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '4px' }}>ניהול מחירון</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {loading ? 'טוען...' : `${rows.length} פריטים`}
            {lastRefresh && (
              <span style={{ marginRight: '8px', fontSize: '0.75rem' }}>
                · עדכון אחרון: {lastRefresh.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={handleRefreshIndex}
            disabled={refreshing || loading}
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
            {refreshing ? 'מרענן...' : 'רענן מחירון'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { setIsAdding(true); setEditingRow(null) }}
            disabled={isAdding}
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            + הוסף פריט
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--error-dim)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRight: '3px solid var(--error)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          fontSize: '0.875rem',
          color: 'var(--error)',
          marginBottom: 'var(--sp-3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 'var(--sp-3)', position: 'relative' }}>
        <span style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          pointerEvents: 'none',
        }}>
          🔍
        </span>
        <input
          className="input"
          placeholder="חיפוש לפי מק״ט, שם מוצר, יצרן..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingRight: '36px' }}
        />
      </div>

      {/* Add new row form */}
      {isAdding && (
        <div className="card" style={{ marginBottom: 'var(--sp-3)', border: '1px solid rgba(246,201,14,0.25)', background: 'rgba(246,201,14,0.03)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)', marginBottom: 'var(--sp-2)' }}>
            הוספת פריט חדש
          </div>
          <div className="price-form-grid">
            <Field label='מק"ט' value={newRowData.catalog_number} onChange={v => setNewRowData(p => ({ ...p, catalog_number: v }))} />
            <Field label="שם מוצר" value={newRowData.item_name} onChange={v => setNewRowData(p => ({ ...p, item_name: v }))} />
            <Field label="יצרן" value={newRowData.manufacturer} onChange={v => setNewRowData(p => ({ ...p, manufacturer: v }))} />
            <Field label="יחידה" value={newRowData.unit} onChange={v => setNewRowData(p => ({ ...p, unit: v }))} />
            <Field label="מחיר" value={String(newRowData.unit_price)} onChange={v => setNewRowData(p => ({ ...p, unit_price: parseFloat(v) || 0 }))} type="number" />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--sp-2)' }}>
            <button className="btn btn-primary" onClick={handleAddSave} disabled={saving} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              {saving ? 'שומר...' : 'שמור פריט'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setIsAdding(false); setNewRowData(EMPTY_ROW) }} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              בטל
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
            <div>טוען מחירון...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
            {search ? 'לא נמצאו תוצאות לחיפוש' : 'המחירון ריק — הוסף פריטים באמצעות הכפתור למעלה'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="price-table">
              <thead>
                <tr>
                  <Th label='מק"ט' col="catalog_number" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="שם מוצר" col="item_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="יצרן" col="manufacturer" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="יחידה" col="unit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="מחיר" col="unit_price" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" />
                  <th style={{ padding: '10px 14px', width: '100px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const isEditing = editingRow === row.row
                  return (
                    <tr key={row.row} className={`price-row ${isEditing ? 'editing' : ''}`}>
                      {isEditing ? (
                        <>
                          <td style={{ padding: '6px 10px' }}>
                            <input className="input cell-input" value={editData.catalog_number} onChange={e => setEditData(p => ({ ...p, catalog_number: e.target.value }))} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input className="input cell-input" value={editData.item_name} onChange={e => setEditData(p => ({ ...p, item_name: e.target.value }))} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input className="input cell-input" value={editData.manufacturer} onChange={e => setEditData(p => ({ ...p, manufacturer: e.target.value }))} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input className="input cell-input" value={editData.unit} onChange={e => setEditData(p => ({ ...p, unit: e.target.value }))} style={{ width: '60px' }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input className="input cell-input" type="number" value={editData.unit_price} onChange={e => setEditData(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))} style={{ width: '90px', textAlign: 'left', direction: 'ltr' }} />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving} style={{ fontSize: '0.75rem', padding: '5px 10px', minHeight: 'auto' }}>
                                {saving ? '...' : 'שמור'}
                              </button>
                              <button className="btn btn-ghost" onClick={() => setEditingRow(null)} style={{ fontSize: '0.75rem', padding: '5px 8px', minHeight: 'auto' }}>
                                ✕
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="mono" style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>{row.catalog_number || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.85rem' }}>{row.item_name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-mid)' }}>{row.manufacturer || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.unit}</td>
                          <td className="mono" style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left', direction: 'ltr' }}>
                            {row.unit_price > 0 ? `₪${row.unit_price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleEditStart(row)}
                                title="ערוך"
                                style={{
                                  background: 'none',
                                  border: '1px solid var(--border-med)',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(246,201,14,0.4)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-med)' }}
                              >
                                ✏
                              </button>
                              <button
                                onClick={() => handleDelete(row.row)}
                                title={deleteConfirm === row.row ? 'לחץ שוב לאישור' : 'מחק'}
                                style={{
                                  background: deleteConfirm === row.row ? 'rgba(239,68,68,0.12)' : 'none',
                                  border: `1px solid ${deleteConfirm === row.row ? 'rgba(239,68,68,0.4)' : 'var(--border-med)'}`,
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                  color: deleteConfirm === row.row ? 'var(--error)' : 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {deleteConfirm === row.row ? '✓?' : '🗑'}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
          מציג {filtered.length} מתוך {rows.length} פריטים
        </div>
      )}

      <style>{`
        .price-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .price-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-ui);
        }
        .price-table thead tr {
          background: var(--surface-2);
          border-bottom: 1px solid var(--border-med);
        }
        .price-table thead th {
          text-align: right;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 10px 14px;
          user-select: none;
        }
        .price-row {
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .price-row:last-child { border-bottom: none; }
        .price-row:hover { background: var(--surface-2); }
        .price-row.editing { background: rgba(246,201,14,0.04); }
        .cell-input {
          min-height: 32px;
          padding: 5px 8px;
          font-size: 0.8rem;
        }
        .th-sortable {
          cursor: pointer;
        }
        .th-sortable:hover { color: var(--text); }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function Th({
  label, col, sortCol, sortDir, onSort, align = 'right',
}: {
  label: string
  col: keyof PriceRow
  sortCol: keyof PriceRow
  sortDir: 'asc' | 'desc'
  onSort: (col: keyof PriceRow) => void
  align?: 'right' | 'left'
}) {
  const active = sortCol === col
  return (
    <th
      className="th-sortable"
      onClick={() => onSort(col)}
      style={{ textAlign: align, padding: '10px 14px' }}
    >
      <span style={{ color: active ? 'var(--accent)' : undefined }}>
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </span>
    </th>
  )
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={type === 'number' ? { direction: 'ltr', textAlign: 'left' } : {}}
      />
    </div>
  )
}
