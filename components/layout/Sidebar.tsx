'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Nawigacja panelu, pogrupowana według tego, po co klient wchodzi.
 *
 * "Baza wiedzy" i "Widget" to konfiguracja robiona raz, a "Konwersacje"
 * i "Zapytania" to codzienny powód wejścia do panelu. Grupy pokazują tę
 * różnicę bez dokładania kliknięć.
 *
 * Kolumna jest pomarańczowa — to jedyne miejsce w panelu, gdzie marka
 * wchodzi płaszczyzną, a nie akcentem. Reszta interfejsu jest spokojna,
 * więc mocny kolor ma tu gdzie wybrzmieć, nie walcząc z treścią.
 *
 * Tekst jest ciemny, nie biały. Biel na #F97316 daje 2,8:1 i nie przechodzi
 * progu WCAG; ciemne espresso na tym samym tle daje ponad 6:1.
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
      className="w-60 shrink-0 min-h-full px-3 py-6"
      style={{
        // Delikatny spad ku dołowi — płaski pomarańcz na całej wysokości
        // ekranu wygląda jak wypełnienie, gradient jak powierzchnia.
        background: 'linear-gradient(170deg, #F97316 0%, #EA6A0C 100%)',
      }}
    >
      <nav className="flex flex-col gap-6">
        {GRUPY.map((grupa, i) => (
          <div key={grupa.tytul ?? i} className="flex flex-col gap-0.5">
            {grupa.tytul && (
              <p
                className="px-3 mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
                style={{
                  // Przygaszona czerń, nie biel: na pomarańczu biel wygląda
                  // na wyblakłą, a przygaszona czerń czyta się jak nadruk.
                  // 0,62 dawało 3,39:1 przy wymaganych 4,5 — te etykiety są
                  // małe i pogrubione, więc nie łapią się na próg dla dużego tekstu.
                  color: 'rgba(26, 17, 8, 0.82)',
                  fontFamily: 'var(--font-display)',
                }}
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
                  className="rounded-lg px-3 py-2 text-sm transition-all"
                  style={{
                    // Aktywna pozycja to jasny kafelek na pomarańczu —
                    // odwrotność tego, co robi reszta panelu, więc od razu
                    // widać, gdzie się jest
                    background: aktywny ? 'rgba(255,255,255,0.92)' : 'transparent',
                    color: aktywny ? '#B8480C' : 'rgba(26, 17, 8, 0.88)',
                    fontWeight: aktywny ? 700 : 500,
                    boxShadow: aktywny ? '0 2px 8px rgba(120, 50, 0, 0.18)' : 'none',
                  }}
                >
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
