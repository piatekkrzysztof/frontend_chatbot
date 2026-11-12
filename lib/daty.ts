/**
 * Data z API (RRRR-MM-DD) po polsku, np. 26.11.2026.
 *
 * Bez `new Date`: dzień bez godziny parsuje się jako północ UTC, więc
 * w strefie na zachód od Greenwich data cofnęłaby się o dzień.
 */
export function dataPl(data: string | null | undefined) {
  if (!data) return ''
  const [rok, miesiac, dzien] = data.split('-')
  return `${dzien}.${miesiac}.${rok}`
}
