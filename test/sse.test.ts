/**
 * Parser strumienia SSE.
 *
 * To jest rdzeń wartości produktu: jeśli parser się myli, odwiedzający nie
 * dostaje odpowiedzi albo dostaje ją poszarpaną, a klient płaci za tokeny,
 * których nikt nie zobaczył.
 *
 * Granice pakietów sieciowych nie mają nic wspólnego z granicami zdarzeń.
 * Większość testów tutaj to właśnie ten problem: to samo zdarzenie podane
 * w jednym kawałku, w dwóch i w dziesięciu musi dać ten sam wynik.
 */
import { describe, expect, it } from 'vitest'
import { czytajZdarzenia, type Zdarzenie } from '@/components/widget/sse'

/** Zdarzenie w formacie, jaki naprawdę wysyła backend (`_sse` w chat_engine). */
function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

/** Przepuszcza cały strumień przez parser, kawałek po kawałku. */
function przepusc(kawalki: string[]): Zdarzenie[] {
  let bufor = ''
  const wszystkie: Zdarzenie[] = []
  for (const kawalek of kawalki) {
    bufor += kawalek
    const { zdarzenia, reszta } = czytajZdarzenia(bufor)
    bufor = reszta
    wszystkie.push(...zdarzenia)
  }
  return wszystkie
}

describe('granice kawałków', () => {
  it('czyta zdarzenie podane w całości', () => {
    const { zdarzenia, reszta } = czytajZdarzenia(sse({ type: 'delta', content: 'Cześć' }))

    expect(zdarzenia).toEqual([{ type: 'delta', content: 'Cześć' }])
    expect(reszta).toBe('')
  })

  it('czyta kilka zdarzeń z jednego kawałka', () => {
    const strumien = sse({ type: 'delta', content: 'Po' }) + sse({ type: 'delta', content: 'moc' })

    const { zdarzenia } = czytajZdarzenia(strumien)

    expect(zdarzenia.map((z) => (z as { content: string }).content)).toEqual(['Po', 'moc'])
  })

  it('trzyma urwany ogon w buforze, zamiast go zgubić', () => {
    const pelne = sse({ type: 'delta', content: 'A' })
    const urwane = 'data: {"type":"delta","content":"B'

    const { zdarzenia, reszta } = czytajZdarzenia(pelne + urwane)

    expect(zdarzenia).toHaveLength(1)
    expect(reszta).toBe(urwane)
  })

  it('składa zdarzenie rozbite na dowolnie małe kawałki', () => {
    // Najgorszy przypadek: pakiety po jednym znaku. Jeśli parser to przechodzi,
    // przejdzie każdy realny podział TCP.
    const strumien = sse({ type: 'delta', content: 'Godziny otwarcia: 9-18' })
    const poZnaku = strumien.split('')

    expect(przepusc(poZnaku)).toEqual([{ type: 'delta', content: 'Godziny otwarcia: 9-18' }])
  })

  it('daje ten sam wynik niezależnie od podziału', () => {
    const strumien =
      sse({ type: 'delta', content: 'Prze' }) +
      sse({ type: 'delta', content: 'gląd ' }) +
      sse({ type: 'done', source: 'faq', tokens: 12, message_id: 7 })

    const wCalosci = przepusc([strumien])
    const naPol = przepusc([strumien.slice(0, 37), strumien.slice(37)])
    const poZnaku = przepusc(strumien.split(''))

    expect(naPol).toEqual(wCalosci)
    expect(poZnaku).toEqual(wCalosci)
  })
})

describe('odporność na śmieci', () => {
  it('pomija uszkodzone zdarzenie, nie przerywając strumienia', () => {
    // To był realny błąd: JSON.parse stał bez zabezpieczenia w pętli czytania,
    // więc jeden zepsuty fragment przerywał całą odpowiedź i odwiedzający
    // dostawał komunikat o błędzie zamiast reszty zdania.
    const strumien =
      sse({ type: 'delta', content: 'Zaczynam' }) +
      'data: {to nie jest JSON}\n\n' +
      sse({ type: 'delta', content: ' i kończę' })

    const zdarzenia = przepusc([strumien])

    expect(zdarzenia.map((z) => (z as { content: string }).content)).toEqual([
      'Zaczynam',
      ' i kończę',
    ])
  })

  it('przyjmuje "data:" bez spacji', () => {
    // Poprawne SSE, a poprzednia wersja wymagała spacji i po cichu gubiła
    // takie zdarzenia — bez żadnego śladu, że coś przepadło.
    const { zdarzenia } = czytajZdarzenia('data:{"type":"delta","content":"X"}\n\n')

    expect(zdarzenia).toEqual([{ type: 'delta', content: 'X' }])
  })

  it('ignoruje komentarze i puste linie utrzymujące połączenie', () => {
    const strumien = ': keep-alive\n\n' + sse({ type: 'delta', content: 'A' }) + '\n\n'

    const { zdarzenia } = czytajZdarzenia(strumien)

    expect(zdarzenia).toEqual([{ type: 'delta', content: 'A' }])
  })

  it('pusty strumień nie daje zdarzeń ani nie rzuca', () => {
    expect(czytajZdarzenia('')).toEqual({ zdarzenia: [], reszta: '' })
  })
})

describe('zdarzenie kończące', () => {
  it('niesie źródła, liczbę tokenów i identyfikator wiadomości', () => {
    const done = {
      type: 'done',
      source: 'document',
      tokens: 128,
      sources: [{ name: 'Cennik', url: 'https://firma.pl/cennik' }],
      message_id: 42,
    }

    const { zdarzenia } = czytajZdarzenia(sse(done))

    expect(zdarzenia[0]).toEqual(done)
  })

  it('rozpoznaje odpowiedź bez oparcia w wiedzy firmy', () => {
    // source === 'gpt' znaczy, że bot nie miał na czym oprzeć odpowiedzi.
    // Widget proponuje wtedy zostawienie kontaktu — to jest moment, w którym
    // z nieudanej odpowiedzi powstaje zapytanie handlowe.
    const { zdarzenia } = czytajZdarzenia(sse({ type: 'done', source: 'gpt', tokens: 30 }))

    expect((zdarzenia[0] as { source: string }).source).toBe('gpt')
  })
})
