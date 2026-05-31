import { useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'

/**
 * Auto-rendered form driven by a schema.fields array.
 * Supports text, textarea, number, email, password, date, select, checkbox,
 * remote-select, and computed (read-only auto-calculated display).
 */
export default function RecordForm({ fields = [], initial = null, onSubmit, onCancel, saving = false }) {
  const isEdit = !!initial
  const [values, setValues] = useState(() => buildInitial(fields, initial))
  const [errors, setErrors] = useState({})
  const [remoteOptions, setRemoteOptions] = useState({})

  // When initial changes (edit different record), reset form
  useEffect(() => { setValues(buildInitial(fields, initial)) }, [initial])

  // (Computed fields are recalculated inside setField so no separate effect needed.)

  // Load remote-select options
  useEffect(() => {
    const remotes = fields.filter((f) => f.type === 'remote-select')
    if (remotes.length === 0) return
    let cancelled = false
    Promise.all(remotes.map(async (f) => {
      try {
        const { data } = await api.get(f.endpoint, { params: { limit: 200 } })
        const list = Array.isArray(data) ? data : (data?.data || [])
        return [f.name, list]
      } catch (_) {
        return [f.name, []]
      }
    })).then((entries) => {
      if (!cancelled) setRemoteOptions(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [fields])

  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null)

  useEffect(() => {
    if (values.sale_id) {
      let cancelled = false
      api.get(`/sales/${values.sale_id}`).then(({ data }) => {
        if (!cancelled) setSelectedSaleDetails(data)
      }).catch(() => {
        if (!cancelled) setSelectedSaleDetails(null)
      })
      return () => { cancelled = true }
    } else {
      setSelectedSaleDetails(null)
    }
  }, [values.sale_id])

  // Auto-fill total_price and colony_id from selected plot or shop
  useEffect(() => {
    const hasPriceField = fields.some((f) => f.name === 'total_price')
    if (!hasPriceField) return
    let price = null
    if (values.plot_id && remoteOptions['plot_id']) {
      const plot = remoteOptions['plot_id'].find((o) => String(o.id) === String(values.plot_id))
      if (plot && plot.total_price) price = Number(plot.total_price)
    }
    if (values.shop_id && remoteOptions['shop_id']) {
      const shop = remoteOptions['shop_id'].find((o) => String(o.id) === String(values.shop_id))
      if (shop && shop.price) price = Number(shop.price)
    }
    if (price !== null && price !== undefined) {
      setValues((prev) => {
        let next = { ...prev, total_price: price }
        for (const f of fields) {
          if (typeof f.compute === 'function') {
            next[f.name] = f.compute(next)
          }
        }
        return next
      })
    }
  }, [values.plot_id, values.shop_id, remoteOptions['plot_id'], remoteOptions['shop_id']])

  // Auto-fill colony_id when plot or shop is selected
  useEffect(() => {
    if (!fields.some((f) => f.name === 'colony_id')) return
    let colonyId = null
    if (values.plot_id && remoteOptions['plot_id']) {
      const plot = remoteOptions['plot_id'].find((o) => String(o.id) === String(values.plot_id))
      if (plot && plot.colony_id) colonyId = plot.colony_id
    }
    if (values.shop_id && remoteOptions['shop_id']) {
      const shop = remoteOptions['shop_id'].find((o) => String(o.id) === String(values.shop_id))
      if (shop && shop.colony_id) colonyId = shop.colony_id
    }
    if (colonyId !== null && colonyId !== undefined && String(values.colony_id) !== String(colonyId)) {
      setValues((prev) => ({ ...prev, colony_id: colonyId }))
    }
  }, [values.plot_id, values.shop_id, remoteOptions['plot_id'], remoteOptions['shop_id']])

  // Clear plot_id / shop_id when colony changes and they no longer belong
  useEffect(() => {
    if (!fields.some((f) => f.name === 'colony_id')) return
    setValues((prev) => {
      let next = { ...prev }
      if (values.plot_id && remoteOptions['plot_id']) {
        const plot = remoteOptions['plot_id'].find((o) => String(o.id) === String(values.plot_id))
        if (plot && plot.colony_id && String(plot.colony_id) !== String(values.colony_id)) {
          next.plot_id = ''
        }
      }
      if (values.shop_id && remoteOptions['shop_id']) {
        const shop = remoteOptions['shop_id'].find((o) => String(o.id) === String(values.shop_id))
        if (shop && shop.colony_id && String(shop.colony_id) !== String(values.colony_id)) {
          next.shop_id = ''
        }
      }
      return next
    })
  }, [values.colony_id])

  const visibleFields = useMemo(
    () => fields.filter((f) => {
      if (isEdit && f.createOnly) return false
      if (typeof f.isVisible === 'function') return f.isVisible(values)
      return true
    }),
    [fields, isEdit, values],
  )

  function setField(name, value) {
    setValues((prev) => {
      let next = { ...prev, [name]: value }
      for (const f of fields) {
        if (typeof f.compute === 'function') {
          next[f.name] = f.compute(next)
        }
      }
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function validate() {
    const errs = {}
    for (const f of visibleFields) {
      const v = values[f.name]
      if (f.required && (v === '' || v === null || v === undefined)) errs[f.name] = `${f.label} is required`
      if (f.minLength && typeof v === 'string' && v.length > 0 && v.length < f.minLength) errs[f.name] = `${f.label} must be at least ${f.minLength} characters`
      if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(String(v))) errs[f.name] = 'Invalid email'
    }
    // Sale form: at least one of plot or shop must be selected
    const hasPlotField = fields.some((f) => f.name === 'plot_id')
    const hasShopField = fields.some((f) => f.name === 'shop_id')
    if (hasPlotField && hasShopField && !values.plot_id && !values.shop_id) {
      errs['plot_id'] = 'Select a Plot or a Shop'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function submit(e) {
    e.preventDefault()
    if (!validate()) return
    // Prepare payload: drop empty optional fields, coerce numbers,
    // and omit readOnly / computed fields so server-generated values survive.
    const payload = {}
    for (const f of visibleFields) {
      if (f.readOnly || f.type === 'computed') continue
      let v = values[f.name]
      if (v === '' || v === undefined) continue
      if (f.type === 'number' && v !== null) v = Number(v)
      if (f.type === 'checkbox') v = !!v
      payload[f.name] = v
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {selectedSaleDetails && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-800 dark:border-sky-950/40 dark:bg-sky-950/20 dark:text-sky-300">
          <h4 className="font-bold uppercase tracking-wider text-xs text-sky-700 dark:text-sky-400 mb-3">Customer Purchase & Bio Data</h4>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Plot Size</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedSaleDetails.plot_size || 0} Marlas</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Payment Plan</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedSaleDetails.payment_plan || `${selectedSaleDetails.installment_months} Months`}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Price</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(selectedSaleDetails.total_price || 0)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Paid</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(selectedSaleDetails.total_paid || 0)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Remaining</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Math.max((selectedSaleDetails.total_price || 0) - (selectedSaleDetails.total_paid || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleFields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {f.label}{f.required && <span className="text-red-500">*</span>}
            </label>
            <FieldInput field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} options={remoteOptions[f.name]} values={values} />
            {errors[f.name] && <p className="mt-1 text-xs text-red-500">{errors[f.name]}</p>}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create')}
        </button>
      </div>
    </form>
  )
}

function buildInitial(fields, initial) {
  const out = {}
  for (const f of fields) {
    if (initial && initial[f.name] !== undefined && initial[f.name] !== null) {
      if (f.type === 'date') {
        const d = new Date(initial[f.name])
        out[f.name] = isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
      } else {
        out[f.name] = initial[f.name]
      }
    } else {
      if (f.type === 'date' && f.defaultToday) {
        out[f.name] = new Date().toISOString().slice(0, 10)
      } else {
        out[f.name] = f.type === 'checkbox' ? false : (f.defaultValue ?? '')
      }
    }
  }
  return out
}

function FieldInput({ field, value, onChange, options, values }) {
  const baseClass = 'input'
  if (field.type === 'computed') {
    return (
      <div className={`${baseClass} flex items-center justify-between bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>
        <span>{value || '0.00'}</span>
        <span className="text-xs text-slate-400">Auto-calculated</span>
      </div>
    )
  }
  if (field.type === 'file') {
    const hasFile = !!value && value.startsWith('data:');
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500 truncate max-w-[180px]">
            {hasFile ? '✓ File Loaded' : 'No file selected'}
          </span>
          <div className="flex items-center gap-1.5">
            {hasFile && (
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = value;
                  link.download = field.label || 'download';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="rounded bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-400"
              >
                Download / View
              </button>
            )}
            <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">
              Select File
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => onChange(evt.target.result);
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
            {hasFile && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
  if (field.type === 'textarea') {
    return <textarea className={`${baseClass} min-h-[88px]`} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
        <span className="text-slate-600 dark:text-slate-300">{field.label}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <select className={baseClass} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {(field.options || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    )
  }
  if (field.type === 'remote-select') {
    let opts = options || []
    if (typeof field.filterOptions === 'function') {
      opts = opts.filter((opt) => field.filterOptions(opt, values))
    }
    return (
      <select className={baseClass} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {opts.map((opt) => (
          <option key={opt[field.valueKey]} value={opt[field.valueKey]}>
            {field.formatLabel ? field.formatLabel(opt) : (opt[field.labelKey] || opt[field.valueKey])}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'cnic') {
    return (
      <input
        className={baseClass}
        type="text"
        value={formatCNIC(value)}
        onChange={(e) => onChange(stripCNIC(e.target.value))}
        placeholder={field.placeholder}
        maxLength={15}
        readOnly={field.readOnly}
      />
    )
  }
  if (field.type === 'phone') {
    return (
      <input
        className={baseClass}
        type="tel"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        readOnly={field.readOnly}
      />
    )
  }
  return (
    <input
      className={baseClass}
      type={field.type || 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      step={field.step}
      min={field.min}
      readOnly={field.readOnly}
    />
  )
}

function stripCNIC(raw) {
  if (!raw) return ''
  return String(raw).replace(/\D/g, '').slice(0, 13)
}

function formatCNIC(raw) {
  const digits = stripCNIC(raw)
  if (digits.length === 0) return ''
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}
