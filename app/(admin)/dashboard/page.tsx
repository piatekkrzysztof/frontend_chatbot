'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function DashboardPage() {
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    apiFetch('/accounts/me/')
      .then((data) => setTenantName(data.tenant_name || ''))
      .catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">
        {tenantName ? `Witaj, ${tenantName}` : 'Panel główny'}
      </h1>
      <p className="text-gray-600">
        Z menu po lewej możesz zarządzać dokumentami, wyglądem widgetu i przeglądać konwersacje.
      </p>
    </div>
  )
}
