import './globals.css'
import { ReactNode } from 'react'
import { Syne, DM_Sans } from 'next/font/google'

/**
 * Kroje z witryny agencji. Ładowane przez next/font, a nie linkiem do Google —
 * pliki lądują na naszym serwerze, więc nie ma skoku tekstu przy wczytywaniu
 * ani zapytania do obcego hosta na każdej podstronie klienta.
 */
const syne = Syne({
  subsets: ['latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin-ext'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata = {
  title: 'Sm-art Chatbot — asystent AI dla Twojej strony',
  description:
    'Chatbot, który odpowiada klientom na podstawie wiedzy Twojej firmy. '
    + 'Wdrożenie w kilkanaście minut, bez programisty.',
  // Ten sam znak, który stoi w karcie przeglądarki na agencjasm-art.pl
  icons: { icon: '/img/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${syne.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
