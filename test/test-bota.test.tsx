/**
 * Test bota: sesja, strumień i dostępność (audyt 2026-10, A-03, A-13, A-21).
 *
 * Kategoria ryzyka: CICHA AWARIA w pierwszym kroku wdrożenia. „Rozmowa
 * testowa” jest na liście pierwszych kroków, a ten ekran:
 *  - wysyłał pytanie surowym fetch, więc po 15 minutach bez innego zapytania
 *    token wygasał i każde pytanie kończyło się „Bot nie odpowiedział” aż do
 *    przeładowania strony (A-03);
 *  - miał własny, starszy parser SSE - wymagał spacji po „data:” i jedno
 *    zepsute zdarzenie przerywało całą odpowiedź, choć widget (sse.ts) miał
 *    to już naprawione. Test bota przestawał wtedy mówić prawdę o widgecie
 *    (A-13);
 *  - nie ogłaszał odpowiedzi ani błędów czytnikowi ekranu (A-21).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ustawToken, zapomnijToken } from '@/lib/auth'
import TestBotaPage from '@/app/(panel)/(admin)/test-bota/page'

function json(status: number, cialo: unknown = {}) {
  return new Response(JSON.stringify(cialo), { status, headers: { 'Content-Type': 'application/json' } })
}

function strumien(...zdarzenia: string[]) {
  return new Response(new ReadableStream({
    start(kontroler) {
      for (const z of zdarzenia) kontroler.enqueue(new TextEncoder().encode(z))
      kontroler.close()
    },
  }), { status: 200 })
}

/** Historia pusta (GET), odpowiedź na pytanie (POST) według `naPytanie`. */
function podstawBackend(naPytanie: (naglowki: Headers) => Response) {
  vi.mocked(fetch).mockImplementation(async (adres, opcje) => {
    const url = String(adres)
    if (url.includes('/token/refresh/')) return json(200, { access: 'swiezy-token' })
    if ((opcje?.method ?? 'GET') === 'GET') return json(200, { messages: [] })
    return naPytanie(new Headers(opcje?.headers))
  })
}

async function zapytaj(pytanie: string) {
  const uzytkownik = userEvent.setup()
  render(<TestBotaPage />)
  await uzytkownik.type(screen.getByLabelText('Pytanie do bota'), pytanie)
  await uzytkownik.keyboard('{Enter}')
}

const ODPOWIEDZ = ['data: {"type":"delta","content":"Otwieramy o 9."}\n\n', 'data: {"type":"done","source":"faq"}\n\n']

const oryginalnaLokalizacja = window.location

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  zapomnijToken()
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: oryginalnaLokalizacja })
  vi.unstubAllGlobals()
})

describe('sesja (A-03)', () => {
  it('wygasły token jest odświeżany, a pytanie ponawiane', async () => {
    ustawToken('wygasly-token')
    podstawBackend((naglowki) => (naglowki.get('Authorization') === 'Bearer wygasly-token'
      ? json(401)
      : strumien(...ODPOWIEDZ)))

    await zapytaj('Kiedy otwieracie?')

    expect(await screen.findByText('Otwieramy o 9.')).toBeInTheDocument()
  })

  it('drugie 401 po odświeżeniu prowadzi na logowanie, jak w reszcie panelu', async () => {
    const lokalizacja = { href: '' } as Location
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: lokalizacja })
    ustawToken('wygasly-token')
    podstawBackend(() => json(401))

    await zapytaj('Kiedy otwieracie?')

    await vi.waitFor(() => expect(lokalizacja.href).toBe('/login?wygasla=1'))
  })
})

describe('strumień (A-13): ten sam parser co widget', () => {
  it('zdarzenie „data:” bez spacji nie ginie', async () => {
    ustawToken('token')
    podstawBackend(() => strumien('data:{"type":"delta","content":"Bez spacji."}\n\n', 'data:{"type":"done","source":"faq"}\n\n'))

    await zapytaj('Test')

    expect(await screen.findByText('Bez spacji.')).toBeInTheDocument()
  })

  it('jedno zepsute zdarzenie nie przerywa reszty odpowiedzi', async () => {
    ustawToken('token')
    podstawBackend(() => strumien('data: {zepsute\n\n', ...ODPOWIEDZ))

    await zapytaj('Test')

    expect(await screen.findByText('Otwieramy o 9.')).toBeInTheDocument()
    expect(screen.queryByText(/Bot nie odpowiedział/)).not.toBeInTheDocument()
  })
})

describe('dostępność (A-21)', () => {
  it('rozmowa jest regionem ogłaszanym czytnikowi ekranu', async () => {
    ustawToken('token')
    podstawBackend(() => strumien(...ODPOWIEDZ))

    await zapytaj('Kiedy otwieracie?')

    const rozmowa = screen.getByRole('log', { name: 'Rozmowa testowa' })
    expect(rozmowa).toHaveAttribute('aria-live', 'polite')
    expect(await screen.findByText('Otwieramy o 9.')).toBeInTheDocument()
  })

  it('błąd jest ogłaszany jako alert', async () => {
    ustawToken('token')
    podstawBackend(() => json(500))

    await zapytaj('Test')

    expect(await screen.findByRole('alert')).toHaveTextContent('Bot nie odpowiedział. Spróbuj ponownie.')
  })
})
