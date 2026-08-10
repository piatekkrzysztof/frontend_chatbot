'use client'

import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

function FormularzRejestracji() {
  const router = useRouter()
  const params = useSearchParams()
  // Plan wybrany na stronie cennika. Zapamiętujemy go tylko po to, żeby
  // pokazać klientowi, że trafił tam, gdzie klikał — zakup i tak następuje
  // po okresie próbnym, w panelu.
  const wybranyPlan = params.get('plan')

  const [nazwaFirmy, setNazwaFirmy] = useState('')
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [wysylanie, setWysylanie] = useState(false)
  const [blad, setBlad] = useState('')

  async function zaloz(e: FormEvent) {
    e.preventDefault()
    setWysylanie(true)
    setBlad('')

    try {
      const rejestracja = await fetch(`${API_URL}/accounts/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: nazwaFirmy,
          email,
          password: haslo,
          use_trial: true,
        }),
      })

      if (!rejestracja.ok) {
        const dane = await rejestracja.json().catch(() => null)
        // Backend zwraca błędy per pole — pokazujemy pierwszy zamiast
        // ogólnego "coś poszło nie tak"
        const pierwszy = dane && Object.values(dane).flat()[0]
        throw new Error(
          typeof pierwszy === 'string' ? pierwszy : 'Nie udało się założyć konta.'
        )
      }

      // Logujemy od razu: kazanie przepisywać dopiero co wpisane dane
      // to najprostszy sposób na porzucenie rejestracji w ostatnim kroku
      const logowanie = await fetch(`${API_URL}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password: haslo }),
      })

      if (!logowanie.ok) {
        router.push('/login')
        return
      }

      const dane = await logowanie.json()
      localStorage.setItem('token', dane.access)
      if (dane.refresh) localStorage.setItem('refresh_token', dane.refresh)
      router.push('/dashboard')
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się założyć konta.')
      setWysylanie(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Logo wysokosc={30} jakoLink />
      </div>

      <h1 className="text-3xl mb-2">Załóż konto</h1>
      <p className="text-sand-300 text-sm mb-7">
        14 dni bez opłat i bez karty. Bot działa od razu — wgrywasz materiały
        i wklejasz jedną linijkę na stronę.
      </p>

      {wybranyPlan && (
        <p className="pill mb-5">Wybrany plan: {wybranyPlan}</p>
      )}

      <form onSubmit={zaloz} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="firma">Nazwa firmy</label>
          <input
            id="firma"
            className="input"
            value={nazwaFirmy}
            onChange={(e) => setNazwaFirmy(e.target.value)}
            placeholder="np. Serwis Rowerowy Kowalski"
            required
            autoComplete="organization"
          />
          <p className="hint mt-1.5">Tak bot przedstawi się odwiedzającym.</p>
        </div>

        <div>
          <label className="label" htmlFor="email">Adres e-mail</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label" htmlFor="haslo">Hasło</label>
          <input
            id="haslo"
            type="password"
            className="input"
            value={haslo}
            onChange={(e) => setHaslo(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="hint mt-1.5">Minimum 8 znaków.</p>
        </div>

        {blad && <p className="text-sm text-rose-400">{blad}</p>}

        <button type="submit" disabled={wysylanie} className="btn-primary w-full mt-1">
          {wysylanie ? 'Zakładam konto...' : 'Załóż konto i zacznij'}
        </button>
      </form>

      <p className="text-sm text-sand-400 mt-6">
        Masz już konto?{' '}
        <Link href="/login" className="text-ember-500 hover:text-ember-400 transition-colors">
          Zaloguj się
        </Link>
      </p>
    </div>
  )
}


/**
 * useSearchParams wymaga granicy Suspense — bez niej Next nie potrafi
 * wygenerować tej strony statycznie i build się zatrzymuje.
 */
export default function RejestracjaPage() {
  return (
    <Suspense fallback={<p className="text-sand-400">Wczytywanie...</p>}>
      <FormularzRejestracji />
    </Suspense>
  )
}
