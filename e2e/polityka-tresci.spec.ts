/**
 * Polityka bezpieczenstwa tresci (CSP).
 *
 * Kategoria ryzyka: DOSTEP. Token dostepu zyje w pamieci karty, wiec skrypt
 * wykonany na stronie panelu moglby go odczytac. Ta polityka nie zatrzyma go
 * przed odczytem -- ma odebrac mu miejsce, do ktorego moglby go wyslac.
 *
 * Test sprawdza obie polowki: ze polityka jest obecna i ma wlasciwa tresc,
 * ORAZ ze aplikacja pod nia naprawde dziala. Sama obecnosc naglowka nic nie
 * znaczy, jesli panel sie pod nim nie uruchamia -- a wtedy nikt nie
 * zauwazyłby, ze polityka jest za ostra, dopoki nie zobaczylby bialej strony.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

test('panel dziala pod polityka, bez ani jednego naruszenia', async ({ page, context }) => {
  const naruszenia: string[] = []
  page.on('console', (wiadomosc) => {
    if (wiadomosc.text().includes('Content Security Policy')) {
      naruszenia.push(wiadomosc.text().slice(0, 160))
    }
  })

  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/dashboard')
  await page.waitForLoadState('load')

  expect(naruszenia).toEqual([])
  // Panel bez JavaScriptu tez nie zglasza naruszen, wiec sprawdzamy,
  // ze aplikacja faktycznie wstala.
  await expect(page.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
})

test('polityka odbiera miejsce, do ktorego dalo by sie wyslac token', async ({ page }) => {
  await podstawBackend(page)
  const odpowiedz = await page.goto('/login')
  const polityka = odpowiedz?.headers()['content-security-policy'] ?? ''

  // connect-src to najwazniejsza linia: nawet skrypt, ktoremu uda sie
  // wykonac, nie ma dokad wyslac tego, co przeczyta z pamieci.
  expect(polityka).toContain('connect-src')
  expect(polityka).not.toContain('connect-src *')

  // Formularz logowania nie ma prawa wyslac hasla pod obcy adres.
  expect(polityka).toContain("form-action 'self'")
  // Blokada przepisania adresu bazowego -- sztuczki, ktora zamienia
  // wzgledne adresy skryptow na cudze.
  expect(polityka).toContain("base-uri 'self'")
  expect(polityka).toContain("object-src 'none'")
  expect(polityka).toContain("frame-ancestors 'self'")
})

test('widget zostaje osadzalny na cudzej stronie', async ({ page }) => {
  // Panel blokuje ramkowanie, ale widget z zalozenia zyje w ramce na
  // stronie klienta. Gdyby polityka panelu objela i jego, kazdy osadzony
  // czat przestalby sie pokazywac -- i to u klientow, nie u nas.
  const odpowiedz = await page.goto('/widget?key=klucz-testowy')
  const polityka = odpowiedz?.headers()['content-security-policy'] ?? ''

  expect(polityka).toContain('frame-ancestors *')
  expect(polityka).not.toContain("frame-ancestors 'self'")
})

test('skrypty w tresci strony nie sa juz dozwolone hurtem', async ({ page }) => {
  /**
   * Sedno tej zmiany i jedyny test, ktory ja pilnuje.
   *
   * Wczesniej `script-src` mial 'unsafe-inline', czyli przegladarka wykonywala
   * KAZDY skrypt wpisany w tresc strony - lacznie z takim, ktory trafil tam
   * przez wstrzykniecie. Polityka blokowala wtedy wyniesienie tokenu, ale nie
   * jego odczyt.
   *
   * Teraz wykonuja sie wylacznie skrypty z nonce, ktory powstaje osobno dla
   * kazdego zadania. Wstrzyknietego napisu nie da sie nim opatrzyc, bo w chwili
   * wstrzykiwania jeszcze nie istnieje.
   *
   * Uwaga przy czytaniu wynikow lokalnie: oprogramowanie antywirusowe potrafi
   * dopisac do tego naglowka wlasny nonce i wlasne adresy. Test sprawdza wiec
   * BRAK 'unsafe-inline', a nie doslowna tresc naglowka - to pierwsze jest
   * odporne na takie dopiski, drugie nie.
   */
  await podstawBackend(page)
  const odpowiedz = await page.goto('/login')
  const polityka = odpowiedz?.headers()['content-security-policy'] ?? ''

  const skrypty = polityka
    .split(';')
    .map((czlon) => czlon.trim())
    .find((czlon) => czlon.startsWith('script-src'))

  expect(skrypty, 'brak dyrektywy script-src').toBeTruthy()
  expect(skrypty).not.toContain("'unsafe-inline'")
  expect(skrypty).toContain("'strict-dynamic'")
  expect(skrypty).toMatch(/'nonce-[^']+'/)
})
