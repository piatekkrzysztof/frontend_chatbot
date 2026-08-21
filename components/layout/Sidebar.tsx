'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

const GRUPY = [
  {
    tytul: null,
    linki: [{ href: '/dashboard', label: 'Pulpit', kod: '01' }],
  },
  {
    tytul: 'Wiedza bota',
    linki: [
      { href: '/documents', label: 'Baza wiedzy', kod: '02' },
      { href: '/faq', label: 'FAQ', kod: '03' },
      // Zaraz pod źródłami wiedzy, bo to ich sprawdzenie: wgrywasz, pytasz,
      // widzisz. Nie w „Obsłudze klienta" — to nie jest ruch klientów.
      { href: '/test-bota', label: 'Test bota', kod: '04' },
      { href: '/widget-settings', label: 'Widget', kod: '05' },
    ],
  },
  {
    tytul: 'Obsługa klienta',
    linki: [
      { href: '/conversations', label: 'Konwersacje', kod: '06' },
      { href: '/leads', label: 'Zapytania', kod: '07' },
    ],
  },
  {
    tytul: 'Konto',
    linki: [
      { href: '/team', label: 'Zespół', kod: '08' },
      { href: '/subskrypcja', label: 'Subskrypcja', kod: '09' },
      { href: '/privacy', label: 'Prywatność', kod: '10' },
      { href: '/stan', label: 'Stan systemu', kod: '11' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <Logo wysokosc={28} className="admin-sidebar-logo" />
        <span className="admin-edition">Console / 01</span>
      </div>

      <nav className="admin-nav" aria-label="Główna nawigacja panelu">
        {GRUPY.map((grupa, i) => (
          <div key={grupa.tytul ?? i} className="admin-nav-group">
            {grupa.tytul && <p className="admin-nav-label">{grupa.tytul}</p>}

            {grupa.linki.map((link) => {
              const aktywny = pathname?.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={aktywny ? 'page' : undefined}
                  className={`admin-nav-link ${aktywny ? 'is-active' : ''}`}
                >
                  <span className="admin-nav-code">{link.kod}</span>
                  <span>{link.label}</span>
                  <span className="admin-nav-arrow" aria-hidden="true">↗</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-support-card">
          <span className="admin-support-kicker">Wsparcie priorytetowe</span>
          <p>Potrzebujesz pomocy z konfiguracją?</p>
          <a
            href="mailto:krzysztof@agencjasm-art.pl"
            aria-label="Napisz do nas na krzysztof@agencjasm-art.pl"
          >
            Napisz do nas <span aria-hidden="true">↗</span>
          </a>
          <span className="admin-support-email">krzysztof@agencjasm-art.pl</span>
        </div>
        <div className="admin-system-state">
          <span className="status-dot" />
          Wszystkie systemy działają
        </div>
      </div>
    </aside>
  )
}
