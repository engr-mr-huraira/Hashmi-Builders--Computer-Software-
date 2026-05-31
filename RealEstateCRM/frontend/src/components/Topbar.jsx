import { LogOut, Menu, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'

const SEARCHABLE_PATHS = ['/colonies', '/plots', '/customers', '/sales', '/payments', '/refunds', '/documents', '/users']

export default function Topbar({ onMenuClick }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [online, setOnline] = useState(navigator.onLine)
  const [query, setQuery] = useState('')
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync query with URL when navigating between pages
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setQuery(params.get('q') || '')
  }, [location])

  function submitSearch(e) {
    e.preventDefault()
    const trimmed = query.trim()
    // If we're already on a searchable list page, just update its q param.
    // Otherwise, route the user to /customers (most useful default).
    const target = SEARCHABLE_PATHS.includes(location.pathname) ? location.pathname : '/customers'
    const qs = trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''
    navigate(`${target}${qs}`)
  }

  function handleLogout() {
    // Clear the authenticated session and ask Root() (in main.jsx) to switch
    // back to the LockScreen. Root listens for this custom event and flips
    // its `unlocked` state to false, which re-renders <LockScreen />.
    logout()
    try { window.dispatchEvent(new Event('app:request-lock')) } catch (_) {
      // Fallback for any environment where CustomEvent fails - reload to
      // re-trigger the LockScreen path on next mount.
      navigate('/', { replace: true })
      window.location.reload()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
      <button className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={onMenuClick}>
        <Menu size={22} />
      </button>
      <form onSubmit={submitSearch} className="hidden flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950 md:flex">
        <Search size={18} className="text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search customers, plots, payments... (Enter)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${online ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        {online ? 'Online Sync' : 'Offline Mode'}
      </div>
      <button title="Toggle theme" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setDark((value) => !value)}>
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  )
}
