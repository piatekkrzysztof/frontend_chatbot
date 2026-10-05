/**
 * Usuwanie rozmowy: z Konwersacji jednym przyciskiem, a widget to zauwaza.
 *
 * Kategoria ryzyka: USUNIECIE, KTORE WYGLADA NA NIEUDANE. Odbior 5.10.2026:
 * wlasciciel usunal rozmowe, a w przegladarce odwiedzajacego zostala w calosci.
 * Widget pokazywal historie z localStorage bez pytania serwera i czyscil ja
 * dopiero przy nastepnej wyslanej wiadomosci. Do tego usuniecie wymagalo
 * skopiowania identyfikatora i wklejenia go w innej zakladce.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'
import ConversationsPage from '@/app/(admin)/conversations/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
}))

const SESJA = '11111111-2222-3333-4444-555555555555'
const historyKey = 'widget_history_test-key'
const sessionKey = 'widget_session_test-key'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

// --- widget ------------------------------------------------------------------

function zapiszRozmowe() {
  localStorage.setItem(sessionKey, SESJA)
  localStorage.setItem(historyKey, JSON.stringify([{ sender: 'user', text: 'stara treść' }]))
}

function backendWidgetu(status: () => Promise<Response>) {
  const fetch = vi.fn((url: string) =>
    url.includes('/widget/rozmowa/') ? status() : Promise.resolve(new Response('{}')),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('widget przy otwarciu', () => {
  it('nie pokazuje rozmowy usunietej przez firme', async () => {
    zapiszRozmowe()
    backendWidgetu(() => Promise.resolve(new Response('{}', { status: 410 })))

    render(<WidgetChat />)

    expect(await screen.findByRole('status')).toHaveTextContent('Rozmowa została usunięta')
    expect(screen.queryByText('stara treść')).not.toBeInTheDocument()
    expect(localStorage.getItem(sessionKey)).toBeNull()
    expect(localStorage.getItem(historyKey) ?? '').not.toContain('stara treść')
  })

  it('usunieta rozmowa nie miga na ekranie przed odpowiedzia serwera', async () => {
    // Pokazana od razu i schowana po chwili - to jest dokladnie ten widok,
    // ktory odwiedzajacy prosil, zeby zniknal.
    zapiszRozmowe()
    let odpowiedz!: (r: Response) => void
    backendWidgetu(() => new Promise((ok) => (odpowiedz = ok)))

    render(<WidgetChat />)
    await waitFor(() => expect(odpowiedz).toBeDefined())

    expect(screen.queryByText('stara treść')).not.toBeInTheDocument()
    odpowiedz(new Response('{}', { status: 410 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Rozmowa została usunięta')
  })

  it('pokazuje rozmowe, ktora nadal istnieje', async () => {
    zapiszRozmowe()
    backendWidgetu(() => Promise.resolve(new Response(null, { status: 204 })))

    render(<WidgetChat />)

    expect(await screen.findByText('stara treść')).toBeInTheDocument()
    expect(localStorage.getItem(sessionKey)).toBe(SESJA)
  })

  it('przy bledzie sieci zostawia historie odwiedzajacemu', async () => {
    // Nieudane sprawdzenie nie moze kasowac komus jego wlasnej kopii rozmowy.
    zapiszRozmowe()
    backendWidgetu(() => Promise.reject(new TypeError('Failed to fetch')))

    render(<WidgetChat />)

    expect(await screen.findByText('stara treść')).toBeInTheDocument()
  })

  it('backend bez nowej trasy (404) zostawia historie - kolejnosc wdrozenia dowolna', async () => {
    // Backend sprzed 2.21.0 nie zna /widget/rozmowa/ i odpowiada 404. Widget
    // ma sie wtedy zachowac dokladnie jak dotad, zeby panel mogl wejsc
    // na produkcje przed backendem albo po nim.
    zapiszRozmowe()
    backendWidgetu(() => Promise.resolve(new Response('{}', { status: 404 })))

    render(<WidgetChat />)

    expect(await screen.findByText('stara treść')).toBeInTheDocument()
  })

  it('bez zapisanej rozmowy nie pyta serwera', async () => {
    const fetch = backendWidgetu(() => Promise.resolve(new Response(null, { status: 204 })))

    render(<WidgetChat />)
    await screen.findByLabelText('Treść wiadomości')

    expect(fetch.mock.calls.some(([url]) => String(url).includes('/widget/rozmowa/'))).toBe(false)
  })
})

// --- Konwersacje ---------------------------------------------------------------

const WPIS = {
  id: 1,
  conversation_session_id: SESJA,
  prompt: 'Ile kosztuje chleb?',
  response: '5 zł',
  source: 'widget',
  tokens: 10,
  created_at: '2026-10-05T10:00:00Z',
  is_helpful: null,
}

function backendPanelu(mojaRola: string, przyUsunieciu: () => unknown = () => ({ deleted: { Conversation: 1, PromptLog: 2 } })) {
  let usunieta = false
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
    if (sciezka.startsWith('/privacy/conversations/') && opcje?.method === 'DELETE') {
      const wynik = przyUsunieciu()
      usunieta = true
      return wynik as never
    }
    if (sciezka.startsWith('/chat/logs/')) {
      const wyniki = usunieta ? [] : [WPIS]
      return { count: wyniki.length, next: null, previous: null, results: wyniki } as never
    }
    if (sciezka === '/accounts/me/') return { role: mojaRola } as never
    return null as never
  })
}

function wywolaniaUsuniecia(szpieg: ReturnType<typeof backendPanelu>) {
  return szpieg.mock.calls.filter(([, opcje]) => (opcje as RequestInit | undefined)?.method === 'DELETE')
}

describe('Konwersacje: usuwanie rozmowy', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

  it('pierwszy klik pyta i niczego nie usuwa', async () => {
    const szpieg = backendPanelu('owner')
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń rozmowę' }))

    expect(screen.getByRole('button', { name: /Potwierdź: usuń całą rozmowę/ })).toBeVisible()
    expect(wywolaniaUsuniecia(szpieg)).toHaveLength(0)
  })

  it('drugi klik usuwa cala rozmowe tym samym wywolaniem co Prywatnosc', async () => {
    const szpieg = backendPanelu('employee')
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń rozmowę' }))
    await uzytkownik.click(screen.getByRole('button', { name: /Potwierdź: usuń całą rozmowę/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Usunięto rozmowę')
    expect(wywolaniaUsuniecia(szpieg)[0][0]).toBe(`/privacy/conversations/${SESJA}/`)
    await waitFor(() => expect(screen.queryByText('Ile kosztuje chleb?')).not.toBeInTheDocument())
  })

  it('podglad nie widzi przycisku', async () => {
    backendPanelu('viewer')
    render(<ConversationsPage />)

    await screen.findByText('Ile kosztuje chleb?')

    expect(screen.queryByRole('button', { name: 'Usuń rozmowę' })).toBeNull()
  })

  it('rozmowa usunieta wczesniej daje zrozumiale zdanie, nie blad techniczny', async () => {
    backendPanelu('owner', () => {
      throw new BladApi(404, 'Not found')
    })
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń rozmowę' }))
    await uzytkownik.click(screen.getByRole('button', { name: /Potwierdź: usuń całą rozmowę/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tej rozmowy już nie ma')
  })
})
