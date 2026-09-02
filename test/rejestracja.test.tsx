/**
 * Formularz rejestracji z danymi do faktury.
 *
 * Kategoria ryzyka: PIENIADZE i PORZUCENIE. To jedyny moment, w ktorym
 * zbieramy dane potrzebne do faktury i umowy - jesli formularz zgubi pole
 * albo nie powie, ktore jest zle, klient odchodzi, a my zostajemy z kontem,
 * ktoremu nie da sie wystawic rachunku.
 *
 * Formularz urosl z trzech pol do dziesieciu, wiec komunikat "cos poszlo nie
 * tak" nad przyciskiem przestal wystarczac: przy dziesieciu polach to
 * zgadywanka, i to na koncu dlugiego formularza.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RejestracjaPage from '@/app/(auth)/rejestracja/page'

const przekierowania: string[] = []

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
}))

function odpowiedz(status: number, cialo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cialo),
  } as Response
}

/** Wypelnia wszystkie wymagane pola. NIP zostawia pusty - jest opcjonalny. */
async function wypelnij(uzytkownik: ReturnType<typeof userEvent.setup>) {
  await uzytkownik.type(screen.getByLabelText('Imię'), 'Anna')
  await uzytkownik.type(screen.getByLabelText('Nazwisko'), 'Nowak')
  await uzytkownik.type(screen.getByLabelText('Adres e-mail'), 'anna@rowerownia.pl')
  await uzytkownik.type(screen.getByLabelText('Hasło'), 'bardzoTajneHaslo123')
  await uzytkownik.type(screen.getByLabelText('Nazwa firmy'), 'Rowerownia')
  await uzytkownik.type(screen.getByLabelText('Ulica i numer'), 'Krakowska 12')
  await uzytkownik.type(screen.getByLabelText('Kod pocztowy'), '31-000')
  await uzytkownik.type(screen.getByLabelText('Miejscowość'), 'Kraków')
}

beforeEach(() => {
  przekierowania.length = 0
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wysylanie danych', () => {
  it('przekazuje komplet pol do backendu', async () => {
    // Zgubione pole nie objawia sie bledem - konto powstaje, a brak wychodzi
    // dopiero przy wystawianiu faktury.
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(201, {}))
      .mockResolvedValueOnce(odpowiedz(200, { access: 'token' }))
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    const [, opcje] = vi.mocked(fetch).mock.calls[0]
    const wyslane = JSON.parse(String(opcje?.body))

    expect(wyslane).toMatchObject({
      imie: 'Anna',
      nazwisko: 'Nowak',
      company_name: 'Rowerownia',
      email: 'anna@rowerownia.pl',
      ulica: 'Krakowska 12',
      kod_pocztowy: '31-000',
      miasto: 'Kraków',
    })
  })

  it('po zalozeniu konta loguje od razu, bez przepisywania hasla', async () => {
    // Kazanie przepisac dopiero co wpisane dane to najprostszy sposob na
    // porzucenie rejestracji w ostatnim kroku.
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(201, {}))
      .mockResolvedValueOnce(odpowiedz(200, { access: 'token' }))
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await waitFor(() => expect(przekierowania).toContain('/dashboard'))
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('/accounts/login/')
  })
})

describe('bledy z backendu', () => {
  it('pokazuje komunikat PRZY polu, ktorego dotyczy', async () => {
    /**
     * Najwazniejszy test w tym pliku.
     *
     * Poprzednia wersja pokazywala pierwszy blad z brzegu nad przyciskiem.
     * Przy trzech polach dalo sie zgadnac, ktorego dotyczy; przy dziesieciu
     * uzytkownik czyta "Ten NIP ma nieprawidlowa sume kontrolna" i szuka,
     * gdzie to poprawic.
     */
    vi.mocked(fetch).mockResolvedValueOnce(
      odpowiedz(400, { nip: ['Ten NIP ma nieprawidłową sumę kontrolną.'] }),
    )
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.type(screen.getByLabelText('NIP'), '5260250247')
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    const komunikat = await screen.findByRole('alert')
    expect(komunikat).toHaveTextContent(/sumę kontrolną/i)
  })

  it('ustawia ognisko na pierwszym polu z bledem', async () => {
    // Bez tego uzytkownik stoi na dole formularza, a problem jest osiem pol
    // wyzej, poza widokiem - i wyglada, jakby przycisk nie dzialal.
    vi.mocked(fetch).mockResolvedValueOnce(
      odpowiedz(400, { email: ['Konto z tym adresem juz istnieje.'] }),
    )
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Adres e-mail'))
    })
  })

  it('blad jednego pola nie kasuje wpisanych danych', async () => {
    // Formularz czyszczacy sie po odmowie to najpewniejszy sposob, zeby nikt
    // nie sprobowal drugi raz.
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(400, { nip: ['Zly NIP.'] }))
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Nazwa firmy')).toHaveValue('Rowerownia')
    expect(screen.getByLabelText('Miejscowość')).toHaveValue('Kraków')
  })

  it('nie loguje, gdy rejestracja sie nie powiodla', async () => {
    // Proba logowania na nieistniejace konto konczy sie drugim bledem
    // i komunikatem, ktory z pierwszym nie ma nic wspolnego.
    vi.mocked(fetch).mockResolvedValueOnce(odpowiedz(400, { email: ['Zajety.'] }))
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await screen.findByRole('alert')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })
})

describe('pola opcjonalne', () => {
  it('NIP i nazwa na fakturze nie sa wymagane', async () => {
    // Klientem bywa osoba prywatna. Wymuszanie NIP-u odcieloby ich calkowicie.
    vi.mocked(fetch)
      .mockResolvedValueOnce(odpowiedz(201, {}))
      .mockResolvedValueOnce(odpowiedz(200, { access: 'token' }))
    const uzytkownik = userEvent.setup()
    render(<RejestracjaPage />)

    await wypelnij(uzytkownik)
    await uzytkownik.click(screen.getByRole('button', { name: /Załóż konto/i }))

    await waitFor(() => expect(przekierowania).toContain('/dashboard'))
  })
})
