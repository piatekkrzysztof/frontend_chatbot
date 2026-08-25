/**
 * Zrzuty ekranu do README.
 *
 * Robione skryptem, a nie ręcznie, z jednego powodu: README obiecuje konkretny
 * stan panelu, a `manage.py zasiej_demo` ma stałe ziarno losowe. Dopóki zrzuty
 * powstają tym samym poleceniem co dane, obrazek w README i to, co zobaczy
 * zwiedzający po zalogowaniu, nie rozjeżdżają się.
 *
 * Używa Chrome'a zainstalowanego w systemie (channel: 'chrome') zamiast
 * pobierać własną przeglądarkę Playwrighta — to ~300 MB, których nikt tu
 * nie potrzebuje.
 *
 *   node scripts/zrzuty.mjs --token <JWT> [--url http://localhost:3000] [--out ../chatbot_project/docs/obrazy]
 *
 * Token bierze się z backendu:
 *   manage.py shell -c "from accounts.models import CustomUser; \
 *     from rest_framework_simplejwt.tokens import RefreshToken; \
 *     print(RefreshToken.for_user(CustomUser.objects.get(username='demo@agencjasm-art.pl')).access_token)"
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

function argument(nazwa, domyslna = null) {
  const i = process.argv.indexOf(`--${nazwa}`)
  return i > -1 ? process.argv[i + 1] : domyslna
}

const TOKEN = argument('token')
const BAZA = argument('url', 'http://localhost:3000')
const KATALOG = path.resolve(argument('out', 'zrzuty'))
const KLUCZ = argument('klucz')

// Szerokość 1440: typowy laptop, a nie 1920 — zrzut z 1920 wklejony do README
// skaluje się do ~800px i tekst w panelu robi się nieczytelny.
const PULPIT = { width: 1440, height: 900 }
const TELEFON = { width: 390, height: 844 }

const EKRANY = [
  { nazwa: 'pulpit', sciezka: '/dashboard' },
  { nazwa: 'baza-wiedzy', sciezka: '/documents' },
  { nazwa: 'rozmowy', sciezka: '/conversations' },
  { nazwa: 'stan', sciezka: '/stan' },
]

async function ustabilizuj(strona) {
  // Panel animuje wejście sekcji. Bez tego zrzut łapie je w połowie
  // przejścia i wygląda jak zepsuty render, a nie jak produkt.
  await strona.waitForLoadState('networkidle').catch(() => {})
  await strona.evaluate(() => {
    document.querySelectorAll('[style*="opacity"], [style*="transform"]').forEach((e) => {
      e.style.opacity = ''
      e.style.transform = ''
      e.style.transition = 'none'
    })
    // Wskaźnik dev Next.js siedzi w lewym dolnym rogu i na zrzucie wygląda
    // jak element produktu. Chowamy go, a nie wycinamy z obrazka później.
    document
      .querySelectorAll('nextjs-portal, [data-nextjs-toast], #__next-build-watcher')
      .forEach((e) => e.remove())
  })
  await strona.waitForTimeout(400)
}

async function main() {
  if (!TOKEN && !KLUCZ) {
    console.error('Podaj --token (panel) albo --klucz (widget).')
    process.exit(1)
  }
  await mkdir(KATALOG, { recursive: true })

  const przegladarka = await chromium.launch({ channel: 'chrome' })
  const kontekst = await przegladarka.newContext({
    viewport: PULPIT,
    deviceScaleFactor: 2, // ekrany HiDPI: bez tego zrzut w README jest miękki
    locale: 'pl-PL',
  })

  try {
    if (TOKEN) {
      // Token wstrzykujemy przed pierwszą nawigacją, bo panel przekierowuje
      // na /login, zanim zdąży cokolwiek narysować.
      await kontekst.addInitScript((t) => {
        try { window.localStorage.setItem('token', t) } catch {}
      }, TOKEN)

      const strona = await kontekst.newPage()
      for (const { nazwa, sciezka } of EKRANY) {
        await strona.goto(BAZA + sciezka, { waitUntil: 'domcontentloaded' })
        await ustabilizuj(strona)
        const plik = path.join(KATALOG, `panel-${nazwa}.png`)
        await strona.screenshot({ path: plik })
        console.log('zapisano', path.relative(process.cwd(), plik))
      }
      await strona.close()
    }

    if (KLUCZ) {
      // Widget osadza się w ramce 360x520 — zrzut w innym rozmiarze pokazuje
      // układ, którego nikt nigdy nie zobaczy.
      const ramka = await kontekst.newPage()
      await ramka.setViewportSize({ width: 360, height: 520 })
      await ramka.goto(`${BAZA}/widget?key=${KLUCZ}`, { waitUntil: 'domcontentloaded' })
      await ustabilizuj(ramka)
      const plik = path.join(KATALOG, 'widget.png')
      await ramka.screenshot({ path: plik })
      console.log('zapisano', path.relative(process.cwd(), plik))
      await ramka.close()
    }

    if (TOKEN) {
      const telefon = await kontekst.newPage()
      await telefon.setViewportSize(TELEFON)
      await telefon.goto(BAZA + '/dashboard', { waitUntil: 'domcontentloaded' })
      await ustabilizuj(telefon)
      const plik = path.join(KATALOG, 'panel-telefon.png')
      await telefon.screenshot({ path: plik })
      console.log('zapisano', path.relative(process.cwd(), plik))
      await telefon.close()
    }
  } finally {
    await przegladarka.close()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
