/**
 * Baza wiedzy i FAQ stronami (F16, czesc 2).
 *
 * Kategoria ryzyka: WYDAJNOSC i POPRAWNOSC. Obie listy szly w calosci. Po
 * stronicowaniu ekran musi pytac o konkretna strone, nowy wpis pokazac na
 * pierwszej, a usuniecie ostatniego wpisu na dalszej stronie nie moze
 * skonczyc sie pytaniem o strone, ktorej juz nie ma.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import FAQPage from '@/app/(admin)/faq/page'
import DocumentsPage from '@/app/(admin)/documents/page'
import * as api from '@/lib/api'

function faq(id: number) {
  return { id, question: `pytanie ${id}`, answer: 'odpowiedź' }
}

describe('FAQ', () => {
  it('przechodzi do starszych i po usunieciu jedynego wpisu wraca o strone', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
      if (sciezka === '/faq/?page=1') {
        return { count: 51, next: 'strona-2', previous: null, results: [faq(51)] }
      }
      if (sciezka === '/faq/?page=2') {
        return { count: 51, next: null, previous: 'strona-1', results: [faq(1)] }
      }
      if (sciezka === '/faq/1/') return null
      throw new Error(`nieoczekiwane ${sciezka}`)
    })

    render(<FAQPage />)
    expect(await screen.findByText('pytanie 51')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Starsze' }))
    expect(await screen.findByText('pytanie 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Usuń pytanie: pytanie 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Potwierdź usunięcie: pytanie 1' }))

    await waitFor(() =>
      expect(wywolania.mock.calls.filter(([s]) => s === '/faq/?page=1')).toHaveLength(2),
    )
    expect(await screen.findByText('pytanie 51')).toBeInTheDocument()
  })

  it('nowy wpis wczytuje pierwsza strone', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
      if (sciezka.startsWith('/faq/?page=')) {
        return { count: 1, next: null, previous: null, results: [faq(1)] }
      }
      if (sciezka === '/faq/') return faq(2)
      throw new Error(`nieoczekiwane ${sciezka}`)
    })

    render(<FAQPage />)
    await screen.findByText('pytanie 1')
    fireEvent.change(screen.getByLabelText('Pytanie'), { target: { value: 'Nowe?' } })
    fireEvent.change(screen.getByLabelText('Odpowiedź'), { target: { value: 'Tak.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do FAQ' }))

    await waitFor(() =>
      expect(wywolania.mock.calls.filter(([s]) => s === '/faq/?page=1')).toHaveLength(2),
    )
  })
})

describe('Baza wiedzy', () => {
  it('dokumenty stronami', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
      if (sciezka === '/website-sources/') return []
      if (sciezka === '/knowledge/') return { gpt_prompt: '' }
      if (sciezka.startsWith('/documents/?page=')) {
        const numer = Number(sciezka.split('=')[1])
        return {
          count: 51,
          next: numer === 1 ? 'strona-2' : null,
          previous: numer === 1 ? null : 'strona-1',
          results: [
            {
              id: numer,
              name: `dokument ze strony ${numer}`,
              processed: true,
              uploaded_at: '2026-09-14T10:00:00Z',
              chunk_count: 1,
              status: 'ready',
              uzywaj_w_wyszukiwaniu: true,
              source_url: '',
            },
          ],
        }
      }
      throw new Error(`nieoczekiwane ${sciezka}`)
    })

    render(<DocumentsPage />)
    expect(await screen.findByText('dokument ze strony 1')).toBeInTheDocument()
    expect(screen.getByText('Strona 1, dokumentów łącznie: 51')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Starsze' }))

    expect(await screen.findByText('dokument ze strony 2')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledWith('/documents/?page=2')
  })
})
