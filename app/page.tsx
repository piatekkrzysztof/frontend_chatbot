'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import WidgetPreview from '@/components/widget/WidgetPreview'
import Logo from '@/components/layout/Logo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface Plan {
  code: string
  name: string
  price_pln: number
  price_pln_yearly: number
  message_limit: number
  knowledge_base_mb: number
  max_domains: number
  max_seats: number
  branding: string
}

/**
 * Opis brandingu językiem korzyści, nie nazwą pola. "wlasny" nic nie mówi
 * kupującemu — "widget w Twojej marce" mówi wszystko.
 */
const BRANDING_OPIS: Record<string, string> = {
  wymagany: 'Widget w marce Sm-art',
  usuwalny: 'Bez naszej stopki w widgecie',
  wlasny: 'Pełna biała etykieta — Twoje logo i kolory',
}

const KORZYSCI_SKROT = [
  'Odpowiada o każdej porze, także w weekend',
  'Zna Twój cennik i zasady — nie zmyśla',
  'Zbiera kontakty, gdy nie zna odpowiedzi',
  'Pokazuje, o co klienci naprawdę pytają',
]

const KORZYSCI = [
  {
    tytul: 'Odpowiada, kiedy Ciebie nie ma',
    tresc:
      'Pytania o godziny, ceny i dostępność przychodzą wieczorem i w weekend. '
      + 'Bot odpowiada od razu, więc klient nie idzie sprawdzić u konkurencji.',
  },
  {
    tytul: 'Zna Twoją firmę, nie internet',
    tresc:
      'Odpowiada wyłącznie z materiałów, które wgrasz — cennika, regulaminu, '
      + 'treści ze strony. Czego nie wie, tego nie zmyśla: mówi wprost i prosi o kontakt.',
  },
  {
    tytul: 'Pokazuje, o co naprawdę pytają',
    tresc:
      'Zestawienie pytań bez pokrycia w Twoich materiałach to gotowa lista '
      + 'tego, co dopisać na stronie. Zwykle wychodzi kilka rzeczy, o których nie pomyślałeś.',
  },
  {
    tytul: 'Zbiera kontakty zamiast je tracić',
    tresc:
      'Gdy pytanie wykracza poza wiedzę bota, proponuje zostawienie kontaktu. '
      + 'Trafia do panelu, a Ty oddzwaniasz do kogoś, kto już był zainteresowany.',
  },
]

const KROKI = [
  {
    numer: '01',
    tytul: 'Wgraj to, co masz',
    tresc: 'Cennik w PDF, regulamin, adres strony. Bot czyta i sam się uczy.',
  },
  {
    numer: '02',
    tytul: 'Dopasuj wygląd',
    tresc: 'Kolor, nazwa, powitanie, języki odpowiedzi. Podgląd na żywo w panelu.',
  },
  {
    numer: '03',
    tytul: 'Wklej jedną linijkę',
    tresc: 'Gotowy fragment kodu na stronę. Bez programisty, bez wtyczek.',
  },
]

export default function StronaGlowna() {
  const router = useRouter()
  const [plany, setPlany] = useState<Plan[]>([])
  const [rocznie, setRocznie] = useState(false)

  // Przekierowanie zalogowanych do panelu robi teraz middleware, po stronie
  // serwera. Wczesniej decydowal o tym odczyt localStorage w efekcie, wiec
  // KAZDY odwiedzajacy -- takze ten, ktory nigdy nie mial konta -- ogladal
  // najpierw ekran "Wczytywanie...". Na stronie sprzedazowej to byla pierwsza
  // rzecz, jaka widzial potencjalny klient.
  useEffect(() => {

    // Ceny bierzemy z katalogu backendu, nie z kopii w kodzie — inaczej
    // strona sprzedażowa rozjedzie się z tym, co naprawdę obowiązuje
    fetch(`${API_URL}/billing/cennik/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.plans && setPlany(d.plans))
      .catch(() => {})
  }, [router])

  return (
    <main className="overflow-hidden">
      {/* ─── Nawigacja ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-lg"
              style={{ background: 'rgba(17,12,4,0.72)', borderBottom: '1px solid var(--border-subtle)' }}>
        <nav className="max-w-6xl mx-auto px-5 h-[68px] flex items-center justify-between">
          <Logo wysokosc={28} jakoLink />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-sand-300 hover:text-cream transition-colors">
              Zaloguj się
            </Link>
            <Link href="/rejestracja" className="btn-primary !py-2.5 !px-5 !text-sm">
              Załóż konto
            </Link>
          </div>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative">
        {/* Poświata za nagłówkiem — buduje głębię bez dokładania elementów */}
        <div
          aria-hidden
          className="absolute -top-56 -right-40 w-[46rem] h-[46rem] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.13) 0%, transparent 62%)' }}
        />

        <div className="relative max-w-6xl mx-auto px-5 pt-10 pb-8 md:pt-14 md:pb-10
                        grid gap-10 lg:grid-cols-[1.15fr_auto] lg:items-center">
          {/* Dwie kolumny, tak jak w hero agencjasm-art.pl. Sama kolumna tekstu
              zostawiała pustą prawą połowę ekranu i cała strona czytała się
              jako zepchnięta do lewej krawędzi. */}
          <div className="text-center sm:text-left">
          <span className="label-eyebrow wejscie">Asystent AI dla małych firm</span>

          <h1 className="mt-4 max-w-3xl text-[clamp(1.9rem,4.4vw,3.25rem)] leading-[1.05] text-balance wejscie"
              style={{ animationDelay: '0.08s' }}>
            Twoja strona odpowiada{' '}
            <br className="hidden sm:inline" />
            <span className="text-ember-500">zanim klient zdąży wyjść</span>
          </h1>

          <p className="mt-5 max-w-xl mx-auto sm:mx-0 text-sand-300 text-pretty wejscie" style={{ animationDelay: '0.16s' }}>
            Uczy się wyłącznie z Twoich materiałów. Wdrożenie to kilkanaście
            minut i jedna linijka kodu.
          </p>

          {/* Cztery zdania zamiast osobnej sekcji. Cennik ma być tuż pod
              zgięciem, a nie po przewinięciu przez listę funkcji. */}
          <ul className="mt-6 grid gap-x-7 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl text-sm text-left inline-grid sm:grid wejscie"
              style={{ animationDelay: '0.2s' }}>
            {KORZYSCI_SKROT.map((k) => (
              <li key={k} className="flex gap-2.5 text-sand-300">
                <span className="text-ember-500 shrink-0">→</span>
                <span>{k}</span>
              </li>
            ))}
          </ul>

          {/* Bez pary przycisków w hero. Cennik jest tuż pod spodem, więc
              "Zobacz cennik" prowadziłby do czegoś, co już widać, a każda karta
              planu ma własne wezwanie. Wolne miejsce podnosi ceny wyżej. */}
          </div>

          {/* Ten sam komponent, który rysuje podgląd w panelu — odwiedzający
              widzi dokładnie to, co dostanie, a nie wyretuszowaną makietę.
              Poniżej 1024 px znika: zabierałby miejsce cenom. */}
          <div className="hidden lg:block wejscie" style={{ animationDelay: '0.22s' }}>
            <div style={{ filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.45))' }}>
              <WidgetPreview
                brandingMode="smart"
                color="#F97316"
                title="Sm-art"
                footerText=""
                welcomeMessage="Cześć! Pytaj o ceny, godziny i dostępność — odpowiem od razu."
                suggestedQuestions={['Jakie macie godziny otwarcia?', 'Ile kosztuje przegląd?']}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Cennik ─── */}
      <section id="cennik" className="pb-20 md:pb-24 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            {/* Bez nadnagłówka "Cennik" — samo zdanie mówi, o czym jest sekcja,
                a każdy zaoszczędzony wiersz podnosi ceny bliżej pierwszego ekranu */}
            <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] text-balance">Płacisz za rozmowy, nie za obietnice</h2>

            {/* Przełącznik okresu. Rabat roczny podany wprost, bo to
                najczęstsze pytanie przy wyborze planu. */}
            <div className="flex items-center gap-1 rounded-full p-1"
                 style={{ background: 'var(--color-espresso-700)' }}>
              <button
                onClick={() => setRocznie(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  !rocznie ? 'bg-ember-500 text-espresso-800' : 'text-sand-300'
                }`}
              >
                Miesięcznie
              </button>
              <button
                onClick={() => setRocznie(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  rocznie ? 'bg-ember-500 text-espresso-800' : 'text-sand-300'
                }`}
              >
                Rocznie −20%
              </button>
            </div>
          </div>

          {plany.length === 0 ? (
            <p className="mt-12 text-sand-400">Wczytywanie cennika...</p>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {plany.map((plan, i) => {
                const wyrozniony = i === 1
                const cena = rocznie ? plan.price_pln_yearly : plan.price_pln
                return (
                  <div
                    key={plan.code}
                    className={`relative p-6 flex flex-col rounded-[14px] transition-all ${
                      wyrozniony ? 'md:-translate-y-4' : ''
                    }`}
                    style={{
                      background: wyrozniony ? 'var(--color-espresso-700)' : 'var(--color-espresso-900)',
                      border: `1px solid ${wyrozniony ? 'var(--ember-bdr)' : 'var(--border-subtle)'}`,
                      boxShadow: wyrozniony ? '0 20px 60px rgba(0,0,0,0.35)' : 'none',
                    }}
                  >
                    {wyrozniony && (
                      <span className="absolute -top-3 left-8 pill">Najczęściej wybierany</span>
                    )}

                    <h3 className="text-base uppercase tracking-wider">{plan.name}</h3>

                    <p className="mt-3 font-display font-extrabold text-[2.75rem] leading-none">
                      {cena}
                      <span className="text-base font-normal text-sand-400"> zł/mies.</span>
                    </p>
                    <p className="mt-1 text-xs text-sand-400">
                      {rocznie ? `Płatne rocznie: ${cena * 12} zł netto` : 'netto, bez zobowiązania'}
                    </p>

                    <ul className="mt-6 mb-7 flex flex-col gap-2.5 text-sm text-sand-300">
                      <li className="flex gap-2.5">
                        <span className="text-ember-500">→</span>
                        <span><strong className="text-cream">
                          {plan.message_limit.toLocaleString('pl-PL')}
                        </strong> rozmów miesięcznie</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-ember-500">→</span>
                        <span>{plan.knowledge_base_mb} MB bazy wiedzy</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-ember-500">→</span>
                        <span>
                          {plan.max_domains === 1 ? '1 witryna' : `${plan.max_domains} witryn`}
                          {' · '}
                          {plan.max_seats === 1 ? '1 konto' : `${plan.max_seats} kont`}
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-ember-500">→</span>
                        <span>{BRANDING_OPIS[plan.branding] || plan.branding}</span>
                      </li>
                    </ul>

                    <Link
                      href={`/rejestracja?plan=${plan.name}`}
                      className={`mt-auto w-full text-center ${wyrozniony ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      Wybieram {plan.name}
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-8 text-sm text-sand-400">
            Wszystkie plany zawierają rozpoznawanie języka pytania, cytowanie źródeł
            odpowiedzi, zbieranie kontaktów i zgodność z RODO oraz EU AI Act.
          </p>
        </div>
      </section>

      {/* ─── Korzyści ─── */}
      <section className="relative py-20 md:py-28" style={{ background: 'var(--color-espresso-800)' }}>
        <div className="max-w-6xl mx-auto px-5 text-center sm:text-left">
          <span className="label-eyebrow">Co z tego masz</span>
          <h2 className="mt-4 max-w-2xl mx-auto sm:mx-0 text-[clamp(1.6rem,4vw,3rem)] text-balance">
            Mniej powtarzalnych pytań, więcej domkniętych spraw
          </h2>

          <div className="mt-14 grid gap-px md:grid-cols-2"
               style={{ background: 'var(--border-subtle)' }}>
            {KORZYSCI.map((k) => (
              <div key={k.tytul} className="p-8 md:p-10 transition-colors hover:bg-espresso-700"
                   style={{ background: 'var(--color-espresso-800)' }}>
                <h3 className="text-xl">{k.tytul}</h3>
                <p className="mt-3 text-sand-300 text-pretty">{k.tresc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Jak to działa ─── */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-5 text-center sm:text-left">
          <span className="label-eyebrow">Wdrożenie</span>
          <h2 className="mt-4 max-w-2xl mx-auto sm:mx-0 text-[clamp(1.6rem,4vw,3rem)] text-balance">
            Trzy kroki, żadnego wdrożeniowca
          </h2>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {KROKI.map((krok) => (
              <div key={krok.numer} className="relative">
                {/* Ozdoba, nie treść: numer powiela kolejność, którą widać
                    w układzie, i jest celowo ledwo widoczny (1,12:1). Zamiast
                    udawać, że przechodzi próg kontrastu, deklarujemy go jako
                    element dekoracyjny i zabieramy czytnikom ekranu. */}
                <span aria-hidden="true" className="font-display text-6xl font-extrabold"
                      style={{ color: 'var(--ember-dim)' }}>
                  {krok.numer}
                </span>
                <h3 className="mt-2 text-lg">{krok.tytul}</h3>
                <p className="mt-2 text-sand-300 text-sm text-pretty">{krok.tresc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Zamknięcie ─── */}
      <section className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-[clamp(1.6rem,4.5vw,3.25rem)] text-balance">
            Ile pytań zostało dziś bez odpowiedzi?
          </h2>
          <p className="mt-5 text-lg text-sand-300 text-pretty">
            Wgraj cennik, wklej jedną linijkę i zobacz, o co naprawdę pytają
            odwiedzający Twoją stronę.
          </p>
          <Link href="/rejestracja" className="btn-primary mt-9">Załóż konto za darmo</Link>
        </div>
      </section>

      <footer className="py-10" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-wrap items-center justify-between gap-4 text-sm text-sand-400">
          <div className="flex items-center gap-3">
            <Logo wysokosc={22} />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="https://agencjasm-art.pl" className="hover:text-cream transition-colors">
              agencjasm-art.pl
            </a>
            <Link href="/privacy" className="hover:text-cream transition-colors">
              Prywatność
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
