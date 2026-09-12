import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BezpieczenstwoKonta from '@/components/ustawienia/BezpieczenstwoKonta'
import DrugiSkladnik from '@/components/ustawienia/DrugiSkladnik'
import { apiFetch } from '@/lib/api'
import { navigateAfterSecurityChange, securityMutation } from '@/lib/account-security'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/account-security', () => ({ securityMutation: vi.fn(), navigateAfterSecurityChange: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn() } }))
const data = { count: 2, next: null, previous: null, mfa_enabled: true, results: [
  { id: 'one', created_at: '2026-09-12T09:00:00Z', expires_at: '2026-09-26T09:00:00Z', current: true },
  { id: 'two', created_at: '2026-09-11T09:00:00Z', expires_at: '2026-09-25T09:00:00Z', current: false },
] }
beforeEach(() => { vi.mocked(apiFetch).mockReset().mockResolvedValue(data); vi.mocked(securityMutation).mockReset(); vi.mocked(navigateAfterSecurityChange).mockReset() })

describe('account settings', () => {
  it('does not pretend that a failed read means no active sessions', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Zmień hasło konta' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ponów odczyt sesji' }))
    await screen.findByRole('button', { name: 'Zmień hasło konta' })
  })

  it('requires matching passwords, confirms MFA, and clears the view after success', async () => {
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await user.click(await screen.findByRole('button', { name: 'Zmień hasło konta' }))
    await user.type(screen.getByLabelText('Aktualne hasło konta', { exact: true }), '  Old!Password739  ')
    await user.type(screen.getByLabelText('Nowe hasło konta', { exact: true }), '  New!Password739  ')
    await user.type(screen.getByLabelText('Powtórz nowe hasło konta', { exact: true }), 'Not-the-same739!')
    await user.type(screen.getByLabelText('Kod MFA lub kod zapasowy'), '123456')
    await user.click(screen.getByRole('button', { name: 'Zmień hasło i wyloguj' }))
    expect(securityMutation).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Powtórz nowe hasło konta', { exact: true })).toHaveFocus()
    await user.clear(screen.getByLabelText('Powtórz nowe hasło konta', { exact: true }))
    await user.type(screen.getByLabelText('Powtórz nowe hasło konta', { exact: true }), '  New!Password739  ')
    vi.mocked(securityMutation).mockResolvedValue({ detail: 'Hasło zmienione.', current_session_revoked: true, local_session_ended: true })
    await user.click(screen.getByRole('button', { name: 'Zmień hasło i wyloguj' }))
    await screen.findByRole('link', { name: 'Zaloguj się ponownie' })
    expect(securityMutation).toHaveBeenCalledWith('/accounts/password-change/', { current_password: '  Old!Password739  ', new_password: '  New!Password739  ', kod: '123456' })
    expect(navigateAfterSecurityChange).toHaveBeenCalledWith(true)
    expect(screen.queryByLabelText('Aktualne hasło konta', { exact: true })).not.toBeInTheDocument()
    expect(localStorage.length + sessionStorage.length).toBe(0)
  })

  it('cancels without any mutation and clears entered secrets', async () => {
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await user.click(await screen.findByRole('button', { name: 'Zakończ pozostałe sesje' }))
    await user.type(screen.getByLabelText('Aktualne hasło konta', { exact: true }), 'secret')
    await user.type(screen.getByLabelText('Kod MFA lub kod zapasowy'), '123456')
    await user.click(screen.getByRole('button', { name: 'Anuluj' }))
    expect(securityMutation).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Zakończ pozostałe sesje' }))
    expect(screen.getByLabelText('Aktualne hasło konta', { exact: true })).toHaveValue('')
    expect(screen.getByLabelText('Kod MFA lub kod zapasowy')).toHaveValue('')
  })

  it('does not close current session after revoking others and reloads their status', async () => {
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await user.click(await screen.findByRole('button', { name: 'Zakończ pozostałe sesje' }))
    await user.type(screen.getByLabelText('Aktualne hasło konta', { exact: true }), 'secret')
    await user.type(screen.getByLabelText('Kod MFA lub kod zapasowy'), '123456')
    vi.mocked(securityMutation).mockResolvedValue({ detail: 'Pozostałe sesje zakończone.', current_session_revoked: false })
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...data, count: 1, results: data.results.slice(0, 1) })
    await user.click(screen.getByRole('button', { name: 'Potwierdź zakończenie sesji' }))
    await screen.findByText('Aktywne sesje (1)')
    expect(navigateAfterSecurityChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Zakończ pozostałe sesje' })).toBeDisabled()
  })

  it('keeps entered password but clears an MFA code after a failed operation', async () => {
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await user.click(await screen.findByRole('button', { name: 'Zakończ tę sesję' }))
    await user.type(screen.getByLabelText('Aktualne hasło konta', { exact: true }), 'secret')
    await user.type(screen.getByLabelText('Kod MFA lub kod zapasowy'), '123456')
    vi.mocked(securityMutation).mockRejectedValue(new Error('Kod nie pasuje.'))
    await user.click(screen.getByRole('button', { name: 'Potwierdź zakończenie sesji' }))
    await screen.findByText('Kod nie pasuje.')
    expect(screen.getByLabelText('Aktualne hasło konta', { exact: true })).toHaveValue('secret')
    expect(screen.getByLabelText('Kod MFA lub kod zapasowy')).toHaveValue('')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
  })

  it('uses its own page parameter rather than following an API-supplied URL', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...data, next: 'https://untrusted.example.test/leak' })
    const user = userEvent.setup(); render(<BezpieczenstwoKonta />)
    await user.click(await screen.findByRole('button', { name: 'Następna' }))
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith('/accounts/sessions/?page=2', expect.objectContaining({ cache: 'no-store' })))
  })

  it('MFA read failure is shown as unknown and can be retried', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ wlaczony: true, kodow_zapasowych: 4 })
    const user = userEvent.setup(); render(<DrugiSkladnik />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Włącz logowanie dwuetapowe' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ponów odczyt MFA' }))
    await screen.findByRole('button', { name: 'Wyłącz' })
  })
})
