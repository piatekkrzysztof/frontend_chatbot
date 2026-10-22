import { notFound } from 'next/navigation'

/**
 * Nieznany adres trafia do układu panelu i tam dostaje 404.
 *
 * Od kiedy widget ma własny główny układ (app/(widget)), aplikacja nie ma
 * jednego układu nad wszystkim. Next renderował wtedy 404 bez żadnego układu,
 * statycznie: bez stylów panelu, a polityka bezpieczeństwa z proxy.ts
 * blokowała jego skrypty, bo statyczna strona nie ma nonce. Ta trasa łapie
 * każdy adres, którego nie ma, i woła notFound() już wewnątrz panelu - z jego
 * stylami, krojami i nonce, tak jak przed rozdzieleniem układów.
 *
 * Konkretne trasy (także /widget z drugiej grupy) mają pierwszeństwo przed
 * trasą łapiącą wszystko, więc niczego tu nie przesłaniamy.
 */
export default function NieznanyAdres() {
  notFound()
}
