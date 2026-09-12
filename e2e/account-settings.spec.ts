import { expect, test } from '@playwright/test'
import { podstawBackend, TEST_SESSION_ID, TOKEN_DOSTEPU, zalogowany } from './atrapa'

const otherId = '22222222-2222-4222-8222-222222222222'
const sessions = {
  count: 2, next: null, previous: null, mfa_enabled: true,
  results: [
    { id: TEST_SESSION_ID, created_at: '2026-09-12T09:00:00Z', expires_at: '2026-09-26T09:00:00Z', current: true },
    { id: otherId, created_at: '2026-09-11T09:00:00Z', expires_at: '2026-09-25T09:00:00Z', current: false },
  ],
}

test('mobile password change confirms MFA and clears both tabs without a logout request', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page, { '/accounts/sessions/': { status: 200, body: sessions } })
  const other = await context.newPage()
  await podstawBackend(other)
  await other.goto('/dashboard')
  await expect(other.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
  let writes = 0
  let logouts = 0
  page.on('request', request => { if (request.url().endsWith('/accounts/logout/')) logouts++ })
  await page.route('**/api/accounts/password-change/', async route => {
    writes++
    expect(route.request().postDataJSON()).toEqual({ current_password: 'Old!Password739', new_password: 'New!Password739', kod: '123456' })
    expect(route.request().headers().referer).toBeUndefined()
    await route.fulfill({ json: { detail: 'Hasło zmienione.', current_session_revoked: true } })
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/ustawienia')
  await page.getByRole('button', { name: 'Zmień hasło konta' }).click()
  await page.getByLabel('Aktualne hasło konta', { exact: true }).fill('Old!Password739')
  await page.getByLabel('Nowe hasło konta', { exact: true }).fill('New!Password739')
  await page.getByLabel('Powtórz nowe hasło konta', { exact: true }).fill('New!Password739')
  await page.getByLabel('Kod MFA lub kod zapasowy').fill('123456')
  expect(writes).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('section[aria-labelledby="account-security-title"]').screenshot({ path: '../stage4h-settings-mobile.png' })
  await page.getByRole('button', { name: 'Zmień hasło i wyloguj' }).click()
  await expect(page).toHaveURL(/\/login\?wygasla=1&powod=haslo/)
  await expect(page.getByRole('status')).toContainText('Hasło zmienione')
  await expect(other).toHaveURL(/\/login\?wygasla=1/)
  expect(writes).toBe(1)
  expect(logouts).toBe(0)
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))
  expect(storage).not.toContain(TOKEN_DOSTEPU)
  expect(storage).not.toContain('Old!Password739')
})

test('remote session confirmation is cancellable and preserves current session', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  let current = sessions
  let writes = 0
  await page.route('**/api/accounts/sessions/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: current })
    writes++
    expect(route.request().url()).toContain(otherId)
    current = { ...sessions, count: 1, results: sessions.results.slice(0, 1) }
    await route.fulfill({ json: { detail: 'Sesja zakończona.', current_session_revoked: false } })
  })
  await page.goto('/ustawienia')
  await page.getByRole('button', { name: /Zakończ sesję z/ }).click()
  await page.getByLabel('Aktualne hasło konta', { exact: true }).fill('Old!Password739')
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click()
  expect(writes).toBe(0)
  await page.getByRole('button', { name: /Zakończ sesję z/ }).click()
  await expect(page.getByLabel('Aktualne hasło konta', { exact: true })).toHaveValue('')
  await page.getByLabel('Aktualne hasło konta', { exact: true }).fill('Old!Password739')
  await page.getByLabel('Kod MFA lub kod zapasowy').fill('123456')
  await page.getByRole('button', { name: 'Potwierdź zakończenie sesji' }).click()
  await expect(page.getByText('Aktywne sesje (1)')).toBeVisible()
  await expect(page).toHaveURL(/\/ustawienia$/)
  expect(writes).toBe(1)
  await page.locator('section[aria-labelledby="account-security-title"]').screenshot({ path: '../stage4h-sessions-desktop.png' })
})

test('failed security reads remain unknown and retry restores controls', async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page, { '/accounts/2fa/': { status: 503 } })
  let attempts = 0
  await page.route('**/api/accounts/sessions/**', route => {
    attempts++
    return route.fulfill(attempts === 1 ? { status: 503, json: {} } : { json: sessions })
  })
  await page.goto('/ustawienia')
  await expect(page.getByText('Nie udało się sprawdzić stanu MFA. Ponów odczyt.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Włącz logowanie dwuetapowe' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zmień hasło konta' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ponów odczyt sesji' }).click()
  await expect(page.getByRole('button', { name: 'Zmień hasło konta' })).toBeVisible()
})
