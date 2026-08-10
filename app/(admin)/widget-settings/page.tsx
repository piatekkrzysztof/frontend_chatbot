'use client'

import { useEffect, useState, FormEvent } from 'react'
import { apiFetch } from '@/lib/api'
import WidgetPreview from '@/components/widget/WidgetPreview'

// Lista musi odpowiadać WIDGET_LANGUAGES w accounts/models.py — backend
// odrzuca kody spoza swojego słownika i cicho wraca do domyślnego.
const JEZYKI = [
  { kod: 'pl', nazwa: 'Polski' },
  { kod: 'en', nazwa: 'Angielski' },
  { kod: 'uk', nazwa: 'Ukraiński' },
  { kod: 'de', nazwa: 'Niemiecki' },
  { kod: 'ru', nazwa: 'Rosyjski' },
  { kod: 'cs', nazwa: 'Czeski' },
]

export default function WidgetSettingsPage() {
  const [brandingMode, setBrandingMode] = useState<'smart' | 'white_label'>('smart')
  const [position, setPosition] = useState('right')
  const [color, setColor] = useState('#000000')
  const [title, setTitle] = useState('Chatbot')
  const [footerText, setFooterText] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [suggestedQuestions, setSuggestedQuestions] = useState('')
  const [languages, setLanguages] = useState<string[]>(['pl'])
  const [languageMode, setLanguageMode] = useState<'fixed' | 'auto'>('auto')
  const [defaultLanguage, setDefaultLanguage] = useState('pl')
  const [proactiveEnabled, setProactiveEnabled] = useState(false)
  const [proactiveDelay, setProactiveDelay] = useState(30)
  const [proactiveTexts, setProactiveTexts] = useState<Record<string, string>>({})
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
        setWelcomeMessage(data.widget_welcome_message || '')
        setSuggestedQuestions((data.widget_suggested_questions || []).join('\n'))
        // Bez tego formularz zawsze startuje z samym polskim, a zapis
        // po cichu kasuje pozostałe języki ustawione wcześniej
        setLanguages(data.widget_languages?.length ? data.widget_languages : ['pl'])
        setLanguageMode(data.widget_language_mode === 'fixed' ? 'fixed' : 'auto')
        setDefaultLanguage(data.widget_default_language || 'pl')
        setProactiveEnabled(Boolean(data.widget_proactive_enabled))
        setProactiveDelay(Number(data.widget_proactive_delay_seconds) || 30)
        setProactiveTexts(data.widget_proactive_texts || {})
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
      formData.append('widget_welcome_message', welcomeMessage)
      formData.append('widget_suggested_questions', suggestedQuestions)
      formData.append('widget_languages', languages.join(','))
      formData.append('widget_language_mode', languageMode)
      formData.append('widget_default_language', defaultLanguage)
      formData.append('widget_proactive_enabled', String(proactiveEnabled))
      formData.append('widget_proactive_delay_seconds', String(proactiveDelay))
      // Backend przyjmuje słownik również jako tekst — formularz jest multipart,
      // bo w tym samym żądaniu lecą logo i awatar
      formData.append('widget_proactive_texts', JSON.stringify(proactiveTexts))
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
  // data-api jest potrzebne wiadomości proaktywnej: embed.js pobiera ją sam,
  // zanim powstanie ramka czatu — inaczej trzeba by ładować cały widget na
  // każdej podstronie klienta i leniwe ładowanie traciłoby sens.
  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''
  const embedSnippet = apiKey && origin
    ? `<script src="${origin}/embed.js" data-key="${apiKey}" data-api="${apiBase}" async></script>`
    : ''

  // Podgląd rysujemy z niezapisanych plików, żeby efekt było widać od razu
  const previewLogo = logoFile ? URL.createObjectURL(logoFile) : logoUrl
  const previewAvatar = avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Widget czatu</h1>
      <p className="text-gray-600 mb-6">
        Podgląd po prawej pokazuje, co zobaczy odwiedzający — zmiany widać od razu,
        jeszcze przed zapisaniem.
      </p>

      <div className="flex flex-wrap items-start gap-10">
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

        {/* Wspólne dla obu wariantów brandingu — dotyczą treści, nie wyglądu */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wiadomość powitalna
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Pierwsze, co widzi odwiedzający po otwarciu czatu. Zostaw puste, żeby okno
            otwierało się bez powitania.
          </p>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={2}
            placeholder="Cześć! W czym mogę pomóc?"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proponowane pytania
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Po jednym w wierszu, pokażemy do czterech. Klikalne od razu po otwarciu czatu —
            odwiedzający nie musi wymyślać pierwszego pytania.
          </p>
          <textarea
            value={suggestedQuestions}
            onChange={(e) => setSuggestedQuestions(e.target.value)}
            rows={4}
            placeholder={`Jakie macie godziny otwarcia?
Ile kosztuje usługa?
Gdzie was znaleźć?`}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Języki odpowiedzi
          </label>
          <div className="flex flex-col gap-2 mb-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="language_mode"
                className="mt-1"
                checked={languageMode === 'fixed'}
                onChange={() => setLanguageMode('fixed')}
              />
              <span>
                Zawsze jeden język
                <span className="block text-xs text-gray-500">
                  Bot odpowiada wybranym językiem niezależnie od tego, w jakim
                  języku napisano pytanie.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="language_mode"
                className="mt-1"
                checked={languageMode === 'auto'}
                onChange={() => setLanguageMode('auto')}
              />
              <span>
                Dopasuj do języka pytania
                <span className="block text-xs text-gray-500">
                  Bot rozpozna język pytania i odpowie w nim — ale tylko w obrębie
                  zaznaczonych niżej.
                </span>
              </span>
            </label>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {languageMode === 'fixed' ? 'Język odpowiedzi' : 'Język zapasowy'}
            </label>
            <p className="text-xs text-gray-500 mb-1">
              {languageMode === 'fixed'
                ? 'Jedyny język, w którym bot będzie odpowiadał.'
                : 'Użyjemy go, gdy pytanie przyjdzie w języku spoza zaznaczonych.'}
            </p>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {JEZYKI.map((jezyk) => (
                <option key={jezyk.kod} value={jezyk.kod}>{jezyk.nazwa}</option>
              ))}
            </select>
          </div>

          {languageMode === 'auto' && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-gray-500">
                Zaznaczaj wyłącznie te, które obsłużysz, gdy odwiedzający poprosi
                o kontakt z człowiekiem — inaczej obiecujesz obsługę, której nie ma.
              </p>
              {JEZYKI.map((jezyk) => {
                const zaznaczony = languages.includes(jezyk.kod)
                const jedyny = zaznaczony && languages.length === 1
                return (
                  <label key={jezyk.kod} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={zaznaczony}
                      // Odznaczenie ostatniego zostawiłoby bota bez języka
                      disabled={jedyny}
                      onChange={(e) =>
                        setLanguages((poprzednie) =>
                          e.target.checked
                            ? [...poprzednie, jezyk.kod]
                            : poprzednie.filter((k) => k !== jezyk.kod),
                        )
                      }
                    />
                    {jezyk.nazwa}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              checked={proactiveEnabled}
              onChange={(e) => setProactiveEnabled(e.target.checked)}
            />
            Zaczepka dla odwiedzającego
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Dymek pokazywany sam z siebie, gdy ktoś jest na stronie dłuższą chwilę
            i nie zaczął rozmowy. To gotowy tekst, nie odpowiedź AI — nie zużywa
            limitu wiadomości z Twojego planu.
          </p>

          {proactiveEnabled && (
            <>
              <div className="mb-3">
                <label className="block text-sm text-gray-700 mb-1">
                  Pokaż po (sekundy)
                </label>
                <input
                  type="number"
                  min={0}
                  value={proactiveDelay}
                  onChange={(e) => setProactiveDelay(Number(e.target.value))}
                  className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <p className="text-xs text-gray-500 mb-2">
                Wersję dobierzemy automatycznie do języka strony (atrybut
                <code className="mx-1">lang</code> w kodzie Twojej witryny), więc na
                anglojęzycznej podstronie pokaże się wersja angielska. Wypełnij te
                języki, które faktycznie masz na stronie — resztę zostaw pustą.
              </p>
              <div className="flex flex-col gap-2">
                {JEZYKI.map((jezyk) => (
                  <div key={jezyk.kod}>
                    <label className="block text-xs text-gray-600 mb-1">
                      {jezyk.nazwa}
                      {jezyk.kod === defaultLanguage && ' — domyślny'}
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={proactiveTexts[jezyk.kod] || ''}
                      onChange={(e) =>
                        setProactiveTexts((poprzednie) => ({
                          ...poprzednie,
                          [jezyk.kod]: e.target.value,
                        }))
                      }
                      placeholder={
                        jezyk.kod === 'pl' ? 'Cześć! Pomóc w czymś?' : ''
                      }
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
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

      <div className="sticky top-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Podgląd</p>
        <WidgetPreview
          brandingMode={brandingMode}
          color={color}
          title={title}
          footerText={footerText}
          welcomeMessage={welcomeMessage}
          suggestedQuestions={suggestedQuestions.split('\n')}
          logoUrl={previewLogo}
          avatarUrl={previewAvatar}
        />
      </div>
      </div>

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
