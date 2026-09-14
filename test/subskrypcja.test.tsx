/**
 * Ekran Subskrypcja: zakup, zmiana planu i nieudana platnosc.
 *
 * Kategoria ryzyka: PIENIADZE. Przy aktywnej subskrypcji Stripe przycisk
 * planu prowadzil do nowego zakupu, czyli do drugiej subskrypcji i dwoch
 * obciazen co miesiac. Teraz prowadzi do potwierdzenia zmiany w portalu
 * Stripe, na tej samej subskrypcji. Testy pilnuja, ktora droga jest wybrana.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SubskrypcjaPage from '@/app/(admin)/subskrypcja/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const oryginalnaLokalizacja = window.location

function podmienLokalizacje(search = '') {
  const atrapa = { href: '', search, pathname: '/subskrypcja' } as Location
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: atrapa })
  return atrapa
}

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: oryginalnaLokalizacja,
  })
})

const PLANY = [
  { code: 'start', name: 'Start', price_pln: 149, message_limit: 2000, white_label: false, available: true, current: false },
  { code: 'grow', name: 'Grow', price_pln: 349, message_limit: 8000, white_label: false, available: true, current: true },
  { code: 'pro', name: 'Pro', price_pln: 899, message_limit: 25000, white_label: true, available: true, current: false },
]

const OPLACANY_GROW = {
  plan: 'grow',
  name: 'Grow',
  in_catalogue: true,
  is_active: true,
  used: 10,
  limit: 8000,
  renews_at: '2026-10-17',
  stripe_status: 'active',
  access_until: '2026-10-17',
  has_stripe_subscription: true,
  portal_available: true,
  can_manage: true,
}

const OKRES_PROBNY = {
  ...OPLACANY_GROW,
  plan: 'trial',
  name: 'trial',
  in_catalogue: false,
  stripe_status: '',
  has_stripe_subscription: false,
  portal_available: false,
}

type Odpowiedzi = Record<string, unknown>

function backend(current: { plan: string | null } & Record<string, unknown>, odpowiedzi: Odpowiedzi = {}) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/billing/plans/') {
      return { current, plans: PLANY.map((p) => ({ ...p, current: p.code === current.plan })) }
    }
    if (sciezka === '/widget-domains/') return { domains: [], limit: 3 }
    if (sciezka in odpowiedzi) {
      const wynik = odpowiedzi[sciezka]
      if (wynik instanceof Error) throw wynik
      return wynik
    }
    throw new Error(`nieoczekiwane zapytanie ${sciezka}`)
  })
}

function wyslane(wywolania: ReturnType<typeof backend>, sciezka: string) {
  return wywolania.mock.calls
    .filter(([s]) => s === sciezka)
    .map(([, opcje]) => JSON.parse(String((opcje as RequestInit | undefined)?.body ?? '{}')))
}

describe('zmiana planu', () => {
  it('przy oplacanej subskrypcji prowadzi do portalu, nie do nowego zakupu', async () => {
    const lokalizacja = podmienLokalizacje()
    const wywolania = backend(OPLACANY_GROW, {
      '/billing/portal/': { portal_url: 'https://billing.stripe.test/zmiana' },
    })

    render(<SubskrypcjaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Przejdź na Pro' }))

    await waitFor(() => expect(lokalizacja.href).toBe('https://billing.stripe.test/zmiana'))
    expect(wyslane(wywolania, '/billing/portal/')).toEqual([{ plan_type: 'pro' }])
    expect(wyslane(wywolania, '/billing/create-checkout-session/')).toEqual([])
    expect(screen.getByText(/Niższy plan zacznie obowiązywać od następnego okresu/)).toBeInTheDocument()
  })

  it('bez subskrypcji Stripe wybor planu to zakup przez Checkout', async () => {
    const lokalizacja = podmienLokalizacje()
    const wywolania = backend(OKRES_PROBNY, {
      '/billing/create-checkout-session/': { checkout_url: 'https://checkout.stripe.test/s' },
    })

    render(<SubskrypcjaPage />)
    const przyciski = await screen.findAllByRole('button', { name: 'Wybierz plan' })
    fireEvent.click(przyciski[2])

    await waitFor(() => expect(lokalizacja.href).toBe('https://checkout.stripe.test/s'))
    expect(wyslane(wywolania, '/billing/create-checkout-session/')).toEqual([{ plan_type: 'pro' }])
    expect(wyslane(wywolania, '/billing/portal/')).toEqual([])
    expect(screen.queryByRole('button', { name: 'Zarządzaj subskrypcją' })).not.toBeInTheDocument()
  })

  it('pracownik widzi plan, ale go nie zmienia', async () => {
    podmienLokalizacje()
    backend({ ...OPLACANY_GROW, can_manage: false })

    render(<SubskrypcjaPage />)

    expect(await screen.findByText(/zmienia właściciel konta/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Przejdź na|Wybierz plan|Zarządzaj/ })).not.toBeInTheDocument()
  })

  it('odmowa backendu to zdanie, a nie surowa odpowiedz', async () => {
    podmienLokalizacje()
    backend(OPLACANY_GROW, {
      '/billing/portal/': new BladApi(400, 'Nie udało się otworzyć zarządzania subskrypcją.'),
    })

    render(<SubskrypcjaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Przejdź na Pro' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się otworzyć zarządzania subskrypcją.',
    )
    // Przycisk wraca do uzycia - inaczej jedna chwilowa awaria blokuje ekran
    expect(screen.getByRole('button', { name: 'Przejdź na Pro' })).toBeEnabled()
  })

  it('po powrocie z portalu mowi, ze zmiana jest zapisana', async () => {
    podmienLokalizacje('?zmiana=1')
    backend(OPLACANY_GROW)

    render(<SubskrypcjaPage />)

    expect(await screen.findByRole('status')).toHaveTextContent(/Zmiana zapisana w Stripe/)
  })
})

describe('nieudana platnosc', () => {
  it('pokazuje date konca dostepu i prowadzi do zmiany karty', async () => {
    const lokalizacja = podmienLokalizacje()
    const wywolania = backend(
      { ...OPLACANY_GROW, stripe_status: 'past_due' },
      { '/billing/portal/': { portal_url: 'https://billing.stripe.test/karta' } },
    )

    render(<SubskrypcjaPage />)

    const ostrzezenie = await screen.findByRole('alert')
    expect(ostrzezenie).toHaveTextContent('Płatność za odnowienie nie przeszła')
    expect(ostrzezenie).toHaveTextContent('17.10.2026')
    fireEvent.click(screen.getByRole('button', { name: 'Zmień kartę' }))

    await waitFor(() => expect(lokalizacja.href).toBe('https://billing.stripe.test/karta'))
    expect(wyslane(wywolania, '/billing/portal/')).toEqual([{}])
  })

  it('aktywna subskrypcja nie straszy nieudana platnoscia', async () => {
    podmienLokalizacje()
    backend(OPLACANY_GROW)

    render(<SubskrypcjaPage />)

    await screen.findByRole('button', { name: 'Zarządzaj subskrypcją' })
    expect(screen.queryByText(/nie przeszła/)).not.toBeInTheDocument()
  })
})
