/**
 * Atrapa backendu dla testow przegladarkowych.
 *
 * Testy E2E sprawdzaja tutaj warstwe, ktorej jsdom nie ma: prawdziwy uklad,
 * przewijanie, rozmiary celow dotykowych i nawigacje Next.js. Zeby dalo sie
 * je uruchomic bez Django, Postgresa i klucza OpenAI, ruch do /api/ jest
 * przechwytywany. Ksztalty odpowiedzi sa przepisane z realnych serializerow
 * -- gdy kontrakt sie zmieni, ten plik trzeba zmienic razem z nim.
 */
import type { Page, Route } from '@playwright/test'

export const KONTO = {
  access: 'access-testowy',
  refresh: 'refresh-testowy',
}

const ODPOWIEDZI: Record<string, unknown> = {
  '/accounts/me/': {
    id: 1,
    username: 'wlascicielka@rowerownia.pl',
    email: 'wlascicielka@rowerownia.pl',
    role: 'owner',
    tenant_name: 'Rowerownia Krakowska',
    tenant_api_key: 'klucz-testowy',
  },
  '/analytics/': {
    total_conversations: 57,
    total_messages: 114,
    conversations_last_7_days: 9,
    top_questions: [],
  },
  '/widget-settings/mine/': {
    widget_title: 'Zapytaj nas',
    widget_color: '#F97316',
    widget_position: 'right',
    branding_mode: 'standard',
  },
  '/faq/': [
    { id: 11, question: 'Jakie macie godziny otwarcia?', answer: 'Pon-pt 9-18.' },
    { id: 12, question: 'Ile kosztuje przeglad?', answer: '120 zl.' },
  ],
}

/** Podstawia backend. `nadpisania` pozwalaja zepsuc jedna sciezke na potrzeby testu. */
export async function podstawBackend(
  page: Page,
  nadpisania: Record<string, { status: number; body?: unknown }> = {},
) {
  await page.route('**/api/**', async (route: Route) => {
    const sciezka = new URL(route.request().url()).pathname.replace(/^\/api/, '')

    const nadpisane = nadpisania[sciezka]
    if (nadpisane) {
      return route.fulfill({
        status: nadpisane.status,
        contentType: 'application/json',
        body: JSON.stringify(nadpisane.body ?? {}),
      })
    }

    if (sciezka === '/accounts/login/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(KONTO),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ODPOWIEDZI[sciezka] ?? []),
    })
  })
}

/**
 * Wklada token tak, jak zostawilby go poprzedni login.
 *
 * Celowo NIE przez `addInitScript`: ten uruchamia sie przy kazdym wczytaniu
 * strony, wiec po wyrzuceniu do /login token wracalby na miejsce i test
 * wygasniecia sesji sprawdzalby wlasna atrape zamiast aplikacji.
 */
export async function zalogowany(page: Page) {
  await page.goto('/login')
  await page.evaluate((konto) => {
    localStorage.setItem('token', konto.access)
    localStorage.setItem('refresh_token', konto.refresh)
  }, KONTO)
}
