/**
 * Odpowiedź urwana w połowie (lista porządków po przeglądzie 2026-11).
 *
 * Kategoria ryzyka: PÓŁ ZDANIA JAKO CAŁA ODPOWIEDŹ. Gdy połączenie z modelem
 * zrywało się po pierwszych słowach, strumień kończył się jak zwykle i widget
 * zostawiał na ekranie urwane zdanie bez słowa wyjaśnienia. Backend od 2.32.34
 * dopisuje do zdarzenia końcowego `przerwana: true`.
 */
import { afterEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=test-key'),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function backend(koniec: Record<string, unknown>) {
  const tresc = [{ type: 'delta', content: 'Strzyżenie kosztuje' }, { type: 'done', ...koniec }]
    .map((e) => `data: ${JSON.stringify(e)}\n\n`)
    .join('')
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.includes('widget-settings')
          ? new Response('{}')
          : new Response(
              new ReadableStream({
                start(kontroler) {
                  kontroler.enqueue(new TextEncoder().encode(tresc))
                  kontroler.close()
                },
              }),
            ),
      ),
    ),
  )
}

async function zapytaj() {
  const uzytkownik = userEvent.setup()
  render(<WidgetChat />)
  await uzytkownik.type(screen.getByLabelText('Treść wiadomości'), 'Ile kosztuje strzyżenie?')
  await uzytkownik.click(screen.getByRole('button', { name: 'Wyślij wiadomość' }))
  await screen.findByText('Strzyżenie kosztuje')
}

it('urwana odpowiedź dostaje wyjaśnienie', async () => {
  backend({ source: 'document', przerwana: true })

  await zapytaj()

  expect(await screen.findByRole('status')).toHaveTextContent('Odpowiedź została przerwana')
})

it('pełna odpowiedź nie dostaje żadnego komunikatu', async () => {
  backend({ source: 'document' })

  await zapytaj()

  expect(screen.queryByText(/Odpowiedź została przerwana/)).not.toBeInTheDocument()
})
