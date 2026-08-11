'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

/**
 * Powrót ze Stripe po udanej płatności.
 *
 * Stripe odsyła tu natychmiast, ale plan aktywuje dopiero webhook — a ten
 * potrafi przyjść z kilkusekundowym opóźnieniem. Dlatego odpytujemy backend
 * kilka razy, zamiast raz pokazać nieaktualny stan i zostawić klienta
 * z wrażeniem, że zapłacił na darmo.
 */
const PROBY = 5
const ODSTEP_MS = 2000

export default function PlatnoscSukcesPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [czekamy, setCzekamy] = useState(true)

  useEffect(() => {
    let active = true
    let proba = 0

    async function sprawdz() {
      try {
        const dane = await apiFetch('/billing/plans/')
        if (!active) return

        if (dane.current?.is_active && dane.current?.plan) {
          setPlan(dane.current.name || dane.current.plan)
          setCzekamy(false)
          return
        }
      } catch {
        // brak sieci albo wygasła sesja — spróbujemy ponownie
      }

      proba += 1
      if (proba < PROBY && active) {
        setTimeout(sprawdz, ODSTEP_MS)
      } else if (active) {
        setCzekamy(false)
      }
    }

    sprawdz()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Dziękujemy za płatność</h1>

      {czekamy && (
        <p className="tekst-drugi mb-6">Aktywuję Twój plan — chwileczkę...</p>
      )}

      {!czekamy && plan && (
        <p className="tekst-drugi mb-6">
          Plan <span className="font-medium">{plan}</span> jest już aktywny. Nowy limit
          wiadomości obowiązuje od teraz.
        </p>
      )}

      {!czekamy && !plan && (
        <p className="tekst-drugi mb-6">
          Płatność przyjęta. Aktywacja planu potrafi zająć chwilę dłużej — odśwież za
          moment zakładkę Subskrypcja. Jeśli po kilku minutach nic się nie zmieni, napisz
          do nas, sprawdzimy to.
        </p>
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
