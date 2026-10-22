# SM-art Chat — panel and embeddable widget

Two products in one Next.js app: the chat window a visitor sees on a customer's website,
and the console the business owner uses to shape what it says.

[![CI](https://github.com/piatekkrzysztof/frontend_chatbot/actions/workflows/ci.yml/badge.svg)](https://github.com/piatekkrzysztof/frontend_chatbot/actions/workflows/ci.yml)
![next](https://img.shields.io/badge/next.js-16.4-000000)
![react](https://img.shields.io/badge/react-19-61DAFB)
![typescript](https://img.shields.io/badge/typescript-5-3178C6)
![tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-success)
![licence](https://img.shields.io/badge/licence-source--available-lightgrey)

> **Language note.** This README is English; the UI, code comments and commit messages
> are Polish, because the product serves Polish small businesses.

Backend (Django REST, RAG, billing) lives in
[`chatbot_project`](https://github.com/piatekkrzysztof/chatbot_project) — start there for
the system as a whole.

---

## What it does

**The widget** is what a visitor talks to. It loads inside an iframe on the customer's
own domain, streams answers token by token, and — when the bot has no grounded answer —
offers to take a contact detail instead of guessing.

**The panel** is where the owner decides what the bot knows: which pages and documents it
may quote, which of them to exclude from search, the FAQ, the greeting, the branding, the
retention period, and which questions it failed to answer last week.

![Panel dashboard](docs/obrazy/panel-pulpit.webp)

<p>
  <img src="docs/obrazy/widget.webp" width="330" alt="Chat widget">
  <img src="docs/obrazy/panel-telefon.webp" width="200" alt="Panel on a phone">
</p>

<sub>Left: the widget at the size it actually renders in — 360×520, the frame
<code>embed.js</code> injects. Right: the panel on a phone.</sub>

---

## Live demo

| What | Where | Credentials |
|---|---|---|
| **Widget in the wild** | [agencjasm-art.pl](https://agencjasm-art.pl) — bubble, bottom right | none |
| **Panel** | [panel.agencjasm-art.pl](https://panel.agencjasm-art.pl) | `demo@agencjasm-art.pl` / `demo` |

The demo account is a `viewer`: every screen readable, nothing writable. Save buttons are
disabled in the UI *and* the API returns `403` — the second is what actually protects the
data; the first only stops you wasting a click.

---

## Architecture

```mermaid
flowchart LR
    subgraph strona["Customer's website"]
        skrypt["embed.js<br/>one script tag"]
        bubble["floating button"]
        ramka["iframe → /widget?key=…"]
        skrypt --> bubble --> ramka
    end

    subgraph app["Next.js app"]
        widget["/widget<br/>public, no login"]
        panel["(admin)/*<br/>JWT required"]
        api["lib/api.ts<br/>token, 401 handling"]
        panel --> api
        widget --> api
    end

    backend["Django REST API"]

    ramka --> widget
    api -->|"X-API-Key"| backend
    api -->|"Bearer JWT"| backend
    backend -.->|"SSE: token by token"| widget
```

The split matters for security: `/widget` must be embeddable from any origin — that is its
job — while the panel must not be embeddable from anywhere but its own domain, or a
logged-in owner could be clickjacked. The panel's policy (`proxy.ts`) carries
`frame-ancestors 'self'`; the widget has its own root layout and its own policy in
`next.config.js`, with `frame-ancestors *`.

---

## Key technical decisions

**Streaming over `fetch` + `getReader()`, not `EventSource`.** Server-sent events are the
right transport, but `EventSource` can only issue a `GET` and cannot set headers — and
this request needs a `POST` body with the question plus an `X-API-Key`. So the widget
reads the response stream manually and parses `data:` lines itself.

**The refusal marker is stripped from the front of the stream.** The backend prefixes
unanswerable replies with a marker. It has to be at the *start*, because with streaming an
end-of-message marker arrives after the visitor has already read the answer. The widget
consumes the marker before painting the first token, so a refusal renders as a refusal
rather than as `[BRAK_ODPOWIEDZI] …`.

**The widget lives in an iframe, not injected into the host page.** Injecting a component
into a stranger's site means inheriting their CSS, their global styles and their bugs, and
exposing our DOM to their scripts. The iframe costs a little communication ceremony and
buys complete isolation in both directions.

**`embed.js` is plain, unbuilt JavaScript.** It is the one file the customer pastes into
their site. It has to run in whatever their site is — WordPress, Wix, a hand-written page
from 2014 — so it ships as ES5-ish script with no bundler, no framework, no dependencies.

**Two branding modes rather than a theme editor.** `smart` uses the fixed Sm-art palette;
`white_label` takes the customer's name, colour, logo, bot avatar and footer. A free-form
theme editor would let customers build unreadable colour combinations, and the contrast
work would then have to be redone per tenant.

**Touch targets are measured by probing, not by reading CSS.** `getBoundingClientRect()`
does not see a hit area extended with a pseudo-element, and an `<input>` wrapped in a
`<label>` has the label's target size, not its own. The audit that found 36 undersized
targets used `elementFromPoint` to find where a tap actually lands.

**Pointer-scope rules are disjoint.** Touch sizing lives in `@media (pointer: coarse)` and
the AA minimum in `@media (pointer: fine), (pointer: none)`. They were overlapping once,
and because a media query adds no specificity, the base rule beat the touch rule and the
mobile sizing silently did nothing.

---

## Quickstart

```bash
git clone https://github.com/piatekkrzysztof/frontend_chatbot.git
cd frontend_chatbot
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev
```

Open `http://localhost:3000`. You need the backend running on port 8000 — the fastest way
is `docker compose up -d` in
[`chatbot_project`](https://github.com/piatekkrzysztof/chatbot_project), then
`docker compose exec web python manage.py zasiej_demo` for a login and a widget key.

The widget alone, without logging in: `http://localhost:3000/widget?key=<widget key>`.

**If `npm run dev` reports `Cannot find module … [turbopack]_runtime.js`,** you ran
`npm run build` in the same tree; the two share `.next`. Fix: `rm -rf .next && npm run dev`.

---

## Commands

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build: panel rendered per request, widget static
npm run lint       # ESLint
npx tsc --noEmit   # type check
npm test           # Vitest
npm run test:e2e   # Playwright against a production build on :3100, API mocked
npm run zrzuty     # regenerate README screenshots (needs --token, see script header)
```

### Current results

| | |
|---|---|
| Type check | clean |
| Build | passing; panel rendered per request (CSP nonce), `/widget` static |
| `npm audit --omit=dev` | **0 vulnerabilities**; CI fails on anything moderate or above, with narrow, dated exceptions allowed only for dev tooling (`scripts/audyt-zaleznosci.mjs`) |
| Unit tests | **330** (Vitest + React Testing Library) |
| E2E tests | **123** (Playwright, system Chrome, API mocked in `e2e/atrapa.ts`) |
| Audit | October 2026, findings and fixes in [`docs/audyt-2026-10.md`](docs/audyt-2026-10.md) |

Screenshots are generated by `scripts/zrzuty.mjs` against the seeded demo tenant, which
uses a fixed random seed. The images in this README and what you see after logging in to
the demo are therefore the same thing, not a staged mock-up.

---

## Security model

**The widget is public by design.** Its API key is visible in the page source — it has to
be, the browser sends it. The key is not a secret; it is an identifier. What protects it
is the backend's origin allowlist (`WidgetDomain`), which refuses a key used from a domain
the owner did not register, plus per-key and per-visitor rate limits.

**Framing policy differs per route,** as described above: `/widget` embeddable anywhere,
everything else same-origin only.

**Session handling.** The refresh token never reaches this code. It lives in an
`HttpOnly` `Secure` `SameSite=Lax` cookie set by the API, invisible to any script on the
page. The access token lives for 15 minutes in a module variable (`lib/auth.ts`) and dies
with the tab. Every refresh issues a new refresh token and blacklists the previous one, so
a stolen token logs its owner out instead of granting quiet access.

A `401` is not the end of a session: the access token expires during normal work, so
`apiFetch` exchanges the cookie for a fresh token and repeats the request — once, never in
a loop. Only when that fails does the panel perform a **full page load** to `/login`,
deliberately, so that no component keeps the previous user's data in memory.

Refreshes are single-flight, and serialised across tabs with Web Locks. Several screens
mounting at once would otherwise send several refreshes, and rotation would invalidate
all but one of the tokens they received.

Only a refusal of the cookie itself ends a session: a `401`, or a `409` that survives one
retry. A `429` (refresh shares the login rate limit), a `5xx` or a dropped connection leaves
the user where they are, with a retry, not on the login screen. A refresh that returns a *different* login (someone logged in or accepted an
invitation in another tab) is not adopted: the tab reloads instead of replaying a form of
one company into another. Logging in or out in one tab notifies the others.

**Panel routes are guarded server-side** (`proxy.ts`), before anything reaches the browser.
The guard reads a `sesja_panelu` cookie that carries a `1` and no secret; forging it only
renders the panel shell, which the API then refuses. The authorisation boundary is the
access token, checked by the backend — the `viewer` role's read/write split is covered by
backend tests.

**Content Security Policy** (`proxy.ts`). `script-src` takes a per-request nonce with
`'strict-dynamic'` and no `'unsafe-inline'`, which is why every panel page is rendered on
demand (`headers()` in the panel's root layout): a page written to disk at build time has
no way to carry a nonce that does not exist yet. `connect-src` is narrowed to the API
origin, so a script that manages to read the in-memory token has nowhere to send it.
`base-uri`, `form-action`, `object-src` and `frame-ancestors` are locked down too.

**Known weakness: the widget shares the panel's origin.** `/widget` is static (it opens on
every customer's site, so it is served from the CDN), which means no nonce: its own policy
allows Next's inline scripts and limits `connect-src` to the API. A script injected into
the widget page itself would run on the panel's origin. No injection path is known (React
escapes every bot answer and visitor message); full isolation is a separate widget
origin.

**Reporting a vulnerability:** krzysztof@agencjasm-art.pl, not a public issue.

---

## Known limitations

- **The widget shares the panel's origin** (see *Security model*).
- **The panel is Polish-only.** No i18n layer; strings are inline.
- **The widget carries no offline or reconnect handling.** If the SSE stream drops
  mid-answer, the visitor sees a truncated reply and has to ask again.
- **Bundle size is not tracked.** The build passes, but no budget is enforced and no one
  would notice a regression.

---

## Roadmap

**Done in 2026.** A test suite for the flows whose failure costs the user something
(session, SSE, widget embedding, Stripe return, destructive actions, responsive layout,
accessibility); the auth rebuild (`HttpOnly` refresh cookie with rotation, access token in
memory, server-side route guard, CSP with a per-request nonce); error boundaries; and the
October audit with its fixes ([`docs/audyt-2026-10.md`](docs/audyt-2026-10.md)).

**Next.** A separate origin for the widget, a bundle budget in CI, reconnect handling in
the widget stream, and i18n if a non-Polish customer appears.

---

## Repository layout

```
app/(panel)/       root layout of the panel: per-request rendering (CSP nonce), all fonts
app/(panel)/(auth)/  login, registration, invitation acceptance
app/(panel)/(admin)/ panel: dashboard, knowledge base, FAQ, bot test, widget settings,
                   conversations, leads, team, subscription, privacy, system health
app/(widget)/      separate root layout of the chat window: static, own CSS and CSP
app/(widget)/widget/ the public chat window loaded in an iframe
components/widget/ WidgetChat (conversation), chrome (frame, header, footer), preview
lib/api.ts         fetch wrapper: token, 401 handling, error unwrapping
public/embed.js    the script the customer pastes into their site
scripts/zrzuty.mjs README screenshots (Playwright, system Chrome)
```

## Deployment (Vercel)

1. Import the repository; Next.js is detected automatically.
2. Set `NEXT_PUBLIC_API_URL` to the backend's `/api` URL.
3. Add the deployed domain to the backend's `DJANGO_CORS_ALLOWED_ORIGINS`, or the browser
   will block every widget request.

The embed snippet is generated in the panel from the address the panel is served on, so it
is correct straight after deployment without editing anything.

---

## Licence

**Source-available. All rights reserved.**

Copyright © 2026 Krzysztof Piątek (SM-art).

Published to be read and reviewed. Not licensed for reuse: no copying, modification,
distribution, self-hosting or operation, in whole or in part, without written permission.

Reading and discussing the code is welcome — krzysztof@agencjasm-art.pl.
