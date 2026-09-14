'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, BladApi } from '@/lib/api'

/**
 * Powrót ze Stripe po płatności.
 *
 * Strona pyta o KONKRETNĄ sesję płatności (`session_id` w adresie), a nie
 * o ogólny stan planu. Pytanie o plan dawało fałszywe „aktywny" firmie
 * w okresie próbnym, zanim cokolwiek się stało, i nie odróżniało wygasłej
 * sesji od spóźnionego webhooka.
 *
 * Plan aktywuje webhook, który potrafi przyjść z kilkusekundowym opóźnieniem.
 * Backend przy tym pytaniu sam uzgadnia stan ze Stripe, ale płatność może być
 * jeszcze przetwarzana - dlatego kilka prób, a nie jedna.
 */
const PROBY = 5
const ODSTEP_MS = 2000

type Stan =
  | { rodzaj: 'czekam' }
  | { rodzaj: 'aktywna'; plan: string }
  | { rodzaj: 'w_toku' }
  | { rodzaj: 'wygasla' }
  | { rodzaj: 'nieaktywna' }
  | { rodzaj: 'nie_znaleziono' }
  | { rodzaj: 'brak_uprawnien' }

export default function PlatnoscSukcesPage() {
  const [stan, setStan] = useState<Stan>({ rodzaj: 'czekam' })

  const zegar = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    let proba = 0
    const sesja = new URLSearchParams(window.location.search).get('session_id')

    async function sprawdz() {
      // Zaplanowana proba potrafi wystartowac juz po opuszczeniu strony.
      // Sam `active` sprawdzany po odpowiedzi wstrzymuje tylko reakcje -
      // zapytanie i tak leci.
      if (!active) return
      try {
        if (!sesja) throw new BladApi(404, 'Brak identyfikatora płatności.')
        const dane = await apiFetch(`/billing/checkout-session/${encodeURIComponent(sesja)}/`)
        if (!active) return

        if (dane.status === 'aktywna') {
          setStan({ rodzaj: 'aktywna', plan: dane.plan_name || dane.plan })
          return
        }
        if (dane.status === 'wygasla' || dane.status === 'nieaktywna') {
          setStan({ rodzaj: dane.status })
          return
        }
      } catch (err) {
        if (!active) return
        // Tych odpowiedzi ponawianie nie zmieni. Brak sieci i 503 ze Stripe -
        // zmieni, wiec dla nich probujemy dalej.
        if (err instanceof BladApi && err.status === 404) {
          setStan({ rodzaj: 'nie_znaleziono' })
          return
        }
        if (err instanceof BladApi && err.status === 403) {
          setStan({ rodzaj: 'brak_uprawnien' })
          return
        }
      }

      proba += 1
      if (proba < PROBY && active) {
        zegar.current = setTimeout(sprawdz, ODSTEP_MS)
      } else if (active) {
        setStan({ rodzaj: 'w_toku' })
      }
    }

    sprawdz()

    return () => {
      active = false
      if (zegar.current) clearTimeout(zegar.current)
    }
  }, [])

  const naglowek =
    stan.rodzaj === 'wygasla'
      ? 'Płatność nie została zakończona'
      : stan.rodzaj === 'nieaktywna'
        ? 'Subskrypcja nie jest już aktywna'
        : stan.rodzaj === 'nie_znaleziono'
          ? 'Nie znaleźliśmy tej płatności'
          : 'Dziękujemy za płatność'

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">{naglowek}</h1>

      {stan.rodzaj === 'czekam' && (
        <p role="status" className="tekst-drugi mb-6">Aktywuję Twój plan — chwileczkę...</p>
      )}

      {stan.rodzaj === 'aktywna' && (
        <p role="status" className="tekst-drugi mb-6">
          Plan <span className="font-medium">{stan.plan}</span> jest już aktywny. Nowy limit
          wiadomości obowiązuje od teraz.
        </p>
      )}

      {stan.rodzaj === 'w_toku' && (
        <p role="status" className="tekst-drugi mb-6">
          Płatność przyjęta. Aktywacja planu potrafi zająć chwilę dłużej — odśwież za
          moment zakładkę Subskrypcja. Jeśli po kilku minutach nic się nie zmieni, napisz
          do nas, sprawdzimy to.
        </p>
      )}

      {stan.rodzaj === 'wygasla' && (
        <p className="tekst-drugi mb-6">
          Sesja płatności wygasła i nic nie zostało pobrane. Możesz wybrać plan ponownie.
        </p>
      )}

      {stan.rodzaj === 'nieaktywna' && (
        <p className="tekst-drugi mb-6">
          Ta płatność dotyczy subskrypcji, która została już anulowana. Aktualny stan znajdziesz
          w zakładce Subskrypcja.
        </p>
      )}

      {stan.rodzaj === 'nie_znaleziono' && (
        <p className="tekst-drugi mb-6">
          Ten adres nie wskazuje płatności na Twoim koncie. Jeśli płatność została pobrana, stan
          planu sprawdzisz w zakładce Subskrypcja, a w razie wątpliwości napisz do nas.
        </p>
      )}

      {stan.rodzaj === 'brak_uprawnien' && (
        <p className="tekst-drugi mb-6">Stan zakupu i płatności widzi właściciel konta.</p>
      )}

      <div className="flex gap-3">
        <Link
          href="/subskrypcja"
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          Zobacz subskrypcję
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm font-medium"
        >
          Wróć do panelu
        </Link>
      </div>
    </div>
  )
}
