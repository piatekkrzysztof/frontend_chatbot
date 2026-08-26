/**
 * Warstwa wywolan do API panelu.
 *
 * Token dostepu zyje 15 minut, wiec wygasa w trakcie normalnej pracy --
 * nie raz na dobe, tylko regularnie. Dlatego 401 nie jest tu od razu koncem
 * sesji: najpierw probujemy wymienic ciasteczko odswiezania na nowy token
 * i powtorzyc zadanie. Dopiero gdy to sie nie uda, uzytkownik idzie na
 * ekran logowania.
 *
 * Bez tego ponowienia panel wyrzucalby wszystkich co kwadrans.
 */
import { odswiezSesje, pobierzToken, zapomnijToken } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

/**
 * Naglowek uwierzytelniajacy do wywolan, ktore musza ominac apiFetch.
 *
 * Strumienie SSE potrzebuja surowego `Response.body`, a apiFetch zwraca juz
 * sparsowany JSON -- stad ten wyjatek. Jedno miejsce, w ktorym powstaje ten
 * naglowek, zeby nie rozjechal sie z reszta.
 */
export function authHeaders(): Record<string, string> {
  const token = pobierzToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Odsyla na ekran logowania, czyszczac przy okazji stan aplikacji. */
function naEkranLogowania() {
  if (typeof window === 'undefined') return
  // Celowo pelne przeladowanie, nie router.push: po wygasnieciu sesji
  // chcemy wyczyscic caly stan aplikacji, zeby dane poprzedniego
  // uzytkownika nie zostaly w pamieci komponentow.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  // Parametr mowi middleware, ze sesja wlasnie umarla, wiec ma NIE odbijac
  // tego powrotu do panelu mimo wciaz lezacego znacznika sesji.
  window.location.href = '/login?wygasla=1'
}

function zbudujNaglowki(opcje: RequestInit): Headers {
  const naglowki = new Headers(opcje.headers)

  const token = pobierzToken()
  if (token) naglowki.set('Authorization', `Bearer ${token}`)

  // Przy FormData przegladarka musi sama dopisac granice multipart.
  // Ustawienie Content-Type recznie zabiera jej te mozliwosc i backend
  // dostaje wieloczesciowe cialo, ktorego nie potrafi rozlozyc.
  if (!(opcje.body instanceof FormData) && !naglowki.has('Content-Type') && opcje.body) {
    naglowki.set('Content-Type', 'application/json')
  }

  return naglowki
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await wyslij(path, options)

  if (response.status === 401) {
    // Jedno podejscie, nie petla: gdyby swiezy token tez wracal z 401,
    // ponawianie w kolko zamienia wygasla sesje w atak na wlasny backend.
    const nowyToken = await odswiezSesje()

    if (nowyToken) {
      const powtorzona = await wyslij(path, options)
      if (powtorzona.status !== 401) return odczytaj(powtorzona)
    }

    zapomnijToken()
    naEkranLogowania()
    throw new Error('Sesja wygasła. Zaloguj się ponownie.')
  }

  return odczytaj(response)
}

function wyslij(path: string, opcje: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...opcje,
    headers: zbudujNaglowki(opcje),
    // Ciasteczko odswiezania nie doklei sie samo do zapytania miedzy
    // panel.* a api.* -- to sa rozne adresy pochodzenia, mimo wspolnej domeny.
    credentials: 'include',
  })
}

async function odczytaj(response: Response) {
  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      detail = data.detail || data.error || JSON.stringify(data)
    } catch {
      // brak tresci JSON w odpowiedzi bledu
    }
    throw new Error(detail)
  }

  if (response.status === 204) return null
  return response.json()
}

export { API_URL }
