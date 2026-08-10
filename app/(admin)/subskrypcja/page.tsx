'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Plan {
  code: string
  name: string
  price_pln: number
  message_limit: number
  white_label: boolean
  available: boolean
  current: boolean
}

interface Current {
  plan: string | null
  name: string | null
  in_catalogue: boolean
  is_active: boolean
  used: number
  limit: number
  renews_at: string | null
}

interface Overview {
  current: Current
  plans: Plan[]
}

interface Domena {
  id: number
  host: string
  last_seen: string
}

export default function SubskrypcjaPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [domeny, setDomeny] = useState<Domena[] | null>(null)
  const [limitDomen, setLimitDomen] = useState<number | null>(null)
  const [buying, setBuying] = useState('')

  useEffect(() => {
    let active = true

    apiFetch('/billing/plans/')
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać cennika.')
      })

    apiFetch('/widget-domains/')
      .then((d) => {
        if (!active) return
        setDomeny(d.domains)
        setLimitDomen(d.limit)
      })
      .catch(() => {})

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function handleBuy(code: string) {
    setBuying(code)
    setError('')

    try {
      const res = await apiFetch('/billing/create-checkout-session/', {
        method: 'POST',
        body: JSON.stringify({ plan_type: code }),
      })
      // Płatność prowadzi Stripe — opuszczamy panel
      window.location.href = res.checkout_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się rozpocząć płatności.')
      setBuying('')
    }
  }

  async function usunDomene(id: number) {
    try {
      await apiFetch(`/widget-domains/${id}/`, { method: 'DELETE' })
      setDomeny((poprzednie) => (poprzednie || []).filter((d) => d.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć witryny.')
    }
  }

  const current = data?.current
  const wykorzystanie =
    current && current.limit > 0 ? Math.min(100, Math.round((current.used / current.limit) * 100)) : 0

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Subskrypcja</h1>
      <p className="text-gray-600 mb-8">
        Limit dotyczy wiadomości wysłanych przez odwiedzających Twoją stronę w danym miesiącu.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {current && (
        <div className="rounded-lg border border-gray-200 p-4 mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-medium">
              Twój plan: {current.name || 'brak'}
              {!current.is_active && (
                <span className="ml-2 text-sm text-red-600 font-normal">nieaktywny</span>
              )}
            </p>
            <p className="text-sm text-gray-500">
              {current.used} / {current.limit} wiadomości
            </p>
          </div>

          <div className="h-2 rounded bg-gray-100 overflow-hidden">
            <div
              className={`h-full ${
                wykorzystanie >= 95
                  ? 'bg-red-500'
                  : wykorzystanie >= 80
                    ? 'bg-amber-500'
                    : 'bg-gray-900'
              }`}
              style={{ width: `${wykorzystanie}%` }}
            />
          </div>

          {/* Progi te same co w alertach mailowych (accounts/plans.py) — inaczej
              klient widziałby w panelu inną historię niż w wiadomości od nas */}
          {wykorzystanie >= 100 ? (
            <p className="text-sm text-red-600 mt-2">
              Limit wyczerpany — chatbot nie odpowiada już odwiedzającym.
              Przejdź na wyższy plan, żeby go przywrócić.
            </p>
          ) : wykorzystanie >= 95 ? (
            <p className="text-sm text-red-600 mt-2">
              Limit prawie wyczerpany. Po jego przekroczeniu chatbot przestanie odpowiadać
              odwiedzającym Twoją stronę.
            </p>
          ) : wykorzystanie >= 80 ? (
            <p className="text-sm text-amber-700 mt-2">
              Zużyto {wykorzystanie}% limitu. Na razie wszystko działa normalnie.
            </p>
          ) : null}

          {current.plan && !current.in_catalogue && (
            <p className="text-sm text-gray-500 mt-2">
              To plan spoza aktualnego cennika — zachowuje swoje warunki.
            </p>
          )}
        </div>
      )}

      {domeny && (
        <div className="rounded-lg border border-gray-200 p-4 mb-8">
          <div className="flex items-baseline justify-between mb-1">
            <p className="font-medium">Witryny z widgetem</p>
            <p className="text-sm text-gray-500">
              {domeny.length}
              {limitDomen !== null ? ` / ${limitDomen}` : ''} witryn
            </p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Wykrywamy je automatycznie, gdy widget pierwszy raz zapyta z danej strony.
            Adresy lokalne nie liczą się do limitu. Usunięcie zwalnia miejsce — witryna
            wróci na listę, jeśli widget znów z niej zapyta.
          </p>

          {domeny.length === 0 ? (
            <p className="text-sm text-gray-500">
              Jeszcze nic nie wykryliśmy. Wklej kod widgetu na swoją stronę i odśwież ją.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100">
              {domeny.map((domena) => (
                <li key={domena.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{domena.host}</span>
                  <button
                    onClick={() => usunDomene(domena.id)}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data?.plans.map((plan) => (
          <div
            key={plan.code}
            className={`rounded-lg border p-5 flex flex-col ${
              plan.current ? 'border-gray-900 border-2' : 'border-gray-200'
            }`}
          >
            <h2 className="font-semibold text-lg">{plan.name}</h2>
            <p className="text-3xl font-bold mt-2 mb-1">
              {plan.price_pln} <span className="text-base font-normal text-gray-500">zł/mies.</span>
            </p>

            <ul className="text-sm text-gray-600 flex flex-col gap-1 mt-4 mb-6">
              <li>{plan.message_limit.toLocaleString('pl-PL')} wiadomości miesięcznie</li>
              <li>Nieograniczona liczba dokumentów i FAQ</li>
              <li className={plan.white_label ? '' : 'text-gray-400'}>
                {plan.white_label ? 'Widget w Twojej marce' : 'Widget w marce Sm-art'}
              </li>
            </ul>

            <div className="mt-auto">
              {plan.current ? (
                <p className="text-sm text-center text-gray-500 py-2">Twój obecny plan</p>
              ) : plan.available ? (
                <button
                  onClick={() => handleBuy(plan.code)}
                  disabled={!!buying}
                  className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white font-medium disabled:opacity-50"
                >
                  {buying === plan.code ? 'Przenoszę do płatności...' : 'Wybierz plan'}
                </button>
              ) : (
                <p
                  className="text-xs text-center text-gray-400 py-2"
                  title="Brak skonfigurowanej ceny w Stripe"
                >
                  Wkrótce dostępny
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-6">
        Płatność obsługuje Stripe. Danych karty nie przechowujemy ani nie widzimy.
      </p>
    </div>
  )
}
