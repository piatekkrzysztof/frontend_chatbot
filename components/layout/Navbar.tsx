'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearTokens } from '@/lib/api'

export default function Navbar() {
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
      <div className="flex items-baseline gap-3">
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
