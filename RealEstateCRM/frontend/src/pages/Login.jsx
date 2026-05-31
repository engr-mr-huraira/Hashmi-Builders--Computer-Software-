import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Lock, User, ShieldCheck } from 'lucide-react'
import api from '../api/client.js'
import { useAuthStore } from '../store/authStore.js'

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [form, setForm] = useState({ username: 'admin', password: 'Bin@naseer$4300' })

  useEffect(() => {
    api.get('/auth/roles')
      .then(({ data }) => setRoles(data || []))
      .catch(() => setRoles([]))
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      if (selectedRole && data.user && data.user.role_name !== selectedRole) {
        toast.error(`Access Denied: Your account role does not match "${selectedRole}"`)
        setLoading(false)
        return
      }
      setAuth(data.token, data.user)
      navigate('/')
    } catch (error) {
      toast.error('Login failed. Check local server and credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-950 text-white lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-primary-700 via-slate-900 to-slate-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-1.5 shadow-xl">
            <img src="logo.jpeg" alt="Hashmi Real Estate Builders" className="h-14 w-14 rounded-xl object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Hashmi Real Estate Builders</h1>
            <p className="text-sm text-white/70">Enterprise offline-first colony management</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-5xl font-bold leading-tight">Professional desktop CRM for real-estate operations.</p>
          <p className="mt-6 text-lg text-white/70">Manage plots, bookings, customers, payments, refunds, documents, and finance with local PostgreSQL storage and secure background sync.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-block rounded-2xl bg-white p-1 shadow-md ring-1 ring-slate-200">
              <img src="logo.jpeg" alt="Hashmi Real Estate Builders" className="h-16 w-16 rounded-xl object-cover" />
            </div>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">Use your secure local CRM account</p>
          </div>
          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold">Username</span>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input className="input pl-10" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </div>
          </label>
          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">Password</span>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input className="input pl-10" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </div>
          </label>
          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">Select Role</span>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <select className="input pl-10 cursor-pointer" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                <option value="">-- All Roles / Auto Detect --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </label>
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in securely'}</button>
          <p className="mt-4 text-center text-xs text-slate-500">Authorised use only · Hashmi Real Estate Builders</p>
        </form>
      </div>
    </div>
  )
}
