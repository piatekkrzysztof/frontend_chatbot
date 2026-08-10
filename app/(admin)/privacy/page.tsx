'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

const RETENTION_OPTIONS = [
  { value: 30, label: '30 dni' },
  { value: 90, label: '90 dni' },
  { value: 180, label: '180 dni' },
  { value: 365, label: '1 rok' },
  { value: 0, label: 'Nie usuwaj automatycznie' },
]

export default function PrivacyPage() {
  const [retention, setRetention] = useState(90)
  const [policyUrl, setPolicyUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState('')
  const [erasing, setErasing] = useState(false)
  const [eraseResult, setEraseResult] = useState('')
  const [eraseError, setEraseError] = useState('')

  useEffect(() => {
    let active = true

    apiFetch('/privacy/')
      .then((data) => {
        if (!active) return
        setRetention(data.data_retention_days)
        setPolicyUrl(data.privacy_policy_url || '')
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać ustawień.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      await apiFetch('/privacy/', {
        method: 'PATCH',
        body: JSON.stringify({
          data_retention_days: retention,
          privacy_policy_url: policyUrl,
        }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać ustawień.')
    } finally {
      setSaving(false)
    }
  }

  async function handleErase(e: FormEvent) {
    e.preventDefault()
    const id = sessionId.trim()
    if (!id) return

    setErasing(true)
    setEraseError('')
    setEraseResult('')

    try {
      const data = await apiFetch(`/privacy/conversations/${id}/`, { method: 'DELETE' })
      const total = Object.values(data.deleted as Record<string, number>).reduce(
        (sum, n) => sum + n,
        0,
      )
      setEraseResult(`Usunięto rozmowę i powiązane dane (${total} rekordów).`)
      setSessionId('')
    } catch (err) {
      setEraseError(err instanceof Error ? err.message : 'Nie udało się usunąć danych.')
    } finally {
      setErasing(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Prywatność i dane</h1>
      <p className="text-sand-300 mb-8">
        Rozmowy odwiedzających to dane osobowe — zawierają treść pytań, skrócony adres IP
        i kontakty zostawione w czacie. To Ty jesteś ich administratorem, więc decydujesz,
        jak długo je przechowujemy.
      </p>

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      <form onSubmit={handleSave} className="mb-12">
        <div className="mb-5">
          <label className="label">
            Automatyczne usuwanie rozmów
          </label>
          <p className="text-sm text-sand-400 mb-2">
            Po tym czasie rozmowy, logi i zostawione kontakty znikają bezpowrotnie.
          </p>
          <select
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
            className="input"
          >
            {RETENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {retention === 0 && (
            <p className="text-sm text-ember-400 mt-2">
              RODO nie pozwala trzymać danych osobowych bezterminowo. Wyłączaj tylko wtedy,
              gdy masz inną, udokumentowaną podstawę do ich przechowywania.
            </p>
          )}
        </div>

        <div className="mb-5">
          <label className="label">
            Link do polityki prywatności
          </label>
          <p className="text-sm text-sand-400 mb-2">
            Pokazujemy go w oknie czatu. Odwiedzający musi wiedzieć, kto przetwarza jego dane,
            zanim je zostawi.
          </p>
          <input
            type="url"
            value={policyUrl}
            onChange={(e) => setPolicyUrl(e.target.value)}
            placeholder="https://twojafirma.pl/polityka-prywatnosci"
            className="input"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary !py-2 !px-4 !text-sm"
          >
            {saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
          </button>
          {saved && <span className="text-sm text-green-700">Zapisano.</span>}
        </div>
      </form>

      <h2 className="text-xl font-bold mb-1">Usunięcie danych na żądanie</h2>
      <p className="text-sm text-sand-400 mb-4">
        Gdy ktoś poprosi o usunięcie swoich danych, znajdź jego rozmowę w zakładce
        Konwersacje i wklej tutaj jej identyfikator. Kasujemy rozmowę razem ze wszystkimi
        logami i zostawionym kontaktem. Operacji nie da się cofnąć.
      </p>

      <form onSubmit={handleErase} className="flex items-center gap-3">
        <input
          type="text"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Identyfikator rozmowy"
          className="flex-1 rounded border border-espresso-600 px-3 py-2 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={!sessionId.trim() || erasing}
          className="rounded border border-red-600 px-4 py-2 text-sm text-rose-400 font-medium disabled:opacity-50 shrink-0"
        >
          {erasing ? 'Usuwanie...' : 'Usuń dane'}
        </button>
      </form>

      {eraseResult && <p className="text-sm text-green-700 mt-3">{eraseResult}</p>}
      {eraseError && <p className="text-sm text-rose-400 mt-3">{eraseError}</p>}
    </div>
  )
}
