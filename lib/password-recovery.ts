import { API_URL } from '@/lib/api'

export class RecoveryError extends Error {
  constructor(message: string, public invalidLink = false) { super(message) }
}

/** Deadline includes reading the body; credentials never enter URLs or storage. */
export async function recoveryRequest(action: 'request' | 'preview' | 'confirm', payload: object) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`${API_URL}/accounts/password-reset/${action}/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', signal: controller.signal,
    })
    const data = await response.json()
    if (!response.ok) {
      const field = data.password || data.email || data.token || data.uid
      const message = Array.isArray(field) ? field.join(' ') : data.detail
      throw new RecoveryError(
        response.status === 429 ? 'Za dużo prób. Poczekaj kilka minut i spróbuj ponownie.'
          : message || 'Nie udało się wykonać operacji. Spróbuj ponownie za chwilę.',
        response.status === 400 && Boolean(data.token || data.uid),
      )
    }
    return data
  } catch (error) {
    if (error instanceof RecoveryError) throw error
    throw new RecoveryError('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.')
  } finally { clearTimeout(timer) }
}
