import Link from 'next/link'

/** Powrót ze Stripe, gdy klient przerwał płatność. Nic się nie zmieniło. */
export default function PlatnoscAnulowanoPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Płatność przerwana</h1>
      <p className="text-gray-600 mb-6">
        Nic nie zostało pobrane, a Twój dotychczasowy plan działa bez zmian. Możesz wrócić
        do wyboru w dowolnym momencie.
      </p>

      <div className="flex gap-3">
        <Link
          href="/subskrypcja"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white font-medium"
        >
          Wróć do cennika
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium"
        >
          Panel
        </Link>
      </div>
    </div>
  )
}
