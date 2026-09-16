/**
 * Import historii rozmow z pliku CSV.
 *
 * Kategoria ryzyka: TWORZENIE DANYCH. To jedyna z trzech koncowek bez drogi
 * z panelu, ktora ZAPISUJE. Backend nie ma ochrony przed powtorka: ten sam
 * plik wgrany dwa razy dopisze historie dwa razy, a cofniecie tego znaczy
 * kasowanie wpisow pojedynczo. Dlatego panel pyta przed wyslaniem i mowi,
 * co sie stanie.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsPage from '@/app/(admin)/conversations/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const PUSTA_STRONA = { count: 0, next: null, previous: null, results: [] }

afterEach(() => {
  vi.restoreAllMocks()
})

function backend(mojaRola: string, przyImporcie?: () => never) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/chat/import/') {
      if (przyImporcie) przyImporcie()
      return { imported: 3 } as never
    }
    if (sciezka.startsWith('/chat/logs/')) return PUSTA_STRONA as never
    if (sciezka === '/accounts/me/') return { role: mojaRola } as never
    return null as never
  })
}

function plikCsv(nazwa = 'historia.csv') {
  return new File(['prompt,response\nPytanie,Odpowiedź\n'], nazwa, { type: 'text/csv' })
}

async function wybierzPlik(uzytkownik: ReturnType<typeof userEvent.setup>, plik = plikCsv()) {
  const pole = await screen.findByLabelText('Plik CSV')
  await uzytkownik.upload(pole as HTMLInputElement, plik)
}

describe('pracownik i właściciel', () => {
  it('pierwszy klik pyta i NIE wysyła pliku', async () => {
    const wywolania = backend('employee')
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)
    await wybierzPlik(uzytkownik)
    wywolania.mockClear()

    await uzytkownik.click(screen.getByRole('button', { name: 'Wgraj historię' }))

    expect(screen.getByRole('button', { name: 'Na pewno wgrać?' })).toBeInTheDocument()
    expect(screen.getByText(/Wpisy z pliku dopiszą się do historii/)).toBeVisible()
    expect(wywolania.mock.calls.filter(([s]) => s === '/chat/import/')).toHaveLength(0)
  })

  it('drugi klik wysyła plik i pokazuje, ile wpisów przyszło', async () => {
    const wywolania = backend('owner')
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)
    await wybierzPlik(uzytkownik)

    await uzytkownik.click(screen.getByRole('button', { name: 'Wgraj historię' }))
    await uzytkownik.click(screen.getByRole('button', { name: 'Na pewno wgrać?' }))

    await waitFor(() =>
      expect(wywolania.mock.calls.filter(([s]) => s === '/chat/import/')).toHaveLength(1),
    )
    const wyslane = wywolania.mock.calls.find(([s]) => s === '/chat/import/')?.[1]
    expect(wyslane?.method).toBe('POST')
    expect(wyslane?.body).toBeInstanceOf(FormData)
    expect(await screen.findByText('Zaimportowano wpisów: 3.')).toBeVisible()
  })

  it('odmowa backendu mówi, co poprawić w pliku', async () => {
    // Złe kodowanie, brak kolumn, błędny wiersz - backend odpowiada po polsku
    // i to jego zdanie niesie powód, więc pokazujemy je wprost.
    const powod = 'Plik CSV musi mieć w pierwszym wierszu kolumny prompt i response.'
    backend('owner', () => {
      throw new BladApi(400, powod)
    })
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)
    await wybierzPlik(uzytkownik)

    await uzytkownik.click(screen.getByRole('button', { name: 'Wgraj historię' }))
    await uzytkownik.click(screen.getByRole('button', { name: 'Na pewno wgrać?' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(powod)
  })

  it('plik w złym formacie nie idzie na serwer', async () => {
    const wywolania = backend('owner')
    render(<ConversationsPage />)
    const pole = (await screen.findByLabelText('Plik CSV')) as HTMLInputElement

    // Pole ma accept=".csv", więc userEvent takiego pliku nawet nie wstawi.
    // Przeglądarka nie jest jednak jedyną drogą (przeciąganie, starszy sprzęt),
    // a walidacja ma trzymać niezależnie od podpowiedzi w oknie wyboru.
    expect(pole).toHaveAttribute('accept', '.csv')
    fireEvent.change(pole, {
      target: { files: [new File(['cokolwiek'], 'historia.txt', { type: 'text/plain' })] },
    })

    expect(await screen.findByText('Wybierz plik CSV.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Wgraj historię' })).toBeDisabled()
    expect(wywolania.mock.calls.filter(([s]) => s === '/chat/import/')).toHaveLength(0)
  })
})

describe('podgląd', () => {
  it('nie widzi sekcji importu', async () => {
    // Backend i tak odmówi (403). Pole wyboru pliku obiecywałoby możliwość,
    // której rola do oglądania nie ma.
    backend('viewer')
    render(<ConversationsPage />)

    await screen.findByRole('heading', { name: 'Konwersacje' })
    await waitFor(() => expect(screen.queryByLabelText('Plik CSV')).not.toBeInTheDocument())
  })
})
