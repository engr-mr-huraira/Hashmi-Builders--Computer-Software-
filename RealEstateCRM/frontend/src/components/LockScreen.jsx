import { useEffect, useRef, useState } from 'react'
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react'

/**
 * App-launch lock screen.
 *
 * Shown on every cold start of the application AND every time the main
 * window is hidden to tray (Electron sends an "app:lock" IPC event on hide).
 * The user must enter the system password before the application UI is
 * shown. After a correct password, the BootScreen silently signs in the
 * local administrator so the operator goes straight to the dashboard -
 * there is no second username / password page.
 */
const SYSTEM_PASSWORD = 'Bin@naseer$4300'
const MAX_ATTEMPTS = 5
const COOLDOWN_SECONDS = 30

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  function submit(e) {
    e.preventDefault()
    if (cooldown > 0) return
    if (pin === SYSTEM_PASSWORD) {
      setError('')
      setPin('')
      onUnlock && onUnlock()
      return
    }
    setShake(true)
    setTimeout(() => setShake(false), 450)
    const next = attempts + 1
    setAttempts(next)
    if (next >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_SECONDS)
      setError(`Too many wrong attempts. Wait ${COOLDOWN_SECONDS}s before retrying.`)
      setAttempts(0)
    } else {
      setError(`Incorrect system password. ${MAX_ATTEMPTS - next} attempt(s) remaining.`)
    }
    setPin('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-slate-950 text-white">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(56,189,248,0.28), transparent 55%),' +
            'radial-gradient(circle at 85% 80%, rgba(99,102,241,0.30), transparent 55%),' +
            'radial-gradient(circle at 50% 100%, rgba(14,165,233,0.18), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top bar with subtle brand mark */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-white/20">
            <img src="logo.jpeg" alt="" className="h-8 w-8 rounded-lg object-cover" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Hashmi Real Estate Builders</p>
            <p className="text-[11px] text-blue-200/60">Enterprise CRM · Desktop Edition</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-blue-100/70 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Secure Workstation
        </div>
      </div>

      {/* Centre card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className={`w-full max-w-md transition-transform ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-2xl">
            {/* Card header */}
            <div className="flex flex-col items-center px-8 pt-8 pb-2 text-center">
              <div className="relative">
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-sky-400/40 via-indigo-500/30 to-purple-500/40 blur-lg" />
                <div className="relative rounded-2xl bg-white p-2 shadow-xl ring-1 ring-white/30">
                  <img src="logo.jpeg" alt="Hashmi Real Estate Builders" className="h-20 w-20 rounded-xl object-cover" />
                </div>
              </div>
              <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-blue-100/70">
                This workstation is locked. Enter your system password to continue.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/20">
                <Lock size={12} /> System Locked
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="px-8 pt-6 pb-7">
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-blue-100/60">
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound size={12} /> System Password
                  </span>
                  {cooldown > 0 && (
                    <span className="text-amber-300 normal-case tracking-normal">
                      Try again in {cooldown}s
                    </span>
                  )}
                </span>
                <div className={`relative rounded-xl ring-1 ring-white/10 bg-white/5 transition focus-within:ring-2 focus-within:ring-sky-400/60 focus-within:bg-white/[0.08] ${error && cooldown === 0 ? 'ring-red-400/60' : ''}`}>
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-200/60" size={16} />
                  <input
                    ref={inputRef}
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setError('') }}
                    disabled={cooldown > 0}
                    autoFocus
                    className="w-full bg-transparent px-11 py-3.5 text-sm text-white placeholder-white/30 outline-none disabled:opacity-60"
                    placeholder="Enter your system password"
                    autoComplete="current-password"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-blue-200/60 hover:bg-white/10 hover:text-blue-100"
                    aria-label={showPin ? 'Hide password' : 'Show password'}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div className="mt-3 min-h-[18px]">
                {error && (
                  <p className={`text-xs ${cooldown > 0 ? 'text-amber-300' : 'text-red-300'}`}>{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={cooldown > 0 || !pin}
                className="group relative mt-4 w-full overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  <Lock size={15} className="transition group-hover:scale-110" />
                  {cooldown > 0 ? `Locked (${cooldown}s)` : 'Unlock Workstation'}
                </span>
              </button>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-blue-200/50">
                Authorised use only. Contact Hashmi Builders if you do not have the system password.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-5 text-center">
        <p className="text-[11px] tracking-wider text-blue-200/40">
          Powered By <span className="font-semibold text-blue-100/70">Prime Softnox Solutions</span>
        </p>
      </div>

      {/* Local keyframes for shake animation */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
