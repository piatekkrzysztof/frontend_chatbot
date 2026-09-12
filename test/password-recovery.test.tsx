import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from '@/app/(auth)/reset-hasla/page'
import PasswordResetRequest from '@/components/auth/PasswordResetRequest'
import { recoveryRequest } from '@/lib/password-recovery'

const token = 'abc123-' + 'a'.repeat(32)
const response = (status: number, data: unknown = {}) => ({
  ok: status >= 200 && status < 300, status, json: async () => data,
}) as Response

beforeEach(() => {
  window.history.replaceState({}, '', '/reset-hasla#uid=MQ&token=' + token)
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('password recovery', () => {
  it('preview removes credentials from URL and never changes the password', async () => {
    vi.mocked(fetch).mockResolvedValue(response(200))
    render(<ResetPasswordPage />)
    await screen.findByLabelText('Nowe hasło')
    expect(window.location.hash).toBe('')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/preview/')
    expect(url).not.toContain(token)
    expect(options).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    expect(localStorage.length + sessionStorage.length).toBe(0)
  })

  it('requires matching passwords and preserves their spaces', async () => {
    vi.mocked(fetch).mockResolvedValue(response(200))
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('Nowe hasło'), '  Reset!Phrase739  ')
    await user.type(screen.getByLabelText('Powtórz nowe hasło'), 'Different!Pass739')
    await user.click(screen.getByRole('button', { name: 'Zmień hasło' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Hasła muszą być takie same')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Powtórz nowe hasło')).toHaveFocus()
    await user.clear(screen.getByLabelText('Powtórz nowe hasło'))
    await user.type(screen.getByLabelText('Powtórz nowe hasło'), '  Reset!Phrase739  ')
    await user.click(screen.getByRole('button', { name: 'Zmień hasło' }))
    await screen.findByRole('heading', { name: 'Hasło zmienione' })
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
      uid: 'MQ', token, password: '  Reset!Phrase739  ',
    })
    expect(screen.getByRole('link', { name: 'Przejdź do logowania' })).toHaveAttribute('href', '/login?wygasla=1')
    expect(screen.queryByLabelText('Nowe hasło')).not.toBeInTheDocument()
  })

  it('invalid link offers another email without showing a password form', async () => {
    vi.mocked(fetch).mockResolvedValue(response(400, { token: ['Link wygasł lub został użyty.'] }))
    render(<ResetPasswordPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Link wygasł')
    expect(screen.getByLabelText('Adres e-mail konta')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nowe hasło')).not.toBeInTheDocument()
  })

  it('missing fragment does not send any request', async () => {
    window.history.replaceState({}, '', '/reset-hasla')
    render(<ResetPasswordPage />)
    await screen.findByRole('alert')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('network failure can retry preview without losing the proof', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response(200))
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.click(await screen.findByRole('button', { name: 'Ponów sprawdzenie' }))
    await screen.findByLabelText('Nowe hasło')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({ uid: 'MQ', token })
  })

  it('a weak password retains the input and shows the server validation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(400, { password: ['Hasło jest zbyt popularne.'] }))
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('Nowe hasło'), 'password123')
    await user.type(screen.getByLabelText('Powtórz nowe hasło'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Zmień hasło' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('zbyt popularne'))
    expect(screen.getByLabelText('Nowe hasło')).toHaveValue('password123')
  })

  it('password visibility toggle keeps autocomplete and input value', async () => {
    vi.mocked(fetch).mockResolvedValue(response(200))
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    const field = await screen.findByLabelText('Nowe hasło')
    await user.type(field, 'Visible!Password739')
    await user.click(screen.getByRole('button', { name: 'Pokaż nowe hasło' }))
    expect(field).toHaveAttribute('type', 'text')
    expect(field).toHaveAttribute('autocomplete', 'new-password')
    expect(field).toHaveValue('Visible!Password739')
  })

  it('email request gives a generic receipt and only sends the normalized email', async () => {
    vi.mocked(fetch).mockResolvedValue(response(202))
    const user = userEvent.setup()
    render(<PasswordResetRequest />)
    await user.type(screen.getByLabelText('Adres e-mail konta'), 'Test@Example.COM')
    await user.click(screen.getByRole('button', { name: 'Wyślij link do zmiany hasła' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Jeśli konto może odzyskać dostęp')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ email: 'test@example.com' })
  })

  it('reports throttling with a recovery action', async () => {
    vi.mocked(fetch).mockResolvedValue(response(429))
    await expect(recoveryRequest('request', { email: 'test@example.com' })).rejects.toThrow('Poczekaj')
  })

  it('deadline also covers stalled response bodies', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(async (_url, options) => ({
      ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
    }) as Response)
    const pending = recoveryRequest('preview', { uid: 'MQ', token })
    const assertion = expect(pending).rejects.toThrow('Sprawdź połączenie')
    await vi.advanceTimersByTimeAsync(20_001)
    await assertion
  })
})
