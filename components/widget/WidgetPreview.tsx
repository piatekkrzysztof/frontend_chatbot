'use client'

import { resolveTheme } from './theme'
import { BabelBota, Etykieta, KANT, PasekKontaktu, PasekTytulu, Stopka, Sugestie } from './chrome'

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
 * i bez wchodzenia na stronę klienta. Nagłówek, dymek i pasek wysyłania to
 * te same komponenty co w prawdziwym widgecie (chrome.tsx), żeby podgląd
 * nie obiecywał czegoś innego, niż zobaczy odwiedzający.
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
  const awatar = theme.isWhiteLabel ? avatarUrl : null

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: 320,
        height: 460,
        background: theme.canvas,
        border: `1px solid ${theme.lineStrong}`,
        borderRadius: KANT,
        fontFamily: 'var(--font-body)',
      }}
    >
      <PasekTytulu theme={theme} logoUrl={theme.isWhiteLabel ? logoUrl : null} />

      <div className="flex-1 overflow-y-auto px-3.5 py-4">
        {welcomeMessage ? (
          <div className="flex items-start gap-2">
            {awatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={awatar}
                alt=""
                className="h-6 w-6 shrink-0 object-cover mt-0.5"
                style={{ borderRadius: KANT }}
              />
            )}
            <div className="min-w-0 flex-1">
              <BabelBota theme={theme}>{welcomeMessage}</BabelBota>
            </div>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: theme.textMuted }}>
            Napisz wiadomość, aby rozpocząć rozmowę.
          </p>
        )}

        <Sugestie theme={theme} pytania={questions} />
      </div>

      {/* Podgląd ma pokazywać to, co zobaczy odwiedzający — bez tego klient
          projektuje wygląd okna, którego jego goście nigdy nie widzą. */}
      <PasekKontaktu theme={theme} />

      <div
        className="shrink-0 flex items-stretch gap-2 px-3.5 py-2.5"
        style={{ background: theme.surface, borderTop: `1px solid ${theme.lineStrong}` }}
      >
        <div
          className="flex-1 min-w-0 px-3 py-2 text-[13px]"
          style={{
            border: `1px solid ${theme.line}`,
            borderRadius: KANT,
            background: theme.canvas,
            color: theme.textMuted,
          }}
        >
          Napisz wiadomość…
        </div>
        <span
          className="px-4 shrink-0 grid place-items-center"
          style={{ background: theme.accent, color: theme.onAccent, borderRadius: KANT }}
        >
          <Etykieta>Wyślij</Etykieta>
        </span>
      </div>

      <Stopka theme={theme} />
    </div>
  )
}
