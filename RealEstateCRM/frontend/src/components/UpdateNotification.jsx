import React, { useEffect, useMemo, useState } from 'react'

const initialState = {
  visible: false,
  status: 'idle', // 'available' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'error'
  info: null,
  message: '',
  percent: 0,
  fromVersion: null,
  toVersion: null,
}

function formatReleaseNotes(notes) {
  if (!notes) return 'New version is available with better features, fixes, and performance improvements.'
  if (Array.isArray(notes)) return notes.map((item) => item.note || item).filter(Boolean).join('\n')
  if (typeof notes === 'string') return notes.replace(/<[^>]+>/g, '').trim()
  return 'New version is available with better features, fixes, and performance improvements.'
}

export default function UpdateNotification() {
  const [update, setUpdate] = useState(initialState)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.desktopAPI?.onUpdateEvent) return undefined

    const off = window.desktopAPI.onUpdateEvent((payload) => {
      if (!payload?.type) return

      if (payload.type === 'available') {
        setUpdate({
          ...initialState,
          visible: true,
          status: 'available',
          info: payload.info || null,
          message: 'A new version is ready to download.',
          toVersion: payload.info?.version || null,
        })
        return
      }

      if (payload.type === 'progress') {
        setUpdate((current) => ({
          ...current,
          visible: true,
          status: 'downloading',
          message: 'Downloading update...',
          percent: Math.round(payload.percent || 0),
        }))
        return
      }

      if (payload.type === 'downloaded') {
        setUpdate((current) => ({
          ...current,
          visible: true,
          status: 'downloaded',
          info: payload.info || current.info,
          message: 'Update downloaded. Click "Restart and Install" to apply.',
          percent: 100,
          toVersion: payload.info?.version || current.toVersion,
        }))
        return
      }

      if (payload.type === 'installed') {
        setBusy(false)
        setUpdate({
          ...initialState,
          visible: true,
          status: 'installed',
          fromVersion: payload.fromVersion || null,
          toVersion: payload.toVersion || null,
          message: `Successfully updated from v${payload.fromVersion || '?'} to v${payload.toVersion || '?'}. All your data is intact.`,
        })
        return
      }

      if (payload.type === 'error') {
        setBusy(false)
        // Only surface errors when the popup is already visible (i.e. the user
        // had previously been told an update was available and started a
        // download). Otherwise this is a background silent-check failure
        // (e.g. no internet, DNS issue, server unreachable) and must NOT
        // pop up a red 'Update Failed' card unprompted.
        setUpdate((current) => {
          if (!current.visible) return current
          return {
            ...current,
            status: 'error',
            message: payload.message || 'Update failed. Please try again later.',
          }
        })
      }
    })

    // Note: we deliberately do NOT call checkForUpdates() here. The main
    // process already runs a silent check on startup; calling again from
    // the renderer would duplicate work and surface duplicate error events.

    return () => {
      try { off && off() } catch (_) {}
    }
  }, [])

  const notes = useMemo(() => formatReleaseNotes(update.info?.releaseNotes), [update.info])

  const handlePrimary = async () => {
    if (busy) return

    if (update.status === 'installed') {
      setUpdate({ ...initialState })
      return
    }

    if (update.status === 'downloaded') {
      setBusy(true)
      setUpdate((current) => ({
        ...current,
        status: 'installing',
        message: 'Restarting application to apply the update. Your data is safe.',
      }))
      try {
        const result = await window.desktopAPI?.installUpdate?.()
        if (result?.error) {
          setBusy(false)
          setUpdate((current) => ({
            ...current,
            status: 'error',
            message: `Could not start the installer: ${result.error}`,
          }))
        }
      } catch (e) {
        setBusy(false)
        setUpdate((current) => ({
          ...current,
          status: 'error',
          message: `Install failed: ${e.message || e}`,
        }))
      }
      return
    }

    if (update.status === 'error') {
      // Retry full flow.
      setBusy(true)
      const result = await window.desktopAPI?.downloadUpdate?.()
      if (result?.error) {
        setBusy(false)
        setUpdate((current) => ({ ...current, status: 'error', message: result.error }))
      }
      return
    }

    setBusy(true)
    setUpdate((current) => ({
      ...current,
      status: 'downloading',
      message: 'Starting download...',
      percent: current.percent || 0,
    }))
    const result = await window.desktopAPI?.downloadUpdate?.()
    if (result?.error) {
      setBusy(false)
      setUpdate((current) => ({ ...current, status: 'error', message: result.error }))
    }
  }

  if (!update.visible) return null

  const isSuccess = update.status === 'installed'
  const isError = update.status === 'error'
  const isBusyState = update.status === 'downloading' || update.status === 'installing' || update.status === 'downloaded'

  const headerGradient = isSuccess
    ? 'from-emerald-600 to-emerald-900'
    : isError
      ? 'from-rose-600 to-slate-900'
      : 'from-blue-700 to-slate-900'

  const headerLabel = isSuccess
    ? 'Update Installed'
    : isError
      ? 'Update Failed'
      : update.status === 'downloading'
        ? 'Downloading Update'
        : update.status === 'downloaded'
          ? 'Update Ready'
          : update.status === 'installing'
            ? 'Restarting...'
            : 'Update Available'

  const primaryLabel = isSuccess
    ? 'Got it'
    : isError
      ? 'Retry Download'
      : update.status === 'downloading'
        ? `Downloading ${update.percent}%`
        : update.status === 'downloaded'
          ? 'Restart and Install'
          : update.status === 'installing'
            ? 'Restarting...'
            : 'Download & Install'

  const primaryDisabled = busy || isBusyState

  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900">
      <div className={`bg-gradient-to-r ${headerGradient} px-5 py-4 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{headerLabel}</p>
            <h3 className="mt-1 text-lg font-bold">Hashmi Real Estate Builders</h3>
          </div>
          {!isBusyState && (
            <button
              type="button"
              className="rounded-full px-2 py-1 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              onClick={() => setUpdate((current) => ({ ...current, visible: false }))}
              aria-label="Dismiss update notification"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {isSuccess ? (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Successfully updated to v{update.toVersion || '?'}
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{update.message}</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Version {update.toVersion || update.info?.version || 'new'} is available
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{update.message}</p>
            </div>

            {update.status === 'available' && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {notes}
              </div>
            )}

            {(update.status === 'downloading' || update.status === 'downloaded' || update.status === 'installing') && (
              <div>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                  <span>
                    {update.status === 'installing'
                      ? 'Preparing restart...'
                      : update.status === 'downloaded'
                        ? 'Ready to restart'
                        : 'Downloading'}
                  </span>
                  <span>{update.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${update.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Your data is safe. The PostgreSQL database and saved files are preserved across updates.
                </p>
              </div>
            )}

            {isError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {update.message}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          {!isBusyState && !isSuccess && (
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setUpdate((current) => ({ ...current, visible: false }))}
            >
              Later
            </button>
          )}
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : isError ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={handlePrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
