/**
 * Pasek zajętości bazy wiedzy.
 *
 * Kategoria ryzyka: NIEWIDOCZNY LIMIT. Klient dowiadywał się o przekroczeniu
 * dopiero wtedy, gdy wgranie się nie udało - po przygotowaniu pliku i czekaniu
 * na odczyt. Po zejściu z wyższego planu nie dowiadywał się w ogóle, dopóki
 * czegoś nie dodał, choć od tej chwili nie mógł już bazy powiększać.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ZajetoscBazy from '@/components/ZajetoscBazy'
import * as api from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

function backend(dane: unknown) {
  return vi.spyOn(api, 'apiFetch').mockResolvedValue(dane as never)
}

describe('w ramach planu', () => {
  it('pokazuje zajęte megabajty i procent', async () => {
    backend({
      zajete_bajty: 2 * 1024 * 1024,
      limit_bajtow: 5 * 1024 * 1024,
      limit_mb: 5,
      procent: 40,
      ponad_limitem: false,
    })

    render(<ZajetoscBazy />)

    expect(await screen.findByText(/Zajęte: 2\.0 MB z 5 MB/)).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  })

  it('nie straszy komunikatem o przekroczeniu', async () => {
    backend({
      zajete_bajty: 1024,
      limit_bajtow: 5 * 1024 * 1024,
      limit_mb: 5,
      procent: 0,
      ponad_limitem: false,
    })

    render(<ZajetoscBazy />)

    await screen.findByRole('progressbar')
    expect(screen.queryByText(/przekracza limit/)).not.toBeInTheDocument()
  })
})

describe('po obniżeniu planu', () => {
  it('mówi wprost, co wolno, a czego nie', async () => {
    backend({
      zajete_bajty: 8 * 1024 * 1024,
      limit_bajtow: 5 * 1024 * 1024,
      limit_mb: 5,
      procent: 160,
      ponad_limitem: true,
    })

    render(<ZajetoscBazy />)

    expect(await screen.findByText(/przekracza limit Twojego planu/)).toBeVisible()
    expect(screen.getByText(/odświeżać i zmniejszać/)).toBeVisible()
    // Liczba zostaje prawdziwa, choć pasek fizycznie kończy się na 100%.
    expect(screen.getByText('160%')).toBeVisible()
  })
})

describe('gdy odczyt się nie uda', () => {
  it('znika bez czerwonego komunikatu', async () => {
    // To informacja pomocnicza. Błąd o niej przykryłby komunikaty dotyczące
    // samych dokumentów, czyli tego, po co klient tu przyszedł.
    vi.spyOn(api, 'apiFetch').mockRejectedValue(new Error('padło'))

    const { container } = render(<ZajetoscBazy />)

    await new Promise((gotowe) => setTimeout(gotowe, 0))
    expect(container).toBeEmptyDOMElement()
  })
})
