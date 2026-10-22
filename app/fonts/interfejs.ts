import localFont from 'next/font/local'
import { JetBrains_Mono } from 'next/font/google'

/**
 * Kroje wspólne dla panelu i widgetu: Switzer w interfejsie, JetBrains Mono
 * w danych i etykietach. Switzer pochodzi z Fontshare, którego nie ma
 * w next/font/google, więc pliki leżą obok. CSP panelu ma font-src 'self',
 * zewnętrzny arkusz Fontshare i tak zostałby zablokowany.
 *
 * Osobny plik, bo Next wstępnie ładuje kroje z modułów, które trasa importuje.
 * Gambetta (nagłówki) zostaje w układzie panelu - widget nie ma nagłówków,
 * a do audytu 2026-10 pobierał jej trzy pliki na każdej stronie klienta.
 */
export const switzer = localFont({
  src: [
    { path: './Switzer-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Switzer-Medium.woff2', weight: '500', style: 'normal' },
    { path: './Switzer-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-switzer',
  display: 'swap',
})

export const jetbrains = JetBrains_Mono({
  subsets: ['latin-ext'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})
