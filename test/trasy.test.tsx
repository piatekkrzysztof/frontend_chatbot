/**
 * Chronione trasy i powrót po zalogowaniu (audyt 2026-10, A-10 i A-11).
 *
 * Kategoria ryzyka: DOSTEP.
 *  - A-10: `/dziennik` nie było na liście CHRONIONE, więc bez sesji serwer
 *    oddawał powłokę panelu zamiast przekierowania. Test e2e chodzi po tej
 *    samej liście, więc ekranu spoza niej nie sprawdzał - ten test porównuje
 *    listę z katalogiem ekranów.
 *  - A-11: proxy.ts dopisywał `?powrot=<ścieżka>`, ale logowanie zawsze
 *    prowadziło na pulpit. Powrót przyjmuje wyłącznie ścieżki z listy
 *    CHRONIONE - inaczej parametr w linku dałoby się użyć do przekierowania
 *    na obcą stronę.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { celPoZalogowaniu, CHRONIONE } from '@/lib/trasy'
import LoginPage from '@/app/(panel)/(auth)/login/page'

const przekierowania: string[] = []
const router = {
  push: (adres: string) => przekierowania.push(adres),
  replace: (adres: string) => przekierowania.push(adres),
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => router,
}))

describe('lista chronionych tras (A-10)', () => {
  it('obejmuje każdy ekran panelu z app/(panel)/(admin)', () => {
    const ekrany = readdirSync(join(process.cwd(), 'app', '(panel)', '(admin)'), { withFileTypes: true })
      .filter((wpis) => wpis.isDirectory())
      .map((wpis) => `/${wpis.name}`)

    expect(ekrany.length).toBeGreaterThan(10)
    expect(ekrany.filter((ekran) => !CHRONIONE.includes(ekran))).toEqual([])
  })
})

describe('dokąd po zalogowaniu (A-11)', () => {
  it.each([
    ['?powrot=%2Fleads', '/leads'],
    ['?powrot=%2Fdziennik', '/dziennik'],
    ['?powrot=%2Fplatnosc%2Fsukces', '/platnosc/sukces'],
    ['?dalej=subskrypcja', '/subskrypcja'],
    ['', '/dashboard'],
  ])('%s → %s', (zapytanie, cel) => {
    expect(celPoZalogowaniu(zapytanie)).toBe(cel)
  })

  it.each([
    '?powrot=%2F%2Fzly.example',
    '?powrot=https%3A%2F%2Fzly.example',
    '?powrot=%2F%5Czly.example',
    '?powrot=%2Flogin',
    '?powrot=%2Fleads%3Fx%3D1',
    '?powrot=%2Fleadsy',
    '?powrot=javascript%3Aalert(1)',
  ])('obcy albo niechroniony cel %s → pulpit', (zapytanie) => {
    expect(celPoZalogowaniu(zapytanie)).toBe('/dashboard')
  })

  it('ekran logowania wraca pod adres z powrot', async () => {
    window.history.replaceState(null, '', '/login?powrot=%2Fleads')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ access: 'token' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ))
    const uzytkownik = userEvent.setup()
    render(<LoginPage />)

    await uzytkownik.type(screen.getByLabelText('E-mail'), 'szef@firma.pl')
    await uzytkownik.type(screen.getByLabelText('Hasło'), 'poprawne-haslo')
    await uzytkownik.click(screen.getByRole('button', { name: 'Zaloguj się' }))

    await waitFor(() => expect(przekierowania).toEqual(['/leads']))
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })
})
