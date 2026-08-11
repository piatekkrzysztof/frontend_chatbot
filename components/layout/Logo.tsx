import Link from 'next/link'

interface Props {
  wysokosc?: number
  jakoLink?: boolean
  className?: string
}

export default function Logo({ wysokosc = 30, jakoLink = false, className = '' }: Props) {
  const znak = (
    <span className={`brand-lockup ${className}`} style={{ minHeight: wysokosc }}>
      <span className="brand-wordmark" style={{ fontSize: wysokosc * 0.82 }}>
        SM<span className="brand-accent">—</span>art
      </span>
      <span className="brand-product" style={{ fontSize: Math.max(9, wysokosc * 0.31) }}>
        AI Concierge
      </span>
    </span>
  )

  if (!jakoLink) return znak

  return (
    <Link href="/" className="inline-flex" aria-label="SM-art AI Concierge — strona główna">
      {znak}
    </Link>
  )
}
