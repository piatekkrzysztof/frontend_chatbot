'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/api'

type Dane = {
  nazwa: string
  nip: string
  ulica: string
  kod_pocztowy: string
  miasto: string
  kraj: string
}

const PUSTE: Dane = { nazwa: '', nip: '', ulica: '', kod_pocztowy: '', miasto: '', kraj: 'PL' }

/**
 * Dane, na które wystawiamy faktury.
 *
 * Osobna sekcja od nazwy firmy widocznej w widgecie, bo to dwie różne rzeczy:
 * w panelu ma stać "Rowerownia", a na fakturze pełna nazwa z rejestru. Ich
 * sklejenie zmuszałoby klienta do wyboru między czytelnym czatem a poprawnym
 * dokumentem.
 */
export default function DaneRozliczeniowe() {
  const [dane, setDane] = useState<Dane>(PUSTE)
  const [wczytane, setWczytane] = useState(false)
  const [zapisuje, setZapisuje] = useState(false)
  const [zapisano, setZapisano] = useState(false)
  const [bledy, setBledy] = useState<Record<string, string>>({})
  const [blad, setBlad] = useState('')

  useEffect(() => {
    apiFetch('/accounts/dane-rozliczeniowe/')
      .then((odpowiedz) => {
        setDane({ ...PUSTE, ...(odpowiedz as Dane) })
        setWczytane(true)
      })
      .catch((err) =>
        setBlad(err instanceof Error ? err.message : 'Nie udało się wczytać danych.'),
      )
  }, [])

  function ustaw(pole: keyof Dane, wartosc: string) {
    setDane((poprzednie) => ({ ...poprzednie, [pole]: wartosc }))
    setZapisano(false)
  }

  async function zapisz(e: FormEvent) {
    e.preventDefault()
    setZapisuje(true)
    setBlad('')
    setBledy({})
    setZapisano(false)

    try {
      await apiFetch('/accounts/dane-rozliczeniowe/', {
        method: 'PATCH',
        body: JSON.stringify(dane),
      })
      setZapisano(true)
    } catch (err) {
      // Backend zwraca błąd per pole, ale apiFetch spłaszcza go do wyjątku.
      // NIP jest jedynym polem z regułą, którą da się złamać treścią, więc
      // przypinamy komunikat do niego zamiast wieszać nad przyciskiem.
      const tresc = err instanceof Error ? err.message : 'Nie udało się zapisać.'
      if (tresc.toLowerCase().includes('nip') || tresc.toLowerCase().includes('kontroln')) {
        setBledy({ nip: tresc })
      } else {
        setBlad(tresc)
      }
    } finally {
      setZapisuje(false)
    }
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-bold mb-1">Dane do faktury</h2>
      <p className="tekst-drugi mb-4">
        Na te dane wystawiamy faktury i na nie zawarta jest umowa. Zmiana obowiązuje od
        następnego dokumentu — wystawionych wcześniej nie zmienia.
      </p>

      <form onSubmit={zapisz} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="faktura-nazwa">
            Nazwa
          </label>
          <input
            id="faktura-nazwa"
            className="input"
            value={dane.nazwa}
            onChange={(e) => ustaw('nazwa', e.target.value)}
            disabled={!wczytane}
            aria-describedby="faktura-nazwa-opis"
          />
          <p id="faktura-nazwa-opis" className="hint mt-1.5">
            Pełna nazwa z rejestru. Może różnić się od nazwy, którą bot podaje odwiedzającym.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="faktura-nip">
            NIP
          </label>
          <input
            id="faktura-nip"
            className="input"
            inputMode="numeric"
            placeholder="123-456-32-18"
            value={dane.nip}
            onChange={(e) => ustaw('nip', e.target.value)}
            disabled={!wczytane}
            aria-describedby="faktura-nip-opis"
          />
          <p id="faktura-nip-opis" className="hint mt-1.5">
            Zostaw puste, jeśli kupujesz jako osoba prywatna.
          </p>
          {bledy.nip && (
            <p role="alert" className="mt-1.5 text-sm text-[#c0392b]">
              {bledy.nip}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="faktura-ulica">
            Ulica i numer
          </label>
          <input
            id="faktura-ulica"
            className="input"
            autoComplete="street-address"
            value={dane.ulica}
            onChange={(e) => ustaw('ulica', e.target.value)}
            disabled={!wczytane}
          />
        </div>

        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div>
            <label className="label" htmlFor="faktura-kod">
              Kod pocztowy
            </label>
            <input
              id="faktura-kod"
              className="input"
              autoComplete="postal-code"
              placeholder="31-000"
              value={dane.kod_pocztowy}
              onChange={(e) => ustaw('kod_pocztowy', e.target.value)}
              disabled={!wczytane}
            />
          </div>
          <div>
            <label className="label" htmlFor="faktura-miasto">
              Miejscowość
            </label>
            <input
              id="faktura-miasto"
              className="input"
              autoComplete="address-level2"
              value={dane.miasto}
              onChange={(e) => ustaw('miasto', e.target.value)}
              disabled={!wczytane}
            />
          </div>
        </div>

        {blad && (
          <p role="alert" className="text-sm text-[#c0392b]">
            {blad}
          </p>
        )}
        {zapisano && <p className="text-sm text-[#1f7a4d]">Zapisano.</p>}

        <button type="submit" className="btn-primary w-fit" disabled={zapisuje || !wczytane}>
          {zapisuje ? 'Zapisywanie…' : 'Zapisz dane do faktury'}
        </button>
      </form>
    </section>
  )
}
