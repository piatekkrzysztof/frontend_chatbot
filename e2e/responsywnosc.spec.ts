/**
 * Uklad kluczowych ekranow w prawdziwej przegladarce.
 *
 * To jedyna warstwa, ktorej Vitest sprawdzic nie moze: jsdom nie ma silnika
 * ukladu, wiec kazdy element ma tam rozmiar 0x0. Pytania o przewijanie w bok
 * i o wielkosc celow wskaznika daja sie zadac wylacznie tutaj.
 *
 * Test mierzy KAZDY widoczny element interaktywny na kazdym ekranie. Jest to
 * swiadoma zamiana za liste selektorow w CSS, ktora wczesniej pilnowala tego
 * progu i zgnila -- przyciski dodane pozniej po cichu spod niej wypadly,
 * bo nikt nie aktualizowal listy. Pomiar nie wymaga aktualizacji.
 */
import { expect, test } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

const EKRANY = ['/login', '/dashboard', '/faq', '/subskrypcja']

/** WCAG 2.2 AA, kryterium 2.5.8 -- minimum na kazdym wskazniku, nie tylko dotyku. */
const MINIMALNY_CEL = 24

const WIDOKI = [
  { nazwa: 'telefon', width: 360, height: 780 },
  { nazwa: 'tablet', width: 768, height: 1024 },
  { nazwa: 'desktop', width: 1440, height: 900 },
]

type Cel = { opis: string; szerokosc: number; wysokosc: number }

async function zmierz(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const dokument = document.documentElement
    const cele: Cel[] = []
    const wybor = 'a, button, input:not([type=hidden]), select, textarea, [role="button"]'

    for (const element of document.querySelectorAll(wybor)) {
      const prostokat = element.getBoundingClientRect()
      // Elementy zwiniete do zera sa ukryte -- nie ma czego mierzyc.
      if (prostokat.width === 0 || prostokat.height === 0) continue
      if (getComputedStyle(element).visibility === 'hidden') continue

      const nazwa =
        element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 30)
      cele.push({
        opis: `<${element.tagName.toLowerCase()}> "${nazwa}"`,
        szerokosc: prostokat.width,
        wysokosc: prostokat.height,
      })
    }

    return {
      nadmiarPoziomy: dokument.scrollWidth - dokument.clientWidth,
      cele,
    }
  })
}

for (const widok of WIDOKI) {
  test.describe(widok.nazwa, () => {
    test.use({ viewport: { width: widok.width, height: widok.height } })

    for (const ekran of EKRANY) {
      test(`${ekran} miesci sie w szerokosci i ma dosc duze cele`, async ({ page }) => {
        await zalogowany(page)
        await podstawBackend(page)
        await page.goto(ekran)
        // Panel dociaga dane, zanim ustali ostateczna wysokosc wierszy.
        await page.waitForLoadState('networkidle')

        const { nadmiarPoziomy, cele } = await zmierz(page)

        // Przewijanie w bok na telefonie to nie kosmetyka: tresc ucieka poza
        // ekran, a gest przewijania zaczyna walczyc z gestem nawigacji.
        expect(
          nadmiarPoziomy,
          `${ekran} przy ${widok.width}px wystaje poza ekran o ${nadmiarPoziomy}px`,
        ).toBeLessThanOrEqual(1)

        const zaMale = cele.filter(
          (cel) => cel.szerokosc < MINIMALNY_CEL || cel.wysokosc < MINIMALNY_CEL,
        )
        expect(
          zaMale.map((c) => `${c.opis} ${c.szerokosc.toFixed(1)}x${c.wysokosc.toFixed(1)}`),
          `cele ponizej ${MINIMALNY_CEL}px na ${ekran} przy ${widok.width}px`,
        ).toEqual([])

        // Sam ekran musi tez cos pokazac -- pusta strona przeszlaby
        // oba pomiary wyzej bez zadnego trudu.
        expect(cele.length).toBeGreaterThan(0)
      })
    }
  })
}
