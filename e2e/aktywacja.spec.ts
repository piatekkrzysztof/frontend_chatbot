import { expect, test } from '@playwright/test'

const token = 'a'.repeat(43)

test('aktywacja na telefonie: prywatny token, hasło i świadome potwierdzenie', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  let activations = 0
  await page.route('**/api/accounts/registration/**', async route => {
    const request = route.request()
    expect(request.method()).toBe('POST')
    expect(request.headers().referer).toBeUndefined()
    if (request.url().endsWith('/preview/')) {
      expect(request.postDataJSON()).toEqual({ token })
      await route.fulfill({ json: { email: 'new@example.com', company_name: 'Firma testowa' } })
    } else {
      activations++
      expect(request.postDataJSON()).toEqual({ token, password: 'Test!Phrase729' })
      await route.fulfill({ status: 201, json: { use_trial: true } })
    }
  })
  const response = await page.goto('/potwierdz-email#token=' + token)
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  expect(response?.headers()['cache-control']).toContain('no-store')
  await expect(page.getByLabel('Hasło', { exact: true })).toBeVisible()
  expect(activations).toBe(0)
  expect(page.url()).not.toContain(token)
  await page.getByLabel('Hasło', { exact: true }).fill('Test!Phrase729')
  await page.getByLabel('Powtórz hasło').fill('Test!Phrase729')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '../stage4b-activation-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Potwierdź e-mail i załóż konto' }).click()
  await expect(page.getByRole('heading', { name: 'Konto gotowe' })).toBeVisible()
  expect(activations).toBe(1)
  await expect(page.getByRole('link', { name: 'Przejdź do logowania' })).toHaveAttribute('href', '/login')
})

test('wygasły link i ponowienie wiadomości są dostępne bez sesji', async ({ page }) => {
  await page.route('**/api/accounts/registration/preview/', route =>
    route.fulfill({ status: 400, json: { token: ['Expired'] } }))
  await page.route('**/api/accounts/registration/resend/', route =>
    route.fulfill({ status: 202, json: { detail: 'Accepted' } }))
  await page.goto('/potwierdz-email#token=' + token)
  await expect(page.getByRole('alert').filter({ hasText: 'Link wygasł' })).toBeVisible()
  await page.getByLabel('Adres e-mail do aktywacji').fill('new@example.com')
  await page.getByRole('button', { name: 'Wyślij nowy link' }).click()
  await expect(page.getByRole('status')).toContainText('Jeśli ten adres')
  await expect(page.getByRole('button', { name: /Wyślij ponownie za/ })).toBeDisabled()
})
