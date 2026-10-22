/**
 * Segmenty ścieżek API są kodowane (audyt 2026-10, A-22).
 *
 * Kategoria ryzyka: OBRONA W GŁĄB. Identyfikator rozmowy i klucze zaproszeń
 * trafiały do ścieżki API bez encodeURIComponent. Dziś bez skutku - backend
 * trzyma session_id jako UUIDField, a zapytania zaproszeń idą bez poświadczeń
 * - ale gdyby identyfikator mógł kiedyś zawierać `../`, „Usuń rozmowę”
 * wysłałoby DELETE z tokenem właściciela pod zupełnie inny adres API
 * (przeglądarka składa `..` w ścieżce, zanim wyśle zapytanie).
 */
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import * as api from '@/lib/api'
import PrivacyPage from '@/app/(panel)/(admin)/privacy/page'
import ConversationsPage from '@/app/(panel)/(admin)/conversations/page'
import PrzyjmijZaproszeniePage from '@/app/(panel)/(auth)/invite/accept/[token]/page'
import WyslijZaproszeniePage from '@/app/(panel)/(auth)/invite/wyslij/[token]/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const PODEJRZANY = '../../users/5'
const ZAKODOWANY = encodeURIComponent(PODEJRZANY)

/** Obietnica spełniona tak, jak rozpoznaje ją `use()` - bez zawieszania. */
function spelniona<T>(wartosc: T): Promise<T> {
  const obietnica = Promise.resolve(wartosc) as Promise<T> & { status: string; value: T }
  obietnica.status = 'fulfilled'
  obietnica.value = wartosc
  return obietnica
}

function podepnijApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/privacy/') return { data_retention_days: 30, privacy_policy_url: '' } as never
    if (sciezka.startsWith('/chat/logs/')) {
      return {
        count: 1, next: null, previous: null,
        results: [{ id: 1, conversation_session_id: PODEJRZANY, prompt: 'Pytanie', response: 'Odpowiedź', source: 'widget', tokens: 1, created_at: '2026-10-10T09:00:00Z', is_helpful: null }],
      } as never
    }
    if (sciezka === '/accounts/me/') return { role: 'owner' } as never
    if (sciezka.startsWith('/privacy/conversations/')) return { deleted: { Conversation: 1 } } as never
    return {} as never
  })
}

function sciezkiUsuniecia(szpieg: ReturnType<typeof podepnijApi>) {
  return szpieg.mock.calls.filter(([, opcje]) => (opcje as RequestInit | undefined)?.method === 'DELETE').map(([s]) => s)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('identyfikator rozmowy', () => {
  it('z pola na ekranie Prywatność idzie do API zakodowany', async () => {
    const szpieg = podepnijApi()
    const uzytkownik = userEvent.setup()
    render(<PrivacyPage />)

    await uzytkownik.type(await screen.findByLabelText('Identyfikator rozmowy do usunięcia'), PODEJRZANY)
    await uzytkownik.keyboard('{Enter}')

    await vi.waitFor(() => expect(sciezkiUsuniecia(szpieg)).toEqual([`/privacy/conversations/${ZAKODOWANY}/`]))
  })

  it('z listy Konwersacji idzie do API zakodowany', async () => {
    const szpieg = podepnijApi()
    const uzytkownik = userEvent.setup()
    render(<ConversationsPage />)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Usuń rozmowę' }))
    await uzytkownik.click(screen.getByRole('button', { name: /Potwierdź: usuń całą rozmowę/ }))

    await vi.waitFor(() => expect(sciezkiUsuniecia(szpieg)).toEqual([`/privacy/conversations/${ZAKODOWANY}/`]))
  })
})

describe('klucz zaproszenia z adresu strony', () => {
  it('podgląd zaproszenia pyta o zakodowany klucz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
    render(<Suspense fallback={null}><PrzyjmijZaproszeniePage params={spelniona({ token: PODEJRZANY })} /></Suspense>)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(`/accounts/invitations/${ZAKODOWANY}/preview/`)
  })

  it('„Wyślij mi zaproszenie” wysyła zakodowany klucz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 202 })))
    const uzytkownik = userEvent.setup()
    render(<Suspense fallback={null}><WyslijZaproszeniePage params={spelniona({ token: PODEJRZANY })} /></Suspense>)

    await uzytkownik.click(await screen.findByRole('button', { name: 'Wyślij mi zaproszenie' }))

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(`/accounts/invitations/wyslij/${ZAKODOWANY}/`)
  })
})
