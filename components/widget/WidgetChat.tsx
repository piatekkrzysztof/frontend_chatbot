'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const SMART_THEME = {
  bg: '#110c04',
  messageAreaBg: '#241a0e',
  bubbleBg: '#332612',
  accent: '#F97316',
  white: '#FAF8F5',
  muted: '#6B5A48',
}

interface Message {
  sender: 'user' | 'bot'
  text: string
  sources?: string[]
}

interface Branding {
  branding_mode: 'smart' | 'white_label'
  widget_title: string
  widget_color: string
  widget_footer_text: string
  widget_logo: string | null
  widget_avatar: string | null
  privacy_policy_url: string
}

function getSessionId(apiKey: string) {
  const storageKey = `widget_session_${apiKey}`
  let sessionId = sessionStorage.getItem(storageKey)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, sessionId)
  }
  return sessionId
}

export default function WidgetChat() {
  const searchParams = useSearchParams()
  const apiKey = searchParams.get('key') || ''

  const [branding, setBranding] = useState<Branding | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Eskalacja do człowieka — pojawia się, gdy bot odpowiedział bez pokrycia w materiałach
  const [offerContact, setOfferContact] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactValue, setContactValue] = useState('')
  const [contactSent, setContactSent] = useState(false)

  useEffect(() => {
    if (!apiKey) return

    fetch(`${API_URL}/widget-settings/`, { headers: { 'X-API-Key': apiKey } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBranding(data))
      .catch(() => setBranding(null))
  }, [apiKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
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
                next[next.length - 1] = { ...next[next.length - 1], sources: event.sources }
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

  const isWhiteLabel = branding?.branding_mode === 'white_label'
  const accent = isWhiteLabel ? branding?.widget_color || '#111827' : SMART_THEME.accent
  const name = isWhiteLabel ? branding?.widget_title || 'Chatbot' : 'Sm-art'
  const headerBg = isWhiteLabel ? accent : SMART_THEME.bg
  const headerText = isWhiteLabel ? '#ffffff' : SMART_THEME.white
  const messageAreaBg = isWhiteLabel ? '#f1f5f8' : SMART_THEME.messageAreaBg
  const botBubbleBg = isWhiteLabel ? '#eef2f6' : SMART_THEME.bubbleBg
  const botBubbleText = isWhiteLabel ? '#1c2b36' : SMART_THEME.white
  const userBubbleText = isWhiteLabel ? '#ffffff' : SMART_THEME.bg
  const footerBg = isWhiteLabel ? '#ffffff' : SMART_THEME.bg
  const footerBorder = isWhiteLabel ? '#eef2f6' : 'rgba(250,248,245,0.06)'
  const inputHintColor = isWhiteLabel ? '#9fb0bd' : SMART_THEME.muted
  const footerLabel = isWhiteLabel ? branding?.widget_footer_text : 'Powered by Sm-art'
  const avatarBg = isWhiteLabel ? '#d7e3ee' : '#332612'

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: isWhiteLabel ? '#ffffff' : SMART_THEME.bg }}>
      <div
        style={{ backgroundColor: headerBg, color: headerText }}
        className="px-4 py-3 font-medium flex items-center gap-2"
      >
        {isWhiteLabel && branding?.widget_logo ? (
          // Logo klienta z backendu/S3 — widget działa w iframe, optymalizacja
          // next/image tylko dokładałaby zależność od konfiguracji domen.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.widget_logo} alt="" className="h-6" />
        ) : (
          <span
            style={{
              backgroundColor: isWhiteLabel ? '#ffffff' : accent,
              color: isWhiteLabel ? accent : SMART_THEME.bg,
            }}
            className="h-6 w-6 rounded flex items-center justify-center text-xs font-medium"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        {name}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" style={{ backgroundColor: messageAreaBg }}>
        {messages.length === 0 && (
          <p className="text-sm text-center mt-4" style={{ color: inputHintColor }}>
            Napisz wiadomość, aby rozpocząć rozmowę.
          </p>
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
                  Na podstawie: {m.sources.join(', ')}
                </p>
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
          className="flex-1 rounded border px-3 py-2 text-sm"
          style={{ borderColor: footerBorder, backgroundColor: isWhiteLabel ? '#ffffff' : SMART_THEME.messageAreaBg, color: isWhiteLabel ? '#1c2b36' : SMART_THEME.white }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
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
