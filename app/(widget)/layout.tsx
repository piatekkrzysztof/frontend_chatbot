import './widget.css'
import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { jetbrains, switzer } from '../fonts/interfejs'

/**
 * Główny układ okna czatu osadzanego na stronach klientów.
 *
 * Osobny od panelu z trzech powodów (audyt 2026-10, A-07, A-08, A-16):
 *  - bez odczytu headers(), więc strona jest statyczna i idzie z CDN. Pod
 *    układem panelu renderowała się na serwerze przy każdym otwarciu czatu
 *    na każdej stronie każdego klienta;
 *  - bez Gambetty i bez arkusza panelu (widget.css): widget nie ma
 *    nagłówków, a pobierał trzy pliki Gambetty i cały CSS panelu;
 *  - z własną polityką bezpieczeństwa w next.config.js - nonce panelu
 *    wymaga renderowania na żądanie, statyczna strona go nie dostanie.
 *
 * Przejście między tym układem a panelem to pełne przeładowanie strony.
 * Tu bez znaczenia: widget żyje w ramce i do panelu nie prowadzi.
 */
export const metadata: Metadata = {
  title: 'Okno czatu',
  // Adres z kluczem klienta nie ma czego szukać w wynikach wyszukiwania
  robots: { index: false, follow: false },
}

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${switzer.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  )
}
