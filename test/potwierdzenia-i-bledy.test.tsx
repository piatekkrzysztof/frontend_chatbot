/**
 * Potwierdzenie usuwania i granice błędu (audyt 2026-10, A-19 i A-20).
 *
 * Kategoria ryzyka: DANE i ODPORNOSC.
 *  - A-19: źródło WWW i witrynę widgetu usuwał jeden klik, choć dokumenty,
 *    FAQ, osoby i rozmowy pytają w miejscu. Przyciski „Usuń” nie mówiły
 *    czytnikowi ekranu, czego dotyczą. Usunięcie witryny wyłącza czat na tej
 *    stronie klienta.
 *  - A-20: bez granicy błędu każdy wyjątek renderowania zostawiał pustą
 *    stronę - tak skończył A-01 w widgecie u klientów.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import * as api from '@/lib/api'
import DocumentsPage from '@/app/(panel)/(admin)/documents/page'
import SubskrypcjaPage from '@/app/(panel)/(admin)/subskrypcja/page'
import BladPanelu from '@/app/(panel)/(admin)/error'
import BladWidgetu from '@/app/(widget)/widget/error'

const ZRODLO = { id: 5, name: 'Cennik', url: 'https://rowerownia.pl/cennik', is_active: true, created_at: '2026-10-01T10:00:00Z' }

function podepnijApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/website-sources/') return [ZRODLO] as never
    if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
    if (sciezka.startsWith('/documents/?page=')) return { count: 0, next: null, previous: null, results: [] } as never
    if (sciezka === '/billing/plans/') return { current: { plan: 'start', name: 'Start', is_active: true, used: 0, limit: 10 }, plans: [] } as never
    if (sciezka === '/widget-domains/') return { domains: [{ id: 9, host: 'rowerownia.pl', last_seen: null }], limit: 3 } as never
    return null as never
  })
}

function usuniecia(apiFetch: ReturnType<typeof podepnijApi>) {
  return apiFetch.mock.calls.filter(([, opcje]) => (opcje as RequestInit | undefined)?.method === 'DELETE')
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('dwa kroki przy usuwaniu (A-19)', () => {
  it('źródło WWW: pierwszy klik pyta, drugi usuwa', async () => {
    const apiFetch = podepnijApi()
    const uzytkownik = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DocumentsPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń stronę: https://rowerownia.pl/cennik' }))
    expect(usuniecia(apiFetch)).toHaveLength(0)

    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź usunięcie strony: https://rowerownia.pl/cennik' }))
    expect(usuniecia(apiFetch).map(([sciezka]) => sciezka)).toEqual(['/website-sources/5/'])
  })

  it('witryna widgetu: pierwszy klik pyta, drugi usuwa, a pytanie samo gaśnie', async () => {
    const apiFetch = podepnijApi()
    const uzytkownik = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SubskrypcjaPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń witrynę rowerownia.pl' }))
    expect(screen.getByRole('button', { name: 'Potwierdź usunięcie witryny rowerownia.pl' })).toBeInTheDocument()
    vi.advanceTimersByTime(5100)
    expect(await screen.findByRole('button', { name: 'Usuń witrynę rowerownia.pl' })).toBeInTheDocument()
    expect(usuniecia(apiFetch)).toHaveLength(0)

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń witrynę rowerownia.pl' }))
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź usunięcie witryny rowerownia.pl' }))
    expect(usuniecia(apiFetch).map(([sciezka]) => sciezka)).toEqual(['/widget-domains/9/'])
  })
})

describe('granice błędu (A-20)', () => {
  it('panel: komunikat i ponowienie zamiast pustej strony', async () => {
    const ponow = vi.fn()
    render(<BladPanelu error={new Error('nieoczekiwany kształt odpowiedzi')} retry={ponow} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Ten ekran napotkał błąd.')
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))
    expect(ponow).toHaveBeenCalledTimes(1)
  })

  it('widget: komunikat dla odwiedzającego, bez szczegółów błędu', () => {
    render(<BladWidgetu error={new Error('SecurityError: localStorage')} retry={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Czat chwilowo nie działa.')
    expect(screen.queryByText(/SecurityError/)).not.toBeInTheDocument()
  })
})
