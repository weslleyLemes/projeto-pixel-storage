import axios from 'axios'

export const api = axios.create({ baseURL: '/api', withCredentials: true })

let csrfToken = ''
const requestStartedAt = new WeakMap<object, number>()

function safeEndpoint(url?: string) {
  return (url || '').split('?')[0].replace(/\/share\/[^/]+$/, '/share/[token]')
}

export function logAction(action: string, details: Record<string, string | number | boolean> = {}) {
  console.log('[UI]', action, details)
}

// Busca o token CSRF antes das operações mutáveis protegidas por cookie.
export async function refreshCsrf() {
  const { data } = await api.get('/auth/csrf')
  csrfToken = data.csrfToken
}
api.interceptors.request.use(config => {
  const method = (config.method || 'get').toUpperCase()
  const endpoint = safeEndpoint(config.url)
  requestStartedAt.set(config, performance.now())
  console.log('[API] request', { method, endpoint })
  if (['post', 'delete', 'put', 'patch'].includes((config.method || '').toLowerCase()) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

api.interceptors.response.use(response => {
  const startedAt = requestStartedAt.get(response.config)
  console.log('[API] response', {
    method: (response.config.method || 'get').toUpperCase(),
    endpoint: safeEndpoint(response.config.url),
    status: response.status,
    durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
  })
  return response
}, error => {
  const config = error.config
  const startedAt = config ? requestStartedAt.get(config) : undefined
  console.error('[API] failure', {
    method: (config?.method || 'get').toUpperCase(),
    endpoint: safeEndpoint(config?.url),
    status: error.response?.status,
    durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
    message: error.message,
  })
  return Promise.reject(error)
})
