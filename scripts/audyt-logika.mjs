/**
 * Ocena wyniku `npm audit` z listą wąskich, datowanych wyjątków.
 *
 * Po co
 * -----
 * Do 3.10.2026 bramka w CI to było `npm audit --audit-level=moderate`: każda
 * znana podatność zatrzymywała każdy PR. Tak ma zostać - podatność, która nie
 * zatrzymuje pracy, nie zostaje podbita. Problem pojawił się z `braces`:
 * zgłoszenie obejmuje wszystkie wydane wersje (≤ 3.0.3, a 3.0.3 jest ostatnią),
 * więc NIE MA czego podbić. Bramka, której nie da się spełnić, uczy ją
 * wyłączać - a wtedy przepadają też trafienia, które dało się naprawić.
 *
 * Wyjątek jest więc możliwy, ale wąski i sam się pilnuje:
 *
 *   - dotyczy jednego zgłoszenia (GHSA), nie pakietu ani poziomu wagi,
 *   - ma powód i datę przeglądu; po tej dacie bramka znów jest czerwona,
 *   - NIE MOŻE dotyczyć pakietu, który trafia do produkcji - takiego wyjątku
 *     skrypt nie przyjmie, niezależnie od powodu,
 *   - wyjątek, którego już nie trzeba (zgłoszenie zniknęło), też zapala
 *     czerwone - inaczej plik wyjątków rósłby i nikt by go nie czytał.
 *
 * Logika jest tu, bez wywołań `npm`, żeby dała się sprawdzić testami.
 * Uruchamianie poleceń i odczyt plików robi `audyt-zaleznosci.mjs`.
 */

/** Kolejność wag z `npm audit`; bramka zaczyna się od `moderate`, jak dotąd. */
export const WAGI = ['info', 'low', 'moderate', 'high', 'critical']
export const PROG = 'moderate'

/**
 * Czy waga zatrzymuje bramkę. Nieznana albo brakująca waga - TAK.
 *
 * Pierwsza wersja zwracała tu fałsz dla wagi spoza listy, bo `indexOf` daje
 * wtedy -1. Zgłoszenie z nową albo literówkową wagą po cichu wypadałoby więc
 * z bramki. Wyszło przy weryfikacji mutacyjnej: dzięki temu przypadkowi
 * odpadały też napisy z łańcucha zależności, przez co jawne sprawdzenie typu
 * niżej wyglądało na zbędne. Bramka bezpieczeństwa przy niejasnych danych
 * ma się zamknąć.
 */
function wazne(waga) {
  const pozycja = WAGI.indexOf(waga)
  return pozycja === -1 || pozycja >= WAGI.indexOf(PROG)
}

/**
 * Zgłoszenia z wyniku `npm audit --json`, sprowadzone do pierwotnych.
 *
 * `npm audit` wypisuje każdy pakiet z łańcucha zależności osobno: `braces` ma
 * zgłoszenie, a `micromatch`, `fast-glob` i dalej mają je tylko „przez" braces.
 * Wyjątek dotyczy zgłoszenia, więc liczymy tylko wpisy z własnym adresem
 * zgłoszenia - inaczej jeden wyjątek musiałby wymieniać cały łańcuch.
 *
 * @returns {Map<string, {ghsa: string, pakiet: string, waga: string, tytul: string}>}
 */
export function zgloszenia(audyt) {
  const wynik = new Map()
  for (const [pakiet, podatnosc] of Object.entries(audyt?.vulnerabilities ?? {})) {
    for (const przez of podatnosc.via ?? []) {
      // Napis to ogniwo łańcucha („przez braces"), nie zgłoszenie. Obiekt bez
      // adresu zgłoszenia NIE jest pomijany: zostaje zgłoszeniem, którego nie
      // obejmie żaden wyjątek. Przy niejasnych danych bramka ma się zamknąć.
      if (typeof przez !== 'object') continue
      if (!wazne(przez.severity)) continue
      const ghsa = String(przez.url).split('/').pop()
      wynik.set(ghsa, { ghsa, pakiet: przez.name ?? pakiet, waga: przez.severity, tytul: przez.title ?? '' })
    }
  }
  return wynik
}

/** Nazwy wszystkich pakietów z drzewa `npm ls --omit=dev --all --json`. */
export function pakietyProdukcyjne(drzewo) {
  const nazwy = new Set()
  const odwiedz = (wezel) => {
    for (const [nazwa, dziecko] of Object.entries(wezel?.dependencies ?? {})) {
      if (nazwy.has(nazwa)) continue
      nazwy.add(nazwa)
      odwiedz(dziecko)
    }
  }
  odwiedz(drzewo)
  return nazwy
}

/**
 * Wynik bramki. Pusta lista `bledy` znaczy zielone.
 *
 * @param {object} p
 * @param {object} p.audyt        wynik `npm audit --json`
 * @param {Array<{ghsa: string, pakiet: string, powod: string, przeglad_do: string}>} p.wyjatki
 * @param {Set<string>} p.produkcyjne  nazwy pakietów trafiających do produkcji
 * @param {string} p.dzis         data w formacie RRRR-MM-DD
 */
export function ocen({ audyt, wyjatki, produkcyjne, dzis }) {
  const bledy = []
  const przyjete = []
  const znalezione = zgloszenia(audyt)
  const poGhsa = new Map(wyjatki.map((w) => [w.ghsa, w]))

  for (const wyjatek of wyjatki) {
    if (!wyjatek.ghsa || !wyjatek.pakiet || !wyjatek.powod || !wyjatek.przeglad_do) {
      bledy.push(`Wyjątek ${wyjatek.ghsa || '(bez GHSA)'} musi mieć ghsa, pakiet, powod i przeglad_do.`)
      continue
    }
    if (wyjatek.przeglad_do < dzis) {
      bledy.push(
        `Wyjątek ${wyjatek.ghsa} (${wyjatek.pakiet}) miał przegląd do ${wyjatek.przeglad_do}. ` +
          'Sprawdź, czy jest już poprawiona wersja; jeśli nie, przedłuż świadomie z nową datą.',
      )
    }
    if (!znalezione.has(wyjatek.ghsa)) {
      bledy.push(
        `Wyjątek ${wyjatek.ghsa} (${wyjatek.pakiet}) nie jest już potrzebny - audyt go nie zgłasza. ` +
          'Usuń go z pliku wyjątków.',
      )
    }
  }

  for (const [ghsa, z] of znalezione) {
    const wyjatek = poGhsa.get(ghsa)
    if (wyjatek) {
      // Nazwa z audytu, nie z wyjątku: wyjątek z wpisaną inną nazwą pakietu
      // nie może przemycić podatności w kodzie, który trafia do produkcji.
      // Pierwsza wersja sprawdzała tylko nazwę zadeklarowaną w pliku wyjątków;
      // to sprawdzenie jest od niej ściśle mocniejsze, więc tamtego już nie ma.
      if (produkcyjne.has(z.pakiet)) {
        bledy.push(
          `Zgłoszenie ${ghsa} dotyczy pakietu ${z.pakiet}, który trafia do produkcji - ` +
            'wyjątek go nie obejmuje.',
        )
        continue
      }
      if (wyjatek.pakiet !== z.pakiet) {
        bledy.push(
          `Wyjątek ${ghsa} wymienia pakiet ${wyjatek.pakiet}, a audyt zgłasza ${z.pakiet}.`,
        )
        continue
      }
      przyjete.push(z)
      continue
    }
    bledy.push(`${z.waga.toUpperCase()} ${z.pakiet}: ${z.tytul} (${ghsa})`)
  }

  return { bledy, przyjete }
}
