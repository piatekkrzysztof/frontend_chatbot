import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrugiSkladnik from '@/components/ustawienia/DrugiSkladnik'
import { apiFetch } from '@/lib/api'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,test' } }))

describe('MFA password confirmation', () => {
  it('includes password in both steps and clears it on success', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ wlaczony: false, kodow_zapasowych: 0 })
      .mockResolvedValueOnce({ sekret: 'synthetic', adres_otpauth: 'otpauth://synthetic' })
      .mockResolvedValueOnce({ kody_zapasowe: ['backup-synthetic'] })
    const user = userEvent.setup()
    render(<DrugiSkladnik />)
    await user.type(await screen.findByLabelText('Aktualne hasło'), '  Correct!Password  ')
    await user.click(screen.getByRole('button', { name: 'Włącz logowanie dwuetapowe' }))
    await user.type(await screen.findByLabelText('Kod z aplikacji'), '123456')
    await user.click(screen.getByRole('button', { name: 'Potwierdź i włącz' }))
    await screen.findByText('Zapisz kody zapasowe')
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[1][1]?.body))).toEqual({ haslo: '  Correct!Password  ' })
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[2][1]?.body))).toEqual({ haslo: '  Correct!Password  ', kod: '123456' })
    expect(localStorage.length + sessionStorage.length).toBe(0)
  })

  it('cancellation clears the password and QR', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ wlaczony: false, kodow_zapasowych: 0 })
      .mockResolvedValueOnce({ sekret: 'synthetic', adres_otpauth: 'otpauth://synthetic' })
    const user = userEvent.setup()
    render(<DrugiSkladnik />)
    await user.type(await screen.findByLabelText('Aktualne hasło'), 'Correct!Password')
    await user.click(screen.getByRole('button', { name: 'Włącz logowanie dwuetapowe' }))
    await user.click(await screen.findByRole('button', { name: 'Anuluj konfigurację' }))
    await waitFor(() => expect(screen.getByLabelText('Aktualne hasło')).toHaveValue(''))
    expect(screen.queryByAltText('Kod QR do aplikacji uwierzytelniającej')).not.toBeInTheDocument()
  })
})
