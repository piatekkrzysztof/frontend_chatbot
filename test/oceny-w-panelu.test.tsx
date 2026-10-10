/**
 * Oceny odwiedzających w Konwersacjach.
 *
 * Kategoria ryzyka: OBIETNICA BEZ POKRYCIA. Widget po kciuku w dół mówi
 * „Dziękujemy, przekażemy to firmie”, a panel do 10.10.2026 ocen nie pokazywał
 * nigdzie - backend zwracał `is_helpful` i umiał filtrować, ekran to pomijał.
 * Firma nie miała jak znaleźć odpowiedzi, które klientów zawiodły.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsPage from '@/app/(admin)/conversations/page'
import * as api from '@/lib/api'

afterEach(() => vi.restoreAllMocks())

function wpis(id: number, prompt: string, isHelpful: boolean | null) {
  return {
    id,
    conversation_session_id: null,
    prompt,
    response: 'Odpowiedź bota',
    source: 'widget',
    tokens: 10,
    created_at: '2026-10-10T10:00:00Z',
    is_helpful: isHelpful,
  }
}

const WSZYSTKIE = [
  wpis(1, 'Czy pieczecie torty?', true),
  wpis(2, 'Ile kosztuje dowóz?', false),
  wpis(3, 'Godziny otwarcia?', null),
]

function backend() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka.startsWith('/accounts/me/')) return { role: 'owner' }
    if (sciezka.startsWith('/chat/logs/')) {
      const filtr = new URLSearchParams(sciezka.split('?')[1]).get('is_helpful')
      const wyniki = filtr === null ? WSZYSTKIE : WSZYSTKIE.filter((w) => String(w.is_helpful) === filtr)
      return { count: wyniki.length, next: null, previous: null, results: wyniki }
    }
    return {}
  })
}

function karta(pytanie: string) {
  return screen.getByText(pytanie).closest('div.rounded') as HTMLElement
}

describe('Konwersacje: oceny odwiedzających', () => {
  it('przy każdej ocenionej odpowiedzi widać ocenę słowem, przy nieocenionej nic', async () => {
    backend()
    render(<ConversationsPage />)

    await screen.findByText('Czy pieczecie torty?')
    expect(within(karta('Czy pieczecie torty?')).getByText('Ocena: pomocna')).toBeInTheDocument()
    expect(within(karta('Ile kosztuje dowóz?')).getByText('Ocena: niepomocna')).toBeInTheDocument()
    expect(within(karta('Godziny otwarcia?')).queryByText(/Ocena:/)).toBeNull()
  })

  it('filtr „niepomocna” pyta backend o te odpowiedzi i wraca na pierwszą stronę', async () => {
    const szpieg = backend()
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)
    await screen.findByText('Czy pieczecie torty?')

    await uzytkownik.selectOptions(
      screen.getByLabelText('Ocena odwiedzającego'),
      'Oceniona jako niepomocna',
    )

    await waitFor(() => expect(screen.queryByText('Czy pieczecie torty?')).toBeNull())
    expect(screen.getByText('Ile kosztuje dowóz?')).toBeInTheDocument()
    const ostatnie = szpieg.mock.calls.map(([s]) => s).filter((s) => s.startsWith('/chat/logs/')).at(-1)
    expect(ostatnie).toBe('/chat/logs/?page=1&is_helpful=false')
  })

  it('pusty wynik filtra mówi o ocenie, nie o braku rozmów', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) =>
      sciezka.startsWith('/chat/logs/') && sciezka.includes('is_helpful')
        ? { count: 0, next: null, previous: null, results: [] }
        : sciezka.startsWith('/chat/logs/')
          ? { count: 1, next: null, previous: null, results: [WSZYSTKIE[2]] }
          : { role: 'owner' },
    )
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)
    await screen.findByText('Godziny otwarcia?')

    await uzytkownik.selectOptions(screen.getByLabelText('Ocena odwiedzającego'), 'Oceniona jako pomocna')

    expect(await screen.findByText('Brak odpowiedzi z taką oceną.')).toBeInTheDocument()
  })
})
