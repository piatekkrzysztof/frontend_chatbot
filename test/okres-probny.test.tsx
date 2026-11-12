/**
 * Okres próbny i wygasła subskrypcja w panelu (R05, backend 2.32.23).
 *
 * Kategoria ryzyka: KLIENT NIE WIE, ZE CZAT NIE DZIALA. Okres próbny to plan
 * Start bez Stripe i wyglądał w panelu jak opłacony Start, bez daty końca.
 * Po 14 dniach pulpit nadal pisał „Asystent aktywny" - `is_active` zostaje
 * prawdą, a widget sprawdza daty przy każdej wiadomości i odmawiał każdemu.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(panel)/(admin)/dashboard/page'
import SubskrypcjaPage from '@/app/(panel)/(admin)/subskrypcja/page'
import * as api from '@/lib/api'
import { dataPl } from '@/lib/daty'

afterEach(() => {
  vi.restoreAllMocks()
})

const PLANY = [
  { code: 'start', name: 'Start', price_pln: 149, message_limit: 2000, white_label: false, available: true, current: false },
  { code: 'grow', name: 'Grow', price_pln: 349, message_limit: 8000, white_label: false, available: true, current: false },
]

const PROBNY = {
  plan: 'start',
  name: 'Start',
  in_catalogue: true,
  is_active: true,
  is_trial: true,
  trial_ends_at: '2026-11-26',
  has_access: true,
  expired: false,
  used: 12,
  limit: 2000,
  renews_at: '2026-11-26',
  stripe_status: '',
  access_until: '2026-11-26',
  has_stripe_subscription: false,
  portal_available: false,
  can_manage: true,
  cancel_at: null,
  scheduled_plan: null,
  scheduled_plan_name: null,
  scheduled_plan_from: null,
}

const PROBNY_PO_KONCU = {
  ...PROBNY,
  trial_ends_at: '2026-11-10',
  renews_at: '2026-11-10',
  access_until: '2026-11-10',
  has_access: false,
  expired: true,
}

function subskrypcja(current: Record<string, unknown>) {
  vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/billing/plans/') return { current, plans: PLANY } as never
    if (sciezka === '/widget-domains/') return { domains: [], limit: 1 } as never
    throw new Error(sciezka)
  })
}

const ANALITYKA = {
  tenant_name: 'Rowerownia',
  knowledge: {
    has_description: true,
    documents: 1,
    indexed_chunks: 4,
    faqs: 1,
    websites: 1,
    is_empty: false,
  },
  conversations: { total: 3, last_7d: 3, last_30d: 3 },
  questions: { total: 5, last_7d: 5, daily: [] },
  answer_sources: { document: 4, faq: 1, gpt: 0 },
  unanswered: [],
}

function pulpit(usage: Record<string, unknown>) {
  vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/analytics/') return { ...ANALITYKA, usage } as never
    if (sciezka === '/widget-settings/mine/') return {} as never
    throw new Error(sciezka)
  })
}

describe('dataPl', () => {
  it('nie przesuwa dnia o strefę czasową i znosi brak daty', () => {
    expect(dataPl('2026-11-26')).toBe('26.11.2026')
    expect(dataPl(null)).toBe('')
    expect(dataPl(undefined)).toBe('')
  })
})

describe('Subskrypcja w okresie próbnym', () => {
  it('nazywa okres próbny i podaje jego ostatni dzień', async () => {
    subskrypcja(PROBNY)
    render(<SubskrypcjaPage />)

    expect(await screen.findByText('okres próbny')).toBeInTheDocument()
    expect(screen.getByText(/Okres próbny trwa do 26\.11\.2026 włącznie/)).toBeInTheDocument()
    expect(screen.getByText(/Wybierz plan poniżej, żeby działał dalej/)).toBeInTheDocument()
    expect(screen.queryByText('wygasł')).not.toBeInTheDocument()
  })

  it('po końcu okresu mówi wprost, że chatbot nie odpowiada', async () => {
    subskrypcja(PROBNY_PO_KONCU)
    render(<SubskrypcjaPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Okres próbny trwał do 10.11.2026.')
    expect(alert).toHaveTextContent('Chatbot nie odpowiada odwiedzającym.')
    expect(screen.getByText('wygasł')).toBeInTheDocument()
    expect(screen.queryByText(/Okres próbny trwa do/)).not.toBeInTheDocument()
    // Najtańszy plan da się kupić - po to jest ten komunikat
    expect(screen.getAllByRole('button', { name: 'Wybierz plan' })).toHaveLength(2)
  })

  it('wygasła płatna subskrypcja nie udaje okresu próbnego', async () => {
    subskrypcja({ ...PROBNY_PO_KONCU, is_trial: false, trial_ends_at: null })
    render(<SubskrypcjaPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Subskrypcja działała do 10.11.2026.')
    expect(screen.queryByText('okres próbny')).not.toBeInTheDocument()
  })

  it('pracownik nie dostaje wezwania do wyboru planu', async () => {
    subskrypcja({ ...PROBNY_PO_KONCU, can_manage: false })
    render(<SubskrypcjaPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Plan wybiera właściciel konta.')
    expect(alert).not.toHaveTextContent('Wybierz plan poniżej')
  })

  it('bez nowych pól (starszy backend) ekran wygląda jak dotąd', async () => {
    const { is_trial, trial_ends_at, has_access, expired, ...stary } = PROBNY_PO_KONCU
    void [is_trial, trial_ends_at, has_access, expired]
    subskrypcja(stary)
    render(<SubskrypcjaPage />)

    expect(await screen.findByText(/Twój plan: Start/)).toBeInTheDocument()
    expect(screen.queryByText('okres próbny')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Pulpit', () => {
  it('po końcu okresu próbnego nie pisze „Asystent aktywny"', async () => {
    pulpit({ used: 12, limit: 2000, plan: 'start', has_access: false, is_trial: true, ends_at: '2026-11-10' })
    render(<DashboardPage />)

    expect(await screen.findByText('Asystent wyłączony')).toBeInTheDocument()
    expect(screen.queryByText(/Asystent aktywny/)).not.toBeInTheDocument()
    expect(screen.getByText(/Okres próbny trwał do 10\.11\.2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Przejdź do subskrypcji/ })).toHaveAttribute(
      'href',
      '/subskrypcja',
    )
  })

  it('w trakcie okresu próbnego podaje jego koniec', async () => {
    pulpit({ used: 12, limit: 2000, plan: 'start', has_access: true, is_trial: true, ends_at: '2026-11-26' })
    render(<DashboardPage />)

    expect(await screen.findByText(/Asystent aktywny · okres próbny do 26\.11\.2026/)).toBeInTheDocument()
    expect(screen.queryByText('Asystent wyłączony')).not.toBeInTheDocument()
  })

  it('zawieszona płatna subskrypcja też wyłącza asystenta', async () => {
    pulpit({ used: 0, limit: 8000, plan: 'grow', has_access: false, is_trial: false, ends_at: '2026-12-01' })
    render(<DashboardPage />)

    expect(await screen.findByText('Asystent wyłączony')).toBeInTheDocument()
    expect(screen.getByText(/Subskrypcja nie jest aktywna/)).toBeInTheDocument()
  })

  it('opłacony plan wygląda jak dotąd', async () => {
    pulpit({ used: 0, limit: 8000, plan: 'grow', has_access: true, is_trial: false, ends_at: '2026-12-01' })
    render(<DashboardPage />)

    const status = await screen.findByText(/Asystent aktywny/)
    expect(status).not.toHaveTextContent('okres próbny')
  })

  it('bez pola has_access (starszy backend) nie zgaduje wyłączenia', async () => {
    pulpit({ used: 0, limit: 8000, plan: 'grow' })
    render(<DashboardPage />)

    expect(await screen.findByText(/Asystent aktywny/)).toBeInTheDocument()
  })
})
