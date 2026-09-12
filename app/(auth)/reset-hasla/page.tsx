'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import PasswordField from '@/components/auth/PasswordField'
import PasswordResetRequest from '@/components/auth/PasswordResetRequest'
import { RecoveryError, recoveryRequest } from '@/lib/password-recovery'

export default function ResetPasswordPage() {
  const proof = useRef<{ uid: string; token: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let active = true
    if (proof.current === null) {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      proof.current = { uid: hash.get('uid') || '', token: hash.get('token') || '' }
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    async function preview() {
      setLoading(true)
      setError('')
      try {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(proof.current!.uid) ||
            !/^[a-z0-9]{1,13}-[a-f0-9]{32}$/.test(proof.current!.token)) {
          throw new RecoveryError('Brakuje poprawnego linku. Otwórz wiadomość albo poproś o nowy link.', true)
        }
        await recoveryRequest('preview', proof.current!)
        if (active) setReady(true)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Spróbuj ponownie.')
          setInvalid(err instanceof RecoveryError && err.invalidLink)
        }
      } finally { if (active) setLoading(false) }
    }
    void preview()
    return () => { active = false }
  }, [attempt])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (password !== again) {
      setError('Hasła muszą być takie same.')
      document.getElementById('reset-again')?.focus()
      return
    }
    setBusy(true)
    try {
      await recoveryRequest('confirm', { ...proof.current, password })
      setPassword('')
      setAgain('')
      proof.current = { uid: '', token: '' }
      setDone(true)
      requestAnimationFrame(() => document.getElementById('reset-done')?.focus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić hasła.')
      if (err instanceof RecoveryError && err.invalidLink) setInvalid(true)
      requestAnimationFrame(() => document.getElementById('reset-error')?.focus())
    } finally { setBusy(false) }
  }
  return (
    <div className="w-full max-w-md">
      <div className="mb-7"><Logo wysokosc={30} jakoLink /></div>
      <h1 id="reset-done" tabIndex={-1} className="text-3xl mb-4">{done ? 'Hasło zmienione' : 'Ustaw nowe hasło'}</h1>
      {loading ? <p role="status">Sprawdzam link…</p> : done ? (
        <div role="status">
          <p className="tekst-drugi mb-5">Poprzednie sesje zostały zakończone. Zaloguj się nowym hasłem.
            Jeśli używasz logowania dwuetapowego, nadal potrzebujesz kodu z aplikacji lub kodu zapasowego.</p>
          <Link href="/login?wygasla=1" className="btn-primary min-h-11">Przejdź do logowania</Link>
        </div>
      ) : (
        <>
          <p id="reset-error" role={error ? 'alert' : undefined} tabIndex={-1} className="text-sm text-rose-400 mb-4">{error}</p>
          {invalid ? <PasswordResetRequest /> : ready ? (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <p id="reset-help" className="text-sm tekst-drugi">Minimum 8 znaków. Unikaj popularnych haseł,
                samych cyfr i danych konta. Po zmianie zakończymy poprzednie sesje.</p>
              <PasswordField id="reset-password" label="Nowe hasło" value={password} onChange={setPassword}
                autoComplete="new-password" describedBy="reset-help reset-error" />
              <PasswordField id="reset-again" label="Powtórz nowe hasło" value={again} onChange={setAgain}
                autoComplete="new-password" describedBy="reset-error" />
              <button type="submit" disabled={busy} className="btn-primary min-h-11">{busy ? 'Zmieniam hasło…' : 'Zmień hasło'}</button>
            </form>
          ) : <button onClick={() => setAttempt(attempt + 1)} className="btn-primary min-h-11">Ponów sprawdzenie</button>}
          <Link href="/login?wygasla=1" className="underline inline-flex items-center min-h-11 mt-5">Wróć do logowania</Link>
        </>
      )}
    </div>
  )
}
