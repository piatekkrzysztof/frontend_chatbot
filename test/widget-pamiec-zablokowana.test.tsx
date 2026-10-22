/**
 * Widget, gdy przeglądarka nie daje mu localStorage.
 *
 * Kategoria ryzyka: CICHA AWARIA po stronie odwiedzającego. Ramka czatu stoi
 * na cudzej stronie, więc dla przeglądarki to pamięć strony trzeciej. Chrome
 * z ustawieniem „Blokuj pliki cookie innych firm” rzuca SecurityError już przy
 * samym odczycie `window.localStorage` (sprawdzone w Chrome 155, audyt
 * 22.10.2026). Widget padał wtedy w całości - zamiast okna czatu ramka
 * pokazywała „This page couldn't load”, a klient firmy nie wiedział, że jego
 * czat dla części odwiedzających w ogóle nie istnieje.
 *
 * Atrapa rzuca dokładnie tak jak Chrome: przy odczycie właściwości, a nie
 * dopiero przy getItem.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=klucz-testowy'),
}))

const USTAWIENIA = {
  widget_title: 'Zapytaj nas',
  widget_color: '#F97316',
  widget_position: 'right',
  branding_mode: 'smart',
  widget_suggested_questions: [],
}

const opisPamieci = Object.getOwnPropertyDescriptor(window, 'localStorage')!

function zablokujPamiec() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
        'SecurityError',
      )
    },
  })
}

function odpowiedzBota(tresc: string) {
  return new Response(new ReadableStream({
    start(kontroler) {
      kontroler.enqueue(new TextEncoder().encode(
        `data: {"type":"delta","content":"${tresc}"}\n\ndata: {"type":"done","source":"faq"}\n\n`,
      ))
      kontroler.close()
    },
  }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((adres: string) => {
    if (String(adres).includes('/widget-settings/')) {
      return Promise.resolve(new Response(JSON.stringify(USTAWIENIA)))
    }
    return Promise.resolve(odpowiedzBota('Otwieramy o 9.'))
  }))
  zablokujPamiec()
})

afterEach(() => {
  // Przed localStorage.clear() z test/setup.ts
  Object.defineProperty(window, 'localStorage', opisPamieci)
  vi.unstubAllGlobals()
})

async function napisz(uzytkownik: ReturnType<typeof userEvent.setup>, tresc: string) {
  await uzytkownik.type(await screen.findByLabelText('Treść wiadomości'), tresc)
  await uzytkownik.keyboard('{Enter}')
}

it('okno czatu wstaje mimo zablokowanej pamięci', async () => {
  render(<WidgetChat />)

  expect(await screen.findByLabelText('Treść wiadomości')).toBeInTheDocument()
})

it('rozmowa działa i trzyma jedną sesję, choć nie przeżyje odświeżenia strony', async () => {
  const uzytkownik = userEvent.setup()
  render(<WidgetChat />)

  await napisz(uzytkownik, 'Kiedy otwieracie?')
  expect(await screen.findByText('Otwieramy o 9.')).toBeInTheDocument()
  await napisz(uzytkownik, 'A w sobotę?')
  await screen.findByText('A w sobotę?')

  const sesje = vi.mocked(fetch).mock.calls
    .filter(([adres]) => String(adres).includes('/widget/chat/stream/'))
    .map(([, opcje]) => JSON.parse(String((opcje as RequestInit).body)).conversation_session_id)
  expect(sesje).toHaveLength(2)
  // Bez tego każde pytanie zaczynałoby nową rozmowę i bot gubiłby kontekst
  expect(sesje[0]).toBe(sesje[1])
  expect(sesje[0]).toMatch(/^[0-9a-f-]{36}$/)
})
