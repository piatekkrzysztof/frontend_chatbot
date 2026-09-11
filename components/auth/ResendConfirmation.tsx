'use client'

import { FormEvent, useEffect, useState } from 'react'
import { API_URL } from '@/lib/api'

export default function ResendConfirmation({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(initialEmail ? 60 : 0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!seconds) return
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  async function resend(event: FormEvent) {
    event.preventDefault()
    if (busy || seconds) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/accounts/registration/resend/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
      if (response.status === 429) {
        const retry = Number(response.headers.get('Retry-After'))
        setSeconds(Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 60)
        throw new Error('Zbyt wiele prób. Poczekaj przed ponownym wysłaniem.')
      }
      if (!response.ok) throw new Error('Nie udało się wysłać linku. Spróbuj ponownie za minutę.')
      setSeconds(60)
      setMessage('Jeśli ten adres oczekuje na aktywację, otrzymasz nowy link. Sprawdź także spam. Poprzedni link straci ważność.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sprawdź połączenie i spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={resend} className="mt-6 flex flex-col gap-3">
      <label htmlFor="resend-email" className="label">Adres e-mail do aktywacji</label>
      <input id="resend-email" type="email" autoComplete="email" maxLength={150} required
        className="input" value={email} onChange={event => setEmail(event.target.value)} />
      <button type="submit" className="btn-primary min-h-11" disabled={busy || seconds > 0}>
        {busy ? 'Wysyłam…' : seconds ? `Wyślij ponownie za ${seconds} s` : 'Wyślij nowy link'}
      </button>
      {message && <p role="status" className="text-sm text-sand-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </form>
  )
}
