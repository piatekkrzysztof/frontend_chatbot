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
 * Sens w kontekscie tej przebudowy: token odswiezania jest juz niewidoczny
 * dla skryptow, ale token dostepu zyje w pamieci karty i wstrzykniety skrypt
 * moglby go stamtad wyslac. Najmocniejsza czescia tej polityki jest wiec
 * `connect-src` -- nawet skrypt, ktoremu uda sie wykonac, nie ma dokad
 * wyslac tego, co przeczyta.
 *
 * Czego tu NIE ma i dlaczego: `script-src` nie uzywa nonce ani
 * 'strict-dynamic'. Nonce powstaje osobno dla kazdego zadania, a Next
 * generuje wiekszosc tych stron przy budowaniu -- w pliku zapisanym na dysku
 * nie ma jak umiescic wartosci, ktora jeszcze nie istnieje. Sprawdzone:
 * z nonce zadna ze stron nie wstawala, bo 'strict-dynamic' uniewaznia 'self'
 * i przegladarka blokowala wszystkie wlasne chunki Next.js.
 *
 * Zostaje wiec 'self' plus 'unsafe-inline'. To jest slabsze i nie udaje, ze
 * jest inaczej: nie zatrzyma skryptu wstrzyknietego w tresc strony. Nadal
 * jednak blokuje wciagniecie skryptu z cudzego serwera, wyslanie
 * czegokolwiek pod obcy adres, przepisanie adresu bazowego, wyslanie
 * formularza gdzie indziej i osadzenie panelu w cudzej ramce.
 *
 * Mocniejsza wersja wymagalaby renderowania kazdej strony na zadanie.
 * Do rozwazenia, gdy panel przestanie byc aplikacja klienta.
 */
function politykaTresci() {
  return [
    "default-src 'self'",
    // Wlasne skrypty i te w tresci strony -- Next wstawia w prerenderowany
    // dokument ladunek RSC jako skrypt w tresci.
    "script-src 'self' 'unsafe-inline'",
    // Stylu nie da sie uzyc do wyslania tokenu, a React i Tailwind
    // ustawiaja style w atrybutach elementow.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    // Najwazniejsza linia: adres backendu i nic wiecej. Skrypt, ktory
    // odczyta token z pamieci, nie ma dokad go wyslac.
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

/** Ta sama nazwa co NAZWA_CIASTECZKA_SESJI po stronie Django. */
const ZNACZNIK_SESJI = 'sesja_panelu'

/** Trasy panelu -- wymagaja sesji. */
const CHRONIONE = [
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

  return zNaglowkami()
}

/** Przepuszcza zadanie, dokladajac polityke bezpieczenstwa. */
function zNaglowkami() {
  const odpowiedz = NextResponse.next()
  odpowiedz.headers.set('Content-Security-Policy', politykaTresci())
  return odpowiedz
}

export const config = {
  /**
   * Poza zasiegiem: pliki statyczne oraz `/widget`, ktory z zalozenia
   * dziala bez sesji panelu -- odwiedzajacy strone klienta nie ma konta
   * i nie moze zostac odbity na logowanie.
   */
  matcher: ['/((?!_next/static|_next/image|widget|embed.js|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
}
