/**
 * Widget przy odmowie „serwer zajęty" (503 server_busy).
 *
 * Do 2.24 odwiedzający dostawał „Wystąpił błąd. Spróbuj ponownie." - na
 * stronie klienta wyglądało to na awarię jego czatu, choć serwer odmawiał
 * tylko dlatego, że w tej sekundzie obsługiwał inne rozmowy. Widget ma
 * odczekać i spróbować sam, a dopiero po kilku próbach powiedzieć, co się dzieje.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
}))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function zajety() {
  return new Response(
    JSON.stringify({ detail: 'Serwer obsługuje teraz inne zadania.', code: 'server_busy' }),
    { status: 503, headers: { 'Retry-After': '1', 'Content-Type': 'application/json' } },
  )
}

function odpowiedz() {
  const zdarzenia = [{ type: 'delta', content: 'Torty od 120 zł.' }, { type: 'done' }]
  return new Response(zdarzenia.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''))
}

function backend(czat: () => Response) {
  const fetch = vi.fn((url: string) => Promise.resolve(
    url.includes('widget-settings') ? new Response('{}') : czat(),
  ))
  vi.stubGlobal('fetch', fetch)
  return () => fetch.mock.calls.filter(([url]) => String(url).includes('/chat/stream/')).length
}

async function wyslij() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.type(screen.getByLabelText('Treść wiadomości'), 'Ile kosztuje tort?')
  await user.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }))
}

it('ponawia sam i pokazuje odpowiedź - odwiedzający nie widzi błędu', async () => {
  let proby = 0
  const ileWyslan = backend(() => (++proby <= 2 ? zajety() : odpowiedz()))
  render(<WidgetChat />)

  await wyslij()
  expect(await screen.findByRole('status')).toHaveTextContent('Chwileczkę')
  await act(() => vi.advanceTimersByTimeAsync(5000))

  expect(await screen.findByText('Torty od 120 zł.')).toBeInTheDocument()
  expect(ileWyslan()).toBe(3)
  expect(screen.queryByText(/Wystąpił błąd/)).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('po kilku próbach mówi, co się dzieje, zamiast ogólnego błędu', async () => {
  const ileWyslan = backend(zajety)
  render(<WidgetChat />)

  await wyslij()
  await act(() => vi.advanceTimersByTimeAsync(15000))

  expect(await screen.findByText(/Rozmawiamy teraz z wieloma osobami naraz/)).toBeInTheDocument()
  expect(screen.queryByText(/Wystąpił błąd/)).not.toBeInTheDocument()
  // Pierwsza próba i cztery ponowienia - bez nieskończonej pętli.
  expect(ileWyslan()).toBe(5)
})

it('inny błąd 503 nie jest ponawiany', async () => {
  const ileWyslan = backend(() => new Response('{}', { status: 503 }))
  render(<WidgetChat />)

  await wyslij()
  await act(() => vi.advanceTimersByTimeAsync(15000))

  expect(await screen.findByText('Wystąpił błąd. Spróbuj ponownie.')).toBeInTheDocument()
  expect(ileWyslan()).toBe(1)
})
