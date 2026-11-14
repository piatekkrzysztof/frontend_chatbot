/**
 * Drobiazgi panelu z listy porządków po przeglądzie 2026-11.
 *
 * Każdy z nich z osobna jest mały; razem dawały ekrany, na których udane
 * działanie wyglądało na błąd albo jedno kliknięcie robiło coś nieodwracalnego.
 * Błędy pól jako zdania i powrót po zalogowaniu z parametrami mają testy przy
 * swoim kodzie: test/api.test.ts i test/trasy.test.tsx.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamPage from '@/app/(panel)/(admin)/team/page'
import LoginPage from '@/app/(panel)/(auth)/login/page'
import BezpieczenstwoKonta from '@/components/ustawienia/BezpieczenstwoKonta'
import WidgetChat from '@/components/widget/WidgetChat'
import * as api from '@/lib/api'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('cofnięcie zaproszenia', () => {
  const ZAPROSZENIE = {
    id: 5,
    email: 'nowa@rowerownia.pl',
    role: 'employee',
    accept_url: 'https://panel.example/invite/accept#token=abc',
    expires_at: '2026-11-21T10:00:00Z',
    is_valid: true,
    users: 0,
    max_users: 1,
    seats_left: 1,
    created_at: '2026-11-14T10:00:00Z',
  }

  function backend() {
    return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
      if (sciezka === '/users/') {
        return [{ id: 7, username: 'szefowa', email: 's@r.pl', role: 'owner', last_login: null }] as never
      }
      if (sciezka === '/accounts/invitations/list/') return [ZAPROSZENIE] as never
      if (sciezka === '/accounts/me/') return { role: 'owner' } as never
      return null as never
    })
  }

  function cofniecia(wywolania: ReturnType<typeof backend>) {
    return wywolania.mock.calls.filter(([, opcje]) => (opcje as RequestInit | undefined)?.method === 'DELETE')
  }

  it('pierwsze kliknięcie pyta i NIE cofa zaproszenia', async () => {
    // Przycisk stoi tuż obok „skopiuj link". Jedno kliknięcie unieważniało
    // zaproszenie, które ktoś miał już w skrzynce.
    const wywolania = backend()
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    await uzytkownik.click(
      await screen.findByRole('button', { name: 'Cofnij zaproszenie: nowa@rowerownia.pl' }),
    )

    expect(
      screen.getByRole('button', { name: 'Potwierdź cofnięcie zaproszenia: nowa@rowerownia.pl' }),
    ).toBeInTheDocument()
    expect(cofniecia(wywolania)).toHaveLength(0)
  })

  it('drugie kliknięcie cofa właściwe zaproszenie', async () => {
    const wywolania = backend()
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    await uzytkownik.click(
      await screen.findByRole('button', { name: 'Cofnij zaproszenie: nowa@rowerownia.pl' }),
    )
    await uzytkownik.click(
      screen.getByRole('button', { name: 'Potwierdź cofnięcie zaproszenia: nowa@rowerownia.pl' }),
    )

    await waitFor(() => expect(cofniecia(wywolania)).toHaveLength(1))
    expect(cofniecia(wywolania)[0][0]).toBe('/accounts/invitations/5/')
  })
})

describe('pole logowania', () => {
  it('przyjmuje nazwę użytkownika, nie tylko adres e-mail', () => {
    // Osoba z zaproszenia wybiera własną nazwę. Pole typu `email` odrzucało
    // ją w przeglądarce, zanim żądanie w ogóle wyszło.
    render(<LoginPage />)

    const pole = screen.getByLabelText('E-mail lub nazwa użytkownika') as HTMLInputElement

    expect(pole.type).toBe('text')
    expect(pole.autocomplete).toBe('username')
  })
})

describe('pole czatu', () => {
  it('ma tę samą granicę długości co backend', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))))
    render(<WidgetChat />)

    const pole = (await screen.findByLabelText('Treść wiadomości')) as HTMLInputElement

    expect(pole.maxLength).toBe(2000)
  })
})

describe('stan MFA w ustawieniach', () => {
  it('sekcja bezpieczeństwa czyta stan od nowa po zmianie MFA wyżej na ekranie', async () => {
    // Po włączeniu MFA sekcja niżej nie pytała o kod, bo trzymała stan sprzed
    // zmiany - i zmiana hasła kończyła się odmową bez pola na kod.
    const sesje = { count: 0, next: null, previous: null, results: [] }
    let mfa = false
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async () => ({ ...sesje, mfa_enabled: mfa }) as never)
    const widok = render(<BezpieczenstwoKonta wersjaMfa={0} />)
    await waitFor(() => expect(wywolania).toHaveBeenCalledTimes(1))

    mfa = true
    widok.rerender(<BezpieczenstwoKonta wersjaMfa={1} />)

    await waitFor(() => expect(wywolania).toHaveBeenCalledTimes(2))
  })
})
