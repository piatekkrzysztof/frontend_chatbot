import '../globals.css'
import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import localFont from 'next/font/local'
import { jetbrains, switzer } from '../fonts/interfejs'

/**
 * Kroje z witryny agencji (system „Przypis”): Gambetta w nagłówkach i dużych
 * liczbach, Switzer i JetBrains Mono wspólne z widgetem (app/fonts/interfejs.ts).
 * Gambetta pochodzi z Fontshare, którego nie ma w next/font/google, więc pliki
 * leżą w app/fonts.
 */
const gambetta = localFont({
  src: [
    { path: '../fonts/Gambetta-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Gambetta-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../fonts/Gambetta-Medium.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-gambetta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SM-art Chat: czat AI dla Twojej strony',
  description:
    'Chatbot, który odpowiada klientom na podstawie wiedzy Twojej firmy. '
    + 'Wdrożenie w kilkanaście minut, bez programisty.',
  icons: {
    // Nowy adres zamiast /img/favicon.svg: przeglądarki trzymają favikonę
    // w pamięci po adresie i po zmianie samego pliku pokazywały stary znak.
    icon: [{ url: '/img/sygnet-trasa.svg', type: 'image/svg+xml' }],
    shortcut: '/img/sygnet-trasa.svg',
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
 * dane po zamontowaniu, więc prerenderowana była pusta powłoka.
 *
 * Ten układ obejmuje tylko panel (grupa `(panel)`: strona główna, logowanie,
 * ekrany). Widget ma własny główny układ w `app/(widget)` bez tego odczytu,
 * więc jest statyczny - do audytu 2026-10 (A-08) leżał pod tym układem i każde
 * otwarcie czatu na stronie klienta renderowało się na serwerze.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await headers()

  return (
    <html lang="pl" className={`${gambetta.variable} ${switzer.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
