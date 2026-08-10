/**
 * Kolory okna czatu — jedno źródło prawdy dla samego widgetu i dla podglądu
 * w panelu. Rozdzielone kopie rozjechałyby się przy pierwszej zmianie, a wtedy
 * podgląd pokazywałby coś innego, niż zobaczy odwiedzający.
 */
export const SMART_THEME = {
  bg: '#110c04',
  messageAreaBg: '#241a0e',
  bubbleBg: '#332612',
  accent: '#F97316',
  white: '#FAF8F5',
  // Zmierzony kontrast poprzedniej wartości (#6B5A48) wynosił 2,59:1 na obszarze
  // wiadomości i 2,95:1 na tle nagłówka — poniżej progu 4,5:1 wymaganego przez
  // WCAG 2.1 AA, a przez European Accessibility Act to wymóg, nie zalecenie.
  // Ta wartość daje 5,10:1 i 5,82:1, zostając równie stonowana.
  muted: '#9A8A76',
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
  const accent = isWhiteLabel ? branding?.widget_color || '#111827' : SMART_THEME.accent

  return {
    isWhiteLabel,
    accent,
    name: isWhiteLabel ? branding?.widget_title || 'Chatbot' : 'Sm-art',
    headerBg: isWhiteLabel ? accent : SMART_THEME.bg,
    headerText: isWhiteLabel ? '#ffffff' : SMART_THEME.white,
    messageAreaBg: isWhiteLabel ? '#f1f5f8' : SMART_THEME.messageAreaBg,
    botBubbleBg: isWhiteLabel ? '#eef2f6' : SMART_THEME.bubbleBg,
    botBubbleText: isWhiteLabel ? '#1c2b36' : SMART_THEME.white,
    userBubbleText: isWhiteLabel ? '#ffffff' : SMART_THEME.bg,
    footerBg: isWhiteLabel ? '#ffffff' : SMART_THEME.bg,
    footerBorder: isWhiteLabel ? '#eef2f6' : 'rgba(250,248,245,0.06)',
    inputHintColor: isWhiteLabel ? '#9fb0bd' : SMART_THEME.muted,
    // W trybie smart stopka reklamuje nas — chyba że klient ma plan pozwalający
    // ją ukryć. To środkowy próg cennika: Grow kupuje się właśnie po to, żeby
    // widget nie odsyłał odwiedzających do cudzej firmy.
    footerLabel: isWhiteLabel
      ? branding?.widget_footer_text || ''
      : branding?.widget_hide_branding
        ? ''
        : 'Powered by Sm-art',
    avatarBg: isWhiteLabel ? '#d7e3ee' : '#332612',
    pageBg: isWhiteLabel ? '#ffffff' : SMART_THEME.bg,
  }
}
