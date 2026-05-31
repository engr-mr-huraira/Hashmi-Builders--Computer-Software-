import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Trash2 } from 'lucide-react'

/**
 * Production data table with sorting and built-in row actions.
 *
 * Props:
 *  - columns: [{ key, label, render?, export? }]
 *  - rows: array of records
 *  - actions: { onView?, onEdit?, onDelete? } - any provided action becomes a button
 *  - emptyText: shown when rows.length === 0
 */
export default function DataTable({ columns = [], rows = [], actions = null, emptyText = 'No records found' }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sort])

  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const showActions = !!actions && (actions.onView || actions.onEdit || actions.onDelete)
  const colSpan = columns.length + (showActions ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              {columns.map((column) => {
                const isSorted = sort.key === column.key
                return (
                  <th
                    key={column.key}
                    onClick={() => toggleSort(column.key)}
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {isSorted ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                    </span>
                  </th>
                )
              })}
              {showActions && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={colSpan}>{emptyText}</td>
              </tr>
            ) : sorted.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {column.render ? column.render(row) : (row[column.key] ?? '')}
                  </td>
                ))}
                {showActions && (
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      {actions.onView && (
                        <button onClick={() => actions.onView(row)} title="View" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                          <Eye size={16} />
                        </button>
                      )}
                      {actions.onEdit && (
                        <button onClick={() => actions.onEdit(row)} title="Edit" className="rounded-lg p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950">
                          <Pencil size={16} />
                        </button>
                      )}
                      {actions.onDelete && (
                        <button onClick={() => actions.onDelete(row)} title="Delete" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
