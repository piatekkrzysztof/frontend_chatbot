'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface Knowledge {
  has_description: boolean
  documents: number
  indexed_chunks: number
  faqs: number
  websites: number
  is_empty: boolean
}

interface Analytics {
  knowledge: Knowledge
  conversations: { total: number; last_7d: number; last_30d: number }
  questions: { total: number; last_7d: number }
  answer_sources: { document: number; faq: number; gpt: number }
  usage: { used: number; limit: number | null; plan: string | null }
  unanswered: { id: number; question: string; asked_at: string }[]
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-espresso-900 p-4">
      <p className="hint">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
      {hint && <p className="text-xs text-sand-400 mt-1">{hint}</p>}
    </div>
  )
}

/**
 * Bot bez żadnych materiałów celowo odmawia odpowiedzi na każde pytanie o firmę,
 * żeby ich nie zmyślać. Bez tego komunikatu właściciel widzi tylko bota, który
 * "nic nie umie", i nie ma jak się domyślić, że po prostu nie dostał wiedzy.
 */
function KnowledgeNotice({ knowledge }: { knowledge: Knowledge }) {
  if (knowledge.is_empty) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
        <p className="font-medium text-amber-900 mb-1">
          Chatbot nie ma jeszcze żadnej wiedzy o Twojej firmie
        </p>
        <p className="text-sm text-amber-800">
          Dopóki tak jest, na każde pytanie o firmę odpowie, że nie posiada informacji,
          i poprosi o kontakt. To celowe — bez materiałów mógłby zmyślać.
        </p>
        <p className="text-sm text-amber-800 mt-2">
          Uzupełnij przynajmniej jedno:{' '}
          <Link href="/documents" className="underline font-medium">
            opis działalności, dokumenty lub stronę WWW
          </Link>
          , albo <Link href="/faq" className="underline font-medium">FAQ</Link>.
        </p>
      </div>
    )
  }

  const pendingDocs = knowledge.documents > 0 && knowledge.indexed_chunks === 0

  if (!knowledge.has_description) {
    return (
      <div className="rounded-lg border border-espresso-600 bg-espresso-900 p-4 mb-6">
        <p className="text-sm text-cream">
          Nie masz uzupełnionego opisu działalności. Bot odpowie na pytania z dokumentów
          i FAQ, ale na ogólne „czym się zajmujecie?” powie, że nie wie.{' '}
          <Link href="/documents" className="underline font-medium">Uzupełnij opis</Link>.
        </p>
      </div>
    )
  }

  if (pendingDocs) {
    return (
      <div className="rounded-lg border border-espresso-600 bg-espresso-900 p-4 mb-6">
        <p className="text-sm text-cream">
          Twoje dokumenty czekają na przetworzenie — bot jeszcze z nich nie korzysta.
        </p>
      </div>
    )
  }

  return null
}

export default function DashboardPage() {
  const [tenantName, setTenantName] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    apiFetch('/accounts/me/')
      .then((d) => {
        if (active) setTenantName(d.tenant_name || '')
      })
      .catch(() => {})

    apiFetch('/analytics/')
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać statystyk.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
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
      <p className="text-sand-300 mb-6">Podsumowanie działania Twojego chatbota.</p>

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      {data && (
        <>
          <KnowledgeNotice knowledge={data.knowledge} />

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
          <p className="text-sm text-sand-400 mb-3">
            Na te pytania bot odpowiadał bez oparcia w Twoich dokumentach ani FAQ.
            Dodaj brakujące informacje, żeby odpowiadał trafniej.
          </p>

          {data.unanswered.length === 0 ? (
            <p className="text-sm text-sand-400">
              Brak takich pytań — bot znajdował odpowiedzi w Twoich materiałach.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.unanswered.map((item) => (
                <li key={item.id} className="rounded border border-espresso-700 px-3 py-2">
                  <p className="text-sm">{item.question}</p>
                  <p className="text-xs text-sand-400 mt-1">
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
