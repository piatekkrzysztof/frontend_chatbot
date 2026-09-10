export type UploadKind = 'document' | 'image'

export const uploadRules = {
  document: {
    accept: '.pdf,.docx,.txt,.md',
    bytes: 10 * 1024 * 1024,
    hint: 'PDF, DOCX, TXT lub MD · do 10 MiB. PDF do 200 stron; tekst do 2 097 152 znaków. TXT i MD w UTF-8. Skany wymagają OCR.',
    formatError: 'Wybierz dokument PDF, DOCX, TXT lub MD.',
  },
  image: {
    accept: '.png,.jpg,.jpeg,.webp',
    bytes: 2 * 1024 * 1024,
    hint: 'PNG, JPEG lub WebP · do 2 MiB, 4 mln pikseli i 4096 px na bok. Bez animacji. Obraz zostanie zmniejszony do 1024 px i zapisany jako PNG.',
    formatError: 'Wybierz obraz PNG, JPEG lub WebP bez animacji.',
  },
} as const

// A convenience check; content and resource limits are enforced by the API.
export function uploadError(file: File | null, kind: UploadKind): string {
  if (!file) return ''
  const rule = uploadRules[kind]
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!rule.accept.split(',').includes(extension)) return rule.formatError
  if (!file.size) return 'Plik jest pusty. Wybierz plik z zawartością.'
  if (file.size > rule.bytes) {
    return `Plik przekracza limit ${rule.bytes / 1024 / 1024} MiB. Wybierz mniejszy plik.`
  }
  return ''
}

export function documentStatus(status: string): string {
  return ({
    ready: 'Gotowy',
    processing: 'Przetwarzanie',
    processed_no_chunks: 'Tekst odczytany — brak fragmentów',
    failed: 'Nie udało się przetworzyć',
  } as Record<string, string>)[status] || 'Status niedostępny'
}
