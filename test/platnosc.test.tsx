/**
 * Powrot ze Stripe.
 *
 * Kategoria ryzyka: PIENIADZE. Klient w tym momencie juz zaplacil. Stripe
 * odsyla go tutaj natychmiast, ale plan aktywuje dopiero webhook -- miedzy
 * jednym a drugim jest okno kilku sekund, w ktorym backend zgodnie z prawda
 * mowi "jeszcze w toku".
 *
 * Najgorszy mozliwy blad tej strony to pokazac w tym oknie komunikat o
 * niepowodzeniu. Klient widzi obciazenie na karcie i porazke na ekranie,
 * wiec albo placi drugi raz, albo sklada reklamacje. Drugi w kolejnosci:
 * oglosic sukces, ktorego nie bylo - dawniej strona pytala o ogolny stan
 * planu i firma w okresie probnym od razu widziala "plan aktywny". Dlatego
 * strona pyta o KONKRETNA sesje platnosci.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PlatnoscSukcesPage from '@/app/(admin)/platnosc/sukces/page'
import PlatnoscAnulowanoPage from '@/app/(admin)/platnosc/anulowano/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

const SESJA = 'cs_test_a1b2c3d4e5f6'
const W_TOKU = { status: 'w_toku', plan: 'pro', plan_name: 'Pro', access_until: null }
const AKTYWNA = { status: 'aktywna', plan: 'pro', plan_name: 'Pro', access_until: '2026-10-17' }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.history.replaceState({}, '', `/platnosc/sukces?session_id=${SESJA}`)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('udana platnosc', () => {
  it('pyta o konkretna sesje platnosci, nie o ogolny stan planu', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(AKTYWNA)

    render(<PlatnoscSukcesPage />)
    await screen.findByText('Pro')

    expect(wywolania).toHaveBeenCalledWith(`/billing/checkout-session/${SESJA}/`)
    expect(wywolania).not.toHaveBeenCalledWith('/billing/plans/')
  })

  it('czeka, zamiast od razu oglosic porazke albo sukces', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue(W_TOKU)

    render(<PlatnoscSukcesPage />)

    expect(await screen.findByText(/Aktywuję Twój plan/i)).toBeInTheDocument()
    expect(screen.queryByText(/Płatność przyjęta/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/jest już aktywny/i)).not.toBeInTheDocument()
  })

  it('pokazuje plan, gdy platnosc potwierdzi sie dopiero przy trzeciej probie', async () => {
    // To jest scenariusz, dla ktorego odpytywanie w ogole istnieje.
    // Test z odpowiedzia aktywna od pierwszego strzalu przeszedlby takze
    // wtedy, gdyby ponawianie w ogole nie dzialalo.
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValueOnce(W_TOKU)
      .mockResolvedValueOnce(W_TOKU)
      .mockResolvedValue(AKTYWNA)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(5000)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledTimes(3)
  })

  it('przestaje odpytywac, gdy plan juz jest', async () => {
    // Odpytywanie mimo aktywnego planu to darmowy ruch na backend
    // od kazdego, kto zostawi te zakladke otwarta.
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(AKTYWNA)

    render(<PlatnoscSukcesPage />)
    await screen.findByText('Pro')
    await vi.advanceTimersByTimeAsync(20000)

    expect(wywolania).toHaveBeenCalledTimes(1)
  })

  it('po wyczerpaniu prob uspokaja, a nie straszy', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(W_TOKU)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(15000)

    const tresc = await screen.findByText(/Płatność przyjęta/i)
    expect(tresc).toBeInTheDocument()
    expect(screen.queryByText(/nie powiodła|błąd|niepowodzen/i)).not.toBeInTheDocument()
    // Odpytywanie ma koniec -- inaczej strona zostawiona na noc
    // wysyla zapytanie co dwie sekundy do rana.
    expect(wywolania).toHaveBeenCalledTimes(5)
  })

  it('blad sieci i chwilowa niedostepnosc Stripe nie przerywaja odpytywania', async () => {
    // Webhook potrafi dojsc dokladnie w chwili, gdy klientowi mrugnie
    // wifi albo Stripe odpowie 503. Poddanie sie po pierwszym bledzie
    // zamieniloby to w porazke.
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockRejectedValueOnce(new Error('siec padla'))
      .mockRejectedValueOnce(new BladApi(503, 'Nie możemy teraz sprawdzić płatności w Stripe.'))
      .mockResolvedValue(AKTYWNA)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(7000)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledTimes(3)
  })

  it('opuszczenie strony zatrzymuje odpytywanie', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(W_TOKU)
    const { unmount } = render(<PlatnoscSukcesPage />)
    await waitFor(() => expect(wywolania).toHaveBeenCalled())

    unmount()
    const poWyjsciu = wywolania.mock.calls.length
    await vi.advanceTimersByTimeAsync(15000)

    expect(wywolania).toHaveBeenCalledTimes(poWyjsciu)
  })
})

describe('platnosc, ktorej nie bylo', () => {
  it('wygasla sesja mowi, ze nic nie pobrano, i konczy odpytywanie', async () => {
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValue({ ...W_TOKU, status: 'wygasla' })

    render(<PlatnoscSukcesPage />)

    expect(await screen.findByText(/nic nie zostało pobrane/i)).toBeInTheDocument()
    expect(screen.queryByText(/Dziękujemy za płatność/i)).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(15000)
    expect(wywolania).toHaveBeenCalledTimes(1)
  })

  it('cudza albo nieistniejaca sesja nie udaje sukcesu', async () => {
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockRejectedValue(new BladApi(404, 'Nie znaleźliśmy tej płatności na Twoim koncie.'))

    render(<PlatnoscSukcesPage />)

    expect(
      await screen.findByRole('heading', { name: 'Nie znaleźliśmy tej płatności' }),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(15000)
    expect(wywolania).toHaveBeenCalledTimes(1)
  })

  it('bez identyfikatora sesji nie pyta backendu', async () => {
    window.history.replaceState({}, '', '/platnosc/sukces')
    const wywolania = vi.spyOn(api, 'apiFetch')

    render(<PlatnoscSukcesPage />)

    expect(
      await screen.findByRole('heading', { name: 'Nie znaleźliśmy tej płatności' }),
    ).toBeInTheDocument()
    expect(wywolania).not.toHaveBeenCalled()
  })
})

describe('przerwana platnosc', () => {
  it('mowi wprost, ze nic nie pobrano, i nie rusza rozliczen', () => {
    // Przerwana platnosc nie moze wygladac na czesciowo udana ani
    // wywolywac zadnego zapytania o plan -- nie ma czego sprawdzac.
    const wywolania = vi.spyOn(api, 'apiFetch')

    render(<PlatnoscAnulowanoPage />)

    expect(screen.getByText(/Nic nie zostało pobrane/i)).toBeInTheDocument()
    expect(wywolania).not.toHaveBeenCalled()
  })
})
