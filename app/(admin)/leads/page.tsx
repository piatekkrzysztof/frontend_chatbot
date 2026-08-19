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
  powiadomiono_at: string | null
  blad_powiadomienia: string
}

export default function LeadsPage() {
  const [items, setItems] = useState<ContactRequest[]>([])
  const [error, setError] = useState('')
  // null = jeszcze nie wiemy. Bez tego przełącznik migałby przy wczytywaniu
  // z pozycji „wyłączone" na faktyczną.
  const [oRozmowie, setORozmowie] = useState<boolean | null>(null)

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

    apiFetch('/widget-settings/mine/')
      .then((data) => {
        if (active) setORozmowie(Boolean(data.powiadom_o_rozmowie))
      })
      .catch(() => {
        // Cicho: to ustawienie poboczne, a lista zapytań ma się pokazać
        // nawet gdy nie udało się odczytać preferencji powiadomień.
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function przelaczPowiadomienieORozmowie(wlaczone: boolean) {
    // Optymistycznie, żeby kliknięcie było natychmiastowe; przy błędzie wracamy
    const poprzednie = oRozmowie
    setORozmowie(wlaczone)
    try {
      const dane = new FormData()
      dane.append('powiadom_o_rozmowie', String(wlaczone))
      await apiFetch('/widget-settings/mine/', { method: 'PATCH', body: dane })
    } catch (err) {
      setORozmowie(poprzednie)
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać ustawienia.')
    }
  }

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

      {/* Zapytanie powstaje tylko wtedy, gdy ktoś świadomie zostawi namiary —
          a propozycja pojawia się dopiero, gdy bot nie umie odpowiedzieć.
          Ten przełącznik daje sygnał także o rozmowach, które przez to sito
          nie przeszły, a mimo to bywają warte oddzwonienia. */}
      <div className="rounded border obramowanie p-3 mb-6 max-w-2xl">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={oRozmowie === true}
            disabled={oRozmowie === null}
            onChange={(e) => przelaczPowiadomienieORozmowie(e.target.checked)}
          />
          <span>
            Powiadamiaj mnie o każdej rozpoczętej rozmowie
            <span className="block text-xs tekst-slaby mt-0.5">
              Jeden e-mail na rozmowę, z pierwszym pytaniem — wysyłany, gdy ktoś
              napisze pierwszą wiadomość, niezależnie od tego, czy zostawi kontakt.
              Przy większym ruchu to sporo poczty; zapytania dostajesz osobno
              niezależnie od tego ustawienia.
            </span>
          </span>
        </label>
      </div>

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
                  {/* Ostrzeżenie o niedoręczonym powiadomieniu. Bez tego
                      właściciel czeka na maila, który nigdy nie przyszedł,
                      i nie ma jak się dowiedzieć, że nie przyjdzie. */}
                  {item.blad_powiadomienia && (
                    <p className="text-xs mt-1.5 text-[#b3261e]">
                      {item.blad_powiadomienia.startsWith('BRAK_ADRESU')
                        ? 'Nie mamy dokąd wysłać powiadomienia — uzupełnij adres e-mail w ustawieniach konta.'
                        : 'Powiadomienie nie zostało wysłane. Problem jest po stronie poczty, nie Twojego konta — zgłoś to nam.'}
                    </p>
                  )}
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
