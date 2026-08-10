'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Nawigacja panelu, pogrupowana według tego, po co klient wchodzi.
 *
 * Wcześniej było dziewięć pozycji jednym ciągiem — a to nie jest lista równych
 * sobie rzeczy. "Baza wiedzy" i "Widget" to konfiguracja robiona raz, a
 * "Konwersacje" i "Zapytania" to codzienny powód wejścia do panelu. Grupy
 * pokazują tę różnicę bez dokładania kliknięć.
 */
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
      { href: '/widget-settings', label: 'Widget' },
    ],
  },
  {
    tytul: 'Co przyszło',
    linki: [
      { href: '/conversations', label: 'Konwersacje' },
      { href: '/leads', label: 'Zapytania' },
    ],
  },
  {
    tytul: 'Konto',
    linki: [
      { href: '/team', label: 'Zespół' },
      { href: '/subskrypcja', label: 'Subskrypcja' },
      { href: '/privacy', label: 'Prywatność' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-60 shrink-0 min-h-screen px-4 py-6"
      style={{ borderRight: '1px solid var(--border-subtle)' }}
    >
      <nav className="flex flex-col gap-7">
        {GRUPY.map((grupa, i) => (
          <div key={grupa.tytul ?? i} className="flex flex-col gap-1">
            {grupa.tytul && (
              <p
                className="px-3 mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'var(--color-sand-400)', fontFamily: 'var(--font-display)' }}
              >
                {grupa.tytul}
              </p>
            )}

            {grupa.linki.map((link) => {
              const aktywny = pathname?.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={aktywny ? 'page' : undefined}
                  className="relative rounded-lg px-3 py-2 text-sm transition-all"
                  style={{
                    color: aktywny ? 'var(--color-cream)' : 'var(--color-sand-300)',
                    background: aktywny ? 'var(--color-espresso-700)' : 'transparent',
                    fontWeight: aktywny ? 600 : 400,
                  }}
                >
                  {/* Pomarańczowy znacznik zamiast wypełnienia całego pola —
                      przy dziewięciu pozycjach pełne tło krzyczałoby za mocno */}
                  {aktywny && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full"
                      style={{ background: 'var(--color-ember-500)' }}
                    />
                  )}
                  {link.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
