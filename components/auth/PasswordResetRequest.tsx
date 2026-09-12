'use client'

import { FormEvent, useState } from 'react'
import { recoveryRequest } from '@/lib/password-recovery'

export default function PasswordResetRequest() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone(false)
    try {
      await recoveryRequest('request', { email: email.trim().toLowerCase() })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spróbuj ponownie za chwilę.')
      requestAnimationFrame(() => document.getElementById('reset-request-error')?.focus())
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="reset-email">Adres e-mail konta</label>
        <input id="reset-email" type="email" required maxLength={150} autoComplete="email"
          value={email} onChange={event => setEmail(event.target.value)} className="input"
          aria-describedby="reset-request-help reset-request-error" />
      </div>
      <p id="reset-request-help" className="text-sm tekst-drugi">
        Wyślemy link ważny 30 minut. Jeśli go nie widzisz, sprawdź spam.
      </p>
      <p id="reset-request-error" tabIndex={-1} role={error ? 'alert' : undefined}
        className="text-sm text-rose-400">{error}</p>
      {done && <p role="status" className="text-sm">
        Jeśli konto może odzyskać dostęp, wyślemy na podany adres link do zmiany hasła.
        Przed kolejną prośbą odczekaj minutę.
      </p>}
      <button type="submit" className="btn-primary min-h-11" disabled={busy}>
        {busy ? 'Przyjmuję prośbę…' : 'Wyślij link do zmiany hasła'}
      </button>
    </form>
  )
}
