import { useEffect, useState } from 'react'
import { CheckCircle2, Download, RefreshCcw, Settings as SettingsIcon, Sparkles, Power, FileText, Upload } from 'lucide-react'

/**
 * Settings page - includes the in-app Software Update center.
 *
 * The Updates section talks to electron-updater via the desktopAPI bridge.
 * It supports: check, download, install, progress reporting, changelog, and
 * graceful fallback messaging when running outside Electron or when the
 * update feed is not yet configured.
 */
export default function Settings() {
  const [version, setVersion] = useState('-')
  const [autoStart, setAutoStart] = useState(false)
  const [paths, setPaths] = useState(null)
  const [updateState, setUpdateState] = useState({
    status: 'idle', // idle | checking | available | not-available | downloading | downloaded | installing | error
    info: null,
    progress: 0,
    error: null,
  })
  const [manualPath, setManualPath] = useState(null)

  useEffect(() => {
    if (!window.desktopAPI) return
    let off
    Promise.all([
      window.desktopAPI.getVersion?.(),
      window.desktopAPI.getAutoStart?.(),
      window.desktopAPI.getPaths?.(),
    ]).then(([v, a, p]) => {
      if (v) setVersion(v)
      if (typeof a === 'boolean') setAutoStart(a)
      if (p) setPaths(p)
    }).catch(() => {})

    if (window.desktopAPI.onUpdateEvent) {
      off = window.desktopAPI.onUpdateEvent((evt) => {
        setUpdateState((prev) => {
          switch (evt.type) {
            case 'checking': return { ...prev, status: 'checking', error: null }
            case 'available': return { ...prev, status: 'available', info: evt.info, error: null }
            case 'not-available': return { ...prev, status: 'not-available', info: evt.info, error: null }
            case 'progress': return { ...prev, status: 'downloading', progress: Math.round(evt.percent || 0) }
            case 'downloaded': return { ...prev, status: 'downloaded', info: evt.info, progress: 100 }
            case 'error': return { ...prev, status: 'error', error: evt.message || 'Update failed' }
            default: return prev
          }
        })
      })
    }
    return () => { try { off && off() } catch (_) {} }
  }, [])

  async function checkForUpdates() {
    if (!window.desktopAPI?.checkForUpdates) return
    setUpdateState({ status: 'checking', info: null, progress: 0, error: null })
    setManualPath(null)
    try {
      const r = await window.desktopAPI.checkForUpdates()
      if (r?.error) setUpdateState((s) => ({ ...s, status: 'error', error: r.error }))
    } catch (e) {
      setUpdateState((s) => ({ ...s, status: 'error', error: String(e?.message || e) }))
    }
  }

  async function pickManualUpdate() {
    if (!window.desktopAPI?.manualUpdate) return
    try {
      const r = await window.desktopAPI.manualUpdate()
      if (r?.canceled) return
      if (r?.error) {
        setUpdateState((s) => ({ ...s, status: 'error', error: r.error }))
        return
      }
      if (r?.path) {
        setManualPath(r.path)
        setUpdateState((s) => ({ ...s, status: 'idle', error: null }))
      }
    } catch (e) {
      setUpdateState((s) => ({ ...s, status: 'error', error: String(e?.message || e) }))
    }
  }

  async function applyManualUpdate() {
    if (!manualPath || !window.desktopAPI?.runManualUpdate) return
    try {
      await window.desktopAPI.runManualUpdate(manualPath)
      // Give the installer a moment to launch before quitting
      setTimeout(() => window.desktopAPI?.quit?.(), 1500)
    } catch (e) {
      setUpdateState((s) => ({ ...s, status: 'error', error: String(e?.message || e) }))
    }
  }

  async function downloadUpdate() {
    if (!window.desktopAPI?.downloadUpdate) return
    setUpdateState((s) => ({ ...s, status: 'downloading', progress: 0, error: null }))
    try { await window.desktopAPI.downloadUpdate() } catch (e) {
      setUpdateState((s) => ({ ...s, status: 'error', error: String(e?.message || e) }))
    }
  }

  async function installUpdate() {
    if (!window.desktopAPI?.installUpdate) return
    setUpdateState((s) => ({ ...s, status: 'installing' }))
    try { await window.desktopAPI.installUpdate() } catch (e) {
      setUpdateState((s) => ({ ...s, status: 'error', error: String(e?.message || e) }))
    }
  }

  async function toggleAutoStart() {
    if (!window.desktopAPI?.setAutoStart) return
    const next = !autoStart
    await window.desktopAPI.setAutoStart(next)
    setAutoStart(next)
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <SettingsIcon className="text-primary-600" />
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-slate-500">Application preferences and software updates.</p>
        </div>
      </header>

      {/* Updates */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Software Updates</h2>
              <p className="text-sm text-slate-500">
                Current version <span className="font-mono">{version}</span>. Updates install
                without removing your data, settings, or local database.
              </p>
            </div>
          </div>
          <UpdateActions
            state={updateState}
            onCheck={checkForUpdates}
            onDownload={downloadUpdate}
            onInstall={installUpdate}
            onManual={pickManualUpdate}
            hasManualPath={!!manualPath}
            onApplyManual={applyManualUpdate}
          />
        </div>

        <UpdateStatus state={updateState} manualPath={manualPath} onClearManual={() => setManualPath(null)} />
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <Power size={18} className="text-slate-500" />
              <div>
                <p className="text-sm font-medium">Start with Windows</p>
                <p className="text-xs text-slate-500">Launch Hashmi Real Estate Builders CRM automatically when you sign in.</p>
              </div>
            </div>
            <input type="checkbox" checked={autoStart} onChange={toggleAutoStart} className="h-4 w-4" />
          </label>
        </div>
      </section>

      {/* Storage */}
      {paths && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-slate-500" />
            <h2 className="text-lg font-semibold">Local Storage</h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(paths).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}

function UpdateActions({ state, onCheck, onDownload, onInstall, onManual, hasManualPath, onApplyManual }) {
  const baseBtn = 'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  if (state.status === 'available') {
    return <button onClick={onDownload} className={`${baseBtn} bg-primary-600 text-white hover:bg-primary-700`}><Download size={16} />Download Update</button>
  }
  if (state.status === 'downloaded') {
    return <button onClick={onInstall} className={`${baseBtn} bg-emerald-600 text-white hover:bg-emerald-700`}><CheckCircle2 size={16} />Install &amp; Restart</button>
  }
  if (hasManualPath) {
    return (
      <button onClick={onApplyManual} className={`${baseBtn} bg-amber-600 text-white hover:bg-amber-700`}>
        <Upload size={16} />Run Installer &amp; Quit
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCheck} disabled={state.status === 'checking' || state.status === 'downloading'} className={`${baseBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
        <RefreshCcw size={16} className={state.status === 'checking' ? 'animate-spin' : ''} />
        Check for Updates
      </button>
      <button onClick={onManual} className={`${baseBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
        <Upload size={16} />Manual Update
      </button>
    </div>
  )
}

function translateUpdateError(err) {
  if (!err) return ''
  const raw = String(err).toLowerCase()
  if (raw.includes('err_name_not_resolved') || raw.includes('enotfound') || raw.includes('getaddrinfo')) {
    return 'Cannot reach GitHub. Please check your internet connection or try Manual Update.'
  }
  if (raw.includes('err_internet_disconnected') || raw.includes('econnrefused') || raw.includes('etimedout') || raw.includes('ehostunreach')) {
    return 'No internet connection. The application works fully offline. Connect to the internet to check for updates.'
  }
  if (raw.includes('err_cert')) {
    return 'SSL certificate error when connecting to GitHub. Please contact your administrator.'
  }
  if (raw.includes('404') || raw.includes('not found')) {
    return 'No update release found on GitHub. Make sure the release tag matches the version (e.g., v1.0.1).'
  }
  if (raw.includes('403') || raw.includes('rate limit')) {
    return 'GitHub API rate limit exceeded. Please try again later or use Manual Update.'
  }
  if (raw.includes('401') || raw.includes('unauthorized')) {
    return 'Authentication failed with GitHub. The repository may be private or your token may be invalid.'
  }
  if (raw.includes('sha') || raw.includes('checksum') || raw.includes('hash')) {
    return 'Update file integrity check failed. The downloaded file may be corrupted. Please try again or use Manual Update.'
  }
  if (raw.includes('err_')) {
    return 'GitHub connection failed. Please check your internet and try again, or use Manual Update.'
  }
  return String(err)
}

function UpdateStatus({ state, manualPath, onClearManual }) {
  const friendlyError = state.error ? translateUpdateError(state.error) : ''
  const isNetworkError = state.status === 'error' && (
    String(state.error).toLowerCase().includes('err_') ||
    String(state.error).toLowerCase().includes('github') ||
    String(state.error).toLowerCase().includes('internet') ||
    String(state.error).toLowerCase().includes('connection') ||
    String(state.error).toLowerCase().includes('network')
  )

  if (state.status === 'idle' && !manualPath) return null

  return (
    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
      {state.status === 'checking' && <p className="text-slate-600 dark:text-slate-300">Checking for updates...</p>}
      {state.status === 'not-available' && <p className="text-emerald-600">You are on the latest version.</p>}
      {state.status === 'available' && (
        <div>
          <p className="font-medium">Version {state.info?.version} is available.</p>
          {state.info?.releaseNotes && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">View changelog</summary>
              <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs dark:bg-slate-900" dangerouslySetInnerHTML={{ __html: String(state.info.releaseNotes) }} />
            </details>
          )}
        </div>
      )}
      {state.status === 'downloading' && (
        <div>
          <p className="text-slate-600 dark:text-slate-300">Downloading update... {state.progress}%</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${state.progress}%` }} />
          </div>
        </div>
      )}
      {state.status === 'downloaded' && <p className="font-medium text-emerald-600">Update ready. Click "Install &amp; Restart" to apply.</p>}
      {state.status === 'installing' && <p className="text-slate-600 dark:text-slate-300">Installing... the application will restart.</p>}
      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-red-600">{friendlyError}</p>
          {isNetworkError && (
            <div className="flex flex-wrap gap-2">
              <button onClick={onClearManual} className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                <Upload size={13} />Try Manual Update
              </button>
            </div>
          )}
        </div>
      )}
      {manualPath && (
        <div className="space-y-2">
          <p className="font-medium text-amber-700 dark:text-amber-400">Manual update selected:</p>
          <p className="break-all rounded bg-white p-2 font-mono text-xs dark:bg-slate-900">{manualPath}</p>
          <p className="text-xs text-slate-500">Click "Run Installer &amp; Quit" to launch the installer. The application will close automatically.</p>
        </div>
      )}
    </div>
  )
}
