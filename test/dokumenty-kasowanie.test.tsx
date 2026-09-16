/**
 * Kasowanie dokumentu z bazy wiedzy.
 *
 * Kategoria ryzyka: DANE. Dokument wgrany przez klienta to czesto jedyny
 * egzemplarz, jaki mamy: kopii pliku nie przechowujemy, a fragmenty trzeba by
 * policzyc od nowa. Dlatego pierwszy klik pyta, a dopiero drugi kasuje - i te
 * testy pilnuja obu polowek, bo test samego pytania przepuscilby przycisk,
 * ktory nie kasuje wcale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '@/app/(admin)/documents/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const DOKUMENTY = [
  {
    id: 11,
    name: 'cennik.pdf',
    processed: true,
    uploaded_at: '2026-09-14T10:00:00Z',
    chunk_count: 3,
    status: 'ready',
    uzywaj_w_wyszukiwaniu: true,
    source_url: '',
    ma_plik: true,
  },
  {
    id: 12,
    name: 'regulamin.pdf',
    processed: true,
    uploaded_at: '2026-09-13T10:00:00Z',
    chunk_count: 2,
    status: 'ready',
    uzywaj_w_wyszukiwaniu: true,
    source_url: '',
    ma_plik: true,
  },
]

function podepnijApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/website-sources/') return [] as never
    if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
    if (sciezka.startsWith('/documents/?page=')) {
      return { count: DOKUMENTY.length, next: null, previous: null, results: DOKUMENTY } as never
    }
    return null as never
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function otworz() {
  const uzytkownik = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const wywolania = podepnijApi()
  render(<DocumentsPage />)
  await screen.findByText('cennik.pdf')
  return { uzytkownik, wywolania }
}

function kasowania(wywolania: ReturnType<typeof podepnijApi>) {
  return wywolania.mock.calls.filter(([, opcje]) => opcje?.method === 'DELETE')
}

describe('dwustopniowe potwierdzenie', () => {
  it('pierwszy klik pyta i NIE kasuje', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockClear()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: cennik.pdf' }))

    expect(
      screen.getByRole('button', { name: 'Potwierdź usunięcie: cennik.pdf' }),
    ).toBeInTheDocument()
    expect(kasowania(wywolania)).toHaveLength(0)
  })

  it('drugi klik kasuje właściwy dokument i odświeża listę', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockClear()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: cennik.pdf' }))
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź usunięcie: cennik.pdf' }))

    await waitFor(() => expect(kasowania(wywolania)).toHaveLength(1))
    expect(kasowania(wywolania)[0][0]).toBe('/documents/11/')
    // Lista wczytana od nowa: bez tego skasowany dokument zostawał na ekranie.
    await waitFor(() =>
      expect(wywolania.mock.calls.some(([s]) => String(s).startsWith('/documents/?page='))).toBe(
        true,
      ),
    )
  })

  it('uzbraja tylko ten wiersz, w który kliknięto', async () => {
    const { uzytkownik } = await otworz()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: cennik.pdf' }))

    expect(screen.getAllByRole('button', { name: /^Potwierdź usunięcie/ })).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Usuń dokument: regulamin.pdf' }),
    ).toBeInTheDocument()
  })

  it('pytanie wygasa i nie zostaje uzbrojone na ekranie', async () => {
    const { uzytkownik } = await otworz()

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: cennik.pdf' }))
    await vi.advanceTimersByTimeAsync(5200)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Potwierdź usunięcie/ })).not.toBeInTheDocument(),
    )
  })
})

describe('granica roli', () => {
  it('odmowa mówi po polsku, nie komunikatem z DRF', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockImplementation(async (sciezka: string, opcje?: RequestInit) => {
      if (opcje?.method === 'DELETE') {
        throw new BladApi(403, 'You do not have permission to perform this action.')
      }
      if (sciezka === '/website-sources/') return [] as never
      if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
      return { count: DOKUMENTY.length, next: null, previous: null, results: DOKUMENTY } as never
    })

    await uzytkownik.click(screen.getByRole('button', { name: 'Usuń dokument: cennik.pdf' }))
    await uzytkownik.click(screen.getByRole('button', { name: 'Potwierdź usunięcie: cennik.pdf' }))

    expect(
      await screen.findByText('Usuwanie dokumentów jest dostępne dla właściciela i pracownika.'),
    ).toBeInTheDocument()
  })
})
