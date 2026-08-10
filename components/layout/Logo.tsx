import Link from 'next/link'

/**
 * Znak firmowy z witryny agencji.
 *
 * Ten sam plik SVG co na agencjasm-art.pl, nie odrysowany na nowo — klient
 * ma rozpoznać markę, a nie jej podobiznę. Obok stoi słowo "Chatbot", bo to
 * osobny produkt tej samej agencji, nie ta sama usługa.
 *
 * Zwykły <img>, nie next/image: to statyczny plik SVG z naszego katalogu,
 * którego optymalizacja i tak nie dotyczy, a dokładałaby tylko warstwę.
 */
interface Props {
  /** Wysokość znaku w pikselach. Domyślna odpowiada nagłówkowi witryny. */
  wysokosc?: number
  /** Odnośnik do strony głównej. W panelu niepotrzebny. */
  jakoLink?: boolean
  className?: string
}

export default function Logo({ wysokosc = 30, jakoLink = false, className = '' }: Props) {
  const znak = (
    <span className={`inline-flex items-baseline gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/img/logo.svg"
        alt="Sm-art"
        style={{ height: wysokosc, width: 'auto' }}
        className="block shrink-0"
      />
      <span
        className="font-extrabold tracking-tight leading-none"
        style={{ fontFamily: 'var(--font-display)', fontSize: wysokosc * 0.52 }}
      >
        Chatbot
      </span>
    </span>
  )

  if (!jakoLink) return znak

  return (
    <Link href="/" className="inline-flex" aria-label="Sm-art Chatbot — strona główna">
      {znak}
    </Link>
  )
}
