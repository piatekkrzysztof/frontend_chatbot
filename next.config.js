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
        // Widget jest z założenia osadzany w iframe na stronach klientów,
        // więc ramkowanie musi być dozwolone z dowolnej domeny.
        source: '/widget',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
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
