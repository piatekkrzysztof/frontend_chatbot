import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

test.beforeEach(async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
})

test('odmowa serwera zachowuje dokument i umożliwia ponowienie', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/documents-upload/', async (route) => {
    attempts++
    await route.fulfill({
      status: attempts === 1 ? 503 : 201,
      contentType: 'application/json',
      body: JSON.stringify(attempts === 1
        ? { error: 'Trwa przetwarzanie innego pliku. Spróbuj za chwilę.' }
        : { message: 'Uploaded successfully.' }),
    })
  })
  await page.goto('/documents')
  const input = page.getByLabel('Wybierz dokument do wgrania')
  await input.setInputFiles({ name: 'oferta.txt', mimeType: 'text/plain', buffer: Buffer.from('Oferta 120 zł') })
  await page.getByRole('button', { name: 'Wgraj dokument' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Spróbuj za chwilę' })).toBeVisible()
  await expect(input).toHaveValue(/oferta.txt/)
  await page.getByRole('button', { name: 'Wgraj dokument' }).click()
  await expect(input).toHaveValue('')
  expect(attempts).toBe(2)
})

test('logo SVG zostaje odrzucone w formularzu', async ({ page }) => {
  await page.goto('/widget-settings')
  await page.getByRole('radio', { name: 'White-label — własna marka' }).check()
  await page.getByLabel('Logo', { exact: true }).setInputFiles({
    name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPEG lub WebP' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zapisz', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Logo', { exact: true })).toHaveAttribute('aria-invalid', 'true')
})

test('formularz dokumentów mieści się na telefonie', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/documents')
  await expect(page.getByLabel('Wybierz dokument do wgrania')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/uploads-mobile.png', fullPage: true })
})
