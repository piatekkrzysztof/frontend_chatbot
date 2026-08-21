'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, API_URL, authHeaders } from '@/lib/api'

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

  useEffect(() => {
    apiFetch('/chat/test/')
      .then((d) => setWiadomosci((d as { messages: Wiadomosc[] }).messages || []))
      .catch(() => {
        // Brak historii nie jest błędem — po prostu zaczynamy od pustej rozmowy
      })
  }, [])

  useEffect(() => {
    dol.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wiadomosci])

  async function wyslij() {
    const pytanie = tekst.trim()
    if (!pytanie || wysyla) return

    setTekst('')
    setBlad('')
    setWysyla(true)
    setWiadomosci((p) => [...p, { sender: 'user', text: pytanie }])

    try {
      const res = await fetch(`${API_URL}/chat/test/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: pytanie }),
      })
      if (!res.ok || !res.body) throw new Error('Bot nie odpowiedział. Spróbuj ponownie.')

      setWiadomosci((p) => [...p, { sender: 'bot', text: '' }])

      const czytnik = res.body.getReader()
      const dekoder = new TextDecoder()
      let bufor = ''

      // Ten sam protokół SSE co w widgecie u klienta — celowo, żeby test
      // nie mógł się rozjechać z tym, co widzi odwiedzający.
      while (true) {
        const { done, value } = await czytnik.read()
        if (done) break

        bufor += dekoder.decode(value, { stream: true })
        const zdarzenia = bufor.split('\n\n')
        bufor = zdarzenia.pop() || ''

        for (const surowe of zdarzenia) {
          const linia = surowe.trim()
          if (!linia.startsWith('data: ')) continue
          const zdarzenie = JSON.parse(linia.slice(6))

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
                zrodla: zdarzenie.sources || [],
              }
              return n
            })
          }
        }
      }
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Coś poszło nie tak.')
      // Zdejmujemy pusty dymek, żeby nie został po nim ślad po nieudanej próbie
      setWiadomosci((p) => (p.length && p[p.length - 1].sender === 'bot' && !p[p.length - 1].text ? p.slice(0, -1) : p))
    } finally {
      setWysyla(false)
    }
  }

  async function wyczysc() {
    try {
      await apiFetch('/chat/test/', { method: 'DELETE' })
      setWiadomosci([])
    } catch (err) {
      setBlad(err instanceof Error ? err.message : 'Nie udało się wyczyścić rozmowy.')
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

      {blad && <p className="text-sm text-[#c0392b] mb-4">{blad}</p>}

      <div className="test-bota">
        <div className="test-bota-rozmowa">
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
            disabled={wysyla}
          />
          <button type="button" className="btn-primary" onClick={wyslij} disabled={wysyla || !tekst.trim()}>
            Wyślij
          </button>
        </div>
      </div>

      {wiadomosci.length > 0 && (
        <button type="button" onClick={wyczysc} className="test-bota-reset">
          Wyczyść rozmowę i zacznij od nowa
        </button>
      )}
    </div>
  )
}
