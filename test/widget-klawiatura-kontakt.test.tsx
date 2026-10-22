/**
 * Okno czatu: Escape w ramce i wysyłka kontaktu (audyt 2026-10, A-12, A-15).
 *
 * Kategoria ryzyka: STRONA KLIENTA.
 *  - A-12: embed.js zamyka okno Escape'em, ale słucha na dokumencie strony
 *    klienta. Gdy ktoś pisze w czacie, ognisko jest w ramce i zdarzenia
 *    klawiatury tam zostają - okno się nie zamykało. Widget prosi więc stronę
 *    o zamknięcie komunikatem (embed.js sprawdza nadawcę, test/embed.test.ts).
 *  - A-15: wysyłka kontaktu nie była blokowana w trakcie zapytania, więc
 *    dwuklik dawał dwa zapytania w „Zapytaniach” i dwa maile do firmy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

function json(status: number, cialo: unknown = {}) {
  return new Response(JSON.stringify(cialo), { status, headers: { 'Content-Type': 'application/json' } })
}

const opisRodzica = Object.getOwnPropertyDescriptor(window, 'parent')

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((adres: string) => Promise.resolve(
    String(adres).includes('/widget-settings/') ? json(200, USTAWIENIA) : json(204),
  )))
})

afterEach(() => {
  if (opisRodzica) Object.defineProperty(window, 'parent', opisRodzica)
  vi.unstubAllGlobals()
})

describe('Escape w ramce (A-12)', () => {
  it('prosi stronę klienta o zamknięcie okna', async () => {
    const rodzic = { postMessage: vi.fn() }
    Object.defineProperty(window, 'parent', { configurable: true, value: rodzic })
    render(<WidgetChat />)
    const pole = await screen.findByLabelText('Treść wiadomości')

    fireEvent.keyDown(pole, { key: 'Escape' })

    expect(rodzic.postMessage).toHaveBeenCalledWith({ zrodlo: 'sm-art-widget', typ: 'zamknij' }, '*')
  })

  it('poza ramką (widget otwarty bezpośrednio) nie wysyła nic', async () => {
    const wyslij = vi.spyOn(window, 'postMessage')
    render(<WidgetChat />)

    fireEvent.keyDown(await screen.findByLabelText('Treść wiadomości'), { key: 'Escape' })

    expect(wyslij).not.toHaveBeenCalled()
  })
})

describe('wysyłka kontaktu (A-15)', () => {
  it('dwuklik w „Wyślij” wysyła jedno zapytanie, a przycisk czeka na odpowiedź', async () => {
    let zakoncz!: (odpowiedz: Response) => void
    vi.mocked(fetch).mockImplementation((adres) => {
      const url = String(adres)
      if (url.includes('/widget-settings/')) return Promise.resolve(json(200, USTAWIENIA))
      if (url.includes('/widget/contact/')) return new Promise((resolve) => { zakoncz = resolve })
      return Promise.resolve(json(204))
    })
    const uzytkownik = userEvent.setup()
    render(<WidgetChat />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Zostaw kontakt' }))
    await uzytkownik.type(screen.getByLabelText('Twój e-mail lub telefon'), 'jan@firma.pl')
    await uzytkownik.dblClick(screen.getByRole('button', { name: 'Wyślij' }))

    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    zakoncz(json(201))
    expect(await screen.findByText(/przekazaliśmy Twój kontakt/)).toBeInTheDocument()

    const kontakty = vi.mocked(fetch).mock.calls.filter(([adres]) => String(adres).includes('/widget/contact/'))
    expect(kontakty).toHaveLength(1)
  })
})
