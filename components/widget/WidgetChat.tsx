'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { resolveTheme } from './theme'
import {
  BabelBota,
  BabelUzytkownika,
  Etykieta,
  KANT,
  PasekKontaktu,
  PasekTytulu,
  Stopka,
  Sugestie,
} from './chrome'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'


interface Message {
  sender: 'user' | 'bot'
  text: string
  sources?: Zrodlo[]
  // Identyfikator przychodzi ze zdarzenia 'done' — bez niego nie ma czego ocenić
  messageId?: number
  rating?: 'up' | 'down'
}

/** Źródło odpowiedzi. Adres bywa pusty — patrz normalizujZrodla. */
interface Zrodlo {
  name: string
  url?: string
}

/**
 * Sprowadza źródła do jednego kształtu.
 *
 * Historia rozmowy siedzi w localStorage przeglądarki odwiedzającego, więc po
 * wdrożeniu tej zmiany wciąż mogą tam leżeć wiadomości zapisane w starym
 * kształcie, gdzie źródło było zwykłym napisem. Bez tego widget wywracałby się
 * na cudzej, wcześniej zapisanej rozmowie.
 */
function normalizujZrodla(surowe: unknown): Zrodlo[] {
  if (!Array.isArray(surowe)) return []
  return surowe
    .map((z) => (typeof z === 'string' ? { name: z } : z))
    .filter((z): z is Zrodlo => Boolean(z && typeof z.name === 'string'))
}

interface Branding {
  branding_mode: 'smart' | 'white_label'
  // Środkowy próg cennika: od planu Grow stopka "Powered by Sm-art" znika.
  // Pole musi być w tym interfejsie, bo resolveTheme czyta je z tego obiektu —
  // bez niego TypeScript by je przepuścił, ale stopka nigdy by nie zniknęła.
  widget_hide_branding: boolean
  widget_title: string
  widget_color: string
  widget_footer_text: string
  widget_logo: string | null
  widget_avatar: string | null
  privacy_policy_url: string
  widget_welcome_message: string
  widget_suggested_questions: string[]
}

// localStorage, nie sessionStorage: widget siedzi w iframe, więc każde odświeżenie
// strony klienta zaczynało rozmowę od zera i bot tracił kontekst w połowie wątku.
function getSessionId(apiKey: string) {
  const storageKey = `widget_session_${apiKey}`
  let sessionId = localStorage.getItem(storageKey)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(storageKey, sessionId)
  }
  return sessionId
}

function historyKey(apiKey: string) {
  return `widget_history_${apiKey}`
}

const MAX_STORED_MESSAGES = 50

function loadHistory(apiKey: string): Message[] {
  try {
    const raw = localStorage.getItem(historyKey(apiKey))
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return []
    // Zapisane wcześniej rozmowy mogą mieć źródła w starym kształcie
    return parsed.map((m: Message) => ({
      ...m,
      sources: m.sources ? normalizujZrodla(m.sources) : undefined,
    }))
  } catch {
    // uszkodzony wpis nie może blokować czatu — zaczynamy od pustej rozmowy
    return []
  }
}

function saveHistory(apiKey: string, messages: Message[]) {
  try {
    localStorage.setItem(
      historyKey(apiKey),
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    )
  } catch {
    // brak miejsca albo zablokowany storage — rozmowa działa dalej, tylko bez zapisu
  }
}

export default function WidgetChat() {
  const searchParams = useSearchParams()
  const apiKey = searchParams.get('key') || ''

  const [branding, setBranding] = useState<Branding | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Eskalacja do człowieka — pojawia się, gdy bot odpowiedział bez pokrycia w materiałach
  const [offerContact, setOfferContact] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactValue, setContactValue] = useState('')
  const [contactSent, setContactSent] = useState(false)

  useEffect(() => {
    if (!apiKey) return
    let active = true

    fetch(`${API_URL}/widget-settings/`, { headers: { 'X-API-Key': apiKey } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setBranding(data)
      })
      .catch(() => {
        if (active) setBranding(null)
      })

    setMessages(loadHistory(apiKey))
    setHistoryLoaded(true)

    return () => {
      active = false
    }
  }, [apiKey])

  // Zapisujemy dopiero po wczytaniu, żeby pierwszy render nie nadpisał historii pustką
  useEffect(() => {
    if (!apiKey || !historyLoaded) return
    saveHistory(apiKey, messages)
  }, [apiKey, historyLoaded, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Formularz doklejamy pod historią, więc otwarty z paska tytułu wypadłby
  // poza kadrem przy dłuższej rozmowie — czyli klik wyglądałby na martwy.
  useEffect(() => {
    if (contactOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [contactOpen])

  async function handleSend(presetText?: string) {
    const text = (presetText ?? input).trim()
    if (!text || !apiKey || sending) return

    setMessages((prev) => [...prev, { sender: 'user', text }])
    setInput('')
    setSending(true)

    try {
      const sessionId = getSessionId(apiKey)
      const res = await fetch(`${API_URL}/widget/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          message: text,
          conversation_session_id: sessionId,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Wystąpił błąd. Spróbuj ponownie.')
      }

      // Pusty dymek bota, który wypełniamy w miarę napływania tokenów
      setMessages((prev) => [...prev, { sender: 'bot', text: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const raw of events) {
          const line = raw.trim()
          if (!line.startsWith('data: ')) continue

          const event = JSON.parse(line.slice(6))
          if (event.type === 'delta') {
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                ...next[next.length - 1],
                text: next[next.length - 1].text + event.content,
              }
              return next
            })
          } else if (event.type === 'done') {
            if (event.sources?.length) {
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  sources: normalizujZrodla(event.sources),
                }
                return next
              })
            }
            if (event.message_id) {
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { ...next[next.length - 1], messageId: event.message_id }
                return next
              })
            }
            // 'gpt' = brak oparcia w dokumentach i FAQ — proponujemy kontakt z firmą
            if (event.source === 'gpt' && !contactSent) {
              setOfferContact(true)
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.' },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleRate(messageId: number, rating: 'up' | 'down') {
    // Zaznaczamy od razu: ocena to gest uboczny, użytkownik nie powinien czekać
    setMessages((prev) =>
      prev.map((m) => (m.messageId === messageId ? { ...m, rating } : m)),
    )

    try {
      await fetch(`${API_URL}/widget/feedback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ message_id: messageId, is_helpful: rating === 'up' }),
      })
    } catch {
      // Nieudana ocena nie ma przerywać rozmowy ani straszyć komunikatem
    }
  }

  async function handleContactSubmit() {
    const value = contactValue.trim()
    if (!value || !apiKey) return

    try {
      await fetch(`${API_URL}/widget/contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          contact: value,
          message: messages.filter((m) => m.sender === 'user').slice(-1)[0]?.text || '',
          conversation_session_id: getSessionId(apiKey),
        }),
      })
      setContactSent(true)
      setContactOpen(false)
      setOfferContact(false)
      setContactValue('')
    } catch {
      // brak sieci — nie blokujemy rozmowy, użytkownik może spróbować ponownie
    }
  }

  const theme = resolveTheme(branding)

  if (!apiKey) {
    return (
      <div
        className="flex h-screen items-center justify-center p-6 text-center text-[13px]"
        style={{ background: theme.canvas, color: theme.textSecondary }}
      >
        Brak klucza widgetu. Sprawdź kod osadzania na stronie.
      </div>
    )
  }

  /* Awatar klienta ma sens tylko w białej etykiecie — w trybie Sm-art rolę
     znacznika bota pełni pomarańczowa krawędź dymka. Gdy awatar jest, dymki
     dostają stałą rynnę po lewej, żeby ich krawędzie wciąż stały w jednej osi. */
  const awatar = theme.isWhiteLabel ? branding?.widget_avatar : null

  return (
    <div
      role="region"
      aria-label="Okno czatu"
      className="flex h-screen flex-col"
      style={{ background: theme.canvas, fontFamily: 'var(--font-body)' }}
    >
      <PasekTytulu theme={theme} logoUrl={theme.isWhiteLabel ? branding?.widget_logo : null} />

      {/* aria-live sprawia, że czytnik ekranu ogłasza odpowiedzi w miarę ich
          napływania — bez tego niewidomy użytkownik nie wie, że bot odpowiedział.
          "polite" zamiast "assertive", żeby nie przerywać w połowie zdania. */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Historia rozmowy"
        className="flex-1 overflow-y-auto px-3.5 py-4 flex flex-col gap-3"
      >
        {messages.length === 0 && (
          <div>
            {branding?.widget_welcome_message ? (
              <BabelBota theme={theme}>{branding.widget_welcome_message}</BabelBota>
            ) : (
              <p className="text-[13px]" style={{ color: theme.textMuted }}>
                Napisz wiadomość, aby rozpocząć rozmowę.
              </p>
            )}

            {/* Gotowe pytania zdejmują z odwiedzającego konieczność wymyślenia
                pierwszego kroku — bez nich puste okno najczęściej się zamyka. */}
            <Sugestie
              theme={theme}
              pytania={branding?.widget_suggested_questions ?? []}
              onWybierz={handleSend}
              zablokowane={sending}
            />
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1.5 ${m.sender === 'user' ? 'self-end items-end max-w-[85%]' : 'self-stretch'}`}
          >
            {m.sender === 'user' ? (
              <BabelUzytkownika theme={theme}>{m.text}</BabelUzytkownika>
            ) : (
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
                  <BabelBota theme={theme}>
                    {m.text}
                    {m.text === '' && <span style={{ color: theme.textMuted }}>…</span>}
                  </BabelBota>
                </div>
              </div>
            )}

            {m.sources && m.sources.length > 0 && (
              <p className={awatar ? 'pl-8' : ''}>
                <Etykieta style={{ color: theme.accentText }}>Na podstawie</Etykieta>{' '}
                <span className="text-[11px]" style={{ color: theme.textMuted }}>
                  {m.sources.map((zrodlo, i) => (
                    <span key={`${zrodlo.name}-${i}`}>
                      {i > 0 && ' · '}
                      {/* Link tylko dla treści, które i tak są publiczne.
                          Wgrane pliki nie mają adresu celowo — link do cennika
                          czy procedur firmy udostępniłby je każdemu. */}
                      {zrodlo.url?.startsWith('http') ? (
                        <a
                          href={zrodlo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {zrodlo.name}
                        </a>
                      ) : (
                        zrodlo.name
                      )}
                    </span>
                  ))}
                </span>
              </p>
            )}

            {/* Ocena pojawia się dopiero, gdy odpowiedź jest kompletna: przy
                pustym tekście strumień jeszcze leci i nie ma czego oceniać. */}
            {m.sender === 'bot' && m.messageId && m.text !== '' && (
              <div className={`flex items-center gap-3 ${awatar ? 'pl-8' : ''}`}>
                {m.rating ? (
                  <Etykieta style={{ color: theme.textMuted }}>
                    {m.rating === 'up' ? 'Dziękujemy za ocenę' : 'Dziękujemy, przekażemy to firmie'}
                  </Etykieta>
                ) : (
                  <>
                    <Etykieta style={{ color: theme.textMuted }}>Czy to pomogło?</Etykieta>
                    <button
                      onClick={() => handleRate(m.messageId!, 'up')}
                      className="underline underline-offset-2"
                    >
                      <Etykieta style={{ color: theme.accentText }}>Tak</Etykieta>
                    </button>
                    <button
                      onClick={() => handleRate(m.messageId!, 'down')}
                      className="underline underline-offset-2"
                    >
                      <Etykieta style={{ color: theme.accentText }}>Nie</Etykieta>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {sending && messages[messages.length - 1]?.sender === 'user' && (
          <Etykieta className="self-start" style={{ color: theme.textMuted }}>
            Piszę…
          </Etykieta>
        )}

        {contactSent && (
          <BabelBota theme={theme}>
            Dziękujemy — przekazaliśmy Twój kontakt. Odezwiemy się wkrótce.
          </BabelBota>
        )}

        {/* Zaczepka w strumieniu: pojawia się sama, gdy bot nie pomógł.
            Przycisk w pasku jest zawsze — ta dochodzi tam, gdzie akurat patrzy
            odwiedzający, czyli pod nieudaną odpowiedzią. */}
        {offerContact && !contactOpen && !contactSent && !sending && (
          <button
            onClick={() => setContactOpen(true)}
            className="self-start underline underline-offset-2"
          >
            <Etykieta style={{ color: theme.accentText }}>
              Nie znalazłeś odpowiedzi? Zostaw kontakt
            </Etykieta>
          </button>
        )}

        {/* Jeden formularz, dwa wejścia: pasek tytułu i zaczepka wyżej */}
        {contactOpen && !contactSent && (
              <div
                className="p-3 flex flex-col gap-2.5"
                style={{
                  background: theme.surface,
                  border: `1px solid ${theme.line}`,
                  borderLeft: `2px solid ${theme.accent}`,
                  borderRadius: KANT,
                }}
              >
                <p className="text-[13px] leading-snug" style={{ color: theme.text }}>
                  Zostaw e-mail lub telefon — odezwiemy się z odpowiedzią.
                </p>
                <input
                  type="text"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
                  placeholder="jan@firma.pl lub 500 100 200"
                  aria-label="Twój e-mail lub telefon"
                  className="px-2.5 py-2 text-[13px] placeholder:text-[color:var(--podpowiedz)]"
                  style={{
                    border: `1px solid ${theme.lineStrong}`,
                    borderRadius: KANT,
                    background: theme.canvas,
                    color: theme.text,
                    ['--podpowiedz' as string]: theme.textMuted,
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleContactSubmit}
                    disabled={!contactValue.trim()}
                    style={{
                      background: theme.accent,
                      color: theme.onAccent,
                      borderRadius: KANT,
                    }}
                    className="px-3 py-1.5 disabled:opacity-50"
                  >
                    <Etykieta>Wyślij</Etykieta>
                  </button>
                  <button onClick={() => { setContactOpen(false); setOfferContact(false) }}>
                    <Etykieta style={{ color: theme.textMuted }}>Nie teraz</Etykieta>
                  </button>
                </div>
              </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Wykrywanie „bot nie pomógł" opiera się na tym, czy model przyzna się
          do niewiedzy — sprawdza się w większości przypadków, ale nie jest
          gwarancją. Poza tym ktoś może chcieć zostawić numer od razu, bez
          odpytywania bota. To wyjście nie zależy od niczego. */}
      {!contactSent && !contactOpen && (
        <PasekKontaktu theme={theme} onClick={() => setContactOpen(true)} />
      )}

      <div
        className="shrink-0 flex items-stretch gap-2 px-3.5 py-2.5"
        style={{ background: theme.surface, borderTop: `1px solid ${theme.lineStrong}` }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Napisz wiadomość…"
          aria-label="Treść wiadomości"
          // Kolor podpowiedzi jawnie, bo domyślnie przeglądarka bierze kolor
          // tekstu z 50% krycia — na kremowym dawało to 3,25:1, poniżej progu.
          className="flex-1 min-w-0 px-3 py-2 text-[13px] placeholder:text-[color:var(--podpowiedz)]"
          style={{
            border: `1px solid ${theme.line}`,
            borderRadius: KANT,
            background: theme.canvas,
            color: theme.text,
            ['--podpowiedz' as string]: theme.textMuted,
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={sending || !input.trim()}
          aria-label="Wyślij wiadomość"
          style={{ background: theme.accent, color: theme.onAccent, borderRadius: KANT }}
          className="px-4 shrink-0 disabled:opacity-50"
        >
          <Etykieta>Wyślij</Etykieta>
        </button>
      </div>

      <Stopka theme={theme} privacyUrl={branding?.privacy_policy_url} />
    </div>
  )
}
