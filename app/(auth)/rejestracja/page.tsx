'use client'

import ResendConfirmation from '@/components/auth/ResendConfirmation'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import { FormEvent, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { API_URL } from '@/lib/api'

/**
 * Błędy zwrócone przez backend, pole po polu.
 *
 * Wcześniej pokazywaliśmy pierwszy z brzegu nad przyciskiem. Przy trzech polach
 * dawało się zgadnąć, którego dotyczy; przy dziesięciu to już zgadywanka, i to
 * na końcu długiego formularza - czyli dokładnie tam, gdzie ludzie rezygnują.
 */
type BledyPol = Record<string, string>

/** Etykieta pola nad polem, wraz z komunikatem błędu i podpowiedzią. */
function Pole({
  id,
  etykieta,
  podpowiedz,
  blad,
  children,
}: {
  id: string
  etykieta: string
  podpowiedz?: string
  blad?: string
  children: React.ReactNode
}) {
  const idOpisu = podpowiedz ? `${id}-opis` : undefined
  const idBledu = blad ? `${id}-blad` : undefined

  return (
    <div>
      <label className="label" htmlFor={id}>
        {etykieta}
      </label>
      {children}
      {podpowiedz && (
        <p id={idOpisu} className="hint mt-1.5">
          {podpowiedz}
        </p>
      )}
      {blad && (
        // role="alert", żeby czytnik ekranu przeczytał komunikat od razu.
        // Sam czerwony tekst jest niewidoczny dla części użytkowników, a to
        // jedyna informacja o tym, czemu formularz nie przeszedł.
        <p id={idBledu} role="alert" className="mt-1.5 text-sm text-rose-400">
          {blad}
        </p>
      )}
    </div>
  )
}

function FormularzRejestracji() {
  const params = useSearchParams()

  // Plan wybrany na stronie cennika. Zapamiętujemy go tylko po to, żeby
  // pokazać klientowi, że trafił tam, gdzie klikał — zakup i tak następuje
  // po okresie próbnym, w panelu.
  const wybranyPlan = params.get('plan')

  const [imie, setImie] = useState('')
  const [nazwisko, setNazwisko] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const [nazwaFirmy, setNazwaFirmy] = useState('')
  const [nazwaDoFaktury, setNazwaDoFaktury] = useState('')
  const [nip, setNip] = useState('')
  const [ulica, setUlica] = useState('')
  const [kodPocztowy, setKodPocztowy] = useState('')
  const [miasto, setMiasto] = useState('')

  const [wysylanie, setWysylanie] = useState(false)
  const [bledy, setBledy] = useState<BledyPol>({})
  const [blad, setBlad] = useState('')

  async function zaloz(e: FormEvent) {
    e.preventDefault()
    setWysylanie(true)
    setBlad('')
    setBledy({})

    try {
      const rejestracja = await fetch(`${API_URL}/accounts/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imie,
          nazwisko,
          company_name: nazwaFirmy,
          email,
          nazwa_do_faktury: nazwaDoFaktury,
          nip,
          ulica,
          kod_pocztowy: kodPocztowy,
          miasto,
          use_trial: true,
        }),
      })

      if (!rejestracja.ok) {
        const dane = await rejestracja.json().catch(() => null)

        if (dane && typeof dane === 'object') {
          // Backend zwraca słownik pole → lista komunikatów. Rozkładamy go
          // z powrotem na pola, zamiast pokazywać pierwszy z brzegu.
          const rozlozone: BledyPol = {}
          for (const [pole, komunikaty] of Object.entries(dane)) {
            const pierwszy = Array.isArray(komunikaty) ? komunikaty[0] : komunikaty
            if (typeof pierwszy === 'string') rozlozone[pole] = pierwszy
          }
          setBledy(rozlozone)

          if (Object.keys(rozlozone).length > 0) {
            // Pierwsze pole z błędem dostaje ognisko. Bez tego użytkownik
            // stoi na dole formularza i nie wie, że problem jest osiem pól
            // wyżej, poza widokiem.
            const pierwszePole = Object.keys(rozlozone)[0]
            const mapa: Record<string, string> = {
              company_name: 'firma',
              kod_pocztowy: 'kod-pocztowy',
              nazwa_do_faktury: 'nazwa-do-faktury',
            }
            const field = document.getElementById(mapa[pierwszePole] ?? pierwszePole)
            if (field) field.focus()
            else setBlad(rozlozone[pierwszePole])
            setWysylanie(false)
            return
          }
        }

        throw new Error('Nie udało się założyć konta.')
      }

      setSent(true)
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się założyć konta.')
      setWysylanie(false)
    }
  }

  if (sent) return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl mb-4" tabIndex={-1} ref={element => element?.focus()}>Sprawdź skrzynkę e-mail</h1>
      <p role="status" className="text-sand-300 break-words">
        Otwórz link wysłany na {email} i ustaw hasło. Konto oraz 14-dniowy trial powstaną
        po potwierdzeniu. Link jest ważny 24 godziny; sprawdź także spam.
      </p>
      <ResendConfirmation initialEmail={email} />
      <button className="mt-5 text-sm underline" onClick={() => { setSent(false); setWysylanie(false) }}>
        Popraw adres e-mail
      </button>
      <p className="mt-4 text-sm"><Link className="underline" href="/login">Przejdź do logowania</Link></p>
    </div>
  )

  return (
    <div className="w-full max-w-md">
      <div className="mb-7">
        <Logo wysokosc={30} jakoLink />
      </div>

      <h1 className="text-3xl mb-2">Załóż konto</h1>
      <p className="text-sand-300 text-sm mb-7">
        14 dni bez opłat i bez karty. Dane firmy zbieramy od razu, żeby faktura i umowa
        były gotowe, zanim będą potrzebne — nie prosimy o nie drugi raz przy płatności.
        Hasło ustawisz po potwierdzeniu adresu e-mail.
      </p>

      {wybranyPlan && <p className="pill mb-5">Wybrany plan: {wybranyPlan}</p>}

      <form onSubmit={zaloz} className="flex flex-col gap-7">
        {/* Trzy grupy zamiast jednej listy dziesięciu pól. Bez podziału
            formularz czyta się jak ankieta i porzuca w połowie. */}
        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="label mb-2 p-0">Osoba zakładająca konto</legend>

          <div className="grid grid-cols-2 gap-3">
            <Pole id="imie" etykieta="Imię" blad={bledy.imie}>
              <input
                id="imie"
                className="input"
                value={imie}
                onChange={(e) => setImie(e.target.value)}
                required
                autoComplete="given-name"
              />
            </Pole>

            <Pole id="nazwisko" etykieta="Nazwisko" blad={bledy.nazwisko}>
              <input
                id="nazwisko"
                className="input"
                value={nazwisko}
                onChange={(e) => setNazwisko(e.target.value)}
                required
                autoComplete="family-name"
              />
            </Pole>
          </div>

          <Pole id="email" etykieta="Adres e-mail" blad={bledy.email}>
            <input
              id="email"
              type="email"
              maxLength={150}
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Pole>

        </fieldset>

        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="label mb-2 p-0">Firma</legend>

          <Pole
            id="firma"
            etykieta="Nazwa firmy"
            podpowiedz="Tak bot przedstawi się odwiedzającym."
            blad={bledy.company_name}
          >
            <input
              id="firma"
              className="input"
              value={nazwaFirmy}
              onChange={(e) => setNazwaFirmy(e.target.value)}
              placeholder="np. Serwis Rowerowy Kowalski"
              required
              autoComplete="organization"
              aria-describedby="firma-opis"
            />
          </Pole>

          <Pole
            id="nazwa-do-faktury"
            etykieta="Nazwa na fakturze"
            podpowiedz="Zostaw puste, jeśli taka sama jak wyżej. Na fakturze musi brzmieć tak jak w rejestrze."
            blad={bledy.nazwa_do_faktury}
          >
            <input
              id="nazwa-do-faktury"
              className="input"
              value={nazwaDoFaktury}
              onChange={(e) => setNazwaDoFaktury(e.target.value)}
              placeholder="np. Serwis Rowerowy Jan Kowalski"
              aria-describedby="nazwa-do-faktury-opis"
            />
          </Pole>

          <Pole
            id="nip"
            etykieta="NIP"
            podpowiedz="Opcjonalny. Zostaw puste, jeśli kupujesz jako osoba prywatna."
            blad={bledy.nip}
          >
            <input
              id="nip"
              className="input"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="123-456-32-18"
              inputMode="numeric"
              aria-describedby="nip-opis"
            />
          </Pole>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="label mb-2 p-0">Adres do faktury</legend>

          <Pole id="ulica" etykieta="Ulica i numer" blad={bledy.ulica}>
            <input
              id="ulica"
              className="input"
              value={ulica}
              onChange={(e) => setUlica(e.target.value)}
              required
              autoComplete="street-address"
            />
          </Pole>

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <Pole id="kod-pocztowy" etykieta="Kod pocztowy" blad={bledy.kod_pocztowy}>
              <input
                id="kod-pocztowy"
                className="input"
                value={kodPocztowy}
                onChange={(e) => setKodPocztowy(e.target.value)}
                placeholder="31-000"
                required
                autoComplete="postal-code"
              />
            </Pole>

            <Pole id="miasto" etykieta="Miejscowość" blad={bledy.miasto}>
              <input
                id="miasto"
                className="input"
                value={miasto}
                onChange={(e) => setMiasto(e.target.value)}
                required
                autoComplete="address-level2"
              />
            </Pole>
          </div>
        </fieldset>

        {blad && (
          <p role="alert" className="text-sm text-rose-400">
            {blad}
          </p>
        )}

        <button type="submit" disabled={wysylanie} className="btn-primary w-full">
          {wysylanie ? 'Wysyłam link…' : 'Załóż konto — wyślij link'}
        </button>
      </form>

      <p className="text-sm text-sand-400 mt-6">
        Masz już konto?{' '}
        <Link href="/login" className="text-ember-500 hover:text-ember-400 transition-colors">
          Zaloguj się
        </Link>
      </p>
    </div>
  )
}

/**
 * useSearchParams wymaga granicy Suspense — bez niej Next nie potrafi
 * wygenerować tej strony statycznie i build się zatrzymuje.
 */
export default function RejestracjaPage() {
  return (
    <Suspense fallback={<p className="text-sand-400">Wczytywanie...</p>}>
      <FormularzRejestracji />
    </Suspense>
  )
}
