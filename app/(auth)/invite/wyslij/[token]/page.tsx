'use client'

/**
 * Link do przekazania z panelu: wysyla zaproszenie na wlasciwy adres.
 *
 * Wlasciciel kopiuje go wtedy, gdy poczta zawiodla, i przesyla czatem, SMS-em
 * albo wpisuje do wspolnych notatek. Dlatego ten link nie zaklada konta - do
 * 2.20.0 zakladal, i kto go mial, zostawal pracownikiem. Teraz umie jedno:
 * wyslac zaproszenie na adres, na ktory je wystawiono. Konto zaklada dopiero
 * link z tej wiadomosci, czyli ktos, kto ma dostep do tamtej skrzynki.
 *
 * Strona celowo nie mowi, na jaki adres. Odpowiada kazdemu, kto ma link.
 */

import { useState, use } from 'react'
import { API_URL } from '@/lib/api'

type Stan = 'gotowe' | 'wysylanie' | 'wyslane' | 'blad'

export default function WyslijZaproszeniePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [stan, setStan] = useState<Stan>('gotowe')
  const [komunikat, setKomunikat] = useState('')

  async function wyslij() {
    setStan('wysylanie')
    setKomunikat('')
    try {
      const res = await fetch(`${API_URL}/accounts/invitations/wyslij/${token}/`, {
        method: 'POST',
      })
      const dane = await res.json().catch(() => ({}))
      if (res.status === 202) {
        setStan('wyslane')
        return
      }
      // 404 i 410 maja wlasne, polskie zdania z backendu: mowia, co zrobic.
      setKomunikat(
        String(
          dane.detail ||
            (res.status === 429
              ? 'Za dużo prób. Spróbuj za chwilę.'
              : 'Nie udało się wysłać zaproszenia.'),
        ),
      )
      setStan('blad')
    } catch {
      setKomunikat('Nie udało się połączyć z serwerem. Spróbuj za chwilę.')
      setStan('blad')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-espresso-700 px-4">
      <div className="w-full max-w-sm rounded-lg bg-espresso-800 p-6 shadow">
        <h1 className="text-xl font-bold mb-2">Zaproszenie do zespołu</h1>

        {stan === 'wyslane' ? (
          <p role="status" className="text-sm text-sand-300">
            Wysłaliśmy zaproszenie na adres, na który zostało wystawione. Otwórz link z tej
            wiadomości, żeby założyć konto. Nic nie przyszło? Sprawdź folder ze spamem albo
            poproś osobę zapraszającą o sprawdzenie adresu.
          </p>
        ) : (
          <>
            <p className="text-sm text-sand-300 mb-5">
              Ten link nie zakłada konta. Wyśle zaproszenie na adres, na który zostało
              wystawione - konto założysz z linku w tej wiadomości.
            </p>

            {stan === 'blad' && (
              <p role="alert" className="text-sm text-rose-400 mb-4">
                {komunikat}
              </p>
            )}

            <button
              type="button"
              onClick={wyslij}
              disabled={stan === 'wysylanie'}
              className="btn-primary w-full !py-2 !text-sm"
            >
              {stan === 'wysylanie' ? 'Wysyłanie...' : 'Wyślij mi zaproszenie'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
