/**
 * Automatyczny przeglad dostepnosci (axe-core, WCAG 2.1 A i AA).
 *
 * Kategoria ryzyka: DOSTEPNOSC. Testy etykiet i celow dotykowych mierza dwie
 * konkretne rzeczy. axe sprawdza kilkadziesiat regul naraz: kontrast, nazwy
 * przyciskow i linkow, jezyk i tytul strony, dostep z klawiatury do
 * przewijanych blokow, poprawnosc ARIA. Kazdy ekran panelu, strony logowania
 * i rejestracji oraz okno widgetu, w motywie jasnym i ciemnym.
 *
 * Animacje wylaczone (prefers-reduced-motion), i to nie dla wygody. Panel
 * wjezdza elementami z przezroczystoscia; axe mierzyl kolor w polowie
 * animacji i zglaszal kontrast 1,58:1 tam, gdzie po jej koncu jest
 * poprawny. Pierwszy przebieg (9.10.2026) mial przez to 17 falszywych bledow
 * kontrastu na pulpicie i przyciskach.
 *
 * Znalezione i naprawione przy wprowadzeniu testu: blok z kodem osadzenia
 * widgetu bez dostepu z klawiatury (WCAG 2.1.1) i link w zdaniu na
 * rejestracji odroznialny tylko kolorem (1,32:1, WCAG 1.4.1).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Request } from '@playwright/test'
import { podstawBackend, zalogowany } from './atrapa'

const EKRANY_PANELU = [
  '/dashboard', '/documents', '/faq', '/conversations', '/leads', '/team', '/privacy',
  '/widget-settings', '/ustawienia', '/subskrypcja', '/stan', '/dziennik', '/test-bota',
]
const EKRANY_PUBLICZNE = ['/login', '/rejestracja', '/widget?key=klucz-testowy']
const REGULY = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Czeka, az ekran skonczy wczytywac dane: zadne zapytanie do API nie jest w toku
 * od 300 ms. Naglowek pojawia sie wczesniej niz dane, a przyciski „Zapisz”
 * sa do tego czasu wylaczone i polprzezroczyste. axe trafial czasem w chwile
 * przelaczenia i zglaszal kontrast przycisku, ktory po wczytaniu jest
 * poprawny - na /ustawienia 3 z 12 przebiegow (9.10.2026). `networkidle`
 * Playwrighta nie nadaje sie: czeka 500 ms bez ruchu na KAZDYM zasobie
 * i na ekranach z odpytywaniem nie konczy sie przed limitem.
 */
async function poWczytaniuDanych(page: Page) {
  let wToku = 0
  let ostatniRuch = Date.now()
  // Tylko API (atrapa z podstawBackend). Zasoby samego Next.js - prefetch
  // tras, strumienie RSC - potrafia nie zakonczyc sie wcale.
  const zApi = (zadanie: Request) => new URL(zadanie.url()).pathname.startsWith('/api/')
  const start = (zadanie: Request) => {
    if (!zApi(zadanie)) return
    wToku += 1
    ostatniRuch = Date.now()
  }
  const koniec = (zadanie: Request) => {
    if (!zApi(zadanie)) return
    wToku = Math.max(0, wToku - 1)
    ostatniRuch = Date.now()
  }
  page.on('request', start)
  page.on('requestfinished', koniec)
  page.on('requestfailed', koniec)
  return async () => {
    await expect
      .poll(() => wToku === 0 && Date.now() - ostatniRuch >= 300, { timeout: 10_000 })
      .toBe(true)
    page.off('request', start)
    page.off('requestfinished', koniec)
    page.off('requestfailed', koniec)
  }
}

for (const motyw of ['light', 'dark'] as const) {
  for (const ekran of [...EKRANY_PANELU, ...EKRANY_PUBLICZNE]) {
    test(`${ekran} (${motyw}): bez naruszen WCAG 2.1 AA`, async ({ page, context }) => {
      await page.emulateMedia({ colorScheme: motyw, reducedMotion: 'reduce' })
      if (EKRANY_PANELU.includes(ekran)) await zalogowany(context)
      await podstawBackend(page)
      const wczytane = await poWczytaniuDanych(page)
      await page.goto(ekran)
      await page.waitForLoadState('load')
      // Naglowek albo okno czatu - ekran bledu Next.js nie ma ani jednego,
      // wiec wywrotka strony nie przejdzie jako „brak naruszen”.
      await page.locator('h1, [role=region]').first().waitFor({ state: 'visible' })
      await wczytane()

      const wynik = await new AxeBuilder({ page }).withTags(REGULY).analyze()

      const naruszenia = wynik.violations.map(
        (v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
      )
      expect(naruszenia, `naruszenia dostepnosci na ${ekran} (${motyw})`).toEqual([])
      // Kontrola, ze bylo co sprawdzac: axe zawsze przechodzi kilkanascie regul.
      expect(wynik.passes.length).toBeGreaterThan(10)
    })
  }
}
