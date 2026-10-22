/**
 * Link z maila z zaproszeniem: klucz przyjęcia we fragmencie (audyt 2026-10, A-26).
 *
 * Kategoria ryzyka: LINK, KTÓRY JEST HASŁEM. Klucz przyjęcia zakłada konto
 * w firmie z rolą z zaproszenia, łącznie z właścicielem. W ścieżce strony
 * (/invite/accept/<klucz>) trafiał do logów zapytań hostingu, a w ścieżce
 * podglądu - do logów API. Fragment (#token=...) przeglądarka zostawia
 * u siebie, tak jak przy resecie hasła i aktywacji konta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrzyjmijZaproszeniePage from '@/app/(panel)/(auth)/invite/accept/page'

const przekierowania: string[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
}))

vi.mock('@/lib/session-lock', () => ({
  sessionRequest: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ access: 'a' }) }),
}))

vi.mock('@/lib/auth', () => ({ ustawToken: () => undefined }))

const KLUCZ = '6f1c2d3e-4a5b-4c6d-8e7f-901234567890'
const PODGLAD = { company: 'Piekarnia', role: 'owner', is_valid: true, expires_at: '2026-10-29T10:00:00Z' }

function odpowiedz(status: number, cialo: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(cialo) } as Response
}

/** Adresy wszystkich zapytań do API - klucza nie może być w żadnym. */
function adresyZapytan() {
  return vi.mocked(fetch).mock.calls.map(([adres]) => String(adres))
}

beforeEach(() => {
  przekierowania.length = 0
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('strona przyjęcia z kluczem we fragmencie', () => {
  it('pyta o podgląd POST-em z kluczem w treści i czyści adres strony', async () => {
    window.history.replaceState(null, '', `/invite/accept#token=${KLUCZ}`)
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(200, PODGLAD))

    render(<PrzyjmijZaproszeniePage />)

    expect(await screen.findByText('Dołącz do zespołu')).toBeVisible()
    expect(screen.getByText(/w roli/)).toHaveTextContent('Piekarnia w roli właściciela')
    // Klucz nie zostaje w pasku adresu ani w historii karty
    expect(window.location.pathname).toBe('/invite/accept')
    expect(window.location.hash).toBe('')

    const [adres, opcje] = vi.mocked(fetch).mock.calls[0]
    expect(String(adres)).toMatch(/\/accounts\/invitations\/preview\/$/)
    expect(opcje?.method).toBe('POST')
    expect(JSON.parse(String(opcje?.body))).toEqual({ token: KLUCZ })
    expect(adresyZapytan().filter(a => a.includes(KLUCZ))).toEqual([])
  })

  it('zakłada konto z kluczem w treści, nie w adresie', async () => {
    window.history.replaceState(null, '', `/invite/accept#token=${KLUCZ}`)
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(200, PODGLAD))
      .mockResolvedValueOnce(odpowiedz(201, { message: 'ok' }))
    const uzytkownik = userEvent.setup()
    render(<PrzyjmijZaproszeniePage />)

    await uzytkownik.type(await screen.findByLabelText('Nazwa użytkownika'), 'ania')
    await uzytkownik.type(screen.getByLabelText('Hasło'), 'Bardzo-Dlugie-Haslo-2026!')
    await uzytkownik.click(screen.getByRole('button', { name: 'Załóż konto' }))

    await waitFor(() => expect(przekierowania).toContain('/dashboard'))
    const [adres, zapis] = vi.mocked(fetch).mock.calls[1]
    expect(String(adres)).toMatch(/\/accounts\/accept-invite\/$/)
    expect(JSON.parse(String(zapis?.body))).toEqual({
      token: KLUCZ,
      username: 'ania',
      password: 'Bardzo-Dlugie-Haslo-2026!',
    })
    expect(adresyZapytan().filter(a => a.includes(KLUCZ))).toEqual([])
  })

  it('bez klucza w adresie mówi, że link jest nieprawidłowy, i nie pyta API', async () => {
    window.history.replaceState(null, '', '/invite/accept')

    render(<PrzyjmijZaproszeniePage />)

    expect(await screen.findByText('Zaproszenie nieaktualne')).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('odrzucony klucz kończy się komunikatem o nieaktualnym zaproszeniu', async () => {
    window.history.replaceState(null, '', `/invite/accept#token=${KLUCZ}`)
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(404, { detail: 'Nie znaleziono.' }))

    render(<PrzyjmijZaproszeniePage />)

    expect(await screen.findByText('Zaproszenie nieaktualne')).toBeVisible()
    expect(screen.queryByLabelText('Nazwa użytkownika')).toBeNull()
  })
})
