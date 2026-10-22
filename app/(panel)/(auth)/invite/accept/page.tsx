import PrzyjecieZaproszenia from '@/components/auth/PrzyjecieZaproszenia'

/**
 * Link z maila z zaproszeniem: `/invite/accept#token=<klucz>` (audyt 2026-10, A-26).
 *
 * Fragmentu przeglądarka nie wysyła, więc klucz przyjęcia nie trafia do logów
 * zapytań hostingu - w odróżnieniu od starego `/invite/accept/<klucz>`.
 */
export default function PrzyjmijZaproszeniePage() {
  return <PrzyjecieZaproszenia />
}
