'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface PromptLogItem {
  id: number
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

  useEffect(() => {
    apiFetch('/chat/logs/')
      .then((data) => setLogs(Array.isArray(data) ? data : data.results || []))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Konwersacje</h1>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded border border-gray-200 p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>{new Date(log.created_at).toLocaleString('pl-PL')}</span>
              <span className="uppercase">{log.source}</span>
            </div>
            <p className="text-sm mb-1">
              <span className="font-medium">Pytanie: </span>
              {log.prompt}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Odpowiedź: </span>
              {log.response || '–'}
            </p>
          </div>
        ))}
        {logs.length === 0 && !error && (
          <p className="text-gray-400">Brak zarejestrowanych konwersacji.</p>
        )}
      </div>
    </div>
  )
}
