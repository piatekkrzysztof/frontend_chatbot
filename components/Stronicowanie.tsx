/**
 * Przyciski stron dla list panelu, które rosną bez końca (F16).
 *
 * Konwersacje i Zapytania wczytywały dotąd całą historię firmy naraz. Ten sam
 * układ co w Dzienniku: najnowsze na pierwszej stronie, "Starsze" idzie w głąb.
 */
interface Props {
  numer: number
  poprzednia: boolean
  nastepna: boolean
  lacznie: number
  wczytuje: boolean
  opisLacznie: string
  onZmien: (numer: number) => void
}

export interface StronaListy<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Odpowiedź listy jako strona. Zwykła tablica to backend sprzed stronicowania
 * albo atrapa - traktujemy ją jak jedyną stronę, zamiast wywracać ekran.
 */
export function naStrone<T>(dane: unknown): StronaListy<T> {
  if (Array.isArray(dane)) {
    return { count: dane.length, next: null, previous: null, results: dane as T[] }
  }
  const strona = (dane ?? {}) as Partial<StronaListy<T>>
  return {
    count: strona.count ?? 0,
    next: strona.next ?? null,
    previous: strona.previous ?? null,
    results: strona.results ?? [],
  }
}

export default function Stronicowanie({
  numer,
  poprzednia,
  nastepna,
  lacznie,
  wczytuje,
  opisLacznie,
  onZmien,
}: Props) {
  if (!poprzednia && !nastepna) return null

  return (
    <div className="flex flex-wrap items-center gap-4 mt-6">
      <button
        type="button"
        onClick={() => onZmien(numer - 1)}
        disabled={!poprzednia || wczytuje}
        className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm disabled:opacity-40"
      >
        Nowsze
      </button>
      <button
        type="button"
        onClick={() => onZmien(numer + 1)}
        disabled={!nastepna || wczytuje}
        className="rounded border border-[color:var(--obramowanie-mocne)] px-4 py-2 text-sm disabled:opacity-40"
      >
        Starsze
      </button>
      <p className="text-sm tekst-slaby" aria-live="polite">
        Strona {numer}, {opisLacznie}: {lacznie}
      </p>
    </div>
  )
}
