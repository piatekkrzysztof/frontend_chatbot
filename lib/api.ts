const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem('token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (response.status === 401) {
    clearTokens()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Sesja wygasła. Zaloguj się ponownie.')
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      detail = data.detail || data.error || JSON.stringify(data)
    } catch {
      // brak treści JSON w odpowiedzi błędu
    }
    throw new Error(detail)
  }

  if (response.status === 204) return null
  return response.json()
}

export { API_URL }
