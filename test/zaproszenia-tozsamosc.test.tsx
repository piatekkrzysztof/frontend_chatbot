/**
 * Zaproszenie do zespolu: link z panelu nie zaklada konta.
 *
 * Kategoria ryzyka: LINK, KTORY JEST HASLEM. Do 2.20.0 panel dawal do
 * skopiowania link zakladajacy konto, a strona przyjecia sama wpisywala adres
 * zaproszenia w pole, ktore backend potem "sprawdzal". Kto dostal link czatem,
 * zostawal pracownikiem.
 *
 * Teraz link z panelu prowadzi na strone, ktora umie tylko wyslac zaproszenie
 * na wlasciwy adres. Konto zaklada dopiero link z tej wiadomosci.
 */
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrzyjmijZaproszeniePage from '@/app/(auth)/invite/accept/[token]/page'
import WyslijZaproszeniePage from '@/app/(auth)/invite/wyslij/[token]/page'

const przekierowania: string[] = []
const logowania: unknown[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
}))

vi.mock('@/lib/session-lock', () => ({
  sessionRequest: (_url: string, opcje: RequestInit) => {
    logowania.push(JSON.parse(String(opcje.body)))
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ access: 'a' }) })
  },
}))

vi.mock('@/lib/auth', () => ({ ustawToken: () => undefined }))

function odpowiedz(status: number, cialo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cialo),
  } as Response
}

/**
 * Obietnica juz spelniona - w sposob, ktory `use()` rozpoznaje bez zawieszania.
 *
 * Zwykle `Promise.resolve(...)` zawiesza komponent przy pierwszym renderze,
 * a w tym srodowisku testowym Suspense nigdy potem nie wznawia - strona
 * zostawala pusta i kazdy test padal na braku przycisku. React sprawdza
 * pola `status` i `value` na obietnicy i przy `fulfilled` oddaje wartosc od razu.
 */
function spelniona<T>(wartosc: T): Promise<T> {
  const obietnica = Promise.resolve(wartosc) as Promise<T> & { status: string; value: T }
  obietnica.status = 'fulfilled'
  obietnica.value = wartosc
  return obietnica
}

function wyrenderuj(Strona: typeof PrzyjmijZaproszeniePage, token = 'klucz-123') {
  return render(
    <Suspense fallback={null}>
      <Strona params={spelniona({ token })} />
    </Suspense>,
  )
}

beforeEach(() => {
  przekierowania.length = 0
  logowania.length = 0
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('strona przyjecia (link z maila)', () => {
  const PODGLAD = {
    company: 'Piekarnia',
    role: 'employee',
    is_valid: true,
    expires_at: '2026-10-09T10:00:00Z',
  }

  it('nie ma pola z adresem e-mail', async () => {
    // Pole bylo tylko do odczytu i wypelnialo sie tym, co podal podglad -
    // wiec "sprawdzenie adresu" porownywalo wartosc serwera z nia sama.
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(200, PODGLAD))

    wyrenderuj(PrzyjmijZaproszeniePage)

    expect(await screen.findByText('Dołącz do zespołu')).toBeVisible()
    expect(screen.queryByLabelText('E-mail')).toBeNull()
    expect(screen.getByText(/adres, na który przyszło to zaproszenie/)).toBeVisible()
  })

  it('wysyla klucz, nazwe i haslo - bez adresu - i loguje nazwa', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(200, PODGLAD))
      .mockResolvedValueOnce(odpowiedz(201, { message: 'ok' }))
    const uzytkownik = userEvent.setup()
    wyrenderuj(PrzyjmijZaproszeniePage)

    await uzytkownik.type(await screen.findByLabelText('Nazwa użytkownika'), 'ania')
    await uzytkownik.type(screen.getByLabelText('Hasło'), 'Bardzo-Dlugie-Haslo-2026!')
    await uzytkownik.click(screen.getByRole('button', { name: 'Załóż konto' }))

    await waitFor(() => expect(przekierowania).toContain('/dashboard'))
    const [, zapis] = vi.mocked(fetch).mock.calls[1]
    expect(JSON.parse(String(zapis?.body))).toEqual({
      token: 'klucz-123',
      username: 'ania',
      password: 'Bardzo-Dlugie-Haslo-2026!',
    })
    expect(logowania).toEqual([{ username: 'ania', password: 'Bardzo-Dlugie-Haslo-2026!' }])
  })
})

describe('strona wysylki (link z panelu)', () => {
  it('nie zaklada konta, tylko prosi o wysylke na wlasciwy adres', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(202, { message: 'ok' }))
    const uzytkownik = userEvent.setup()
    wyrenderuj(WyslijZaproszeniePage, 'klucz-wysylki')

    expect(await screen.findByText(/Ten link nie zakłada konta/)).toBeVisible()
    expect(screen.queryByLabelText('Hasło')).toBeNull()
    await uzytkownik.click(screen.getByRole('button', { name: 'Wyślij mi zaproszenie' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Wysłaliśmy zaproszenie/)
    const [adres, opcje] = vi.mocked(fetch).mock.calls[0]
    expect(String(adres)).toMatch(/\/accounts\/invitations\/wyslij\/klucz-wysylki\/$/)
    expect(opcje?.method).toBe('POST')
  })

  it('pokazuje zdanie backendu przy wygaslym zaproszeniu', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      odpowiedz(410, { detail: 'Zaproszenie wygasło albo zostało już wykorzystane.' }),
    )
    const uzytkownik = userEvent.setup()
    wyrenderuj(WyslijZaproszeniePage, 'klucz-wysylki')

    await uzytkownik.click(await screen.findByRole('button', { name: 'Wyślij mi zaproszenie' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/wygasło/)
  })

  it('nie zdradza adresu, na ktory poszlo zaproszenie', async () => {
    // Strone otwiera kazdy, komu przekazano link - nie moze mu podawac adresu.
    vi.mocked(fetch).mockResolvedValueOnce(
      odpowiedz(202, { message: 'Zaproszenie wysłane na adres, na który je wystawiono.' }),
    )
    const uzytkownik = userEvent.setup()
    const { container } = wyrenderuj(WyslijZaproszeniePage, 'klucz-wysylki')

    await uzytkownik.click(await screen.findByRole('button', { name: 'Wyślij mi zaproszenie' }))
    await screen.findByRole('status')

    expect(container.textContent).not.toMatch(/@/)
  })
})
