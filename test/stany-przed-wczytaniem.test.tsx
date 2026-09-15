/**
 * Ekrany panelu, zanim dane przyjda z serwera - i gdy nie przyjda wcale.
 *
 * Kategoria ryzyka: UTRATA DANYCH. Ekrany Prywatnosc i Widget pokazywaly
 * formularz z wartosciami domyslnymi i pozwalaly go zapisac, zanim przyszly
 * prawdziwe ustawienia albo po tym, jak ich odczyt sie nie udal. Zapis
 * nadpisywal wtedy konfiguracje firmy wartosciami domyslnymi. Na ekranie
 * Prywatnosc to nie kosmetyka: okres 365 dni zamieniony na domyslne 90 dni
 * znaczy, ze nocne czyszczenie usuwa rozmowy sprzed 90-365 dni.
 *
 * Druga kategoria: FALSZYWY PUSTY STAN. "Brak uzytkownikow" w trakcie
 * wczytywania albo po bledzie mowi wlascicielowi cos nieprawdziwego o jego
 * koncie, zamiast powiedziec, ze odczyt jeszcze trwa albo sie nie udal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrivacyPage from '@/app/(admin)/privacy/page'
import WidgetSettingsPage from '@/app/(admin)/widget-settings/page'
import TeamPage from '@/app/(admin)/team/page'
import SubskrypcjaPage from '@/app/(admin)/subskrypcja/page'
import * as api from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

type Odpowiedz = () => Promise<unknown>

const nigdy: Odpowiedz = () => new Promise(() => {})
const blad: Odpowiedz = () => Promise.reject(new Error('Serwer nie odpowiada.'))
const zwroc =
  (dane: unknown): Odpowiedz =>
  () =>
    Promise.resolve(dane)

/** Klucz to "METODA /sciezka/" albo sama sciezka dla GET. */
function backend(odpowiedzi: Record<string, Odpowiedz>) {
  return vi.spyOn(api, 'apiFetch').mockImplementation((sciezka: string, opcje?: RequestInit) => {
    const metoda = opcje?.method ?? 'GET'
    const odpowiedz = odpowiedzi[`${metoda} ${sciezka}`] ?? (metoda === 'GET' ? odpowiedzi[sciezka] : undefined)
    return odpowiedz ? (odpowiedz() as Promise<never>) : Promise.reject(new Error(`${metoda} ${sciezka}`))
  })
}

function zapisy(spy: ReturnType<typeof backend>) {
  return spy.mock.calls.filter(([, opcje]) => opcje?.method && opcje.method !== 'GET')
}

describe('Prywatnosc', () => {
  it('nie pozwala zapisac, zanim ustawienia przyjda', async () => {
    backend({ '/privacy/': nigdy })
    render(<PrivacyPage />)

    expect(await screen.findByRole('status')).toHaveTextContent(/Wczytuję ustawienia/)
    expect(screen.getByRole('button', { name: 'Zapisz ustawienia' })).toBeDisabled()
    expect(screen.getByLabelText('Automatyczne usuwanie rozmów')).toBeDisabled()
  })

  it('po nieudanym odczycie nie zapisuje wartosci domyslnych', async () => {
    const spy = backend({ '/privacy/': blad, 'PATCH /privacy/': zwroc({}) })
    const user = userEvent.setup()
    render(<PrivacyPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer nie odpowiada.')
    const zapisz = screen.getByRole('button', { name: 'Zapisz ustawienia' })
    expect(zapisz).toBeDisabled()
    await user.click(zapisz)
    expect(zapisy(spy)).toHaveLength(0)
  })

  it('po odczycie zapisuje to, co przyszlo z serwera', async () => {
    const spy = backend({
      '/privacy/': zwroc({ data_retention_days: 365, privacy_policy_url: 'https://firma.pl/prywatnosc' }),
      'PATCH /privacy/': zwroc({}),
    })
    const user = userEvent.setup()
    render(<PrivacyPage />)

    await waitFor(() => expect(screen.getByLabelText('Automatyczne usuwanie rozmów')).toHaveValue('365'))
    await user.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }))

    await waitFor(() => expect(zapisy(spy)).toHaveLength(1))
    expect(JSON.parse(String(zapisy(spy)[0][1]?.body))).toEqual({
      data_retention_days: 365,
      privacy_policy_url: 'https://firma.pl/prywatnosc',
    })
  })

  it('usuwanie rozmowy na zadanie nie czeka na ustawienia', async () => {
    // To osobna operacja z wlasnym identyfikatorem. Blokowanie jej razem
    // z formularzem opoznialoby wykonanie zadania RODO bez powodu.
    backend({ '/privacy/': nigdy })
    const user = userEvent.setup()
    render(<PrivacyPage />)

    await user.type(screen.getByLabelText('Identyfikator rozmowy do usunięcia'), 'abc')
    expect(screen.getByRole('button', { name: 'Usuń dane' })).toBeEnabled()
  })
})

describe('Widget', () => {
  const pozostale = {
    '/accounts/me/': zwroc({ tenant_api_key: 'klucz' }),
    '/billing/plans/': zwroc({ plans: [] }),
  }

  it('nie pozwala zapisac, zanim ustawienia widgetu przyjda', async () => {
    backend({ ...pozostale, '/widget-settings/mine/': nigdy })
    render(<WidgetSettingsPage />)

    expect(await screen.findByText(/Wczytuję ustawienia widgetu/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled()
    // Same pola też: wpis zrobiony w trakcie wczytywania nadpisałaby
    // odpowiedź serwera, więc człowiek traciłby go bez słowa.
    expect(screen.getByLabelText('Wiadomość powitalna')).toBeDisabled()
  })

  it('po nieudanym odczycie nie nadpisuje konfiguracji domyslna', async () => {
    const spy = backend({
      ...pozostale,
      '/widget-settings/mine/': blad,
      'PATCH /widget-settings/mine/': zwroc({}),
    })
    const user = userEvent.setup()
    render(<WidgetSettingsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer nie odpowiada.')
    const zapisz = screen.getByRole('button', { name: 'Zapisz' })
    expect(zapisz).toBeDisabled()
    await user.click(zapisz)
    expect(zapisy(spy)).toHaveLength(0)
  })
})

describe('Zespol', () => {
  const zaproszenia = { '/accounts/invitations/list/': zwroc([]) }

  it('w trakcie wczytywania nie twierdzi, ze zespol jest pusty', async () => {
    backend({ ...zaproszenia, '/users/': nigdy })
    render(<TeamPage />)

    expect(await screen.findByRole('status')).toHaveTextContent(/Wczytuję zespół/)
    expect(screen.queryByText('Brak użytkowników.')).not.toBeInTheDocument()
  })

  it('po bledzie mowi o bledzie, a nie o pustym zespole', async () => {
    backend({ ...zaproszenia, '/users/': blad })
    render(<TeamPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Serwer nie odpowiada.')
    expect(screen.queryByText('Brak użytkowników.')).not.toBeInTheDocument()
  })
})

describe('Subskrypcja', () => {
  it('pokazuje, ze plan sie wczytuje', async () => {
    backend({ '/billing/plans/': nigdy, '/widget-domains/': nigdy })
    render(<SubskrypcjaPage />)

    expect(await screen.findByText(/Wczytuję plan/)).toBeInTheDocument()
  })

  it('nieudany odczyt witryn nie znika bez slowa', async () => {
    // Lista witryn liczy sie do limitu planu. Cisza po bledzie wyglada jak
    // "brak witryn", a klient nie wie, czy widget w ogole dziala.
    backend({ '/billing/plans/': zwroc({ current: null, plans: [] }), '/widget-domains/': blad })
    render(<SubskrypcjaPage />)

    expect(await screen.findByText(/Nie udało się wczytać listy witryn/)).toBeInTheDocument()
  })
})
