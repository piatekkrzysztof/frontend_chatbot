/**
 * Link z maila z zaproszeniem w prawdziwej przeglądarce (audyt 2026-10, A-26).
 *
 * Kategoria ryzyka: LINK, KTÓRY JEST HASŁEM. Jsdom nie sprawdzi, co naprawdę
 * wychodzi z przeglądarki: czy strona /invite/accept w ogóle istnieje, czy
 * proxy jej nie odbija i czy klucz nie jedzie w żadnej ścieżce - ani strony
 * (logi hostingu), ani API (logi backendu).
 */
import { expect, test } from '@playwright/test'
import { podstawBackend } from './atrapa'

const KLUCZ = '6f1c2d3e-4a5b-4c6d-8e7f-901234567890'

test('klucz z linku zaproszenia nie trafia do adresu żadnego zapytania', async ({ page }) => {
  await podstawBackend(page, {
    '/accounts/invitations/preview/': {
      status: 200,
      body: { company: 'Piekarnia', role: 'employee', is_valid: true, expires_at: '2026-10-29T10:00:00Z' },
    },
  })
  // Sama ścieżka i zapytanie - fragment przeglądarka zostawia u siebie, choć
  // Playwright dopisuje go do adresu nawigacji
  const wyslaneAdresy: string[] = []
  const podglady: { metoda: string; tresc: string | null }[] = []
  page.on('request', zapytanie => {
    const url = new URL(zapytanie.url())
    wyslaneAdresy.push(url.pathname + url.search)
    if (url.pathname.endsWith('/accounts/invitations/preview/')) {
      podglady.push({ metoda: zapytanie.method(), tresc: zapytanie.postData() })
    }
  })

  await page.goto(`/invite/accept#token=${KLUCZ}`)

  await expect(page.getByRole('heading', { name: 'Dołącz do zespołu' })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  expect(podglady).toEqual([{ metoda: 'POST', tresc: JSON.stringify({ token: KLUCZ }) }])
  expect(wyslaneAdresy.filter(adres => adres.includes(KLUCZ))).toEqual([])
})
