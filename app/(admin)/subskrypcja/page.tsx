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
  stripe_status: string
  access_until: string | null
  has_stripe_subscription: boolean
  portal_available: boolean
  can_manage: boolean
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

/** Data z API (RRRR-MM-DD) po polsku. Bez `new Date`, ktore przesuwa dzien o strefe czasowa. */
function dataPl(data: string | null) {
  if (!data) return ''
  const [rok, miesiac, dzien] = data.split('-')
  return `${dzien}.${miesiac}.${rok}`
}

// Po powrocie z portalu Stripe zdarzenie o zmianie planu potrafi dojsc do
// backendu kilka sekund pozniej. Jedno ponowne pobranie, nie odpytywanie.
const ODSWIEZENIE_PO_ZMIANIE_MS = 4000

export default function SubskrypcjaPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [komunikat, setKomunikat] = useState('')
  const [domeny, setDomeny] = useState<Domena[] | null>(null)
  const [limitDomen, setLimitDomen] = useState<number | null>(null)
  const [otwieram, setOtwieram] = useState('')

  useEffect(() => {
    let active = true
    let zegar: ReturnType<typeof setTimeout> | null = null
    const poZmianie = new URLSearchParams(window.location.search).get('zmiana') === '1'

    function pobierzPlany() {
      apiFetch('/billing/plans/')
        .then((d) => {
          if (!active) return
          setData(d)
          if (poZmianie) {
            setKomunikat(
              'Zmiana zapisana w Stripe. Wyższy plan pojawi się tutaj w ciągu kilku sekund, ' +
                'niższy zacznie obowiązywać od następnego okresu rozliczeniowego.',
            )
          }
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać cennika.')
        })
    }

    pobierzPlany()

    if (poZmianie) {
      // Odswiezenie strony nie powinno drugi raz oglaszac tej samej zmiany.
      window.history.replaceState(window.history.state, '', window.location.pathname)
      zegar = setTimeout(pobierzPlany, ODSWIEZENIE_PO_ZMIANIE_MS)
    }

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
      if (zegar) clearTimeout(zegar)
    }
  }, [])

  async function przejdzDoStripe(
    klucz: string,
    sciezka: string,
    cialo: object,
    pole: 'checkout_url' | 'portal_url',
    bladDomyslny: string,
  ) {
    setOtwieram(klucz)
    setError('')

    try {
      const res = await apiFetch(sciezka, { method: 'POST', body: JSON.stringify(cialo) })
      // Płatność i zmiany planu prowadzi Stripe — opuszczamy panel. Przypisanie
      // do window.location.href to nawigacja przegladarki, nie mutacja wartosci
      // Reacta; regula nie odroznia jednego od drugiego.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = res[pole]
    } catch (err) {
      setError(err instanceof Error ? err.message : bladDomyslny)
      setOtwieram('')
    }
  }

  function wybierzPlan(code: string) {
    if (current?.has_stripe_subscription) {
      // Zmiana na TEJ SAMEJ subskrypcji. Nowy zakup zalozylby druga
      // subskrypcje i dwa obciazenia co miesiac.
      przejdzDoStripe(
        code,
        '/billing/portal/',
        { plan_type: code },
        'portal_url',
        'Nie udało się otworzyć zmiany planu.',
      )
    } else {
      przejdzDoStripe(
        code,
        '/billing/create-checkout-session/',
        { plan_type: code },
        'checkout_url',
        'Nie udało się rozpocząć płatności.',
      )
    }
  }

  function otworzPortal(klucz: string) {
    przejdzDoStripe(
      klucz,
      '/billing/portal/',
      {},
      'portal_url',
      'Nie udało się otworzyć zarządzania subskrypcją.',
    )
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
  // Stripe ponawia platnosc, a firma ma dostep do konca oplaconego okresu
  // + 3 dni. Bez tej informacji wlasciciel dowiadywal sie o problemie
  // dopiero wtedy, gdy chatbot zamilkl.
  const nieudanaPlatnosc = !!current?.is_active && current.stripe_status === 'past_due'

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Subskrypcja</h1>
      <p className="tekst-drugi mb-8">
        Limit dotyczy wiadomości wysłanych przez odwiedzających Twoją stronę w danym miesiącu.
      </p>

      {error && <p role="alert" className="text-sm text-[#c0392b] mb-4">{error}</p>}
      {komunikat && <p role="status" className="text-sm tekst-drugi mb-4">{komunikat}</p>}

      {current && nieudanaPlatnosc && (
        <div role="alert" className="card p-5 mb-6 border-2 border-[#c0392b]">
          <p className="font-medium text-[#c0392b]">Płatność za odnowienie nie przeszła</p>
          <p className="text-sm tekst-drugi mt-1">
            Chatbot działa do {dataPl(current.access_until)}. Stripe ponowi próbę w najbliższych
            dniach. Zmień kartę przed tym terminem, żeby widget nie przestał odpowiadać
            odwiedzającym.
          </p>
          {current.can_manage ? (
            <button
              onClick={() => otworzPortal('karta')}
              disabled={!!otwieram}
              className="btn-primary !py-2 !px-4 !text-sm mt-3"
            >
              {otwieram === 'karta' ? 'Otwieram Stripe...' : 'Zmień kartę'}
            </button>
          ) : (
            <p className="text-sm tekst-slaby mt-2">Kartę zmienia właściciel konta.</p>
          )}
        </div>
      )}

      {current && (
        <div className="card p-5 mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-medium">
              Twój plan: {current.name || 'brak'}
              {!current.is_active && (
                <span className="ml-2 text-sm text-[#c0392b] font-normal">nieaktywny</span>
              )}
            </p>
            <p className="text-sm tekst-slaby">
              {current.used} / {current.limit} wiadomości
            </p>
          </div>

          <div className="h-2 rounded powierzchnia-2 overflow-hidden">
            <div
              className={`h-full ${
                wykorzystanie >= 95
                  ? 'bg-[#c0392b]'
                  : wykorzystanie >= 80
                    ? 'bg-[#e8890b]'
                    : 'bg-ember-500'
              }`}
              style={{ width: `${wykorzystanie}%` }}
            />
          </div>

          {/* Progi te same co w alertach mailowych (accounts/plans.py) — inaczej
              klient widziałby w panelu inną historię niż w wiadomości od nas */}
          {wykorzystanie >= 100 ? (
            <p className="text-sm text-[#c0392b] mt-2">
              Limit wyczerpany — chatbot nie odpowiada już odwiedzającym.
              Przejdź na wyższy plan, żeby go przywrócić.
            </p>
          ) : wykorzystanie >= 95 ? (
            <p className="text-sm text-[#c0392b] mt-2">
              Limit prawie wyczerpany. Po jego przekroczeniu chatbot przestanie odpowiadać
              odwiedzającym Twoją stronę.
            </p>
          ) : wykorzystanie >= 80 ? (
            <p className="text-sm text-[color:var(--akcent-tekst)] mt-2">
              Zużyto {wykorzystanie}% limitu. Na razie wszystko działa normalnie.
            </p>
          ) : null}

          {current.plan && !current.in_catalogue && (
            <p className="text-sm tekst-slaby mt-2">
              To plan spoza aktualnego cennika — zachowuje swoje warunki.
            </p>
          )}

          {current.portal_available && current.can_manage && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                onClick={() => otworzPortal('portal')}
                disabled={!!otwieram}
                className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm font-medium"
              >
                {otwieram === 'portal' ? 'Otwieram Stripe...' : 'Zarządzaj subskrypcją'}
              </button>
              <p className="text-xs tekst-slaby">
                Karta, faktury i anulowanie w bezpiecznym portalu Stripe.
              </p>
            </div>
          )}
        </div>
      )}

      {domeny && (
        <div className="card p-5 mb-6">
          <div className="flex items-baseline justify-between mb-1">
            <p className="font-medium">Witryny z widgetem</p>
            <p className="text-sm tekst-slaby">
              {domeny.length}
              {limitDomen !== null ? ` / ${limitDomen}` : ''} witryn
            </p>
          </div>
          <p className="text-xs tekst-slaby mb-3">
            Wykrywamy je automatycznie, gdy widget pierwszy raz zapyta z danej strony.
            Adresy lokalne nie liczą się do limitu. Usunięcie zwalnia miejsce — witryna
            wróci na listę, jeśli widget znów z niej zapyta.
          </p>

          {domeny.length === 0 ? (
            <p className="text-sm tekst-slaby">
              Jeszcze nic nie wykryliśmy. Wklej kod widgetu na swoją stronę i odśwież ją.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--obramowanie)]">
              {domeny.map((domena) => (
                <li key={domena.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{domena.host}</span>
                  {/* Odstep zamiast samego tekstu: napis "Usuń" mial 28x16 px, ponizej
                      minimum 24 px celu wskaznika (WCAG 2.2, 2.5.8) */}
                  <button
                    onClick={() => usunDomene(domena.id)}
                    className="-mr-2 px-2 py-1 text-xs tekst-slaby hover:text-[#c0392b]"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {current && !current.can_manage && (
        <p className="text-sm tekst-slaby mb-4">Plan i płatności zmienia właściciel konta.</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data?.plans?.map((plan) => (
          <div
            key={plan.code}
            className={`card p-5 flex flex-col ${
              plan.current ? 'border-[color:var(--akcent)] border-2' : ''
            }`}
          >
            <h2 className="font-semibold text-lg">{plan.name}</h2>
            <p className="text-3xl font-bold mt-2 mb-1">
              {plan.price_pln} <span className="text-base font-normal tekst-slaby">zł/mies.</span>
            </p>

            <ul className="text-sm tekst-drugi flex flex-col gap-1 mt-4 mb-6">
              <li>{plan.message_limit.toLocaleString('pl-PL')} wiadomości miesięcznie</li>
              <li>Nieograniczona liczba dokumentów i FAQ</li>
              <li className={plan.white_label ? '' : 'tekst-slaby'}>
                {plan.white_label ? 'Widget w Twojej marce' : 'Widget w marce Sm-art'}
              </li>
            </ul>

            <div className="mt-auto">
              {plan.current ? (
                <p className="text-sm text-center tekst-slaby py-2">Twój obecny plan</p>
              ) : !plan.available ? (
                <p
                  className="text-xs text-center tekst-slaby py-2"
                  title="Brak skonfigurowanej ceny w Stripe"
                >
                  Wkrótce dostępny
                </p>
              ) : current?.can_manage ? (
                <button
                  onClick={() => wybierzPlan(plan.code)}
                  disabled={!!otwieram}
                  className="btn-primary w-full !py-2 !text-sm"
                >
                  {otwieram === plan.code
                    ? current.has_stripe_subscription
                      ? 'Otwieram Stripe...'
                      : 'Przenoszę do płatności...'
                    : current.has_stripe_subscription
                      ? `Przejdź na ${plan.name}`
                      : 'Wybierz plan'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {current?.has_stripe_subscription && current.can_manage && (
        <p className="text-sm tekst-drugi mt-6">
          Wyższy plan działa od razu - Stripe pobierze tylko różnicę za bieżący okres. Niższy plan
          zacznie obowiązywać od następnego okresu rozliczeniowego. Dokładną kwotę zobaczysz przed
          potwierdzeniem.
        </p>
      )}

      <p className="text-xs tekst-slaby mt-6">
        Płatność obsługuje Stripe. Danych karty nie przechowujemy ani nie widzimy.
      </p>
    </div>
  )
}
