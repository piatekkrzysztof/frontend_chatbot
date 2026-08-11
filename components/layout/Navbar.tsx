'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearTokens } from '@/lib/api'
import Logo from './Logo'

interface Props {
  onToggleMenu?: () => void
  menuOtwarte?: boolean
}

export default function Navbar({ onToggleMenu, menuOtwarte }: Props) {
  const router = useRouter()
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    apiFetch('/accounts/me/')
      .then((data) => setTenantName(data.tenant_name || ''))
      .catch(() => {})
  }, [])

  function handleLogout() {
    clearTokens()
    router.replace('/login')
  }

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 h-[68px] backdrop-blur-lg"
      style={{
        background: 'color-mix(in srgb, var(--tlo) 82%, transparent)',
        borderBottom: '1px solid var(--obramowanie)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Widoczny tylko tam, gdzie menu jest schowane */}
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            aria-label={menuOtwarte ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={menuOtwarte}
            className="lg:hidden -ml-1 p-2 rounded-lg transition-colors"
            style={{ color: 'var(--tekst-drugi)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d={menuOtwarte ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <Logo wysokosc={26} />
      </div>

      {/* Nazwa firmy po prawej, przy wylogowaniu: to informacja o tym, na czyim
          koncie jesteś, więc stoi tam, gdzie reszta spraw konta. Po lewej,
          zaraz obok logo, konkurowała z nim o to samo miejsce. */}
      <div className="flex items-center gap-4">
        {tenantName && (
          <span className="text-sm hidden sm:inline tekst-drugi">{tenantName}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm transition-colors tekst-slaby hover:text-[color:var(--tekst)]"
        >
          Wyloguj
        </button>
      </div>
    </header>
  )
}
