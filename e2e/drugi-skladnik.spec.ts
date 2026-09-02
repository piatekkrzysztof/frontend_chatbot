/**
 * Konfiguracja logowania dwuetapowego w panelu.
 *
 * Kategoria ryzyka: ZAMKNIECIE SIE NA ZEWNATRZ. To najbardziej wieloetapowy
 * przeplyw w calym panelu i jedyny, w ktorym pomylka konczy sie utrata dostepu
 * do wlasnego konta. Kody zapasowe pokazujemy JEDEN raz - jesli ekran ich nie
 * pokaze albo pokaze za wczesnie, klient zostaje z wlaczona ochrona i bez
 * drogi powrotu.
 *
 * Testy przegladarkowe, nie jednostkowe, bo chodzi o kolejnosc ekranow
 * i o to, czy kod QR w ogole sie narysowal.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

test.beforeEach(async ({ page, context }) => {
  await zalogowany(context)
  await podstawBackend(page)
  await page.goto('/ustawienia')
  await page.locator('h1').first().waitFor({ state: 'visible' })
})

test('konfiguracja pokazuje kod QR i klucz do przepisania', async ({ page }) => {
  await page.getByRole('button', { name: /Włącz logowanie dwuetapowe/i }).click()

  // Kod QR rysuje przegladarka z adresu otpauth. Gdyby biblioteka zawiodla,
  // obrazek by nie powstal, a instrukcja "zeskanuj kod ponizej" wskazywalaby
  // na puste miejsce.
  await expect(page.getByRole('img', { name: /Kod QR/i })).toBeVisible()

  // Nie kazdy moze zeskanowac - czesc osob konfiguruje aplikacje na tym samym
  // urzadzeniu, na ktorym otwarty jest panel.
  await page.getByText(/Nie mogę zeskanować kodu/i).click()
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible()
})

test('kody zapasowe pokazuja sie po potwierdzeniu, z ostrzezeniem', async ({ page }) => {
  await page.getByRole('button', { name: /Włącz logowanie dwuetapowe/i }).click()
  await page.getByLabel('Kod z aplikacji').fill('123456')
  await page.getByRole('button', { name: /Potwierdź i włącz/i }).click()

  await expect(page.getByText('A1B2C3D4-E5F6A7B8')).toBeVisible()
  // Bez tego zdania czesc osob zamknie karte przekonana, ze kody sa
  // do odczytania pozniej w ustawieniach.
  await expect(page.getByText(/Pokazujemy je wyłącznie teraz/i)).toBeVisible()
})

test('kody zapasowe NIE pokazuja sie przed potwierdzeniem', async ({ page }) => {
  // Pokazane za wczesnie znaczylyby, ze klient zapisuje kody do ochrony,
  // ktorej jeszcze nie ma - i ktora moze sie nie wlaczyc.
  await page.getByRole('button', { name: /Włącz logowanie dwuetapowe/i }).click()

  await expect(page.getByText(/Zapisz kody zapasowe/i)).toHaveCount(0)
})
