import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { odswiezSesje, pobierzToken, ustawToken, wyloguj, zapomnijToken } from '@/lib/auth'
import { sessionRequest, withSessionLock } from '@/lib/session-lock'

function response(status: number, access = 'new-access') {
  return { status, ok: status === 200, json: async () => ({ access }) } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  zapomnijToken()
  vi.unstubAllGlobals()
})

it('a refresh response cannot resurrect a logged-out session', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(response(200))
  ustawToken('old-access')
  const refresh = odswiezSesje()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const logout = wyloguj()
  expect(pobierzToken()).toBeNull()
  expect(await odswiezSesje()).toBeNull()
  finish(response(200))
  expect(await refresh).toBeNull()
  await logout
  expect(pobierzToken()).toBeNull()
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('/logout/')
})

it('a late refresh cannot overwrite a newly logged-in account', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const refresh = odswiezSesje()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  ustawToken('other-account')
  finish(response(200, 'previous-account'))
  expect(await refresh).toBeNull()
  expect(pobierzToken()).toBe('other-account')
})

it('a logout from another tab invalidates an in-flight response', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const refresh = odswiezSesje()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  // Storage is visible before a delayed storage event is delivered.
  localStorage.setItem('sm-art-session-logout', 'logout-from-another-tab')
  finish(response(200))
  expect(await refresh).toBeNull()
  expect(pobierzToken()).toBeNull()
})

it('retries a conflict once using the current cookie', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response(409)).mockResolvedValueOnce(response(200))
  expect(await odswiezSesje()).toBe('new-access')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(vi.mocked(fetch).mock.calls[1][1]?.credentials).toBe('include')
})

it('never loops on a consumed cookie', async () => {
  vi.mocked(fetch).mockResolvedValue(response(409))
  expect(await odswiezSesje()).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('all operations use the same browser lock', async () => {
  const request = vi.fn(async (_name: string, _options: unknown, operation: () => Promise<unknown>) => operation())
  vi.stubGlobal('navigator', { locks: { request } })
  expect(await withSessionLock(async () => 'first')).toBe('first')
  expect(await withSessionLock(async () => 'second')).toBe('second')
  expect(request.mock.calls.map(call => call[0])).toEqual(['sm-art-panel-session', 'sm-art-panel-session'])
})

it('login waits for an old refresh before changing the shared cookie', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(response(200, 'new-account'))
  const refresh = odswiezSesje()
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const login = sessionRequest('/accounts/login/', { method: 'POST' })
  expect(fetch).toHaveBeenCalledTimes(1)
  finish(response(200, 'old-account'))
  await refresh
  await login
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('a failed browser lock does not leave refresh permanently pending', async () => {
  vi.stubGlobal('navigator', { locks: { request: vi.fn().mockRejectedValue(new Error('lock unavailable')) } })
  expect(await odswiezSesje()).toBeNull()
  expect(await odswiezSesje()).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
