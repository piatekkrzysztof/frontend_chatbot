import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom nie implementuje scrollIntoView -- nie ma tam czego przewijac, bo nie
// ma silnika ukladu. Komponenty, ktore przewijaja do najnowszej wiadomosci,
// wywracaly sie przez to w tescie mimo poprawnego dzialania w przegladarce.
// Atrapa zamiast zmiany w komponencie: to brak w narzedziu, nie w produkcie.
Element.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // Sesja żyje w localStorage, więc bez czyszczenia test dziedziczy token
  // po poprzednim i wywraca się zależnie od kolejności uruchomienia — co
  // wygląda na błąd losowy i zjada wieczór.
  localStorage.clear()
  sessionStorage.clear()
})
