/**
 * Atrapa backendu dla testow przegladarkowych.
 *
 * Testy E2E sprawdzaja tutaj warstwe, ktorej jsdom nie ma: prawdziwy uklad,
 * przewijanie, rozmiary celow dotykowych, nawigacje Next.js i -- od czasu
 * przebudowy sesji -- middleware, ktory dziala po stronie serwera i o ktorym
 * test jednostkowy nie ma jak sie wypowiedziec.
 *
 * Zeby dalo sie je uruchomic bez Django, Postgresa i klucza OpenAI, ruch do
 * /api/ jest przechwytywany. Ksztalty odpowiedzi sa przepisane z realnych
 * serializerow -- gdy kontrakt sie zmieni, ten plik trzeba zmienic razem z nim.
 */
import type { BrowserContext, Page, Route } from '@playwright/test'

export const TOKEN_DOSTEPU = 'access-testowy'

/** Ta sama nazwa co NAZWA_CIASTECZKA_SESJI po stronie Django. */
export const ZNACZNIK_SESJI = 'sesja_panelu'

const ODPOWIEDZI: Record<string, unknown> = {
  '/accounts/me/': {
    id: 1,
    username: 'wlascicielka@rowerownia.pl',
    email: 'wlascicielka@rowerownia.pl',
    role: 'owner',
    tenant_name: 'Rowerownia Krakowska',
    tenant_api_key: 'klucz-testowy',
  },
  // Ksztalt przepisany z api/views/analytics.py, nie wymyslony. Pierwsza
  // wersja tej atrapy zgadywala nazwy pol i pulpit wywracal sie na
  // `undefined.limit` -- test pokazywal wtedy awarie aplikacji, ktorej
  // nie bylo, i to gorszy rodzaj bledu niz brak testu.
  '/analytics/': {
    tenant_name: 'Rowerownia Krakowska',
    knowledge: {
      has_description: true,
      documents: 3,
      indexed_chunks: 42,
      faqs: 6,
      websites: 1,
      is_empty: false,
    },
    conversations: { total: 57, last_7d: 9, last_30d: 57 },
    questions: { total: 114, last_7d: 18, daily: [] },
    answer_sources: { document: 61, faq: 40, gpt: 13 },
    usage: { used: 114, limit: 1000, plan: 'pro' },
    unanswered: [],
  },
  '/widget-settings/mine/': {
    widget_title: 'Zapytaj nas',
    widget_color: '#F97316',
    widget_position: 'right',
    branding_mode: 'standard',
  },
  // Ekran ustawien sklada sie z trzech sekcji, kazda z wlasnym zapytaniem.
  // Bez tych wpisow atrapa zwracalaby pusta liste tam, gdzie komponent
  // oczekuje obiektu - i ekran wywracalby sie w tescie z powodu, ktory
  // z produktem nie ma nic wspolnego.
  '/accounts/dane-rozliczeniowe/': {
    nazwa: 'Rowerownia Krakowska Anna Nowak',
    nip: '5260250274',
    ulica: 'Krakowska 12',
    kod_pocztowy: '31-000',
    miasto: 'Kraków',
    kraj: 'PL',
  },
  '/accounts/2fa/': {
    wlaczony: false,
    w_trakcie_konfiguracji: false,
    kodow_zapasowych: 0,
  },
  '/accounts/firma/': {
    name: 'Rowerownia Krakowska',
    owner_email: 'szef@rowerownia.pl',
  },
  '/faq/': [
    { id: 11, question: 'Jakie macie godziny otwarcia?', answer: 'Pon-pt 9-18.' },
    { id: 12, question: 'Ile kosztuje przeglad?', answer: '120 zl.' },
  ],
}

type Nadpisanie = { status: number; body?: unknown }

/**
 * Podstawia backend.
 *
 * `nadpisania` pozwalaja zepsuc jedna sciezke na potrzeby jednego testu --
 * na przyklad kazac odswiezaniu zwrocic 401, zeby sprawdzic wygasla sesje.
 */
export async function podstawBackend(
  page: Page,
  nadpisania: Record<string, Nadpisanie> = {},
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

    // Logowanie odsyla znacznik sesji tak samo jak prawdziwy backend --
    // to on decyduje, czy middleware przepusci trase panelu. Sam token
    // odswiezania pomijamy: jest HttpOnly ze sciezka /api/accounts/, wiec
    // w tescie i tak nie ma go czym sprawdzic ani do czego uzyc.
    if (sciezka === '/accounts/login/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `${ZNACZNIK_SESJI}=1; Path=/; HttpOnly` },
        body: JSON.stringify({ access: TOKEN_DOSTEPU }),
      })
    }

    if (sciezka === '/accounts/token/refresh/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: TOKEN_DOSTEPU }),
      })
    }

    // Konfiguracja drugiego skladnika: sekret i adres otpauth. Sekret jest
    // wymyslony na potrzeby testu - prawdziwy nigdy nie powstaje po stronie
    // przegladarki.
    if (sciezka === '/accounts/2fa/rozpocznij/') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          sekret: 'JBSWY3DPEHPK3PXP',
          adres_otpauth:
            'otpauth://totp/SM-art%20Chat:szef@rowerownia.pl?secret=JBSWY3DPEHPK3PXP&issuer=SM-art%20Chat',
        }),
      })
    }

    if (sciezka === '/accounts/2fa/potwierdz/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          wlaczony: true,
          kody_zapasowe: ['A1B2C3D4-E5F6A7B8', 'C9D0E1F2-A3B4C5D6'],
        }),
      })
    }

    if (sciezka === '/accounts/logout/') {
      return route.fulfill({
        status: 204,
        headers: { 'set-cookie': `${ZNACZNIK_SESJI}=; Path=/; Max-Age=0` },
        body: '',
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
 * Wklada znacznik sesji, tak jak zostawilby go poprzedni login.
 *
 * Tokenu dostepu nie da sie tu podlozyc i nie trzeba: zyje w pamieci karty,
 * wiec po kazdym wejsciu na strone panel i tak wymienia ciasteczko na nowy.
 * Wystarczy, ze atrapa odpowiada na odswiezanie.
 */
export async function zalogowany(kontekst: BrowserContext) {
  await kontekst.addCookies([
    {
      name: ZNACZNIK_SESJI,
      value: '1',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ])
}
