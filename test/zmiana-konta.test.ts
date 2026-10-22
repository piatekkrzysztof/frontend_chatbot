/**
 * Zmiana konta w innej karcie (audyt 2026-10, znalezisko A-02).
 *
 * Kategoria ryzyka: DANE MIĘDZY FIRMAMI. Karta 1 pokazuje panel firmy A.
 * W karcie 2 ta sama osoba przyjmuje zaproszenie do firmy B albo loguje się
 * przez /login?wygasla=1 - ciasteczko odświeżania należy już do nowego
 * logowania. Karta 1 o tym nie wiedziała: po wygaśnięciu tokenu odświeżała się
 * na nowe logowanie i powtarzała zapytanie ekranu, więc formularz firmy A
 * zapisywał się w firmie B, a ekran dalej pokazywał dane A.
 *
 * Granica to `sid`: backend zakłada nową sesję logowania przy każdym logowaniu
 * i przenosi jej identyfikator bez zmian przez rotację tokenu
 * (api/session_tokens.py). Inny `sid` po odświeżeniu znaczy więc "to już nie
 * to logowanie, z którym ekran wczytał dane" - nawet jeśli konto jest to samo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api'
import { odswiezSesje, pobierzToken, ustawToken, wyloguj, zapomnijToken } from '@/lib/auth'

const SESJA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESJA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ZNACZNIK_LOGOWANIA = 'sm-art-session-login'

/** Token w kształcie JWT; `nr` odróżnia kolejne rotacje tej samej sesji. */
function token(sid: string, nr = 1) {
  const ladunek = btoa(JSON.stringify({ sid, nr })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `eyJhbGciOiJub25lIn0.${ladunek}.x`
}

function json(status: number, cialo: unknown = {}) {
  return { status, ok: status >= 200 && status < 300, statusText: '', json: async () => cialo } as Response
}

const oryginalnaLokalizacja = window.location
let lokalizacja: Location & { reload: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  lokalizacja = { href: '', reload: vi.fn(), replace: vi.fn() } as unknown as typeof lokalizacja
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: lokalizacja })
})

afterEach(() => {
  zapomnijToken()
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: oryginalnaLokalizacja })
  vi.unstubAllGlobals()
})

describe('odświeżenie przyniosło inne logowanie', () => {
  it('nie powtarza zapytania ekranu, tylko przeładowuje stronę', async () => {
    ustawToken(token(SESJA_A))
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { access: token(SESJA_B) }))
      .mockResolvedValueOnce(json(200, { zapisano: 'w firmie B' }))

    // Nie czekamy na wynik: strona się przeładowuje, ekran nie dostaje odpowiedzi
    void apiFetch('/widget-settings/mine/', { method: 'PATCH', body: '{"widget_title":"Firma A"}' })

    await vi.waitFor(() => expect(lokalizacja.reload).toHaveBeenCalledTimes(1))
    // 401 i odświeżenie - bez powtórzonego zapisu formularza firmy A
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(pobierzToken()).toBeNull()
    // Przeładowanie, nie ekran logowania: ciasteczko jest ważne, tylko cudze
    expect(lokalizacja.href).toBe('')
  })

  it('wykrywa zmianę także wtedy, gdy kartę otwarto bez tokenu w pamięci', async () => {
    // Wejście na stronę: withAuth odświeża i przyjmuje sesję z ciasteczka
    vi.mocked(fetch).mockResolvedValueOnce(json(200, { access: token(SESJA_A) }))
    expect(await odswiezSesje()).toBe(token(SESJA_A))

    vi.mocked(fetch)
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { access: token(SESJA_B) }))
    void apiFetch('/team/')

    await vi.waitFor(() => expect(lokalizacja.reload).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})

describe('odświeżenie w ramach tego samego logowania', () => {
  it('rotacja zachowuje sid, więc zapytanie jest powtórzone jak dotąd', async () => {
    ustawToken(token(SESJA_A, 1))
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, { access: token(SESJA_A, 2) }))
      .mockResolvedValueOnce(json(200, { wynik: 'ok' }))

    expect(await apiFetch('/analytics/')).toEqual({ wynik: 'ok' })
    expect(lokalizacja.reload).not.toHaveBeenCalled()
    expect(pobierzToken()).toBe(token(SESJA_A, 2))
  })

  it('pierwsze odświeżenie po wczytaniu strony przyjmuje sesję z ciasteczka', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(200, { access: token(SESJA_B) }))

    expect(await odswiezSesje()).toBe(token(SESJA_B))
    expect(lokalizacja.reload).not.toHaveBeenCalled()
  })

  it('po wylogowaniu w tej karcie kolejne logowanie nie jest „cudze”', async () => {
    ustawToken(token(SESJA_A))
    vi.mocked(fetch).mockResolvedValueOnce(json(200))
    await wyloguj()

    vi.mocked(fetch).mockResolvedValueOnce(json(200, { access: token(SESJA_B) }))
    expect(await odswiezSesje()).toBe(token(SESJA_B))
    expect(lokalizacja.reload).not.toHaveBeenCalled()
  })
})

describe('powiadomienie innych kart o logowaniu', () => {
  it('logowanie zostawia w localStorage sam losowy znacznik, bez tokenu i sesji', () => {
    ustawToken(token(SESJA_A))

    const znacznik = localStorage.getItem(ZNACZNIK_LOGOWANIA)
    expect(znacznik).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(localStorage)).not.toContain(SESJA_A)
    expect(JSON.stringify(localStorage)).not.toContain(token(SESJA_A))
  })

  it('karta z panelem przeładowuje się, gdy inna karta się zalogowała', () => {
    ustawToken(token(SESJA_A))

    window.dispatchEvent(new StorageEvent('storage', { key: ZNACZNIK_LOGOWANIA, newValue: crypto.randomUUID() }))

    expect(lokalizacja.reload).toHaveBeenCalledTimes(1)
    expect(pobierzToken()).toBeNull()
  })

  it('karta bez sesji (np. ekran logowania) zostaje, jak jest', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: ZNACZNIK_LOGOWANIA, newValue: crypto.randomUUID() }))

    expect(lokalizacja.reload).not.toHaveBeenCalled()
  })
})
