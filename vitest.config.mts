/**
 * Vitest — testy logiki komponentów i funkcji czystych.
 *
 * Playwright ma własny plik konfiguracyjny i własny katalog (`e2e/`), bo to
 * zupełnie inny rodzaj testu: uruchamia prawdziwą przeglądarkę przeciwko
 * działającej aplikacji. Trzymanie obu w jednym runnerze kończy się tym, że
 * `npm test` czasem wymaga stojącego serwera, a czasem nie.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Ten sam alias co w tsconfig.json — bez niego importy `@/lib/api`
      // w testach nie rozwiązują się.
      '@': import.meta.dirname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    // e2e należy do Playwrighta, nie tutaj
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
})
