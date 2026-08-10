'use client'

import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { API_URL, setTokens } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })

      if (!res.ok) {
        throw new Error('Nieprawidłowy e-mail lub hasło.')
      }

      const data = await res.json()
      setTokens(data.access, data.refresh)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Logo wysokosc={30} jakoLink />
      </div>

      <h1 className="text-3xl mb-6">Zaloguj się</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Hasło</label>
          <input
            type="password"
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
