import { expect, test } from '@playwright/test'

const token = 'abc123-' + 'a'.repeat(32)

test('reset on mobile: fragment privacy, validation and explicit confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  let changes = 0
  await page.route('**/api/accounts/password-reset/**', async route => {
    const request = route.request()
    expect(request.headers().referer).toBeUndefined()
    expect(request.url()).not.toContain(token)
    if (request.url().endsWith('/confirm/')) {
      changes++
      expect(request.postDataJSON()).toEqual({ uid: 'MQ', token, password: 'Reset!Phrase739' })
    }
    await route.fulfill({ json: { detail: 'OK' } })
  })
  const response = await page.goto('/reset-hasla#uid=MQ&token=' + token)
  expect(response?.headers()['cache-control']).toContain('no-store')
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  await expect(page.getByLabel('Nowe hasło', { exact: true })).toBeVisible()
  expect(changes).toBe(0)
  expect(page.url()).not.toContain(token)
  await page.getByLabel('Nowe hasło', { exact: true }).fill('Reset!Phrase739')
  await page.getByLabel('Powtórz nowe hasło', { exact: true }).fill('Reset!Phrase739')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '../stage4g-reset-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Zmień hasło', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hasło zmienione' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Przejdź do logowania' })).toHaveAttribute('href', '/login?wygasla=1')
  expect(changes).toBe(1)
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))
  expect(storage).not.toContain(token)
})

test('expired link provides email recovery and works with an old session marker', async ({ page, context }) => {
  await context.addCookies([{ name: 'sesja_panelu', value: '1', url: 'http://localhost:3100' }])
  await page.route('**/api/accounts/password-reset/preview/', route =>
    route.fulfill({ status: 400, json: { token: ['Link wygasł lub został użyty.'] } }))
  await page.route('**/api/accounts/password-reset/request/', route =>
    route.fulfill({ status: 202, json: { detail: 'OK' } }))
  await page.goto('/reset-hasla#uid=MQ&token=' + token)
  await expect(page.locator('#reset-error')).toContainText('Link wygasł')
  await page.getByLabel('Adres e-mail konta').fill('synthetic@example.test')
  await page.getByRole('button', { name: 'Wyślij link do zmiany hasła' }).click()
  await expect(page.getByRole('status')).toContainText('Jeśli konto może odzyskać dostęp')
  await page.screenshot({ path: '../stage4g-reset-expired.png', fullPage: true })
})

test('login exposes keyboard-accessible recovery and no sensitive caching', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Nie pamiętam hasła' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/odzyskaj-haslo$/)
  await expect(page.getByLabel('Adres e-mail konta')).toBeVisible()
  await page.screenshot({ path: '../stage4g-recovery-desktop.png', fullPage: true })
})
