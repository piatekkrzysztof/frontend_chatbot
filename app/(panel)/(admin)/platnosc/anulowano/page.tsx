import Link from 'next/link'

/** Powrót ze Stripe, gdy klient przerwał płatność. Nic się nie zmieniło. */
export default function PlatnoscAnulowanoPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Płatność przerwana</h1>
      <p className="tekst-drugi mb-6">
        Nic nie zostało pobrane, a Twój dotychczasowy plan działa bez zmian. Możesz wrócić
        do wyboru w dowolnym momencie.
      </p>

      <div className="flex gap-3">
        <Link
          href="/subskrypcja"
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          Wróć do cennika
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm font-medium"
        >
          Panel
        </Link>
      </div>
    </div>
  )
}
