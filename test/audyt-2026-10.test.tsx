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

import { zapomnijToken } from '@/lib/auth'
import WidgetSettingsPage from '@/app/(panel)/(admin)/widget-settings/page'

const przekierowania: string[] = []

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search || 'key=klucz-testowy'),
  useRouter: () => ({
    push: (adres: string) => przekierowania.push(adres),
    replace: (adres: string) => przekierowania.push(adres),
  }),
  usePathname: () => '/',
}))

function json(status: number, cialo: unknown = {}) {
  return new Response(JSON.stringify(cialo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
  vi.unstubAllGlobals()
})

// Naprawione znaleziska nie mają tu testów - ich testy żyją przy kodzie:
// A-02 test/zmiana-konta.test.ts, A-04 i A-05 test/chwilowe-odmowy.test.tsx,
// A-03, A-13 i A-21 test/test-bota.test.tsx, A-09 test/api.test.ts,
// A-10 i A-11 test/trasy.test.tsx, A-12 i A-15 test/widget-klawiatura-kontakt.test.tsx
// i e2e/embed.spec.ts.

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
