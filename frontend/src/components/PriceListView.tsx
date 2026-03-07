import { useEffect, useState, useCallback, useMemo } from 'react'
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

  useEffect(() => {
    if (deleteConfirm === null) return
    const dismiss = () => setDeleteConfirm(null)
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', dismiss) }
  }, [deleteConfirm])

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
    setEditData({ catalog_number: row.catalog_number, item_name: row.item_name, unit_price: row.unit_price, unit: row.unit, manufacturer: row.manufacturer })
    setIsAdding(false)
  }

  const handleEditSave = async () => {
    if (editingRow === null) return
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices/${editingRow}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData) })
      if (!res.ok) throw new Error('שגיאה בשמירה')
      setRows(prev => prev.map(r => r.row === editingRow ? { row: editingRow, ...editData } : r))
      setEditingRow(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleteConfirm !== row) { setDeleteConfirm(row); return }
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices/${row}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('שגיאה במחיקה')
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
      const res = await fetch(`${apiUrl}/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRowData) })
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

  const stats = useMemo(() => ({
    total: rows.length,
    withPrice: rows.filter(r => r.unit_price > 0).length,
    suppliers: new Set(rows.map(r => r.manufacturer).filter(Boolean)).size,
    totalValue: rows.reduce((s, r) => s + r.unit_price, 0),
  }), [rows])

  const filtered = rows
    .filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      return r.catalog_number.toLowerCase().includes(q) || r.item_name.toLowerCase().includes(q) || r.manufacturer.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol]
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv), 'he')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const FIELD_LABELS: Record<string, string> = {
    catalog_number: 'מק"ט',
    item_name: 'שם מוצר',
    manufacturer: 'יצרן',
    unit: 'יחידה',
    unit_price: 'מחיר',
  }

  return (
    <div className="flex flex-col gap-6 py-4">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">ניהול מחירון</h1>
          <p className="text-slate-400 text-sm">
            {loading ? 'טוען...' : `${rows.length} פריטים`}
            {lastRefresh && (
              <span className="mr-2 text-xs">
                · עדכון: {lastRefresh.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleRefreshIndex}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors text-primary disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] select-none ${refreshing ? 'spin-animation' : ''}`}>refresh</span>
            <span>{refreshing ? 'מרענן...' : 'רענן מחירון'}</span>
          </button>
          <button
            onClick={() => { setIsAdding(true); setEditingRow(null) }}
            disabled={isAdding}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl bg-primary text-background-dark hover:brightness-110 transition-all shadow-lg disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] select-none">add</span>
            <span>הוסף פריט</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'סה"כ פריטים', value: stats.total.toLocaleString('he-IL'), icon: 'category', color: 'text-primary' },
            { label: 'עם מחיר מעודכן', value: stats.withPrice.toLocaleString('he-IL'), icon: 'sell', color: 'text-success' },
            { label: 'ספקים פעילים', value: stats.suppliers.toLocaleString('he-IL'), icon: 'local_shipping', color: 'text-slate-300' },
            { label: 'ערך מלאי כולל', value: `₪${stats.totalValue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`, icon: 'payments', color: 'text-warning' },
          ].map(s => (
            <div key={s.label} className="flex flex-col gap-2 p-4 rounded-xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-colors">
              <span className="text-slate-400 text-sm font-medium">{s.label}</span>
              <div className="flex items-center justify-between gap-3">
                <span className={`mono-font text-xl sm:text-2xl font-bold ${s.color} min-w-0 truncate`}>{s.value}</span>
                <span className="material-symbols-outlined text-primary/30 select-none flex-shrink-0">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-error/5 border border-error/30 rounded-xl px-5 py-3 text-error text-sm">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] select-none">error</span>
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined text-[18px] select-none">close</span>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
          <span className="material-symbols-outlined select-none">search</span>
        </div>
        <input
          type="text"
          placeholder='חיפוש לפי מק״ט, שם מוצר, יצרן...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-primary/5 border border-primary/10 rounded-xl py-3.5 pr-12 pl-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm font-medium"
        />
      </div>

      {/* Add new row form */}
      {isAdding && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
          <p className="font-bold text-sm text-primary">הוספת פריט חדש</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['catalog_number', 'item_name', 'manufacturer', 'unit', 'unit_price'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                  {FIELD_LABELS[field]}
                </label>
                <input
                  type={field === 'unit_price' ? 'number' : 'text'}
                  value={field === 'unit_price' ? (newRowData.unit_price === 0 ? '' : newRowData.unit_price) : newRowData[field]}
                  placeholder={field === 'unit_price' ? '0' : undefined}
                  onChange={e => setNewRowData(p => ({
                    ...p,
                    [field]: field === 'unit_price' ? parseFloat(e.target.value) || 0 : e.target.value,
                  }))}
                  className="w-full bg-background-dark border border-slate-700 rounded-lg py-2 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary text-sm"
                  style={field === 'unit_price' ? { direction: 'ltr', textAlign: 'left' } : {}}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-primary text-background-dark font-bold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px] select-none">save</span>
              {saving ? 'שומר...' : 'שמור פריט'}
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewRowData(EMPTY_ROW) }}
              className="flex items-center gap-1.5 border border-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm hover:bg-slate-700/30 transition-all"
            >
              <span className="material-symbols-outlined text-[16px] select-none">close</span>
              בטל
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-primary/10 bg-primary/5 shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-4xl spin-animation text-primary select-none">progress_activity</span>
            <span className="text-sm">טוען מחירון...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <span className="material-symbols-outlined text-4xl select-none">inventory_2</span>
            <span className="text-sm">{search ? 'לא נמצאו תוצאות לחיפוש' : 'המחירון ריק — הוסף פריטים'}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-primary/10 border-b border-primary/10">
                  {([
                    { col: 'catalog_number' as keyof PriceRow, label: 'מק"ט',    hide: false },
                    { col: 'item_name'      as keyof PriceRow, label: 'שם מוצר', hide: false },
                    { col: 'manufacturer'   as keyof PriceRow, label: 'יצרן',    hide: true  },
                    { col: 'unit'           as keyof PriceRow, label: 'יחידה',   hide: true  },
                    { col: 'unit_price'     as keyof PriceRow, label: 'מחיר',    hide: false },
                  ]).map(({ col, label, hide }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`px-5 py-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary/10 transition-colors${hide ? ' table-hide-mobile' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={sortCol === col ? 'text-primary' : 'text-slate-400'}>{label}</span>
                        <span className="material-symbols-outlined text-[12px] text-slate-500 select-none">
                          {sortCol === col ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {filtered.map(row => {
                  const isEditing = editingRow === row.row
                  return (
                    <tr
                      key={row.row}
                      className={`transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-primary/5'}`}
                    >
                      {isEditing ? (
                        <>
                          {(['catalog_number', 'item_name', 'manufacturer', 'unit'] as const).map(f => (
                            <td key={f} className={`px-3 py-2${f === 'manufacturer' || f === 'unit' ? ' table-hide-mobile' : ''}`}>
                              <input
                                className="w-full bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                                value={editData[f]}
                                onChange={e => setEditData(p => ({ ...p, [f]: e.target.value }))}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-24 bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                              value={editData.unit_price}
                              onChange={e => setEditData(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                              style={{ direction: 'ltr', textAlign: 'left' }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={handleEditSave}
                                disabled={saving}
                                className="bg-primary text-background-dark font-bold px-3 py-1.5 rounded-lg text-xs hover:brightness-110 transition-all disabled:opacity-50"
                              >
                                {saving ? '...' : 'שמור'}
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="border border-slate-600 text-slate-300 px-2 py-1.5 rounded-lg text-xs hover:bg-slate-700/30 transition-all"
                              >
                                <span className="material-symbols-outlined text-[14px] select-none">close</span>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-4 mono-font text-sm font-bold text-primary">{row.catalog_number || '—'}</td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-200">{row.item_name || '—'}</td>
                          <td className="px-5 py-4 text-sm text-slate-400 table-hide-mobile">{row.manufacturer || '—'}</td>
                          <td className="px-5 py-4 text-sm table-hide-mobile">
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">{row.unit}</span>
                          </td>
                          <td className="px-5 py-4 mono-font text-sm font-bold text-slate-200" style={{ direction: 'ltr', textAlign: 'left' }}>
                            {row.unit_price > 0
                              ? `₪${row.unit_price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-slate-500">—</span>
                            }
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditStart(row)}
                                title="ערוך"
                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-[18px] select-none">edit</span>
                              </button>
                              <button
                                onClick={(e) => handleDelete(row.row, e)}
                                title={deleteConfirm === row.row ? 'לחץ שוב לאישור' : 'מחק'}
                                className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs ${
                                  deleteConfirm === row.row
                                    ? 'bg-error/10 text-error border border-error/30 px-3 font-bold'
                                    : 'text-slate-400 hover:text-error hover:bg-error/10'
                                }`}
                              >
                                {deleteConfirm === row.row ? (
                                  <>
                                    <span className="material-symbols-outlined text-[14px] select-none">check</span>
                                    אשר
                                  </>
                                ) : (
                                  <span className="material-symbols-outlined text-[18px] select-none">delete</span>
                                )}
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

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 bg-primary/5 border-t border-primary/10 flex items-center justify-between">
            <span className="text-xs mono-font text-slate-400">
              מציג {filtered.length} מתוך {rows.length} פריטים
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
