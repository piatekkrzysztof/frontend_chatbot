/**
 * Podgląd fragmentów dokumentu w bazie wiedzy.
 *
 * Kategoria ryzyka: NIEWIDOCZNA WIEDZA. Panel pokazywał tylko liczbę
 * fragmentów. Gdy bot odpowiadał „nie mam tej informacji", nie dało się
 * sprawdzić, czy tekst z pliku w ogóle trafił do wyszukiwania i w jakiej
 * postaci - np. czy tabela z cennikiem w DOCX nie rozsypała się na komórki.
 */
import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '@/app/(admin)/documents/page'
import * as api from '@/lib/api'

const DOKUMENT = {
  id: 21,
  name: 'cennik-dekoracji.docx',
  processed: true,
  uploaded_at: '2026-10-07T10:00:00Z',
  chunk_count: 12,
  status: 'ready',
  uzywaj_w_wyszukiwaniu: true,
  source_url: '',
  ma_plik: true,
}

const PUSTY = { ...DOKUMENT, id: 22, name: 'pusty.txt', chunk_count: 0 }

// Trasa zwraca fragmenty bez ustalonej kolejności - tu celowo od końca.
const FRAGMENTY = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i,
  content: i === 0 ? 'Figurka z masy cukrowej | 45 zł | do 10 cm' : `Treść fragmentu ${i + 1}`,
})).reverse()

function podepnijApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/website-sources/') return [] as never
    if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
    if (sciezka.startsWith('/documents/?page=')) {
      return { count: 2, next: null, previous: null, results: [DOKUMENT, PUSTY] } as never
    }
    if (sciezka === '/documents/21/chunks/') return FRAGMENTY as never
    return null as never
  })
}

afterEach(() => vi.restoreAllMocks())

it('pokazuje tekst fragmentów w kolejności z dokumentu, porcjami', async () => {
  const wywolania = podepnijApi()
  const uzytkownik = userEvent.setup()
  render(<DocumentsPage />)
  await screen.findByText('cennik-dekoracji.docx')

  await uzytkownik.click(screen.getByRole('button', { name: /Pokaż fragmenty: cennik-dekoracji.docx/ }))

  const lista = await screen.findByRole('list')
  const pozycje = within(lista).getAllByRole('listitem')
  expect(pozycje).toHaveLength(10)
  expect(pozycje[0]).toHaveTextContent('Figurka z masy cukrowej | 45 zł')
  expect(screen.getByText(/Tak bot widzi ten dokument: 12 fragmentów/)).toBeInTheDocument()

  await uzytkownik.click(screen.getByRole('button', { name: 'Pokaż kolejne (zostało 2)' }))
  expect(within(lista).getAllByRole('listitem')).toHaveLength(12)

  // Ukrycie i ponowne otwarcie nie pyta serwera drugi raz.
  await uzytkownik.click(screen.getByRole('button', { name: /Ukryj fragmenty/ }))
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  await uzytkownik.click(screen.getByRole('button', { name: /Pokaż fragmenty: cennik-dekoracji.docx/ }))
  expect(await screen.findByRole('list')).toBeInTheDocument()
  expect(wywolania.mock.calls.filter(([s]) => s === '/documents/21/chunks/')).toHaveLength(1)
})

it('dokument bez fragmentów nie ma przycisku podglądu', async () => {
  podepnijApi()
  render(<DocumentsPage />)
  await screen.findByText('pusty.txt')

  expect(screen.queryByRole('button', { name: /Pokaż fragmenty: pusty.txt/ })).not.toBeInTheDocument()
})

it('błąd pobrania fragmentów jest widoczny, a nie pustą listą', async () => {
  podepnijApi().mockImplementation(async (sciezka: string) => {
    if (sciezka.startsWith('/documents/?page=')) {
      return { count: 1, next: null, previous: null, results: [DOKUMENT] } as never
    }
    if (sciezka === '/documents/21/chunks/') throw new Error('Brak połączenia z serwerem.')
    return [] as never
  })
  const uzytkownik = userEvent.setup()
  render(<DocumentsPage />)
  await screen.findByText('cennik-dekoracji.docx')

  await uzytkownik.click(screen.getByRole('button', { name: /Pokaż fragmenty/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia z serwerem.')
})
