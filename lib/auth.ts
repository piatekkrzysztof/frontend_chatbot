/**
 * Sesja panelu.
 *
 * Token dostepu zyje w pamieci tego modulu, nie w localStorage. Roznica jest
 * konkretna: localStorage przezywa zamkniecie karty i czyta go dowolny skrypt
 * dzialajacy na stronie, wlasny czy wstrzykniety. Zmienna modulu ginie razem
 * z kartą i nie ma jej gdzie odczytac.
 *
 * Token odswiezania nie przechodzi tedy w ogole -- siedzi w ciasteczku
 * HttpOnly, ktorego ten kod nie widzi i widziec nie musi. Przegladarka
 * doklada je sama do zapytania o odswiezenie.
 *
 * Cena: po odswiezeniu strony pamiec jest pusta i trzeba raz zapytac backend
 * o nowy token dostepu. To jedno dodatkowe zapytanie przy wejsciu, w zamian
 * za to, ze dwutygodniowy token nie lezy w miejscu czytelnym dla skryptow.
 */
import { API_URL } from '@/lib/api'
import { fetchSessionJson, fetchWithSessionTimeout, withSessionLock } from '@/lib/session-lock'

/**
 * Sprzatanie po poprzednim sposobie przechowywania sesji.
 *
 * Uzytkownicy zalogowani przed ta zmiana maja w localStorage token
 * odswiezania wazny jeszcze dwa tygodnie. Ten kod nigdy go juz nie uzyje,
 * ale samo nieuzywanie go nie usuwa: lezalby dalej w przegladarce, czytelny
 * dla kazdego skryptu, dokladnie tak jak przed przebudowa. Cala ta zmiana
 * minelaby sie z celem dla wszystkich, ktorzy byli zalogowani wczesniej.
 *
 * Do usuniecia, gdy najstarszy mozliwy token wygasnie -- czyli dwa tygodnie
 * po wdrozeniu.
 */
function usunSladyPoLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
  } catch {
    // Tryb prywatny potrafi rzucac przy samym dostepie do localStorage,
    // a sprzatanie nie moze przewrocic aplikacji.
  }
}

usunSladyPoLocalStorage()

let tokenDostepu: string | null = null
let generation = 0
let loggingOut = false
const LOGOUT_EVENT = 'sm-art-session-logout'
const REVOCATION_EVENT = 'sm-art-session-revoked'
const revokedSessions = new Set<string>()

/** UI coordination only. The server independently validates the signed JWT. */
export function sessionIdentity(token: string | null): string | null {
  try {
    const sid = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sid
    return typeof sid === 'string' && /^[a-f0-9-]{36}$/i.test(sid) ? sid : null
  } catch { return null }
}

function rememberRevocation(sid: string) {
  revokedSessions.add(sid)
  if (revokedSessions.size > 100) revokedSessions.delete(revokedSessions.values().next().value!)
}

/** The server has revoked this login. Never send logout with a possibly newer cookie. */
export function clearRevokedSession(sid: string): boolean {
  rememberRevocation(sid)
  const current = sessionIdentity(tokenDostepu) === sid
  if (current) zapomnijToken()
  try { localStorage.setItem(REVOCATION_EVENT, JSON.stringify({ sid, event: crypto.randomUUID() })) } catch { /* optional tab notification */ }
  return current
}

function logoutRevision() {
  try { return localStorage.getItem(LOGOUT_EVENT) } catch { return null }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === REVOCATION_EVENT && event.newValue) {
      try {
        const { sid } = JSON.parse(event.newValue)
        if (typeof sid !== 'string' || !/^[a-f0-9-]{36}$/i.test(sid)) return
        rememberRevocation(sid)
        if (sessionIdentity(tokenDostepu) !== sid) return
        zapomnijToken()
        window.location.replace('/login?wygasla=1')
      } catch { /* ignore malformed notifications */ }
      return
    }
    if (event.key !== LOGOUT_EVENT || !event.newValue) return
    zapomnijToken()
    // A full navigation clears tenant data cached by mounted components.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login?wygasla=1'
  })
}

/**
 * Odswiezanie w locie. Bez tego pola piec komponentow montujacych sie naraz
 * wysyla piec zapytan o odswiezenie -- a backend rotuje token przy kazdym,
 * wiec cztery z pieciu odpowiedzi niosa juz uniewazniony token i sesja
 * rozpada sie dokladnie w chwili, w ktorej mialo jej przybyc zycia.
 */
let odswiezanieWToku: Promise<string | null> | null = null

export function pobierzToken(): string | null {
  return tokenDostepu
}

export function ustawToken(token: string | null) {
  generation += 1
  tokenDostepu = revokedSessions.has(sessionIdentity(token) || '') ? null : token
}

export function zapomnijToken() {
  generation += 1
  tokenDostepu = null
}

/**
 * Wymienia ciasteczko odswiezania na nowy token dostepu.
 *
 * Zwraca `null`, gdy sesji juz nie ma -- to nie jest blad, tylko odpowiedz
 * "trzeba sie zalogowac". Rzucanie wyjatkiem w tym miejscu kazaloby kazdemu
 * wywolujacemu opakowywac to w try/catch, a wygasla sesja jest sytuacja
 * normalna, nie awaryjna.
 */
export async function odswiezSesje(): Promise<string | null> {
  if (loggingOut) return null
  if (odswiezanieWToku) return odswiezanieWToku

  const expectedGeneration = generation
  const expectedLogout = logoutRevision()
  const stillCurrent = () => generation === expectedGeneration && logoutRevision() === expectedLogout
  odswiezanieWToku = withSessionLock(async () => {
    try {
      if (!stillCurrent()) return null
      let refreshed = await fetchSessionJson(`${API_URL}/accounts/token/refresh/`, {
        method: 'POST',
        // Bez tego przegladarka nie dolaczy ciasteczka do zapytania
        // miedzy panel.* a api.* -- i odswiezanie zawsze zwraca 401.
        credentials: 'include',
      })

      // A losing concurrent request must never remove the winning cookie.
      // Retry once: fetch reads the current HttpOnly cookie at request time.
      if (refreshed.response.status === 409 && stillCurrent()) {
        refreshed = await fetchSessionJson(`${API_URL}/accounts/token/refresh/`, {
          method: 'POST', credentials: 'include',
        })
      }
      if (!stillCurrent()) return null

      if (!refreshed.response.ok) {
        tokenDostepu = null
        return null
      }

      const dane = refreshed.data
      if (!stillCurrent()) return null
      if (revokedSessions.has(sessionIdentity(dane.access) || '')) {
        tokenDostepu = null
        return null
      }
      tokenDostepu = dane.access ?? null
      return tokenDostepu
    } catch {
      // Brak sieci to nie to samo co brak sesji, ale z punktu widzenia
      // wywolujacego oba znacza "nie mam teraz tokenu".
      if (stillCurrent()) tokenDostepu = null
      return null
    }
  }).catch(() => {
    if (stillCurrent()) tokenDostepu = null
    return null
  }).finally(() => { odswiezanieWToku = null })

  return odswiezanieWToku
}

/**
 * Konczy sesje po stronie serwera i czysci pamiec.
 *
 * Samo zapomnienie tokenu byloby gestem po stronie przegladarki: ciasteczko
 * zostaloby na miejscu, a token odswiezania dzialalby dalej przez dwa
 * tygodnie. Dlatego pytamy backend, a nie tylko siebie.
 */
export async function wyloguj(): Promise<void> {
  loggingOut = true
  zapomnijToken()
  try { localStorage.setItem(LOGOUT_EVENT, crypto.randomUUID()) } catch { /* storage may be disabled */ }
  try {
    await withSessionLock(() => fetchWithSessionTimeout(`${API_URL}/accounts/logout/`, {
      method: 'POST',
      credentials: 'include',
    }))
  } catch {
    // Nieudane wylogowanie po stronie serwera nie moze zatrzymac
    // wylogowania po stronie przegladarki -- uzytkownik kliknal "wyloguj"
    // i ma zostac wylogowany, nawet jesli siec akurat padla.
  } finally {
    zapomnijToken()
    loggingOut = false
  }
}
