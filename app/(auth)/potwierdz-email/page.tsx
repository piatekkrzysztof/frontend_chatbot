'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import ResendConfirmation from '@/components/auth/ResendConfirmation'
import { API_URL } from '@/lib/api'

type Preview = { email: string; company_name: string }

export default function ConfirmEmailPage() {
  const token = useRef('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [done, setDone] = useState(false)
  const [paid, setPaid] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (!token.current) {
      token.current = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      // Keep credentials only in this tab's memory, never in storage or the URL.
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    async function previewLink() {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token.current)) {
        setLoadError('Brakuje poprawnego linku. Otwórz najnowszą wiadomość albo poproś o nową.')
        setInvalid(true)
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${API_URL}/accounts/registration/preview/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.current }),
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        })
        if (!response.ok) {
          if (response.status === 400 && active) setInvalid(true)
          throw new Error(response.status === 400
            ? 'Link wygasł lub został użyty. Poproś o nowy link albo zaloguj się.'
            : 'Nie udało się sprawdzić linku. Poczekaj chwilę i ponów sprawdzenie.')
        }
        const data = await response.json()
        if (active) setPreview(data)
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Sprawdź połączenie.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void previewLink()
    return () => { active = false }
  }, [attempt])

  async function activate(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (password !== passwordAgain) {
      setError('Hasła muszą być takie same.')
      document.getElementById('activation-password-again')?.focus()
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`${API_URL}/accounts/registration/activate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.current, password }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.token) setInvalid(true)
        const detail = data.password?.[0] || data.token?.[0] || data.detail || data.email?.[0]
        throw new Error(detail || 'Nie udało się potwierdzić konta. Spróbuj ponownie lub sprawdź logowanie.')
      }
      setPaid(data.use_trial === false)
      setPassword('')
      setPasswordAgain('')
      token.current = ''
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sprawdź połączenie i spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-7"><Logo wysokosc={30} jakoLink /></div>
      <h1 className="text-3xl mb-4">{done ? 'Konto gotowe' : 'Potwierdź adres e-mail'}</h1>
      {loading ? <p role="status">Sprawdzam link…</p> : done ? (
        <div role="status">
          <p className="text-sand-300 mb-5">{paid
            ? 'Adres potwierdzony. Zaloguj się, aby wybrać plan i przejść do płatności.'
            : 'Adres potwierdzony. Twój 14-dniowy okres próbny rozpoczął się teraz.'}</p>
          <Link className="btn-primary" href={paid ? '/login?dalej=subskrypcja' : '/login'}>
            Przejdź do logowania
          </Link>
        </div>
      ) : (
        <>
          {loadError && <p role="alert" className="text-sm text-rose-400">{loadError}</p>}
          {loadError && !invalid && (
            <button className="btn-primary mt-4" onClick={() => setAttempt(attempt + 1)}>
              Ponów sprawdzenie
            </button>
          )}
          {preview && !invalid && (
            <form onSubmit={activate} className="flex flex-col gap-4">
              <p className="text-sand-300 break-words">Konto dla {preview.email} w firmie {preview.company_name}.
                Ustaw własne hasło, aby zakończyć rejestrację.</p>
              <input type="hidden" autoComplete="username" value={preview.email} />
              <label className="label" htmlFor="activation-password">Hasło</label>
              <input id="activation-password" className="input" type="password" required minLength={8}
                maxLength={1024} autoComplete="new-password" value={password}
                onChange={event => setPassword(event.target.value)} aria-describedby="password-help activation-error" />
              <p id="password-help" className="hint">Minimum 8 znaków. Unikaj popularnych haseł, samych cyfr i danych konta.</p>
              <label className="label" htmlFor="activation-password-again">Powtórz hasło</label>
              <input id="activation-password-again" className="input" type="password" required
                maxLength={1024} autoComplete="new-password" value={passwordAgain}
                onChange={event => setPasswordAgain(event.target.value)} aria-describedby="activation-error" />
              <button className="btn-primary min-h-11" disabled={busy}>
                {busy ? 'Aktywuję…' : 'Potwierdź e-mail i załóż konto'}
              </button>
            </form>
          )}
          <p id="activation-error" role={error ? 'alert' : undefined} className="text-sm text-rose-400 mt-3">{error}</p>
          {invalid && <ResendConfirmation initialEmail={preview?.email} />}
          <p className="text-sm text-sand-400 mt-6">Konto zostało już aktywowane?{' '}
            <Link className="underline" href="/login">Zaloguj się</Link>.{' '}
            <Link className="underline" href="/rejestracja">Wróć do rejestracji</Link>.
          </p>
        </>
      )}
    </div>
  )
}
