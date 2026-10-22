/**
 * Znaleziska audytu z października 2026 (docs/audyt-2026-10.md).
 *
 * Każdy test opisuje zachowanie, jakie POWINNO być, i jest oznaczony
 * `it.fails`: przechodzi, dopóki błąd istnieje. Poprawka, która go usunie,
 * zmieni ten test na czerwony - wtedy wystarczy zamienić `it.fails` na `it`
 * i przenieść test do pliku obszaru, którego dotyczy. Dzięki temu dowód
 * każdego znaleziska da się odtworzyć jednym poleceniem, a CI zostaje zielone.
 *
 * Numery w nazwach (A-xx) to numery z tabeli w raporcie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { apiFetch, pobierzPlik } from '@/lib/api'
import { ustawToken, zapomnijToken } from '@/lib/auth'
import LoginPage from '@/app/(auth)/login/page'
import TestBotaPage from '@/app/(admin)/test-bota/page'
import WidgetSettingsPage from '@/app/(admin)/widget-settings/page'
import WidgetChat from '@/components/widget/WidgetChat'

const przekierowania: string[] = []

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search || 'key=klucz-testowy'),
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
  usePathname: () => '/',
}))

const oryginalnaLokalizacja = window.location

function podmienLokalizacje() {
  const atrapa = { href: '', search: '' } as Location
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: atrapa })
  return atrapa
}

function json(status: number, cialo: unknown = {}) {
  return new Response(JSON.stringify(cialo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function strumien(...zdarzenia: string[]) {
  return new Response(new ReadableStream({
    start(kontroler) {
      for (const z of zdarzenia) kontroler.enqueue(new TextEncoder().encode(z))
      kontroler.close()
    },
  }), { status: 200 })
}

const USTAWIENIA_WIDGETU = {
  widget_title: 'Zapytaj nas',
  widget_color: '#F97316',
  widget_position: 'right',
  branding_mode: 'smart',
  widget_suggested_questions: [],
}

beforeEach(() => {
  przekierowania.length = 0
  vi.stubGlobal('fetch', vi.fn())
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  zapomnijToken()
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: oryginalnaLokalizacja })
  vi.unstubAllGlobals()
})

describe('sesja', () => {
  // A-02 nie ma tu testu: poprawka i jej testy są w PR #55
  // (test/zmiana-konta.test.ts, e2e/zmiana-konta.spec.ts).

  it.fails.each([429, 503])('A-05: chwilowa odmowa odswiezenia (%i) nie konczy sesji', async (status) => {
    // Odswiezanie dzieli z logowaniem limit 10/min na adres IP (LimitLogowaniaIP).
    ustawToken('wygasly-token')
    const lokalizacja = podmienLokalizacje()
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(status, { detail: 'chwilowo' }))

    await apiFetch('/analytics/').catch(() => null)

    expect(lokalizacja.href).not.toContain('/login')
  })
})

describe('logowanie', () => {
  async function zaloguj() {
    const uzytkownik = userEvent.setup()
    render(<LoginPage />)
    await uzytkownik.type(screen.getByLabelText('E-mail'), 'szef@firma.pl')
    await uzytkownik.type(screen.getByLabelText('Hasło'), 'poprawne-haslo')
    await uzytkownik.click(screen.getByRole('button', { name: 'Zaloguj się' }))
  }

  it.fails.each([429, 503])('A-04: odmowa %i nie jest pokazywana jako bledne haslo', async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(json(status, { detail: 'Za dużo prób.' }))

    await zaloguj()

    expect(await screen.findByRole('alert')).not.toHaveTextContent('Nieprawidłowy e-mail lub hasło.')
  })

  it.fails('A-11: po zalogowaniu wraca pod adres z parametru powrot', async () => {
    // proxy.ts dopisuje ?powrot=<sciezka>, ale ekran logowania go nie czyta
    window.history.replaceState(null, '', '/login?powrot=%2Fleads')
    vi.mocked(fetch).mockResolvedValueOnce(json(200, { access: 'token' }))

    await zaloguj()

    await waitFor(() => expect(przekierowania).toContain('/leads'))
  })
})

describe('test bota', () => {
  async function zapytaj(pytanie: string) {
    const uzytkownik = userEvent.setup()
    render(<TestBotaPage />)
    await uzytkownik.type(screen.getByLabelText('Pytanie do bota'), pytanie)
    await uzytkownik.keyboard('{Enter}')
  }

  it.fails('A-03: wygasly token jest odswiezany, a pytanie ponawiane', async () => {
    ustawToken('wygasly-token')
    vi.mocked(fetch).mockImplementation(async (adres, opcje) => {
      const url = String(adres)
      const naglowki = new Headers(opcje?.headers)
      if (url.includes('/token/refresh/')) return json(200, { access: 'swiezy-token' })
      if (url.endsWith('/chat/test/') && (opcje?.method ?? 'GET') === 'GET') return json(200, { messages: [] })
      if (naglowki.get('Authorization') === 'Bearer wygasly-token') return json(401)
      return strumien('data: {"type":"delta","content":"Otwieramy o 9."}\n\n', 'data: {"type":"done","source":"faq"}\n\n')
    })

    await zapytaj('Kiedy otwieracie?')

    expect(await screen.findByText('Otwieramy o 9.')).toBeInTheDocument()
  })

  it.fails('A-13: zdarzenie `data:` bez spacji nie ginie (ten sam parser co widget)', async () => {
    ustawToken('token')
    vi.mocked(fetch).mockImplementation(async (adres, opcje) => {
      if ((opcje?.method ?? 'GET') === 'GET') return json(200, { messages: [] })
      return strumien('data:{"type":"delta","content":"Bez spacji."}\n\n', 'data:{"type":"done","source":"faq"}\n\n')
    })

    await zapytaj('Test')

    expect(await screen.findByText('Bez spacji.')).toBeInTheDocument()
  })
})

describe('pobieranie plikow', () => {
  it.fails('A-09: nazwa z procentem z naglowka Django nie przerywa pobrania', async () => {
    // Django: content_disposition_header(True, 'Cennik 100% rabat.pdf')
    //   -> attachment; filename="Cennik 100% rabat.pdf"
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    const zapisane = { nazwa: '' }
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      zapisane.nazwa = this.download
    })
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="Cennik 100% rabat.pdf"' }),
      blob: () => Promise.resolve(new Blob(['%PDF'])),
    } as unknown as Response)

    await pobierzPlik('/documents/7/download/', 'dokument.pdf')

    expect(zapisane.nazwa).toBe('Cennik 100% rabat.pdf')
  })
})

describe('ustawienia widgetu', () => {
  it.fails('A-14: podglad logo nie tworzy nowego adresu blob przy kazdym klawiszu', async () => {
    const utworz = vi.fn(() => 'blob:podglad')
    const zwolnij = vi.fn()
    const poprzednie = { utworz: URL.createObjectURL, zwolnij: URL.revokeObjectURL }
    Object.assign(URL, { createObjectURL: utworz, revokeObjectURL: zwolnij })
    try {
      vi.mocked(fetch).mockImplementation(async (adres) => {
        const url = String(adres)
        if (url.includes('/widget-settings/mine/')) {
          return json(200, { ...USTAWIENIA_WIDGETU, branding_mode: 'white_label', widget_logo: null, widget_avatar: null })
        }
        if (url.includes('/accounts/me/')) return json(200, { tenant_api_key: 'klucz' })
        return json(200, { plans: [] })
      })
      const uzytkownik = userEvent.setup()
      render(<WidgetSettingsPage />)
      const nazwa = await screen.findByLabelText('Nazwa widgetu')
      await waitFor(() => expect(nazwa).not.toBeDisabled())

      await uzytkownik.upload(screen.getByLabelText('Logo'), new File(['png'], 'logo.png', { type: 'image/png' }))
      await uzytkownik.type(nazwa, 'abcdef')

      // Jeden plik, jeden adres. Kazdy niezwolniony adres trzyma plik do zamkniecia karty.
      expect(utworz.mock.calls.length - zwolnij.mock.calls.length).toBeLessThanOrEqual(1)
    } finally {
      Object.assign(URL, { createObjectURL: poprzednie.utworz, revokeObjectURL: poprzednie.zwolnij })
    }
  })
})

describe('widget', () => {
  it.fails('A-15: dwuklik w „Wyślij” formularza kontaktu wysyla jedno zapytanie', async () => {
    let zakoncz!: (odpowiedz: Response) => void
    vi.mocked(fetch).mockImplementation((adres) => {
      const url = String(adres)
      if (url.includes('/widget-settings/')) return Promise.resolve(json(200, USTAWIENIA_WIDGETU))
      if (url.includes('/widget/contact/')) return new Promise((resolve) => { zakoncz = resolve })
      return Promise.resolve(json(200))
    })
    const uzytkownik = userEvent.setup()
    render(<WidgetChat />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Zostaw kontakt' }))
    await uzytkownik.type(screen.getByLabelText('Twój e-mail lub telefon'), 'jan@firma.pl')
    await uzytkownik.dblClick(screen.getByRole('button', { name: 'Wyślij' }))
    zakoncz?.(json(201))

    const kontakty = vi.mocked(fetch).mock.calls.filter(([adres]) => String(adres).includes('/widget/contact/'))
    expect(kontakty).toHaveLength(1)
  })
})
