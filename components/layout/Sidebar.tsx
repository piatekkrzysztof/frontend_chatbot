'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

const GRUPY = [
  {
    tytul: null,
    linki: [{ href: '/dashboard', label: 'Pulpit' }],
  },
  {
    tytul: 'Wiedza bota',
    linki: [
      { href: '/documents', label: 'Baza wiedzy' },
      { href: '/faq', label: 'FAQ' },
      // Zaraz pod źródłami wiedzy, bo to ich sprawdzenie: wgrywasz, pytasz,
      // widzisz. Nie w „Obsłudze klienta" — to nie jest ruch klientów.
      { href: '/test-bota', label: 'Test bota' },
      { href: '/widget-settings', label: 'Widget' },
    ],
  },
  {
    tytul: 'Obsługa klienta',
    linki: [
      { href: '/conversations', label: 'Konwersacje' },
      { href: '/leads', label: 'Zapytania' },
    ],
  },
  {
    tytul: 'Konto',
    linki: [
      { href: '/ustawienia', label: 'Ustawienia konta' },
      { href: '/team', label: 'Zespół' },
      { href: '/subskrypcja', label: 'Subskrypcja' },
      { href: '/privacy', label: 'Prywatność' },
      // Obok prywatności, bo to ta sama sprawa z drugiej strony: tam widać,
      // co system trzyma o odwiedzających, tutaj - co z tym robili ludzie
      // z Twojej firmy.
      { href: '/dziennik', label: 'Dziennik zdarzeń' },
      { href: '/stan', label: 'Stan systemu' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <Logo wysokosc={42} className="admin-sidebar-logo" />
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
                  {/* Znacznik zamiast numeru: numery w menu niczego nie liczyły. */}
                  <span className="admin-nav-code" aria-hidden="true" />
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
          <span className="admin-support-kicker">Pomoc przy konfiguracji</span>
          <p>Odpisuję w 2 godziny robocze.</p>
          <a
            href="mailto:krzysztof@agencjasm-art.pl"
            aria-label="Napisz na krzysztof@agencjasm-art.pl"
          >
            Napisz do mnie <span aria-hidden="true">↗</span>
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
