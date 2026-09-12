import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRevokedSession, odswiezSesje, pobierzToken, sessionIdentity, ustawToken, zapomnijToken } from '@/lib/auth'
import { securityMutation } from '@/lib/account-security'

let sequence = 1
const identity = () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`
const jwt = (sid: string) => 'header.' + btoa(JSON.stringify({ sid })) + '.signature'
const response = (data: object, status = 200) => ({ ok: status === 200, status, json: async () => data }) as Response
beforeEach(() => { zapomnijToken(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('account security transport and revocation', () => {
  it('refreshes first and never sends cookies, password URLs or a logout request for mutation', async () => {
    const token = jwt(identity())
    ustawToken(token)
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: token }))
      .mockResolvedValueOnce(response({ detail: 'OK', current_session_revoked: true }))
    const result = await securityMutation('/accounts/password-change/', { current_password: 'secret', new_password: 'new' })
    expect(result.local_session_ended).toBe(true)
    expect(pobierzToken()).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = vi.mocked(fetch).mock.calls[1]
    expect(url).toContain('/accounts/password-change/')
    expect(options).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { Authorization: `Bearer ${token}` } })
    expect(JSON.stringify(localStorage)).not.toContain(token)
    expect(JSON.stringify(localStorage)).not.toContain('secret')
  })

  it('does not replay a failed sensitive POST or log out after a 401', async () => {
    const token = jwt(identity()); ustawToken(token)
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: token })).mockResolvedValueOnce(response({ detail: 'Expired' }, 401))
    await expect(securityMutation('/accounts/password-change/', {})).rejects.toThrow('Expired')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(pobierzToken()).toBe(token)
  })

  it('refuses to mutate a different login returned by refresh', async () => {
    ustawToken(jwt(identity()))
    const other = jwt(identity())
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: other }))
    await expect(securityMutation('/accounts/password-change/', {})).rejects.toThrow('Sesja zmieniła')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(pobierzToken()).toBe(other)
  })

  it('a late successful response cannot clear a newer login', async () => {
    const old = jwt(identity()); const fresh = jwt(identity()); ustawToken(old)
    let release!: (value: Response) => void
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: old }))
      .mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const pending = securityMutation('/accounts/password-change/', {})
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    ustawToken(fresh)
    release(response({ detail: 'OK', current_session_revoked: true }))
    expect((await pending).local_session_ended).toBe(false)
    expect(pobierzToken()).toBe(fresh)
    ustawToken(old)
    expect(pobierzToken()).toBeNull()
  })

  it('a refresh completing after another tab revokes its session cannot restore access', async () => {
    const sid = identity(); const token = jwt(sid)
    let release!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const pending = odswiezSesje()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new StorageEvent('storage', { key: 'sm-art-session-revoked', newValue: JSON.stringify({ sid, event: 'synthetic' }) }))
    release(response({ access: token }))
    expect(await pending).toBeNull()
    expect(pobierzToken()).toBeNull()
  })

  it('ignores revocation of another login and malformed notifications', () => {
    const token = jwt(identity()); ustawToken(token)
    window.dispatchEvent(new StorageEvent('storage', { key: 'sm-art-session-revoked', newValue: '{bad' }))
    clearRevokedSession(identity())
    expect(pobierzToken()).toBe(token)
    expect(sessionIdentity('bad-token')).toBeNull()
  })

  it('deadline includes the mutation response body and never retries uncertain results', async () => {
    vi.useFakeTimers()
    const token = jwt(identity()); ustawToken(token)
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: token }))
      .mockImplementationOnce(async (_url, options) => ({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout')))) }) as Response)
    const pending = expect(securityMutation('/accounts/password-change/', {})).rejects.toThrow('mogła się wykonać')
    await vi.advanceTimersByTimeAsync(20_001)
    await pending
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(pobierzToken()).toBe(token)
  })

  it('a stalled preflight refresh body releases the session lock without sending a mutation', async () => {
    vi.useFakeTimers()
    const token = jwt(identity()); ustawToken(token)
    vi.mocked(fetch).mockImplementationOnce(async (_url, options) => ({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout')))) }) as Response)
    const pending = expect(securityMutation('/accounts/password-change/', {})).rejects.toThrow('Sesja zmieniła')
    await vi.advanceTimersByTimeAsync(20_001)
    await pending
    expect(fetch).toHaveBeenCalledTimes(1)
    const fresh = jwt(identity())
    vi.mocked(fetch).mockResolvedValueOnce(response({ access: fresh }))
    expect(await odswiezSesje()).toBe(fresh)
  })
})
