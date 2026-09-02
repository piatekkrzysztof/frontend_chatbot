'use client'

import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { API_URL } from '@/lib/api'
import { ustawToken } from '@/lib/auth'

function FormularzLogowania() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Bilet z pierwszego kroku. Jego obecnosc przelacza ekran na drugi krok -
  // haslo jest juz sprawdzone, ale sesja jeszcze nie powstala.
  const [bilet, setBilet] = useState('')
  const [kod, setKod] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
        // Bez tego przegladarka odrzuci ciasteczko z tokenem odswiezania,
        // ktore backend odsyla w tej odpowiedzi -- logowanie "uda sie",
        // a pierwsze odswiezenie za kwadrans wyrzuci uzytkownika.
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Nieprawidłowy e-mail lub hasło.')
      }

      const data = await res.json()

      if (data.wymaga_drugiego_skladnika) {
        // Backend celowo NIE wydal tokenow. Przechodzimy na drugi krok,
        // zamiast probowac cokolwiek zapisac - bez kodu z aplikacji sesji
        // nie ma i nie bedzie.
        setBilet(data.bilet)
        setLoading(false)
        return
      }

      // Token odswiezania nie przechodzi tedy w ogole -- backend odeslal go
      // w ciasteczku HttpOnly, ktorego ten kod nie widzi i widziec nie musi.
      ustawToken(data.access)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
    } finally {
      setLoading(false)
    }
  }

  async function potwierdzKod(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/accounts/login/2fa/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilet, kod }),
        credentials: 'include',
      })

      if (!res.ok) {
        const dane = await res.json().catch(() => null)
        if (res.status === 401) {
          // Bilet zyje piec minut. Po tym czasie nie ma czego poprawiac -
          // trzeba zaczac od hasla, wiec wracamy na pierwszy krok zamiast
          // zostawiac uzytkownika przy polu, ktore juz nic nie da.
          setBilet('')
          setKod('')
          throw new Error('Minęło za dużo czasu. Zaloguj się jeszcze raz.')
        }
        throw new Error(dane?.error || 'Kod nie pasuje.')
      }

      const dane = await res.json()
      ustawToken(dane.access)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
      setKod('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Logo wysokosc={30} jakoLink />
      </div>

      <h1 className="text-3xl mb-6">{bilet ? 'Potwierdź logowanie' : 'Zaloguj się'}</h1>

      <Suspense fallback={null}>
        <KomunikatOWygasnieciu />
      </Suspense>

      {bilet ? (
        <form onSubmit={potwierdzKod} className="flex flex-col gap-4">
          <p className="text-sm tekst-drugi">
            Przepisz sześciocyfrowy kod z aplikacji uwierzytelniającej. Jeśli nie masz
            telefonu pod ręką, wpisz jeden z kodów zapasowych.
          </p>

          <div>
            <label className="label" htmlFor="pole-kod">
              Kod
            </label>
            <input
              id="pole-kod"
              // `text`, nie `number`: pole liczbowe obcina wiodace zera i
              // pokazuje strzalki do zwiekszania, ktore tu nie znacza nic.
              // Kod zapasowy ma zreszta litery.
              type="text"
              inputMode="numeric"
              // Podpowiada iOS i Androidowi, ze to kod jednorazowy - dzieki
              // temu proponuja wklejenie go wprost z powiadomienia.
              autoComplete="one-time-code"
              autoFocus
              required
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              className="input tracking-[0.3em]"
              placeholder="000000"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sprawdzam...' : 'Potwierdź'}
          </button>

          <button
            type="button"
            onClick={() => {
              setBilet('')
              setKod('')
              setError('')
            }}
            className="text-sm text-sand-400 underline underline-offset-2"
          >
            Zaloguj się na inne konto
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="pole-email">E-mail</label>
          <input
            id="pole-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="pole-haslo">Hasło</label>
          <input
            id="pole-haslo"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
      )}

      {/* Bez tego jedyną drogą do konta było logowanie — nowy klient
          nie miał gdzie kliknąć, żeby je w ogóle założyć */}
      <p className="text-sm text-sand-400 mt-6">
        Nie masz konta?{' '}
        <Link href="/rejestracja" className="text-ember-500 hover:text-ember-400 transition-colors">
          Załóż je za darmo
        </Link>
      </p>
    </div>
  )
}

/**
 * Komunikat po odbiciu z panelu.
 *
 * Osobny komponent wylacznie dlatego, ze `useSearchParams` wymaga granicy
 * Suspense. Wczesniej ta granica obejmowala CALY formularz, wiec strona
 * wygenerowana przy budowaniu zawierala samo "Wczytywanie..." -- pole na
 * e-mail pojawialo sie dopiero po uruchomieniu JavaScriptu. Zmierzone
 * na produkcji z wylaczonym JS. Teraz w Suspense siedzi tylko ten napis,
 * a formularz jest w gotowym dokumencie od razu.
 *
 * Bez tego komunikatu uzytkownik odbity z panelu widzi ekran logowania
 * i nie wie, czy sam sie wylogowal, czy cos padlo. Cicha zmiana ekranu
 * jest gorsza niz komunikat o bledzie.
 */
function KomunikatOWygasnieciu() {
  const parametry = useSearchParams()
  if (!parametry.has('wygasla')) return null

  return (
    <p className="mb-5 rounded border border-[color:var(--obramowanie-mocne)] px-3 py-2 text-sm tekst-drugi">
      Sesja wygasła — zaloguj się ponownie.
    </p>
  )
}

export default function LoginPage() {
  return <FormularzLogowania />
}
