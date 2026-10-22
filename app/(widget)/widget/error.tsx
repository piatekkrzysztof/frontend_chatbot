'use client'

import { useEffect } from 'react'
import { resolveTheme } from '@/components/widget/theme'

/**
 * Błąd okna czatu na stronie klienta.
 *
 * Do audytu 2026-10 (A-20) wyjątek kończył się komunikatem przeglądarki
 * „This page couldn't load” w ramce - tak wyglądał A-01 u odwiedzających.
 * Odwiedzający nie potrzebuje szczegółów, tylko informacji, że to nie on
 * zrobił coś źle, i drogi do ponowienia. Kolory jak w oknie bez ustawień.
 */
export default function BladWidgetu({ error, retry }: { error: unknown; retry: () => void }) {
  const motyw = resolveTheme(null)

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center text-[13px]"
      style={{ background: motyw.canvas, color: motyw.text }}
    >
      <p role="alert">Czat chwilowo nie działa. Spróbuj ponownie za chwilę.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-[44px] px-3 underline underline-offset-2"
        style={{ color: motyw.accentText }}
      >
        Spróbuj ponownie
      </button>
    </div>
  )
}
