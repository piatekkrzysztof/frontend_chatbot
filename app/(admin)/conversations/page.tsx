'use client'

import { useEffect, useState } from 'react'
import { apiFetch, BladApi, pobierzPlik } from '@/lib/api'
import Stronicowanie, { naStrone, type StronaListy } from '@/components/Stronicowanie'
import UploadField from '@/components/UploadField'
import { uploadError } from '@/lib/uploads'

interface PromptLogItem {
  id: number
  conversation_session_id: string | null
  prompt: string
  response: string | null
  source: string
  tokens: number
  created_at: string
  is_helpful: boolean | null
}

export default function ConversationsPage() {
  const [strona, setStrona] = useState<StronaListy<PromptLogItem> | null>(null)
  const [numer, setNumer] = useState(1)
  const [wczytanyNumer, setWczytanyNumer] = useState(0)
  // Zwiększana po imporcie, żeby wczytać tę samą stronę od nowa.
  const [wersja, setWersja] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [eksportuje, setEksportuje] = useState(false)
  // Import tworzy dane i nie ma ochrony przed powtórką: ten sam plik wgrany
  // dwa razy dopisze historię dwa razy. Stąd potwierdzenie przed wysłaniem
  // i sekcja widoczna tylko dla ról, które backend przepuści.
  const [mojaRola, setMojaRola] = useState('')
  const [plikCsv, setPlikCsv] = useState<File | null>(null)
  const [wgrywa, setWgrywa] = useState(false)
  const [potwierdzaImport, setPotwierdzaImport] = useState(false)
  const [wynikImportu, setWynikImportu] = useState('')

  // Wyliczone, nie trzymane osobno - jak w Dzienniku: zapomniana gałąź
  // zostawiłaby "wczytuję" na ekranie bez końca.
  const wczytuje = wczytanyNumer !== numer && !error

  useEffect(() => {
    let active = true

    // Historia rośnie z każdą rozmową. Wcześniej ekran wczytywał ją całą przy
    // każdym wejściu - teraz stronami, od najnowszych.
    apiFetch(`/chat/logs/?page=${numer}`)
      .then((data) => {
        if (!active) return
        setStrona(naStrone<PromptLogItem>(data))
        setWczytanyNumer(numer)
        setError('')
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać konwersacji.')
      })

    // Odpowiedź na porzuconą stronę nie może nadpisać tej, którą już widać
    return () => {
      active = false
    }
  }, [numer, wersja])

  useEffect(() => {
    let active = true

    // Rola decyduje tylko o tym, czy pokazać sekcję importu. Zapisu i tak
    // pilnuje backend: rola podglądu dostaje 403.
    apiFetch('/accounts/me/')
      .then((dane) => {
        if (active) setMojaRola((dane as { role?: string }).role || '')
      })
      .catch(() => {
        // Bez odpowiedzi zostaje sam odczyt historii - nic mylącego.
      })

    return () => {
      active = false
    }
  }, [])

  async function eksportuj() {
    setEksportuje(true)
    setError('')
    try {
      await pobierzPlik('/chat/export/', 'rozmowy.csv')
    } catch (err) {
      // 403 to granica roli, nie awaria. Angielskie zdanie z DRF kazałoby
      // szukać usterki, której nie ma.
      setError(
        err instanceof BladApi && err.status === 403
          ? 'Eksport rozmów jest dostępny dla właściciela i pracownika.'
          : err instanceof Error
            ? err.message
            : 'Nie udało się pobrać pliku.',
      )
    } finally {
      setEksportuje(false)
    }
  }

  async function copySessionId(sessionId: string) {
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(sessionId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // schowek bywa zablokowany — identyfikator i tak jest widoczny do zaznaczenia
    }
  }

  async function wgrajCsv() {
    // Format i rozmiar pilnuje przycisk (disabled) razem z UploadField;
    // tutaj wystarczy brak pliku.
    if (!plikCsv) return
    if (!potwierdzaImport) {
      setPotwierdzaImport(true)
      return
    }

    setWgrywa(true)
    setError('')
    setWynikImportu('')
    try {
      const dane = new FormData()
      dane.append('file', plikCsv)
      const odpowiedz = await apiFetch('/chat/import/', { method: 'POST', body: dane })
      const ile = (odpowiedz as { imported?: number }).imported ?? 0
      setWynikImportu(`Zaimportowano wpisów: ${ile}.`)
      setPlikCsv(null)
      setPotwierdzaImport(false)
      // Historia od nowa, żeby wgrane wpisy były widoczne bez odświeżania.
      setNumer(1)
      setWersja((poprzednia) => poprzednia + 1)
    } catch (err) {
      // Backend odmawia po polsku przy złym kodowaniu, brakujących kolumnach
      // i błędnym wierszu - jego zdanie mówi, co poprawić w pliku.
      setError(
        err instanceof BladApi && err.status === 403
          ? 'Import historii jest dostępny dla właściciela i pracownika.'
          : err instanceof Error
            ? err.message
            : 'Nie udało się wgrać pliku.',
      )
    } finally {
      setWgrywa(false)
    }
  }

  const logs = strona?.results ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Konwersacje</h1>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <p className="tekst-drugi max-w-2xl">
          Identyfikator rozmowy przydaje się, gdy ktoś poprosi o usunięcie swoich danych —
          wklej go w zakładce Prywatność.
        </p>
        {/* Backend potrafił to od dawna i zapisuje eksport w dzienniku, ale
            panel nie miał czym tego wywołać. */}
        <button
          type="button"
          onClick={eksportuj}
          disabled={eksportuje}
          className="btn-ghost shrink-0 disabled:opacity-50"
        >
          {eksportuje ? 'Przygotowuję plik...' : 'Pobierz CSV'}
        </button>
      </div>

      {mojaRola === 'owner' || mojaRola === 'employee' ? (
        <section className="rounded border obramowanie p-4 mb-6 max-w-2xl">
          <h2 className="font-medium mb-2">Wgraj historię z pliku CSV</h2>
          <UploadField
            id="import-rozmow"
            label="Plik CSV"
            kind="csv"
            file={plikCsv}
            onChange={(plik) => {
              setPlikCsv(plik)
              setPotwierdzaImport(false)
              setWynikImportu('')
            }}
            disabled={wgrywa}
          />
          <button
            type="button"
            onClick={wgrajCsv}
            disabled={!plikCsv || wgrywa || Boolean(uploadError(plikCsv, 'csv'))}
            className="btn-primary !py-2 !px-4 !text-sm mt-3 disabled:opacity-50"
          >
            {wgrywa ? 'Wgrywam...' : potwierdzaImport ? 'Na pewno wgrać?' : 'Wgraj historię'}
          </button>
          {potwierdzaImport && !wgrywa && (
            <p className="text-sm tekst-drugi mt-2">
              Wpisy z pliku dopiszą się do historii. Tego nie da się cofnąć jednym kliknięciem -
              ponowne wgranie tego samego pliku zdubluje rozmowy.
            </p>
          )}
          {wynikImportu && (
            <p role="status" className="text-sm text-[#1f7a4d] mt-2">
              {wynikImportu}
            </p>
          )}
        </section>
      ) : null}

      {error && <p role="alert" className="text-sm text-[#c0392b] mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded border obramowanie p-4">
            <div className="flex items-center justify-between text-xs tekst-slaby mb-2">
              <span>{new Date(log.created_at).toLocaleString('pl-PL')}</span>
              <span className="uppercase">{log.source}</span>
            </div>
            <p className="text-sm mb-1">
              <span className="font-medium">Pytanie: </span>
              {log.prompt}
            </p>
            <p className="text-sm text-[color:var(--tekst)]">
              <span className="font-medium">Odpowiedź: </span>
              {log.response || '–'}
            </p>
            {log.conversation_session_id && (
              <button
                onClick={() => copySessionId(log.conversation_session_id!)}
                title="Kopiuj identyfikator rozmowy"
                className="mt-3 text-xs font-mono tekst-slaby hover:text-[color:var(--tekst)]"
              >
                {copied === log.conversation_session_id
                  ? 'Skopiowano'
                  : log.conversation_session_id}
              </button>
            )}
          </div>
        ))}
        {strona && logs.length === 0 && !error && (
          <p className="tekst-slaby">Brak zarejestrowanych konwersacji.</p>
        )}
      </div>

      {strona && (
        <Stronicowanie
          numer={numer}
          poprzednia={!!strona.previous}
          nastepna={!!strona.next}
          lacznie={strona.count}
          wczytuje={wczytuje}
          opisLacznie="wpisów łącznie"
          onZmien={setNumer}
        />
      )}
    </div>
  )
}
