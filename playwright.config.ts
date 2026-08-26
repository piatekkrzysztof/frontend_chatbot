/**
 * Playwright -- testy w prawdziwej przegladarce.
 *
 * Dwie swiadome decyzje, obie po to, zeby obcy developer mogl to uruchomic
 * bez przygotowan:
 *
 * 1. `channel: 'chrome'` -- uzywamy Chrome'a zainstalowanego w systemie
 *    zamiast sciagac ~300 MB przegladarek Playwrighta.
 * 2. Serwer to build produkcyjny, nie deweloperski. Serwer deweloperski
 *    kompiluje trasy na zadanie, wiec pierwsze wejscie na ekran potrafi
 *    przekroczyc limit oczekiwania -- wygladalo to na blad aplikacji, a bylo
 *    tylko kompilacja. Build zachowuje sie tez tak jak to, co dostaje
 *    uzytkownik: bez podwojnych efektow trybu scislego i nakladek dev.
 * 3. Backend jest zamockowany przez `page.route` w samych testach.
 *    Sprawdzamy tu warstwe, ktorej jsdom nie umie sprawdzic -- realny uklad
 *    strony, przewijanie, rozmiary celow dotykowych i nawigacje Next.js --
 *    a nie to, czy Django odpowiada. Od tego sa testy backendu.
 */
import { defineConfig, devices } from '@playwright/test'

// Celowo `localhost`, nie 127.0.0.1: serwer deweloperski Next.js nasluchuje
// pod ta nazwa i blokuje wlasne chunki jako zapytania cross-origin, gdy
// wejsc przez adres liczbowy. Strona wstaje wtedy bez JavaScriptu, wiec
// kazdy test przegladarkowy wyglada na blad aplikacji.
const ADRES = 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: ADRES,
    trace: 'on-first-retry',
  },
  // Domyslne 5 s wystarcza na gotowej stronie, ale nie na pierwsze wejscie
  // przy zimnym starcie serwera pod kilkoma workerami naraz.
  expect: { timeout: 10_000 },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    // Port inny niz domyslny 3000, zeby testy nie wpinaly sie w serwer
    // deweloperski, ktory ktos ma juz uruchomiony obok.
    command: 'npm run build && npm run start -- --port 3100',
    url: ADRES,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
