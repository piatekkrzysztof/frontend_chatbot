/**
 * Dwa miejsca, w których ekran rozjeżdżał się z tym, co się stało
 * (przegląd 2026-11, R18).
 *
 * Kategoria ryzyka: UDANE DZIAŁANIE, KTÓRE WYGLĄDA NA NIEUDANE.
 *
 * 1. Usunięcie ostatniego wiersza z ostatniej strony listy. Wiersz znikał
 *    z bazy, ale lista prosiła o stronę, której już nie było: backend
 *    odpowiadał 404, a ekran pokazywał błąd nad starą listą z usuniętym
 *    wierszem. Wyglądało to tak, jakby usuwanie się nie udało.
 * 2. Pytanie wysłane w widgecie, zanim wczytała się zapisana rozmowa.
 *    Pytanie pojawiało się na ekranie, po czym wczytana historia je
 *    nadpisywała: odpowiedź bota stała pod rozmową bez pytania.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'
import ConversationsPage from '@/app/(panel)/(admin)/conversations/page'
import DocumentsPage from '@/app/(panel)/(admin)/documents/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const BRAK_STRONY = 'Nieprawidłowa strona.'

function numerStrony(sciezka: string) {
  return Number(new URLSearchParams(sciezka.split('?')[1] ?? '').get('page') ?? '1')
}

// --- Konwersacje ---------------------------------------------------------------

function wpis(id: number, sesja: string, pytanie: string) {
  return {
    id,
    conversation_session_id: sesja,
    prompt: pytanie,
    response: 'Odpowiedź',
    source: 'widget',
    tokens: 10,
    created_at: '2026-11-10T10:00:00Z',
    is_helpful: null,
  }
}

describe('Konwersacje: usunięcie ostatniej rozmowy z ostatniej strony', () => {
  it('pokazuje poprzednią stronę zamiast błędu i starego wiersza', async () => {
    const nowsza = wpis(1, 'aaaaaaaa-0000-0000-0000-000000000001', 'Pytanie z pierwszej strony')
    const starsza = wpis(2, 'aaaaaaaa-0000-0000-0000-000000000002', 'Pytanie z drugiej strony')
    let usunieta = false
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
      if (sciezka.startsWith('/privacy/conversations/') && opcje?.method === 'DELETE') {
        usunieta = true
        return { deleted: { Conversation: 1, PromptLog: 1 } } as never
      }
      if (sciezka.startsWith('/chat/logs/')) {
        if (numerStrony(sciezka) === 1) {
          return {
            count: usunieta ? 1 : 2,
            next: usunieta ? null : 'x',
            previous: null,
            results: [nowsza],
          } as never
        }
        if (usunieta) throw new BladApi(404, BRAK_STRONY)
        return { count: 2, next: null, previous: 'x', results: [starsza] } as never
      }
      if (sciezka === '/accounts/me/') return { role: 'owner' } as never
      return null as never
    })
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)

    await screen.findByText('Pytanie z pierwszej strony')
    await uzytkownik.click(screen.getByRole('button', { name: 'Starsze' }))
    await screen.findByText('Pytanie z drugiej strony')
    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń rozmowę' }))
    await uzytkownik.click(screen.getByRole('button', { name: /Potwierdź: usuń całą rozmowę/ }))

    expect(await screen.findByText('Pytanie z pierwszej strony')).toBeInTheDocument()
    expect(screen.queryByText('Pytanie z drugiej strony')).not.toBeInTheDocument()
    expect(screen.queryByText(BRAK_STRONY)).not.toBeInTheDocument()
  })
})

// --- Dokumenty -----------------------------------------------------------------

function dokument(id: number, nazwa: string) {
  return {
    id,
    name: nazwa,
    processed: true,
    uploaded_at: '2026-11-10T10:00:00Z',
    chunk_count: 3,
    status: 'ready',
    uzywaj_w_wyszukiwaniu: true,
    source_url: '',
    ma_plik: true,
  }
}

describe('Baza wiedzy: usunięcie ostatniego dokumentu z ostatniej strony', () => {
  it('pokazuje poprzednią stronę zamiast błędu i usuniętego dokumentu', async () => {
    let usuniety = false
    vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
      if (sciezka === '/documents/12/' && opcje?.method === 'DELETE') {
        usuniety = true
        return null as never
      }
      if (sciezka === '/website-sources/') return [] as never
      if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
      if (sciezka.startsWith('/documents/?page=')) {
        if (numerStrony(sciezka) === 1) {
          return {
            count: usuniety ? 1 : 2,
            next: usuniety ? null : 'x',
            previous: null,
            results: [dokument(11, 'cennik.pdf')],
          } as never
        }
        if (usuniety) throw new BladApi(404, BRAK_STRONY)
        return {
          count: 2,
          next: null,
          previous: 'x',
          results: [dokument(12, 'regulamin.pdf')],
        } as never
      }
      return null as never
    })
    const uzytkownik = userEvent.setup()
    render(<DocumentsPage />)

    await screen.findByText('cennik.pdf')
    await uzytkownik.click(screen.getByRole('button', { name: 'Starsze' }))
    await screen.findByText('regulamin.pdf')
    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: regulamin.pdf' }))
    await uzytkownik.click(
      screen.getByRole('button', { name: 'Potwierdź usunięcie: regulamin.pdf' }),
    )

    expect(await screen.findByText('cennik.pdf')).toBeInTheDocument()
    expect(screen.queryByText('regulamin.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText(BRAK_STRONY)).not.toBeInTheDocument()
  })
})

// --- Widget --------------------------------------------------------------------

describe('widget: pytanie wysłane przed wczytaniem zapisanej rozmowy', () => {
  it('zostaje na ekranie pod wczytaną historią', async () => {
    localStorage.setItem('widget_session_test-key', '11111111-2222-3333-4444-555555555555')
    localStorage.setItem(
      'widget_history_test-key',
      JSON.stringify([{ sender: 'user', text: 'stara treść' }]),
    )
    let odpowiedzNaSprawdzenie!: (r: Response) => void
    const odpowiedzBota = [
      { type: 'delta', content: 'Otwarte od 9 do 17.' },
      { type: 'done' },
    ]
      .map((e) => `data: ${JSON.stringify(e)}\n\n`)
      .join('')
    const siec = vi.fn((url: string) => {
      if (url.includes('/widget/rozmowa/')) {
        return new Promise<Response>((ok) => (odpowiedzNaSprawdzenie = ok))
      }
      if (url.includes('widget-settings')) return Promise.resolve(new Response('{}'))
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(kontroler) {
              kontroler.enqueue(new TextEncoder().encode(odpowiedzBota))
              kontroler.close()
            },
          }),
        ),
      )
    })
    vi.stubGlobal('fetch', siec)
    const uzytkownik = userEvent.setup()
    render(<WidgetChat />)
    await waitFor(() => expect(odpowiedzNaSprawdzenie).toBeDefined())

    // Historia jeszcze się nie wczytała, a odwiedzający już pyta.
    await uzytkownik.type(screen.getByLabelText('Treść wiadomości'), 'Jakie godziny otwarcia?')
    await uzytkownik.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }))
    odpowiedzNaSprawdzenie(new Response(null, { status: 204 }))

    expect(await screen.findByText('Otwarte od 9 do 17.')).toBeInTheDocument()
    expect(screen.getByText('stara treść')).toBeInTheDocument()
    expect(screen.getByText('Jakie godziny otwarcia?')).toBeInTheDocument()
    // Pytanie poszło do bota dokładnie raz.
    const doBota = siec.mock.calls.filter(([url]) => String(url).includes('/widget/chat/'))
    expect(doBota).toHaveLength(1)
  })
})
