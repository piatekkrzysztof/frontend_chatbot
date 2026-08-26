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
      })

      return () => {
        aktualne = false
      }
    }, [router])

    if (!gotowe) {
      return (
        <div className="admin-shell motyw-jasny grid min-h-dvh place-items-center">
          <p className="tekst-drugi">Wczytywanie panelu...</p>
        </div>
      )
    }

    return <Component {...props} />
  }
}
