/**
 * Reset MFA osoby z zespołu przez właściciela (backend 2.32.0).
 *
 * Kategoria ryzyka: DOSTĘP. Przycisk ma być tylko u właściciela, tylko przy
 * osobach z włączonym MFA i nigdy przy nim samym. Gdy właściciel sam ma MFA,
 * backend chce też jego kodu - formularz musi go zebrać, inaczej każda próba
 * kończyłaby się odmową.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamPage from '@/app/(panel)/(admin)/team/page'
import * as api from '@/lib/api'

afterEach(() => vi.restoreAllMocks())

const JA = { id: 1, username: 'szef', email: 'szef@firma.pl', role: 'owner', is_active: true, last_login: null }
const PRACOWNIK = { id: 2, username: 'serwis', email: 'serwis@firma.pl', role: 'employee', is_active: true, last_login: null }
const BEZ_MFA = { id: 3, username: 'nowy', email: 'nowy@firma.pl', role: 'employee', is_active: true, last_login: null }

function backend({ rola = 'owner', mojeMfa = false } = {}) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
    if (sciezka.startsWith('/accounts/me/')) return { id: 1, role: rola }
    if (sciezka.startsWith('/accounts/invitations/list/')) return []
    if (sciezka === '/users/2/reset-mfa/' && opcje?.method === 'POST') {
      return { zakonczonych_sesji: 2, ostrzezenie_wyslane: true }
    }
    if (sciezka.startsWith('/users/')) {
      const wlasciciel = rola === 'owner'
      return [
        { ...JA, mfa_wlaczone: wlasciciel ? mojeMfa : null },
        { ...PRACOWNIK, mfa_wlaczone: wlasciciel ? true : null },
        { ...BEZ_MFA, mfa_wlaczone: wlasciciel ? false : null },
      ]
    }
    return {}
  })
}

describe('Zespół: reset MFA', () => {
  it('przycisk tylko przy osobach z MFA, nigdy przy sobie', async () => {
    backend({ mojeMfa: true })
    render(<TeamPage />)

    expect(await screen.findByRole('button', { name: 'Resetuj logowanie dwuetapowe: serwis' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resetuj logowanie dwuetapowe: szef' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resetuj logowanie dwuetapowe: nowy' })).toBeNull()
  })

  it('pracownik nie widzi przycisku', async () => {
    backend({ rola: 'employee' })
    render(<TeamPage />)

    await screen.findByText('serwis@firma.pl')
    expect(screen.queryByRole('button', { name: /Resetuj logowanie dwuetapowe/ })).toBeNull()
  })

  it('właściciel bez MFA potwierdza samym hasłem', async () => {
    const szpieg = backend({ mojeMfa: false })
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Resetuj logowanie dwuetapowe: serwis' }))
    expect(screen.queryByLabelText('Twój kod MFA albo kod zapasowy')).toBeNull()
    await uzytkownik.type(screen.getByLabelText('Twoje hasło'), 'Haslo!2026')
    await uzytkownik.click(screen.getByRole('button', { name: 'Resetuj logowanie dwuetapowe' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Zakończone sesje: 2')
    const wyslanie = szpieg.mock.calls.find(([s, o]) => s === '/users/2/reset-mfa/' && o?.method === 'POST')
    expect(JSON.parse(String(wyslanie?.[1]?.body))).toEqual({ haslo: 'Haslo!2026' })
  })

  it('właściciel z MFA podaje też własny kod', async () => {
    const szpieg = backend({ mojeMfa: true })
    const uzytkownik = userEvent.setup()
    render(<TeamPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Resetuj logowanie dwuetapowe: serwis' }))
    await uzytkownik.type(screen.getByLabelText('Twoje hasło'), 'Haslo!2026')
    await uzytkownik.type(screen.getByLabelText('Twój kod MFA albo kod zapasowy'), '123456')
    await uzytkownik.click(screen.getByRole('button', { name: 'Resetuj logowanie dwuetapowe' }))

    await waitFor(() => {
      const wyslanie = szpieg.mock.calls.find(([s, o]) => s === '/users/2/reset-mfa/' && o?.method === 'POST')
      expect(JSON.parse(String(wyslanie?.[1]?.body))).toEqual({ haslo: 'Haslo!2026', kod: '123456' })
    })
  })
})
