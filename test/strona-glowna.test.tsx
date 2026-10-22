/**
 * Cennik na stronie głównej (audyt 2026-10, A-23).
 *
 * Kategoria ryzyka: SPRZEDAZ. Strona i tak renderuje się na serwerze (nonce),
 * a cennik pobierała dopiero przeglądarka - w HTML, który widzi wyszukiwarka
 * i podgląd linku, było tylko „Wczytywanie cennika...”. Teraz cennik pobiera
 * serwer; przeglądarka dociąga go tylko wtedy, gdy serwer nie zdążył.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import StronaGlownaPage from '@/app/(panel)/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const CENNIK = {
  plans: [
    { code: 'start', name: 'Start', price_pln: 149, price_pln_yearly: 119, message_limit: 2000, knowledge_base_mb: 50, max_domains: 1, max_seats: 1, branding: 'wymagany' },
    { code: 'grow', name: 'Grow', price_pln: 349, price_pln_yearly: 279, message_limit: 8000, knowledge_base_mb: 200, max_domains: 3, max_seats: 3, branding: 'usuwalny' },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cennik', () => {
  it('jest w stronie z serwera, bez zapytania z przeglądarki', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(CENNIK), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ))

    render(await StronaGlownaPage())

    // Od pierwszego renderu, nie po efekcie
    expect(screen.getByText('Grow')).toBeInTheDocument()
    expect(screen.queryByText('Wczytywanie cennika...')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/billing/cennik/')
  })

  it('gdy serwer nie zdążył, dociąga go przeglądarka', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('backend nie odpowiada'))
      .mockResolvedValueOnce(new Response(JSON.stringify(CENNIK), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(await StronaGlownaPage())

    expect(screen.getByText('Wczytywanie cennika...')).toBeInTheDocument()
    expect(await screen.findByText('Grow')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
