'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import DaneRozliczeniowe from '@/components/ustawienia/DaneRozliczeniowe'
import DrugiSkladnik from '@/components/ustawienia/DrugiSkladnik'

export default function UstawieniaPage() {
  const [nazwa, setNazwa] = useState('')
  const [adres, setAdres] = useState('')
  const [wczytane, setWczytane] = useState(false)
  const [zapisuje, setZapisuje] = useState(false)
  const [zapisano, setZapisano] = useState(false)
  const [blad, setBlad] = useState('')

  useEffect(() => {
    apiFetch('/accounts/firma/')
      .then((d) => {
        const dane = d as { name: string; owner_email: string }
        setNazwa(dane.name || '')
        setAdres(dane.owner_email || '')
        setWczytane(true)
      })
      .catch((err) => setBlad(err instanceof Error ? err.message : 'Nie udało się wczytać ustawień.'))
  }, [])

  async function zapisz(e: React.FormEvent) {
    e.preventDefault()
    setZapisuje(true)
    setBlad('')
    setZapisano(false)
    try {
      await apiFetch('/accounts/firma/', {
        method: 'PATCH',
        body: JSON.stringify({ name: nazwa, owner_email: adres }),
      })
      setZapisano(true)
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się zapisać.')
    } finally {
      setZapisuje(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Ustawienia konta</h1>
      <p className="tekst-drugi mb-6 max-w-2xl">
        Dane Twojej firmy. Zmiany działają od razu — nie trzeba nic wgrywać
        ponownie ani zmieniać kodu na stronie.
      </p>

      <form onSubmit={zapisz} className="flex flex-col gap-5 max-w-xl">
        <div>
          <label htmlFor="nazwa" className="block text-sm font-medium mb-1">
            Nazwa firmy
          </label>
          <input
            id="nazwa"
            type="text"
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            maxLength={100}
            required
            disabled={!wczytane}
            className="input"
          />
          <p className="hint">
            Pojawia się w temacie powiadomień, które do Ciebie wysyłamy.
          </p>
        </div>

        <div>
          <label htmlFor="adres" className="block text-sm font-medium mb-1">
            Adres e-mail do powiadomień
          </label>
          <input
            id="adres"
            type="email"
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            placeholder="biuro@twojafirma.pl"
            disabled={!wczytane}
            className="input"
          />
          <p className="hint">
            Tu trafiają zapytania zostawione w czacie i raport pytań bez pokrycia.
            {/* Dwa adresy łatwo pomylić, a pomyłka jest kosztowna: zmiana tego
                pola nie zmienia loginu, więc ktoś może myśleć, że stracił
                dostęp do konta. */}
            {' '}Możesz podać inny niż ten, którym się logujesz — zmiana tego pola
            nie wpływa na logowanie.
          </p>
          {wczytane && !adres && (
            <p className="text-sm text-[#b3261e] mt-1.5">
              Bez adresu nie wyślemy Ci powiadomienia o zapytaniu — zobaczysz je
              tylko po zalogowaniu do panelu.
            </p>
          )}
        </div>

        {blad && <p className="text-sm text-[#c0392b]">{blad}</p>}
        {zapisano && <p className="text-sm text-[#1f7a4d]">Zapisano.</p>}

        <button type="submit" className="btn-primary w-fit" disabled={zapisuje || !wczytane}>
          {zapisuje ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>

      {/* Osobna sekcja, a nie kolejne pole formularza wyżej: to nie jest
          ustawienie do zapisania razem z nazwą firmy, tylko wieloetapowa
          konfiguracja z własnym potwierdzeniem. */}
      <hr className="my-10 border-[color:var(--obramowanie-mocne)]" />

      <DaneRozliczeniowe />

      <hr className="my-10 border-[color:var(--obramowanie-mocne)]" />

      <DrugiSkladnik />
    </div>
  )
}
