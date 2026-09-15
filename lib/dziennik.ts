/**
 * Tłumaczenie wpisów dziennika na język, którym mówi właściciel firmy.
 *
 * Backend zapisuje metodę, ścieżkę i wynik - `DELETE /api/faq/12/ 204`. To
 * jest precyzyjne i wystarcza do dochodzenia, ale człowiek, który chce
 * wiedzieć, kto skasował mu bazę wiedzy, nie powinien czytać HTTP.
 *
 * Reguła nadrzędna: nieznana ścieżka pokazuje SUROWE dane, zamiast udawać, że
 * ją rozumie. Dziennik, który dla nieznanego wpisu wypisuje "Inna operacja",
 * gubi dokładnie te zdarzenia, których nikt się nie spodziewał - a to one są
 * najciekawsze po włamaniu.
 */

type Regula = {
  metoda: string
  wzorzec: RegExp
  opis: string
}

/**
 * Kolejność ma znaczenie: pierwsza pasująca wygrywa, więc ścieżki bardziej
 * szczegółowe muszą stać przed ogólnymi.
 */
const REGULY: Regula[] = [
  // Dostęp do konta
  { metoda: 'POST', wzorzec: /^\/api\/accounts\/login\/$/, opis: 'Logowanie' },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/login\/2fa\/$/,
    opis: 'Logowanie - drugi krok',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/logout\/$/,
    opis: 'Wylogowanie',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/register\/$/,
    opis: 'Założenie konta',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/registration\/activate\/$/,
    opis: 'Założenie konta - potwierdzenie adresu',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/accept-invite\/$/,
    opis: 'Dołączenie do zespołu z zaproszenia',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/password-reset\/confirm\/$/,
    opis: 'Ustawienie nowego hasła z linku',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/password-change\/$/,
    opis: 'Zmiana hasła',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/sessions\/revoke-others\/$/,
    opis: 'Wylogowanie z pozostałych urządzeń',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/sessions\/[0-9a-f-]{36}\/revoke\/$/,
    opis: 'Wylogowanie wybranego urządzenia',
  },

  // Drugi składnik
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/2fa\/potwierdz\/$/,
    opis: 'Włączenie logowania dwuetapowego',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/2fa\/wylacz\/$/,
    opis: 'Wyłączenie logowania dwuetapowego',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/2fa\/rozpocznij\/$/,
    opis: 'Rozpoczęcie konfiguracji logowania dwuetapowego',
  },

  // Baza wiedzy
  { metoda: 'POST', wzorzec: /^\/api\/faq\/$/, opis: 'Dodanie pytania do FAQ' },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/faq\/\d+\/$/,
    opis: 'Usunięcie pytania z FAQ',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/faq\/\d+\/$/,
    opis: 'Zmiana pytania w FAQ',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/documents-upload\/$/,
    opis: 'Wgranie dokumentu',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/documents\/\d+\/$/,
    opis: 'Usunięcie dokumentu',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/website-sources\/$/,
    opis: 'Dodanie strony WWW do wiedzy',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/website-sources\/\d+\/$/,
    opis: 'Usunięcie strony WWW',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/website-sources\/\d+\/recrawl\/$/,
    opis: 'Ponowne pobranie strony WWW',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/documents\/\d+\/wyszukiwanie\/$/,
    opis: 'Włączenie lub wyłączenie dokumentu w odpowiedziach',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/knowledge\/$/,
    opis: 'Zmiana ustawień wiedzy bota',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/chat\/import\/$/,
    opis: 'Import historii rozmów z pliku',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/chat\/test\/$/,
    opis: 'Rozmowa testowa w panelu',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/chat\/test\/$/,
    opis: 'Wyczyszczenie rozmowy testowej',
  },

  // Dane, które wychodzą na zewnątrz. Wyróżnione, bo to jedyne wpisy mówiące
  // o tym, że ktoś zabrał dane POZA system - i o nie pyta się po incydencie.
  // Backend zapisuje te dwa odczyty mimo metody GET. Eksport nie ma reguły dla
  // POST: taki wpis byłby odrzuconym żądaniem, a opis mówiłby o eksporcie.
  {
    metoda: 'GET',
    wzorzec: /^\/api\/chat\/export\/$/,
    opis: 'Eksport rozmów do pliku',
  },
  {
    metoda: 'GET',
    wzorzec: /^\/api\/documents\/\d+\/download\/$/,
    opis: 'Pobranie pliku dokumentu',
  },

  // Ustawienia
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/accounts\/firma\/$/,
    opis: 'Zmiana danych firmy',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/accounts\/dane-rozliczeniowe\/$/,
    opis: 'Zmiana danych do faktury',
  },
  {
    metoda: 'PUT',
    wzorzec: /^\/api\/accounts\/dane-rozliczeniowe\/$/,
    opis: 'Zmiana danych do faktury',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/widget-settings\/mine\/$/,
    opis: 'Zmiana ustawień widgetu',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/widget-domains\/$/,
    opis: 'Dodanie domeny widgetu',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/widget-domains\/\d+\/$/,
    opis: 'Usunięcie domeny widgetu',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/privacy\/$/,
    opis: 'Zmiana ustawień prywatności',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/privacy\/conversations\/[0-9a-f-]{36}\/$/,
    opis: 'Usunięcie danych rozmowy na żądanie',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/contact-requests\/\d+\/$/,
    opis: 'Zmiana statusu zapytania kontaktowego',
  },

  // Zespół
  {
    metoda: 'POST',
    wzorzec: /^\/api\/accounts\/invitations\/$/,
    opis: 'Zaproszenie osoby do zespołu',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/accounts\/invitations\/\d+\/$/,
    opis: 'Cofnięcie zaproszenia',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/users\/$/,
    opis: 'Dodanie osoby do zespołu',
  },
  {
    metoda: 'PATCH',
    wzorzec: /^\/api\/users\/\d+\/$/,
    opis: 'Zmiana osoby w zespole',
  },
  {
    metoda: 'DELETE',
    wzorzec: /^\/api\/users\/\d+\/$/,
    opis: 'Usunięcie osoby z zespołu',
  },

  // Rozliczenia
  {
    metoda: 'POST',
    wzorzec: /^\/api\/billing\/create-checkout-session\/$/,
    opis: 'Rozpoczęcie płatności',
  },
  {
    metoda: 'POST',
    wzorzec: /^\/api\/billing\/portal\/$/,
    opis: 'Otwarcie portalu płatności',
  },
]

/** Czy operacja się powiodła. 4xx i 5xx to odmowa albo awaria. */
export function udana(status: number): boolean {
  return status >= 200 && status < 300
}

/**
 * Opis wpisu po polsku, albo surowe dane, gdy ścieżka jest nieznana.
 *
 * Zwracamy też `rozpoznane`, żeby widok mógł pokazać nieznany wpis inaczej -
 * czytelnik ma widzieć, że to nie jest opis, tylko zapis techniczny.
 */
export function opiszWpis(metoda: string, sciezka: string): { opis: string; rozpoznane: boolean } {
  for (const regula of REGULY) {
    if (regula.metoda === metoda && regula.wzorzec.test(sciezka)) {
      return { opis: regula.opis, rozpoznane: true }
    }
  }

  return { opis: `${metoda} ${sciezka}`, rozpoznane: false }
}
