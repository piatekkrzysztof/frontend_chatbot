'use client'

import { FormEvent, useEffect, useState } from 'react'
import QRCode from 'qrcode'

import { apiFetch } from '@/lib/api'

type Stan = {
  wlaczony: boolean
  w_trakcie_konfiguracji: boolean
  kodow_zapasowych: number
}

/**
 * Włączanie i wyłączanie drugiego składnika.
 *
 * Kod QR rysuje przeglądarka, a nie serwer. Obrazek generowany po stronie
 * serwera znaczyłby, że sekret przechodzi przez jeszcze jedno miejsce i może
 * wylądować w pamięci podręcznej pośredników albo w logu dostępu. Tutaj adres
 * `otpauth://` przychodzi raz, w odpowiedzi API, i nigdzie dalej nie idzie.
 */
export default function DrugiSkladnik() {
  const [stan, setStan] = useState<Stan | null>(null)
  const [blad, setBlad] = useState('')

  // Konfiguracja w toku
  const [sekret, setSekret] = useState('')
  const [obrazekQR, setObrazekQR] = useState('')
  const [kod, setKod] = useState('')

  // Kody zapasowe: pokazywane JEDEN raz, zaraz po włączeniu. W bazie są
  // wyłącznie skróty, więc nie da się ich odtworzyć później - i tak ma być.
  const [kodyZapasowe, setKodyZapasowe] = useState<string[]>([])

  // Wyłączanie
  const [wylaczanie, setWylaczanie] = useState(false)
  const [haslo, setHaslo] = useState('')
  const [pracuje, setPracuje] = useState(false)

  useEffect(() => {
    apiFetch('/accounts/2fa/')
      .then((dane) => setStan(dane as Stan))
      .catch(() => setStan({ wlaczony: false, w_trakcie_konfiguracji: false, kodow_zapasowych: 0 }))
  }, [])

  async function rozpocznij() {
    setPracuje(true)
    setBlad('')
    try {
      const dane = (await apiFetch('/accounts/2fa/rozpocznij/', { method: 'POST' })) as {
        sekret: string
        adres_otpauth: string
      }
      setSekret(dane.sekret)
      setObrazekQR(await QRCode.toDataURL(dane.adres_otpauth, { margin: 1, width: 220 }))
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się rozpocząć konfiguracji.')
    } finally {
      setPracuje(false)
    }
  }

  async function potwierdz(e: FormEvent) {
    e.preventDefault()
    setPracuje(true)
    setBlad('')
    try {
      const dane = (await apiFetch('/accounts/2fa/potwierdz/', {
        method: 'POST',
        body: JSON.stringify({ kod }),
      })) as { kody_zapasowe: string[] }

      setKodyZapasowe(dane.kody_zapasowe)
      setSekret('')
      setObrazekQR('')
      setKod('')
      setStan({ wlaczony: true, w_trakcie_konfiguracji: false, kodow_zapasowych: dane.kody_zapasowe.length })
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Kod nie pasuje.')
      setKod('')
    } finally {
      setPracuje(false)
    }
  }

  async function wylacz(e: FormEvent) {
    e.preventDefault()
    setPracuje(true)
    setBlad('')
    try {
      await apiFetch('/accounts/2fa/wylacz/', {
        method: 'POST',
        body: JSON.stringify({ haslo, kod }),
      })
      setStan({ wlaczony: false, w_trakcie_konfiguracji: false, kodow_zapasowych: 0 })
      setWylaczanie(false)
      setHaslo('')
      setKod('')
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się wyłączyć.')
    } finally {
      setPracuje(false)
    }
  }

  if (!stan) return <p className="tekst-drugi">Sprawdzam ustawienia logowania...</p>

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-bold mb-1">Logowanie dwuetapowe</h2>
      <p className="tekst-drugi mb-4">
        Dodatkowy kod z aplikacji na telefonie, poza hasłem. Chroni konto nawet wtedy, gdy
        hasło wycieknie z zupełnie innego serwisu — a tak wycieka najczęściej.
      </p>

      {blad && (
        <p role="alert" className="mb-4 text-sm text-[#c0392b]">
          {blad}
        </p>
      )}

      {/* Kody zapasowe pokazujemy raz. Ten blok stoi przed resztą celowo:
          to jedyny moment, w którym istnieją poza głową użytkownika. */}
      {kodyZapasowe.length > 0 && (
        <div className="mb-6 rounded border border-[color:var(--obramowanie-mocne)] p-4">
          <h3 className="font-bold mb-1">Zapisz kody zapasowe</h3>
          <p className="tekst-drugi text-sm mb-3">
            Każdy działa raz i zastępuje kod z aplikacji. Pokazujemy je wyłącznie teraz —
            przechowujemy tylko ich skróty, więc nie odtworzymy ich później nawet na Twoją
            prośbę. Wydrukuj albo zapisz w menedżerze haseł.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {kodyZapasowe.map((kodZapasowy) => (
              <li key={kodZapasowy}>{kodZapasowy}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setKodyZapasowe([])}
            className="btn-primary mt-4 !py-2 !px-4 !text-sm"
          >
            Zapisałem je
          </button>
        </div>
      )}

      {stan.wlaczony && kodyZapasowe.length === 0 && !wylaczanie && (
        <div className="flex items-center gap-4">
          <p className="text-sm">
            <strong>Włączone.</strong> Pozostało kodów zapasowych: {stan.kodow_zapasowych}.
          </p>
          <button
            type="button"
            onClick={() => setWylaczanie(true)}
            className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm font-medium"
          >
            Wyłącz
          </button>
        </div>
      )}

      {wylaczanie && (
        <form onSubmit={wylacz} className="flex flex-col gap-3 max-w-sm">
          <p className="text-sm tekst-drugi">
            Wyłączenie wymaga hasła i aktualnego kodu — samo zalogowanie nie wystarcza,
            żeby ktoś, kto przejmie otwartą kartę, nie zdjął ochrony jednym kliknięciem.
          </p>
          <div>
            <label className="label" htmlFor="wylacz-haslo">
              Hasło
            </label>
            <input
              id="wylacz-haslo"
              type="password"
              autoComplete="current-password"
              className="input"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="wylacz-kod">
              Kod z aplikacji albo zapasowy
            </label>
            <input
              id="wylacz-kod"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input"
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={pracuje} className="btn-primary !py-2 !px-4 !text-sm">
              {pracuje ? 'Wyłączam...' : 'Wyłącz ochronę'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWylaczanie(false)
                setHaslo('')
                setKod('')
                setBlad('')
              }}
              className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {!stan.wlaczony && !obrazekQR && kodyZapasowe.length === 0 && (
        <button
          type="button"
          onClick={rozpocznij}
          disabled={pracuje}
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          {pracuje ? 'Przygotowuję...' : 'Włącz logowanie dwuetapowe'}
        </button>
      )}

      {obrazekQR && (
        <form onSubmit={potwierdz} className="flex flex-col gap-4 max-w-sm">
          <ol className="tekst-drugi text-sm list-decimal pl-5 space-y-1">
            <li>Otwórz aplikację uwierzytelniającą na telefonie.</li>
            <li>Zeskanuj kod poniżej.</li>
            <li>Przepisz sześciocyfrowy kod, który się pojawi.</li>
          </ol>

          {/* eslint-disable-next-line @next/next/no-img-element -- obrazek
              powstaje w przegladarce jako data URI, wiec next/image nie ma
              czego optymalizowac ani skad pobrac */}
          <img src={obrazekQR} alt="Kod QR do aplikacji uwierzytelniającej" width={220} height={220} />

          <details>
            <summary className="text-sm cursor-pointer">Nie mogę zeskanować kodu</summary>
            <p className="tekst-drugi text-sm mt-2">
              Wpisz w aplikacji ten klucz ręcznie:
            </p>
            <code className="font-mono text-sm break-all">{sekret}</code>
          </details>

          <div>
            <label className="label" htmlFor="potwierdz-kod">
              Kod z aplikacji
            </label>
            <input
              id="potwierdz-kod"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input tracking-[0.3em]"
              placeholder="000000"
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={pracuje} className="btn-primary !py-2 !px-4 !text-sm">
            {pracuje ? 'Sprawdzam...' : 'Potwierdź i włącz'}
          </button>
        </form>
      )}
    </section>
  )
}
