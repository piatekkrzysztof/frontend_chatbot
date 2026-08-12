import Link from 'next/link'

interface Props {
  wysokosc?: number
  jakoLink?: boolean
  className?: string
}

export default function Logo({ wysokosc = 30, jakoLink = false, className = '' }: Props) {
  const znak = (
    <span className={`brand-lockup ${className}`} style={{ minHeight: wysokosc }}>
      {/* Właściwy znak SM-art, współdzielony ze stroną agencji. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/img/logo.svg"
        alt="SM-art"
        className="brand-logo-image"
        style={{ height: wysokosc, width: 'auto' }}
      />
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
