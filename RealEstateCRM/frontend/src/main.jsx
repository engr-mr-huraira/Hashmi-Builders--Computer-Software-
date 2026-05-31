import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import BootScreen from './components/BootScreen.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LockScreen from './components/LockScreen.jsx'
import UpdateNotification from './components/UpdateNotification.jsx'
import { useAuthStore } from './store/authStore.js'
import './styles.css'

window.addEventListener('error', (e) => {
  try {
    window.desktopAPI?.reportCrash?.({
      message: e?.message,
      stack: e?.error?.stack,
      source: e?.filename,
      time: new Date().toISOString(),
    })
  } catch (_) { /* noop */ }
})
window.addEventListener('unhandledrejection', (e) => {
  try {
    window.desktopAPI?.reportCrash?.({
      message: 'UnhandledRejection: ' + String(e?.reason?.message || e?.reason),
      stack: e?.reason?.stack,
      time: new Date().toISOString(),
    })
  } catch (_) { /* noop */ }
})

function Root() {
  const [unlocked, setUnlocked] = useState(false)
  const [ready, setReady] = useState(false)

  // Re-lock when the main process tells us the window was hidden / locked.
  // We also clear the authenticated session here so when the user unlocks
  // with the system password they are taken back to the Login page.
  useEffect(() => {
    const relock = () => {
      try { useAuthStore.getState().logout() } catch (_) {}
      setReady(false)
      setUnlocked(false)
    }

    // 1. Native trigger: main process emits app:lock when the window is hidden.
    let offNative = () => {}
    if (window.desktopAPI?.onAppLock) {
      offNative = window.desktopAPI.onAppLock(relock) || (() => {})
    }

    // 2. In-app trigger: Topbar Logout button dispatches this custom event so
    //    the user lands on the LockScreen (not the legacy /login page).
    window.addEventListener('app:request-lock', relock)

    return () => {
      try { offNative() } catch (_) {}
      window.removeEventListener('app:request-lock', relock)
    }
  }, [])

  if (!unlocked) {
    return (
      <ErrorBoundary>
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      {!ready && <BootScreen onReady={() => setReady(true)} />}
      {ready && (
        <HashRouter>
          <App />
          <Toaster position="top-right" />
          <UpdateNotification />
        </HashRouter>
      )}
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
