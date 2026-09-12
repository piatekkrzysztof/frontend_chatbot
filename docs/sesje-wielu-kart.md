# Sesje wielu kart i zależności — 12.09.2026

Panel z tej gałęzi należy wdrożyć przed backendem
[PR #50](https://github.com/piatekkrzysztof/chatbot_project/pull/50).
Pozostaje zgodny z backendem 2.0.8. Nie wymaga nowych usług ani zmiennych.

Wspólna blokada Web Locks koordynuje logowanie, MFA, logowanie po zaproszeniu,
odświeżanie i wylogowanie. Jedna karta nie rozpoczyna rotacji cookie, kiedy druga
jeszcze kończy poprzednią. Konflikt 409 jest ponawiany tylko raz z bieżącym
cookie, bez przechowywania JWT poza pamięcią. Opóźnione odpowiedzi nie nadpisują
nowszego logowania ani wylogowania. Inne karty po wylogowaniu przechodzą na login;
localStorage przenosi wyłącznie losowy znacznik zdarzenia, bez danych konta.

Oczekiwanie na Web Locks ma limit 30 s; fetch ma timeout 20 s. Przeglądarki bez
Web Locks mają kolejkę tylko w jednej karcie i obsługę konfliktów z API.
Wyłączony storage ogranicza powiadomienia między kartami. Awaria sieci nie jest
potwierdzeniem serwerowego zakończenia sesji. Odwoływanie całych rodzin tokenów
i access JWT pozostaje następną częścią audytu backendu.

Testy: spóźniona odpowiedź po wylogowaniu/zmianie konta, obca karta, ograniczony
retry, kolejność login/refresh, awaria blokady; dodatkowo dwie karty Chrome
z prawdziwym Web Locks i atrapą API. Odbiór po wdrożeniu wymaga sprawdzenia
tych przepływów z rzeczywistym backendem.

## Zależności

Skan przed poprawką zgłosił 4 podatne pakiety: Next.js (critical), sharp i
js-yaml (high), @humanfs/node (moderate). Aktualizacja zgodna z zakresami wersji
podniosła Next.js do 16.3.5 i sharp do 0.35.4 oraz poprawiła zależności pośrednie.
Po aktualizacji npm audit zgłosił 0 podatności. CI blokuje zgłoszenia co najmniej
moderate, również w zależnościach developerskich.

Źródła zgłoszeń Next.js: [Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
i [AVIF/Image Optimization](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
Wynik skanu oznacza stan bazy advisories z dnia kontroli; nie jest dowodem
wykorzystania podatności na produkcji ani zamknięciem całego audytu SaaS.
