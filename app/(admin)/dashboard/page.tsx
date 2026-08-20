'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface Knowledge {
  has_description: boolean
  documents: number
  indexed_chunks: number
  faqs: number
  websites: number
  is_empty: boolean
}

interface Analytics {
  tenant_name?: string
  knowledge: Knowledge
  conversations: { total: number; last_7d: number; last_30d: number }
  questions: {
    total: number
    last_7d: number
    daily?: { date: string; count: number }[]
  }
  answer_sources: { document: number; faq: number; gpt: number }
  usage: { used: number; limit: number | null; plan: string | null }
  unanswered: { id: number; question: string; asked_at: string }[]
}

interface DailyQuestions {
  date: string
  label: string
  fullLabel: string
  count: number
}

function buildDailyQuestions(counts: { date: string; count: number }[]): DailyQuestions[] {
  const formatter = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' })
  const fullFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (6 - index))
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

    return {
      date,
      label: formatter.format(day).replace('.', ''),
      fullLabel: fullFormatter.format(day),
      count: 0,
    }
  })

  const countByDate = new Map(counts.map((item) => [item.date, item.count]))
  days.forEach((day) => {
    day.count = countByDate.get(day.date) || 0
  })

  return days
}

interface MetricProps {
  index: string
  label: string
  value: string | number
  detail: string
  tone?: 'signal' | 'neutral'
}

function Metric({ index, label, value, detail, tone = 'neutral' }: MetricProps) {
  return (
    <article className={`executive-metric ${tone === 'signal' ? 'is-signal' : ''}`}>
      <div className="metric-topline">
        <span>{index}</span>
        <span className="metric-mark" aria-hidden="true" />
      </div>
      <p className="metric-value">{value}</p>
      <h3>{label}</h3>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}

function KnowledgeNotice({ knowledge }: { knowledge: Knowledge }) {
  if (!knowledge.is_empty && knowledge.has_description) return null

  return (
    <aside className="knowledge-notice">
      <div className="knowledge-notice-index">!</div>
      <div>
        <span className="section-kicker">Wymaga uwagi</span>
        <h2>{knowledge.is_empty ? 'Bot czeka na wiedzę o Twojej firmie.' : 'Uzupełnij opis działalności.'}</h2>
        <p>
          {knowledge.is_empty
            ? 'Dodaj opis, dokument lub stronę WWW. Do tego czasu asystent celowo nie odpowiada na pytania, których nie może potwierdzić.'
            : 'Dokumenty są już dostępne, ale krótki opis firmy poprawi odpowiedzi na ogólne pytania klientów.'}
        </p>
      </div>
      <Link href="/documents" className="notice-action">Uzupełnij bazę <span aria-hidden="true">↗</span></Link>
    </aside>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Ładowanie danych" role="status">
      <div className="skeleton-block skeleton-hero" />
      <div className="skeleton-metrics">
        {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-block" />)}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  // null = jeszcze nie wiadomo; bez tego przełącznik mrugałby z pozycji
  // „wyłączone" na faktyczną w trakcie wczytywania
  const [raportTygodniowy, setRaportTygodniowy] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    apiFetch('/analytics/')
      .then((d) => {
        if (active) setData(d as Analytics)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać statystyk.')
      })

    apiFetch('/widget-settings/mine/')
      .then((d) => {
        if (active) setRaportTygodniowy(Boolean((d as { raport_tygodniowy?: boolean }).raport_tygodniowy))
      })
      .catch(() => {
        // Cicho: to ustawienie poboczne, pulpit ma się pokazać nawet wtedy,
        // gdy nie udało się odczytać preferencji powiadomień
      })

    return () => {
      active = false
    }
  }, [])

  async function przelaczRaport(wlaczony: boolean) {
    // Optymistycznie, żeby kliknięcie było natychmiastowe; przy błędzie wracamy
    const poprzedni = raportTygodniowy
    setRaportTygodniowy(wlaczony)
    try {
      const dane = new FormData()
      dane.append('raport_tygodniowy', String(wlaczony))
      await apiFetch('/widget-settings/mine/', { method: 'PATCH', body: dane })
    } catch (err) {
      setRaportTygodniowy(poprzedni)
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać ustawienia.')
    }
  }

  const sources = data?.answer_sources
  const answeredFromContent = sources ? sources.document + sources.faq : 0
  const totalAnswers = sources ? answeredFromContent + sources.gpt : 0
  const coverage = totalAnswers > 0 ? Math.round((answeredFromContent / totalAnswers) * 100) : null
  const usagePercent = data?.usage.limit
    ? Math.min(100, Math.round((data.usage.used / data.usage.limit) * 100))
    : 0
  const knowledgeScore = data
    ? Math.min(100,
      (data.knowledge.has_description ? 30 : 0)
      + (data.knowledge.documents > 0 ? 30 : 0)
      + (data.knowledge.faqs > 0 ? 20 : 0)
      + (data.knowledge.websites > 0 ? 20 : 0))
    : 0
  const dailyQuestions = data?.questions.daily
    ? buildDailyQuestions(data.questions.daily)
    : null
  const maxDailyQuestions = Math.max(0, ...(dailyQuestions?.map((day) => day.count) || []))
  const chartTotal = dailyQuestions?.reduce((sum, day) => sum + day.count, 0) ?? null

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading wejscie">
        <div>
          <span className="section-kicker">Centrum operacyjne / 01</span>
          <h1>{data?.tenant_name ? `Dzień dobry, ${data.tenant_name}.` : 'Dzień dobry.'}</h1>
          <p>Najważniejsze sygnały z obsługi klienta — bez szumu, w jednym miejscu.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link href="/widget-settings" className="btn-ghost">Ustawienia widgetu</Link>
          <Link href="/documents" className="btn-primary">Rozwiń bazę wiedzy <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      {error && <div className="admin-error" role="alert">{error}</div>}

      {!data && !error && <DashboardSkeleton />}

      {data && (
        <div className="dashboard-content">
          <KnowledgeNotice knowledge={data.knowledge} />

          <section className="command-card wejscie" style={{ animationDelay: '70ms' }}>
            <div className="command-grid" aria-hidden="true" />
            <div className="command-copy">
              <span className="command-status"><span className="status-dot" /> Asystent aktywny</span>
              <h2>Twój cyfrowy konsultant pracuje <span>24/7.</span></h2>
              <p>
                W ostatnich 7 dniach obsłużył <strong>{data.conversations.last_7d}</strong> rozmów
                i przejął <strong>{data.questions.last_7d}</strong> pytań od Twojego zespołu.
              </p>
            </div>
            <div className="command-visual">
              {dailyQuestions ? (
                <div className="signal-chart" aria-label={`${chartTotal} pytań w ostatnich 7 dniach`}>
                  {dailyQuestions.map((day) => {
                    const height = maxDailyQuestions > 0 ? (day.count / maxDailyQuestions) * 100 : 0
                    return (
                      <div className="signal-column" key={day.date}>
                        <span className="signal-value">{day.count}</span>
                        <span
                          className={`signal-bar ${day.count === 0 ? 'is-zero' : ''}`}
                          style={{ height: day.count === 0 ? '2px' : `${Math.max(height, 8)}%` }}
                          title={`${day.fullLabel}: ${day.count} ${day.count === 1 ? 'pytanie' : 'pytań'}`}
                        />
                        <span className="signal-label">{day.label}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="signal-chart-empty">
                  <span>Brak danych dziennych</span>
                  <p>Wykres pojawi się po aktualizacji API analitycznego.</p>
                </div>
              )}
              <div className="command-number">
                <strong>{chartTotal ?? '—'}</strong>
                <span>pytań / 7 dni</span>
              </div>
            </div>
          </section>

          <section className="executive-metrics wejscie" aria-label="Kluczowe wskaźniki" style={{ animationDelay: '120ms' }}>
            <Metric index="01" label="Rozmowy" value={data.conversations.last_7d} detail={`${data.conversations.total} od początku`} />
            <Metric index="02" label="Pytania klientów" value={data.questions.last_7d} detail={`${data.questions.total} łącznie`} />
            <Metric
              index="03"
              label="Pokrycie wiedzą"
              value={coverage === null ? '—' : `${coverage}%`}
              detail={coverage === null ? 'Brak danych do oceny' : `${answeredFromContent} potwierdzonych odpowiedzi`}
              tone="signal"
            />
            <Metric
              index="04"
              label="Wykorzystanie planu"
              value={data.usage.limit ? `${usagePercent}%` : data.usage.used}
              detail={data.usage.plan ? `Plan ${data.usage.plan}` : 'Bez aktywnego planu'}
            />
          </section>

          <section className="dashboard-operations wejscie" style={{ animationDelay: '180ms' }}>
            <article className="operations-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Jakość odpowiedzi</span>
                  <h2>Pokrycie materiałami</h2>
                </div>
                <span className="panel-index">/ 02</span>
              </div>

              <div className="coverage-display">
                <strong>{coverage === null ? '—' : `${coverage}%`}</strong>
                <p>odpowiedzi opartych na zatwierdzonej wiedzy Twojej firmy</p>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${coverage || 0}%` }} />
              </div>
              <div className="source-legend">
                <span><i className="legend-dot is-orange" /> Dokumenty <strong>{sources?.document || 0}</strong></span>
                <span><i className="legend-dot is-amber" /> FAQ <strong>{sources?.faq || 0}</strong></span>
                <span><i className="legend-dot is-muted" /> Model AI <strong>{sources?.gpt || 0}</strong></span>
              </div>
            </article>

            <article className="operations-panel knowledge-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Gotowość systemu</span>
                  <h2>Baza wiedzy</h2>
                </div>
                <span className="panel-index">/ 03</span>
              </div>
              <div className="knowledge-score-row">
                <div className="knowledge-score"><strong>{knowledgeScore}</strong><span>/100</span></div>
                <span className={`score-label ${knowledgeScore >= 70 ? 'is-good' : ''}`}>
                  {knowledgeScore >= 70 ? 'Dobra kondycja' : 'Do uzupełnienia'}
                </span>
              </div>
              <div className="knowledge-checks">
                <span className={data.knowledge.has_description ? 'is-complete' : ''}>Opis firmy</span>
                <span className={data.knowledge.documents > 0 ? 'is-complete' : ''}>{data.knowledge.documents} dokumentów</span>
                <span className={data.knowledge.faqs > 0 ? 'is-complete' : ''}>{data.knowledge.faqs} wpisów FAQ</span>
                <span className={data.knowledge.websites > 0 ? 'is-complete' : ''}>{data.knowledge.websites} stron WWW</span>
              </div>
              <Link href="/documents" className="panel-link">Zarządzaj wiedzą <span aria-hidden="true">↗</span></Link>
            </article>
          </section>

          <section className="unanswered-panel wejscie" style={{ animationDelay: '240ms' }}>
            <div className="panel-heading unanswered-heading">
              <div>
                <span className="section-kicker">Szanse na poprawę</span>
                <h2>Pytania bez pokrycia</h2>
                <p>Dodaj odpowiedzi do bazy, aby kolejna rozmowa zakończyła się konkretem.</p>
              </div>
              <Link href="/faq" className="panel-link">Przejdź do FAQ <span aria-hidden="true">↗</span></Link>
            </div>

            {data.unanswered.length === 0 ? (
              <div className="perfect-state">
                <span>✓</span>
                <div>
                  <strong>Pełne pokrycie</strong>
                  <p>Wszystkie ostatnie pytania znalazły odpowiedź w Twoich materiałach.</p>
                </div>
              </div>
            ) : (
              <div className="unanswered-list">
                {data.unanswered.slice(0, 5).map((item, index) => (
                  <article key={item.id} className="unanswered-row">
                    <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                    <p>{item.question}</p>
                    <time dateTime={item.asked_at}>{new Date(item.asked_at).toLocaleString('pl-PL')}</time>
                    <Link href="/faq" aria-label={`Dodaj odpowiedź do pytania: ${item.question}`}>↗</Link>
                  </article>
                ))}
              </div>
            )}

            {/* Ten sam wybór, który list zapowiada w stopce. Stoi tutaj, przy
                danych, których dotyczy — nie w ustawieniach widgetu, gdzie
                nie ma nic wspólnego z wyglądem okna czatu. */}
            <label className="raport-przelacznik">
              <input
                type="checkbox"
                checked={raportTygodniowy === true}
                disabled={raportTygodniowy === null}
                onChange={(e) => przelaczRaport(e.target.checked)}
              />
              <span>
                Przysyłaj mi to w poniedziałki mailem
                <small>
                  Jeden list tygodniowo, wyłącznie wtedy, gdy pojawią się nowe
                  pytania bez pokrycia.
                </small>
              </span>
            </label>
          </section>
        </div>
      )}
    </div>
  )
}
