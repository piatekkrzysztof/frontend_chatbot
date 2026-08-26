/**
 * Sesja panelu.
 *
 * Token dostepu zyje w pamieci tego modulu, nie w localStorage. Roznica jest
 * konkretna: localStorage przezywa zamkniecie karty i czyta go dowolny skrypt
 * dzialajacy na stronie, wlasny czy wstrzykniety. Zmienna modulu ginie razem
 * z kartą i nie ma jej gdzie odczytac.
 *
 * Token odswiezania nie przechodzi tedy w ogole -- siedzi w ciasteczku
 * HttpOnly, ktorego ten kod nie widzi i widziec nie musi. Przegladarka
 * doklada je sama do zapytania o odswiezenie.
 *
 * Cena: po odswiezeniu strony pamiec jest pusta i trzeba raz zapytac backend
 * o nowy token dostepu. To jedno dodatkowe zapytanie przy wejsciu, w zamian
 * za to, ze dwutygodniowy token nie lezy w miejscu czytelnym dla skryptow.
 */
import { API_URL } from '@/lib/api'

let tokenDostepu: string | null = null

/**
 * Odswiezanie w locie. Bez tego pola piec komponentow montujacych sie naraz
 * wysyla piec zapytan o odswiezenie -- a backend rotuje token przy kazdym,
 * wiec cztery z pieciu odpowiedzi niosa juz uniewazniony token i sesja
 * rozpada sie dokladnie w chwili, w ktorej mialo jej przybyc zycia.
 */
let odswiezanieWToku: Promise<string | null> | null = null

export function pobierzToken(): string | null {
  return tokenDostepu
}

export function ustawToken(token: string | null) {
  tokenDostepu = token
}

export function zapomnijToken() {
  tokenDostepu = null
}

/**
 * Wymienia ciasteczko odswiezania na nowy token dostepu.
 *
 * Zwraca `null`, gdy sesji juz nie ma -- to nie jest blad, tylko odpowiedz
 * "trzeba sie zalogowac". Rzucanie wyjatkiem w tym miejscu kazaloby kazdemu
 * wywolujacemu opakowywac to w try/catch, a wygasla sesja jest sytuacja
 * normalna, nie awaryjna.
 */
export async function odswiezSesje(): Promise<string | null> {
  if (odswiezanieWToku) return odswiezanieWToku

  odswiezanieWToku = (async () => {
    try {
      const odpowiedz = await fetch(`${API_URL}/accounts/token/refresh/`, {
        method: 'POST',
        // Bez tego przegladarka nie dolaczy ciasteczka do zapytania
        // miedzy panel.* a api.* -- i odswiezanie zawsze zwraca 401.
        credentials: 'include',
      })

      if (!odpowiedz.ok) {
        tokenDostepu = null
        return null
      }

      const dane = await odpowiedz.json()
      tokenDostepu = dane.access ?? null
      return tokenDostepu
    } catch {
      // Brak sieci to nie to samo co brak sesji, ale z punktu widzenia
      // wywolujacego oba znacza "nie mam teraz tokenu".
      tokenDostepu = null
      return null
    } finally {
      odswiezanieWToku = null
    }
  })()

  return odswiezanieWToku
}

/**
 * Konczy sesje po stronie serwera i czysci pamiec.
 *
 * Samo zapomnienie tokenu byloby gestem po stronie przegladarki: ciasteczko
 * zostaloby na miejscu, a token odswiezania dzialalby dalej przez dwa
 * tygodnie. Dlatego pytamy backend, a nie tylko siebie.
 */
export async function wyloguj(): Promise<void> {
  try {
    await fetch(`${API_URL}/accounts/logout/`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Nieudane wylogowanie po stronie serwera nie moze zatrzymac
    // wylogowania po stronie przegladarki -- uzytkownik kliknal "wyloguj"
    // i ma zostac wylogowany, nawet jesli siec akurat padla.
  } finally {
    zapomnijToken()
  }
}
