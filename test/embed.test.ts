/**
 * Skrypt osadzenia (`public/embed.js`).
 *
 * Kategoria ryzyka: CUDZA STRONA. To jedyny plik, ktory klient wkleja u siebie.
 * Bledy nie objawiaja sie u nas -- objawiaja sie na jego stronie, przed jego
 * klientami, i dowiadujemy sie o nich z telefonu.
 *
 * Plik celowo nie jest modulem: ma dzialac wprost z tagu <script> na kazdej
 * stronie, takze bez builda. Dlatego test wczytuje go z dysku i wykonuje tak,
 * jak zrobilaby to przegladarka, z podstawionym `document.currentScript`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ZRODLO = readFileSync(join(import.meta.dirname, '..', 'public', 'embed.js'), 'utf8')
const NASZ_ORIGIN = 'https://panel.agencjasm-art.pl'

/** Uruchamia skrypt tak, jak przegladarka na stronie klienta. */
function osadz(atrybuty: Record<string, string> = {}) {
  const tag = document.createElement('script')
  tag.src = `${NASZ_ORIGIN}/embed.js`
  for (const [nazwa, wartosc] of Object.entries(atrybuty)) tag.setAttribute(nazwa, wartosc)
  document.head.appendChild(tag)

  Object.defineProperty(document, 'currentScript', { configurable: true, value: tag })
  new Function(ZRODLO)()
  Object.defineProperty(document, 'currentScript', { configurable: true, value: null })
  return tag
}

function przycisk() {
  return document.querySelector<HTMLButtonElement>('body > button')
}
function ramka() {
  return document.querySelector<HTMLIFrameElement>('body > iframe')
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('warunki wstepne', () => {
  it('bez data-key nie wstrzykuje niczego', () => {
    // Zle wklejony snippet ma nie zrobic nic. Martwy przycisk czatu, ktory
    // nie otwiera rozmowy, jest dla klienta gorszy niz brak czatu.
    const blad = vi.spyOn(console, 'error').mockImplementation(() => {})

    osadz({})

    expect(przycisk()).toBeNull()
    expect(blad).toHaveBeenCalled()
  })

  it('niedostepne API nie wywraca strony klienta', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('siec padla'))

    expect(() => osadz({ 'data-key': 'k', 'data-api': 'https://api.example/api' })).not.toThrow()
    await Promise.resolve()

    expect(przycisk()).not.toBeNull()
  })
})

describe('izolacja najemcy', () => {
  it('ramka wskazuje NASZ origin, nie strone klienta', () => {
    // Origin bierzemy z adresu samego <script>, nie z window.location.
    // Gdyby szedl z lokalizacji, iframe celowalby w domene klienta i czat
    // nie wstalby nigdzie poza naszym wlasnym serwisem.
    osadz({ 'data-key': 'klucz-najemcy' })
    przycisk()!.click()

    expect(new URL(ramka()!.src).origin).toBe(NASZ_ORIGIN)
  })

  it('przenosi klucz najemcy do adresu ramki, zakodowany', () => {
    osadz({ 'data-key': 'a b/c&d' })
    przycisk()!.click()

    const adres = new URL(ramka()!.src)
    expect(adres.pathname).toBe('/widget')
    expect(adres.searchParams.get('key')).toBe('a b/c&d')
  })
})

describe('otwieranie i zamykanie', () => {
  it('nie tworzy ramki, dopoki nikt nie kliknie', () => {
    // Iframe wczytuje cala aplikacje widgetu. Tworzenie go przy samym
    // wejsciu na strone obciazyloby kazdego odwiedzajacego klienta za czat,
    // ktorego wiekszosc nigdy nie otworzy.
    osadz({ 'data-key': 'k' })

    expect(ramka()).toBeNull()
  })

  it('klik otwiera, ponowny klik zamyka', () => {
    osadz({ 'data-key': 'k' })

    przycisk()!.click()
    expect(ramka()!.style.display).toBe('block')
    expect(przycisk()!.getAttribute('aria-expanded')).toBe('true')

    przycisk()!.click()
    expect(ramka()!.style.display).toBe('none')
    expect(przycisk()!.getAttribute('aria-expanded')).toBe('false')
  })

  it('Escape zamyka i oddaje ognisko przyciskowi', () => {
    // Bez tego uzytkownik klawiatury wchodzi do ramki i nie ma jak wyjsc
    // na strone klienta -- na cudzej stronie, ktorej nie kontrolujemy.
    osadz({ 'data-key': 'k' })
    przycisk()!.click()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(ramka()!.style.display).toBe('none')
    expect(document.activeElement).toBe(przycisk())
  })
})

describe('dostepnosc', () => {
  it('ramka ma tytul, a przycisk nazwe', () => {
    osadz({ 'data-key': 'k' })

    expect(przycisk()!.getAttribute('aria-label')).toBeTruthy()
    przycisk()!.click()
    expect(ramka()!.getAttribute('title')).toBeTruthy()
  })
})
