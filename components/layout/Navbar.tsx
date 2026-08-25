'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch, clearTokens } from '@/lib/api'
import Logo from './Logo'

interface Props {
  onToggleMenu?: () => void
  menuOtwarte?: boolean
}

// Podpis pod nazwa firmy mowil "Administrator" kazdemu, niezaleznie od roli.
// W produkcie z trzema rolami to mylace: pracownik i obserwator widzieli, ze
// sa administratorami, a czesc panelu i tak odbijala ich z 403. /accounts/me/
// zwraca `role` od dawna -- frontend go po prostu nie czytal.
const OPIS_ROLI: Record<string, string> = {
  owner: 'Właściciel',
  employee: 'Pracownik',
  viewer: 'Podgląd',
}

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Pulpit',
  '/documents': 'Baza wiedzy',
  '/faq': 'FAQ',
  '/widget-settings': 'Widget',
  '/conversations': 'Konwersacje',
  '/leads': 'Zapytania',
  '/team': 'Zespół',
  '/subskrypcja': 'Subskrypcja',
  '/privacy': 'Prywatność',
}

export default function Navbar({ onToggleMenu, menuOtwarte }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantName, setTenantName] = useState('')
  const [rola, setRola] = useState('')

  const currentPage = Object.entries(PAGE_NAMES).find(([path]) => pathname?.startsWith(path))?.[1] || 'Panel'
  const initials = (tenantName || 'SM').slice(0, 2).toUpperCase()

  useEffect(() => {
    apiFetch('/accounts/me/')
      .then((data) => {
        setTenantName(data.tenant_name || '')
        setRola(data.role || '')
      })
      .catch(() => {})
  }, [])

  function handleLogout() {
    clearTokens()
    router.replace('/login')
  }

  return (
    <header className="admin-navbar">
      <div className="admin-navbar-left">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            aria-label={menuOtwarte ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={menuOtwarte}
            className="admin-menu-button inline-flex lg:hidden"
          >
            <span aria-hidden="true">{menuOtwarte ? '×' : '≡'}</span>
          </button>
        )}
        <Logo wysokosc={25} className="lg:hidden" />
        <div className="admin-breadcrumb hidden lg:flex">
          <span>Workspace</span>
          <span aria-hidden="true">/</span>
          <strong>{currentPage}</strong>
        </div>
      </div>

      <div className="admin-navbar-actions">
        <span className="admin-live-badge hidden md:inline-flex">
          <span className="status-dot" /> Live
        </span>
        <div className="admin-account hidden sm:flex">
          <span className="admin-avatar">{initials}</span>
          <span className="admin-account-copy">
            <strong>{tenantName || 'Twoje konto'}</strong>
            <small>{OPIS_ROLI[rola] ?? 'Konto'}</small>
          </span>
        </div>
        <button onClick={handleLogout} className="admin-logout" title="Wyloguj">
          <span className="hidden sm:inline">Wyloguj</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </header>
  )
}
