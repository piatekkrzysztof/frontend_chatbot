/**
 * Ochrona tras po stronie serwera.
 *
 * Plik nazywa sie `proxy.ts`, nie `middleware.ts`: Next 16 uznal poprzednia
 * nazwe za przestarzala i ostrzega o niej przy kazdym budowaniu.
 *
 * Wczesniej decydowal o tym `withAuth`: komponent renderowal panel i dopiero
 * w efekcie sprawdzal token, wiec chroniona tresc migala na ekranie, zanim
 * przegladarka zdazyla przekierowac. Middleware odpowiada, zanim cokolwiek
 * dojdzie do przegladarki -- migac nie ma czemu.
 *
 * Czego to NIE jest: uwierzytelnieniem. Znacznik `sesja_panelu` niesie sama
 * jedynke i da sie go podrobic. Podrobienie daje tyle, ze panel sie
 * wyrenderuje i natychmiast dostanie 401 z API, bo prawdziwym straznikiem
 * jest token dostepu sprawdzany przez backend. Tutaj chodzi wylacznie o to,
 * zeby nie pokazywac szkieletu panelu komus, kto i tak nie zobaczy danych,
 * i zeby nie kazac zalogowanemu ogladac ekranu logowania.
 *
 * Middleware nie moze zweryfikowac podpisu tokenu, bo nie ma klucza Django --
 * i nie powinno go miec. Klucz na serwerze frontendu to drugie miejsce,
 * z ktorego dalo by sie go wykrasc.
 */
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Adres API musi byc wymieniony w connect-src, inaczej CSP zablokuje
 * KAZDE zapytanie panelu do backendu -- lacznie z odswiezaniem sesji.
 */
const ZRODLO_API = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').origin
  } catch {
    return ''
  }
})()

/**
 * Polityka bezpieczenstwa tresci.
 *
 * Sens: token odswiezania jest niewidoczny dla skryptow, ale token dostepu
 * zyje w pamieci karty i wstrzykniety skrypt moglby go stamtad wyslac.
 * Polityka dziala wiec na dwa sposoby: nie pozwala takiemu skryptowi sie
 * wykonac (`script-src` z nonce) i nie daje mu dokad wyslac tego, co
 * przeczyta (`connect-src`).
 *
 * Dlaczego nonce, skoro poprzednia proba sie nie udala
 * ----------------------------------------------------
 * Nonce powstaje osobno dla kazdego zadania, a Next generowal wszystkie te
 * strony przy budowaniu - w pliku zapisanym na dysku nie ma jak umiescic
 * wartosci, ktora jeszcze nie istnieje. Efekt byl taki, ze `strict-dynamic`
 * uniewazniał `self`, a przegladarka blokowala wszystkie chunki Next.js
 * i zadna strona nie wstawala.
 *
 * Brakowalo dwoch rzeczy naraz, nie jednej:
 *
 *  1. Nonce musi trafic do naglowkow ZADANIA, nie tylko odpowiedzi. Next
 *     czyta go stamtad i sam doklein do swoich skryptow. Bez tego naglowek
 *     odpowiedzi obiecuje nonce, ktorego w HTML nie ma.
 *  2. Strony musza byc renderowane na zadanie. Odczyt `headers()` w ukladzie
 *     korzenia wypisuje cala aplikacje ze statycznego prerenderowania.
 *
 * Koszt: kazda strona powstaje na serwerze zamiast lezec gotowa. Dla panelu
 * to niewiele - wszystkie ekrany sa i tak komponentami klienta, ktore pobieraja
 * dane po zamontowaniu, wiec prerenderowana byla sama pusta powloka.
 *
 * `/widget` jest poza zasiegiem tego middleware i ma wlasny naglowek
 * w next.config.js - polityka panelu z `frame-ancestors 'self'`
 * uniemozliwilaby osadzenie go na stronie klienta.
 */
function politykaTresci(nonce: string) {
  return [
    "default-src 'self'",
    // Skrypty wylacznie z nonce. `strict-dynamic` przenosi zaufanie z tego
    // skryptu na chunki, ktore on sam wciaga - bez tego kazdy plik Next.js
    // trzeba by wymieniac z osobna.
    //
    // 'unsafe-eval' TYLKO w trybie deweloperskim. React uzywa eval() do
    // odtwarzania stosu wywolan przy debugowaniu. W produkcji nie uzywa go
    // wcale, a to jest dokladnie ta furtka, ktora zamienia wstrzykniety napis
    // w wykonany kod.
    `script-src 'nonce-${nonce}' 'strict-dynamic'${
      process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
    }`,
    // Stylu nie da sie uzyc do wyslania tokenu, a React i Tailwind ustawiaja
    // style w atrybutach elementow. Tu 'unsafe-inline' zostaje swiadomie.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    // Adres backendu i nic wiecej. Skrypt, ktory odczyta token z pamieci,
    // nie ma dokad go wyslac.
    `connect-src 'self' ${ZRODLO_API}`.trim(),
    // Panel nie osadza niczego obcego i nie ma wtyczek
    "object-src 'none'",
    "frame-src 'none'",
    // Blokuje przepisanie adresu bazowego -- sztuczke, ktora zamienia
    // wzgledne adresy skryptow na cudze
    "base-uri 'self'",
    // Formularz logowania nie ma prawa wyslac hasla pod obcy adres
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * Losowy nonce na zadanie.
 *
 * `crypto.randomUUID` jest dostepne w srodowisku uruchomieniowym middleware
 * i jest kryptograficznie losowe. Nonce przewidywalny nie chroni przed
 * niczym: napastnik wpisalby go po prostu do wstrzyknietego skryptu.
 */
function nowyNonce() {
  return btoa(crypto.randomUUID())
}

/** Ta sama nazwa co NAZWA_CIASTECZKA_SESJI po stronie Django. */
const ZNACZNIK_SESJI = 'sesja_panelu'

/**
 * Trasy panelu -- wymagaja sesji.
 *
 * Eksportowane, zeby test przegladarkowy mogl przejsc po tej samej liscie,
 * z ktorej korzysta middleware. Wlasna kopia listy w tescie znaczylaby, ze
 * nowy ekran dopisany tutaj nie zostaje sprawdzony - a wlasnie tak przez
 * dlugi czas `/widget-settings` byl wymieniony jako chroniony i nie byl.
 */
export const CHRONIONE = [
  '/dashboard',
  '/conversations',
  '/documents',
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

/** Ekrany, ktorych zalogowany nie ma po co ogladac. */
const TYLKO_DLA_NIEZALOGOWANYCH = ['/login', '/rejestracja']

export function proxy(zadanie: NextRequest) {
  const sciezka = zadanie.nextUrl.pathname
  const maSesje = zadanie.cookies.has(ZNACZNIK_SESJI)

  const chroniona = CHRONIONE.some(
    (trasa) => sciezka === trasa || sciezka.startsWith(`${trasa}/`),
  )

  if (chroniona && !maSesje) {
    const cel = new URL('/login', zadanie.url)
    // Dokad uzytkownik zmierzal, zeby po zalogowaniu wrocic tam, a nie na
    // pulpit. Bez tego kazdy link do konkretnego ekranu wysylany zespolowi
    // konczy sie na pulpicie i trzeba szukac reczne.
    cel.searchParams.set('powrot', sciezka)
    return NextResponse.redirect(cel)
  }

  // Znacznik sesji lezy w przegladarce dwa tygodnie, ale token odswiezania
  // moze przestac dzialac wczesniej -- po wylogowaniu z innego urzadzenia,
  // po uniewaznieniu, albo gdy backend akurat nie odpowiada. Panel odsyla
  // wtedy na /login?wygasla=1. Bez tego wyjatku middleware odbijaloby taki
  // powrot z powrotem do panelu, panel znow na /login, i przegladarka
  // kreciłaby sie w petli az do bledu "zbyt wiele przekierowan".
  const sesjaWlasnieUmarla = zadanie.nextUrl.searchParams.has('wygasla')

  if (maSesje && !sesjaWlasnieUmarla && TYLKO_DLA_NIEZALOGOWANYCH.includes(sciezka)) {
    return NextResponse.redirect(new URL('/dashboard', zadanie.url))
  }

  if (maSesje && sciezka === '/') {
    return NextResponse.redirect(new URL('/dashboard', zadanie.url))
  }

  return zNaglowkami(zadanie)
}

/**
 * Przepuszcza zadanie, dokladajac polityke bezpieczenstwa.
 *
 * Polityka jedzie w OBIE strony. Na zadaniu czyta ja Next i doklein nonce do
 * swoich skryptow; na odpowiedzi czyta ja przegladarka i egzekwuje. Ustawienie
 * jej tylko na odpowiedzi daje naglowek obiecujacy nonce, ktorego w HTML nie
 * ma - czyli biala strone.
 */
function zNaglowkami(zadanie: NextRequest) {
  const polityka = politykaTresci(nowyNonce())

  const naglowkiZadania = new Headers(zadanie.headers)
  naglowkiZadania.set('Content-Security-Policy', polityka)

  const odpowiedz = NextResponse.next({ request: { headers: naglowkiZadania } })
  odpowiedz.headers.set('Content-Security-Policy', polityka)
  return odpowiedz
}

export const config = {
  /**
   * Poza zasiegiem: pliki statyczne oraz `/widget`, ktory z zalozenia dziala
   * bez sesji panelu -- odwiedzajacy strone klienta nie ma konta i nie moze
   * zostac odbity na logowanie. Widget dostaje wlasna polityke (patrz nizej),
   * bo `frame-ancestors 'self'` z polityki panelu uniemozliwiloby osadzenie
   * go na stronie klienta.
   *
   * `widget(?:/|$)` zamiast samego `widget` -- i to nie jest kosmetyka.
   * Poprzedni wzorzec dopasowywal PREFIKS, wiec wykluczal takze
   * `/widget-settings`: ekran panelu wymieniony w CHRONIONE, ktory przez to
   * nie byl chroniony wcale i nie dostawal ZADNEJ polityki bezpieczenstwa.
   * Wchodzil na niego kazdy, bez sesji, a token dostepu zyje na tej stronie
   * w pamieci karty. Sprawdzone w przegladarce: bez sesji `/dashboard`
   * odbijalo na logowanie, a `/widget-settings` po prostu sie otwieral.
   *
   * `embed\.js` z kropka uciekniona, bo niepoprzedzona kropka w wyrazeniu
   * regularnym znaczy "dowolny znak" i wykluczala takze `embedXjs`.
   */
  matcher: [
    '/((?!_next/static|_next/image|widget(?:/|$)|embed\.js|favicon\.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
  ],
}
