'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Analytics {
  conversations: { total: number; last_7d: number; last_30d: number }
  questions: { total: number; last_7d: number }
  answer_sources: { document: number; faq: number; gpt: number }
  usage: { used: number; limit: number | null; plan: string | null }
  unanswered: { id: number; question: string; asked_at: string }[]
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [tenantName, setTenantName] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/accounts/me/')
      .then((d) => setTenantName(d.tenant_name || ''))
      .catch(() => {})

    apiFetch('/analytics/')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Nie udało się pobrać statystyk.'))
  }, [])

  const sources = data?.answer_sources
  const answeredFromContent = sources ? sources.document + sources.faq : 0
  const totalAnswers = sources ? answeredFromContent + sources.gpt : 0
  const coverage = totalAnswers > 0 ? Math.round((answeredFromContent / totalAnswers) * 100) : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        {tenantName ? `Witaj, ${tenantName}` : 'Panel główny'}
      </h1>
      <p className="text-gray-600 mb-6">Podsumowanie działania Twojego chatbota.</p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Metric label="Rozmowy (7 dni)" value={data.conversations.last_7d} hint={`łącznie ${data.conversations.total}`} />
            <Metric label="Pytania (7 dni)" value={data.questions.last_7d} hint={`łącznie ${data.questions.total}`} />
            <Metric
              label="Odpowiedzi z Twoich materiałów"
              value={coverage === null ? '—' : `${coverage}%`}
              hint={coverage === null ? 'brak danych' : `${answeredFromContent} z ${totalAnswers}`}
            />
            <Metric
              label="Wykorzystanie planu"
              value={data.usage.limit ? `${data.usage.used} / ${data.usage.limit}` : String(data.usage.used)}
              hint={data.usage.plan ? `plan ${data.usage.plan}` : 'brak subskrypcji'}
            />
          </div>

          <h2 className="text-lg font-semibold mb-1">Pytania bez pokrycia w materiałach</h2>
          <p className="text-sm text-gray-500 mb-3">
            Na te pytania bot odpowiadał bez oparcia w Twoich dokumentach ani FAQ.
            Dodaj brakujące informacje, żeby odpowiadał trafniej.
          </p>

          {data.unanswered.length === 0 ? (
            <p className="text-sm text-gray-400">
              Brak takich pytań — bot znajdował odpowiedzi w Twoich materiałach.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.unanswered.map((item) => (
                <li key={item.id} className="rounded border border-gray-200 px-3 py-2">
                  <p className="text-sm">{item.question}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(item.asked_at).toLocaleString('pl-PL')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
