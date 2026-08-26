/**
 * Dostep do panelu: logowanie, ochrona tras, wygasniecie sesji.
 *
 * Kategoria ryzyka: DOSTEP. Testy jednostkowe sprawdzaja `lib/api.ts` w
 * izolacji; tutaj chodzi o to, czy calosc -- formularz, zapis tokenu,
 * przekierowanie App Routera i straznik trasy -- naprawde sie ze soba
 * spina w przegladarce.
 */
import { expect, test } from '@playwright/test'
import { KONTO, podstawBackend, zalogowany } from './atrapa'

test('poprawne dane logowania prowadza do panelu i zapisuja token', async ({ page }) => {
  await podstawBackend(page)
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('wlascicielka@rowerownia.pl')
  await page.getByLabel('Hasło').fill('tajne-haslo')
  await page.getByRole('button', { name: /Zaloguj/i }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(KONTO.access)
})

test('bledne dane nie wpuszczaja i nie zostawiaja tokenu', async ({ page }) => {
  // Zapisany token przy nieudanym logowaniu to najgorszy z mozliwych
  // stanow: panel wyglada na otwarty, a kazde zapytanie wraca z 401.
  await podstawBackend(page, { '/accounts/login/': { status: 401, body: { detail: 'brak' } } })
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('nie@istnieje.pl')
  await page.getByLabel('Hasło').fill('zle')
  await page.getByRole('button', { name: /Zaloguj/i }).click()

  await expect(page.getByText(/Nieprawidłowy e-mail lub hasło/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
})

test('panel bez tokenu odsyla do logowania', async ({ page }) => {
  await podstawBackend(page)

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
})

test('wygasla sesja wyrzuca z panelu i czysci oba tokeny', async ({ page }) => {
  // Token zostawiony po wygasnieciu wedruje z kazdym kolejnym zapytaniem
  // i trzyma uzytkownika w petli pustych ekranow bez wyjasnienia.
  await zalogowany(page)
  await podstawBackend(page, { '/accounts/me/': { status: 401, body: { detail: 'wygasl' } } })

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('refresh_token'))).toBeNull()
})
