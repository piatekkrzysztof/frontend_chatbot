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
    let active = true

    apiFetch('/contact-requests/')
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać zapytań.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
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
      <p className="tekst-drugi mb-6">
        Kontakty zostawione przez odwiedzających, gdy bot nie potrafił pomóc.
        {pending.length > 0 && ` Nieobsłużone: ${pending.length}.`}
      </p>

      {error && <p className="text-sm text-[#c0392b] mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm tekst-slaby">Brak zapytań.</p>
      ) : (
        <ul className="flex flex-col gap-3 max-w-2xl">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded border p-3 ${item.handled ? 'obramowanie opacity-60' : 'border-[color:var(--obramowanie-mocne)]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.contact}
                    {item.name && <span className="tekst-slaby font-normal"> — {item.name}</span>}
                  </p>
                  {item.message && (
                    <p className="text-sm tekst-drugi mt-1">
                      Pytanie: {item.message}
                    </p>
                  )}
                  <p className="text-xs tekst-slaby mt-1">
                    {new Date(item.created_at).toLocaleString('pl-PL')}
                  </p>
                </div>
                <button
                  onClick={() => toggleHandled(item)}
                  className="text-sm tekst-drugi hover:underline shrink-0"
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
