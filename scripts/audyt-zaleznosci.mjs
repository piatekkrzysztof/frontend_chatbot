/**
 * Bramka audytu zależności w CI. Logika i jej uzasadnienie: `audyt-logika.mjs`.
 *
 * Uruchamiane zamiast `npm audit --audit-level=moderate`. Bez wyjątków w pliku
 * zachowuje się dokładnie jak tamto polecenie.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { ocen, pakietyProdukcyjne } from './audyt-logika.mjs'

/** `npm audit` kończy się kodem 1, gdy coś znajdzie - wynik i tak jest w stdout. */
function npmJson(argumenty) {
  try {
    return JSON.parse(
      execFileSync('npm', argumenty, { encoding: 'utf8', shell: process.platform === 'win32' }),
    )
  } catch (blad) {
    if (blad.stdout) return JSON.parse(blad.stdout)
    throw blad
  }
}

const audyt = npmJson(['audit', '--json'])
const drzewo = npmJson(['ls', '--omit=dev', '--all', '--json'])
const wyjatki = JSON.parse(readFileSync(new URL('../audyt-wyjatki.json', import.meta.url), 'utf8'))
const dzis = new Date().toISOString().slice(0, 10)

const { bledy, przyjete } = ocen({
  audyt,
  wyjatki: wyjatki.wyjatki ?? [],
  produkcyjne: pakietyProdukcyjne(drzewo),
  dzis,
})

for (const z of przyjete) {
  // Widoczne w każdym przebiegu: wyjątek, którego nie widać, przestaje być
  // świadomą decyzją i staje się zapomnianą.
  console.log(`::warning title=Wyjątek audytu::${z.waga} ${z.pakiet} (${z.ghsa}) - patrz audyt-wyjatki.json`)
}

if (bledy.length) {
  for (const blad of bledy) console.log(`::error title=Audyt zależności::${blad}`)
  console.error(`\n${bledy.length} problem(ów) z zależnościami.`)
  process.exit(1)
}

console.log(`Audyt zależności: brak nieprzyjętych podatności (wyjątków w użyciu: ${przyjete.length}).`)
