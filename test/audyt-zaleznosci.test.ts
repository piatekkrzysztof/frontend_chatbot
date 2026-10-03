/**
 * Bramka audytu zaleznosci z waskimi wyjatkami.
 *
 * Kategoria ryzyka: BRAMKA, KTOREJ NIE DA SIE SPELNIC. `braces` ma zgloszenie
 * obejmujace wszystkie wydane wersje, wiec zwykle `npm audit` zatrzymywaloby
 * kazdy PR panelu bez konca - a bramke, ktorej nie da sie spelnic, ludzie
 * ucza sie wylaczac. Wyjatek jest wiec mozliwy, ale te testy pilnuja, zeby
 * nie dalo sie nim uciszyc niczego poza tym, na co sie go wystawilo.
 */
import { describe, expect, it } from 'vitest'
import { ocen, pakietyProdukcyjne, zgloszenia } from '../scripts/audyt-logika.mjs'

const DZIS = '2026-10-03'

const BRACES = {
  vulnerabilities: {
    braces: {
      severity: 'high',
      via: [
        {
          name: 'braces',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
          title: 'braces vulnerable to stack-exhaustion',
        },
      ],
    },
    // Lancuch: te pakiety maja zgloszenie tylko "przez" braces.
    micromatch: { severity: 'high', via: ['braces'] },
    'fast-glob': { severity: 'high', via: ['micromatch'] },
  },
}

const WYJATEK_BRACES = {
  ghsa: 'GHSA-vfj7-8cjw-p6xm',
  pakiet: 'braces',
  powod: 'brak poprawionej wersji, tylko narzedzia lintowania',
  przeglad_do: '2026-11-03',
}

const BEZ_PRODUKCJI = new Set<string>()

describe('bez wyjatkow zachowuje sie jak npm audit', () => {
  it('czysty audyt przechodzi', () => {
    const { bledy } = ocen({ audyt: { vulnerabilities: {} }, wyjatki: [], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS })

    expect(bledy).toEqual([])
  })

  it('podatnosc bez wyjatku zatrzymuje', () => {
    const { bledy } = ocen({ audyt: BRACES, wyjatki: [], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS })

    expect(bledy).toHaveLength(1)
    expect(bledy[0]).toMatch(/GHSA-vfj7-8cjw-p6xm/)
  })

  it('niska waga nie zatrzymuje, tak jak przy --audit-level=moderate', () => {
    const niska = {
      vulnerabilities: {
        x: { severity: 'low', via: [{ name: 'x', severity: 'low', url: 'https://github.com/advisories/GHSA-low' }] },
      },
    }

    expect(ocen({ audyt: niska, wyjatki: [], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS }).bledy).toEqual([])
  })

  it('zgloszenie bez adresu zatrzymuje zamiast zniknac', () => {
    // Pierwsza wersja pomijala obiekt bez `url` - podatnosc o nietypowym
    // ksztalcie po cichu wypadalaby z bramki. Przy niejasnych danych bramka
    // ma sie zamknac, a wyjatek i tak takiego zgloszenia nie obejmie.
    const bezAdresu = {
      vulnerabilities: { x: { severity: 'high', via: [{ name: 'x', severity: 'high', title: 'cos' }] } },
    }

    expect(ocen({ audyt: bezAdresu, wyjatki: [], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS }).bledy).toHaveLength(1)
  })

  it('nieznana waga zatrzymuje zamiast zniknac', () => {
    const nieznana = {
      vulnerabilities: {
        x: { severity: 'severe', via: [{ name: 'x', severity: 'severe', url: 'https://github.com/advisories/GHSA-nowa' }] },
      },
    }

    expect(ocen({ audyt: nieznana, wyjatki: [], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS }).bledy).toHaveLength(1)
  })

  it('lancuch zaleznosci to jedno zgloszenie, nie trzy', () => {
    // Inaczej jeden wyjatek musialby wymieniac braces, micromatch, fast-glob
    // i dalej - a kazdy kolejny wpis to kolejne miejsce na pomylke.
    expect([...zgloszenia(BRACES).keys()]).toEqual(['GHSA-vfj7-8cjw-p6xm'])
  })
})

describe('wyjatek', () => {
  it('przyjmuje dokladnie to zgloszenie, na ktore go wystawiono', () => {
    const { bledy, przyjete } = ocen({
      audyt: BRACES,
      wyjatki: [WYJATEK_BRACES],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy).toEqual([])
    expect(przyjete.map((z: { ghsa: string }) => z.ghsa)).toEqual(['GHSA-vfj7-8cjw-p6xm'])
  })

  it('nie ucisza innych zgloszen', () => {
    const dwa = {
      vulnerabilities: {
        ...BRACES.vulnerabilities,
        next: {
          severity: 'critical',
          via: [{ name: 'next', severity: 'critical', url: 'https://github.com/advisories/GHSA-next-rce', title: 'RCE' }],
        },
      },
    }

    const { bledy } = ocen({ audyt: dwa, wyjatki: [WYJATEK_BRACES], produkcyjne: BEZ_PRODUKCJI, dzis: DZIS })

    expect(bledy).toHaveLength(1)
    expect(bledy[0]).toMatch(/CRITICAL next/)
  })

  it('po dacie przegladu znow zatrzymuje', () => {
    const { bledy } = ocen({
      audyt: BRACES,
      wyjatki: [{ ...WYJATEK_BRACES, przeglad_do: '2026-10-02' }],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/przegląd do 2026-10-02/)
  })

  it('w dniu przegladu jeszcze dziala', () => {
    const { bledy } = ocen({
      audyt: BRACES,
      wyjatki: [{ ...WYJATEK_BRACES, przeglad_do: DZIS }],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy).toEqual([])
  })

  it('niepotrzebny wyjatek zatrzymuje, zeby ktos go usunal', () => {
    const { bledy } = ocen({
      audyt: { vulnerabilities: {} },
      wyjatki: [WYJATEK_BRACES],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/nie jest już potrzebny/)
  })

  it('bez powodu albo daty nie jest przyjmowany', () => {
    const { bledy } = ocen({
      audyt: BRACES,
      // @ts-expect-error - celowo niepelny wyjatek: bez powodu i daty
      wyjatki: [{ ghsa: 'GHSA-vfj7-8cjw-p6xm', pakiet: 'braces' }],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/musi mieć ghsa, pakiet, powod i przeglad_do/)
  })
})

describe('produkcja', () => {
  it('wyjatek dla pakietu produkcyjnego nie jest przyjmowany', () => {
    const { bledy } = ocen({
      audyt: BRACES,
      wyjatki: [WYJATEK_BRACES],
      produkcyjne: new Set(['braces']),
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/trafia do produkcji/)
  })

  it('wpisanie innej nazwy pakietu nie przemyca podatnosci produkcyjnej', () => {
    // Sprawdzamy nazwe z audytu, nie z wyjatku. Pierwsza wersja skryptu
    // patrzyla tylko na nazwe zadeklarowana w pliku wyjatkow.
    const { bledy } = ocen({
      audyt: BRACES,
      wyjatki: [{ ...WYJATEK_BRACES, pakiet: 'cos-z-narzedzi' }],
      produkcyjne: new Set(['braces']),
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/dotyczy pakietu braces, który trafia do produkcji/)
  })

  it('niezgodna nazwa pakietu nie jest przyjmowana nawet poza produkcja', () => {
    const { bledy } = ocen({
      audyt: BRACES,
      wyjatki: [{ ...WYJATEK_BRACES, pakiet: 'cos-innego' }],
      produkcyjne: BEZ_PRODUKCJI,
      dzis: DZIS,
    })

    expect(bledy.join(' ')).toMatch(/wymienia pakiet cos-innego, a audyt zgłasza braces/)
  })

  it('zbiera pakiety z calego drzewa, nie tylko bezposrednie', () => {
    const drzewo = {
      dependencies: {
        next: { dependencies: { 'styled-jsx': { dependencies: { 'client-only': {} } } } },
        react: {},
      },
    }

    expect(pakietyProdukcyjne(drzewo)).toEqual(new Set(['next', 'styled-jsx', 'client-only', 'react']))
  })
})
