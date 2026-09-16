/**
 * Eksport rozmow i pobranie pliku dokumentu.
 *
 * Kategoria ryzyka: FUNKCJA BEZ DROGI. Backend obie rzeczy potrafil od dawna,
 * pilnuje przy nich uprawnien i zapisuje je w dzienniku - ale panel nie mial
 * czym ich wywolac. Klient nie mogl odzyskac wlasnych rozmow ani pliku, ktory
 * sam wgral, a ekran Dziennik obiecywal "eksporty danych" wsrod zdarzen,
 * ktorych nie dalo sie wykonac.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsPage from '@/app/(admin)/conversations/page'
import DocumentsPage from '@/app/(admin)/documents/page'
import * as api from '@/lib/api'
import { BladApi } from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

function dokument(zmiany: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'cennik.pdf',
    processed: true,
    uploaded_at: '2026-09-14T10:00:00Z',
    chunk_count: 2,
    status: 'ready',
    uzywaj_w_wyszukiwaniu: true,
    source_url: '',
    ma_plik: true,
    ...zmiany,
  }
}

function backendDokumentow(dokumenty: unknown[]) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka === '/website-sources/') return [] as never
    if (sciezka === '/knowledge/') return { gpt_prompt: '' } as never
    if (sciezka.startsWith('/documents/?page=')) {
      return {
        count: dokumenty.length,
        next: null,
        previous: null,
        results: dokumenty,
      } as never
    }
    throw new Error(`nieoczekiwane ${sciezka}`)
  })
}

function backendRozmow() {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (sciezka: string) => {
    if (sciezka.startsWith('/chat/logs/?page=')) {
      return {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 7,
            conversation_session_id: '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f',
            prompt: 'Jakie macie godziny?',
            response: 'Pon-pt 9-18.',
            source: 'faq',
            tokens: 12,
            created_at: '2026-09-14T10:00:00Z',
            is_helpful: null,
          },
        ],
      } as never
    }
    throw new Error(`nieoczekiwane ${sciezka}`)
  })
}

describe('Eksport rozmow', () => {
  it('przycisk woła eksport tej samej koncowki, ktora zapisuje dziennik', async () => {
    backendRozmow()
    const plik = vi.spyOn(api, 'pobierzPlik').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ConversationsPage />)

    await user.click(await screen.findByRole('button', { name: 'Pobierz CSV' }))

    expect(plik).toHaveBeenCalledWith('/chat/export/', 'rozmowy.csv')
  })

  it('odmowa dla roli podgladu mowi po polsku, nie komunikatem z DRF', async () => {
    backendRozmow()
    vi.spyOn(api, 'pobierzPlik').mockRejectedValue(
      new BladApi(403, 'You do not have permission to perform this action.'),
    )
    const user = userEvent.setup()
    render(<ConversationsPage />)

    await user.click(await screen.findByRole('button', { name: 'Pobierz CSV' }))

    const komunikat = await screen.findByRole('alert')
    expect(komunikat).toHaveTextContent('Eksport rozmów jest dostępny dla właściciela i pracownika.')
    expect(komunikat).not.toHaveTextContent('permission')
  })
})

describe('Pobranie dokumentu', () => {
  it('woła pobranie pliku pod nazwa dokumentu', async () => {
    backendDokumentow([dokument()])
    const plik = vi.spyOn(api, 'pobierzPlik').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<DocumentsPage />)

    await user.click(await screen.findByRole('button', { name: 'Pobierz cennik.pdf' }))

    expect(plik).toHaveBeenCalledWith('/documents/1/download/', 'cennik.pdf')
  })

  it('dokument z importu strony nie dostaje przycisku', async () => {
    // Taki wpis ma tresc, ale nie ma pliku. Przycisk przy nim prowadzilby do
    // 404, a klient nie odroznilby tego od awarii.
    backendDokumentow([
      dokument(),
      dokument({ id: 2, name: 'Strona firmy', ma_plik: false, source_url: 'https://firma.pl' }),
    ])
    render(<DocumentsPage />)

    expect(await screen.findByRole('button', { name: 'Pobierz cennik.pdf' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Strona firmy')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Pobierz Strona firmy/ })).not.toBeInTheDocument()
  })
})
