'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

interface TeamMember {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  last_login: string | null
}

interface Invitation {
  id: number
  email: string
  role: string
  token: string
  accept_url: string
  expires_at: string | null
  is_valid: boolean
  users: number
  max_users: number
  seats_left: number
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Właściciel',
  employee: 'Pracownik',
  viewer: 'Podgląd',
}

const DURATIONS = [
  { value: '1h', label: '1 godzina' },
  { value: '12h', label: '12 godzin' },
  { value: '1d', label: '1 dzień' },
  { value: '7d', label: '7 dni' },
]

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employee')
  const [duration, setDuration] = useState('7d')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [lastInvite, setLastInvite] = useState<{ url: string; emailSent: boolean } | null>(null)
  const [copied, setCopied] = useState('')

  async function loadInvitations() {
    const data = await apiFetch('/accounts/invitations/list/')
    setInvitations(Array.isArray(data) ? data : data.results || [])
  }

  useEffect(() => {
    let active = true

    apiFetch('/users/')
      .then((data) => {
        if (active) setMembers(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać zespołu.')
      })

    apiFetch('/accounts/invitations/list/')
      .then((data) => {
        if (active) setInvitations(Array.isArray(data) ? data : data.results || [])
      })
      .catch(() => {
        // listę zaproszeń widzi tylko właściciel — pracownik dostaje 403 i to jest w porządku
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setInviting(true)
    setInviteError('')
    setLastInvite(null)

    try {
      const data = await apiFetch('/accounts/invitations/', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role,
          duration,
          max_users: 1,
        }),
      })
      setLastInvite({ url: data.accept_url, emailSent: data.email_sent })
      setEmail('')
      await loadInvitations()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Nie udało się utworzyć zaproszenia.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(id: number) {
    try {
      await apiFetch(`/accounts/invitations/${id}/`, { method: 'DELETE' })
      await loadInvitations()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Nie udało się cofnąć zaproszenia.')
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      // schowek bywa zablokowany — link i tak jest widoczny do zaznaczenia
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Zespół</h1>
      <p className="tekst-drugi mb-8">
        Osoby z dostępem do panelu Twojego chatbota.
      </p>

      {error && <p className="text-sm text-[#c0392b] mb-4">{error}</p>}

      {/* Tabela przewija się sama — bez tego rozpychała całą stronę */}

      <div className="overflow-x-auto">

        <table className="w-full text-left text-sm mb-12 min-w-[34rem]">
        <thead>
          <tr className="border-b obramowanie tekst-slaby">
            <th className="py-2">Użytkownik</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Rola</th>
            <th className="py-2">Ostatnie logowanie</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b obramowanie">
              <td className="py-2">{member.username}</td>
              <td className="py-2 tekst-drugi">{member.email}</td>
              <td className="py-2">{ROLE_LABELS[member.role] || member.role}</td>
              <td className="py-2 tekst-slaby">
                {member.last_login
                  ? new Date(member.last_login).toLocaleString('pl-PL')
                  : 'nigdy'}
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 tekst-slaby">
                Brak użytkowników.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <h2 className="text-xl font-bold mb-1">Zaproś osobę</h2>
      <p className="text-sm tekst-slaby mb-4">
        Wyślemy e-mail z linkiem. Link dostajesz też tutaj — na wypadek gdyby wiadomość
        nie dotarła.
      </p>

      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="zespol-email">E-mail</label>
          <input
            id="zespol-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pracownik@twojafirma.pl"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="zespol-rola">Rola</label>
          <select
            id="zespol-rola"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input"
          >
            <option value="employee">Pracownik</option>
            <option value="viewer">Podgląd</option>
            <option value="owner">Właściciel</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="zespol-waznosc">Link ważny</label>
          <select
            id="zespol-waznosc"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="input"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!email.trim() || inviting}
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          {inviting ? 'Wysyłanie...' : 'Zaproś'}
        </button>
      </form>

      {inviteError && <p className="text-sm text-[#c0392b] mb-4">{inviteError}</p>}

      {lastInvite && (
        <div className="rounded border border-[color:var(--obramowanie-mocne)] bg-[color:var(--tlo)] p-3 mb-8">
          <p className="text-sm mb-2">
            {lastInvite.emailSent
              ? 'Zaproszenie wysłane. Możesz też przekazać link bezpośrednio:'
              : 'Zaproszenie utworzone, ale e-maila nie udało się wysłać — przekaż link ręcznie:'}
          </p>
          <button
            onClick={() => copyLink(lastInvite.url)}
            className="text-xs font-mono tekst-drugi hover:text-[color:var(--tekst)] break-all text-left"
          >
            {copied === lastInvite.url ? 'Skopiowano' : lastInvite.url}
          </button>
        </div>
      )}

      {invitations.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Oczekujące zaproszenia</h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className={`rounded border p-3 ${invite.is_valid ? 'border-[color:var(--obramowanie-mocne)]' : 'obramowanie opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {invite.email}
                      <span className="tekst-slaby font-normal">
                        {' '}— {ROLE_LABELS[invite.role] || invite.role}
                      </span>
                    </p>
                    <p className="text-xs tekst-slaby mt-1">
                      {invite.is_valid
                        ? `ważne do ${invite.expires_at ? new Date(invite.expires_at).toLocaleString('pl-PL') : '—'}`
                        : 'wygasło lub wykorzystane'}
                    </p>
                    <button
                      onClick={() => copyLink(invite.accept_url)}
                      className="text-xs font-mono tekst-slaby hover:text-[color:var(--tekst)] break-all text-left mt-1"
                    >
                      {copied === invite.accept_url ? 'Skopiowano' : invite.accept_url}
                    </button>
                  </div>
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="text-sm text-[#c0392b] hover:underline shrink-0"
                  >
                    Cofnij
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
