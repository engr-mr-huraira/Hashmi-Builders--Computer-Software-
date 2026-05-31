export default function StatCard({ title, value, subtitle, icon: Icon, accent = 'primary' }) {
  const accents = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={`rounded-2xl p-3 ${accents[accent]}`}>
            <Icon size={22} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
