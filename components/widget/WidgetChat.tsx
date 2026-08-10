'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { SMART_THEME, resolveTheme } from './theme'

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

  if (!apiKey) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500 p-4 text-center">
        Brak klucza widgetu. Sprawdź kod osadzania na stronie.
      </div>
    )
  }

  const {
    isWhiteLabel, accent, name, headerBg, headerText, messageAreaBg,
    botBubbleBg, botBubbleText, userBubbleText, footerBg, footerBorder,
    inputHintColor, footerLabel, avatarBg,
  } = resolveTheme(branding)

  return (
    <div
      role="region"
      aria-label="Okno czatu"
      className="flex h-screen flex-col"
      style={{ backgroundColor: isWhiteLabel ? '#ffffff' : SMART_THEME.bg }}
    >
      <header
        style={{ backgroundColor: headerBg, color: headerText }}
        className="px-4 py-3 flex items-center gap-2"
      >
        {isWhiteLabel && branding?.widget_logo ? (
          // Logo klienta z backendu/S3 — widget działa w iframe, optymalizacja
          // next/image tylko dokładałaby zależność od konfiguracji domen.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.widget_logo} alt="" className="h-6" />
        ) : (
          <span
            aria-hidden="true"
            style={{
              backgroundColor: isWhiteLabel ? '#ffffff' : accent,
              color: isWhiteLabel ? accent : SMART_THEME.bg,
            }}
            className="h-6 w-6 rounded flex items-center justify-center text-xs font-medium shrink-0"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="font-medium block truncate">{name}</span>
          {/* Ujawnienie wymagane przez art. 50 EU AI Act od 2 sierpnia 2026:
              odwiedzający musi wiedzieć, że rozmawia z AI. Celowo nie jest
              konfigurowalne ani wyłączalne — to obowiązek prawny także po
              stronie klienta, więc nie może zależeć od jego ustawień. */}
          <span className="block text-xs opacity-80 leading-tight">
            Asystent AI — odpowiada automatycznie
          </span>
        </span>
      </header>

      {/* aria-live sprawia, że czytnik ekranu ogłasza odpowiedzi w miarę ich
          napływania — bez tego niewidomy użytkownik nie wie, że bot odpowiedział.
          "polite" zamiast "assertive", żeby nie przerywać w połowie zdania. */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Historia rozmowy"
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
        style={{ backgroundColor: messageAreaBg }}
      >
        {messages.length === 0 && (
          <div className="mt-2">
            {branding?.widget_welcome_message ? (
              <div
                className="rounded-lg px-3 py-2 text-sm mb-3"
                style={{ backgroundColor: botBubbleBg, color: botBubbleText }}
              >
                {branding.widget_welcome_message}
              </div>
            ) : (
              <p className="text-sm text-center mt-2 mb-3" style={{ color: inputHintColor }}>
                Napisz wiadomość, aby rozpocząć rozmowę.
              </p>
            )}

            {/* Gotowe pytania zdejmują z odwiedzającego konieczność wymyślenia
                pierwszego kroku — bez nich puste okno najczęściej się zamyka. */}
            {branding?.widget_suggested_questions?.length ? (
              <div className="flex flex-col gap-1.5 items-start">
                {branding.widget_suggested_questions.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    disabled={sending}
                    className="rounded-full border px-3 py-1.5 text-xs text-left disabled:opacity-50"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2 max-w-[85%]" style={m.sender === 'user' ? { alignSelf: 'flex-end', flexDirection: 'row-reverse' } : undefined}>
            {m.sender === 'bot' && (
              isWhiteLabel && branding?.widget_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.widget_avatar} alt="" className="h-6 w-6 rounded-full shrink-0" />
              ) : (
                <span className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: avatarBg }} />
              )
            )}
            <div className="flex flex-col gap-1">
              <div
                className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                style={{
                  backgroundColor: m.sender === 'user' ? accent : botBubbleBg,
                  color: m.sender === 'user' ? userBubbleText : botBubbleText,
                }}
              >
                {m.text}
                {m.sender === 'bot' && m.text === '' && (
                  <span className="opacity-60">…</span>
                )}
              </div>
              {m.sources && m.sources.length > 0 && (
                <p className="text-xs px-1" style={{ color: inputHintColor }}>
                  Na podstawie:{' '}
                  {m.sources.map((zrodlo, i) => (
                    <span key={`${zrodlo.name}-${i}`}>
                      {i > 0 && ', '}
                      {/* Link tylko dla treści, które i tak są publiczne.
                          Wgrane pliki nie mają adresu celowo — link do cennika
                          czy procedur firmy udostępniłby je każdemu. */}
                      {zrodlo.url?.startsWith('http') ? (
                        <a
                          href={zrodlo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {zrodlo.name}
                        </a>
                      ) : (
                        zrodlo.name
                      )}
                    </span>
                  ))}
                </p>
              )}

              {/* Ocena pojawia się dopiero, gdy odpowiedź jest kompletna: przy
                  pustym tekście strumień jeszcze leci i nie ma czego oceniać. */}
              {m.sender === 'bot' && m.messageId && m.text !== '' && (
                <div className="flex items-center gap-1 px-1">
                  {m.rating ? (
                    <span className="text-xs" style={{ color: inputHintColor }}>
                      {m.rating === 'up' ? 'Dziękujemy za ocenę' : 'Dziękujemy, przekażemy to firmie'}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRate(m.messageId!, 'up')}
                        aria-label="Ta odpowiedź była pomocna"
                        title="Pomocna"
                        className="text-xs px-1.5 py-0.5 rounded hover:opacity-100 opacity-60"
                        style={{ color: inputHintColor }}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleRate(m.messageId!, 'down')}
                        aria-label="Ta odpowiedź nie była pomocna"
                        title="Niepomocna"
                        className="text-xs px-1.5 py-0.5 rounded hover:opacity-100 opacity-60"
                        style={{ color: inputHintColor }}
                      >
                        👎
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.sender === 'user' && (
          <div className="self-start text-sm" style={{ color: inputHintColor }}>Piszę...</div>
        )}

        {contactSent && (
          <div
            className="rounded-lg px-3 py-2 text-sm self-start"
            style={{ backgroundColor: botBubbleBg, color: botBubbleText }}
          >
            Dziękujemy — przekazaliśmy Twój kontakt. Odezwiemy się wkrótce.
          </div>
        )}

        {offerContact && !contactSent && !sending && (
          <div className="self-start w-full">
            {!contactOpen ? (
              <button
                onClick={() => setContactOpen(true)}
                className="text-xs underline"
                style={{ color: inputHintColor }}
              >
                Nie znalazłeś odpowiedzi? Zostaw kontakt do siebie
              </button>
            ) : (
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ backgroundColor: botBubbleBg }}
              >
                <p className="text-xs" style={{ color: botBubbleText }}>
                  Zostaw e-mail lub telefon — odezwiemy się z odpowiedzią.
                </p>
                <input
                  type="text"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
                  placeholder="jan@firma.pl lub 500 100 200"
                  className="rounded border px-2 py-1 text-sm"
                  style={{
                    borderColor: footerBorder,
                    backgroundColor: isWhiteLabel ? '#ffffff' : SMART_THEME.messageAreaBg,
                    color: isWhiteLabel ? '#1c2b36' : SMART_THEME.white,
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleContactSubmit}
                    disabled={!contactValue.trim()}
                    style={{ backgroundColor: accent, color: isWhiteLabel ? '#ffffff' : SMART_THEME.bg }}
                    className="rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Wyślij
                  </button>
                  <button
                    onClick={() => { setContactOpen(false); setOfferContact(false) }}
                    className="text-xs"
                    style={{ color: inputHintColor }}
                  >
                    Nie teraz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div
        style={{ backgroundColor: footerBg, borderTop: `0.5px solid ${footerBorder}` }}
        className="flex items-center gap-2 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Napisz wiadomość..."
          aria-label="Treść wiadomości"
          className="flex-1 rounded border px-3 py-2 text-sm"
          style={{ borderColor: footerBorder, backgroundColor: isWhiteLabel ? '#ffffff' : SMART_THEME.messageAreaBg, color: isWhiteLabel ? '#1c2b36' : SMART_THEME.white }}
        />
        <button
          onClick={() => handleSend()}
          disabled={sending || !input.trim()}
          aria-label="Wyślij wiadomość"
          style={{ backgroundColor: accent, color: isWhiteLabel ? '#ffffff' : SMART_THEME.bg }}
          className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Wyślij
        </button>
      </div>

      {(footerLabel || branding?.privacy_policy_url) && (
        <div
          style={{ backgroundColor: footerBg }}
          className="flex items-center justify-between gap-2 px-3 pb-2"
        >
          {/* RODO: odwiedzający ma być poinformowany o przetwarzaniu tam, gdzie
              zostawia dane — czyli w oknie czatu, a nie dopiero w stopce strony. */}
          {branding?.privacy_policy_url ? (
            <a
              href={branding.privacy_policy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: isWhiteLabel ? '#6b7a88' : '#6B5A48' }}
            >
              Przetwarzanie danych
            </a>
          ) : (
            <span />
          )}
          {footerLabel && (
            <span
              className="text-xs"
              style={{ color: isWhiteLabel ? accent : '#A89880', fontWeight: isWhiteLabel ? 500 : 400 }}
            >
              {footerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
