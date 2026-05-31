import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, Building2, CreditCard, FileBarChart, FileText, Home, Landmark, LayoutDashboard, Receipt, RotateCcw, Settings, Users, X, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore.js'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/colonies', label: 'Colonies', icon: Building2 },
  { to: '/plots', label: 'Plots', icon: Home },
  { to: '/shops', label: 'Shops', icon: Landmark },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/refunds', label: 'Refunds', icon: RotateCcw },
  { to: '/financial', label: 'Financial', icon: Landmark },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/users', label: 'Users & Roles', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const permissions = user?.permissions || []
  const hasAll = permissions.includes('all')

  const visibleItems = items.filter((item) => {
    if (hasAll) return true
    const keyMap = {
      '/': 'dashboard',
      '/colonies': 'colonies',
      '/plots': 'plots',
      '/shops': 'plots',
      '/customers': 'customers',
      '/sales': 'sales',
      '/payments': 'payments',
      '/refunds': 'refunds',
      '/financial': 'financial',
      '/documents': 'documents',
      '/reports': 'reports',
      '/notifications': 'notifications',
      '/users': 'users',
      '/settings': 'settings'
    }
    const permissionKey = keyMap[item.to]
    return permissions.includes(permissionKey)
  })

  function handleLogout() {
    logout()
    try { window.dispatchEvent(new Event('app:request-lock')) } catch (_) {
      navigate('/', { replace: true })
      window.location.reload()
    }
  }

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/50 lg:hidden ${open ? 'block' : 'hidden'}`} onClick={onClose} />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between gap-3 border-b border-slate-100 px-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src="logo.jpeg" alt="Hashmi Real Estate Builders" className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
            <div>
              <p className="text-sm font-bold text-primary-600 leading-tight">Hashmi Real Estate</p>
              <p className="text-xs text-slate-500">Builders · CRM Suite</p>
            </div>
          </div>
          <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role: {user?.role_name || user?.role || 'Super Admin'}</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user?.full_name || 'Administrator'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
