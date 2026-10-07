'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Motyw panelu: jasny „Papier i atrament” (domyślny) albo ciemny
 * „Atrament nocą”. Wybór to wygoda jednej przeglądarki, nie ustawienie konta,
 * więc leży w localStorage. Przeglądarka z zablokowanym zapisem (tryb
 * prywatny, polityka firmy) trzyma wybór w pamięci do zamknięcia karty.
 *
 * useSyncExternalStore zamiast efektu: serwer i pierwsze malowanie dostają
 * motyw jasny, a po hydratacji React sam czyta zapisany wybór. Druga karta
 * z panelem przełącza się razem z pierwszą przez zdarzenie `storage`.
 */
export type Motyw = 'jasny' | 'ciemny'

const KLUCZ = 'sm_motyw_panelu'
const sluchacze = new Set<() => void>()
let wPamieci: Motyw | null = null

function odczytaj(): Motyw {
  try {
    const zapisany = localStorage.getItem(KLUCZ)
    if (zapisany === 'ciemny' || zapisany === 'jasny') return zapisany
  } catch {
    // Zapis zablokowany: zostaje wybór z pamięci.
  }
  return wPamieci ?? 'jasny'
}

function subskrybuj(powiadom: () => void) {
  sluchacze.add(powiadom)
  window.addEventListener('storage', powiadom)
  return () => {
    sluchacze.delete(powiadom)
    window.removeEventListener('storage', powiadom)
  }
}

export function useMotyw() {
  const motyw = useSyncExternalStore(subskrybuj, odczytaj, () => 'jasny' as Motyw)

  const przelacz = useCallback(() => {
    const nowy: Motyw = odczytaj() === 'jasny' ? 'ciemny' : 'jasny'
    wPamieci = nowy
    try {
      localStorage.setItem(KLUCZ, nowy)
    } catch {
      // Bez zapisu motyw działa do zamknięcia karty.
    }
    sluchacze.forEach((powiadom) => powiadom())
  }, [])

  return { motyw, przelacz }
}
