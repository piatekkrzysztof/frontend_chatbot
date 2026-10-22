/**
 * Znaleziska audytu z października 2026, które da się pokazać tylko
 * w prawdziwej przeglądarce (docs/audyt-2026-10.md).
 *
 * Jak w test/audyt-2026-10.test.tsx: `test.fail()` znaczy, że test opisuje
 * zachowanie docelowe i przechodzi, dopóki błąd istnieje. Poprawka zmieni go
 * na czerwony - wtedy zdjąć `test.fail()`.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { podstawBackend } from './atrapa'

// A-10 (/dziennik bez sesji) jest naprawione: trasę sprawdza e2e/dostep.spec.ts,
// a test/trasy.test.tsx pilnuje, że lista obejmuje każdy ekran panelu.

test.describe('embed.js na stronie klienta', () => {
  // Strona klienta na innym adresie niż panel - tak jak w rzeczywistości ramka
  // czatu jest osadzona między witrynami. Prawdziwy serwer na 127.0.0.1, bo
  // strona podstawiona przez page.route nie ma adresu i Chrome traktuje ją
  // jak publiczną, blokując ramkę z localhost (Local Network Access).
  let serwer: Server
  let stronaKlienta = ''

  test.beforeAll(async ({ baseURL }) => {
    serwer = createServer((_, odpowiedz) => {
      odpowiedz.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      odpowiedz.end(`<!doctype html><html lang="pl"><body><h1>Sklep rowerowy</h1>
        <script src="${baseURL}/embed.js" data-key="klucz-testowy"></script></body></html>`)
    })
    await new Promise<void>((gotowe) => serwer.listen(0, '127.0.0.1', gotowe))
    stronaKlienta = `http://127.0.0.1:${(serwer.address() as AddressInfo).port}/`
  })

  test.afterAll(async () => {
    await new Promise((gotowe) => serwer.close(gotowe))
  })

  test('Escape na stronie klienta zamyka okno czatu', async ({ page }) => {
    await podstawBackend(page)
    await page.goto(stronaKlienta)
    await page.getByRole('button', { name: 'Otwórz czat' }).click()
    const ramka = page.getByTitle('Okno czatu')
    await expect(ramka).toBeVisible()

    await page.getByRole('button', { name: 'Zamknij czat' }).focus()
    await page.keyboard.press('Escape')

    await expect(ramka).toBeHidden()
  })

  test('A-12: Escape w polu wiadomości (ognisko w ramce) zamyka okno czatu', async ({ page }) => {
    test.fail()
    await podstawBackend(page)
    await page.goto(stronaKlienta)
    await page.getByRole('button', { name: 'Otwórz czat' }).click()
    const ramka = page.getByTitle('Okno czatu')
    await expect(ramka).toBeVisible()

    // Tak pisze odwiedzający: ognisko jest w ramce, a zdarzenia klawiatury
    // z ramki nie docierają do dokumentu strony, na którym słucha embed.js.
    await page.frameLocator('iframe[title="Okno czatu"]').getByLabel('Treść wiadomości').click()
    await page.keyboard.press('Escape')

    await expect(ramka).toBeHidden({ timeout: 3000 })
  })
})
