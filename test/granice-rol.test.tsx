/**
 * Granice ról w panelu.
 *
 * Kategoria ryzyka: ZAUFANIE DO PANELU. 403 znaczy "to nie dla Ciebie", a nie
 * "cos sie zepsulo". Pokazane jako czerwony komunikat - w dodatku zdaniem
 * z DRF po angielsku - wyglada jak awaria: czlowiek odswieza, probuje jeszcze
 * raz i w koncu pisze do obslugi. Ekran Dziennik zdarzen robil to dobrze od
 * poczatku; te testy pilnuja, ze pozostale miejsca mowia to samo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeamPage from '@/app/(admin)/team/page'
import UstawieniaPage from '@/app/(admin)/ustawienia/page'
import DaneRozliczeniowe from '@/components/ustawienia/DaneRozliczeniowe'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const ODMOWA_DRF = 'You do not have permission to perform this action.'

const SESJE = {
  count: 1,
  next: null,
  previous: null,
  mfa_enabled: false,
  results: [
    { id: 'jedna', created_at: '2026-09-15T09:00:00Z', expires_at: '2026-09-29T09:00:00Z', current: true },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
})

function backend(odmowy: string[]) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (odmowy.some((odmowa) => sciezka.startsWith(odmowa))) {
      throw new BladApi(403, ODMOWA_DRF)
    }
    if (sciezka === '/users/') return [] as never
    if (sciezka === '/accounts/invitations/list/') return [] as never
    if (sciezka === '/accounts/firma/') return { name: 'Rowerownia', owner_email: 'szef@r.pl' } as never
    if (sciezka.startsWith('/accounts/dane-rozliczeniowe/')) {
      return { nazwa: '', nip: '', ulica: '', kod_pocztowy: '', miasto: '', kraj: 'PL' } as never
    }
    if (sciezka === '/accounts/2fa/') {
      return { wlaczony: false, w_trakcie_konfiguracji: false, kodow_zapasowych: 0 } as never
    }
    if (sciezka.startsWith('/accounts/sessions/')) return SESJE as never
    return null as never
  })
}

describe('Zespół', () => {
  it('podgląd dostaje wyjaśnienie, nie komunikat z DRF', async () => {
    backend(['/users/'])
    render(<TeamPage />)

    expect(await screen.findByText(/Listę zespołu widzi właściciel i pracownik/)).toBeVisible()
    expect(screen.queryByText(ODMOWA_DRF)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zaproś' })).not.toBeInTheDocument()
  })

  it('pracownik widzi zespół, ale nie formularz zaproszeń', async () => {
    // Zaproszenia tworzy właściciel. Formularz pokazywany pracownikowi
    // kończył się 403 dopiero po wypełnieniu i kliknięciu.
    backend(['/accounts/invitations/list/'])
    render(<TeamPage />)

    expect(await screen.findByRole('heading', { name: 'Zespół' })).toBeInTheDocument()
    expect(screen.queryByText(/Listę zespołu widzi/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zaproś' })).not.toBeInTheDocument()
  })

  it('właściciel dalej ma pełny ekran', async () => {
    backend([])
    render(<TeamPage />)

    expect(await screen.findByRole('button', { name: 'Zaproś' })).toBeInTheDocument()
  })
})

describe('Ustawienia konta', () => {
  it('bez prawa do danych firmy reszta ekranu działa dalej', async () => {
    backend(['/accounts/firma/', '/accounts/dane-rozliczeniowe/'])
    render(<UstawieniaPage />)

    expect(await screen.findByText(/Dane firmy zmienia właściciel konta/)).toBeVisible()
    expect(await screen.findByText(/Dane do faktury prowadzi właściciel konta/)).toBeVisible()
    expect(screen.queryByText(ODMOWA_DRF)).not.toBeInTheDocument()
    // Formularz danych firmy zniknął, ale własne ustawienia zostają.
    expect(screen.queryByLabelText('Nazwa firmy')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /Logowanie dwuetapowe/i })).toBeInTheDocument()
  })

  it('właściciel widzi formularz danych firmy', async () => {
    backend([])
    render(<UstawieniaPage />)

    expect(await screen.findByLabelText('Nazwa firmy')).toBeInTheDocument()
    expect(screen.queryByText(/Dane firmy zmienia właściciel konta/)).not.toBeInTheDocument()
  })
})

describe('Dane do faktury', () => {
  it('po odmowie pokazuje wyjaśnienie zamiast formularza', async () => {
    backend(['/accounts/dane-rozliczeniowe/'])
    render(<DaneRozliczeniowe />)

    expect(await screen.findByText(/Dane do faktury prowadzi właściciel konta/)).toBeVisible()
    expect(screen.queryByLabelText(/NIP/)).not.toBeInTheDocument()
  })
})
