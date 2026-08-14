'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

/**
 * Stan zaplecza w panelu.
 *
 * Powstało z konkretnej porażki: sprawdziany istniały jako endpointy API,
 * więc jedynym sposobem odczytu było wklejanie fetch() do konsoli
 * przeglądarki. Diagnostyka, której nie da się odczytać bez narzędzi
 * deweloperskich, nie jest diagnostyką — jest notatką dla programisty.
 *
 * Powaga stanu przychodzi z serwera jako pole `poziom`. Panel jej nie
 * wylicza, bo dwie definicje tego, co znaczy „awaria", prędzej czy później
 * przestałyby się zgadzać.
 */

type Poziom = 'ok' | 'uwaga' | 'awaria'

interface Sygnal {
  wniosek: string
  opis: string
  aktywnych_zrodel?: number
  ostatnie_pobranie?: string | null
  godzin_temu?: number
  zaleglych_rozmow?: number
  przyklad_bledu?: string
}

interface StanZadan {
  sprawdzono: string
  poziom: Poziom
  werdykt: string
  broker_i_workery: {
    broker_osiagalny: boolean
    odpowiedzialo_workerow: number
    nazwy: string[]
    blad?: string
  }
  zadeklarowany_harmonogram: string[]
  slady_w_danych: {
    pobieranie_stron: Sygnal
    czyszczenie_rodo: Sygnal
  }
}

interface StanAdresu {
  trusted_proxy_depth: number
  rozpoznany_adres: string
  zapisywany_identyfikator: string
  podpowiedz: string
}

/** Wniosek pojedynczego sygnału → kolor kropki. */
const KOLOR_WNIOSKU: Record<string, Poziom> = {
  dziala: 'ok',
  'brak-danych': 'uwaga',
  'nie-probowano': 'uwaga',
  'nie-dziala': 'awaria',
}

const OPIS_WNIOSKU: Record<string, string> = {
  dziala: 'Działa',
  'brak-danych': 'Brak danych',
  'nie-probowano': 'Nie próbowano',
  'nie-dziala': 'Nie działa',
}

function Kropka({ poziom }: { poziom: Poziom }) {
  return <span className={`stan-kropka stan-${poziom}`} aria-hidden="true" />
}

function Sygnal({
  nazwa,
  indeks,
  sygnal,
  szczegoly,
}: {
  nazwa: string
  indeks: string
  sygnal: Sygnal
  szczegoly?: string[]
}) {
  const poziom = KOLOR_WNIOSKU[sygnal.wniosek] ?? 'uwaga'

  return (
    <article className="stan-karta">
      <div className="stan-karta-gora">
        <span className="panel-index">{indeks}</span>
        <span className={`stan-etykieta stan-${poziom}`}>
          <Kropka poziom={poziom} />
          {OPIS_WNIOSKU[sygnal.wniosek] ?? sygnal.wniosek}
        </span>
      </div>
      <h3>{nazwa}</h3>
      <p className="tekst-drugi">{sygnal.opis}</p>
      {szczegoly && szczegoly.length > 0 && (
        <dl className="stan-szczegoly">
          {szczegoly.map((wiersz) => (
            <div key={wiersz}>{wiersz}</div>
          ))}
        </dl>
      )}
      {sygnal.przyklad_bledu && (
        <p className="stan-blad">{sygnal.przyklad_bledu}</p>
      )}
    </article>
  )
}

export default function StanPage() {
  const [zadania, setZadania] = useState<StanZadan | null>(null)
  const [adres, setAdres] = useState<StanAdresu | null>(null)
  const [blad, setBlad] = useState('')
  const [wczytywanie, setWczytywanie] = useState(true)

  const sprawdz = useCallback(async () => {
    setWczytywanie(true)
    setBlad('')
    try {
      // Adres nie jest krytyczny — gdy nie wyjdzie, reszta ma się pokazać.
      const [z, a] = await Promise.all([
        apiFetch('/diagnostyka/zadania/'),
        apiFetch('/diagnostyka/adres/').catch(() => null),
      ])
      setZadania(z)
      setAdres(a)
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się sprawdzić stanu.')
    } finally {
      setWczytywanie(false)
    }
  }, [])

  useEffect(() => {
    sprawdz()
  }, [sprawdz])

  const broker = zadania?.broker_i_workery
  const pobieranie = zadania?.slady_w_danych.pobieranie_stron
  const rodo = zadania?.slady_w_danych.czyszczenie_rodo

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Stan systemu</span>
          <h1>Czy zaplecze robi swoje.</h1>
          <p className="tekst-drugi">
            Część pracy dzieje się poza Twoim widokiem: pobieranie treści z Twojej strony
            i usuwanie starych rozmów. Gdy to przestanie działać, nic się nie wywali —
            po prostu przestanie się dziać. Tutaj to widać.
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <button onClick={sprawdz} disabled={wczytywanie} className="btn-secondary">
            {wczytywanie ? 'Sprawdzam...' : 'Sprawdź ponownie'}
          </button>
        </div>
      </div>

      {blad && <p className="admin-error">{blad}</p>}

      {zadania && (
        <>
          <section className={`stan-werdykt stan-${zadania.poziom}`}>
            <Kropka poziom={zadania.poziom} />
            <p>{zadania.werdykt}</p>
          </section>

          <div className="stan-siatka">
            <article className="stan-karta">
              <div className="stan-karta-gora">
                <span className="panel-index">01</span>
                <span
                  className={`stan-etykieta stan-${
                    broker?.broker_osiagalny && broker.odpowiedzialo_workerow > 0 ? 'ok' : 'awaria'
                  }`}
                >
                  <Kropka
                    poziom={
                      broker?.broker_osiagalny && broker.odpowiedzialo_workerow > 0
                        ? 'ok'
                        : 'awaria'
                    }
                  />
                  {broker?.odpowiedzialo_workerow
                    ? `${broker.odpowiedzialo_workerow} w gotowości`
                    : 'Brak'}
                </span>
              </div>
              <h3>Procesy w tle</h3>
              <p className="tekst-drugi">
                {broker?.broker_osiagalny
                  ? broker.odpowiedzialo_workerow > 0
                    ? 'Kolejka działa i ktoś z niej odbiera zadania.'
                    : 'Kolejka przyjmuje zadania, ale nikt ich nie odbiera.'
                  : 'Nie ma połączenia z kolejką zadań.'}
              </p>
              {broker?.blad && <p className="stan-blad">{broker.blad}</p>}
            </article>

            {pobieranie && (
              <Sygnal
                nazwa="Pobieranie treści ze stron"
                indeks="02"
                sygnal={pobieranie}
                szczegoly={[
                  `Aktywnych źródeł: ${pobieranie.aktywnych_zrodel ?? 0}`,
                  pobieranie.ostatnie_pobranie
                    ? `Ostatnio: ${new Date(pobieranie.ostatnie_pobranie).toLocaleString('pl-PL')}`
                    : 'Ostatnio: nigdy',
                ]}
              />
            )}

            {rodo && (
              <Sygnal
                nazwa="Usuwanie starych rozmów"
                indeks="03"
                sygnal={rodo}
                szczegoly={[`Rozmów po terminie: ${rodo.zaleglych_rozmow ?? 0}`]}
              />
            )}
          </div>

          {adres && (
            <section className="operations-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-index">04</span>
                  <h2>Rozpoznawanie odwiedzających</h2>
                </div>
              </div>
              <p className="tekst-drugi">
                Limity chronią Cię przed pojedynczym natrętnym rozmówcą. Żeby działały,
                serwer musi odróżniać odwiedzających od siebie.
              </p>
              <dl className="stan-szczegoly">
                <div>Twój adres widziany przez serwer: {adres.rozpoznany_adres}</div>
                <div>Zapisywany identyfikator: {adres.zapisywany_identyfikator}</div>
              </dl>
              <p className="tekst-slaby stan-podpowiedz">{adres.podpowiedz}</p>
            </section>
          )}

          <p className="tekst-slaby stan-stopka">
            Sprawdzono {new Date(zadania.sprawdzono).toLocaleString('pl-PL')}. Zaplanowane
            zadania: {zadania.zadeklarowany_harmonogram.length}.
          </p>
        </>
      )}

      {!zadania && wczytywanie && <p className="tekst-slaby">Sprawdzam stan zaplecza...</p>}
    </div>
  )
}
