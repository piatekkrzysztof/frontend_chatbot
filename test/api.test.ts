/**
 * Warstwa wywołań do API: token, wygaśnięcie sesji, błędy.
 *
 * Kategoria ryzyka: DOSTĘP. Gdy obsługa 401 przestanie działać, użytkownik
 * albo zostaje z martwym tokenem i pustymi ekranami bez wyjaśnienia, albo —
 * gorzej — wygasły token zostaje w localStorage i wędruje z każdym kolejnym
 * żądaniem.
 *
 * `window.location.href` jest w jsdom tylko do odczytu, więc podmieniamy całe
 * `window.location` na atrapę. To jedyny sposób, żeby sprawdzić przekierowanie
 * bez uruchamiania prawdziwej przeglądarki.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, authHeaders, clearTokens, getToken, setTokens } from '@/lib/api'

const oryginalnaLokalizacja = window.location

function podmienLokalizacje() {
  const atrapa = { href: '' } as Location
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: atrapa,
  })
  return atrapa
}

function odpowiedz(status: number, cialo: unknown = {}, opcje: { pusta?: boolean } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `HTTP ${status}`,
    json: opcje.pusta
      ? () => Promise.reject(new Error('brak JSON'))
      : () => Promise.resolve(cialo),
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: oryginalnaLokalizacja,
  })
  vi.unstubAllGlobals()
})

describe('token', () => {
  it('zapisuje i oddaje token dostępu', () => {
    setTokens('abc', 'refresh-xyz')

    expect(getToken()).toBe('abc')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-xyz')
  })

  it('czyści OBA tokeny, nie tylko dostępowy', () => {
    // Zostawiony refresh to cichy sposób na to, żeby wylogowanie nie
    // wylogowywało — następne odświeżenie potrafi wskrzesić sesję.
    setTokens('abc', 'refresh-xyz')

    clearTokens()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('nie wystawia nagłówka, gdy tokenu nie ma', () => {
    expect(authHeaders()).toEqual({})
  })

  it('wystawia nagłówek Bearer, gdy token jest', () => {
    setTokens('abc')

    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc' })
  })
})

describe('wygaśnięcie sesji', () => {
  it('przy 401 czyści tokeny, przekierowuje i rzuca czytelny błąd', async () => {
    const lokalizacja = podmienLokalizacje()
    setTokens('wygasly', 'refresh-tez-wygasly')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(401))

    await expect(apiFetch('/accounts/me/')).rejects.toThrow(/Sesja wygasła/)

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(lokalizacja.href).toBe('/login')
  })

  it('nie przekierowuje przy innych błędach', async () => {
    // 403 znaczy „nie masz uprawnień", nie „zaloguj się ponownie".
    // Wyrzucenie kogoś do logowania przy 403 wygląda jak awaria sesji
    // i każe mu logować się w kółko na to samo konto.
    const lokalizacja = podmienLokalizacje()
    setTokens('wazny')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(403, { detail: 'Brak uprawnień' }))

    await expect(apiFetch('/knowledge/')).rejects.toThrow('Brak uprawnień')

    expect(getToken()).toBe('wazny')
    expect(lokalizacja.href).toBe('')
  })
})

describe('żądanie', () => {
  it('dokłada token do nagłówków', async () => {
    setTokens('abc')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, { ok: true }))

    await apiFetch('/analytics/')

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).get('Authorization')).toBe('Bearer abc')
  })

  it('NIE ustawia Content-Type dla FormData', async () => {
    // Przeglądarka musi sama dopisać granicę multipart. Ustawienie
    // Content-Type ręcznie zabiera jej tę możliwość i backend dostaje
    // wieloczęściowe ciało, którego nie potrafi rozłożyć — wgrywanie
    // dokumentów przestaje działać bez żadnego komunikatu.
    const dane = new FormData()
    dane.append('file', new Blob(['x']), 'plik.pdf')
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, {}))

    await apiFetch('/documents-upload/', { method: 'POST', body: dane })

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).has('Content-Type')).toBe(false)
  })

  it('ustawia Content-Type dla ciała JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(200, {}))

    await apiFetch('/faq/', { method: 'POST', body: JSON.stringify({ question: 'x' }) })

    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    expect((opcje?.headers as Headers).get('Content-Type')).toBe('application/json')
  })

  it('zwraca null przy 204, zamiast wywracać się na pustym ciele', async () => {
    // Kasowanie zwraca 204 bez treści. Próba sparsowania tego jako JSON
    // kończy się wyjątkiem, więc udane usunięcie wyglądałoby na błąd.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(204, null, { pusta: true }))

    await expect(apiFetch('/faq/1/', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('wyciąga komunikat błędu z odpowiedzi backendu', async () => {
    vi.mocked(fetch).mockResolvedValue(odpowiedz(400, { detail: 'Limit wiadomości wyczerpany' }))

    await expect(apiFetch('/widget/chat/')).rejects.toThrow('Limit wiadomości wyczerpany')
  })

  it('nie gubi błędu, gdy odpowiedź nie jest JSON-em', async () => {
    // Przy 502 od proxy ciało bywa stroną HTML. Bez zabezpieczenia
    // użytkownik dostaje „Unexpected token <" zamiast informacji o awarii.
    vi.mocked(fetch).mockResolvedValue(odpowiedz(502, null, { pusta: true }))

    await expect(apiFetch('/analytics/')).rejects.toThrow('HTTP 502')
  })
})
