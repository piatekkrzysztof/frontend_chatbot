/**
 * Ekran dziennika zdarzen.
 *
 * Kategoria ryzyka: WIDOCZNOSC SLADU. Backend zapisywal te wpisy od dawna,
 * ale bez tego ekranu wlasciciel nie mial jak do nich zajrzec - czyli dziennik
 * istnial na papierze. Ekran, ktory pokazuje pierwsza strone i nie umie
 * przejsc dalej, cofa nas do tego samego stanu: widac ostatnie 50 zdarzen
 * i nic wczesniej.
 *
 * Ta sama tresc renderuje sie dwa razy - tabela dla szerokiego ekranu, karty
 * dla waskiego - wiec asercje celuja w konkretny wariant. Selektor po samym
 * tekscie trafialby w oba naraz, w tym w ten schowany, i przechodzilby nawet
 * wtedy, gdyby widoczny wariant byl pusty.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

test.beforeEach(async ({ context }) => {
  await zalogowany(context)
})

test('pokazuje wpisy przetlumaczone na jezyk polski', async ({ page }) => {
  await podstawBackend(page)
  await page.goto('/dziennik')

  await expect(page.getByRole('cell', { name: 'Wgranie dokumentu' })).toBeVisible()

  // Nieudane logowanie musi byc odroznialne od udanego, i to nie samym
  // kolorem - to jest wpis, dla ktorego ktokolwiek tu zaglada.
  await expect(page.getByRole('cell', { name: 'odmowa (401)' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'wykonano' }).first()).toBeVisible()
})

test('nieznana sciezka pokazuje sie surowo, zamiast zniknac', async ({ page }) => {
  await podstawBackend(page)
  await page.goto('/dziennik')

  // Atrapa podaje sciezke, ktorej panel nie zna. Gdyby ekran wypisywal dla
  // niej ogolnik, po wlamaniu zginelyby akurat te wpisy, ktorych nikt sie
  // nie spodziewal.
  await expect(
    page.getByRole('cell', { name: 'PATCH /api/cos-czego-panel-nie-zna/7/' }),
  ).toBeVisible()
})

test('stronicowanie faktycznie pobiera kolejna strone', async ({ page }) => {
  await podstawBackend(page)
  await page.goto('/dziennik')

  // "Nowsze" na pierwszej stronie nie ma dokad prowadzic.
  await expect(page.getByRole('button', { name: 'Nowsze' })).toBeDisabled()

  await page.getByRole('button', { name: 'Starsze' }).click()

  // Tresc z drugiej strony, ktorej na pierwszej nie ma - dowod, ze przycisk
  // wyslal numer strony, a nie tylko zmienil licznik na ekranie.
  await expect(page.getByRole('cell', { name: 'Eksport rozmów do pliku' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Wgranie dokumentu' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Starsze' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Nowsze' })).toBeEnabled()
})

test('pracownik dostaje wyjasnienie, nie komunikat o awarii', async ({ page }) => {
  await podstawBackend(page, {
    '/accounts/dziennik/': {
      status: 403,
      body: { detail: 'You do not have permission to perform this action.' },
    },
  })
  await page.goto('/dziennik')

  await expect(page.getByText(/wyłącznie właściciel konta/i)).toBeVisible()

  // Angielski komunikat DRF nie moze przeciekac na ekran: pracownik zaczalby
  // szukac usterki, ktorej nie ma.
  await expect(page.getByText(/permission/i)).toHaveCount(0)
})

test('pusty dziennik mowi, dlaczego jest pusty', async ({ page }) => {
  await podstawBackend(page, {
    '/accounts/dziennik/': {
      status: 200,
      body: { count: 0, next: null, previous: null, results: [] },
    },
  })
  await page.goto('/dziennik')

  await expect(page.getByText(/Dziennik jest pusty/i)).toBeVisible()
})

test.describe('na telefonie', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  })

  test('wpisy uklada sie w karty, a wynik zostaje widoczny', async ({ page }) => {
    await podstawBackend(page)
    await page.goto('/dziennik')

    // Tabela na 375 px znaczylaby poziome przewijanie, a poza ekran chowalaby
    // sie ostatnia kolumna - czyli wynik operacji.
    await expect(page.getByRole('table')).toBeHidden()

    const karta = page.locator('li').filter({ hasText: 'Wgranie dokumentu' })
    await expect(karta).toBeVisible()
    await expect(karta.getByText('wykonano')).toBeVisible()
  })
})
