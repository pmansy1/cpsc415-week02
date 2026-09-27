import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { setApiKey, clearApiKey } from './storage/local'
import { openDb } from './storage/idb'

// Build a fake SSE Response whose body streams the supplied events.
function sseResponse(events: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

describe('App integration: send → stream → finalize', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    localStorage.clear()
    const db = await openDb()
    await db.clear('conversations')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearApiKey()
  })

  it('renders the API-key panel when no key is stored, then the chat after one is set', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /paste your openrouter api key/i })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/api key/i), 'sk-test')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()
    })
  })

  it('persists the key across reloads via SettingsContext', async () => {
    setApiKey('persisted')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()
    })
    // The API-key panel must NOT be visible.
    expect(screen.queryByRole('heading', { name: /paste your openrouter api key/i })).toBeNull()
  })

  it('streams deltas, appends them to the assistant bubble, and shows tokens/cost after finalize', async () => {
    setApiKey('sk-test')
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ', ' } }] },
        { choices: [{ delta: { content: 'world' } }] },
        {
          choices: [],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5, cost: 0.001 },
        },
      ]),
    )

    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')

    // Streamed content eventually accumulates.
    await waitFor(() => {
      expect(screen.getByText('Hello, world')).toBeInTheDocument()
    })
    // Tokens + cost appear once the final usage chunk fires.
    await waitFor(() => {
      expect(screen.getByText(/5 tok/i)).toBeInTheDocument()
      expect(screen.getByText(/\$0\.001000/)).toBeInTheDocument()
    })
  })

  it('calls fetch with the expected OpenRouter URL, headers, and body', async () => {
    setApiKey('sk-test')
    fetchMock.mockResolvedValueOnce(sseResponse([]))
    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'What up')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-test')
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-Title']).toBe('chat-client')
    const body = JSON.parse(init.body as string)
    expect(body.stream).toBe(true)
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What up' })
  })

  it('shows the ErrorBanner with kind:"auth" on a 401 response', async () => {
    setApiKey('bad')
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/api key rejected/i)
  })

  it('shows the ErrorBanner with kind:"rate_limit" on a 429 response', async () => {
    setApiKey('sk-test')
    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }))
    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/rate limited/i)
  })

  it('shows the ErrorBanner with kind:"network" on a fetch rejection', async () => {
    setApiKey('sk-test')
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))
    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/network/i)
  })

  it('Retry deletes the partial assistant and re-streams the same context', async () => {
    setApiKey('sk-test')
    // First call: fail mid-stream (network error after partial content).
    fetchMock.mockImplementationOnce((_url, _init) => {
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"half"}}]}\n\n'))
          controller.error(new TypeError('stream broke'))
        },
      })
      return Promise.resolve(new Response(body, { status: 200 }))
    })
    // Second call (the retry): succeed.
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { choices: [{ delta: { content: 'rewritten' } }] },
        {
          choices: [],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.0001 },
        },
      ]),
    )

    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    // The retry's response replaces the partial content and shows usage.
    await waitFor(() => {
      expect(screen.getByText('rewritten')).toBeInTheDocument()
      expect(screen.getByText(/2 tok/)).toBeInTheDocument()
      expect(screen.getByText(/\$0\.000100/)).toBeInTheDocument()
    })
    expect(screen.queryByText('half')).not.toBeInTheDocument()
  })

  it('does nothing on Retry when there is no incomplete message', async () => {
    setApiKey('sk-test')
    render(<App />)
    // No error has occurred → no Retry button.
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('sends a second message in the existing active conversation with prior context', async () => {
    setApiKey('sk-test')
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { choices: [{ delta: { content: 'First reply' } }] },
        { choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.0001 } },
      ]),
    )
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { choices: [{ delta: { content: 'Second reply' } }] },
        { choices: [], usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4, cost: 0.0002 } },
      ]),
    )

    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'First message')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('First reply')).toBeInTheDocument()
      expect(textarea).toBeEnabled()
    })

    await userEvent.type(textarea, 'Second message')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Second reply')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, secondInit] = fetchMock.mock.calls[1]
    const secondBody = JSON.parse(secondInit.body as string)
    expect(secondBody.messages).toHaveLength(3)
    expect(secondBody.messages[0]).toEqual({ role: 'user', content: 'First message' })
    expect(secondBody.messages[1]).toEqual({ role: 'assistant', content: 'First reply' })
    expect(secondBody.messages[2]).toEqual({ role: 'user', content: 'Second message' })
  })

  it('creates a new conversation when "+ New chat" is clicked in the sidebar', async () => {
    setApiKey('sk-test')
    render(<App />)

    const newChatBtn = await screen.findByRole('button', { name: /\+ new chat/i })
    await userEvent.click(newChatBtn)

    await waitFor(() => {
      const items = screen.getAllByRole('button', { name: 'New chat' })
      expect(items.length).toBeGreaterThan(0)
    })
  })

  it('does not display ErrorBanner when a stream is intentionally aborted', async () => {
    setApiKey('sk-test')
    const abortErr = new Error('aborted')
    abortErr.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortErr)

    render(<App />)
    const textarea = await screen.findByRole('textbox', { name: /message/i })
    await userEvent.type(textarea, 'Hi')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(textarea).toBeEnabled()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('allows editing the API key from the chat view header', async () => {
    setApiKey('sk-initial')
    render(<App />)
    const keyBtn = await screen.findByRole('button', { name: /api key/i })
    await userEvent.click(keyBtn)

    expect(screen.getByRole('heading', { name: /paste your openrouter api key/i })).toBeInTheDocument()
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelBtn)

    // Returned to chat
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()

    // Now open again and save a new key
    await userEvent.click(screen.getByRole('button', { name: /api key/i }))
    await userEvent.type(screen.getByLabelText(/api key/i), 'sk-new')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()
  })
})
