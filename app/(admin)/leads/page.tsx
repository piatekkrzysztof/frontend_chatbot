'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ContactRequest {
  id: number
  name: string
  contact: string
  message: string
  handled: boolean
  created_at: string
}

export default function LeadsPage() {
  const [items, setItems] = useState<ContactRequest[]>([])
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await apiFetch('/contact-requests/')
      setItems(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać zapytań.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleHandled(item: ContactRequest) {
    try {
      await apiFetch(`/contact-requests/${item.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ handled: !item.handled }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać.')
    }
  }

  const pending = items.filter((i) => !i.handled)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Zapytania</h1>
      <p className="text-gray-600 mb-6">
        Kontakty zostawione przez odwiedzających, gdy bot nie potrafił pomóc.
        {pending.length > 0 && ` Nieobsłużone: ${pending.length}.`}
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Brak zapytań.</p>
      ) : (
        <ul className="flex flex-col gap-3 max-w-2xl">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded border p-3 ${item.handled ? 'border-gray-200 opacity-60' : 'border-gray-300'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.contact}
                    {item.name && <span className="text-gray-500 font-normal"> — {item.name}</span>}
                  </p>
                  {item.message && (
                    <p className="text-sm text-gray-600 mt-1">
                      Pytanie: {item.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(item.created_at).toLocaleString('pl-PL')}
                  </p>
                </div>
                <button
                  onClick={() => toggleHandled(item)}
                  className="text-sm text-gray-600 hover:underline shrink-0"
                >
                  {item.handled ? 'Cofnij' : 'Obsłużone'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
