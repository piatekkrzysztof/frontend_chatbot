'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'

export default function WidgetSettingsPage() {
  const [brandingMode, setBrandingMode] = useState<'smart' | 'white_label'>('smart')
  const [position, setPosition] = useState('right')
  const [color, setColor] = useState('#000000')
  const [title, setTitle] = useState('Chatbot')
  const [footerText, setFooterText] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiFetch('/widget-settings/mine/')
      .then((data) => {
        setBrandingMode(data.branding_mode || 'smart')
        setPosition(data.widget_position)
        setColor(data.widget_color)
        setTitle(data.widget_title)
        setFooterText(data.widget_footer_text || '')
        setLogoUrl(data.widget_logo)
        setAvatarUrl(data.widget_avatar)
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
      const formData = new FormData()
      formData.append('branding_mode', brandingMode)
      formData.append('widget_position', position)
      formData.append('widget_color', color)
      formData.append('widget_title', title)
      formData.append('widget_footer_text', footerText)
      if (logoFile) formData.append('widget_logo', logoFile)
      if (avatarFile) formData.append('widget_avatar', avatarFile)

      const data = await apiFetch('/widget-settings/mine/', {
        method: 'PATCH',
        body: formData,
      })
      setLogoUrl(data.widget_logo)
      setAvatarUrl(data.widget_avatar)
      setLogoFile(null)
      setAvatarFile(null)
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Branding</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="branding_mode"
                checked={brandingMode === 'smart'}
                onChange={() => setBrandingMode('smart')}
              />
              Smart — domyślna marka
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="branding_mode"
                checked={brandingMode === 'white_label'}
                onChange={() => setBrandingMode('white_label')}
              />
              White-label — własna marka
            </label>
          </div>
        </div>

        {brandingMode === 'white_label' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa widgetu</label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              {logoUrl && !logoFile && (
                // Plik wgrany przez klienta, serwowany przez backend/S3 — optymalizacja
                // next/image wymagałaby listy dozwolonych domen i nic tu nie wnosi.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Aktualne logo" className="h-8 mb-2" />
              )}
              <input
                type="file"
                accept="image/*,.svg"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Awatar bota</label>
              {avatarUrl && !avatarFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Aktualny awatar" className="h-8 w-8 rounded-full mb-2" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stopka widgetu</label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="np. Umów wizytę"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </>
        )}

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
