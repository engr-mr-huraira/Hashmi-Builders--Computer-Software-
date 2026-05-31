import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, Filter, Plus, Printer, RefreshCcw, Search, X } from 'lucide-react'
import api from '../api/client.js'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RecordForm from '../components/RecordForm.jsx'
import { schemaFor } from '../modules/schemas.js'
import { exportCSV, printTable } from '../utils/export.js'

const formatCell = (key, value) => {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (key.includes('date') || key.endsWith('_at')) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString()
  }
  if (typeof value === 'number' && (key.includes('price') || key.includes('amount') || key.includes('balance'))) {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ModulePage({ title, endpoint, description }) {
  const navigate = useNavigate()
  const location = useLocation()
  const schema = useMemo(() => schemaFor(endpoint), [endpoint])

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)

  const [editing, setEditing] = useState(null) // record being edited (or {} for new)
  const [viewing, setViewing] = useState(null) // record being viewed (read-only)
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Pick up ?q= from URL (Topbar global search routes here)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get('q')
    if (q !== null && q !== search) setSearch(q)
  }, [location.search])

  const load = async () => {
    setLoading(true)
    try {
      const params = { search, limit: 100 }
      const { data } = await api.get(endpoint, { params })
      let list = Array.isArray(data) ? data : (data?.data || [])
      // Apply client-side filters
      for (const [key, value] of Object.entries(filters)) {
        if (value === '' || value === undefined || value === null) continue
        list = list.filter((row) => String(row[key]) === String(value))
      }
      setRows(list)
    } catch (error) {
      toast.error(error?.response?.data?.error || `Failed to load ${title.toLowerCase()}`)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [endpoint, search])

  const columns = useMemo(() => {
    const keys = schema?.columns?.length ? schema.columns : Object.keys(rows[0] || {}).slice(0, 6)
    return keys.map((key) => ({
      key,
      label: key.replaceAll('_', ' '),
      render: (row) => formatCell(key, row[key]),
      export: (row) => formatCell(key, row[key]),
    }))
  }, [rows, schema])

  // ---- Actions ---------------------------------------------------------------
  const allow = schema?.allow || { create: false, update: false, delete: false, view: true }
  const isReadOnly = !!schema?.readOnly

  async function handleSubmit(payload) {
    setSaving(true)
    try {
      if (editing && editing.id) {
        await api.put(`${endpoint}/${editing.id}`, payload)
        toast.success(`${schema?.label || 'Record'} updated`)
      } else {
        await api.post(endpoint, payload)
        toast.success(`${schema?.label || 'Record'} created`)
      }
      setEditing(null)
      await load()
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      await api.delete(`${endpoint}/${deleting.id}`)
      toast.success(`${schema?.label || 'Record'} deleted`)
      setDeleting(null)
      await load()
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Delete failed')
    } finally {
      setRemoving(false)
    }
  }

  function clearSearch() {
    setSearch('')
    const params = new URLSearchParams(location.search)
    params.delete('q')
    navigate(`${location.pathname}${params.toString() ? '?' + params : ''}`, { replace: true })
  }

  function applyFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => { load() }, [filters])

  const baseFilename = (schema?.pluralLabel || title).toLowerCase().replace(/\s+/g, '_')

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">CRM Module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allow.create && !isReadOnly && (
            <button onClick={() => setEditing({})} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> New {schema?.label || 'Record'}
            </button>
          )}
          <button
            onClick={() => printTable({ title, subtitle: description, columns, rows })}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          ><Printer size={16} className="mr-2 inline" /> Print</button>
          <button
            onClick={() => exportCSV({ filename: `${baseFilename}.csv`, columns, rows })}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          ><FileSpreadsheet size={16} className="mr-2 inline" /> Excel</button>
          <button
            onClick={() => printTable({ title: `${title} - PDF`, subtitle: 'Use "Save as PDF" in the print dialog', columns, rows })}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          ><Download size={16} className="mr-2 inline" /> PDF</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card lg:col-span-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                className="input pl-10 pr-10"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button onClick={clearSearch} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
            </div>
            <button onClick={load} disabled={loading} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <RefreshCcw size={16} className={`mr-2 inline ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Loading...' : 'Refresh'}
            </button>
            {schema?.filters && Object.keys(schema.filters).length > 0 && (
              <button onClick={() => setShowFilters((s) => !s)} className={`rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 ${showFilters ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-200' : 'border-slate-200 dark:border-slate-700'}`}>
                <Filter size={16} className="mr-2 inline" /> Filters
              </button>
            )}
          </div>
          {showFilters && schema?.filters && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              {Object.entries(schema.filters).map(([key, options]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replaceAll('_', ' ')}</label>
                  <select className="input min-w-[160px]" value={filters[key] || ''} onChange={(e) => applyFilter(key, e.target.value)}>
                    <option value="">All</option>
                    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
              {Object.keys(filters).length > 0 && (
                <button onClick={() => setFilters({})} className="self-end rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">Clear filters</button>
              )}
            </div>
          )}
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Visible Records</p>
          <p className="mt-2 text-3xl font-bold">{rows.length}</p>
          <p className="mt-1 text-xs text-slate-500">Local-first cached data</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        actions={{
          onView: allow.view ? (row) => setViewing(row) : null,
          onEdit: allow.update && !isReadOnly ? (row) => setEditing(row) : null,
          onDelete: allow.delete && !isReadOnly ? (row) => setDeleting(row) : null,
        }}
        emptyText={`No ${title.toLowerCase()} records found`}
      />

      {/* Create / Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && editing.id ? `Edit ${schema?.label || 'Record'}` : `New ${schema?.label || 'Record'}`}
        subtitle={editing && editing.id ? `ID: ${editing.id}` : 'Fill in the details below'}
        size="lg"
      >
        {editing && (
          <RecordForm
            fields={schema?.fields || []}
            initial={editing.id ? editing : null}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* View modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`${schema?.label || 'Record'} Details`}
        size="lg"
      >
        {viewing && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(viewing).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key.replaceAll('_', ' ')}</dt>
                <dd className="mt-0.5 break-words text-sm">{formatCell(key, value) || <span className="text-slate-400">—</span>}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${schema?.label || 'Record'}?`}
        message={`This action cannot be undone. The record will be permanently removed.`}
        confirmLabel="Delete"
        danger
        loading={removing}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
