'use client'

import BladEkranu from '@/components/BladEkranu'

/**
 * Błąd poza ekranami panelu: logowanie, rejestracja, strona główna - albo
 * sam układ panelu (pasek, menu), którego nie obejmuje granica w (admin).
 */
export default function BladStrony({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <BladEkranu error={error} retry={retry} tytul="Ta strona napotkała błąd." />
    </main>
  )
}
