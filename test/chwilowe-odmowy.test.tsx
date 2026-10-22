/**
 * Chwilowe odmowy przy logowaniu i odświeżaniu sesji (audyt 2026-10, A-04 i A-05).
 *
 * Kategoria ryzyka: DOSTEP. Backend ogranicza logowanie i odświeżanie do
 * 10 zapytań na minutę z jednego adresu (LimitLogowaniaIP) i 5 prób na konto.
 * Biuro za jednym NAT-em albo kilka kart przeładowanych naraz dostaje 429.
 * Do tej zmiany panel traktował to jak koniec sesji (wyrzucał na „Sesja
 * wygasła”), a ekran logowania - jak złe hasło. Użytkownik z poprawnym hasłem
 * resetował je bez potrzeby, a przy chwilowej awarii API tracił otwarty ekran.
 *
 * Zasada po zmianie: sesję kończy tylko 401 z odświeżania (i 409 po
 * ponowieniu - zużyte ciasteczko). Wszystko inne jest chwilowe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { apiFetch, pobierzPlik } from '@/lib/api'
import { ustawToken, zapomnijToken } from '@/lib/auth'
import { withAuth } from '@/lib/withAuth'
import LoginPage from '@/app/(auth)/login/page'

const przekierowania: string[] = []

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
}))

function json(status: number, cialo: unknown = {}, naglowki: Record<string, string> = {}) {
  return new Response(JSON.stringify(cialo), {
    status,
    headers: { 'Content-Type': 'application/json', ...naglowki },
  })
}

const oryginalnaLokalizacja = window.location
let lokalizacja: Location

beforeEach(() => {
  przekierowania.length = 0
  vi.stubGlobal('fetch', vi.fn())
  lokalizacja = { href: '', search: '' } as Location
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: lokalizacja })
})

afterEach(() => {
  zapomnijToken()
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: oryginalnaLokalizacja })
  vi.unstubAllGlobals()
})

describe('logowanie (A-04)', () => {
  async function zaloguj() {
    const uzytkownik = userEvent.setup()
    render(<LoginPage />)
    await uzytkownik.type(screen.getByLabelText('E-mail'), 'szef@firma.pl')
    await uzytkownik.type(screen.getByLabelText('Hasło'), 'poprawne-haslo')
    await uzytkownik.click(screen.getByRole('button', { name: 'Zaloguj się' }))
    return uzytkownik
  }

  it('złe dane to nadal złe dane', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(401, { detail: 'No active account' }))

    await zaloguj()

    expect(await screen.findByRole('alert')).toHaveTextContent('Nieprawidłowy e-mail lub hasło.')
  })

  it('limit prób mówi, ile poczekać, zamiast „złego hasła”', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(429, { detail: 'Request was throttled.' }, { 'Retry-After': '95' }))

    await zaloguj()

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób logowania. Spróbuj ponownie za 2 min.')
  })

  it('limit prób bez Retry-After', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(429))

    await zaloguj()

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób logowania. Spróbuj ponownie za kilka minut.')
  })

  it('awaria serwera to awaria serwera', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(503))

    await zaloguj()

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer chwilowo nie odpowiada. Spróbuj ponownie za chwilę.')
  })

  it('brak sieci po polsku, a nie „Failed to fetch”', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await zaloguj()

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.')
  })

  it('limit prób w drugim kroku nie udaje złego kodu', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(200, { wymaga_drugiego_skladnika: true, bilet: 'bilet' }))
      .mockResolvedValueOnce(json(429, { detail: 'Request was throttled.' }))
    const uzytkownik = await zaloguj()

    await uzytkownik.type(await screen.findByLabelText('Kod'), '123456')
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Za dużo prób logowania.')
  })
})

describe('odświeżanie sesji (A-05)', () => {
  it.each([
    ['429', () => json(429, { detail: 'Request was throttled.' })],
    ['503', () => json(503)],
  ])('odmowa %s przy odświeżaniu nie wylogowuje', async (_, odmowa) => {
    ustawToken('wygasly-token')
    vi.mocked(fetch).mockResolvedValueOnce(json(401)).mockResolvedValueOnce(odmowa())

    await expect(apiFetch('/analytics/')).rejects.toThrow('nadal jesteś zalogowany')

    expect(lokalizacja.href).toBe('')
  })

  it('brak sieci przy odświeżaniu nie wylogowuje', async () => {
    ustawToken('wygasly-token')
    vi.mocked(fetch).mockResolvedValueOnce(json(401)).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(apiFetch('/analytics/')).rejects.toThrow('nadal jesteś zalogowany')

    expect(lokalizacja.href).toBe('')
  })

  it('pobieranie pliku też nie wylogowuje przy chwilowej odmowie', async () => {
    ustawToken('wygasly-token')
    vi.mocked(fetch).mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(503))

    await expect(pobierzPlik('/chat/export/', 'rozmowy.csv')).rejects.toThrow('nadal jesteś zalogowany')

    expect(lokalizacja.href).toBe('')
  })

  it('401 z odświeżania nadal kończy sesję', async () => {
    ustawToken('wygasly-token')
    vi.mocked(fetch).mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401))

    await expect(apiFetch('/analytics/')).rejects.toThrow('Sesja wygasła')

    expect(lokalizacja.href).toBe('/login?wygasla=1')
  })
})

describe('wejście do panelu (A-05, withAuth)', () => {
  const Panel = withAuth(() => <p>Treść panelu</p>)

  it('chwilowa odmowa pokazuje komunikat i ponowienie zamiast ekranu logowania', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(429))
      .mockResolvedValueOnce(json(200, { access: 'swiezy-token' }))
    const uzytkownik = userEvent.setup()
    render(<Panel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('nadal jesteś zalogowany')
    expect(przekierowania).toEqual([])

    await uzytkownik.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

    expect(await screen.findByText('Treść panelu')).toBeInTheDocument()
    expect(przekierowania).toEqual([])
  })

  it('401 przy wejściu nadal odsyła na logowanie', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(401))
    render(<Panel />)

    await vi.waitFor(() => expect(przekierowania).toEqual(['/login?wygasla=1']))
  })
})
