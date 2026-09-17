'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Zajetosc {
  zajete_bajty: number
  limit_bajtow: number
  limit_mb: number
  procent: number
  ponad_limitem: boolean
}

const MB = 1024 * 1024

function mb(bajty: number) {
  return `${(bajty / MB).toFixed(1)} MB`
}

/**
 * Ile miejsca zajmuje baza wiedzy i ile jej przysługuje.
 *
 * Bez tego klient dowiadywał się o limicie dopiero wtedy, gdy wgranie się nie
 * udało - po przygotowaniu pliku i czekaniu na odczyt. Po zejściu z wyższego
 * planu nie dowiadywał się w ogóle, dopóki czegoś nie dodał, choć od tej chwili
 * nie mógł już bazy powiększać.
 *
 * Pasek potrafi pokazać ponad 100%: po obniżeniu planu baza bywa większa od
 * limitu. Przycięcie do setki ukryłoby dokładnie ten stan, dla którego to
 * powstało.
 */
export default function ZajetoscBazy({ wersja = 0 }: { wersja?: number }) {
  const [dane, setDane] = useState<Zajetosc | null>(null)

  useEffect(() => {
    let aktywne = true
    apiFetch('/documents/uzycie/')
      .then((wynik) => {
        if (aktywne) setDane(wynik as Zajetosc)
      })
      // Cicho: to informacja pomocnicza. Czerwony komunikat o niej przykryłby
      // błędy dotyczące samych dokumentów, czyli tego, po co klient tu przyszedł.
      .catch(() => {})
    return () => {
      aktywne = false
    }
  }, [wersja])

  if (!dane) return null

  const szerokosc = Math.min(100, dane.procent)

  return (
    <section aria-labelledby="naglowek-zajetosc" className="mb-8">
      <h2 id="naglowek-zajetosc" className="sr-only">
        Zajętość bazy wiedzy
      </h2>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm tekst-drugi">
          Zajęte: {mb(dane.zajete_bajty)} z {dane.limit_mb} MB w Twoim planie
        </span>
        <span className={`text-sm ${dane.ponad_limitem ? 'text-red-600' : 'tekst-slaby'}`}>
          {dane.procent}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={dane.procent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Zajętość bazy wiedzy"
      >
        <div
          className={`h-2 rounded ${dane.ponad_limitem ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-200'}`}
          style={{ width: `${szerokosc}%` }}
        />
      </div>
      {dane.ponad_limitem && (
        <p className="text-sm text-red-600 mt-2">
          Baza wiedzy przekracza limit Twojego planu. Możesz ją odświeżać i zmniejszać,
          ale nie powiększać - usuń część materiałów albo przejdź na wyższy plan.
        </p>
      )}
    </section>
  )
}
