# Odzyskiwanie hasła

Panel dodaje `/odzyskaj-haslo`, `/reset-hasla` i link przy logowaniu.
Token z fragmentu URL jest usuwany z bieżącej historii i używany tylko
w pamięci do POST preview/confirm. Żądania mają no-store, no-referrer,
credentials: omit i limit 20 sekund obejmujący odczyt odpowiedzi.

Formularze obsługują wygasły link, ponowną prośbę, awarię połączenia, limity,
błędy walidacji i świadome zatwierdzenie hasła. Wspierają menedżery haseł,
wklejanie, widoczność hasła i klawiaturę. Po zmianie należy zalogować się
ponownie, również z MFA, jeśli było włączone. Nie ma automatycznego logowania.

Konfiguracja MFA prosi o aktualne hasło przed wygenerowaniem QR. Przesyła
je także przy potwierdzeniu kodu, przechowując tylko w pamięci formularza.
Zakończenie lub anulowanie czyści hasło i pokazany sekret.

Wdrożyć ten panel przed backendem 2.0.11, potem poczekać na live web i workera.
W przejściowym oknie nowy formularz resetu może zwrócić błąd. Obecne
logowanie i MFA pozostają zgodne. Nie potrzeba nowych zasobów ani zmiennych.
Nie cofać panelu do poprzedniej wersji, pozostawiając nowy backend: stary
formularz MFA nie przesyła wymaganego hasła.

Testy lokalne: 102 unit, 72 Playwright, TypeScript i produkcyjna budowa;
wizualna kontrola telefonu 375 px i desktopu. API i poczta są atrapami.
Rzeczywisty odbiór wiadomości resetującej należy sprawdzić po wdrożeniu
na wydzielonym koncie i kontrolowanej skrzynce, po zgodzie właściciela.
