'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch, API_URL, getToken } from '@/lib/api'

interface DocumentItem {
  id: number
  name: string
  processed: boolean
  uploaded_at: string
  chunk_count: number
  status: string
}

interface WebsiteSourceItem {
  id: number
  name: string
  url: string
  is_active: boolean
  created_at: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [sources, setSources] = useState<WebsiteSourceItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [sourceError, setSourceError] = useState('')

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
    loadDocuments()
    loadSources()
  }, [])

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)

      const res = await fetch(`${API_URL}/documents-upload/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Nie udało się wgrać dokumentu.')
      }

      setFile(null)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wgrać dokumentu.')
    } finally {
      setUploading(false)
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
      <h1 className="text-2xl font-bold mb-4">Dokumenty</h1>

      <form onSubmit={handleUpload} className="flex items-center gap-3 mb-6">
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white font-medium disabled:opacity-50"
        >
          {uploading ? 'Wgrywanie...' : 'Wgraj dokument'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <table className="w-full text-left text-sm mb-10">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Nazwa</th>
            <th className="py-2">Status</th>
            <th className="py-2">Fragmenty</th>
            <th className="py-2">Wgrano</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b border-gray-100">
              <td className="py-2">{doc.name}</td>
              <td className="py-2">{doc.status}</td>
              <td className="py-2">{doc.chunk_count}</td>
              <td className="py-2">{new Date(doc.uploaded_at).toLocaleString('pl-PL')}</td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-400">
                Brak wgranych dokumentów.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="text-xl font-bold mb-4">Strony WWW</h2>
      <p className="text-sm text-gray-500 mb-3">
        Podaj adres strony klienta — treść zostanie automatycznie pobrana i dodana do wiedzy chatbota.
      </p>

      <form onSubmit={handleAddSource} className="flex items-center gap-3 mb-6">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 max-w-md rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!newUrl.trim() || addingSource}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white font-medium disabled:opacity-50"
        >
          {addingSource ? 'Dodawanie...' : 'Dodaj stronę'}
        </button>
      </form>

      {sourceError && <p className="text-sm text-red-600 mb-4">{sourceError}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">URL</th>
            <th className="py-2">Status</th>
            <th className="py-2">Dodano</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-b border-gray-100">
              <td className="py-2">{source.url}</td>
              <td className="py-2">{source.is_active ? 'Aktywna' : 'Wyłączona'}</td>
              <td className="py-2">{new Date(source.created_at).toLocaleString('pl-PL')}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() => handleRemoveSource(source.id)}
                  className="text-red-600 hover:underline"
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-400">
                Brak dodanych stron WWW.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
