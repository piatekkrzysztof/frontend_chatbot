'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'
import { apiFetch, BladApi } from '@/lib/api'
import BrakUprawnien from '@/components/BrakUprawnien'
import PasswordField from '@/components/auth/PasswordField'
import { useJa } from '@/lib/ja'

interface TeamMember {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  last_login: string | null
  // Backend podaje tylko właścicielowi; pracownik dostaje null (2.32.0).
  mfa_wlaczone?: boolean | null
}

interface Invitation {
  id: number
  email: string
  role: string
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
  // null = jeszcze nie wiemy. Pusta tablica od startu pokazywała "Brak
  // użytkowników" w trakcie wczytywania i po błędzie odczytu.
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  // Rolę rozstrzyga backend, nie panel: 403 na liście zespołu znaczy "podgląd",
  // a 403 na liście zaproszeń - "nie właściciel".
  const [brakUprawnien, setBrakUprawnien] = useState(false)
  const [mozeZapraszac, setMozeZapraszac] = useState(true)
  // Rolę zalogowanej osoby bierzemy z /accounts/me/ (JaProvider), żeby nie
  // pokazywać list wyboru komuś, kogo backend i tak odbije. Zapisu pilnuje backend.
  const { ja } = useJa()
  const mojaRola = ja?.role || ''
  const mojeId = typeof ja?.id === 'number' ? ja.id : null
  const [zmieniana, setZmieniana] = useState<number | null>(null)
  const [bladZespolu, setBladZespolu] = useState('')
  // Usunięcie konta odbiera dostęp do panelu i nie da się go cofnąć, więc
  // pytamy w miejscu - tak samo jak przy kasowaniu dokumentu i wpisu FAQ.
  const [doUsuniecia, setDoUsuniecia] = useState<number | null>(null)
  const [usuwany, setUsuwany] = useState<number | null>(null)
  const zegarUsuniecia = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reset MFA osoby, która straciła telefon i kody zapasowe (decyzja
  // właściciela z 11.10.2026). Wcześniej jedyną drogą bez obsługi było
  // usunięcie i ponowne zaproszenie - nowe konto, historia pod starym.
  const [resetowana, setResetowana] = useState<TeamMember | null>(null)
  const [hasloResetu, setHasloResetu] = useState('')
  const [kodResetu, setKodResetu] = useState('')
  const [resetuje, setResetuje] = useState(false)
  const [bladResetu, setBladResetu] = useState('')
  const [wynikResetu, setWynikResetu] = useState('')

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
        if (!active) return
        if (err instanceof BladApi && err.status === 403) {
          setBrakUprawnien(true)
          return
        }
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać zespołu.')
      })

    apiFetch('/accounts/invitations/list/')
      .then((data) => {
        if (active) setInvitations(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        // Listę zaproszeń widzi tylko właściciel. Pracownik dostawał 403 po
        // cichu i zostawał z formularzem zaproszenia, który przy wysłaniu
        // odbijał go kolejnym 403 - teraz po prostu go nie widzi.
        if (active && err instanceof BladApi && err.status === 403) setMozeZapraszac(false)
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function zmienRole(member: TeamMember, nowa: string) {
    const poprzednia = member.role
    setZmieniana(member.id)
    setBladZespolu('')
    // Zmiana widoczna od razu, cofana przy odmowie: bez tego lista wyboru
    // wracałaby do starej wartości dopiero po odpowiedzi serwera.
    setMembers((obecne) =>
      (obecne ?? []).map((osoba) => (osoba.id === member.id ? { ...osoba, role: nowa } : osoba)),
    )
    try {
      await apiFetch(`/users/${member.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nowa }),
      })
    } catch (err) {
      setMembers((obecne) =>
        (obecne ?? []).map((osoba) =>
          osoba.id === member.id ? { ...osoba, role: poprzednia } : osoba,
        ),
      )
      // Backend odmawia po polsku, np. przy ostatnim właścicielu firmy -
      // jego zdanie niesie powód, więc pokazujemy je wprost.
      setBladZespolu(err instanceof Error ? err.message : 'Nie udało się zmienić roli.')
    } finally {
      setZmieniana(null)
    }
  }

  // Pytanie samo wygasa, żeby uzbrojony przycisk nie został na ekranie.
  function uzbrojDoUsuniecia(id: number) {
    if (zegarUsuniecia.current) clearTimeout(zegarUsuniecia.current)
    setDoUsuniecia(id)
    zegarUsuniecia.current = setTimeout(() => setDoUsuniecia(null), 5000)
  }

  useEffect(
    () => () => {
      if (zegarUsuniecia.current) clearTimeout(zegarUsuniecia.current)
    },
    [],
  )

  async function usunOsobe(member: TeamMember) {
    setUsuwany(member.id)
    setBladZespolu('')
    try {
      await apiFetch(`/users/${member.id}/`, { method: 'DELETE' })
      setDoUsuniecia(null)
      const dane = await apiFetch('/users/')
      setMembers(Array.isArray(dane) ? dane : dane.results || [])
    } catch (err) {
      // Backend odmawia po polsku, m.in. przy ostatnim aktywnym właścicielu.
      setBladZespolu(err instanceof Error ? err.message : 'Nie udało się usunąć osoby.')
    } finally {
      setUsuwany(null)
    }
  }

  function otworzReset(member: TeamMember) {
    setResetowana(member)
    setHasloResetu('')
    setKodResetu('')
    setBladResetu('')
    setWynikResetu('')
  }

  function zamknijReset() {
    setResetowana(null)
    setHasloResetu('')
    setKodResetu('')
    setBladResetu('')
  }

  async function resetujMfa(e: FormEvent) {
    e.preventDefault()
    if (!resetowana || resetuje) return
    setResetuje(true)
    setBladResetu('')
    try {
      const dane = (await apiFetch(`/users/${resetowana.id}/reset-mfa/`, {
        method: 'POST',
        body: JSON.stringify({ haslo: hasloResetu, ...(mamMfa ? { kod: kodResetu } : {}) }),
      })) as { zakonczonych_sesji: number; ostrzezenie_wyslane: boolean }
      setWynikResetu(
        `Logowanie dwuetapowe osoby ${resetowana.username} zostało zresetowane. ` +
          `Zakończone sesje: ${dane.zakonczonych_sesji}. ` +
          (dane.ostrzezenie_wyslane
            ? 'Wysłaliśmy jej mail z prośbą o ponowne włączenie MFA.'
            : 'Mail ostrzegawczy nie wyszedł - powiedz o resecie tej osobie innym kanałem.'),
      )
      zamknijReset()
      const lista = await apiFetch('/users/')
      setMembers(Array.isArray(lista) ? lista : lista.results || [])
    } catch (err) {
      // Backend odmawia po polsku: złe hasło, brak kodu, osoba bez MFA.
      setBladResetu(err instanceof Error ? err.message : 'Nie udało się zresetować MFA.')
    } finally {
      setResetuje(false)
    }
  }

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

  // Czy sam właściciel ma MFA - wtedy backend chce też jego kodu.
  const mamMfa = Boolean((members ?? []).find((m) => m.id === mojeId)?.mfa_wlaczone)

  if (brakUprawnien) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-3">Zespół</h1>
        <BrakUprawnien
          tytul="Listę zespołu widzi właściciel i pracownik."
          opis="Rola podglądu służy do czytania rozmów i bazy wiedzy, a nie do zarządzania dostępem do konta. Jeśli potrzebujesz tu wglądu, poproś właściciela o zmianę roli."
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Zespół</h1>
      <p className="tekst-drugi mb-8">
        Osoby z dostępem do panelu Twojego chatbota.
      </p>

      {error && (
        <p role="alert" className="text-sm text-[var(--blad)] mb-4">
          {error}
        </p>
      )}
      {members === null && !error && (
        <p role="status" className="text-sm tekst-slaby mb-4">
          Wczytuję zespół…
        </p>
      )}
      {bladZespolu && (
        <p role="alert" className="text-sm text-[var(--blad)] mb-4">
          {bladZespolu}
        </p>
      )}

      {/* Tabela przewija się sama — bez tego rozpychała całą stronę */}

      <div className="overflow-x-auto">

        <table className="w-full text-left text-sm mb-12 min-w-[34rem]">
        <thead>
          <tr className="border-b obramowanie tekst-slaby">
            <th className="py-2">Użytkownik</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Rola</th>
            <th className="py-2">Ostatnie logowanie</th>
            {mojaRola === 'owner' && <th className="py-2">Działania</th>}
          </tr>
        </thead>
        <tbody>
          {(members ?? []).map((member) => (
            <tr key={member.id} className="border-b obramowanie">
              <td className="py-2 pr-3 [overflow-wrap:anywhere]">{member.username}</td>
              <td className="py-2 pr-3 tekst-drugi [overflow-wrap:anywhere]">{member.email}</td>
              <td className="py-2">
                {mojaRola === 'owner' ? (
                  <select
                    value={member.role}
                    onChange={(e) => zmienRole(member, e.target.value)}
                    disabled={zmieniana === member.id}
                    aria-label={`Rola: ${member.username}`}
                    className="input !py-1 !text-sm min-w-[8.5rem]"
                  >
                    {Object.entries(ROLE_LABELS).map(([kod, etykieta]) => (
                      <option key={kod} value={kod}>
                        {etykieta}
                      </option>
                    ))}
                  </select>
                ) : (
                  ROLE_LABELS[member.role] || member.role
                )}
              </td>
              <td className="py-2 tekst-slaby">
                {member.last_login
                  ? new Date(member.last_login).toLocaleString('pl-PL')
                  : 'nigdy'}
              </td>
              {mojaRola === 'owner' && (
                <td className="py-2">
                  <div className="flex flex-col items-start gap-1">
                  {member.mfa_wlaczone && member.id !== mojeId && (
                    <button
                      type="button"
                      onClick={() => otworzReset(member)}
                      aria-label={`Resetuj logowanie dwuetapowe: ${member.username}`}
                      className="text-xs underline underline-offset-2 whitespace-nowrap"
                    >
                      Resetuj MFA
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      doUsuniecia === member.id ? usunOsobe(member) : uzbrojDoUsuniecia(member.id)
                    }
                    disabled={usuwany === member.id}
                    aria-label={
                      doUsuniecia === member.id
                        ? `Potwierdź usunięcie konta: ${member.username}`
                        : `Usuń konto: ${member.username}`
                    }
                    className="text-xs text-[var(--blad)] hover:underline disabled:opacity-50"
                  >
                    {usuwany === member.id
                      ? 'Usuwam...'
                      : doUsuniecia === member.id
                        ? 'Na pewno?'
                        : 'Usuń'}
                  </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {members !== null && members.length === 0 && (
            <tr>
              <td colSpan={mojaRola === 'owner' ? 5 : 4} className="py-4 tekst-slaby">
                Brak użytkowników.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {wynikResetu && (
        <p role="status" className="text-sm mb-6">
          {wynikResetu}
        </p>
      )}

      {resetowana && (
        <section
          aria-labelledby="reset-mfa-tytul"
          className="rounded border obramowanie p-4 mb-12 max-w-xl"
        >
          <h2 id="reset-mfa-tytul" className="font-medium mb-1">
            Reset logowania dwuetapowego: {resetowana.username}
          </h2>
          <p id="reset-mfa-opis" className="text-sm tekst-drugi mb-4">
            Dla osoby, która straciła telefon i kody zapasowe. Jej sesje się zakończą, dostanie
            mail z prośbą o ponowne włączenie MFA, a reset trafi do dziennika zdarzeń. Potwierdź
            własnym hasłem{mamMfa ? ' i własnym kodem' : ''}.
          </p>
          <form onSubmit={resetujMfa} className="flex flex-col gap-3">
            <PasswordField
              id="reset-mfa-haslo"
              label="Twoje hasło"
              value={hasloResetu}
              onChange={setHasloResetu}
              autoComplete="current-password"
              describedBy="reset-mfa-opis"
            />
            {mamMfa && (
              <div>
                <label className="label" htmlFor="reset-mfa-kod">
                  Twój kod MFA albo kod zapasowy
                </label>
                <input
                  id="reset-mfa-kod"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input"
                  value={kodResetu}
                  onChange={(e) => setKodResetu(e.target.value)}
                  required
                />
              </div>
            )}
            {bladResetu && (
              <p role="alert" className="text-sm text-[var(--blad)]">
                {bladResetu}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={resetuje} className="btn-primary !py-2 !px-4 !text-sm">
                {resetuje ? 'Resetuję...' : 'Resetuj logowanie dwuetapowe'}
              </button>
              <button type="button" onClick={zamknijReset} disabled={resetuje} className="btn-ghost !py-2 !px-4 !text-sm">
                Anuluj
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Zaproszenia tworzy wyłącznie właściciel. Pracownik widział ten
          formularz i dowiadywał się o tym dopiero po wysłaniu, z 403. */}
      {mozeZapraszac && (
        <>
      <h2 className="text-xl font-bold mb-1">Zaproś osobę</h2>
      <p className="text-sm tekst-slaby mb-4">
        Wyślemy e-mail z linkiem do założenia konta. Tutaj dostajesz drugi link, do
        przekazania na przykład czatem, gdy wiadomość nie dotarła. Ten drugi nie zakłada
        konta - wysyła zaproszenie jeszcze raz, na podany adres.
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

      {inviteError && <p className="text-sm text-[var(--blad)] mb-4">{inviteError}</p>}

      {lastInvite && (
        <div className="rounded border border-[color:var(--obramowanie-mocne)] bg-[color:var(--tlo)] p-3 mb-8">
          <p className="text-sm mb-2">
            {lastInvite.emailSent
              ? 'Zaproszenie wysłane. Jeśli nie dotrze, przekaż ten link - wyśle je jeszcze raz:'
              : 'Zaproszenie utworzone, ale e-maila nie udało się wysłać. Przekaż ten link - wyśle je jeszcze raz:'}
          </p>
          <button
            onClick={() => copyLink(lastInvite.url)}
            className="text-xs font-mono tekst-drugi hover:text-[color:var(--tekst)] break-all text-left"
          >
            {copied === lastInvite.url ? 'Skopiowano' : lastInvite.url}
          </button>
        </div>
      )}
        </>
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
                    className="text-sm text-[var(--blad)] hover:underline shrink-0"
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
