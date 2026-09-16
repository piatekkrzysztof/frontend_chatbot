/**
 * Zmiana roli osoby w zespole.
 *
 * Kategoria ryzyka: DOSTEP. Rola decyduje, kto wyniesie historie rozmow do
 * CSV, kto zmieni baze wiedzy i kto zobaczy dziennik. Do dzis dalo sie ja
 * zmienic wylacznie przez API albo panel administracyjny - czyli wlasciciel
 * firmy nie mogl tego zrobic sam, a pomylka przy zapraszaniu zostawala na
 * stale.
 *
 * Zapisu pilnuje backend (tylko wlasciciel, ostatni aktywny wlasciciel nie do
 * zdegradowania). Te testy pilnuja panelu: kto widzi listy wyboru i co sie
 * dzieje, gdy backend odmowi.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamPage from '@/app/(admin)/team/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const ZESPOL = [
  { id: 7, username: 'szefowa', email: 'szef@rowerownia.pl', role: 'owner', last_login: null },
  { id: 8, username: 'serwis', email: 'serwis@rowerownia.pl', role: 'employee', last_login: null },
]

afterEach(() => {
  vi.restoreAllMocks()
})

function backend(mojaRola: string, przyZapisie?: () => never) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
    if (opcje?.method === 'PATCH') {
      if (przyZapisie) przyZapisie()
      return null as never
    }
    if (sciezka === '/users/') return [...ZESPOL] as never
    if (sciezka === '/accounts/invitations/list/') return [] as never
    if (sciezka === '/accounts/me/') return { role: mojaRola } as never
    return null as never
  })
}

describe('właściciel', () => {
  it('zmienia rolę osoby w zespole', async () => {
    const wywolania = backend('owner')
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    const wybor = await screen.findByLabelText('Rola: serwis')
    await uzytkownik.selectOptions(wybor, 'viewer')

    await waitFor(() => {
      const zapisy = wywolania.mock.calls.filter(([, opcje]) => opcje?.method === 'PATCH')
      expect(zapisy).toHaveLength(1)
      expect(zapisy[0][0]).toBe('/users/8/')
      expect(JSON.parse(String(zapisy[0][1]?.body))).toEqual({ role: 'viewer' })
    })
  })

  it('po odmowie cofa wybór i pokazuje powód z backendu', async () => {
    // Ostatni aktywny właściciel: backend odmawia po polsku, bo inaczej
    // firma zostałaby bez nikogo, kto może zarządzać kontem.
    const powod = 'Firma musi mieć co najmniej jednego aktywnego właściciela.'
    backend('owner', () => {
      throw new BladApi(400, powod)
    })
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    const wybor = await screen.findByLabelText('Rola: szefowa')
    await uzytkownik.selectOptions(wybor, 'employee')

    expect(await screen.findByRole('alert')).toHaveTextContent(powod)
    await waitFor(() => expect(wybor).toHaveValue('owner'))
  })
})

describe('pracownik', () => {
  it('widzi role jako tekst, bez list wyboru', async () => {
    // Zapisu i tak nie przepuści backend; lista wyboru obiecywałaby
    // możliwość, której nie ma.
    backend('employee')
    render(<TeamPage />)

    expect(await screen.findByText('serwis')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Rola: /)).not.toBeInTheDocument()
    expect(screen.getAllByText('Pracownik').length).toBeGreaterThan(0)
  })
})
