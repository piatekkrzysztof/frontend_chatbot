import './globals.css'
import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import localFont from 'next/font/local'
import { JetBrains_Mono } from 'next/font/google'

/**
 * Kroje z witryny agencji (system „Przypis”): Gambetta w nagłówkach i dużych
 * liczbach, Switzer w interfejsie, JetBrains Mono w danych i etykietach.
 * Gambetta i Switzer pochodzą z Fontshare, którego nie ma w next/font/google,
 * więc pliki leżą w app/fonts. CSP panelu ma font-src 'self', zewnętrzny
 * arkusz Fontshare i tak zostałby zablokowany.
 */
const gambetta = localFont({
  src: [
    { path: './fonts/Gambetta-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Gambetta-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/Gambetta-Medium.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-gambetta',
  display: 'swap',
})

const switzer = localFont({
  src: [
    { path: './fonts/Switzer-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Switzer-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Switzer-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-switzer',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin-ext'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SM-art Chat: czat AI dla Twojej strony',
  description:
    'Chatbot, który odpowiada klientom na podstawie wiedzy Twojej firmy. '
    + 'Wdrożenie w kilkanaście minut, bez programisty.',
  icons: {
    icon: [{ url: '/img/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/img/favicon.svg',
  },
  openGraph: {
    title: 'SM-art Chat: czat AI dla Twojej strony',
    description: 'Chatbot oparty na wiedzy Twojej firmy, gotowy do obsługi klientów 24/7.',
    type: 'website',
    locale: 'pl_PL',
    images: [
      {
        url: '/img/og-image.svg',
        width: 1200,
        height: 600,
        alt: 'SM-art Chat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SM-art Chat: czat AI dla Twojej strony',
    description: 'Chatbot oparty na wiedzy Twojej firmy, gotowy do obsługi klientów 24/7.',
    images: ['/img/og-image.svg'],
  },
}

/**
 * Odczyt nagłówków wypisuje całą aplikację ze statycznego prerenderowania.
 *
 * To nie jest efekt uboczny, tylko powód, dla którego ta funkcja jest
 * asynchroniczna. Polityka bezpieczeństwa używa nonce, który powstaje osobno
 * dla każdego żądania - w stronie zapisanej na dysku przy budowaniu nie ma
 * jak go umieścić, więc przeglądarka zablokowałaby wszystkie skrypty Next.js
 * i panel by nie wstał. Dokładnie tak skończyła się pierwsza próba.
 *
 * Koszt jest mały: wszystkie ekrany panelu to komponenty klienta pobierające
 * dane po zamontowaniu, więc prerenderowana była pusta powłoka. Widget, gdzie
 * czas pierwszego rysowania ma znaczenie, jest poza zasięgiem middleware
 * i zachowuje własne nagłówki z next.config.js.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await headers()

  return (
    <html lang="pl" className={`${gambetta.variable} ${switzer.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
