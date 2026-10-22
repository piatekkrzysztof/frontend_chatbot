/**
 * Osobny układ okna czatu (audyt 2026-10, A-07, A-08, A-16).
 *
 * Kategoria ryzyka: KOSZT i BEZPIECZENSTWO. Widget otwiera się na stronach
 * wszystkich klientów. Pod układem panelu renderował się na serwerze przy
 * każdym otwarciu, ciągnął fonty i CSS panelu i miał tylko frame-ancestors.
 * Te testy pilnują, żeby nikt nie wpiął go z powrotem pod tamten układ -
 * i żeby panel przy okazji nie stracił nonce ani strony 404.
 */
import { expect, test } from '@playwright/test'

test('widget jest statyczny, bez krojów panelu i z własną polityką', async ({ request }) => {
  const odpowiedz = await request.get('/widget?key=klucz-testowy')
  const naglowki = odpowiedz.headers()
  const html = await odpowiedz.text()

  // Statyczny: CDN może go trzymać, zamiast renderować przy każdym otwarciu
  expect(naglowki['cache-control']).not.toContain('no-store')
  // Gambetta to kroje nagłówków panelu; widget nagłówków nie ma
  expect(html).not.toContain('Gambetta')

  const polityka = naglowki['content-security-policy']
  expect(polityka).toContain('frame-ancestors *')
  expect(polityka).toMatch(/connect-src 'self' https?:\/\/[^;\s]+(;|$)/)
  expect(polityka).toContain("object-src 'none'")
  expect(polityka).toContain("base-uri 'none'")
  expect(naglowki['x-content-type-options']).toBe('nosniff')
})

test('panel nadal renderuje się na żądanie, z nonce', async ({ request }) => {
  const naglowki = (await request.get('/login')).headers()

  expect(naglowki['content-security-policy']).toContain("'nonce-")
  expect(naglowki['cache-control']).toContain('no-store')
})

test('nieznany adres dostaje 404 w układzie panelu, bez zablokowanych skryptów', async ({ page }) => {
  const zablokowane: string[] = []
  page.on('console', (wpis) => {
    if (wpis.type() === 'error' && wpis.text().includes('Content Security Policy')) zablokowane.push(wpis.text())
  })

  const odpowiedz = await page.goto('/nie-ma-takiej-strony')

  expect(odpowiedz?.status()).toBe(404)
  await expect(page.getByText('This page could not be found.')).toBeVisible()
  // Układ panelu: <html> z klasami krojów, a nie goły dokument bez układu
  await expect(page.locator('html')).toHaveClass(/variable/)
  expect(zablokowane).toEqual([])
})
