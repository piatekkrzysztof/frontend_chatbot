'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface PromptLogItem {
  id: number
  conversation_session_id: string | null
  prompt: string
  response: string | null
  source: string
  tokens: number
  created_at: string
  is_helpful: boolean | null
}

export default function ConversationsPage() {
  const [logs, setLogs] = useState<PromptLogItem[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    apiFetch('/chat/logs/')
      .then((data) => {
        if (active) setLogs(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać konwersacji.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function copySessionId(sessionId: string) {
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(sessionId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // schowek bywa zablokowany — identyfikator i tak jest widoczny do zaznaczenia
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Konwersacje</h1>
      <p className="text-sand-300 mb-6">
        Identyfikator rozmowy przydaje się, gdy ktoś poprosi o usunięcie swoich danych —
        wklej go w zakładce Prywatność.
      </p>

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded border border-espresso-700 p-4">
            <div className="flex items-center justify-between text-xs text-sand-400 mb-2">
              <span>{new Date(log.created_at).toLocaleString('pl-PL')}</span>
              <span className="uppercase">{log.source}</span>
            </div>
            <p className="text-sm mb-1">
              <span className="font-medium">Pytanie: </span>
              {log.prompt}
            </p>
            <p className="text-sm text-cream">
              <span className="font-medium">Odpowiedź: </span>
              {log.response || '–'}
            </p>
            {log.conversation_session_id && (
              <button
                onClick={() => copySessionId(log.conversation_session_id!)}
                title="Kopiuj identyfikator rozmowy"
                className="mt-3 text-xs font-mono text-sand-400 hover:text-cream"
              >
                {copied === log.conversation_session_id
                  ? 'Skopiowano'
                  : log.conversation_session_id}
              </button>
            )}
          </div>
        ))}
        {logs.length === 0 && !error && (
          <p className="text-sand-400">Brak zarejestrowanych konwersacji.</p>
        )}
      </div>
    </div>
  )
}
