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
        // Panel klienta nie ma powodu działać w cudzej ramce — blokada
        // chroni zalogowanego użytkownika przed clickjackingiem.
        source: '/:path((?!widget$).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
