/**
 * Zachowanie widgetu, gdy czat jest niedostepny.
 *
 * Kategoria ryzyka: CICHA AWARIA po stronie odwiedzajacego. Wygasla
 * subskrypcja klienta wyglada z zewnatrz jak zepsuty bot. Przez dlugi czas
 * widget mowil wtedy "Wystapil blad. Sprobuj ponownie." -- prosil o
 * powtorzenie czegos, co nigdy nie zadziala, i nie dawal zadnego innego
 * wyjscia. Zdarzylo sie to naprawde, na stronie samej agencji.
 *
 * Testy pilnuja trzech rzeczy naraz: ze komunikat jest uczciwy, ze pojawia sie
 * droga wyjscia (formularz kontaktu), i ze zwykly blad sieci NADAL prosi
 * o ponowienie -- bo tam ponowienie ma sens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetChat from '@/components/widget/WidgetChat'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('key=klucz-testowy'),
}))

/** Odpowiedz backendu na zapytanie o ustawienia -- widget bez niej nie wstaje. */
const USTAWIENIA = {
  widget_title: 'Zapytaj nas',
  widget_color: '#F97316',
  widget_position: 'right',
  branding_mode: 'smart',
  widget_suggested_questions: [],
  widget_languages: ['pl'],
}

function odpowiedz(status: number, cialo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    json: () => Promise.resolve(cialo),
  } as unknown as Response
}

/** Podstawia backend: ustawienia zawsze dzialaja, czat odpowiada wedle uznania. */
function podstawBackend(naCzat: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((adres: string) => {
      if (String(adres).includes('/widget-settings/')) {
        return Promise.resolve(odpowiedz(200, USTAWIENIA))
      }
      return Promise.resolve(naCzat)
    }),
  )
}

async function napiszWiadomosc() {
  const uzytkownik = userEvent.setup()
  render(<WidgetChat />)

  const pole = await screen.findByPlaceholderText(/Napisz wiadomość/i)
  await uzytkownik.type(pole, 'Dzień dobry')
  await uzytkownik.keyboard('{Enter}')
  return uzytkownik
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('czat niedostepny', () => {
  it('nie prosi o ponowienie, bo to nigdy nie zadziala', async () => {
    podstawBackend(
      odpowiedz(403, { error: 'Subscription expired', kod: 'czat_niedostepny' }),
    )

    await napiszWiadomosc()

    expect(await screen.findByText(/chwilowo niedostępny/i)).toBeInTheDocument()
    expect(screen.queryByText(/Spróbuj ponownie/i)).not.toBeInTheDocument()
  })

  it('proponuje zostawienie kontaktu zamiast zostawiac bez wyjscia', async () => {
    // To jest cala wartosc tej zmiany: nieudana rozmowa zamienia sie
    // w zapytanie handlowe, zamiast w zamknieta karte.
    podstawBackend(
      odpowiedz(403, { error: 'Subscription expired', kod: 'czat_niedostepny' }),
    )

    await napiszWiadomosc()

    await waitFor(() => {
      // Celowo pelna fraza propozycji, nie samo "Zostaw kontakt": ten drugi
      // napis stoi na stale w stopce widgetu, wiec pasowalby zawsze -- takze
      // wtedy, gdyby propozycja w ogole sie nie pokazala.
      expect(screen.getByText(/Nie znalazłeś odpowiedzi\? Zostaw kontakt/i)).toBeInTheDocument()
    })
  })

  it('nie zdradza odwiedzajacemu rozliczen firmy', async () => {
    // Odwiedzajacy sklep nie ma sie dowiadywac, ze wlascicielowi skonczyla
    // sie subskrypcja. To jego sprawa z nami, nie z jego klientami.
    podstawBackend(
      odpowiedz(403, { error: 'Subscription expired', kod: 'czat_niedostepny' }),
    )

    await napiszWiadomosc()
    await screen.findByText(/chwilowo niedostępny/i)

    expect(screen.queryByText(/subskrypcj/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/limit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/plan/i)).not.toBeInTheDocument()
  })

  it('wyczerpany limit traktuje tak samo', async () => {
    // Inny powod, ta sama sytuacja z punktu widzenia odwiedzajacego.
    podstawBackend(
      odpowiedz(429, { error: 'Message limit exceeded', kod: 'czat_niedostepny' }),
    )

    await napiszWiadomosc()

    expect(await screen.findByText(/chwilowo niedostępny/i)).toBeInTheDocument()
  })
})

describe('zwykla awaria', () => {
  it('NADAL prosi o ponowienie, bo tam ponowienie ma sens', async () => {
    // Bez tego testu naprawa mogłaby po cichu zamienić każdy błąd
    // w "czat niedostępny" i odebrać sens jedynej akcji, jaką
    // odwiedzający ma pod ręką przy chwilowej awarii sieci.
    podstawBackend(odpowiedz(502, { error: 'Bad gateway' }))

    await napiszWiadomosc()

    expect(await screen.findByText(/Spróbuj ponownie/i)).toBeInTheDocument()
  })
})
