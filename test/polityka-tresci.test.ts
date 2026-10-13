/**
 * `upgrade-insecure-requests` tylko tam, gdzie jest TLS.
 *
 * 13.10.2026: testy wylogowania padaly lokalnie co drugi raz. Po wylogowaniu
 * panel dociaga w tle chronione ekrany, middleware odsyla je na
 * http://localhost/login, a przegladarka z ta dyrektywa przepisuje adres na
 * https://localhost, gdzie nic nie slucha - i przerywa przy tym przejscie na
 * strone logowania. Produkcja (https) ma dyrektywe zachowac.
 */
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'

function polityka(adres: string) {
  return proxy(new NextRequest(adres)).headers.get('Content-Security-Policy') ?? ''
}

describe('polityka tresci a TLS', () => {
  it('produkcja podnosi zapytania do https', () => {
    expect(polityka('https://panel.agencjasm-art.pl/login')).toContain('upgrade-insecure-requests')
  })

  it.each(['http://localhost:3100/login', 'http://127.0.0.1:3000/login', 'http://[::1]:3100/login'])(
    'lokalnie bez podnoszenia: %s',
    (adres) => {
      const naglowek = polityka(adres)
      expect(naglowek).toContain("default-src 'self'")
      expect(naglowek).not.toContain('upgrade-insecure-requests')
    },
  )
})
