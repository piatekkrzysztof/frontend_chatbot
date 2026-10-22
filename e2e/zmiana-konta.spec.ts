/**
 * Zmiana konta w innej karcie (audyt 2026-10, znalezisko A-02) - w prawdziwym
 * Chrome, bo zdarzenie `storage` dochodzi tylko do INNYCH kart tej samej
 * przeglądarki, a pełnego przeładowania jsdom nie ma.
 *
 * Kategoria ryzyka: DANE MIĘDZY FIRMAMI. Karta z panelem firmy A nie może
 * zapisać formularza w firmie B tylko dlatego, że w drugiej karcie ktoś się
 * zalogował i ciasteczko odświeżania należy już do nowego logowania.
 */
import { expect, test, type Page } from '@playwright/test'
import { podstawBackend, TOKEN_DOSTEPU, zalogowany } from './atrapa'

/** Token innego logowania: ten sam kształt co TOKEN_DOSTEPU, inny `sid`. */
const TOKEN_INNEGO_LOGOWANIA = 'eyJhbGciOiJub25lIn0.'
  + Buffer.from(JSON.stringify({ sid: '22222222-2222-4222-8222-222222222222' })).toString('base64url')
  + '.synthetic'

/**
 * Znacznik w pamięci strony: znika tylko przy pełnym przeładowaniu dokumentu.
 * Oczekiwanie na ponowne `load` zapinamy PRZED akcją, która ma przeładować -
 * w obiekcie, bo zwrócona wprost obietnica wstrzymałaby `await oznacz()`.
 */
async function oznacz(page: Page) {
  await page.evaluate(() => { (window as unknown as { przedPrzeladowaniem?: true }).przedPrzeladowaniem = true })
  return { przeladowanie: page.waitForEvent('load') }
}

function oznaczona(page: Page) {
  return page.evaluate(() => Boolean((window as unknown as { przedPrzeladowaniem?: true }).przedPrzeladowaniem))
}

test('logowanie w drugiej karcie przeładowuje kartę z panelem', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/widget-settings')
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeEnabled()
  const { przeladowanie } = await oznacz(page)

  const druga = await context.newPage()
  await podstawBackend(druga, {
    '/accounts/login/': { status: 200, body: { access: TOKEN_INNEGO_LOGOWANIA } },
  })
  await druga.goto('/login?wygasla=1')
  await druga.getByLabel('E-mail').fill('serwis@rowerownia.pl')
  await druga.getByLabel('Hasło').fill('inne-haslo')
  await druga.getByRole('button', { name: 'Zaloguj się' }).click()
  await expect(druga).toHaveURL(/\/dashboard/)

  await przeladowanie
  expect(await oznaczona(page)).toBe(false)
  await expect(page).toHaveURL(/\/widget-settings$/)
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeEnabled()
})

test('zapis po wygaśnięciu tokenu nie leci na inne logowanie', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/widget-settings')
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeEnabled()
  const { przeladowanie } = await oznacz(page)

  // Ciasteczko należy już do innego logowania; token karty właśnie wygasł
  const zapisyCudzymTokenem: string[] = []
  await page.route('**/api/widget-settings/mine/', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    if (route.request().headers().authorization === `Bearer ${TOKEN_DOSTEPU}`) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    }
    zapisyCudzymTokenem.push(route.request().headers().authorization ?? '')
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/api/accounts/token/refresh/', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ access: TOKEN_INNEGO_LOGOWANIA }),
  }))

  await page.getByRole('button', { name: 'Zapisz' }).click()

  await przeladowanie
  expect(await oznaczona(page)).toBe(false)
  expect(zapisyCudzymTokenem).toEqual([])
  // Po przeładowaniu panel wstaje na nowym logowaniu, nie na ekranie logowania
  await expect(page).toHaveURL(/\/widget-settings$/)
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeEnabled()
})
