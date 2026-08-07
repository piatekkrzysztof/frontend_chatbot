'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

export default function WidgetSettingsPage() {
  const [position, setPosition] = useState('right')
  const [color, setColor] = useState('#000000')
  const [title, setTitle] = useState('Chatbot')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiFetch('/widget-settings/mine/')
      .then((data) => {
        setPosition(data.widget_position)
        setColor(data.widget_color)
        setTitle(data.widget_title)
      })
      .catch((err) => setError(err.message))

    apiFetch('/accounts/me/')
      .then((data) => setApiKey(data.tenant_api_key || ''))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      await apiFetch('/widget-settings/mine/', {
        method: 'PATCH',
        body: JSON.stringify({
          widget_position: position,
          widget_color: color,
          widget_title: title,
        }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać ustawień.')
    } finally {
      setSaving(false)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const embedSnippet = apiKey && origin
    ? `<script src="${origin}/embed.js" data-key="${apiKey}" async></script>`
    : ''

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Widget czatu</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł widgetu</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kolor</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-20 rounded border border-gray-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pozycja</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="right">Prawa strona</option>
            <option value="left">Lewa strona</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Zapisano.</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-white font-medium disabled:opacity-50 w-fit"
        >
          {saving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </form>

      {embedSnippet && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Kod do wklejenia na Twoją stronę</h2>
          <pre className="bg-gray-900 text-gray-100 text-xs rounded p-4 overflow-x-auto">
            {embedSnippet}
          </pre>
        </div>
      )}
    </div>
  )
}
