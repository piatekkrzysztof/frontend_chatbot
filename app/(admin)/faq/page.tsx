'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

interface FAQItem {
  id: number
  question: string
  answer: string
}

export default function FAQPage() {
  const [items, setItems] = useState<FAQItem[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await apiFetch('/faq/')
      setItems(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać FAQ.')
    }
  }

  useEffect(() => {
    let active = true

    apiFetch('/faq/')
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać FAQ.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    setSaving(true)
    setError('')

    try {
      await apiFetch('/faq/', {
        method: 'POST',
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      })
      setQuestion('')
      setAnswer('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/faq/${id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć.')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">FAQ</h1>
      <p className="text-sand-300 mb-6">
        Gotowe pytania i odpowiedzi. Bot korzysta z nich w rozmowach, więc to
        najszybszy sposób, żeby nauczyć go czegoś, czego nie ma w dokumentach.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 max-w-2xl mb-8">
        <div>
          <label className="label">Pytanie</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Jakie są godziny otwarcia?"
            className="input"
          />
        </div>
        <div>
          <label className="label">Odpowiedź</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Pracujemy od poniedziałku do piątku w godzinach 9-17."
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !question.trim() || !answer.trim()}
          className="btn-primary w-fit !py-2 !px-4 !text-sm"
        >
          {saving ? 'Zapisywanie...' : 'Dodaj do FAQ'}
        </button>
      </form>

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-sand-400">Brak wpisów w FAQ.</p>
      ) : (
        <ul className="flex flex-col gap-3 max-w-2xl">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-espresso-700 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.question}</p>
                  <p className="text-sm text-sand-300 mt-1 whitespace-pre-wrap">{item.answer}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-sm text-rose-400 hover:underline shrink-0"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
