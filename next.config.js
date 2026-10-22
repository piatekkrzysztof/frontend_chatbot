/** Ten sam adres API co w proxy.ts: jedyne miejsce, z którym widget rozmawia. */
const ZRODLO_API = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').origin
  } catch {
    return ''
  }
})()

/**
 * Polityka okna czatu (audyt 2026-10, A-07).
 *
 * Widget stoi pod tym samym adresem co panel, a renderuje treści z zewnątrz
 * (odpowiedzi bota, teksty klienta). Do audytu miał tylko frame-ancestors -
 * wstrzyknięty skrypt mógł stąd wysłać cokolwiek dokądkolwiek.
 *
 * Strona jest statyczna (własny układ w app/(widget)), więc nie ma nonce jak
 * panel: skrypty, które Next wpisuje w HTML, przechodzą przez 'unsafe-inline'.
 * Polityka nie zatrzyma więc skryptu wstrzykniętego w samą stronę. Zatrzymuje
 * skrypty z obcych adresów, eval, wtyczki i podmianę <base>, a connect-src
 * zamyka fetch na adres API. Pełna izolacja to osobna domena widgetu.
 *
 * img-src zostaje szerokie: logo i awatar klienta przychodzą z magazynu plików
 * pod domeną z konfiguracji backendu, której ten kod nie zna.
 */
function politykaWidgetu() {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${ZRODLO_API}`.trim(),
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // Widget jest z założenia osadzany w iframe na stronach klientów,
    // więc ramkowanie musi być dozwolone z dowolnej domeny.
    'frame-ancestors *',
  ].join('; ')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 dopisuje przy starcie AGENTS.md i CLAUDE.md do korzenia repo.
  // Nie utrzymujemy tych plików, więc niech się nie tworzą.
  agentRules: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  async headers() {
    return [
      {
        source: '/widget',
        headers: [
          { key: 'Content-Security-Policy', value: politykaWidgetu() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Zapytania do API niosą wtedy sam adres witryny, bez ?key=...
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Pelna polityke bezpieczenstwa panelu wystawia proxy.ts — musi
        // zawierac nonce, ktory powstaje osobno dla kazdego zadania, a tego
        // statyczny naglowek z konfiguracji nie potrafi. Dwa naglowki CSP
        // naraz obowiazywalyby jednoczesnie i wygrywalby ostrzejszy, wiec
        // frame-ancestors zostal tylko tam.
        source: '/:path((?!widget$).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
