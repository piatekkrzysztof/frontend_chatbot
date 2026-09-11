import Link from 'next/link'
import ResendConfirmation from '@/components/auth/ResendConfirmation'

export default function ActivationHelpPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl mb-4">Dokończ aktywację konta</h1>
      <p className="text-sand-300">Podaj adres użyty przy rejestracji. Link jest ważny 24 godziny.
        Sprawdź również folder spam. Nowy link zastąpi poprzedni.</p>
      <ResendConfirmation />
      <p className="mt-6 text-sm"><Link className="underline" href="/login">Wróć do logowania</Link></p>
    </div>
  )
}
