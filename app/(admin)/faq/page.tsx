'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'
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
  // Kasowanie bylo natychmiastowe: jedno dotkniecie 32-pikselowego celu
  // i wpis znikal bez potwierdzenia i bez cofniecia. Zamiast modala —
  // dwustopniowy przycisk w miejscu: pierwszy klik pyta, drugi kasuje.
  const [doKasacji, setDoKasacji] = useState<number | null>(null)
  const zegar = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pytanie samo wygasa, zeby nie zostawiac uzbrojonego przycisku na ekranie.
  function uzbrojDoKasacji(id: number) {
    if (zegar.current) clearTimeout(zegar.current)
    setDoKasacji(id)
    zegar.current = setTimeout(() => setDoKasacji(null), 5000)
  }

  useEffect(() => () => { if (zegar.current) clearTimeout(zegar.current) }, [])

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
    if (zegar.current) clearTimeout(zegar.current)
    setDoKasacji(null)
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
      <p className="tekst-drugi mb-6">
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

      {error && <p className="text-sm text-[#c0392b] mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm tekst-slaby">Brak wpisów w FAQ.</p>
      ) : (
        <ul className="flex flex-col gap-3 max-w-2xl">
          {items.map((item) => (
            <li key={item.id} className="rounded border obramowanie p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.question}</p>
                  <p className="text-sm tekst-drugi mt-1 whitespace-pre-wrap">{item.answer}</p>
                </div>
                <button
                  onClick={() =>
                    doKasacji === item.id ? handleDelete(item.id) : uzbrojDoKasacji(item.id)
                  }
                  aria-label={
                    doKasacji === item.id
                      ? `Potwierdź usunięcie: ${item.question}`
                      : `Usuń pytanie: ${item.question}`
                  }
                  className="text-sm text-[#c0392b] hover:underline shrink-0"
                >
                  {doKasacji === item.id ? 'Na pewno?' : 'Usuń'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
