'use client'

import { use } from 'react'
import PrzyjecieZaproszenia from '@/components/auth/PrzyjecieZaproszenia'

/**
 * Stary format linku z maila: klucz przyjęcia w ścieżce (audyt 2026-10, A-26).
 *
 * Ścieżka trafia do logów zapytań hostingu, a klucz zakłada konto, więc nowe
 * maile prowadzą na `/invite/accept#token=...`. Ta strona zostaje dla
 * zaproszeń wysłanych przed zmianą linku w backendzie. Zaproszenie żyje
 * najwyżej 7 dni, więc tydzień po tej zmianie strona i podgląd GET
 * w backendzie są do usunięcia.
 */
export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  return <PrzyjecieZaproszenia tokenZeSciezki={token} />
}
