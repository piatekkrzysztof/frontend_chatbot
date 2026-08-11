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
  knowledge: Knowledge
  conversations: { total: number; last_7d: number; last_30d: number }
  questions: { total: number; last_7d: number }
  answer_sources: { document: number; faq: number; gpt: number }
  usage: { used: number; limit: number | null; plan: string | null }
  unanswered: { id: number; question: string; asked_at: string }[]
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
  const [tenantName, setTenantName] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    apiFetch('/accounts/me/')
      .then((d) => {
        if (active) setTenantName(d.tenant_name || '')
      })
      .catch(() => {})

    apiFetch('/analytics/')
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać statystyk.')
      })

    return () => {
      active = false
    }
  }, [])

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

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading wejscie">
        <div>
          <span className="section-kicker">Centrum operacyjne / 01</span>
          <h1>{tenantName ? `Dzień dobry, ${tenantName}.` : 'Dzień dobry.'}</h1>
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
              <div className="signal-chart" aria-label={`${data.conversations.last_7d} rozmów w ostatnim tygodniu`}>
                {[38, 55, 44, 72, 61, 84, 68, 92].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="command-number">
                <strong>{data.conversations.last_7d}</strong>
                <span>rozmów / 7 dni</span>
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
                <span><i className="legend-dot is-teal" /> Dokumenty <strong>{sources?.document || 0}</strong></span>
                <span><i className="legend-dot is-lime" /> FAQ <strong>{sources?.faq || 0}</strong></span>
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
          </section>
        </div>
      )}
    </div>
  )
}
