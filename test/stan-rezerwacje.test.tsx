/**
 * Zakładka Stan: rozliczanie pracy bota.
 *
 * Kategoria ryzyka: KONTROLA, DO KTÓREJ TRZEBA PAMIĘTAĆ ZAJRZEĆ. Nocne
 * czuwanie nad rezerwacjami działa od 2.16.0, ale jego wynik dało się
 * zobaczyć wyłącznie w logu usługi na Renderze. Log, do którego trzeba zejść,
 * nie jest kontrolą - tak samo jak nie była nią odhaczana ręcznie lista,
 * przez którą awaria z sierpnia trwała dobę.
 *
 * Testy pilnują trzech rzeczy: że karta w ogóle się pokazuje, że liczba
 * wiadomości zajętych przez nierozliczone bilety jest widoczna, i że wynik
 * „nie da się potwierdzić" nie udaje wyniku „działa".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StanPage from '@/app/(admin)/stan/page'
import * as api from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

const BROKER = {
  broker_osiagalny: true,
  odpowiedzialo_workerow: 1,
  nazwy: ['celery@render'],
}

function odpowiedz(rezerwacje: Record<string, unknown>, poziom = 'ok', werdykt = 'Wszystko działa.') {
  return {
    sprawdzono: '2026-09-30T04:10:00+00:00',
    poziom,
    werdykt,
    broker_i_workery: BROKER,
    zadeklarowany_harmonogram: ['rezerwacje-do-rozliczenia-codziennie'],
    slady_w_danych: {
      pobieranie_stron: { wniosek: 'dziala', opis: 'Świeże pobranie.' },
      czyszczenie_rodo: { wniosek: 'dziala', opis: 'Retencja dotrzymana.' },
      rozliczanie_rezerwacji: rezerwacje,
    },
    baza_wiedzy: { wniosek: 'dziala', opis: 'Wiedza obecna.' },
    poczta: { wniosek: 'dziala', opis: 'Poczta działa.' },
  }
}

// Zakladka wola dwa adresy: zadania i - z pominieciem bledu - adres klienta.
function backend(dane: unknown) {
  return vi.spyOn(api, 'apiFetch').mockImplementation((sciezka: string) => {
    if (sciezka.includes('diagnostyka/zadania')) {
      return Promise.resolve(dane as never)
    }
    return Promise.reject(new Error('nieużywane'))
  })
}

describe('karta rozliczania pracy bota', () => {
  it('pokazuje liczbę wiadomości czekających na rozliczenie', async () => {
    backend(
      odpowiedz(
        {
          wniosek: 'dziala',
          opis: 'Są bilety w okolicy 90 dni i żaden nie przekracza progu.',
          do_rozliczenia: 3,
          zaleglych_biletow: 0,
        },
        'uwaga',
        'ZAPLECZE DZIAŁA, ALE 3 REZERWACJE AI CZEKAJĄ NA ROZLICZENIE.',
      ),
    )

    render(<StanPage />)

    expect(await screen.findByText('Rozliczanie pracy bota')).toBeVisible()
    expect(screen.getByText(/Wiadomości czekających na rozliczenie: 3/)).toBeVisible()
  })

  it('nie udaje, że sprzątanie działa, gdy nie ma czego kasować', async () => {
    backend(
      odpowiedz({
        wniosek: 'brak-danych',
        opis: 'Żaden rozliczony bilet nie zbliżył się do 90 dni.',
        do_rozliczenia: 0,
        zaleglych_biletow: 0,
      }),
    )

    render(<StanPage />)

    expect(await screen.findByText(/nie zbliżył się do 90 dni/)).toBeVisible()
  })

  it('pokazuje zaległe bilety jako awarię sprzątania', async () => {
    backend(
      odpowiedz(
        {
          wniosek: 'nie-dziala',
          opis: '4 rozliczonych biletów przekracza 90 dni i nadal leży w bazie.',
          do_rozliczenia: 0,
          zaleglych_biletow: 4,
        },
        'awaria',
        'NIE DZIAŁA: rozliczanie rezerwacji AI.',
      ),
    )

    render(<StanPage />)

    expect(await screen.findByText(/Biletów po terminie sprzątania: 4/)).toBeVisible()
  })

  it('pokazuje zero, gdy backend nie podał liczb', async () => {
    // Starsza wersja backendu nie zna tych pol. Karta ma sie pokazac
    // z zerami, a nie zniknac albo wypisac "undefined".
    backend(odpowiedz({ wniosek: 'dziala', opis: 'Bilety w normie.' }))

    render(<StanPage />)

    expect(await screen.findByText(/Wiadomości czekających na rozliczenie: 0/)).toBeVisible()
    expect(screen.getByText(/Biletów po terminie sprzątania: 0/)).toBeVisible()
  })
})
