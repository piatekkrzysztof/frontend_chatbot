import Link from 'next/link'

interface Props {
  wysokosc?: number
  jakoLink?: boolean
  className?: string
}

/**
 * Logo „Trasa” ze strony agencji, wpisane w kod zamiast <img>: linia i napis
 * biorą currentColor, więc ten sam znak działa na granatowym pasku bocznym
 * i na papierze. Kółka węzłów wypełnia --logo-tlo, czyli tło pod logo.
 * Pomarańczowe pociągnięcia i ptaszek zostają pomarańczowe w każdym motywie.
 */
export function ZnakTrasa({ wysokosc = 30 }: { wysokosc?: number }) {
  return (
    <svg
      className="brand-logo-trasa"
      viewBox="88 72 856 402"
      height={wysokosc}
      width={Math.round((wysokosc * 856) / 402)}
      role="img"
      aria-label="SM-art"
    >
      <path d="M346 392 C470 384 640 378 906 381" fill="none" stroke="#FFA552" strokeWidth="16" strokeLinecap="round" />
      <path d="M540 405 C660 400 780 398 884 400" fill="none" stroke="#FFA552" strokeWidth="8" strokeLinecap="round" opacity=".85" />
      <path d="M162 430 H252 A48 48 0 0 0 300 382 V342 A60 60 0 0 0 240 282 H195 A65 65 0 0 1 130 217 A85 85 0 0 1 215 132 H826" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="300" cy="362" r="13" style={{ fill: 'var(--logo-tlo)' }} stroke="currentColor" strokeWidth="9" />
      <circle cx="130" cy="217" r="13" style={{ fill: 'var(--logo-tlo)' }} stroke="currentColor" strokeWidth="9" />
      <circle cx="138" cy="430" r="24" style={{ fill: 'var(--logo-tlo)' }} stroke="currentColor" strokeWidth="10" />
      <circle cx="138" cy="430" r="10" fill="currentColor" />
      <circle cx="866" cy="132" r="40" style={{ fill: 'var(--logo-tlo)' }} stroke="currentColor" strokeWidth="11" />
      <circle cx="866" cy="132" r="27" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M848 133 L862 147 L894 110" fill="none" stroke="#FFA552" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M370 330 V270 A32 32 0 0 1 434 270 V330 M434 270 A32 32 0 0 1 498 270 V330 M530 288 H570 M675 287 A43 43 0 1 0 675 288 M675 244 V330 M716 330 V286 Q716 244 762 244 M808 206 V298 Q808 330 840 330 M786 248 H840" fill="none" stroke="currentColor" strokeWidth="27" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ wysokosc = 30, jakoLink = false, className = '' }: Props) {
  const znak = (
    <span className={`brand-lockup ${className}`} style={{ minHeight: wysokosc }}>
      <ZnakTrasa wysokosc={wysokosc} />
      <span className="brand-product" style={{ fontSize: Math.max(9, Math.round(wysokosc * 0.24)) }}>
        Chat
      </span>
    </span>
  )

  if (!jakoLink) return znak

  return (
    <Link href="/" className="inline-flex" aria-label="SM-art Chat — strona główna">
      {znak}
    </Link>
  )
}
