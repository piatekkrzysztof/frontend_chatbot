import { expect, test, type Page } from '@playwright/test'
import { podstawBackend, zalogowany, TOKEN_DOSTEPU } from './atrapa'

async function requireAccess(page: Page) {
  await podstawBackend(page)
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/accounts/token/refresh/') &&
        !route.request().url().includes('/accounts/logout/') &&
        !route.request().headers()['authorization']) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    }
    return route.fallback()
  })
}

test('two tabs serialize real refresh requests with Web Locks', async ({ page, context }) => {
  await zalogowany(context)
  const other = await context.newPage()
  await requireAccess(page)
  await requireAccess(other)
  let count = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  for (const tab of [page, other]) {
    await tab.route('**/accounts/token/refresh/', async route => {
      count += 1
      if (count === 1) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: TOKEN_DOSTEPU }) })
    })
  }
  try {
    await Promise.all([page.goto('/dashboard'), other.goto('/dashboard')])
    await expect.poll(() => count).toBe(1)
    await expect.poll(() => other.evaluate(async () => (await navigator.locks.query()).pending?.length)).toBe(1)
    expect(count).toBe(1)
    release()
    await expect.poll(() => count).toBe(2)
    await expect(page.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
    await expect(other.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
  } finally { release() }
})

test('logout clears the other tab without storing credentials', async ({ page, context }) => {
  await zalogowany(context)
  const other = await context.newPage()
  await requireAccess(page)
  await requireAccess(other)
  await Promise.all([page.goto('/dashboard'), other.goto('/dashboard')])
  await expect(other.getByRole('button', { name: /Wyloguj/i })).toBeVisible()
  await page.getByRole('button', { name: /Wyloguj/i }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(other).toHaveURL(/\/login\?wygasla=1/)
  const storage = await other.evaluate(() => JSON.stringify(localStorage))
  expect(storage).not.toContain(TOKEN_DOSTEPU)
  expect(storage).not.toContain('refresh_token')
})
