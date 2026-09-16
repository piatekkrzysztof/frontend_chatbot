/**
 * Usuniecie osoby z zespolu.
 *
 * Kategoria ryzyka: DOSTEP I DANE. To kasuje konto razem z dostepem do panelu
 * i nie da sie tego cofnac. Dlatego pierwszy klik pyta, a dopiero drugi kasuje
 * - i dlatego przycisk widzi wylacznie wlasciciel. Backend pilnuje reszty:
 * odmawia usuniecia ostatniego aktywnego wlasciciela firmy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamPage from '@/app/(admin)/team/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const ZESPOL = [
  { id: 7, username: 'szefowa', email: 'szef@rowerownia.pl', role: 'owner', last_login: null },
  { id: 8, username: 'serwis', email: 'serwis@rowerownia.pl', role: 'employee', last_login: null },
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function backend(mojaRola: string, przyUsuwaniu?: () => never) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
    if (opcje?.method === 'DELETE') {
      if (przyUsuwaniu) przyUsuwaniu()
      return null as never
    }
    if (sciezka === '/users/') return [...ZESPOL] as never
    if (sciezka === '/accounts/invitations/list/') return [] as never
    if (sciezka === '/accounts/me/') return { role: mojaRola } as never
    return null as never
  })
}

async function otworz(mojaRola: string, przyUsuwaniu?: () => never) {
  const uzytkownik = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const wywolania = backend(mojaRola, przyUsuwaniu)
  render(<TeamPage />)
  await screen.findByText('serwis')
  return { uzytkownik, wywolania }
}

describe('właściciel', () => {
  it('pierwszy klik pyta i NIE kasuje konta', async () => {
    const { uzytkownik, wywolania } = await otworz('owner')
    wywolania.mockClear()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń konto: serwis' }))

    expect(
      screen.getByRole('button', { name: 'Potwierdź usunięcie konta: serwis' }),
    ).toBeInTheDocument()
    expect(wywolania.mock.calls.filter(([, o]) => o?.method === 'DELETE')).toHaveLength(0)
  })

  it('drugi klik kasuje właściwe konto i odświeża listę', async () => {
    const { uzytkownik, wywolania } = await otworz('owner')
    wywolania.mockClear()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń konto: serwis' }))
    await uzytkownik.click(
      screen.getByRole('button', { name: 'Potwierdź usunięcie konta: serwis' }),
    )

    await waitFor(() => {
      const kasowania = wywolania.mock.calls.filter(([, o]) => o?.method === 'DELETE')
      expect(kasowania).toHaveLength(1)
      expect(kasowania[0][0]).toBe('/users/8/')
    })
    await waitFor(() =>
      expect(wywolania.mock.calls.filter(([s, o]) => s === '/users/' && !o?.method).length).toBeGreaterThan(0),
    )
  })

  it('pytanie wygasa i nie zostaje uzbrojone na ekranie', async () => {
    const { uzytkownik } = await otworz('owner')

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń konto: serwis' }))
    await vi.advanceTimersByTimeAsync(5200)

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Potwierdź usunięcie konta/ }),
      ).not.toBeInTheDocument(),
    )
  })

  it('odmowa pokazuje powód z backendu', async () => {
    const powod = 'Firma musi mieć co najmniej jednego aktywnego właściciela.'
    const { uzytkownik } = await otworz('owner', () => {
      throw new BladApi(400, powod)
    })

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń konto: szefowa' }))
    await uzytkownik.click(
      screen.getByRole('button', { name: 'Potwierdź usunięcie konta: szefowa' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(powod)
  })
})

describe('pracownik', () => {
  it('nie widzi przycisku usuwania kont', async () => {
    // Zapisu i tak nie przepuści backend; przycisk obiecywałby możliwość,
    // której nie ma, i to przy operacji nie do cofnięcia.
    await otworz('employee')

    expect(screen.queryByRole('button', { name: /^Usuń konto/ })).not.toBeInTheDocument()
  })
})
