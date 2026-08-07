# Sm-art chatbot — frontend

Panel klienta i osadzalny widget czatu dla platformy Sm-art. Backend (Django REST) żyje
w osobnym repozytorium `chatbot_project`.

## Uruchomienie lokalne

Backend musi działać na `http://localhost:8000` (patrz README backendu).

```bash
npm install
npm run dev
```

Aplikacja startuje na `http://localhost:3000`.

Konfiguracja w `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Struktura

- `app/(auth)/login` — logowanie do panelu
- `app/(admin)/*` — panel klienta: dashboard, dokumenty i strony WWW, ustawienia
  widgetu, historia konwersacji. Chroniony po stronie klienta (`lib/withAuth.tsx`)
- `app/widget` — publiczna strona widgetu czatu, ładowana w iframe na stronie klienta
- `public/embed.js` — skrypt osadzenia wklejany na stronę klienta; wstrzykuje
  przycisk czatu i iframe z `/widget`
- `lib/api.ts` — wrapper `fetch` dodający token JWT i obsługujący wygaśnięcie sesji

## Warianty brandingu

Widget renderuje się w dwóch trybach, sterowanych z panelu (`branding_mode`):

- `smart` — domyślna marka Sm-art, stała paleta
- `white_label` — marka klienta: nazwa, kolor, logo, awatar bota, własna stopka

## Kod osadzenia

Gotowy snippet generuje się w panelu w zakładce Widget:

```html
<script src="https://twoja-domena.pl/embed.js" data-key="TENANT_API_KEY" async></script>
```

## Uwaga przy pracy lokalnej

`npm run build` i `npm run dev` współdzielą katalog `.next`. Jeśli po buildzie serwer
deweloperski zacznie zgłaszać `Cannot find module ... [turbopack]_runtime.js`, wyczyść
cache i uruchom ponownie:

```bash
rm -rf .next && npm run dev
```
