'use client'

import { useEffect, useState } from 'react'
import { apiFetch, BladApi, pobierzPlik } from '@/lib/api'
import Stronicowanie, { naStrone, type StronaListy } from '@/components/Stronicowanie'

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
  const [strona, setStrona] = useState<StronaListy<PromptLogItem> | null>(null)
  const [numer, setNumer] = useState(1)
  const [wczytanyNumer, setWczytanyNumer] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [eksportuje, setEksportuje] = useState(false)

  // Wyliczone, nie trzymane osobno - jak w Dzienniku: zapomniana gałąź
  // zostawiłaby "wczytuję" na ekranie bez końca.
  const wczytuje = wczytanyNumer !== numer && !error

  useEffect(() => {
    let active = true

    // Historia rośnie z każdą rozmową. Wcześniej ekran wczytywał ją całą przy
    // każdym wejściu - teraz stronami, od najnowszych.
    apiFetch(`/chat/logs/?page=${numer}`)
      .then((data) => {
        if (!active) return
        setStrona(naStrone<PromptLogItem>(data))
        setWczytanyNumer(numer)
        setError('')
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać konwersacji.')
      })

    // Odpowiedź na porzuconą stronę nie może nadpisać tej, którą już widać
    return () => {
      active = false
    }
  }, [numer])

  async function eksportuj() {
    setEksportuje(true)
    setError('')
    try {
      await pobierzPlik('/chat/export/', 'rozmowy.csv')
    } catch (err) {
      // 403 to granica roli, nie awaria. Angielskie zdanie z DRF kazałoby
      // szukać usterki, której nie ma.
      setError(
        err instanceof BladApi && err.status === 403
          ? 'Eksport rozmów jest dostępny dla właściciela i pracownika.'
          : err instanceof Error
            ? err.message
            : 'Nie udało się pobrać pliku.',
      )
    } finally {
      setEksportuje(false)
    }
  }

  async function copySessionId(sessionId: string) {
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(sessionId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // schowek bywa zablokowany — identyfikator i tak jest widoczny do zaznaczenia
    }
  }

  const logs = strona?.results ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Konwersacje</h1>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <p className="tekst-drugi max-w-2xl">
          Identyfikator rozmowy przydaje się, gdy ktoś poprosi o usunięcie swoich danych —
          wklej go w zakładce Prywatność.
        </p>
        {/* Backend potrafił to od dawna i zapisuje eksport w dzienniku, ale
            panel nie miał czym tego wywołać. */}
        <button
          type="button"
          onClick={eksportuj}
          disabled={eksportuje}
          className="btn-ghost shrink-0 disabled:opacity-50"
        >
          {eksportuje ? 'Przygotowuję plik...' : 'Pobierz CSV'}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-[#c0392b] mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded border obramowanie p-4">
            <div className="flex items-center justify-between text-xs tekst-slaby mb-2">
              <span>{new Date(log.created_at).toLocaleString('pl-PL')}</span>
              <span className="uppercase">{log.source}</span>
            </div>
            <p className="text-sm mb-1">
              <span className="font-medium">Pytanie: </span>
              {log.prompt}
            </p>
            <p className="text-sm text-[color:var(--tekst)]">
              <span className="font-medium">Odpowiedź: </span>
              {log.response || '–'}
            </p>
            {log.conversation_session_id && (
              <button
                onClick={() => copySessionId(log.conversation_session_id!)}
                title="Kopiuj identyfikator rozmowy"
                className="mt-3 text-xs font-mono tekst-slaby hover:text-[color:var(--tekst)]"
              >
                {copied === log.conversation_session_id
                  ? 'Skopiowano'
                  : log.conversation_session_id}
              </button>
            )}
          </div>
        ))}
        {strona && logs.length === 0 && !error && (
          <p className="tekst-slaby">Brak zarejestrowanych konwersacji.</p>
        )}
      </div>

      {strona && (
        <Stronicowanie
          numer={numer}
          poprzednia={!!strona.previous}
          nastepna={!!strona.next}
          lacznie={strona.count}
          wczytuje={wczytuje}
          opisLacznie="wpisów łącznie"
          onZmien={setNumer}
        />
      )}
    </div>
  )
}
