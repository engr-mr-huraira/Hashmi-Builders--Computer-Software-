import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  Home,
  Layers3,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Users,
  Wallet,
  Bell,
  Heart,
  X,
} from 'lucide-react'
import api from '../api/client.js'
import DataTable from '../components/DataTable.jsx'
import { printTable } from '../utils/export.js'

const formatCurrency = (value) => new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0)

const formatCompact = (value) => new Intl.NumberFormat('en-PK', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value) || 0)

const initialStats = {
  colonyId: 'all',
  plots: { total: 0, sold: 0, available: 0, other: 0, remaining: 0, inventoryValue: 0 },
  landDetails: { total_land: 0, road_cut_land: 0, remaining_land: 0 },
  totalSoldArea: 0,
  remainingPlotsBySize: [],
  sales: { count: 0, customers: 0 },
  receivable: 0,
  payable: 0,
  cashCollected: 0,
  refundsPaid: 0,
  profit: 0,
  charityPercentage: 0,
  charityDue: 0,
  charityPaid: 0,
  charityRemaining: 0,
  revenueTrend: [],
  plotStatus: [],
}

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6']

function GlassCard({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_15px_45px_-25px_rgba(14,116,213,0.45)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-25px_rgba(14,116,213,0.55)] dark:border-white/10 dark:bg-slate-900/55 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <div className="pointer-events-none absolute -top-24 -right-16 h-40 w-40 rounded-full bg-sky-300/30 blur-3xl" />
      {children}
    </div>
  )
}

function StatTile({ icon: Icon, label, value, sub, accent = 'sky', delta }) {
  const accentMap = {
    sky: { ring: 'ring-sky-200/70', glow: 'from-sky-400/30 via-sky-200/10', icon: 'bg-sky-100 text-sky-700' },
    emerald: { ring: 'ring-emerald-200/70', glow: 'from-emerald-400/30 via-emerald-200/10', icon: 'bg-emerald-100 text-emerald-700' },
    amber: { ring: 'ring-amber-200/70', glow: 'from-amber-400/30 via-amber-200/10', icon: 'bg-amber-100 text-amber-700' },
    rose: { ring: 'ring-rose-200/70', glow: 'from-rose-400/30 via-rose-200/10', icon: 'bg-rose-100 text-rose-700' },
    violet: { ring: 'ring-violet-200/70', glow: 'from-violet-400/30 via-violet-200/10', icon: 'bg-violet-100 text-violet-700' },
    cyan: { ring: 'ring-cyan-200/70', glow: 'from-cyan-400/30 via-cyan-200/10', icon: 'bg-cyan-100 text-cyan-700' },
  }
  const a = accentMap[accent] || accentMap.sky

  return (
    <GlassCard className={`ring-1 ${a.ring}`}>
      <div className={`pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-3xl`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${a.icon} shadow-inner`}>
          {Icon && <Icon size={20} />}
        </div>
      </div>
      {delta && (
        <div className="relative mt-4 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/70 backdrop-blur dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700">
          {delta.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          <span>{delta.text}</span>
        </div>
      )}
    </GlassCard>
  )
}

export default function Dashboard() {
  const [colonies, setColonies] = useState([])
  const [selectedColony, setSelectedColony] = useState(() => {
    return localStorage.getItem('dashboard_selected_colony') || 'all'
  })
  const [stats, setStats] = useState(initialStats)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upcomingInstallments, setUpcomingInstallments] = useState([])
  const [showBellModal, setShowBellModal] = useState(false)

  // Load upcoming installments for notification bell
  const loadUpcomingInstallments = () => {
    api.get('/dashboard/upcoming-installments')
      .then(({ data }) => setUpcomingInstallments(data || []))
      .catch(() => setUpcomingInstallments([]))
  }

  // Load colony list once.
  useEffect(() => {
    let cancelled = false
    api.get('/colonies', { params: { limit: 200 } }).then(({ data }) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : (data?.data || [])
      setColonies(list)
      // Auto-select first colony when currently showing "All Colonies"
      if (selectedColony === 'all' && list.length > 0) {
        setSelectedColony(String(list[0].id))
      }
    }).catch(() => {
      if (!cancelled) setColonies([])
    })
    loadUpcomingInstallments()
    return () => { cancelled = true }
  }, [])

  // Load colony-scoped stats whenever the selection changes.
  const loadStats = (colonyId) => {
    setLoading(true)
    setError('')
    loadUpcomingInstallments()
    Promise.allSettled([
      api.get('/dashboard/colony-stats', { params: { colonyId } }),
      api.get('/dashboard/recent-activities'),
    ]).then(([statsRes, actRes]) => {
      if (statsRes.status === 'fulfilled') {
        setStats({ ...initialStats, ...statsRes.value.data })
      } else {
        setError('Could not load colony statistics. Showing zeros.')
        setStats(initialStats)
      }
      if (actRes.status === 'fulfilled' && Array.isArray(actRes.value.data)) {
        setActivities(actRes.value.data)
      }
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    localStorage.setItem('dashboard_selected_colony', selectedColony)
    loadStats(selectedColony)
  }, [selectedColony])

  const colonyLabel = useMemo(() => {
    if (selectedColony === 'all') return 'All Colonies'
    const found = colonies.find((c) => String(c.id) === String(selectedColony))
    return found ? found.name : 'Selected Colony'
  }, [selectedColony, colonies])

  function generateDailyReport() {
    const cols = [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ]
    const rows = [
      { metric: 'Date', value: new Date().toLocaleString() },
      { metric: 'Colony', value: colonyLabel },
      { metric: 'Total Plots', value: stats.plots.total },
      { metric: 'Sold Plots', value: stats.plots.sold },
      { metric: 'Remaining Plots', value: stats.plots.remaining },
      { metric: 'Active Sales', value: stats.sales.count },
      { metric: 'Unique Customers', value: stats.sales.customers },
      { metric: 'Receivable (from customers)', value: formatCurrency(stats.receivable) },
      { metric: 'Payable (to customers - refunds)', value: formatCurrency(stats.payable) },
      { metric: 'Cash Collected', value: formatCurrency(stats.cashCollected) },
      { metric: 'Refunds Disbursed', value: formatCurrency(stats.refundsPaid) },
      { metric: 'Total Profit', value: formatCurrency(stats.profit) },
      { metric: 'Charity Percentage', value: `${stats.charityPercentage}%` },
      { metric: 'Total Charity Due', value: formatCurrency(stats.charityDue) },
      { metric: 'Charity Paid', value: formatCurrency(stats.charityPaid) },
      { metric: 'Charity Remaining', value: formatCurrency(stats.charityRemaining) },
      { metric: 'Inventory Value', value: formatCurrency(stats.plots.inventoryValue) },
    ]
    printTable({
      title: 'Daily Operations Report',
      subtitle: `Hashmi Real Estate Builders · ${colonyLabel}`,
      columns: cols,
      rows,
    })
  }

  const profitPositive = stats.profit >= 0

  return (
    <div className="relative isolate space-y-5">
      {/* Liquid background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-sky-300/40 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-200/40 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-blue-200/35 blur-[120px]" />
      </div>

      {/* Header */}
      <GlassCard className="!p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">Executive Dashboard</p>
            <h1 className="mt-1 bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-700 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl dark:from-sky-200 dark:via-blue-300 dark:to-indigo-300">
              Real-estate operations overview
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
              Showing <span className="font-semibold text-sky-700 dark:text-sky-300">{colonyLabel}</span> · plots, payments, refunds & revenue.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBellModal(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-slate-700 shadow-sm ring-1 ring-sky-100 backdrop-blur transition hover:bg-white hover:text-sky-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:text-sky-400"
              title="Upcoming Installments"
            >
              <Bell size={20} className={upcomingInstallments.length > 0 ? "animate-bounce text-amber-500" : "text-slate-500"} />
              {upcomingInstallments.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
                  {upcomingInstallments.length}
                </span>
              )}
            </button>

            <div className="relative">
              <Layers3 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-600" />
              <select
                value={selectedColony}
                onChange={(e) => setSelectedColony(e.target.value)}
                className="appearance-none rounded-xl border border-white/70 bg-white/80 py-2 pl-9 pr-9 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-sky-100 backdrop-blur transition hover:bg-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              >
                <option value="all">All Colonies</option>
                {colonies.map((colony) => (
                  <option key={colony.id} value={colony.id}>{colony.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={() => loadStats(selectedColony)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-sky-100 backdrop-blur transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              onClick={generateDailyReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:shadow-sky-500/40"
            >
              <FileText size={15} /> Generate Daily Report
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Plots breakdown */}
      <div>
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="inline-flex h-7 items-center rounded-full bg-sky-100/80 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200/70 backdrop-blur">Inventory</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Plot status snapshot</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={Building2}
            accent="sky"
            label="Total Plots"
            value={stats.plots.total}
            sub={`${formatCompact(stats.plots.inventoryValue)} PKR inventory value`}
          />
          <StatTile
            icon={Home}
            accent="emerald"
            label="Sold Plots"
            value={stats.plots.sold}
            sub={`${stats.sales.customers} unique customers · ${stats.sales.count} sales`}
          />
          <StatTile
            icon={Receipt}
            accent="amber"
            label="Remaining Plots"
            value={stats.plots.remaining}
            sub={stats.plots.other ? `${stats.plots.available} available · ${stats.plots.other} other` : 'Available for sale'}
          />
          <StatTile
            icon={Layers3}
            accent="rose"
            label="Road Cut Land"
            value={`${stats.landDetails?.road_cut_land || 0} Marla`}
            sub={`Total: ${stats.landDetails?.total_land || 0} · Remaining: ${stats.landDetails?.remaining_land || 0} Marla`}
          />
        </div>
      </div>

      {/* Money breakdown */}
      <div>
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="inline-flex h-7 items-center rounded-full bg-blue-100/80 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 ring-1 ring-blue-200/70 backdrop-blur">Cash Flow</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Receivables, payables and profit</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            icon={CreditCard}
            accent="cyan"
            label="Receivable (from customers)"
            value={formatCurrency(stats.receivable)}
            sub="Pending installments balance"
            delta={{ direction: 'up', text: 'To collect' }}
          />
          <StatTile
            icon={Wallet}
            accent="rose"
            label="Payable (to customers)"
            value={formatCurrency(stats.payable)}
            sub="Approved / pending refunds"
            delta={{ direction: 'down', text: 'To pay back' }}
          />
          <StatTile
            icon={Banknote}
            accent="emerald"
            label="Cash Collected"
            value={formatCurrency(stats.cashCollected)}
            sub={`Refunds disbursed: ${formatCurrency(stats.refundsPaid)}`}
          />
          <StatTile
            icon={TrendingUp}
            accent={profitPositive ? 'violet' : 'rose'}
            label="Total Profit"
            value={formatCurrency(stats.profit)}
            sub={profitPositive ? 'Net cash position (collected - refunds)' : 'Net loss for the selected colony'}
            delta={{ direction: profitPositive ? 'up' : 'down', text: profitPositive ? 'Positive' : 'Negative' }}
          />
        </div>
      </div>

      {/* Charity breakdown */}
      <div>
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="inline-flex h-7 items-center rounded-full bg-rose-100/80 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700 ring-1 ring-rose-200/70 backdrop-blur">Charity</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {stats.charityPercentage > 0 ? `${stats.charityPercentage}% of profit · ${colonyLabel}` : 'No charity percentage set'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            icon={Heart}
            accent="rose"
            label="Total Charity Due"
            value={formatCurrency(stats.charityDue)}
            sub={`Based on ${stats.charityPercentage}% of colony profit`}
          />
          <StatTile
            icon={Heart}
            accent="emerald"
            label="Charity Paid"
            value={formatCurrency(stats.charityPaid)}
            sub={`Remaining: ${formatCurrency(stats.charityRemaining)}`}
            delta={{ direction: stats.charityRemaining > 0 ? 'down' : 'up', text: stats.charityRemaining > 0 ? `${formatCurrency(stats.charityRemaining)} pending` : 'Fully paid' }}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-5 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Monthly collection trend</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Last 6 months of payments for {colonyLabel.toLowerCase()}</p>
            </div>
            <div className="rounded-full bg-sky-100/80 px-3 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200/70">
              {stats.revenueTrend.length} pts
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenueTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="liquidRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.55} />
                    <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="#cbd5e1" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCompact} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(186,230,253,0.7)',
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 12px 30px -12px rgba(14,116,213,0.35)',
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} fill="url(#liquidRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Plot status</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Distribution for {colonyLabel.toLowerCase()}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Users size={16} />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.plotStatus.length ? stats.plotStatus : [{ status: 'No data', count: 1 }]}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="rgba(255,255,255,0.6)"
                >
                  {(stats.plotStatus.length ? stats.plotStatus : [{ status: 'No data', count: 1 }]).map((entry, index) => (
                    <Cell key={entry.status || index} fill={stats.plotStatus.length ? PIE_COLORS[index % PIE_COLORS.length] : '#cbd5e1'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(186,230,253,0.7)',
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.plotStatus.map((entry, index) => (
              <span
                key={entry.status}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/70 backdrop-blur"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                {entry.status} · {entry.count}
              </span>
            ))}
            {!stats.plotStatus.length && (
              <span className="text-xs text-slate-500">No plots in this colony yet.</span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Redesigned Area Sold & Remaining Inventory Panels */}
      <div className="grid gap-5 md:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Sold Land Area</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total area of sold plots in {colonyLabel.toLowerCase()}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Home size={16} />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-10">
            <span className="text-5xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.totalSoldArea || 0} <span className="text-2xl font-bold">Marlas</span>
            </span>
            {stats.totalSoldArea >= 20 && (
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                ≈ {Math.floor(stats.totalSoldArea / 20)} Kanal {stats.totalSoldArea % 20 > 0 ? ` & ${stats.totalSoldArea % 20} Marla` : ''}
              </p>
            )}
            {stats.totalSoldArea >= 160 && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                ≈ {(stats.totalSoldArea / 160).toFixed(2)} Acres
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Remaining Plots by Size</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Breakdown of available inventory in {colonyLabel.toLowerCase()}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Receipt size={16} />
            </div>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stats.remainingPlotsBySize && stats.remainingPlotsBySize.length > 0 ? (
              stats.remainingPlotsBySize.map((item) => (
                <div key={item.size} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.size} Marla Plots</span>
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                    {item.count} remaining
                  </span>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No remaining plots in this colony.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Recent activities */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Recent activities</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Latest changes across the system</p>
          </div>
          <span className="rounded-full bg-blue-100/80 px-3 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200/70">
            {activities.length} entries
          </span>
        </div>
        <DataTable
          columns={[
            { key: 'action', label: 'Action' },
            { key: 'entity_type', label: 'Module' },
            { key: 'created_at', label: 'Time', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '' },
          ]}
          rows={activities}
          emptyText="No activity logs yet"
        />
      </GlassCard>

      {/* Upcoming Installments Modal */}
      {showBellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <button
              onClick={() => setShowBellModal(false)}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                <Bell size={24} className="animate-swing" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Upcoming & Overdue Installments</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">List of active customers with pending payments for previous and current month</p>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-sm text-slate-600 dark:text-slate-300">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                    <th className="px-4 py-3">Customer Details</th>
                    <th className="px-4 py-3">Previous Month Status</th>
                    <th className="px-4 py-3">Current Month Amt</th>
                    <th className="px-4 py-3 text-right">Total Upcoming</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {upcomingInstallments.length > 0 ? (
                    upcomingInstallments.map((inst, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-slate-50">{inst.customer_name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{inst.colony_name} · Plot: {inst.plot_number}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {inst.previous_installment_total > 0 ? (
                            <div>
                              <p className="text-xs font-medium text-slate-500">Installment: {formatCurrency(inst.previous_installment_total)}</p>
                              {inst.previous_installment_remaining > 0 ? (
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Remaining: {formatCurrency(inst.previous_installment_remaining)} (Partial)</p>
                              ) : (
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Fully Paid ✓</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No previous installments</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(inst.current_installment_total)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-slate-50 text-base">
                          {formatCurrency(inst.total_upcoming_payment)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
                        All current and past installments are fully paid! No upcoming installments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowBellModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
