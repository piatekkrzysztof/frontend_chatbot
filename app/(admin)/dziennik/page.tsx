'use client'

import { useEffect, useState } from 'react'

import { apiFetch, BladApi } from '@/lib/api'
import { opiszWpis, udana } from '@/lib/dziennik'

interface Wpis {
  id: number
  czas: string
  nazwa_uzytkownika: string
  metoda: string
  sciezka: string
  status: number
  adres_ip: string
}

interface Strona {
  count: number
  next: string | null
  previous: string | null
  results: Wpis[]
}

/**
 * Dziennik zdarzeń na koncie.
 *
 * Backend zapisywał te wpisy od dawna, ale właściciel nie miał jak do nich
 * zajrzeć inaczej niż przez API - czyli w praktyce nie zaglądał. Dziennik,
 * którego nikt nie czyta, nie chroni przed niczym; jest tylko dowodem po
 * fakcie, i to takim, po który trzeba zgłosić się do nas.
 */
export default function DziennikPage() {
  const [strona, setStrona] = useState<Strona | null>(null)
  const [numer, setNumer] = useState(1)
  const [wczytanyNumer, setWczytanyNumer] = useState(0)
  const [blad, setBlad] = useState('')
  const [brakUprawnien, setBrakUprawnien] = useState(false)

  // Stan ładowania wyliczony, nie trzymany osobno. Osobna flaga wymagałaby
  // ustawienia jej przy każdym wyjściu z pobierania - a zapomniana gałąź
  // zostawiłaby na ekranie "Wczytuję..." bez końca.
  const wczytuje = wczytanyNumer !== numer && !blad

  useEffect(() => {
    let aktualne = true

    apiFetch(`/accounts/dziennik/?page=${numer}`)
      .then((dane) => {
        if (!aktualne) return
        setStrona(dane as Strona)
        setWczytanyNumer(numer)
        setBlad('')
      })
      .catch((err) => {
        if (!aktualne) return
        // Pracownik dostaje 403 z IsOwner. To nie jest awaria, tylko granica
        // uprawnień - komunikat o błędzie kazałby mu szukać usterki, której
        // nie ma. Rozstrzyga status, nie treść komunikatu.
        if (err instanceof BladApi && err.status === 403) {
          setBrakUprawnien(true)
          return
        }
        setBlad(err instanceof Error ? err.message : 'Nie udało się wczytać dziennika.')
      })

    // Odpowiedź na porzuconą stronę nie może nadpisać tej, którą już widać:
    // klikając szybko "Starsze", zobaczyłoby się wtedy zawartość sprzed
    // dwóch kliknięć.
    return () => {
      aktualne = false
    }
  }, [numer])

  if (brakUprawnien) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">Dziennik zdarzeń</h1>
        <p className="tekst-drugi">
          Ten ekran widzi wyłącznie właściciel konta. Dziennik pokazuje, kto i kiedy zmieniał
          ustawienia oraz dane - również działania pracowników, więc wgląd w niego jest sam w sobie
          uprawnieniem.
        </p>
      </div>
    )
  }

  const wpisy = strona?.results ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dziennik zdarzeń</h1>
      <p className="tekst-drugi mb-6">
        Zapis zmian na koncie: logowania, zmiany ustawień, wgrane i usunięte dokumenty, eksporty
        danych. Jeśli zobaczysz tu coś, czego nie robiłeś - zmień hasło i włącz logowanie
        dwuetapowe.
      </p>

      {blad && (
        <p role="alert" className="text-sm text-[#c0392b] mb-4">
          {blad}
        </p>
      )}

      {wczytuje && !strona && <p className="tekst-drugi">Wczytuję dziennik...</p>}

      {strona && wpisy.length === 0 && (
        <p className="tekst-slaby">
          Dziennik jest pusty. Pierwsze wpisy pojawią się po zmianach na koncie.
        </p>
      )}

      {strona && wpisy.length > 0 && (
        <>
          {/* Szeroki widok: tabela. Wąski: karty. Ta sama treść renderowana dwa
              razy, bo pięć kolumn na telefonie znaczy poziome przewijanie -
              a wtedy poza ekran chowa się kolumna z wynikiem, czyli dokładnie
              ta informacja, dla której ktoś tu wchodzi. */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left tekst-slaby border-b obramowanie">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Kiedy
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Kto
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Co się stało
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Wynik
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Adres IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {wpisy.map((wpis) => {
                  const { opis, rozpoznane } = opiszWpis(wpis.metoda, wpis.sciezka)
                  return (
                    <tr key={wpis.id} className="border-b obramowanie">
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                        {sformatujCzas(wpis.czas)}
                      </td>
                      <td className="py-2 pr-4">{wpis.nazwa_uzytkownika || 'niezalogowany'}</td>
                      <td className={`py-2 pr-4 ${rozpoznane ? '' : 'font-mono text-xs'}`}>
                        {opis}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <Wynik status={wpis.status} />
                      </td>
                      <td className="py-2 font-mono text-xs tekst-slaby">{wpis.adres_ip || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden flex flex-col gap-3">
            {wpisy.map((wpis) => {
              const { opis, rozpoznane } = opiszWpis(wpis.metoda, wpis.sciezka)
              return (
                <li key={wpis.id} className="rounded border obramowanie p-4">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs tekst-slaby tabular-nums">
                      {sformatujCzas(wpis.czas)}
                    </span>
                    <Wynik status={wpis.status} />
                  </div>
                  <p className={`text-sm ${rozpoznane ? '' : 'font-mono text-xs break-all'}`}>
                    {opis}
                  </p>
                  <p className="text-xs tekst-slaby mt-1">
                    {wpis.nazwa_uzytkownika || 'niezalogowany'}
                    {wpis.adres_ip && <span className="font-mono"> · {wpis.adres_ip}</span>}
                  </p>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => setNumer((n) => n - 1)}
              disabled={!strona.previous || wczytuje}
              className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm disabled:opacity-40"
            >
              Nowsze
            </button>
            <button
              type="button"
              onClick={() => setNumer((n) => n + 1)}
              disabled={!strona.next || wczytuje}
              className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm disabled:opacity-40"
            >
              Starsze
            </button>
            <p className="text-sm tekst-slaby" aria-live="polite">
              Strona {numer}, wpisów łącznie: {strona.count}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Wynik operacji słowem, nie kodem HTTP - i nie samym kolorem, bo na to jest
 * za ważny. Kolor tylko wzmacnia napis.
 */
function Wynik({ status }: { status: number }) {
  if (udana(status)) {
    return <span className="text-xs text-[#1f7a4d]">wykonano</span>
  }
  if (status >= 500) {
    return <span className="text-xs text-[#c0392b]">błąd serwera</span>
  }
  return <span className="text-xs text-[#c0392b]">odmowa ({status})</span>
}

function sformatujCzas(czas: string): string {
  const data = new Date(czas)
  if (Number.isNaN(data.getTime())) return czas
  return data.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
