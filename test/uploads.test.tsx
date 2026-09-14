import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '@/app/(admin)/documents/page'
import * as api from '@/lib/api'
import { uploadError } from '@/lib/uploads'

function fakeApi() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (path, options) => {
    if (path === '/documents-upload/' && options?.method === 'POST') return { message: 'ok' }
    if (path === '/knowledge/') return { gpt_prompt: '' }
    return []
  })
}

describe('limity plików przed wysłaniem', () => {
  it('blokuje pusty plik, zbyt duży plik i niedozwolony format', () => {
    expect(uploadError(new File([], 'empty.txt'), 'document')).toMatch(/pusty/)
    expect(uploadError(new File(['x'], 'logo.svg'), 'image')).toMatch(/PNG/)
    const large = new File(['x'], 'logo.png')
    Object.defineProperty(large, 'size', { value: 2 * 1024 * 1024 + 1 })
    expect(uploadError(large, 'image')).toMatch(/2 MiB/)
    expect(uploadError(new File(['x'], 'PRICE.PDF'), 'document')).toBe('')
  })

  it('wskazuje błąd przy polu i nie wysyła nieprawidłowego pliku', async () => {
    const calls = fakeApi()
    render(<DocumentsPage />)
    const input = screen.getByLabelText('Wybierz dokument do wgrania')
    const file = new File(['payload'], 'payload.html')
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Wybierz dokument PDF')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/PDF.*DOCX/)
    expect(screen.getByRole('button', { name: 'Wgraj dokument' })).toBeDisabled()
    expect(calls.mock.calls.some(([path]) => path === '/documents-upload/')).toBe(false)
  })

  it('zachowuje wybrany plik po błędzie serwera i umożliwia ponowienie', async () => {
    const calls = fakeApi()
    let attempts = 0
    calls.mockImplementation(async (path) => {
      if (path === '/documents-upload/' && ++attempts === 1) {
        throw new Error('Trwa przetwarzanie innego pliku. Spróbuj za chwilę.')
      }
      return path === '/knowledge/' ? { gpt_prompt: '' } : []
    })
    const user = userEvent.setup()
    render(<DocumentsPage />)
    const input = screen.getByLabelText('Wybierz dokument do wgrania') as HTMLInputElement
    await user.upload(input, new File(['Oferta'], 'oferta.txt', { type: 'text/plain' }))
    await user.click(screen.getByRole('button', { name: 'Wgraj dokument' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Spróbuj za chwilę')
    expect(input.files?.[0].name).toBe('oferta.txt')
    expect(screen.getByRole('button', { name: 'Wgraj dokument' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Wgraj dokument' }))
    await waitFor(() => expect(attempts).toBe(2))
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('pokazuje przyczynę nieudanego przetwarzania dokumentu', async () => {
    const calls = fakeApi()
    // Lista dokumentów jest stronicowana (F16) - ekran pyta o `/documents/?page=1`
    calls.mockImplementation(async (path) => path.startsWith('/documents/') ? [{
      id: 1, name: 'Uszkodzony plik', status: 'failed', processed: false,
      processing_error: 'Brak tekstu. Najpierw wykonaj OCR.',
      uploaded_at: '2026-09-10T12:00:00Z', chunk_count: 0,
    }] : path === '/knowledge/' ? { gpt_prompt: '' } : [])
    render(<DocumentsPage />)
    expect(await screen.findByText('Nie udało się przetworzyć')).toBeInTheDocument()
    expect(screen.getByText('Brak tekstu. Najpierw wykonaj OCR.')).toBeInTheDocument()
  })
})
