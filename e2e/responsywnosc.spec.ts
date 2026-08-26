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
import { expect, test, type Page } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

/** Ekrany panelu -- wymagaja sesji. */
const EKRANY_PANELU = ['/dashboard', '/faq', '/subskrypcja']

/** Ekrany dostepne bez konta. Zalogowanego middleware odeslaloby stad do panelu. */
const EKRANY_PUBLICZNE = ['/login']

/** WCAG 2.2 AA, kryterium 2.5.8 -- minimum na kazdym wskazniku, nie tylko dotyku. */
const MINIMALNY_CEL = 24

const WIDOKI = [
  { nazwa: 'telefon', width: 360, height: 780 },
  { nazwa: 'tablet', width: 768, height: 1024 },
  { nazwa: 'desktop', width: 1440, height: 900 },
]

type Cel = { opis: string; szerokosc: number; wysokosc: number }

async function zmierz(page: Page) {
  return page.evaluate(() => {
    const dokument = document.documentElement
    const cele: Cel[] = []
    const wybor = 'a, button, input:not([type=hidden]), select, textarea, [role="button"]'

    for (const element of document.querySelectorAll(wybor)) {
      // Pole wyboru opakowane etykieta nie jest osobnym celem: klikniecie
      // w etykiete tez je przelacza, wiec obszarem, ktory uzytkownik trafia,
      // jest CALA etykieta. Mierzenie samego pola (13x13 px w kazdej
      // przegladarce) zglaszalo by blad tam, gdzie realny cel ma 24 px --
      // i kazaloby "naprawiac" go przez rozdmuchanie kwadracika.
      const etykieta = element.closest('label')
      const mierzony = etykieta && element.tagName === 'INPUT' ? etykieta : element

      const prostokat = mierzony.getBoundingClientRect()
      // Elementy zwiniete do zera sa ukryte -- nie ma czego mierzyc.
      if (prostokat.width === 0 || prostokat.height === 0) continue
      if (getComputedStyle(mierzony).visibility === 'hidden') continue

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

async function sprawdzEkran(page: Page, ekran: string, szerokosc: number) {
  await page.goto(ekran)

  // Celowo NIE `networkidle`. To oczekiwanie konczy sie dopiero wtedy, gdy
  // przez pol sekundy nie leci zadne zapytanie -- a wystarczy jeden skrypt
  // w tle, ktory ponawia nieudane polaczenie, zeby nie skonczylo sie nigdy.
  // Trafilem na to wprost: antywirus wstrzykuje na strone wlasny skrypt,
  // polityka CSP blokuje jego polaczenia, a on probuje dalej. Test wisial
  // wtedy 30 sekund i konczyl sie przekroczeniem czasu, mimo ze strona
  // dawno byla gotowa.
  await page.waitForLoadState('load')
  // Naglowek pojawia sie dopiero, gdy panel odtworzy sesje i zamieni
  // ekran "Wczytywanie panelu..." na wlasciwa tresc.
  await page.locator('h1').first().waitFor({ state: 'visible' })

  // Przekierowanie znaczyloby, ze mierzymy zupelnie inny ekran niz ten,
  // ktorego nazwa stoi w tytule testu -- i wynik nic by nie mowil.
  expect(new URL(page.url()).pathname, `${ekran} przekierowal gdzie indziej`).toBe(ekran)

  const { nadmiarPoziomy, cele } = await zmierz(page)

  // Przewijanie w bok na telefonie to nie kosmetyka: tresc ucieka poza
  // ekran, a gest przewijania zaczyna walczyc z gestem nawigacji.
  expect(
    nadmiarPoziomy,
    `${ekran} przy ${szerokosc}px wystaje poza ekran o ${nadmiarPoziomy}px`,
  ).toBeLessThanOrEqual(1)

  const zaMale = cele.filter((cel) => cel.szerokosc < MINIMALNY_CEL || cel.wysokosc < MINIMALNY_CEL)
  expect(
    zaMale.map((c) => `${c.opis} ${c.szerokosc.toFixed(1)}x${c.wysokosc.toFixed(1)}`),
    `cele ponizej ${MINIMALNY_CEL}px na ${ekran} przy ${szerokosc}px`,
  ).toEqual([])

  // Sam ekran musi tez cos pokazac -- pusta strona ani taka, ktora wywalila
  // sie w trakcie renderu, przeszlaby oba pomiary wyzej bez zadnego trudu.
  expect(cele.length, `${ekran} nie wyrenderowal zadnych elementow`).toBeGreaterThan(0)
}

for (const widok of WIDOKI) {
  test.describe(widok.nazwa, () => {
    test.use({ viewport: { width: widok.width, height: widok.height } })

    for (const ekran of EKRANY_PANELU) {
      test(`${ekran} miesci sie w szerokosci i ma dosc duze cele`, async ({ page, context }) => {
        await zalogowany(context)
        await podstawBackend(page)
        await sprawdzEkran(page, ekran, widok.width)
      })
    }

    for (const ekran of EKRANY_PUBLICZNE) {
      test(`${ekran} miesci sie w szerokosci i ma dosc duze cele`, async ({ page }) => {
        // Bez sesji -- zalogowanego middleware odeslaloby stad do panelu
        // i test mierzylby pulpit pod nazwa ekranu logowania.
        await podstawBackend(page)
        await sprawdzEkran(page, ekran, widok.width)
      })
    }
  })
}
