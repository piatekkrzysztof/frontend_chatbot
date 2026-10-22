'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

/** Pola /accounts/me/, z których korzysta panel. */
export interface Ja {
  id?: number
  role?: string
  tenant_name?: string
  tenant_api_key?: string
}

export interface StanJa {
  ja: Ja | null
  /** Odczyt się nie udał - ekran pokazuje to, co pokazywał bez tych danych */
  blad: boolean
}

const KontekstJa = createContext<StanJa | null>(null)

function usePobierzJa(wlaczone: boolean): StanJa {
  const [stan, setStan] = useState<StanJa>({ ja: null, blad: false })

  useEffect(() => {
    if (!wlaczone) return
    let aktywne = true
    apiFetch('/accounts/me/')
      .then((dane) => {
        if (aktywne) setStan({ ja: dane as Ja, blad: false })
      })
      .catch(() => {
        if (aktywne) setStan({ ja: null, blad: true })
      })
    return () => {
      aktywne = false
    }
  }, [wlaczone])

  return stan
}

/**
 * Zalogowana osoba, pobrana raz na cały panel.
 *
 * Pasek górny i ekrany (Konwersacje, Zespół, Ustawienia widgetu) pytały
 * o /accounts/me/ każdy osobno, więc wejście na ekran dawało dwa takie same
 * zapytania (audyt 2026-10, A-18). Dane odświeża przeładowanie strony -
 * także zmiana konta w innej karcie (lib/auth.ts).
 */
export function JaProvider({ children }: { children: ReactNode }) {
  const stan = usePobierzJa(true)
  return <KontekstJa.Provider value={stan}>{children}</KontekstJa.Provider>
}

/**
 * Dane zalogowanej osoby: z JaProvider, a poza nim (ekran wyrenderowany sam,
 * np. w teście) pobrane przez hook.
 */
export function useJa(): StanJa {
  const zKontekstu = useContext(KontekstJa)
  const wlasne = usePobierzJa(zKontekstu === null)
  return zKontekstu ?? wlasne
}
