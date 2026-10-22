/**
 * Ustawienia widgetu i dane konta w panelu (audyt 2026-10, A-14 i A-18).
 *
 * Kategoria ryzyka: WYDAJNOSC.
 *  - A-14: podgląd logo i awatara tworzył nowy adres blob: w każdym renderze
 *    i żadnego nie zwalniał. Każdy klawisz w formularzu z wybranym plikiem to
 *    nowy adres, przeładowany obrazek podglądu i plik trzymany do zamknięcia
 *    karty.
 *  - A-18: /accounts/me/ pobierał pasek górny i osobno ekran (Konwersacje,
 *    Zespół, Ustawienia widgetu) - dwa takie same zapytania na każde wejście.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import * as api from '@/lib/api'
import { JaProvider } from '@/lib/ja'
import Navbar from '@/components/layout/Navbar'
import ConversationsPage from '@/app/(panel)/(admin)/conversations/page'
import WidgetSettingsPage from '@/app/(panel)/(admin)/widget-settings/page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/conversations',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const DANE: Record<string, unknown> = {
  '/accounts/me/': { id: 1, role: 'owner', tenant_name: 'Rowerownia', tenant_api_key: 'klucz' },
  '/widget-settings/mine/': {
    branding_mode: 'white_label', widget_title: 'Zapytaj nas', widget_color: '#0E7C66',
    widget_position: 'right', widget_logo: null, widget_avatar: null,
  },
  '/billing/plans/': { plans: [] },
}

function podstawApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    const bez = sciezka.split('?')[0]
    if (bez === '/chat/logs/') return { count: 0, next: null, previous: null, results: [] }
    return (DANE[bez] ?? {}) as never
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('jedno /accounts/me/ na pasek i ekran (A-18)', () => {
  it('pasek górny i Konwersacje pod JaProvider pytają o konto raz', async () => {
    const apiFetch = podstawApi()
    render(
      <JaProvider>
        <Navbar />
        <ConversationsPage />
      </JaProvider>,
    )

    expect(await screen.findByText('Rowerownia')).toBeInTheDocument()
    // Rola z tego samego zapytania odsłania import historii właścicielowi
    expect(await screen.findByLabelText(/Plik CSV/i)).toBeInTheDocument()
    const oKonto = apiFetch.mock.calls.filter(([sciezka]) => sciezka === '/accounts/me/')
    expect(oKonto).toHaveLength(1)
  })

  it('ekran bez JaProvider (np. sam w teście) pobiera konto sam', async () => {
    const apiFetch = podstawApi()
    render(<WidgetSettingsPage />)

    expect(await screen.findByText(/data-key="klucz"/)).toBeInTheDocument()
    expect(apiFetch.mock.calls.filter(([sciezka]) => sciezka === '/accounts/me/')).toHaveLength(1)
  })
})

describe('podgląd logo (A-14)', () => {
  function podmienAdresyBlob() {
    let numer = 0
    const utworz = vi.fn(() => `blob:podglad-${++numer}`)
    const zwolnij = vi.fn()
    const poprzednie = { utworz: URL.createObjectURL, zwolnij: URL.revokeObjectURL }
    Object.assign(URL, { createObjectURL: utworz, revokeObjectURL: zwolnij })
    return { utworz, zwolnij, przywroc: () => Object.assign(URL, { createObjectURL: poprzednie.utworz, revokeObjectURL: poprzednie.zwolnij }) }
  }

  it('jeden plik to jeden adres blob, także przy pisaniu w formularzu', async () => {
    const { utworz, zwolnij, przywroc } = podmienAdresyBlob()
    try {
      podstawApi()
      const uzytkownik = userEvent.setup()
      render(<WidgetSettingsPage />)
      const nazwa = await screen.findByLabelText('Nazwa widgetu')
      await waitFor(() => expect(nazwa).not.toBeDisabled())

      await uzytkownik.upload(screen.getByLabelText('Logo'), new File(['png'], 'logo.png', { type: 'image/png' }))
      await uzytkownik.type(nazwa, 'abcdef')

      expect(utworz).toHaveBeenCalledTimes(1)
      expect(zwolnij).not.toHaveBeenCalled()
    } finally {
      przywroc()
    }
  })

  it('zmiana pliku i odmontowanie zwalniają poprzedni adres', async () => {
    const { utworz, zwolnij, przywroc } = podmienAdresyBlob()
    try {
      podstawApi()
      const uzytkownik = userEvent.setup()
      const { unmount } = render(<WidgetSettingsPage />)
      const nazwa = await screen.findByLabelText('Nazwa widgetu')
      await waitFor(() => expect(nazwa).not.toBeDisabled())

      await uzytkownik.upload(screen.getByLabelText('Logo'), new File(['a'], 'a.png', { type: 'image/png' }))
      await uzytkownik.upload(screen.getByLabelText('Logo'), new File(['b'], 'b.png', { type: 'image/png' }))
      expect(zwolnij).toHaveBeenCalledWith('blob:podglad-1')

      unmount()
      expect(zwolnij).toHaveBeenCalledWith('blob:podglad-2')
      expect(utworz).toHaveBeenCalledTimes(2)
    } finally {
      przywroc()
    }
  })
})
