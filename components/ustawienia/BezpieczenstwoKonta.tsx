'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { navigateAfterSecurityChange, securityMutation } from '@/lib/account-security'
import PasswordField from '@/components/auth/PasswordField'

type Session = { id: string; created_at: string; expires_at: string; current: boolean }
type Sessions = { count: number; next: string | null; previous: string | null; results: Session[]; mfa_enabled: boolean }
type Action = { kind: 'password' | 'others' | 'session'; session?: Session }
const date = (value: string) => new Date(value).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })

export default function BezpieczenstwoKonta() {
  const [data, setData] = useState<Sessions | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [password, setPassword] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [ended, setEnded] = useState(false)
  const generation = useRef(0)

  const load = useCallback((number: number) => {
    const revision = ++generation.current
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    return apiFetch(`/accounts/sessions/?page=${number}`, { cache: 'no-store', signal: controller.signal }).then((result: Sessions) => {
      if (revision !== generation.current) return
      setData(result)
      setPage(number)
    }).catch(() => {
      if (revision === generation.current) setLoadError('Nie udało się wczytać sesji. Ponów odczyt przed zmianą ustawień bezpieczeństwa.')
    }).finally(() => { clearTimeout(timer); if (revision === generation.current) setLoading(false) })
  }, [])
  useEffect(() => {
    const revision = generation
    void load(1)
    return () => { revision.current++ }
  }, [load])

  function reload(number: number) {
    setLoading(true); setLoadError(''); void load(number)
  }

  function clear() {
    setPassword(''); setNext(''); setAgain(''); setCode(''); setError(''); setAction(null)
  }
  function choose(value: Action) {
    clear(); setStatus(''); setAction(value)
    requestAnimationFrame(() => document.getElementById('account-current-password')?.focus())
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!action || busy) return
    setError('')
    if (action.kind === 'password' && next !== again) {
      setError('Nowe hasła muszą być takie same.')
      document.getElementById('account-again')?.focus()
      return
    }
    setBusy(true)
    try {
      const path = action.kind === 'password' ? '/accounts/password-change/'
        : action.kind === 'others' ? '/accounts/sessions/revoke-others/'
          : `/accounts/sessions/${action.session!.id}/revoke/`
      const result = await securityMutation(path, {
        current_password: password, ...(action.kind === 'password' ? { new_password: next } : {}),
        ...(data?.mfa_enabled ? { kod: code } : {}),
      })
      clear()
      setStatus(result.detail)
      if (result.current_session_revoked) {
        generation.current++
        setEnded(true)
        setData(null)
        requestAnimationFrame(() => document.getElementById('account-security-result')?.focus())
        if (result.local_session_ended) navigateAfterSecurityChange(action.kind === 'password')
      } else { setLoading(true); setLoadError(''); await load(1) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wykonać operacji.')
      setCode('')
      requestAnimationFrame(() => document.getElementById('account-security-error')?.focus())
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="account-security-title" className="max-w-xl">
      <h2 id="account-security-title" className="text-xl font-bold mb-3">Hasło i sesje logowania</h2>
      {status && <p id="account-security-result" role="status" tabIndex={-1} className="mb-4">{status}</p>}
      {ended ? <Link href="/login?wygasla=1" className="btn-primary min-h-11">Zaloguj się ponownie</Link> : <>
        <p className="tekst-drugi text-sm mb-4">Zarządzasz wyłącznie swoim kontem. Jedna sesja może obejmować kilka kart przeglądarki.
          Zmiana hasła zakończy wszystkie Twoje dotychczasowe sesje. MFA pozostanie włączone.</p>
        {loading && <p role="status">Wczytuję sesje…</p>}
        {loadError && <div><p role="alert" className="text-[#b42318] mb-3">{loadError}</p>
          <button type="button" className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => reload(1)}>Ponów odczyt sesji</button></div>}
        {data && !loading && !loadError && <>
          <div className="flex flex-wrap gap-3 mb-5">
            <button type="button" className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy} onClick={() => { clear(); reload(1) }}>Odśwież listę sesji</button>
            <button type="button" className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy} onClick={() => choose({ kind: 'password' })}>Zmień hasło konta</button>
            <button type="button" className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy || data.count < 2} onClick={() => choose({ kind: 'others' })}>Zakończ pozostałe sesje</button>
          </div>
          {action && <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-[color:var(--obramowanie-mocne)] p-4 mb-6">
            <h3 className="font-semibold">{action.kind === 'password' ? 'Potwierdź zmianę hasła' : action.kind === 'others'
              ? 'Potwierdź zakończenie pozostałych sesji' : action.session?.current ? 'Potwierdź zakończenie tej sesji'
                : `Zakończ sesję z ${date(action.session!.created_at)}`}</h3>
            <p id="account-change-help" className="text-sm tekst-drugi">{action.kind === 'password'
              ? 'Ustaw inne hasło: minimum 8 znaków, bez popularnych haseł, samych cyfr i danych konta. Po zmianie zaloguj się ponownie.'
              : action.kind === 'others' ? 'Ta sesja pozostanie aktywna. W pozostałych trzeba będzie zalogować się ponownie.'
                : action.session?.current ? 'Wylogujesz się również z kart korzystających z tej samej sesji.' : 'W tej sesji trzeba będzie zalogować się ponownie.'}</p>
            <PasswordField id="account-current-password" label="Aktualne hasło konta" value={password} onChange={setPassword} autoComplete="current-password" describedBy="account-change-help account-security-error" />
            {action.kind === 'password' && <>
              <PasswordField id="account-next" label="Nowe hasło konta" value={next} onChange={setNext} autoComplete="new-password" describedBy="account-change-help account-security-error" />
              <PasswordField id="account-again" label="Powtórz nowe hasło konta" value={again} onChange={setAgain} autoComplete="new-password" describedBy="account-security-error" />
            </>}
            {data.mfa_enabled && <div><label className="label" htmlFor="account-code">Kod MFA lub kod zapasowy</label>
              <input id="account-code" value={code} onChange={event => setCode(event.target.value)} required maxLength={64}
                autoComplete="one-time-code" className="input" aria-describedby="account-security-error" /></div>}
            <p id="account-security-error" role={error ? 'alert' : undefined} tabIndex={-1} className="text-sm text-[#b42318]">{error}</p>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary min-h-11 !whitespace-normal" disabled={busy}>{busy ? 'Potwierdzam…' : action.kind === 'password' ? 'Zmień hasło i wyloguj' : 'Potwierdź zakończenie sesji'}</button>
              <button type="button" className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy} onClick={clear}>Anuluj</button>
            </div>
          </form>}
          <h3 className="font-semibold mb-3">Aktywne sesje ({data.count})</h3>
          <ul className="space-y-3">{data.results.map(session => <li key={session.id} className="rounded-xl border border-[color:var(--obramowanie-mocne)] p-4">
            <p className="font-medium">{session.current ? 'Ta sesja' : 'Inna sesja'}</p>
            <p className="text-sm tekst-drugi">Logowanie: {date(session.created_at)}<br />Wygaśnie: {date(session.expires_at)}</p>
            <button type="button" className="underline min-h-11 mt-2 text-sm" disabled={busy} onClick={() => choose({ kind: 'session', session })}
              aria-label={`Zakończ ${session.current ? 'tę sesję' : 'sesję z ' + date(session.created_at)}`}>Zakończ sesję</button>
          </li>)}</ul>
          {!data.results.length && <p>Brak aktywnych sesji do wyświetlenia.</p>}
          <nav aria-label="Strony sesji" className="flex flex-wrap items-center gap-3 mt-4">
            <button className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy || !data.previous} onClick={() => { clear(); reload(page - 1) }}>Poprzednia</button>
            <span>Strona {page}</span>
            <button className="btn-ghost min-h-11 disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy || !data.next} onClick={() => { clear(); reload(page + 1) }}>Następna</button>
          </nav>
        </>}
      </>}
    </section>
  )
}
