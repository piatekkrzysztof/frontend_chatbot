/**
 * Kolory okna czatu — jedno źródło prawdy dla samego widgetu i dla podglądu
 * w panelu. Rozdzielone kopie rozjechałyby się przy pierwszej zmianie, a wtedy
 * podgląd pokazywałby coś innego, niż zobaczy odwiedzający.
 *
 * Układ jest szwajcarski: kremowe płótno, białe powierzchnie, włoskowate
 * linie zamiast cieni i zaokrągleń, jeden ciemny pas u góry. Pomarańcz
 * pojawia się rzadko i zawsze jako blok albo linia — nigdy jako wypełnienie
 * połowy ekranu. Wcześniej całe okno było espresso, więc czat wyglądał jak
 * konsola, a nie jak element strony klienta.
 *
 * Paleta ta sama co na agencjasm-art.pl: espresso, ember, krem, piasek.
 */

/* ─── Rachunek kontrastu ───
   Kolor akcentu w trybie białej etykiety wpisuje klient, więc nie da się go
   sprawdzić z góry. Zamiast ufać, że wybierze coś czytelnego, liczymy. */

function kanaly(kolor: string): [number, number, number] {
  const znaki = kolor.replace('#', '')
  const pelny = znaki.length === 3 ? znaki.split('').map((z) => z + z).join('') : znaki
  const liczba = parseInt(pelny, 16)
  if (Number.isNaN(liczba) || pelny.length !== 6) return [0, 0, 0]
  return [(liczba >> 16) & 255, (liczba >> 8) & 255, liczba & 255]
}

function naHex([r, g, b]: [number, number, number]) {
  return '#' + [r, g, b].map((k) => Math.max(0, Math.min(255, k)).toString(16).padStart(2, '0')).join('')
}

function luminancja([r, g, b]: [number, number, number]) {
  const [lr, lg, lb] = [r, g, b].map((wartosc) => {
    const u = wartosc / 255
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** Stosunek kontrastu wedle WCAG 2.1. Próg dla tekstu to 4,5:1. */
export function kontrast(pierwszy: string, drugi: string) {
  const a = luminancja(kanaly(pierwszy))
  const b = luminancja(kanaly(drugi))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * Przyciemnia kolor, aż da się go czytać na podanym tle.
 *
 * Sm-artowy pomarańcz #F97316 na bieli daje 3,0:1 — ładny jako wypełnienie,
 * nieczytelny jako litery. To samo spotka klienta, który w białej etykiecie
 * wybierze żółty albo jasną zieleń. Zamiast zabraniać mu koloru, zostawiamy
 * jego odcień na wypełnieniach, a do tekstu schodzimy tyle tonów, ile trzeba.
 */
export function doTekstu(kolor: string, tlo: string, prog = 4.5) {
  let barwy = kanaly(kolor)
  // 20 kroków po 12% wystarcza, żeby dojść z bieli do czerni; limit chroni
  // przed pętlą, gdyby tło samo było czarne i próg nieosiągalny.
  for (let krok = 0; krok < 20 && kontrast(naHex(barwy), tlo) < prog; krok++) {
    barwy = barwy.map((k) => Math.round(k * 0.88)) as [number, number, number]
  }
  return naHex(barwy)
}

/** Czerń albo biel — to, co lepiej czyta się na wypełnieniu danym kolorem. */
export function naWypelnieniu(kolor: string) {
  return kontrast(kolor, '#1a1108') >= kontrast(kolor, '#ffffff') ? '#1a1108' : '#ffffff'
}

export const SMART_THEME = {
  /* Ciemny pas nagłówka — ten sam kolor, co tło strony agencji */
  pasek: '#110c04',
  /* Wiadomość odwiedzającego: espresso o ton jaśniejsze, żeby odróżniało się
     od paska, gdy oba trafią obok siebie przy krótkiej rozmowie */
  ciemne: '#1a1108',
  akcent: '#F97316',
  krem: '#FAF8F5',
  /* Płótno rozmowy i powierzchnie */
  plotno: '#F7F5F2',
  powierzchnia: '#ffffff',
  /* Tekst na jasnym. Wartości z jasnego motywu panelu — jeden zestaw
     w całym produkcie, żeby widget i panel nie miały dwóch różnych szarości. */
  tekst: '#241a0e',
  tekstDrugi: '#5f5346',
  tekstSlaby: '#6b5a48',
  /* Piasek do napisów na ciemnym pasku (na jasnym daje 3,35:1 — za mało) */
  piasekNaCiemnym: '#a89880',
  linia: 'rgba(36, 26, 14, 0.12)',
  liniaMocna: 'rgba(36, 26, 14, 0.22)',
}

export interface ThemeInput {
  branding_mode?: 'smart' | 'white_label'
  widget_color?: string
  widget_title?: string
  widget_footer_text?: string
  /** Środkowy próg cennika: stopkę można ukryć od planu Grow w górę. */
  widget_hide_branding?: boolean
}

export function resolveTheme(branding: ThemeInput | null | undefined) {
  const isWhiteLabel = branding?.branding_mode === 'white_label'
  const accent = isWhiteLabel ? branding?.widget_color || '#111827' : SMART_THEME.akcent

  /* Pas nagłówka: w trybie Sm-art espresso, w białej etykiecie kolor klienta.
     Napis dobierany rachunkiem, bo przy jasnej marce biel znika. */
  const headerBg = isWhiteLabel ? accent : SMART_THEME.pasek
  const headerText = isWhiteLabel ? naWypelnieniu(accent) : SMART_THEME.krem

  return {
    isWhiteLabel,
    name: isWhiteLabel ? branding?.widget_title || 'Chatbot' : 'Sm-art',

    /* Wypełnienia i linie — tu kolor klienta zostaje nietknięty */
    accent,
    /* Litery w kolorze akcentu: przyciemnione do progu czytelności na płótnie */
    accentText: doTekstu(accent, SMART_THEME.plotno),
    onAccent: naWypelnieniu(accent),

    headerBg,
    headerText,
    /* Podtytuł na pasku: przygaszony, ale wciąż czytelny na tym samym tle */
    headerMuted: isWhiteLabel
      ? headerText === '#ffffff'
        ? 'rgba(255,255,255,0.78)'
        : 'rgba(26,17,8,0.72)'
      : SMART_THEME.piasekNaCiemnym,

    canvas: SMART_THEME.plotno,
    surface: SMART_THEME.powierzchnia,
    text: SMART_THEME.tekst,
    textSecondary: SMART_THEME.tekstDrugi,
    textMuted: SMART_THEME.tekstSlaby,
    line: SMART_THEME.linia,
    lineStrong: SMART_THEME.liniaMocna,

    /* Wiadomość odwiedzającego: ciemny blok, nie pomarańczowy. Pomarańcz
       użyty przy każdej wypowiedzi przestaje być akcentem — zostaje dla
       przycisku wysyłania i linii pod nagłówkiem. */
    userBubbleBg: isWhiteLabel ? accent : SMART_THEME.ciemne,
    userBubbleText: isWhiteLabel ? naWypelnieniu(accent) : SMART_THEME.krem,

    // W trybie smart stopka reklamuje nas — chyba że klient ma plan pozwalający
    // ją ukryć. To środkowy próg cennika: Grow kupuje się właśnie po to, żeby
    // widget nie odsyłał odwiedzających do cudzej firmy.
    footerLabel: isWhiteLabel
      ? branding?.widget_footer_text || ''
      : branding?.widget_hide_branding
        ? ''
        : 'Powered by Sm-art',
  }
}

export type WidgetTheme = ReturnType<typeof resolveTheme>
