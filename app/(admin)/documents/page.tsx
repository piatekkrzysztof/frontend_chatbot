'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

interface DocumentItem {
  id: number
  name: string
  processed: boolean
  uploaded_at: string
  chunk_count: number
  status: string
  uzywaj_w_wyszukiwaniu: boolean
  source_url: string
}

interface WebsiteSourceItem {
  id: number
  name: string
  url: string
  is_active: boolean
  created_at: string
}

export default function DocumentsPage() {
  const [description, setDescription] = useState('')
  const [savedDescription, setSavedDescription] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState('')

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  // Id dokumentu, przy którym trwa zapis — blokuje podwójne kliknięcie
  const [przelaczane, setPrzelaczane] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [sources, setSources] = useState<WebsiteSourceItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [odswiezane, setOdswiezane] = useState<number | null>(null)

  async function loadDocuments() {
    try {
      const data = await apiFetch('/documents/')
      setDocuments(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać listy dokumentów.')
    }
  }

  async function loadSources() {
    try {
      const data = await apiFetch('/website-sources/')
      setSources(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nie udało się pobrać listy stron WWW.')
    }
  }

  useEffect(() => {
    let active = true

    apiFetch('/documents/')
      .then((data) => {
        if (active) setDocuments(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać listy dokumentów.')
      })

    apiFetch('/website-sources/')
      .then((data) => {
        if (active) setSources(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (active) setSourceError(err instanceof Error ? err.message : 'Nie udało się pobrać listy stron WWW.')
      })

    apiFetch('/knowledge/')
      .then((data) => {
        if (active) {
          setDescription(data.gpt_prompt || '')
          setSavedDescription(data.gpt_prompt || '')
        }
      })
      .catch((err) => {
        if (active) setDescriptionError(err instanceof Error ? err.message : 'Nie udało się pobrać opisu firmy.')
      })

    // nie ustawiamy stanu, jeśli komponent zdążył się odmontować
    return () => {
      active = false
    }
  }, [])

  async function handleSaveDescription(e: FormEvent) {
    e.preventDefault()
    setSavingDescription(true)
    setDescriptionError('')

    try {
      const data = await apiFetch('/knowledge/', {
        method: 'PATCH',
        body: JSON.stringify({ gpt_prompt: description }),
      })
      setSavedDescription(data.gpt_prompt || '')
    } catch (err) {
      setDescriptionError(err instanceof Error ? err.message : 'Nie udało się zapisać opisu.')
    } finally {
      setSavingDescription(false)
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)

      // Przez apiFetch, nie surowym fetch: token dostepu zyje 15 minut,
      // wiec wygasa w trakcie normalnej pracy. apiFetch potrafi go wymienic
      // i powtorzyc zadanie, surowy fetch odbilby sie z 401 -- i to akurat
      // na wgrywaniu pliku, ktore trzeba by robic od nowa.
      await apiFetch('/documents-upload/', { method: 'POST', body: formData })

      setFile(null)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wgrać dokumentu.')
    } finally {
      setUploading(false)
    }
  }

  async function odswiezZrodlo(id: number) {
    setOdswiezane(id)
    setSourceError('')
    try {
      await apiFetch(`/website-sources/${id}/recrawl/`, { method: 'POST' })
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nie udało się odświeżyć.')
    } finally {
      setOdswiezane(null)
    }
  }

  async function przelaczWyszukiwanie(doc: DocumentItem, wlaczony: boolean) {
    // Optymistycznie: kliknięcie ma być natychmiastowe, a przy błędzie wracamy
    setDocuments((poprzednie) =>
      poprzednie.map((d) => (d.id === doc.id ? { ...d, uzywaj_w_wyszukiwaniu: wlaczony } : d)),
    )
    setPrzelaczane(doc.id)
    try {
      await apiFetch(`/documents/${doc.id}/wyszukiwanie/`, {
        method: 'PATCH',
        body: JSON.stringify({ uzywaj_w_wyszukiwaniu: wlaczony }),
      })
    } catch {
      setDocuments((poprzednie) =>
        poprzednie.map((d) =>
          d.id === doc.id ? { ...d, uzywaj_w_wyszukiwaniu: !wlaczony } : d,
        ),
      )
    } finally {
      setPrzelaczane(null)
    }
  }

  async function handleAddSource(e: FormEvent) {
    e.preventDefault()
    if (!newUrl.trim()) return
    setAddingSource(true)
    setSourceError('')

    try {
      await apiFetch('/website-sources/', {
        method: 'POST',
        body: JSON.stringify({ url: newUrl.trim(), name: newUrl.trim() }),
      })
      setNewUrl('')
      await loadSources()
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nie udało się dodać strony.')
    } finally {
      setAddingSource(false)
    }
  }

  async function handleRemoveSource(id: number) {
    try {
      await apiFetch(`/website-sources/${id}/`, { method: 'DELETE' })
      await loadSources()
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nie udało się usunąć strony.')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Baza wiedzy</h1>
      <p className="tekst-drugi mb-8">
        Wszystko, na czym chatbot opiera odpowiedzi. Bez tych materiałów odmawia
        odpowiedzi na pytania o firmę — celowo, żeby ich nie zmyślać.
      </p>

      <h2 id="naglowek-opis" className="text-xl font-bold mb-1">Opis działalności</h2>
      <p className="text-sm tekst-slaby mb-3">
        Najważniejsze pole. Napisz własnymi słowami, czym zajmuje się firma, co oferuje
        i dla kogo. Bez tego bot nie odpowie nawet na „czym się zajmujecie?”.
      </p>

      <form onSubmit={handleSaveDescription} className="mb-10 max-w-2xl">
        {/* Nazwa pola plynie z widocznego naglowka sekcji, zamiast byc
            powtorzona w aria-label. Jedno zrodlo prawdy: gdy naglowek sie
            zmieni, czytnik ekranu uslyszy nowa nazwe bez osobnej poprawki. */}
        <textarea
          aria-labelledby="naglowek-opis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Np. Jesteśmy gabinetem kosmetycznym w Krakowie. Wykonujemy zabiegi na twarz, manicure i depilację laserową. Przyjmujemy pon-sob."
          className="input"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={savingDescription || description === savedDescription}
            className="btn-primary !py-2 !px-4 !text-sm"
          >
            {savingDescription ? 'Zapisywanie...' : 'Zapisz opis'}
          </button>
          {description !== savedDescription && (
            <span className="text-xs text-amber-600">Niezapisane zmiany</span>
          )}
        </div>
        {descriptionError && <p className="text-sm text-[#c0392b] mt-2">{descriptionError}</p>}
      </form>

      <h2 className="text-xl font-bold mb-1">Dokumenty</h2>
      <p className="text-sm tekst-slaby mb-4 max-w-2xl">
        Kolumna <strong>W wyszukiwaniu</strong> decyduje, czy bot korzysta z danej
        pozycji. Warto wyłączyć to, co nie zawiera faktów — sekcję kontaktową,
        politykę prywatności, stronę główną z samymi hasłami. Takie treści pasują
        „po trochu" do każdego pytania i wypychają z wyników fragmenty, które
        naprawdę odpowiadają.
        {/* Kluczowa różnica wobec usunięcia: dokument pobrany ze strony WWW wraca
            przy najbliższym odświeżeniu. Wyłączony zostaje wyłączony. */}
        {' '}Przy podstronach pobranych z Twojej witryny to jedyny trwały sposób —
        usunięta wróci przy następnym odświeżeniu treści.
      </p>

      <form onSubmit={handleUpload} className="flex items-center gap-3 mb-6">
        {/* Tutaj naglowek sekcji nie opisuje samego pola, tylko cala liste
            dokumentow -- nazwa musi wiec powiedziec, co ten przycisk robi. */}
        <input
          aria-label="Wybierz dokument do wgrania"
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          {uploading ? 'Wgrywanie...' : 'Wgraj dokument'}
        </button>
      </form>

      {error && <p className="text-sm text-[#c0392b] mb-4">{error}</p>}

      {/* Tabela przewija się sama — bez tego rozpychała całą stronę */}

      <div className="overflow-x-auto">

        <table className="w-full text-left text-sm mb-10 min-w-[34rem]">
        <thead>
          <tr className="border-b obramowanie tekst-slaby">
            <th className="py-2">Nazwa</th>
            <th className="py-2">Status</th>
            <th className="py-2">Fragmenty</th>
            <th className="py-2">Wgrano</th>
            <th className="py-2">W wyszukiwaniu</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b obramowanie">
              <td className="py-2">{doc.name}</td>
              <td className="py-2">{doc.status}</td>
              <td className="py-2">{doc.chunk_count}</td>
              <td className="py-2">{new Date(doc.uploaded_at).toLocaleString('pl-PL')}</td>
              <td className="py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doc.uzywaj_w_wyszukiwaniu}
                    disabled={przelaczane === doc.id}
                    onChange={(e) => przelaczWyszukiwanie(doc, e.target.checked)}
                    aria-label={`Używaj w wyszukiwaniu: ${doc.name}`}
                  />
                  <span className="text-xs tekst-slaby">
                    {doc.uzywaj_w_wyszukiwaniu ? 'używany' : 'pominięty'}
                  </span>
                </label>
              </td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 tekst-slaby">
                Brak wgranych dokumentów.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <h2 id="naglowek-strony" className="text-xl font-bold mb-4">Strony WWW</h2>
      <p className="text-sm tekst-slaby mb-3">
        Podaj adres strony klienta — treść zostanie automatycznie pobrana i dodana do wiedzy chatbota.
      </p>

      <form onSubmit={handleAddSource} className="flex items-center gap-3 mb-6">
        <input
          aria-labelledby="naglowek-strony"
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 max-w-md rounded border border-[color:var(--obramowanie-mocne)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!newUrl.trim() || addingSource}
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          {addingSource ? 'Dodawanie...' : 'Dodaj stronę'}
        </button>
      </form>

      {sourceError && <p className="text-sm text-[#c0392b] mb-4">{sourceError}</p>}

      {/* Tabela przewija się sama — bez tego rozpychała całą stronę */}

      <div className="overflow-x-auto">

        <table className="w-full text-left text-sm min-w-[34rem]">
        <thead>
          <tr className="border-b obramowanie tekst-slaby">
            <th className="py-2">URL</th>
            <th className="py-2">Status</th>
            <th className="py-2">Dodano</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-b obramowanie">
              <td className="py-2">{source.url}</td>
              <td className="py-2">{source.is_active ? 'Aktywna' : 'Wyłączona'}</td>
              <td className="py-2">{new Date(source.created_at).toLocaleString('pl-PL')}</td>
              <td className="py-2 text-right whitespace-nowrap">
                {/* Plan Start nie ma automatycznego odświeżania, więc to
                    jedyny sposób, żeby bot poznał zmiany na stronie */}
                <button
                  onClick={() => odswiezZrodlo(source.id)}
                  disabled={odswiezane === source.id}
                  className="text-xs tekst-slaby hover:text-[color:var(--akcent-tekst)] transition-colors mr-4 disabled:opacity-50"
                >
                  {odswiezane === source.id ? 'Odświeżam...' : 'Odśwież'}
                </button>
                <button
                  onClick={() => handleRemoveSource(source.id)}
                  className="text-[#c0392b] hover:underline"
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 tekst-slaby">
                Brak dodanych stron WWW.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
