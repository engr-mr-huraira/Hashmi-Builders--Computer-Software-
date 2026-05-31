import { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuthStore } from '../store/authStore.js'

// Hardcoded operator credentials. The system password gate (LockScreen)
// already authenticates the human at the desktop; once unlocked, we silently
// sign in as the local admin so the user is taken straight to the dashboard
// without a second Sign-in page.
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'Bin@naseer$4300'

export default function BootScreen({ onReady }) {
  const [phase, setPhase] = useState('starting')
  const [message, setMessage] = useState('Starting Hashmi Real Estate Builders...')
  const [progress, setProgress] = useState(8)
  const [errorDetail, setErrorDetail] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let progressTimer

    async function resolveBaseURL() {
      try {
        if (window.desktopAPI && window.desktopAPI.getBackendPort) {
          const port = await window.desktopAPI.getBackendPort()
          return `http://127.0.0.1:${port}/api`
        }
      } catch (_) {}
      return '/api'
    }

    async function ping(baseURL) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 1500)
      try {
        const res = await fetch(`${baseURL}/health`, { signal: ctrl.signal })
        return res.ok
      } catch (_) { return false } finally { clearTimeout(t) }
    }

    async function boot() {
      setPhase('connecting')
      setMessage('Connecting to local services...')
      const baseURL = await resolveBaseURL()
      const startedAt = Date.now()
      const timeoutMs = 30000
      progressTimer = setInterval(() => setProgress((p) => (p < 90 ? p + 1 : p)), 250)
      while (!cancelled && Date.now() - startedAt < timeoutMs) {
        setAttempt((a) => a + 1)
        if (await ping(baseURL)) {
          if (cancelled) return
          // Backend is up. Make sure axios uses the resolved baseURL even if
          // the desktopAPI promise has not resolved yet inside api/client.js.
          api.defaults.baseURL = baseURL
          setMessage('Signing you in...')
          setProgress(95)
          try {
            const { data } = await api.post('/auth/login', {
              username: ADMIN_USERNAME,
              password: ADMIN_PASSWORD,
            })
            useAuthStore.getState().setAuth(data.token, data.user)
          } catch (e) {
            if (cancelled) return
            clearInterval(progressTimer)
            setPhase('error')
            setErrorDetail('Backend is reachable but the local administrator account could not be signed in. The database may need to be re-initialised. Please contact support.')
            return
          }
          clearInterval(progressTimer)
          setProgress(100); setMessage('Ready'); setPhase('ready')
          setTimeout(() => onReady && onReady(), 350)
          return
        }
        await new Promise((r) => setTimeout(r, 700))
      }
      if (!cancelled) {
        clearInterval(progressTimer)
        setPhase('error')
        setErrorDetail(`Could not reach the local backend at ${baseURL}. The database may be unreachable, the local service may have failed to start, or PostgreSQL is not running.`)
      }
    }

    boot()
    return () => { cancelled = true; if (progressTimer) clearInterval(progressTimer) }
  }, [onReady])

  function retry() { setTimeout(() => window.location.reload(), 100) }
  function openLogs() { try { window.desktopAPI?.openLogs?.() } catch (_) {} }
  function quit() { try { window.desktopAPI?.quit?.() } catch (_) { window.close() } }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 text-white overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative w-full max-w-md px-8 text-center">
        <div className="mx-auto mb-6 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-white/30 inline-block">
          <img src="logo.jpeg" alt="Hashmi Real Estate Builders" className="h-20 w-20 rounded-xl object-cover" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Hashmi Real Estate Builders</h1>
        <p className="mt-1 text-sm text-blue-100/80">Enterprise CRM · Desktop Edition</p>

        {phase !== 'error' ? (
          <>
            <div className="mt-10 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-sm text-blue-50/90">{message}</p>
            <p className="mt-1 text-xs text-blue-200/60">{phase === 'connecting' && attempt > 1 ? `Attempt ${attempt}` : '\u00A0'}</p>
          </>
        ) : (
          <div className="mt-8 rounded-2xl bg-white/10 p-6 text-left backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-200">!</div>
              <h2 className="text-lg font-semibold">Startup failed</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-blue-50/90">{errorDetail}</p>
            <ul className="mt-3 list-disc pl-5 text-xs text-blue-100/70 space-y-1">
              <li>Make sure PostgreSQL service is running.</li>
              <li>Verify your database credentials in the setup wizard.</li>
              <li>Check the application log for details.</li>
            </ul>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={openLogs} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/15">Open Logs</button>
              <button onClick={quit} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/15">Quit</button>
              <button onClick={retry} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50">Retry</button>
            </div>
          </div>
        )}
        <p className="mt-10 text-[11px] uppercase tracking-widest text-blue-200/50">{phase === 'ready' ? 'Loaded' : 'Initializing...'}</p>
      </div>
    </div>
  )
}
