'use client'

import { useEffect, useState, FormEvent, use } from 'react'
import { useRouter } from 'next/navigation'
import { API_URL, setTokens } from '@/lib/api'

interface InvitePreview {
  company: string
  email: string
  role: string
  is_valid: boolean
  expires_at: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'właściciela',
  employee: 'pracownika',
  viewer: 'podglądu',
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Sprawdzamy ważność zanim pokażemy formularz — inaczej zapraszany wypełnia
  // dane, żeby dopiero przy zapisie dowiedzieć się, że link wygasł.
  useEffect(() => {
    let active = true

    fetch(`${API_URL}/accounts/invitations/${token}/preview/`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Ten link zaproszenia jest nieprawidłowy.')
        return res.json()
      })
      .then((data: InvitePreview) => {
        if (!active) return
        setPreview(data)
        setEmail(data.email || '')
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setLoadError(err instanceof Error ? err.message : 'Nie udało się sprawdzić zaproszenia.')
        setLoading(false)
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/accounts/accept-invite/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, username, email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail =
          data.non_field_errors?.[0] ||
          data.detail ||
          Object.values(data)[0] ||
          'Nie udało się założyć konta.'
        throw new Error(String(detail))
      }

      // Konto założone — logujemy od razu, żeby nie odsyłać na ekran logowania.
      // Endpoint oczekuje klucza `username`; backend przyjmuje pod nim zarówno
      // nazwę użytkownika, jak i adres e-mail.
      const loginRes = await fetch(`${API_URL}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })

      if (loginRes.ok) {
        const tokens = await loginRes.json()
        setTokens(tokens.access, tokens.refresh)
        router.push('/dashboard')
        return
      }

      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się założyć konta.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-espresso-700">
        <p className="text-sand-400">Sprawdzam zaproszenie...</p>
      </div>
    )
  }

  if (loadError || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-espresso-700 px-4">
        <div className="w-full max-w-sm rounded-lg bg-espresso-800 p-6 shadow">
          <h1 className="text-xl font-bold mb-2">Zaproszenie nieaktualne</h1>
          <p className="text-sm text-sand-300">
            {loadError || 'Ten link zaproszenia jest nieprawidłowy.'} Poproś osobę, która
            Cię zapraszała, o nowy link.
          </p>
        </div>
      </div>
    )
  }

  if (!preview.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-espresso-700 px-4">
        <div className="w-full max-w-sm rounded-lg bg-espresso-800 p-6 shadow">
          <h1 className="text-xl font-bold mb-2">Zaproszenie wygasło</h1>
          <p className="text-sm text-sand-300">
            Link do zespołu {preview.company} stracił ważność albo został już wykorzystany.
            Poproś o nowy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-espresso-700 px-4">
      <div className="w-full max-w-sm rounded-lg bg-espresso-800 p-6 shadow">
        <h1 className="text-xl font-bold mb-1">Dołącz do zespołu</h1>
        <p className="text-sm text-sand-300 mb-5">
          Zaproszenie do <span className="font-medium">{preview.company}</span> w roli{' '}
          {ROLE_LABELS[preview.role] || preview.role}.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="label">
            Nazwa użytkownika
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input mb-4"
          />

          <label className="label">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input mb-4"
          />

          <label className="label">Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input mb-5"
          />

          {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full !py-2 !text-sm"
          >
            {submitting ? 'Zakładanie konta...' : 'Załóż konto'}
          </button>
        </form>
      </div>
    </div>
  )
}
