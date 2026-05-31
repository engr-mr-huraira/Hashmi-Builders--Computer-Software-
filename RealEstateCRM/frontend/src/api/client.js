import axios from 'axios'

// In Electron production, the renderer is loaded via file:// so relative '/api'
// requests won't work. We resolve the embedded backend port at runtime through
// the desktopAPI bridge and use an absolute URL.
let resolvedBaseURL = '/api'

if (typeof window !== 'undefined' && window.desktopAPI && window.desktopAPI.getBackendPort) {
  window.desktopAPI.getBackendPort().then((port) => {
    resolvedBaseURL = `http://127.0.0.1:${port}/api`
    api.defaults.baseURL = resolvedBaseURL
  }).catch(() => { /* fall back to /api (dev mode via Vite proxy) */ })
}

const api = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
