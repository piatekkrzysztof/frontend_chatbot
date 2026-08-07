'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, clearTokens } from '@/lib/api'

export default function Navbar() {
  const router = useRouter()
  const [tenantName, setTenantName] = useState<string>('')

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
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <span className="font-semibold text-gray-900">{tenantName || 'Panel klienta'}</span>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        Wyloguj
      </button>
    </header>
  )
}
