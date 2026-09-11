# Aktywacja konta — zgodność z backendem 2.0.6

Rejestracja wysyła dane firmy bez hasła. Odpowiedź 202 pokazuje ekran oczekiwania
na e-mail; nie podejmuje logowania. Hasło jest ustawiane na /potwierdz-email
dopiero po odczycie jednorazowego tokena z fragmentu linku.

Nowe ekrany /potwierdz-email i /aktywacja są publiczne, mają no-store i
no-referrer. Token trafia tylko do pamięci karty i ciał POST; nie jest zapisany
w storage ani przekazywany w Referer. Ponowne załadowanie strony wymaga powrotu
do oryginalnego e-maila. Brak tokena, wygaśnięcie, awaria sieci, błąd hasła,
ponowienie i sukces mają osobne komunikaty i dostępne działania.

Po aktywacji użytkownik loguje się. Wariant płatny prowadzi przez kontrolowany
parametr dalej=subskrypcja; żadna dowolna ścieżka ani zewnętrzny URL nie jest
akceptowana jako przekierowanie. Zaproszenie pokazuje adresata tylko do odczytu,
a automatyczne logowanie po przyjęciu przekazuje ciasteczko przez credentials.
Panel już wcześniej wysyłał max_users=1; nie było wyboru wielokrotnego użycia.

Wymagane nowe endpointy backendu:

- POST /accounts/register/ → 202.
- POST /accounts/registration/preview/ z tokenem.
- POST /accounts/registration/activate/ z tokenem i hasłem → 201.
- POST /accounts/registration/resend/ z adresem e-mail → 202.

Wdrożenia panelu i backendu należy skoordynować; chwilowa niezgodność ogranicza
nowe rejestracje. Istniejące konta nie wymagają ponownego potwierdzenia.
Instrukcja backendu obejmuje migrację, istniejący SMTP, HTTPS w FRONTEND_URL
oraz codzienną retencję zgłoszeń. Produkcyjny odbiór poczty pozostaje osobnym
krokiem po scaleniu obu PR-ów.
