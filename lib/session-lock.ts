/** Serialize cookie rotation across same-origin tabs without storing any JWT. */
let localQueue: Promise<unknown> = Promise.resolve()

export function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    return navigator.locks.request('sm-art-panel-session', { signal: controller.signal }, operation)
      .finally(() => clearTimeout(timer))
  }
  // Older browsers still serialize operations in this tab. The backend rejects
  // duplicate consumption and the caller retries a conflict at most once.
  const pending = localQueue.then(operation, operation)
  localQueue = pending.catch(() => undefined)
  return pending
}

export async function fetchWithSessionTimeout(url: string, options: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally { clearTimeout(timer) }
}

/** Login also mutates the shared cookie, so it must not race an old refresh. */
export function sessionRequest(url: string, options: RequestInit) {
  return withSessionLock(() => fetchWithSessionTimeout(url, options))
}
