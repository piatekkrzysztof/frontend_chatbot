/**
 * Pierwsze kroki na pulpicie.
 *
 * Kategoria ryzyka: WDROZENIE KLIENTA. Nowa firma widziala pulpit z zerami
 * i nie dowiadywala sie, ze bot bez wklejonego kodu nie pojawi sie na jej
 * stronie ani ze zapytania z czatu ida na adres do powiadomien. Lista mowi,
 * co zostalo, prowadzi do wlasciwego ekranu i znika, gdy wszystko zrobione.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import DashboardPage from '@/app/(admin)/dashboard/page'
import * as api from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

const ANALITYKA = {
  tenant_name: 'Rowerownia Krakowska',
  knowledge: {
    has_description: true,
    documents: 1,
    indexed_chunks: 4,
    faqs: 0,
    websites: 0,
    is_empty: false,
  },
  conversations: { total: 0, last_7d: 0, last_30d: 0 },
  questions: { total: 0, last_7d: 0, daily: [] },
  answer_sources: { document: 0, faq: 0, gpt: 0 },
  usage: { used: 0, limit: 1000, plan: 'start' },
  unanswered: [],
}

function backend(analityka: Record<string, unknown>) {
  vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/analytics/') return analityka as never
    if (sciezka === '/widget-settings/mine/') return {} as never
    throw new Error(sciezka)
  })
}

describe('Pierwsze kroki', () => {
  it('pokazuje, co zostalo, i prowadzi do wlasciwego ekranu', async () => {
    backend({
      ...ANALITYKA,
      pierwsze_kroki: {
        wiedza: true,
        rozmowa_testowa: false,
        widget_na_stronie: false,
        adres_powiadomien: true,
        polityka_prywatnosci: false,
      },
    })
    render(<DashboardPage />)

    const lista = await screen.findByRole('region', { name: 'Pierwsze kroki' })
    expect(lista).toHaveTextContent('2 z 5')
    expect(within(lista).getByRole('link', { name: /Wklej kod widgetu/ })).toHaveAttribute(
      'href',
      '/widget-settings',
    )
    expect(within(lista).getByRole('link', { name: /rozmowie testowej/ })).toHaveAttribute(
      'href',
      '/test-bota',
    )
    expect(within(lista).getByRole('link', { name: /polityki prywatności/ })).toHaveAttribute(
      'href',
      '/privacy',
    )
  })

  it('zrobiony krok mowi to slowem, nie tylko kolorem, i nie jest juz linkiem', async () => {
    backend({
      ...ANALITYKA,
      pierwsze_kroki: {
        wiedza: true,
        rozmowa_testowa: false,
        widget_na_stronie: false,
        adres_powiadomien: false,
        polityka_prywatnosci: false,
      },
    })
    render(<DashboardPage />)

    const lista = await screen.findByRole('region', { name: 'Pierwsze kroki' })
    const zrobiony = within(lista).getByText(/Dodaj wiedzę o firmie/).closest('li')
    expect(zrobiony).toHaveTextContent('Zrobione')
    expect(within(zrobiony as HTMLElement).queryByRole('link')).not.toBeInTheDocument()
  })

  it('znika, gdy wszystkie kroki sa zrobione', async () => {
    backend({
      ...ANALITYKA,
      pierwsze_kroki: {
        wiedza: true,
        rozmowa_testowa: true,
        widget_na_stronie: true,
        adres_powiadomien: true,
        polityka_prywatnosci: true,
      },
    })
    render(<DashboardPage />)

    await screen.findByRole('heading', { name: /Rowerownia Krakowska/ })
    expect(screen.queryByRole('region', { name: 'Pierwsze kroki' })).not.toBeInTheDocument()
  })

  it('backend bez tego pola nie wywraca pulpitu', async () => {
    // Panel i backend wdrazaja sie osobno. Pulpit sprzed wdrozenia backendu
    // ma dzialac jak dotad, bez listy.
    backend(ANALITYKA)
    render(<DashboardPage />)

    await screen.findByRole('heading', { name: /Rowerownia Krakowska/ })
    expect(screen.queryByRole('region', { name: 'Pierwsze kroki' })).not.toBeInTheDocument()
  })
})
