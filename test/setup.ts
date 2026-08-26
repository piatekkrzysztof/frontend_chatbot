import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // Sesja żyje w localStorage, więc bez czyszczenia test dziedziczy token
  // po poprzednim i wywraca się zależnie od kolejności uruchomienia — co
  // wygląda na błąd losowy i zjada wieczór.
  localStorage.clear()
  sessionStorage.clear()
})
