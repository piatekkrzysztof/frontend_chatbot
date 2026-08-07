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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function loadDocuments() {
    try {
      const data = await apiFetch('/documents/')
      setDocuments(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać listy dokumentów.')
    }
  }

  useEffect(() => {
    loadDocuments()
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dokumenty</h1>

      <form onSubmit={handleUpload} className="flex items-center gap-3 mb-6">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
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

      <table className="w-full text-left text-sm">
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
    </div>
  )
}
