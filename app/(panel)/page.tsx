import StronaGlowna, { type Plan } from './StronaGlowna'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

/**
 * Cennik pobierany na serwerze, żeby był w HTML strony.
 *
 * Strona i tak renderuje się na serwerze (nonce w układzie panelu), a do
 * audytu 2026-10 (A-23) cennik pobierała dopiero przeglądarka - wyszukiwarka
 * i podgląd linku widziały „Wczytywanie cennika...”.
 *
 * Odpowiedź trzyma pamięć podręczna Next na godzinę, więc backend nie dostaje
 * zapytania z każdym wejściem na stronę. Limit 1,5 s: wolny albo uśpiony
 * backend nie może wstrzymać strony sprzedażowej - wtedy zwracamy pustą listę
 * i cennik dociąga przeglądarka, jak dawniej.
 */
async function pobierzCennik(): Promise<Plan[]> {
  try {
    const odpowiedz = await fetch(`${API_URL}/billing/cennik/`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(1500),
    })
    if (!odpowiedz.ok) return []
    const dane = await odpowiedz.json()
    return Array.isArray(dane?.plans) ? dane.plans : []
  } catch {
    return []
  }
}

export default async function StronaGlownaPage() {
  return <StronaGlowna planyZSerwera={await pobierzCennik()} />
}
