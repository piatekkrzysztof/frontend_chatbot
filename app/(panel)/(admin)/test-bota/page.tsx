'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, fetchZSesja } from '@/lib/api'
import { czytajZdarzenia } from '@/components/widget/sse'

interface Wiadomosc {
  sender: 'user' | 'bot'
  text: string
  /** 'document' | 'faq' | 'gpt' — skąd bot wziął odpowiedź */
  source?: string
  zrodla?: { name: string }[]
}

/** Etykieta pod odpowiedzią: to jest właściwy powód istnienia tej strony.
 *  Sama odpowiedź nie mówi, czy bot ją znalazł, czy wymyślił dookoła. */
const OPIS_ZRODLA: Record<string, { napis: string; klasa: string }> = {
  document: { napis: 'z Twoich dokumentów', klasa: 'zrodlo-ok' },
  faq: { napis: 'z FAQ', klasa: 'zrodlo-ok' },
  gpt: { napis: 'bot nie znalazł tego w Twojej wiedzy', klasa: 'zrodlo-luka' },
}

export default function TestBotaPage() {
  const [wiadomosci, setWiadomosci] = useState<Wiadomosc[]>([])
  const [tekst, setTekst] = useState('')
  const [wysyla, setWysyla] = useState(false)
  const [blad, setBlad] = useState('')
  const dol = useRef<HTMLDivElement>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const [czysci, setCzysci] = useState(false)
  const interactionStarted = useRef(false)

  useEffect(() => {
    let mounted = true
    apiFetch('/chat/test/')
      .then((d) => {
        if (mounted && !interactionStarted.current) {
          setWiadomosci((d as { messages: Wiadomosc[] }).messages || [])
        }
      })
      .catch(() => {
        // Brak historii nie jest błędem — po prostu zaczynamy od pustej rozmowy
      })
    return () => {
      mounted = false
      activeRequest.current?.abort()
    }
  }, [])

  useEffect(() => {
    dol.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wiadomosci])

  async function wyslij() {
    const pytanie = tekst.trim()
    if (!pytanie || wysyla || czysci) return
    interactionStarted.current = true

    setTekst('')
    setBlad('')
    setWysyla(true)
    setWiadomosci((p) => [...p, { sender: 'user', text: pytanie }])
    const controller = new AbortController()
    activeRequest.current = controller

    try {
      // fetchZSesja, nie surowy fetch: po kwadransie bez innych zapytań token
      // wygasa i bez odświeżenia każde pytanie kończyło się błędem (A-03).
      const res = await fetchZSesja('/chat/test/', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ message: pytanie }),
      })
      if (controller.signal.aborted) return
      if (res.status === 410) {
        setWiadomosci([])
        setBlad('Rozmowa została usunięta. Możesz rozpocząć nową.')
        return
      }
      if (!res.ok || !res.body) throw new Error('Bot nie odpowiedział. Spróbuj ponownie.')

      setWiadomosci((p) => [...p, { sender: 'bot', text: '' }])

      const czytnik = res.body.getReader()
      const dekoder = new TextDecoder()
      let bufor = ''

      // Ten sam parser SSE co w widgecie u klienta (components/widget/sse.ts),
      // żeby test nie mógł się rozjechać z tym, co widzi odwiedzający. Do
      // audytu 2026-10 (A-13) był tu własny, starszy: wymagał spacji po
      // „data:” i jedno zepsute zdarzenie przerywało całą odpowiedź.
      while (true) {
        const { done, value } = await czytnik.read()
        if (controller.signal.aborted) {
          await czytnik.cancel()
          return
        }
        if (done) break

        bufor += dekoder.decode(value, { stream: true })
        const { zdarzenia, reszta } = czytajZdarzenia(bufor)
        bufor = reszta

        for (const zdarzenie of zdarzenia) {
          if (zdarzenie.type === 'error') {
            await czytnik.cancel()
            if (zdarzenie.code === 'conversation_deleted') {
              setWiadomosci([])
              setBlad('Rozmowa została usunięta. Możesz rozpocząć nową.')
              return
            }
            throw new Error(zdarzenie.message || 'Bot nie odpowiedział. Spróbuj ponownie.')
          }

          if (zdarzenie.type === 'delta') {
            setWiadomosci((p) => {
              const n = [...p]
              n[n.length - 1] = { ...n[n.length - 1], text: n[n.length - 1].text + zdarzenie.content }
              return n
            })
          } else if (zdarzenie.type === 'done') {
            setWiadomosci((p) => {
              const n = [...p]
              n[n.length - 1] = {
                ...n[n.length - 1],
                source: zdarzenie.source,
                // Kształtu źródeł parser nie gwarantuje - bierzemy te z nazwą
                zrodla: (zdarzenie.sources ?? []).filter(
                  (z): z is { name: string } => typeof (z as { name?: unknown })?.name === 'string',
                ),
              }
              return n
            })
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setBlad(err instanceof Error ? err.message : 'Coś poszło nie tak.')
      // Zdejmujemy pusty dymek, żeby nie został po nim ślad po nieudanej próbie
      setWiadomosci((p) => (p.length && p[p.length - 1].sender === 'bot' && !p[p.length - 1].text ? p.slice(0, -1) : p))
    } finally {
      activeRequest.current = null
      setWysyla(false)
    }
  }

  async function wyczysc() {
    if (czysci) return
    setCzysci(true)
    interactionStarted.current = true
    activeRequest.current?.abort()
    try {
      await apiFetch('/chat/test/', { method: 'DELETE' })
      setWiadomosci([])
      setBlad('')
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się wyczyścić rozmowy.')
    } finally {
      setCzysci(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Test bota</h1>
      <p className="tekst-drugi mb-6 max-w-2xl">
        Rozmawiasz ze swoim botem dokładnie tak, jak zrobi to odwiedzający Twoją
        stronę — ta sama wiedza, ten sam sposób odpowiadania.{' '}
        <strong>Ta rozmowa nie zużywa limitu wiadomości</strong> i nie wchodzi do
        statystyk ani do raportu pytań bez pokrycia.
      </p>

      {blad && <p role="alert" className="text-sm text-[var(--blad)] mb-4">{blad}</p>}

      <div className="test-bota">
        {/* Jak w widgecie: bez aria-live czytnik ekranu nie ogłaszał odpowiedzi
            bota, więc niewidomy właściciel nie wiedział, że przyszła (A-21). */}
        <div
          className="test-bota-rozmowa"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Rozmowa testowa"
        >
          {wiadomosci.length === 0 ? (
            <div className="test-bota-pusto">
              <p>Zadaj pytanie, które zadałby Twój klient.</p>
              <small>
                Najwięcej dowiesz się z pytań trudnych — o ceny, terminy, wyjątki.
                Jeśli bot ich nie zna, uzupełnisz{' '}
                <Link href="/documents">bazę wiedzy</Link> albo{' '}
                <Link href="/faq">FAQ</Link> i sprawdzisz od razu.
              </small>
            </div>
          ) : (
            wiadomosci.map((w, i) => (
              <div key={i} className={`test-bota-babel ${w.sender === 'user' ? 'jest-moja' : 'jest-bota'}`}>
                <p>{w.text}</p>
                {w.sender === 'bot' && w.source && OPIS_ZRODLA[w.source] && (
                  <span className={`test-bota-zrodlo ${OPIS_ZRODLA[w.source].klasa}`}>
                    {OPIS_ZRODLA[w.source].napis}
                    {w.zrodla && w.zrodla.length > 0 && `: ${w.zrodla.map((z) => z.name).join(', ')}`}
                  </span>
                )}
              </div>
            ))
          )}
          {wysyla && wiadomosci[wiadomosci.length - 1]?.sender === 'user' && (
            <div className="test-bota-babel jest-bota"><p className="tekst-slaby">Piszę…</p></div>
          )}
          <div ref={dol} />
        </div>

        <div className="test-bota-pole">
          <input
            type="text"
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && wyslij()}
            placeholder="Np. Ile kosztuje wynajem sali w sobotę?"
            aria-label="Pytanie do bota"
            disabled={wysyla || czysci}
          />
          <button type="button" className="btn-primary" onClick={wyslij} disabled={wysyla || czysci || !tekst.trim()}>
            Wyślij
          </button>
        </div>
      </div>

      {wiadomosci.length > 0 && (
        <button type="button" onClick={wyczysc} disabled={czysci} className="test-bota-reset">
          Wyczyść rozmowę i zacznij od nowa
        </button>
      )}
    </div>
  )
}
