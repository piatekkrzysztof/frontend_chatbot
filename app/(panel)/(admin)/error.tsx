'use client'

import BladEkranu from '@/components/BladEkranu'

/** Błąd ekranu panelu: menu i pasek górny zostają, pada tylko sam ekran. */
export default function BladPanelu({ error, retry }: { error: unknown; retry: () => void }) {
  return <BladEkranu error={error} retry={retry} tytul="Ten ekran napotkał błąd." />
}
