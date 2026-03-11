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
  category: '',
  cost: '',
  notes: '',
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
  const [deleteModal, setDeleteModal] = useState<{ row: number; name: string } | null>(null)
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
      category: row.category || '',
      cost: row.cost || '',
      notes: row.notes || '',
    })
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

  const handleDelete = (row: PriceRow) => {
    setDeleteModal({ row: row.row, name: row.item_name || row.catalog_number })
  }

  const confirmDelete = async () => {
    if (!deleteModal) return
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/prices/${deleteModal.row}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('שגיאה במחיקה')
      await fetchPrices()
      setDeleteModal(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה במחיקה')
      setDeleteModal(null)
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
    categories: new Set(rows.map(r => r.category).filter(Boolean)).size,
    totalValue: rows.reduce((s, r) => s + r.unit_price, 0),
  }), [rows])

  const uniqueCategories = useMemo(() =>
    [...new Set(rows.map(r => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'))
  , [rows])

  const filtered = rows
    .filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      return r.catalog_number.toLowerCase().includes(q) || r.item_name.toLowerCase().includes(q) || r.manufacturer.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol]
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv), 'he')
      return sortDir === 'asc' ? cmp : -cmp
    })

  // When search is active: flat list. When not searching: group by category.
  type ViewEntry = { type: 'header'; category: string } | { type: 'item'; row: PriceRow }
  const groupedView = useMemo((): ViewEntry[] => {
    if (search) return filtered.map(row => ({ type: 'item', row }))

    const seen = new Set<string>()
    const catOrder: string[] = []
    for (const row of filtered) {
      const cat = row.category || ''
      if (!seen.has(cat)) { seen.add(cat); catOrder.push(cat) }
    }
    const groups: Record<string, PriceRow[]> = {}
    for (const row of filtered) {
      const cat = row.category || ''
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(row)
    }
    const result: ViewEntry[] = []
    for (const cat of catOrder) {
      if (cat) result.push({ type: 'header', category: cat })
      for (const row of groups[cat]) result.push({ type: 'item', row })
    }
    return result
  }, [filtered, search])

  const FIELD_LABELS: Record<string, string> = {
    catalog_number: 'מק"ט',
    item_name: 'שם מוצר',
    category: 'קטגוריה',
    manufacturer: 'יצרן',
    unit: 'יחידה',
    unit_price: 'מחיר מכירה',
    cost: 'עלות קנייה',
    notes: 'הערות',
  }

  // Total columns: מק"ט, שם מוצר, קטגוריה, יצרן, יחידה, עלות, מחיר, הערות, פעולות = 9
  const TOTAL_COLS = 9

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
            { label: 'קטגוריות', value: stats.categories.toLocaleString('he-IL'), icon: 'folder_open', color: 'text-slate-300' },
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
          <button onClick={() => setError(null)} className="flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors">
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
          placeholder='חיפוש לפי מק״ט, שם מוצר, יצרן, קטגוריה, הערות...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-primary/5 border border-primary/10 rounded-xl py-3.5 pr-12 pl-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm font-medium"
        />
      </div>

      {/* Add new row form */}
      {isAdding && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
          <p className="font-bold text-sm text-primary">הוספת פריט חדש</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(['catalog_number', 'item_name', 'category', 'manufacturer', 'unit', 'unit_price', 'cost', 'notes'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                  {FIELD_LABELS[field]}
                </label>
                {field === 'unit_price' ? (
                  <input
                    type="number"
                    value={newRowData.unit_price === 0 ? '' : newRowData.unit_price}
                    placeholder="0"
                    onChange={e => setNewRowData(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-background-dark border border-slate-700 rounded-lg py-2 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary text-sm"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                ) : field === 'category' ? (
                  <>
                    <input
                      list="category-options"
                      value={newRowData.category}
                      onChange={e => setNewRowData(p => ({ ...p, category: e.target.value }))}
                      className="w-full bg-background-dark border border-slate-700 rounded-lg py-2 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary text-sm"
                      placeholder="בחר או הקלד..."
                    />
                    <datalist id="category-options">
                      {uniqueCategories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </>
                ) : (
                  <input
                    type="text"
                    value={newRowData[field]}
                    onChange={e => setNewRowData(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full bg-background-dark border border-slate-700 rounded-lg py-2 px-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary text-sm"
                  />
                )}
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
                    { col: 'catalog_number' as keyof PriceRow, label: 'מק"ט',          hide: false },
                    { col: 'item_name'      as keyof PriceRow, label: 'שם מוצר',       hide: false },
                    { col: 'category'       as keyof PriceRow, label: 'קטגוריה',       hide: true  },
                    { col: 'manufacturer'   as keyof PriceRow, label: 'יצרן',          hide: true  },
                    { col: 'unit'           as keyof PriceRow, label: 'יחידה',         hide: true  },
                    { col: 'cost'           as keyof PriceRow, label: 'עלות קנייה',    hide: true  },
                    { col: 'unit_price'     as keyof PriceRow, label: 'מחיר מכירה',   hide: false },
                    { col: 'notes'          as keyof PriceRow, label: 'הערות',         hide: true  },
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
                {groupedView.map((entry, idx) => {
                  if (entry.type === 'header') {
                    return (
                      <tr key={`cat-${entry.category}-${idx}`} className="bg-slate-800/60 border-y border-primary/20">
                        <td colSpan={TOTAL_COLS} className="px-5 py-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/70">
                            <span className="material-symbols-outlined text-[14px] select-none">folder_open</span>
                            {entry.category}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const row = entry.row
                  const isEditing = editingRow === row.row
                  return (
                    <tr
                      key={row.row}
                      className={`transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-primary/5'}`}
                    >
                      {isEditing ? (
                        <>
                          {(['catalog_number', 'item_name'] as const).map(f => (
                            <td key={f} className="px-3 py-2">
                              <input
                                className="w-full bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                                value={editData[f]}
                                onChange={e => setEditData(p => ({ ...p, [f]: e.target.value }))}
                              />
                            </td>
                          ))}
                          {(['category', 'manufacturer', 'unit'] as const).map(f => (
                            <td key={f} className="px-3 py-2 table-hide-mobile">
                              <input
                                className="w-full bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                                value={editData[f]}
                                onChange={e => setEditData(p => ({ ...p, [f]: e.target.value }))}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 table-hide-mobile">
                            <input
                              type="text"
                              className="w-full bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                              value={editData.cost}
                              onChange={e => setEditData(p => ({ ...p, cost: e.target.value }))}
                              placeholder="0"
                              style={{ direction: 'ltr', textAlign: 'left' }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-24 bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                              value={editData.unit_price}
                              onChange={e => setEditData(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                              style={{ direction: 'ltr', textAlign: 'left' }}
                            />
                          </td>
                          <td className="px-3 py-2 table-hide-mobile">
                            <input
                              type="text"
                              className="w-full bg-background-dark border border-slate-600 rounded-lg py-1.5 px-3 text-slate-100 focus:outline-none focus:border-primary text-sm"
                              value={editData.notes}
                              onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={handleEditSave}
                                disabled={saving}
                                className="flex items-center justify-center bg-primary text-background-dark font-bold px-3 py-1.5 rounded-lg text-xs hover:brightness-110 transition-all disabled:opacity-50"
                              >
                                {saving ? '...' : 'שמור'}
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="flex items-center justify-center border border-slate-600 text-slate-300 px-2 py-1.5 rounded-lg text-xs hover:bg-slate-700/30 transition-all"
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
                          <td className="px-5 py-4 text-sm text-slate-300 table-hide-mobile">{row.category || '—'}</td>
                          <td className="px-5 py-4 text-sm text-slate-400 table-hide-mobile">{row.manufacturer || '—'}</td>
                          <td className="px-5 py-4 text-sm table-hide-mobile">
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">{row.unit}</span>
                          </td>
                          <td className="px-5 py-4 mono-font text-sm text-slate-400 table-hide-mobile" style={{ direction: 'ltr', textAlign: 'left' }}>
                            {row.cost
                              ? <span className="text-slate-300">{row.cost}</span>
                              : <span className="text-slate-600">—</span>
                            }
                          </td>
                          <td className="px-5 py-4 mono-font text-sm font-bold text-slate-200" style={{ direction: 'ltr', textAlign: 'left' }}>
                            {row.unit_price > 0
                              ? `₪${row.unit_price.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-slate-500">—</span>
                            }
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400 table-hide-mobile max-w-[180px] truncate">
                            {row.notes || <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditStart(row)}
                                title="ערוך"
                                className="flex items-center justify-center p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-[18px] select-none">edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(row)}
                                title="מחק"
                                className="flex items-center justify-center p-2 rounded-lg transition-all text-slate-400 hover:text-error hover:bg-error/10"
                              >
                                <span className="material-symbols-outlined text-[18px] select-none">delete</span>
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

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-error/30 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-error text-2xl select-none">warning</span>
              <h2 className="text-lg font-bold text-slate-100">אישור מחיקה</h2>
            </div>
            <p className="text-slate-300 text-sm mb-1">האם אתה בטוח שברצונך למחוק את הפריט:</p>
            <p className="text-primary font-bold text-sm mb-6 truncate">{deleteModal.name}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex items-center justify-center px-4 py-2 text-sm border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700/30 transition-all"
              >
                בטל
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-error text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px] select-none">delete</span>
                {saving ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
