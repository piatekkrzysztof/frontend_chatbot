import { API_URL, BladApi } from '@/lib/api'
import { clearRevokedSession, odswiezSesje, pobierzToken, sessionIdentity } from '@/lib/auth'
import { withSessionLock } from '@/lib/session-lock'

export type SecurityResult = { detail: string; current_session_revoked: boolean; local_session_ended?: boolean }

export function navigateAfterSecurityChange(passwordChanged: boolean) {
  window.location.replace(`/login?wygasla=1&powod=${passwordChanged ? 'haslo' : 'sesja'}`)
}

/** Refresh before taking the write lock. Never replay a credential-changing POST. */
export async function securityMutation(path: string, data: object): Promise<SecurityResult> {
  const previous = sessionIdentity(pobierzToken())
  const refreshed = await odswiezSesje()
  const sid = sessionIdentity(refreshed)
  if (!sid || (previous && previous !== sid)) {
    throw new Error('Sesja zmieniła się lub wygasła. Zaloguj się ponownie przed tą operacją.')
  }
  return withSessionLock(async () => {
    if (sessionIdentity(pobierzToken()) !== sid) {
      throw new Error('Sesja zmieniła się. Odśwież stronę przed ponowieniem.')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pobierzToken()}` },
        body: JSON.stringify(data), signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new BladApi(response.status,
        response.status === 429 ? 'Za dużo prób. Spróbuj ponownie później.'
          : result.detail || 'Nie udało się potwierdzić operacji. Sprawdź hasło i kod MFA.')
      return { ...result, local_session_ended: result.current_session_revoked ? clearRevokedSession(sid) : false }
    } catch (error) {
      if (error instanceof BladApi) throw error
      throw new Error('Brak potwierdzenia z serwera. Operacja mogła się wykonać. Sprawdź stan lub zaloguj się ponownie.')
    } finally { clearTimeout(timer) }
  })
}
