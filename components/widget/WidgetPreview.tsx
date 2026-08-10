'use client'

import { resolveTheme } from './theme'

interface Props {
  brandingMode: 'smart' | 'white_label'
  hideBranding?: boolean
  color: string
  title: string
  footerText: string
  welcomeMessage: string
  suggestedQuestions: string[]
  logoUrl?: string | null
  avatarUrl?: string | null
}

/**
 * Statyczny podgląd okna czatu w panelu.
 *
 * Nie rozmawia z API — pokazuje wygląd dla wartości aktualnie wpisanych
 * w formularzu, więc efekt zmiany koloru czy tytułu widać przed zapisaniem
 * i bez wchodzenia na stronę klienta. Kolory bierze z tego samego modułu
 * co prawdziwy widget, żeby podgląd nie obiecywał czegoś innego.
 */
export default function WidgetPreview({
  brandingMode,
  hideBranding,
  color,
  title,
  footerText,
  welcomeMessage,
  suggestedQuestions,
  logoUrl,
  avatarUrl,
}: Props) {
  const theme = resolveTheme({
    branding_mode: brandingMode,
    widget_color: color,
    widget_title: title,
    widget_footer_text: footerText,
    widget_hide_branding: hideBranding,
  })

  const questions = suggestedQuestions.filter((q) => q.trim()).slice(0, 4)

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden border border-gray-200 shadow-sm"
      style={{ width: 320, height: 460, backgroundColor: theme.pageBg }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold shrink-0"
        style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
      >
        {theme.isWhiteLabel && logoUrl ? (
          <img src={logoUrl} alt="" className="h-5 w-5 rounded object-cover" />
        ) : (
          <span
            className="flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold"
            style={{
              backgroundColor: theme.isWhiteLabel ? '#ffffff' : theme.accent,
              color: theme.isWhiteLabel ? theme.accent : theme.headerText,
            }}
          >
            {theme.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate">{theme.name}</span>
          {/* To samo ujawnienie co w prawdziwym widgecie — podgląd nie może
              pokazywać mniej, niż zobaczy odwiedzający stronę klienta. */}
          <span className="block text-[10px] font-normal opacity-80 leading-tight">
            Asystent AI — odpowiada automatycznie
          </span>
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3"
        style={{ backgroundColor: theme.messageAreaBg }}
      >
        {welcomeMessage ? (
          <div className="flex items-start gap-2 max-w-[85%]">
            {theme.isWhiteLabel && avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
            ) : (
              <span
                className="h-6 w-6 rounded-full shrink-0"
                style={{ backgroundColor: theme.avatarBg }}
              />
            )}
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: theme.botBubbleBg, color: theme.botBubbleText }}
            >
              {welcomeMessage}
            </div>
          </div>
        ) : (
          <p className="text-sm text-center mt-2" style={{ color: theme.inputHintColor }}>
            Napisz wiadomość, aby rozpocząć rozmowę.
          </p>
        )}

        {questions.length > 0 && (
          <div className="flex flex-col gap-1.5 items-start mt-3">
            {questions.map((question) => (
              <span
                key={question}
                className="rounded-full border px-3 py-1.5 text-xs"
                style={{ borderColor: theme.accent, color: theme.accent }}
              >
                {question}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-2 p-2 shrink-0"
        style={{ backgroundColor: theme.footerBg, borderTop: `0.5px solid ${theme.footerBorder}` }}
      >
        <div
          className="flex-1 rounded border px-3 py-2 text-sm"
          style={{
            borderColor: theme.footerBorder,
            backgroundColor: theme.isWhiteLabel ? '#ffffff' : '#241a0e',
            color: theme.inputHintColor,
          }}
        >
          Napisz wiadomość...
        </div>
        <span
          className="rounded px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: theme.accent,
            color: theme.isWhiteLabel ? '#ffffff' : '#110c04',
          }}
        >
          Wyślij
        </span>
      </div>

      {theme.footerLabel && (
        <div
          className="px-3 pb-2 text-right shrink-0"
          style={{ backgroundColor: theme.footerBg }}
        >
          <span
            className="text-xs"
            style={{
              color: theme.isWhiteLabel ? theme.accent : '#A89880',
              fontWeight: theme.isWhiteLabel ? 500 : 400,
            }}
          >
            {theme.footerLabel}
          </span>
        </div>
      )}
    </div>
  )
}
