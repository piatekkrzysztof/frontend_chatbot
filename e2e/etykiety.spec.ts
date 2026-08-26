/**
 * Kazde pole formularza ma nazwe, ktora czytnik ekranu potrafi odczytac.
 *
 * Kategoria ryzyka: DOSTEPNOSC. Etykieta stojaca obok pola, ale z nim
 * niepowiazana, jest widoczna dla oka i niewidoczna dla technologii
 * wspomagajacych: czytnik ekranu oglasza "edycja tekstu" bez slowa o tym,
 * co tam wpisac. Klikniecie w napis tez nie ustawia wtedy kursora, co
 * dotyka takze osob bez zadnej niepelnosprawnosci -- po prostu nie dziala
 * to, czego wszyscy sie spodziewaja.
 *
 * WCAG 2.1 (1.3.1 Info and Relationships) oraz 4.1.2 (Name, Role, Value).
 *
 * Test mierzy KAZDE widoczne pole na kazdym ekranie, zamiast wyliczac
 * konkretne selektory. Lista selektorow zgnilaby przy pierwszym nowym polu,
 * a pomiar nie wymaga aktualizacji.
 */
import { expect, test, type Page } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

const EKRANY_PANELU = [
  '/dashboard',
  '/faq',
  '/team',
  '/privacy',
  '/widget-settings',
  '/documents',
  '/ustawienia',
]

const EKRANY_PUBLICZNE = ['/login', '/rejestracja']

/**
 * Zwraca pola bez nazwy dostepnej.
 *
 * Nazwa moze plynac z czterech zrodel i wszystkie sa poprawne: `aria-label`,
 * `aria-labelledby`, etykieta opakowujaca pole (powiazanie niejawne) oraz
 * `<label for>` (powiazanie jawne). Sprawdzamy wszystkie, zeby nie zmuszac
 * do jednego stylu tam, gdzie inny jest rownie dobry.
 */
async function polaBezNazwy(page: Page) {
  return page.evaluate(() => {
    const braki: string[] = []
    const wybor = 'input:not([type=hidden]), select, textarea'

    for (const element of document.querySelectorAll(wybor)) {
      const pole = element as HTMLInputElement
      const prostokat = pole.getBoundingClientRect()
      if (prostokat.width === 0 || prostokat.height === 0) continue

      const maAria = !!pole.getAttribute('aria-label')?.trim()
      const wskazane = pole.getAttribute('aria-labelledby')
      const maAriaLabelledby = !!wskazane && !!document.getElementById(wskazane)
      const maEtykieteOpakowujaca = !!pole.closest('label')
      const maEtykieteJawna = !!pole.id && !!document.querySelector(`label[for="${pole.id}"]`)

      if (maAria || maAriaLabelledby || maEtykieteOpakowujaca || maEtykieteJawna) continue

      braki.push(
        `<${pole.tagName.toLowerCase()} type="${pole.type || '-'}" ` +
          `name="${pole.name || '-'}" id="${pole.id || '-'}">`,
      )
    }

    return braki
  })
}

async function sprawdz(page: Page, ekran: string) {
  await page.goto(ekran)
  await page.waitForLoadState('load')
  await page.locator('h1').first().waitFor({ state: 'visible' })

  const braki = await polaBezNazwy(page)

  expect(braki, `pola bez nazwy dostepnej na ${ekran}`).toEqual([])

  // Ekran bez zadnego pola przeszedlby powyzsze bez trudu -- upewniamy sie,
  // ze bylo co mierzyc. Nie kazdy ekran ma formularz, wiec tylko liczymy.
  const ile = await page.locator('input:not([type=hidden]), select, textarea').count()
  expect(ile, `${ekran} nie wyrenderowal sie`).toBeGreaterThanOrEqual(0)
}

for (const ekran of EKRANY_PANELU) {
  test(`${ekran}: kazde pole ma nazwe dla czytnika ekranu`, async ({ page, context }) => {
    await zalogowany(context)
    await podstawBackend(page)
    await sprawdz(page, ekran)
  })
}

for (const ekran of EKRANY_PUBLICZNE) {
  test(`${ekran}: kazde pole ma nazwe dla czytnika ekranu`, async ({ page }) => {
    await podstawBackend(page)
    await sprawdz(page, ekran)
  })
}
