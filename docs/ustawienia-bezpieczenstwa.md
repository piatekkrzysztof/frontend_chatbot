# Hasło i sesje logowania

Sekcja ustawień pokazuje wyłącznie własne aktywne sesje i pozwala zmienić
hasło, zakończyć wybraną sesję albo wszystkie pozostałe. Potwierdzenie
wymaga aktualnego hasła oraz kodu, jeśli MFA jest włączone. Anulowanie
czyści wpisane sekrety. Lista pokazuje 20 pozycji na stronę i daty logowania/
wygaśnięcia; nie sugeruje urządzenia ani lokalizacji, których API nie zbiera.

Przed zapisem odświeżamy sesję. Zmiana jej ID zatrzymuje operację, aby nie
wykonać jej na innym zalogowanym koncie. Sam POST i odczyt odpowiedzi
działają pod Web Lock, bez automatycznego ponowienia, z limitem 20 sekund.
Utrata odpowiedzi oznacza wynik niepewny, a nie pewne niepowodzenie zapisu.

Po odwołaniu bieżącej sesji czyścimy token w pamięci i powiadamiamy karty
zdarzeniem z samym ID sesji. Brak dodatkowego POST logout lub kasowania
cookie, które mogłoby należeć do nowszego logowania. Spóźniona odpowiedź
nie usuwa nowej sesji i nie przywraca starej. Pełna nawigacja do logowania
czyści pamięć komponentów. Hasło, kod i JWT nie są zapisywane w storage.

Błąd odczytu listy pozostaje błędem z przyciskiem ponowienia. Analogicznie
błąd odczytu MFA nie oznacza już „MFA wyłączone”. Po zmianie MFA w innym
oknie przycisk odświeżenia listy pobiera też aktualne wymaganie kodu.

Wdrożyć backend 2.0.12 przed tym panelem. Bez nowych usług, migracji i
zmiennych środowiskowych. Przy rollbacku najpierw cofnąć panel. Operacje
już wykonane (zmiana hasła, odwołanie sesji) zachowują skutek po rollbacku.

Lokalna walidacja: 117 testów jednostkowych, 75 Playwright, TypeScript,
produkcyjny build i lint (0 błędów, 4 wcześniejsze ostrzeżenia). Sprawdzono
telefon 375 px, dwa równoległe okna, brak tokenów w storage i brak dodatkowego
logout po zmianie hasła. Odczyt body odświeżania ma własny limit 20 sekund,
aby zawieszona odpowiedź nie trzymała Web Lock bez końca.
Produkcję sprawdzać na wydzielonym koncie po uzgodnieniu testu z właścicielem.
