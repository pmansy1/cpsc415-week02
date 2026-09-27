import { test, expect, type Route } from '@playwright/test'

// Mocked SSE body returned by page.route() in place of OpenRouter.
function sseChunks(events: Array<Record<string, unknown>>): string {
  return events
    .map((e) => `data: ${JSON.stringify(e)}\n\n`)
    .join('') + 'data: [DONE]\n\n'
}

async function mockOpenRouter(route: Route) {
  const body = sseChunks([
    { choices: [{ delta: { content: 'Hello' } }] },
    { choices: [{ delta: { content: ', ' } }] },
    { choices: [{ delta: { content: 'world' } }] },
    {
      choices: [],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5, cost: 0.001 },
    },
  ])
  await route.fulfill({
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    body,
  })
}

test.beforeEach(async ({ context }) => {
  // Playwright creates a fresh BrowserContext per test, which means fresh
  // localStorage and IndexedDB origins. No need to clear before navigation.
  // Critically, do NOT addInitScript() to wipe storage — that runs on every
  // page load, including a deliberate reload() inside a test, and would
  // destroy the state the test is trying to persist.
  await context.clearCookies()
})

test.describe('intent success criteria', () => {
  test('1. type a message, see a streamed reply from an OpenRouter model', async ({ page }) => {
    await page.route('**/api/v1/chat/completions', mockOpenRouter)

    await page.goto('/')
    // First-run: paste a key.
    await page.getByLabel(/api key/i).fill('e2e-test-key')
    await page.getByRole('button', { name: /save/i }).click()

    const composer = page.getByRole('textbox', { name: /message/i })
    await expect(composer).toBeVisible()
    await composer.fill('Hi')
    await composer.press('Enter')

    // Streamed reply accumulates in the assistant bubble.
    await expect(page.getByText('Hello, world')).toBeVisible({ timeout: 5_000 })

    // Tokens + cost render after finalize.
    await expect(page.getByText(/5 tok/)).toBeVisible()
    await expect(page.getByText(/\$0\.001000/)).toBeVisible()
  })

  test('2. API key persists across a hard reload', async ({ page }) => {
    await page.route('**/api/v1/chat/completions', mockOpenRouter)

    await page.goto('/')
    await page.getByLabel(/api key/i).fill('persisted-key')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible()

    await page.reload()

    // The composer should be visible (key still in localStorage); the
    // first-run API-key panel should NOT be visible.
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /paste your openrouter api key/i })).toHaveCount(0)
  })

  test('3. conversations persist across a reload and the thread is restored', async ({ page }) => {
    await page.route('**/api/v1/chat/completions', mockOpenRouter)

    await page.goto('/')
    await page.getByLabel(/api key/i).fill('e2e-test-key')
    await page.getByRole('button', { name: /save/i }).click()

    const composer = page.getByRole('textbox', { name: /message/i })
    await composer.fill('Hi')
    await composer.press('Enter')
    await expect(page.getByText('Hello, world')).toBeVisible({ timeout: 5_000 })

    // Sidebar shows the conversation (title derived from first user message).
    await expect(page.getByRole('button', { name: 'Hi' })).toBeVisible()

    await page.reload()

    // Conversation still in the sidebar.
    await expect(page.getByRole('button', { name: 'Hi' })).toBeVisible()
    // Click it to restore the thread; the assistant reply is still there.
    await page.getByRole('button', { name: 'Hi' }).click()
    await expect(page.getByText('Hello, world')).toBeVisible()
    await expect(page.getByText(/5 tok/)).toBeVisible()
    await expect(page.getByText(/\$0\.001000/)).toBeVisible()
  })
})
