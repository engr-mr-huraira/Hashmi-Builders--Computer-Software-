import { Component } from 'react'

/**
 * Top-level error boundary. Catches runtime errors in the React tree and
 * shows a friendly fallback UI instead of crashing into a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    try {
      const payload = {
        message: error?.message,
        stack: error?.stack,
        componentStack: info?.componentStack,
        time: new Date().toISOString(),
      }
      if (window.desktopAPI && window.desktopAPI.reportCrash) {
        window.desktopAPI.reportCrash(payload)
      }
      // eslint-disable-next-line no-console
      console.error('[RealEstateCRM] Unhandled error', payload)
    } catch (_) { /* noop */ }
  }

  reset = () => this.setState({ hasError: false, error: null, info: null })

  reload = () => window.location.reload()

  openLogs = () => {
    try { window.desktopAPI && window.desktopAPI.openLogs && window.desktopAPI.openLogs() } catch (_) {}
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl bg-white/5 p-7 backdrop-blur ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-200 text-lg font-bold">!</div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-200/90">
            The application encountered an unexpected error. Your data has not been lost.
            You can reload the window to recover.
          </p>
          {this.state.error && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] text-red-200/90">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button onClick={this.openLogs} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/15">Open Logs</button>
            <button onClick={this.reset} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/15">Continue</button>
            <button onClick={this.reload} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">Reload</button>
          </div>
        </div>
      </div>
    )
  }
}
