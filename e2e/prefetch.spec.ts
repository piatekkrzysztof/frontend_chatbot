/**
 * Prefetch linków w menu i na pulpicie (audyt 2026-10, A-17).
 *
 * Kategoria ryzyka: KOSZT. Panel renderuje się na żądanie (nonce w układzie),
 * a nie ma loading.tsx, więc prefetch linku pobiera tylko drzewo trasy i pustą
 * skorupę strony - po kliknięciu i tak idzie pełne zapytanie o ekran. Do
 * audytu samo wejście na pulpit wysyłało w tle 18-21 takich zapytań. Każde to
 * proxy.ts i render na serwerze, a nawigacja nie była przez nie ani trochę
 * szybsza.
 */
import { expect, test, type Page } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

type Zapytanie = { sciezka: string; prefetch: boolean }

/** Zapytania routera o ekrany (RSC), w tle i po kliknięciu. */
function zbierajZapytaniaRsc(page: Page) {
  const zapytania: Zapytanie[] = []
  page.on('request', zapytanie => {
    const url = new URL(zapytanie.url())
    const naglowki = zapytanie.headers()
    if (naglowki['rsc'] !== '1' && !url.searchParams.has('_rsc')) return
    zapytania.push({ sciezka: url.pathname, prefetch: naglowki['next-router-prefetch'] === '1' })
  })
  return zapytania
}

async function wejdzNaPulpit(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await podstawBackend(page)
  await zalogowany(page.context())
  const zapytania = zbierajZapytaniaRsc(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('navigation', { name: 'Główna nawigacja panelu' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  // Router zleca prefetch widocznych linków w wolnej chwili przeglądarki
  await page.waitForTimeout(1500)
  return zapytania
}

test('wejście na pulpit nie pobiera w tle ekranów z menu ani z pulpitu', async ({ page }) => {
  const zapytania = await wejdzNaPulpit(page)

  expect(zapytania.filter(z => z.prefetch).map(z => z.sciezka)).toEqual([])
})

test('kliknięcie w menu przechodzi na ekran bez przeładowania, jednym zapytaniem', async ({ page }) => {
  const zapytania = await wejdzNaPulpit(page)
  await page.evaluate(() => { (window as unknown as { bezPrzeladowania: boolean }).bezPrzeladowania = true })
  zapytania.length = 0

  const menu = page.getByRole('navigation', { name: 'Główna nawigacja panelu' })
  await menu.getByRole('link', { name: 'FAQ', exact: true }).click()

  await expect(page).toHaveURL(/\/faq$/)
  await expect(menu.getByRole('link', { name: 'FAQ', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => (window as unknown as { bezPrzeladowania?: boolean }).bezPrzeladowania)).toBe(true)
  expect(zapytania.filter(z => !z.prefetch).map(z => z.sciezka)).toEqual(['/faq'])
})
