/**
 * Powrot ze Stripe.
 *
 * Kategoria ryzyka: PIENIADZE. Klient w tym momencie juz zaplacil. Stripe
 * odsyla go tutaj natychmiast, ale plan aktywuje dopiero webhook -- miedzy
 * jednym a drugim jest okno kilku sekund, w ktorym backend zgodnie z prawda
 * mowi "planu nie ma".
 *
 * Najgorszy mozliwy blad tej strony to pokazac w tym oknie komunikat o
 * niepowodzeniu. Klient widzi obciazenie na karcie i porazke na ekranie,
 * wiec albo placi drugi raz, albo sklada reklamacje. Dlatego testy pilnuja
 * nie tylko tego, ze strona doczeka sie webhooka, ale i tego, co mowi, gdy
 * sie nie doczeka.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PlatnoscSukcesPage from '@/app/(admin)/platnosc/sukces/page'
import PlatnoscAnulowanoPage from '@/app/(admin)/platnosc/anulowano/page'
import * as api from '@/lib/api'

const NIEAKTYWNY = { current: { is_active: false, plan: null } }
const AKTYWNY = { current: { is_active: true, plan: 'pro', name: 'Pro' } }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('udana platnosc', () => {
  it('czeka, zamiast od razu oglosic porazke', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue(NIEAKTYWNY)

    render(<PlatnoscSukcesPage />)

    expect(await screen.findByText(/Aktywuję Twój plan/i)).toBeInTheDocument()
    expect(screen.queryByText(/Płatność przyjęta/i)).not.toBeInTheDocument()
  })

  it('pokazuje plan, gdy webhook dojdzie dopiero przy trzeciej probie', async () => {
    // To jest scenariusz, dla ktorego odpytywanie w ogole istnieje.
    // Test z odpowiedzia aktywna od pierwszego strzalu przeszedlby takze
    // wtedy, gdyby ponawianie w ogole nie dzialalo.
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValueOnce(NIEAKTYWNY)
      .mockResolvedValueOnce(NIEAKTYWNY)
      .mockResolvedValue(AKTYWNY)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(5000)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledTimes(3)
  })

  it('przestaje odpytywac, gdy plan juz jest', async () => {
    // Odpytywanie mimo aktywnego planu to darmowy ruch na backend
    // od kazdego, kto zostawi te zakladke otwarta.
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(AKTYWNY)

    render(<PlatnoscSukcesPage />)
    await screen.findByText('Pro')
    await vi.advanceTimersByTimeAsync(20000)

    expect(wywolania).toHaveBeenCalledTimes(1)
  })

  it('po wyczerpaniu prob uspokaja, a nie straszy', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(NIEAKTYWNY)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(15000)

    const tresc = await screen.findByText(/Płatność przyjęta/i)
    expect(tresc).toBeInTheDocument()
    expect(screen.queryByText(/nie powiodła|błąd|niepowodzen/i)).not.toBeInTheDocument()
    // Odpytywanie ma koniec -- inaczej strona zostawiona na noc
    // wysyla zapytanie co dwie sekundy do rana.
    expect(wywolania).toHaveBeenCalledTimes(5)
  })

  it('blad sieci nie przerywa odpytywania', async () => {
    // Webhook potrafi dojsc dokladnie w chwili, gdy odwiedzajacemu mrugnie
    // wifi. Poddanie sie po pierwszym bledzie zamienilo by to w porazke.
    const wywolania = vi
      .spyOn(api, 'apiFetch')
      .mockRejectedValueOnce(new Error('siec padla'))
      .mockResolvedValue(AKTYWNY)

    render(<PlatnoscSukcesPage />)
    await vi.advanceTimersByTimeAsync(5000)

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(wywolania).toHaveBeenCalledTimes(2)
  })

  it('opuszczenie strony zatrzymuje odpytywanie', async () => {
    const wywolania = vi.spyOn(api, 'apiFetch').mockResolvedValue(NIEAKTYWNY)
    const { unmount } = render(<PlatnoscSukcesPage />)
    await waitFor(() => expect(wywolania).toHaveBeenCalled())

    unmount()
    const poWyjsciu = wywolania.mock.calls.length
    await vi.advanceTimersByTimeAsync(15000)

    expect(wywolania).toHaveBeenCalledTimes(poWyjsciu)
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
