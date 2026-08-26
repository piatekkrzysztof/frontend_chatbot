/**
 * Czytanie strumienia Server-Sent Events z backendu.
 *
 * Wyodrębnione z WidgetChat nie po to, żeby plik był krótszy, tylko dlatego,
 * że inaczej tej logiki nie da się sprawdzić bez montowania całego widgetu
 * i podstawiania mu strumienia sieciowego. Tutaj jest to czysta funkcja:
 * bufor wchodzi, zdarzenia i reszta wychodzą.
 *
 * Kontrakt serwera (api/utils/chat_engine.py, funkcja `_sse`):
 *
 *     data: {"type":"delta","content":"kawałek"}\n\n
 *     data: {"type":"done","source":"faq","tokens":42,
 *            "sources":[...],"message_id":17}\n\n
 *
 * Granice pakietów TCP nie mają nic wspólnego z granicami zdarzeń: jedno
 * zdarzenie potrafi przyjść w trzech kawałkach, a trzy zdarzenia w jednym.
 * Dlatego funkcja zwraca resztę bufora — wywołujący dokleja do niej następny
 * kawałek i woła ponownie.
 */

export type ZdarzenieDelta = {
  type: 'delta'
  content: string
}

export type ZdarzenieDone = {
  type: 'done'
  source?: string
  tokens?: number
  /** Kształt źródeł normalizuje dopiero widget — patrz normalizujZrodla. */
  sources?: unknown[]
  message_id?: number
}

/**
 * Unia zawężana po polu `type`. Świadomie NIE ma tu wariantu „dowolne
 * zdarzenie": taki wariant psuje zawężanie i konsument dostaje `unknown`
 * na każdym polu. Zdarzenie o nieznanym `type` po prostu nie wpadnie w żadną
 * gałąź po stronie widgetu — i o to chodzi.
 */
export type Zdarzenie = ZdarzenieDelta | ZdarzenieDone

export interface WynikCzytania {
  zdarzenia: Zdarzenie[]
  /** Ogon, który nie tworzy jeszcze pełnego zdarzenia. */
  reszta: string
}

const SEPARATOR = '\n\n'
const PREFIKS = 'data:'

/**
 * Wyciąga z bufora wszystkie kompletne zdarzenia.
 *
 * Uszkodzone zdarzenie jest POMIJANE, nie rzuca wyjątkiem. Wcześniej
 * `JSON.parse` stał bez zabezpieczenia w pętli czytania, więc jeden zepsuty
 * fragment przerywał całą odpowiedź i odwiedzający dostawał komunikat o błędzie
 * zamiast reszty zdania, które model już wysłał.
 */
export function czytajZdarzenia(bufor: string): WynikCzytania {
  const czesci = bufor.split(SEPARATOR)
  // Ostatni element nie jest zakończony separatorem, więc może być urwany
  // w połowie — wraca do bufora zamiast do parsowania.
  const reszta = czesci.pop() ?? ''
  const zdarzenia: Zdarzenie[] = []

  for (const surowe of czesci) {
    const linia = surowe.trim()
    if (!linia.startsWith(PREFIKS)) continue

    // `data:{...}` bez spacji jest równie poprawnym SSE co `data: {...}`.
    // Poprzednia wersja wymagała spacji i po cichu gubiła takie zdarzenia.
    const tresc = linia.slice(PREFIKS.length).trim()
    if (!tresc) continue

    try {
      // Rzutowanie na granicy JSON.parse: serwer może przysłać cokolwiek,
      // a zawężanie po `type` i tak dzieje się u konsumenta.
      zdarzenia.push(JSON.parse(tresc) as Zdarzenie)
    } catch {
      // Zepsuty kawałek nie może wywrócić reszty strumienia.
    }
  }

  return { zdarzenia, reszta }
}
