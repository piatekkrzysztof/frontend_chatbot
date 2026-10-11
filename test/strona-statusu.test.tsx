/**
 * Panel nie twierdzi, że „wszystko działa”, tylko prowadzi do stanu mierzonego
 * z zewnątrz. Do 11.10.2026 w menu stał stały napis z zieloną kropką, którego
 * nic nie sprawdzało - w trakcie awarii mówiłby klientowi nieprawdę.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { STRONA_STATUSU } from '@/lib/strona-statusu'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({ tenant_name: 'Firma', role: 'owner' })) }))

describe('strona statusu w panelu', () => {
  it('menu linkuje do publicznej strony statusu zamiast stałego „wszystko działa”', () => {
    render(<Sidebar />)
    const link = screen.getByRole('link', { name: /Stan usług na żywo/ })
    expect(link).toHaveAttribute('href', STRONA_STATUSU)
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.queryByText(/Wszystkie systemy działają/)).toBeNull()
  })

  it('górny pasek nie twierdzi „Czat działa”, tylko linkuje do strony statusu', async () => {
    render(<Navbar />)
    const link = await screen.findByRole('link', { name: /Stan usług/ })
    expect(link).toHaveAttribute('href', STRONA_STATUSU)
    expect(screen.queryByText(/Czat działa/)).toBeNull()
  })

  it('adres to strona główna statusu, nie szczegóły jednego monitora', () => {
    expect(STRONA_STATUSU).toMatch(/^https:\/\/stats\.uptimerobot\.com\/[A-Za-z0-9]+$/)
  })
})
