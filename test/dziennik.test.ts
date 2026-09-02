/**
 * Tlumaczenie wpisow dziennika.
 *
 * Kategoria ryzyka: ZAUFANIE DO ZAPISU. Dziennik ma jedno zadanie - powiedziec
 * wlascicielowi, co sie stalo na jego koncie. Opis, ktory mowi cos innego niz
 * zapis, jest gorszy niz brak opisu: bez niego czlowiek czyta sciezke i widzi
 * prawde, z nim czyta zdanie i wierzy.
 */
import { describe, expect, it } from 'vitest'

import { opiszWpis, udana } from '@/lib/dziennik'

describe('opiszWpis', () => {
  it('tlumaczy znana operacje na zdanie po polsku', () => {
    expect(opiszWpis('DELETE', '/api/faq/12/')).toEqual({
      opis: 'Usunięcie pytania z FAQ',
      rozpoznane: true,
    })
  })

  it('rozroznia metody na tej samej sciezce', () => {
    // Ta sama sciezka, dwa rozne zdarzenia. Gdyby regula patrzyla tylko na
    // sciezke, skasowanie pytania i jego poprawka wygladalyby identycznie.
    expect(opiszWpis('DELETE', '/api/faq/12/').opis).toBe('Usunięcie pytania z FAQ')
    expect(opiszWpis('PATCH', '/api/faq/12/').opis).toBe('Zmiana pytania w FAQ')
  })

  it('nieznana sciezka wraca surowa i oznaczona jako nierozpoznana', () => {
    // Najwazniejszy test w tym pliku. Dziennik, ktory dla nieznanego wpisu
    // pisze "inna operacja", gubi dokladnie te zdarzenia, ktorych nikt sie
    // nie spodziewal - a po wlamaniu to one sa jedynym sladem.
    expect(opiszWpis('PATCH', '/api/cos-nowego/7/')).toEqual({
      opis: 'PATCH /api/cos-nowego/7/',
      rozpoznane: false,
    })
  })

  it('nie myli sciezki z jej przedrostkiem', () => {
    // Regula bez kotwicy konca dopasowalaby tu logowanie i pokazala "Logowanie"
    // przy zupelnie innym zdarzeniu.
    expect(opiszWpis('POST', '/api/accounts/login/2fa/').opis).toBe('Logowanie - drugi krok')
    expect(opiszWpis('POST', '/api/accounts/login/podszywanie/').rozpoznane).toBe(false)
  })

  it('opisuje eksport rozmow, bo to jedyny wpis o danych wynoszonych na zewnatrz', () => {
    expect(opiszWpis('POST', '/api/chat/export/')).toEqual({
      opis: 'Eksport rozmów do pliku',
      rozpoznane: true,
    })
  })
})

describe('udana', () => {
  it('2xx to sukces, reszta nie', () => {
    expect(udana(200)).toBe(true)
    expect(udana(201)).toBe(true)
    expect(udana(204)).toBe(true)
    expect(udana(401)).toBe(false)
    expect(udana(403)).toBe(false)
    expect(udana(500)).toBe(false)
  })

  it('przekierowanie nie jest sukcesem', () => {
    // 302 z logowania to najczesciej odbicie na ekran logowania, czyli
    // proba nieudana. Zaliczenie go do sukcesow zamalowaloby na zielono
    // wpisy, ktore powinny niepokoic.
    expect(udana(302)).toBe(false)
  })
})
