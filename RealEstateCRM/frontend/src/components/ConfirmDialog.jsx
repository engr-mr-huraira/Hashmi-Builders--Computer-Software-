import { AlertTriangle } from 'lucide-react'
import Modal from './Modal.jsx'

export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, loading = false, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <button onClick={onClose} disabled={loading} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading} className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
            {loading ? 'Working...' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="flex items-start gap-3">
        {danger && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle size={20} />
          </div>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </Modal>
  )
}
