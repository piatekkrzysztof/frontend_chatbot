/**
 * Trasy panelu -- wymagaja sesji.
 *
 * Jedna lista dla middleware (proxy.ts), ekranu logowania i testow. Wlasna
 * kopia gdziekolwiek znaczylaby, ze nowy ekran dopisany tutaj nie zostaje
 * sprawdzony - a wlasnie tak przez dlugi czas `/widget-settings` byl
 * wymieniony jako chroniony i nie byl, a `/dziennik` nie byl wymieniony wcale
 * (audyt 2026-10, A-10). test/trasy.test.tsx porownuje te liste z katalogiem
 * app/(panel)/(admin).
 *
 * Osobny plik, nie proxy.ts: ekran logowania jest komponentem klienta,
 * a import proxy.ts wciagnalby do paczki przegladarki next/server.
 */
export const CHRONIONE = [
  '/dashboard',
  '/conversations',
  '/documents',
  '/dziennik',
  '/faq',
  '/leads',
  '/platnosc',
  '/privacy',
  '/stan',
  '/subskrypcja',
  '/team',
  '/test-bota',
  '/ustawienia',
  '/widget-settings',
]

export function czyChroniona(sciezka: string) {
  return CHRONIONE.some((trasa) => sciezka === trasa || sciezka.startsWith(`${trasa}/`))
}

/**
 * Dokad po zalogowaniu.
 *
 * proxy.ts odbija niezalogowanego z chronionego ekranu na
 * `/login?powrot=<sciezka>`. Do audytu 2026-10 (A-11) logowanie ten parametr
 * pomijalo i link do konkretnego ekranu konczyl sie na pulpicie.
 *
 * Przyjmujemy wylacznie sciezke (litery, cyfry, myslniki, ukosniki miedzy
 * nimi) z listy CHRONIONE. Bez tego `?powrot=//obca.strona` albo
 * `https://...` w podeslanym linku przekierowywaloby po zalogowaniu na
 * cudza strone.
 *
 * Za sciezka moga isc parametry (`/conversations?page=3`): link do konkretnej
 * strony listy gubil je i konczyl na pierwszej. Parametry przechodza tylko
 * w waskim alfabecie - bez ukosnikow, dwukropkow i znakow, z ktorych daloby
 * sie zlozyc inny adres.
 */
export function celPoZalogowaniu(zapytanie: string): string {
  const parametry = new URLSearchParams(zapytanie)
  if (parametry.get('dalej') === 'subskrypcja') return '/subskrypcja'
  const powrot = parametry.get('powrot') ?? ''
  const [sciezka, ...reszta] = powrot.split('?')
  if (!/^(\/[a-z0-9-]+)+$/i.test(sciezka) || !czyChroniona(sciezka)) return '/dashboard'
  const zapytaniePowrotu = reszta.join('?')
  if (!zapytaniePowrotu) return sciezka
  return /^[a-z0-9_.~%=&-]{1,200}$/i.test(zapytaniePowrotu) ? `${sciezka}?${zapytaniePowrotu}` : sciezka
}
