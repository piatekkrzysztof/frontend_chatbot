/**
 * Konwersacje i Zapytania stronami (F16).
 *
 * Kategoria ryzyka: WYDAJNOSC i POPRAWNOSC. Oba ekrany wczytywaly cala
 * historie firmy naraz. Po stronicowaniu backendu musza pytac o konkretna
 * strone, a licznik nieobsluzonych zapytan nie moze liczyc sie z samej
 * wczytanej strony.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConversationsPage from '@/app/(admin)/conversations/page'
import LeadsPage from '@/app/(admin)/leads/page'
import * as api from '@/lib/api'

function wpis(id: number) {
  return {
    id,
    conversation_session_id: null,
    prompt: `pytanie ${id}`,
    response: `odpowiedź ${id}`,
    source: 'faq',
    tokens: 1,
    created_at: '2026-09-14T10:00:00Z',
    is_helpful: null,
  }
}

function zapytanie(id: number, handled = false) {
  return {
    id,
    name: '',
    contact: `k${id}@klient.pl`,
    message: '',
    handled,
    created_at: '2026-09-14T10:00:00Z',
    powiadomiono_at: null,
    blad_powiadomienia: '',
  }
}

describe('Konwersacje', () => {
  it('pyta o pierwsza strone i przechodzi do starszych', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
      if (sciezka === '/chat/logs/?page=1') {
        return { count: 51, next: 'strona-2', previous: null, results: [wpis(51)] }
      }
      if (sciezka === '/chat/logs/?page=2') {
        return { count: 51, next: null, previous: 'strona-1', results: [wpis(1)] }
      }
      throw new Error(`nieoczekiwane ${sciezka}`)
    })

    render(<ConversationsPage />)
    expect(await screen.findByText('pytanie 51')).toBeInTheDocument()
    expect(screen.getByText('Strona 1, wpisów łącznie: 51')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nowsze' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Starsze' }))

    expect(await screen.findByText('pytanie 1')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledWith('/chat/logs/?page=2')
    expect(screen.getByRole('button', { name: 'Starsze' })).toBeDisabled()
  })

  it('jedna strona nie pokazuje przyciskow stron', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [wpis(1)],
    })

    render(<ConversationsPage />)

    await screen.findByText('pytanie 1')
    expect(screen.queryByRole('button', { name: 'Starsze' })).not.toBeInTheDocument()
  })

  it('zwykla tablica z backendu sprzed stronicowania nadal sie wyswietla', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue([wpis(7)])

    render(<ConversationsPage />)

    expect(await screen.findByText('pytanie 7')).toBeInTheDocument()
  })
})

describe('Zapytania', () => {
  function backend(nieobsluzone: number) {
    return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
      if (sciezka === '/widget-settings/mine/') return { powiadom_o_rozmowie: false }
      if (sciezka.startsWith('/contact-requests/?page=')) {
        const numer = Number(sciezka.split('=')[1])
        return {
          count: 55,
          next: numer === 1 ? 'strona-2' : null,
          previous: numer === 1 ? null : 'strona-1',
          results: numer === 1 ? [zapytanie(55), zapytanie(54, true)] : [zapytanie(3)],
          nieobsluzone,
        }
      }
      if (opcje?.method === 'PATCH') return {}
      throw new Error(`nieoczekiwane ${sciezka}`)
    })
  }

  it('licznik nieobsluzonych pochodzi z backendu, nie z wczytanej strony', async () => {
    backend(52)

    render(<LeadsPage />)

    expect(await screen.findByText(/Nieobsłużone: 52\./)).toBeInTheDocument()
  })

  it('oznaczenie jako obsluzone wczytuje od nowa te sama strone', async () => {
    const wywolania = backend(52)

    render(<LeadsPage />)
    await screen.findByText('k55@klient.pl')
    fireEvent.click(screen.getByRole('button', { name: 'Starsze' }))
    await screen.findByText('k3@klient.pl')

    fireEvent.click(screen.getByRole('button', { name: 'Obsłużone' }))

    await waitFor(() =>
      expect(wywolania.mock.calls.filter(([s]) => s === '/contact-requests/?page=2')).toHaveLength(2),
    )
    expect(wywolania).toHaveBeenCalledWith('/contact-requests/3/', expect.objectContaining({ method: 'PATCH' }))
  })
})
