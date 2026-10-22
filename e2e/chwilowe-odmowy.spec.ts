/**
 * Chwilowe odmowy przy logowaniu i odświeżaniu (audyt 2026-10, A-04 i A-05),
 * w prawdziwym Chrome: middleware, przekierowania i nagłówek Retry-After
 * czytany z odpowiedzi innego originu.
 *
 * Kategoria ryzyka: DOSTEP. Limit 10 zapytań na minutę z adresu dzielą
 * logowanie i odświeżanie. Przekroczony nie może wyglądać ani jak wygasła
 * sesja, ani jak złe hasło.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

test('chwilowa odmowa odświeżenia przy wejściu: ponowienie zamiast ekranu logowania', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  let odmowy = 1
  await page.route('**/api/accounts/token/refresh/', (route) => (odmowy-- > 0
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    : route.fallback()))

  await page.goto('/dashboard')

  // Next ma własny, pusty komunikat z rolą alert (ogłaszanie tras)
  await expect(page.getByRole('alert').filter({ hasText: 'nadal jesteś zalogowany' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click()

  await expect(page.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('limit prób logowania mówi, ile poczekać, a nie że hasło jest złe', async ({ page }) => {
  await podstawBackend(page)
  await page.route('**/api/accounts/login/', (route) => route.fulfill({
    status: 429,
    contentType: 'application/json',
    headers: { 'Retry-After': '120', 'Access-Control-Expose-Headers': 'Retry-After' },
    body: JSON.stringify({ detail: 'Request was throttled.' }),
  }))
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('wlascicielka@rowerownia.pl')
  await page.getByLabel('Hasło').fill('tajne-haslo')
  await page.getByRole('button', { name: 'Zaloguj się' }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'Za dużo prób' }))
    .toHaveText('Za dużo prób logowania. Spróbuj ponownie za 2 min.')
  await expect(page).toHaveURL(/\/login$/)
})
