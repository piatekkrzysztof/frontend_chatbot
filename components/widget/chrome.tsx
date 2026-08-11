'use client'

import { CSSProperties, ReactNode } from 'react'
import type { WidgetTheme } from './theme'

/**
 * Części okna czatu wspólne dla prawdziwego widgetu i podglądu w panelu.
 *
 * Nagłówek, dymki i pasek wysyłania wyglądają w obu miejscach tak samo, więc
 * mieszkają w jednym pliku. Przy dwóch kopiach pierwsza zmiana wyglądu robi
 * z podglądu obietnicę bez pokrycia — klient ustawia kolor, widzi jedno,
 * a odwiedzający jego stronę dostaje drugie.
 *
 * Język wizualny jest ten sam co na agencjasm-art.pl w wariancie „Swiss Tech":
 * kremowe płótno, białe powierzchnie, włoskowate linie zamiast cieni,
 * kanty zamiast zaokrągleń, mikro-wersaliki jako podpisy. Pomarańcz wchodzi
 * rzadko — pasek pod nagłówkiem, numery pytań, przycisk wysyłania.
 */

/* Promień 2 px, nie 0: przy zerze krawędzie na ekranach bez skalowania
   wyglądają na przypadkowo ucięte, a nie na zamierzony kant. */
export const KANT = 2

interface EtykietaProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

/** Mikro-wersaliki: podpisy sekcji, tak jak nadkreślenia na stronie agencji. */
export function Etykieta({ children, style, className = '' }: EtykietaProps) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-[0.14em] leading-tight ${className}`}
      style={{ fontFamily: 'var(--font-display)', ...style }}
    >
      {children}
    </span>
  )
}

/** Krótka pomarańczowa kreska przed podpisem — sygnatura z hero agencji. */
export function Kreska({ kolor }: { kolor: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: 14, height: 2, background: kolor }}
    />
  )
}

export function PasekTytulu({
  theme,
  logoUrl,
}: {
  theme: WidgetTheme
  logoUrl?: string | null
}) {
  return (
    <header
      className="shrink-0 flex items-center gap-2.5 px-3.5 py-3"
      style={{
        background: theme.headerBg,
        // Pomarańczowa linia oddziela ciemny pas od kremowego płótna.
        // Bez niej styk dwóch płaszczyzn wygląda na przypadkowy.
        borderBottom: `2px solid ${theme.accent}`,
      }}
    >
      {logoUrl ? (
        // Logo klienta z backendu/S3 — widget działa w iframe, optymalizacja
        // next/image tylko dokładałaby zależność od konfiguracji domen.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-6 shrink-0 object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="h-7 w-7 shrink-0 grid place-items-center text-[13px] font-extrabold"
          style={{
            background: theme.accent,
            color: theme.onAccent,
            borderRadius: KANT,
            fontFamily: 'var(--font-display)',
          }}
        >
          {theme.name.charAt(0).toUpperCase()}
        </span>
      )}

      <span className="min-w-0">
        <span
          className="block truncate text-[15px] font-extrabold tracking-tight leading-none"
          style={{ fontFamily: 'var(--font-display)', color: theme.headerText }}
        >
          {theme.name}
        </span>
        {/* Ujawnienie wymagane przez art. 50 EU AI Act od 2 sierpnia 2026:
            odwiedzający musi wiedzieć, że rozmawia z AI. Celowo nie jest
            konfigurowalne ani wyłączalne — to obowiązek prawny także po
            stronie klienta, więc nie może zależeć od jego ustawień. */}
        <Etykieta className="block mt-1" style={{ color: theme.headerMuted }}>
          Asystent AI · odpowiada automatycznie
        </Etykieta>
      </span>
    </header>
  )
}

/**
 * Wypowiedź bota: biała kartka z włoskowatą ramką i pomarańczową krawędzią
 * od lewej. Krawędź zastępuje kółko awatara — okrąg rozbijał lewą oś, na
 * której stoi cała reszta układu.
 */
export function BabelBota({
  theme,
  children,
  className = '',
}: {
  theme: WidgetTheme
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-3 py-2.5 text-[13px] leading-[1.55] whitespace-pre-wrap ${className}`}
      style={{
        background: theme.surface,
        color: theme.text,
        border: `1px solid ${theme.line}`,
        borderLeft: `2px solid ${theme.accent}`,
        borderRadius: KANT,
      }}
    >
      {children}
    </div>
  )
}

/** Wypowiedź odwiedzającego: pełny ciemny blok, bez ramki. */
export function BabelUzytkownika({
  theme,
  children,
}: {
  theme: WidgetTheme
  children: ReactNode
}) {
  return (
    <div
      className="px-3 py-2.5 text-[13px] leading-[1.55] whitespace-pre-wrap"
      style={{
        background: theme.userBubbleBg,
        color: theme.userBubbleText,
        borderRadius: KANT,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Gotowe pytania jako ponumerowana lista rozdzielona liniami — ten sam układ,
 * co „Jak działamy" na stronie agencji. Wcześniej były to pigułki: okrągłe,
 * różnej długości, rozjeżdżające lewą krawędź.
 *
 * Bez `onWybierz` renderuje się jako martwy podgląd, nie przyciski — inaczej
 * w panelu dałoby się kliknąć coś, co nic nie robi.
 */
export function Sugestie({
  theme,
  pytania,
  onWybierz,
  zablokowane,
}: {
  theme: WidgetTheme
  pytania: string[]
  onWybierz?: (pytanie: string) => void
  zablokowane?: boolean
}) {
  if (pytania.length === 0) return null

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Kreska kolor={theme.accent} />
        <Etykieta style={{ color: theme.accentText }}>Zacznij od pytania</Etykieta>
      </div>

      <div style={{ borderTop: `1px solid ${theme.line}` }}>
        {pytania.map((pytanie, i) => {
          const tresc = (
            <>
              <span
                className="text-[10px] font-bold tabular-nums shrink-0"
                style={{ color: theme.accentText, fontFamily: 'var(--font-display)' }}
              >
                /{String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 text-[13px] leading-snug" style={{ color: theme.text }}>
                {pytanie}
              </span>
              <span aria-hidden="true" className="text-xs shrink-0" style={{ color: theme.accentText }}>
                →
              </span>
            </>
          )

          const styl = { borderBottom: `1px solid ${theme.line}` }

          return onWybierz ? (
            <button
              key={pytanie}
              onClick={() => onWybierz(pytanie)}
              disabled={zablokowane}
              className="w-full flex items-baseline gap-2.5 py-2.5 text-left disabled:opacity-50"
              style={styl}
            >
              {tresc}
            </button>
          ) : (
            <span key={pytanie} className="flex items-baseline gap-2.5 py-2.5" style={styl}>
              {tresc}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Stopka: adres polityki prywatności i podpis, oba w mikro-wersalikach. */
export function Stopka({
  theme,
  privacyUrl,
}: {
  theme: WidgetTheme
  privacyUrl?: string | null
}) {
  if (!theme.footerLabel && !privacyUrl) return null

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2"
      style={{ background: theme.surface, borderTop: `1px solid ${theme.line}` }}
    >
      {/* RODO: odwiedzający ma być poinformowany o przetwarzaniu tam, gdzie
          zostawia dane — czyli w oknie czatu, a nie dopiero w stopce strony. */}
      {privacyUrl ? (
        <a
          href={privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          <Etykieta style={{ color: theme.textMuted }}>Przetwarzanie danych</Etykieta>
        </a>
      ) : (
        <span />
      )}
      {theme.footerLabel && (
        <Etykieta style={{ color: theme.textMuted }}>{theme.footerLabel}</Etykieta>
      )}
    </div>
  )
}
