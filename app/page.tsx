'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'

/**
 * Strona wejściowa panelu.
 *
 * Była statycznym tekstem bez jednego odnośnika — zalogowany właściciel wchodził
 * na panel.agencjasm-art.pl i lądował w ślepym zaułku z informacją "zaloguj się",
 * mimo że był zalogowany, i bez czegokolwiek do kliknięcia.
 *
 * Zalogowanego przenosimy wprost do panelu, niezalogowanemu dajemy przycisk.
 * Sprawdzenie tokenu wymaga przeglądarki, więc do czasu pierwszego renderu po
 * stronie klienta pokazujemy stan neutralny zamiast migać niewłaściwą treścią.
 */
export default function HomePage() {
  const router = useRouter()
  const [zalogowany, setZalogowany] = useState<boolean | null>(null)

  useEffect(() => {
    const token = getToken()
    if (token) {
      router.replace('/dashboard')
      return
    }
    setZalogowany(false)
  }, [router])

  if (zalogowany === null) {
    return (
      <main className="min-h-screen grid place-items-center p-10">
        <p className="text-gray-500">Wczytywanie...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Sm-art Chatbot</h1>
        <p className="text-gray-600 mb-6">
          Panel do zarządzania chatbotem na Twojej stronie: wiedza firmy,
          wygląd widgetu i historia rozmów.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-800"
        >
          Zaloguj się
        </Link>
      </div>
    </main>
  )
}
