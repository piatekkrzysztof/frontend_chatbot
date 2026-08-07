'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface Message {
  sender: 'user' | 'bot'
  text: string
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

  const [title, setTitle] = useState('Chatbot')
  const [color, setColor] = useState('#111827')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!apiKey) return

    fetch(`${API_URL}/widget-settings/`, { headers: { 'X-API-Key': apiKey } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTitle(data.widget_title || 'Chatbot')
          setColor(data.widget_color || '#111827')
        }
        setReady(true)
      })
      .catch(() => setReady(true))
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
      const res = await fetch(`${API_URL}/widget/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          message: text,
          conversation_id: sessionId,
          conversation_session_id: sessionId,
        }),
      })

      if (!res.ok) {
        throw new Error('Wystąpił błąd. Spróbuj ponownie.')
      }

      const data = await res.json()
      setMessages((prev) => [...prev, { sender: 'bot', text: data.response }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.' },
      ])
    } finally {
      setSending(false)
    }
  }

  if (!apiKey) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500 p-4 text-center">
        Brak klucza widgetu. Sprawdź kod osadzania na stronie.
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div style={{ backgroundColor: color }} className="px-4 py-3 text-white font-medium">
        {title}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 && ready && (
          <p className="text-sm text-gray-400 text-center mt-4">Napisz wiadomość, aby rozpocząć rozmowę.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.sender === 'user'
                ? 'self-end bg-gray-100 text-gray-900'
                : 'self-start text-white'
            }`}
            style={m.sender === 'bot' ? { backgroundColor: color } : undefined}
          >
            {m.text}
          </div>
        ))}
        {sending && (
          <div className="self-start rounded-lg px-3 py-2 text-sm text-gray-400">Piszę...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Napisz wiadomość..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{ backgroundColor: color }}
          className="rounded px-4 py-2 text-sm text-white font-medium disabled:opacity-50"
        >
          Wyślij
        </button>
      </div>
    </div>
  )
}
