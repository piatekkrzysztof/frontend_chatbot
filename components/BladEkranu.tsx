'use client'

import { useEffect } from 'react'

/**
 * Treść granicy błędu panelu (app/(panel)/error.tsx i app/(panel)/(admin)/error.tsx).
 *
 * Do audytu 2026-10 (A-20) panel nie miał granic błędu: każdy wyjątek
 * renderowania - np. odpowiedź API w nieoczekiwanym kształcie - zostawiał
 * pustą stronę bez słowa wyjaśnienia. Szczegółów błędu nie pokazujemy:
 * w produkcji Next i tak je ukrywa, a zdanie z wnętrza kodu nikomu nie pomoże.
 */
export default function BladEkranu({ error, retry, tytul }: { error: unknown; retry: () => void; tytul: string }) {
  useEffect(() => {
    // Zostaje w konsoli przeglądarki do diagnozy
    console.error(error)
  }, [error])

  return (
    <div className="max-w-xl">
      <div role="alert">
        <h1 className="text-2xl font-bold mb-2">{tytul}</h1>
        <p className="tekst-drugi mb-5">
          Spróbuj wczytać go jeszcze raz. Jeśli błąd wraca, przeładuj stronę - dane
          zapisane wcześniej są bezpieczne.
        </p>
      </div>
      <button type="button" className="btn-primary min-h-11" onClick={() => retry()}>
        Spróbuj ponownie
      </button>
    </div>
  )
}
