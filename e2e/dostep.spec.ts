/**
 * Dostep do panelu: logowanie, ochrona tras, wygasniecie sesji, wylogowanie.
 *
 * Kategoria ryzyka: DOSTEP. Czesc tych zachowan da sie sprawdzic wylacznie
 * tutaj: middleware dziala po stronie serwera, ciasteczka HttpOnly sa dla
 * kodu strony niewidoczne, a "czy chroniona tresc mignela przed
 * przekierowaniem" to pytanie o prawdziwa nawigacje przegladarki.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, TOKEN_DOSTEPU, ZNACZNIK_SESJI, zalogowany } from './atrapa'

test('poprawne dane logowania prowadza do panelu', async ({ page }) => {
  await podstawBackend(page)
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('wlascicielka@rowerownia.pl')
  await page.getByLabel('Hasło').fill('tajne-haslo')
  await page.getByRole('button', { name: /Zaloguj/i }).click()

  await expect(page).toHaveURL(/\/dashboard/)
})

test('logowanie nie zostawia tokenu w localStorage', async ({ page }) => {
  // Cala istota przebudowy. Token w localStorage czyta dowolny skrypt
  // dzialajacy na stronie i przezywa zamkniecie karty.
  await podstawBackend(page)
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('wlascicielka@rowerownia.pl')
  await page.getByLabel('Hasło').fill('tajne-haslo')
  await page.getByRole('button', { name: /Zaloguj/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  const magazyn = await page.evaluate(() => JSON.stringify(localStorage))
  expect(magazyn).not.toContain(TOKEN_DOSTEPU)
  expect(magazyn).not.toContain('refresh')
})

test('token odswiezania jest niewidoczny dla skryptow strony', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/dashboard')

  const widoczne = await page.evaluate(() => document.cookie)

  // Znacznik sesji tez jest HttpOnly -- nie niesie sekretu, ale nie ma
  // powodu, zeby skrypt mial go czytac.
  expect(widoczne).not.toContain(ZNACZNIK_SESJI)
  expect(widoczne).not.toContain('refresh')
})

test('bledne dane nie wpuszczaja do panelu', async ({ page }) => {
  await podstawBackend(page, { '/accounts/login/': { status: 401, body: { detail: 'brak' } } })
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('nie@istnieje.pl')
  await page.getByLabel('Hasło').fill('zle')
  await page.getByRole('button', { name: /Zaloguj/i }).click()

  await expect(page.getByText(/Nieprawidłowy e-mail lub hasło/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('panel bez sesji odsyla do logowania JUZ NA SERWERZE', async ({ page }) => {
  // Najwazniejszy test w tym pliku. Wczesniej decydowal o tym efekt
  // w komponencie, wiec szkielet panelu zdazyl sie wyrenderowac, zanim
  // przegladarka przekierowala. Teraz odpowiada middleware -- do przegladarki
  // nie dochodzi nawet dokument panelu.
  await podstawBackend(page)

  const odpowiedz = await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
  // Pojedyncze zadanie sieciowe zakonczone przekierowaniem, a nie strona
  // panelu, ktora dopiero potem sie rozmyslila.
  expect(odpowiedz?.request().redirectedFrom()).not.toBeNull()
})

test('przekierowanie zapamietuje, dokad uzytkownik zmierzal', async ({ page }) => {
  // Bez tego kazdy link do konkretnego ekranu wyslany zespolowi konczy sie
  // na pulpicie i trzeba szukac reczne.
  await podstawBackend(page)

  await page.goto('/faq')

  await expect(page).toHaveURL(/powrot=%2Ffaq/)
})

test('zalogowany nie oglada ekranu logowania', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)

  await page.goto('/login')

  await expect(page).toHaveURL(/\/dashboard/)
})

test('wygasla sesja wyrzuca z panelu', async ({ page, context }) => {
  // Znacznik sesji jeszcze lezy w przegladarce, wiec middleware przepuszcza --
  // ale ciasteczko odswiezania juz nie dziala. Panel musi to wychwycic
  // i odeslac do logowania, zamiast zostawic pusty ekran bez wyjasnienia.
  await zalogowany(context)
  await podstawBackend(page, {
    '/accounts/token/refresh/': { status: 401, body: { detail: 'wygasl' } },
  })

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
})

test('wylogowanie pyta backend, a nie tylko przekierowuje', async ({ page, context }) => {
  // Samo przejscie na /login zostawiloby dzialajaca sesje na kolejne dwa
  // tygodnie: token odswiezania zyje po stronie serwera i tylko serwer
  // moze go uniewaznic.
  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/dashboard')

  const wylogowanie = page.waitForRequest(
    (zadanie) =>
      zadanie.url().includes('/accounts/logout/') && zadanie.method() === 'POST',
  )
  await page.getByRole('button', { name: /Wyloguj/i }).click()

  await wylogowanie
  await expect(page).toHaveURL(/\/login/)
})
