/**
 * Marka widgetu, gdy odczyt ustawień się nie uda (przegląd 2026-11, R16).
 *
 * Kategoria ryzyka: CUDZA MARKA u klienta, który zapłacił za własną. Jeden
 * nieudany odczyt ustawień (chwilowy błąd sieci, 503 przy wdrożeniu) i widget
 * firmy z białą etykietą podpisywał się „SM-art" ze stopką „SM-art Chat" do
 * końca odsłony strony - przed klientami tej firmy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import WidgetChat from '@/components/widget/WidgetChat'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=klucz-testowy'),
}))

const WLASNA_MARKA = {
  widget_title: 'Salon Aurora',
  widget_color: '#0a7d5a',
  widget_position: 'right',
  branding_mode: 'white_label',
  widget_footer_text: '',
  widget_suggested_questions: [],
  widget_languages: ['pl'],
}

function odpowiedz(status: number, cialo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    json: () => Promise.resolve(cialo),
  } as unknown as Response
}

/** Kolejne odpowiedzi na odczyt ustawień; ostatnia powtarza się bez końca. */
function ustawieniaPoKolei(...odpowiedzi: Array<Response | Error>) {
  let numer = 0
  const atrapa = vi.fn((adres: string) => {
    if (!String(adres).includes('/widget-settings/')) {
      return Promise.resolve(odpowiedz(404, {}))
    }
    const wynik = odpowiedzi[Math.min(numer, odpowiedzi.length - 1)]
    numer += 1
    return wynik instanceof Error ? Promise.reject(wynik) : Promise.resolve(wynik)
  })
  vi.stubGlobal('fetch', atrapa)
  return atrapa
}

function odczytyUstawien(atrapa: ReturnType<typeof ustawieniaPoKolei>) {
  return atrapa.mock.calls.filter(([adres]) => String(adres).includes('/widget-settings/')).length
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('marka po nieudanym odczycie ustawień', () => {
  it('bez ustawień widget nie podpisuje się cudzą marką', async () => {
    ustawieniaPoKolei(odpowiedz(503, {}))

    render(<WidgetChat />)
    await screen.findByPlaceholderText(/Napisz wiadomość/i)

    expect(screen.queryByText('SM-art')).toBeNull()
    expect(screen.queryByText('SM-art Chat')).toBeNull()
  })

  it('nieudany odczyt jest ponawiany i marka klienta wraca', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const atrapa = ustawieniaPoKolei(new Error('sieć'), odpowiedz(200, WLASNA_MARKA))

    render(<WidgetChat />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    await waitFor(() => expect(screen.getByText('Salon Aurora')).toBeTruthy())
    expect(odczytyUstawien(atrapa)).toBe(2)
  })

  it('po błędzie zostaje marka z ostatniego udanego odczytu', async () => {
    ustawieniaPoKolei(odpowiedz(200, WLASNA_MARKA))
    const pierwsza = render(<WidgetChat />)
    await screen.findByText('Salon Aurora')
    pierwsza.unmount()

    // Następna odsłona strony: API nie odpowiada.
    ustawieniaPoKolei(odpowiedz(503, {}))
    render(<WidgetChat />)

    await screen.findByText('Salon Aurora')
    expect(screen.queryByText('SM-art')).toBeNull()
  })

  it('ponawianie ma koniec', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const atrapa = ustawieniaPoKolei(odpowiedz(503, {}))

    render(<WidgetChat />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })

    expect(odczytyUstawien(atrapa)).toBe(3)
  })

  it('udany odczyt marki SM-art pokazuje ją jak dotąd', async () => {
    ustawieniaPoKolei(odpowiedz(200, { ...WLASNA_MARKA, branding_mode: 'smart' }))

    render(<WidgetChat />)

    await screen.findByText('SM-art')
    expect(screen.getByText('SM-art Chat')).toBeTruthy()
  })
})
