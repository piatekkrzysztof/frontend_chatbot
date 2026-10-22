'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { odswiezSesje, pobierzToken } from '@/lib/auth'

/**
 * Odtworzenie sesji po wejsciu na strone.
 *
 * Token dostepu zyje w pamieci karty, wiec po kazdym odswiezeniu strony
 * pamiec jest pusta. Zanim panel cokolwiek wyrenderuje, wymieniamy ciasteczko
 * odswiezania na nowy token.
 *
 * Dlaczego blokujemy render, zamiast puscic dzieci od razu: kazdy ekran
 * panelu odpytuje API w swoim efekcie. Bez tokenu wszystkie te zapytania
 * odbijaja sie z 401, po czym kazde po kolei czeka na odswiezenie i idzie
 * drugi raz. Zaczekanie tutaj zamienia dwie tury zapytan na jedna.
 *
 * Czego to NIE jest: ochrona. Trasy chroni middleware, po stronie serwera,
 * zanim cokolwiek dojdzie do przegladarki. Tutaj chodzi o poprawny stan
 * sesji, nie o zamkniete drzwi -- kto by ten kod obszedl, dostanie z API
 * 401 przy pierwszym zapytaniu.
 */
export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function ProtectedComponent(props: T) {
    const router = useRouter()
    const [gotowe, setGotowe] = useState(() => pobierzToken() !== null)
    const [blad, setBlad] = useState('')
    const [proba, setProba] = useState(0)

    useEffect(() => {
      if (pobierzToken()) return

      let aktualne = true

      odswiezSesje().then((token) => {
        if (!aktualne) return
        if (token) {
          setGotowe(true)
          return
        }
        // Ciasteczko wygaslo albo zostalo uniewaznione. Middleware
        // przepuscilo, bo znacznik sesji jeszcze lezal w przegladarce.
        router.replace('/login?wygasla=1')
      }, (powod) => {
        // Chwilowa odmowa (limit zapytan, awaria, siec): sesja moze nadal
        // istniec, wiec zamiast ekranu logowania - ponowienie (audyt A-05).
        if (aktualne) setBlad(powod instanceof Error ? powod.message : 'Nie udało się połączyć z serwerem.')
      })

      return () => {
        aktualne = false
      }
    }, [router, proba])

    if (!gotowe) {
      return (
        // Styl w linii, bo .admin-shell (poza warstwami Tailwinda) wygrywa
        // z klasami: na komputerze ma siatke z kolumna na menu (17,5rem), na
        // telefonie display: block - napis ladowal w waskiej kolumnie po lewej
        // albo przyklejony do gornej krawedzi.
        <div
          className="admin-shell motyw-jasny min-h-dvh place-items-center"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          {blad ? (
            <div className="grid justify-items-center gap-4 px-5 text-center">
              <p role="alert" className="tekst-drugi max-w-md">{blad}</p>
              <button
                type="button"
                className="btn-primary min-h-11"
                onClick={() => {
                  setBlad('')
                  setProba((poprzednia) => poprzednia + 1)
                }}
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : (
            <p className="tekst-drugi">Wczytywanie panelu...</p>
          )}
        </div>
      )
    }

    return <Component {...props} />
  }
}
