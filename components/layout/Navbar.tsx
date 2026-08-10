'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearTokens } from '@/lib/api'

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
        background: 'rgba(17,12,4,0.72)',
        borderBottom: '1px solid var(--border-subtle)',
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
            style={{ color: 'var(--color-sand-300)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d={menuOtwarte ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <span
          className="font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Sm-art <span className="text-ember-500">Chatbot</span>
        </span>
        {tenantName && (
          <>
            <span style={{ color: 'var(--color-sand-400)' }}>/</span>
            <span className="text-sm" style={{ color: 'var(--color-sand-300)' }}>
              {tenantName}
            </span>
          </>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="text-sm transition-colors"
        style={{ color: 'var(--color-sand-300)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-sand-300)')}
      >
        Wyloguj
      </button>
    </header>
  )
}
