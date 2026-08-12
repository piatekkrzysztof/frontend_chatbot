import './globals.css'
import { ReactNode } from 'react'
import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'Sm-art Chatbot — asystent AI dla Twojej strony',
  description:
    'Chatbot, który odpowiada klientom na podstawie wiedzy Twojej firmy. '
    + 'Wdrożenie w kilkanaście minut, bez programisty.',
  icons: {
    icon: [{ url: '/img/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/img/favicon.svg',
  },
  openGraph: {
    title: 'Sm-art Chatbot — asystent AI dla Twojej strony',
    description: 'Chatbot oparty na wiedzy Twojej firmy, gotowy do obsługi klientów 24/7.',
    type: 'website',
    locale: 'pl_PL',
    images: [
      {
        url: '/img/og-image.svg',
        width: 1200,
        height: 600,
        alt: 'SM-art — technologia, automatyzacja i marketing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sm-art Chatbot — asystent AI dla Twojej strony',
    description: 'Chatbot oparty na wiedzy Twojej firmy, gotowy do obsługi klientów 24/7.',
    images: ['/img/og-image.svg'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${syne.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
