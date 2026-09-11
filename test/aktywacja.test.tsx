import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmEmailPage from '@/app/(auth)/potwierdz-email/page'
import ResendConfirmation from '@/components/auth/ResendConfirmation'

const TOKEN = 'a'.repeat(43)
const response = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body, headers: new Headers(),
}) as Response

beforeEach(() => {
  window.history.replaceState({}, '', '/potwierdz-email#token=' + TOKEN)
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('aktywacja', () => {
  it('usuwa token z adresu i nie aktywuje konta przy podglądzie', async () => {
    vi.mocked(fetch).mockResolvedValue(response(200, { email: 'new@example.com', company_name: 'Firma' }))
    render(<ConfirmEmailPage />)
    await screen.findByLabelText('Hasło')
    expect(window.location.hash).toBe('')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/preview/')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('dopiero hasło i świadome zatwierdzenie aktywują konto', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, { email: 'new@example.com', company_name: 'Firma' }))
      .mockResolvedValueOnce(response(201, { use_trial: true }))
    const user = userEvent.setup()
    render(<ConfirmEmailPage />)
    await user.type(await screen.findByLabelText('Hasło'), '  Secret!Phrase729  ')
    await user.type(screen.getByLabelText('Powtórz hasło'), '  Secret!Phrase729  ')
    await user.click(screen.getByRole('button', { name: 'Potwierdź e-mail i załóż konto' }))
    await screen.findByRole('heading', { name: 'Konto gotowe' })
    const [, options] = vi.mocked(fetch).mock.calls[1]
    expect(JSON.parse(String(options?.body))).toEqual({ token: TOKEN, password: '  Secret!Phrase729  ' })
    expect(screen.getByRole('link', { name: 'Przejdź do logowania' })).toHaveAttribute('href', '/login')
  })

  it('wygasły link daje możliwość ponowienia i logowania', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(400, { token: ['Expired'] }))
    render(<ConfirmEmailPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Link wygasł')
    expect(screen.getByLabelText('Adres e-mail do aktywacji')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hasło')).not.toBeInTheDocument()
  })

  it('błędne hasło zachowuje formularz i czytelny błąd', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, { email: 'new@example.com', company_name: 'Firma' }))
      .mockResolvedValueOnce(response(400, { password: ['Hasło jest zbyt popularne.'] }))
    const user = userEvent.setup()
    render(<ConfirmEmailPage />)
    await user.type(await screen.findByLabelText('Hasło'), 'password123')
    await user.type(screen.getByLabelText('Powtórz hasło'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Potwierdź e-mail i załóż konto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('zbyt popularne')
    expect(screen.getByLabelText('Hasło')).toHaveValue('password123')
  })

  it('awaria podglądu pozwala ponowić bez utraty tokena', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(response(200, { email: 'new@example.com', company_name: 'Firma' }))
    const user = userEvent.setup()
    render(<ConfirmEmailPage />)
    await user.click(await screen.findByRole('button', { name: 'Ponów sprawdzenie' }))
    await screen.findByLabelText('Hasło')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)).token).toBe(TOKEN)
  })

  it('ponowienie wiadomości wysyła tylko adres i blokuje szybkie powtórki', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(202))
    const user = userEvent.setup()
    render(<ResendConfirmation />)
    await user.type(screen.getByLabelText('Adres e-mail do aktywacji'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Wyślij nowy link' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Jeśli ten adres'))
    expect(screen.getByRole('button')).toBeDisabled()
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ email: 'new@example.com' })
  })
})
