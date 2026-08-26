/**
 * Kasowanie wpisu FAQ.
 *
 * Kategoria ryzyka: DANE. Wpisy FAQ pisze właściciel firmy własnoręcznie
 * i nie ma ich nigdzie indziej — nie da się ich odtworzyć z bazy wiedzy ani
 * z historii rozmów. Backend nie prowadzi kosza.
 *
 * Wcześniej kliknięcie „Usuń" wysyłało DELETE od razu. Na telefonie ten cel
 * ma 32×44 px, więc jedno nietrafione dotknięcie kasowało pytanie na stałe.
 * Te testy pilnują obu połówek: że pierwszy klik NIE kasuje i że drugi
 * kasuje naprawdę — bo test wyłącznie pierwszej połowy przepuściłby przycisk,
 * który nie działa wcale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FAQPage from '@/app/(admin)/faq/page'
import * as api from '@/lib/api'

const WPISY = [
  { id: 11, question: 'Jakie macie godziny otwarcia?', answer: 'Pon–pt 9–18.' },
  { id: 12, question: 'Ile kosztuje przegląd?', answer: '120 zł.' },
]

function podepnijApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka, opcje) => {
    if (opcje?.method === 'DELETE') return null
    return [...WPISY]
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

async function otworz() {
  const uzytkownik = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const wywolania = podepnijApi()
  render(<FAQPage />)
  await screen.findByText('Jakie macie godziny otwarcia?')
  return { uzytkownik, wywolania }
}

function przyciskiKasowania() {
  return screen.getAllByRole('button', { name: /Usuń pytanie/i })
}

describe('dwustopniowe potwierdzenie', () => {
  it('pierwszy klik pyta i NIE wysyła kasowania', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockClear()

    await uzytkownik.click(przyciskiKasowania()[0])

    expect(screen.getByRole('button', { name: /Potwierdź usunięcie/i })).toBeInTheDocument()
    const kasowania = wywolania.mock.calls.filter(([, o]) => o?.method === 'DELETE')
    expect(kasowania).toHaveLength(0)
  })

  it('drugi klik wysyła DELETE pod właściwy identyfikator', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockClear()

    await uzytkownik.click(przyciskiKasowania()[0])
    await uzytkownik.click(screen.getByRole('button', { name: /Potwierdź usunięcie/i }))

    await waitFor(() => {
      const kasowania = wywolania.mock.calls.filter(([, o]) => o?.method === 'DELETE')
      expect(kasowania).toHaveLength(1)
      expect(kasowania[0][0]).toBe('/faq/11/')
    })
  })

  it('uzbraja tylko ten wpis, w który kliknięto', async () => {
    // Uzbrojenie wszystkich naraz znaczyłoby, że następne kliknięcie
    // gdziekolwiek na liście kasuje — czyli dokładnie ta pułapka,
    // przed którą potwierdzenie ma chronić.
    const { uzytkownik } = await otworz()

    await uzytkownik.click(przyciskiKasowania()[0])

    expect(screen.getAllByRole('button', { name: /Potwierdź usunięcie/i })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^Usuń pytanie/i })).toHaveLength(1)
  })

  it('pytanie samo wygasa i nie zostaje uzbrojone na ekranie', async () => {
    // Uzbrojony przycisk zostawiony na widoku jest gorszy niż brak
    // potwierdzenia: użytkownik wraca po minucie, klika raz i kasuje.
    const { uzytkownik } = await otworz()

    await uzytkownik.click(przyciskiKasowania()[0])
    expect(screen.getByRole('button', { name: /Potwierdź usunięcie/i })).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(5200)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Potwierdź usunięcie/i })).not.toBeInTheDocument()
    })
  })

  it('po wygaśnięciu pierwszy klik znów tylko pyta', async () => {
    const { uzytkownik, wywolania } = await otworz()
    wywolania.mockClear()

    await uzytkownik.click(przyciskiKasowania()[0])
    await vi.advanceTimersByTimeAsync(5200)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Potwierdź usunięcie/i })).not.toBeInTheDocument(),
    )
    await uzytkownik.click(przyciskiKasowania()[0])

    const kasowania = wywolania.mock.calls.filter(([, o]) => o?.method === 'DELETE')
    expect(kasowania).toHaveLength(0)
  })
})

describe('dostępność', () => {
  it('nazwa przycisku mówi, którego pytania dotyczy', async () => {
    // Sam napis „Usuń" powtórzony przy każdym wpisie nie niesie tej
    // informacji — czytnik ekranu odczytuje listę identycznych przycisków.
    await otworz()

    expect(
      screen.getByRole('button', { name: 'Usuń pytanie: Jakie macie godziny otwarcia?' }),
    ).toBeInTheDocument()
  })
})
