import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'
import TestBotaPage from '@/app/(admin)/test-bota/page'
import { apiFetch } from '@/lib/api'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
}))
vi.mock('@/lib/api', () => ({
  API_URL: 'http://localhost/api', authHeaders: () => ({}),
  apiFetch: vi.fn(() => Promise.resolve({ messages: [] })),
}))

afterEach(() => vi.unstubAllGlobals())

const historyKey = 'widget_history_test-key'
const sessionKey = 'widget_session_test-key'

function stream() {
  // Delta po error w tym samym pakiecie nie może wrócić na ekran.
  const payload = [
    { type: 'delta', content: 'fragment sekretu' },
    { type: 'error', code: 'conversation_deleted', message: 'Rozmowa została usunięta.' },
    { type: 'delta', content: 'spóźniony sekret' },
  ].map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
  return new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(payload)) },
  }))
}

function mockBackend(chat: () => Response, contact: () => Response = () => new Response('{}')) {
  const fetch = vi.fn((url: string) => Promise.resolve(
    url.includes('widget-settings') ? new Response('{}') : url.includes('/contact/') ? contact() : chat(),
  ))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function send(text = 'pytanie') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Treść wiadomości'), text)
  await user.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }))
}

it.each(['http', 'sse'])('widget czyści starą historię po usunięciu (%s), kolejne pytanie dostaje nowy UUID', async mode => {
  localStorage.setItem(sessionKey, 'stara-sesja')
  localStorage.setItem(historyKey, JSON.stringify([{ sender: 'user', text: 'stara treść' }]))
  let count = 0
  const fetch = mockBackend(() => {
    count += 1
    if (count === 1) return mode === 'http' ? new Response('{}', { status: 410 }) : stream()
    return new Response('data: {"type":"done"}\n\n')
  })
  render(<WidgetChat />)
  expect(await screen.findByText('stara treść')).toBeInTheDocument()
  await send()
  expect(await screen.findByRole('status')).toHaveTextContent('Rozmowa została usunięta')
  expect(screen.queryByText('stara treść')).not.toBeInTheDocument()
  expect(screen.queryByText(/sekret/)).not.toBeInTheDocument()
  expect(localStorage.getItem(sessionKey)).toBeNull()
  expect(localStorage.getItem(historyKey)).not.toContain('stara treść')
  await send('nowe pytanie')
  const calls = vi.mocked(globalThis.fetch).mock.calls.filter(([url]) => String(url).includes('/chat/'))
  const body = JSON.parse(calls[1][1]!.body as string)
  expect(body.message).toBe('nowe pytanie')
  expect(body.conversation_session_id).not.toBe('stara-sesja')
  expect(fetch).toHaveBeenCalledTimes(3)
})

it.each([410, 503])('kontakt nie zgłasza sukcesu po HTTP %s', async status => {
  localStorage.setItem(sessionKey, 'stara-sesja')
  mockBackend(() => new Response('{}'), () => new Response('{}', { status }))
  render(<WidgetChat />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Zostaw kontakt/i }))
  await user.type(screen.getByLabelText('Twój e-mail lub telefon'), 'a@example.test')
  await user.click(screen.getByRole('button', { name: 'Wyślij' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
    status === 410 ? 'Rozmowa została usunięta' : 'Nie udało się wysłać kontaktu',
  ))
  expect(screen.queryByText(/przekazaliśmy Twój kontakt/)).not.toBeInTheDocument()
  if (status === 410) expect(localStorage.getItem(sessionKey)).toBeNull()
  else expect(screen.getByLabelText('Twój e-mail lub telefon')).toHaveValue('a@example.test')
})

it('panel usuwa fragment odpowiedzi po terminalnym błędzie SSE', async () => {
  mockBackend(stream)
  render(<TestBotaPage />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Pytanie do bota'), 'pytanie')
  await user.click(screen.getByRole('button', { name: 'Wyślij' }))
  expect(await screen.findByText(/Rozmowa została usunięta/)).toBeInTheDocument()
  expect(screen.queryByText(/sekret/)).not.toBeInTheDocument()
  expect(screen.queryByText('pytanie')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Pytanie do bota')).toBeEnabled()
})

it('czyszczenie panelu przerywa strumień i ignoruje spóźniony odczyt historii', async () => {
  let history!: (value: { messages: { sender: string; text: string }[] }) => void
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { history = resolve }))
  let provider!: ReadableStreamDefaultController<Uint8Array>
  const cancel = vi.fn()
  mockBackend(() => new Response(new ReadableStream({
    start(controller) {
      provider = controller
      controller.enqueue(new TextEncoder().encode('data: {"type":"delta","content":"fragment"}\n\n'))
    }, cancel,
  })))
  render(<TestBotaPage />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Pytanie do bota'), 'pytanie')
  await user.click(screen.getByRole('button', { name: 'Wyślij' }))
  await screen.findByText('fragment')
  await user.click(screen.getByRole('button', { name: /Wyczyść rozmowę/ }))
  await act(async () => {
    history({ messages: [{ sender: 'bot', text: 'stara historia' }] })
    provider.enqueue(new TextEncoder().encode('data: {"type":"delta","content":"sekret"}\n\n'))
  })
  await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
  expect(screen.queryByText(/sekret|fragment|stara historia/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Pytanie do bota')).toBeEnabled()
})
