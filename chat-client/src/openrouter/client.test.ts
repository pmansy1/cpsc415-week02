import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamChat } from './client'

// Build a fake Response whose body is a stream of SSE `data: ...\n\n` chunks.
function sseResponse(chunks: string[], init: { status?: number } = {}): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status: init.status ?? 200 })
}

function parseSSE(chunks: Array<Record<string, unknown>>): string {
  return chunks
    .map((c) => `data: ${JSON.stringify(c)}\n\n`)
    .join('') + 'data: [DONE]\n\n'
}

describe('streamChat', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to the OpenRouter chat completions endpoint with required headers', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([]))
    await streamChat({
      apiKey: 'sk-test',
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: () => {},
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-test')
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-Title']).toBe('chat-client')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sends a body with stream:true and the supplied model + messages', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([]))
    await streamChat({
      apiKey: 'sk-test',
      model: 'm',
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: () => {},
    })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.stream).toBe(true)
    expect(body.model).toBe('m')
    expect(body.messages).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ])
  })

  it('dispatches onDelta once per content chunk', async () => {
    const deltas: string[] = []
    const chunks = parseSSE([
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ', ' } }] },
      { choices: [{ delta: { content: 'world' } }] },
    ])
    fetchMock.mockResolvedValueOnce(sseResponse([chunks]))

    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onUsage: () => {},
      onError: () => {},
    })
    expect(deltas).toEqual(['Hello', ', ', 'world'])
  })

  it('dispatches onUsage with the final usage chunk, including cost', async () => {
    let usage: { prompt: number; completion: number; total: number; costUsd: number } | null = null
    const chunks = parseSSE([
      { choices: [{ delta: { content: 'hi' } }] },
      {
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8, cost: 0.001234 },
      },
    ])
    fetchMock.mockResolvedValueOnce(sseResponse([chunks]))

    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: (u) => {
        usage = u
      },
      onError: () => {},
    })
    expect(usage).toEqual({ prompt: 5, completion: 3, total: 8, costUsd: 0.001234 })
  })

  it('skips chunks without content and without usage', async () => {
    const deltas: string[] = []
    let usageCalls = 0
    const chunks = parseSSE([
      { choices: [{ delta: { role: 'assistant' } }] }, // no content
      { choices: [{ delta: {} }] }, // empty delta
      { choices: [{ delta: { content: 'real' } }] },
    ])
    fetchMock.mockResolvedValueOnce(sseResponse([chunks]))

    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onUsage: () => {
        usageCalls++
      },
      onError: () => {},
    })
    expect(deltas).toEqual(['real'])
    expect(usageCalls).toBe(0)
  })

  it('invokes onError with kind:"auth" on a 401 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
    let caught: unknown = null
    await streamChat({
      apiKey: 'bad',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'auth' })
  })

  it('invokes onError with kind:"rate_limit" on a 429 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }))
    let caught: unknown = null
    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'rate_limit' })
  })

  it('invokes onError with kind:"network" when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))
    let caught: unknown = null
    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'network' })
  })

  it('invokes onError with kind:"aborted" when the signal is aborted mid-stream', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    let abortedListener: (() => void) | null = null
    fetchMock.mockImplementationOnce((_url, init) => {
      const sig = (init as RequestInit).signal as AbortSignal
      abortedListener = () => sig.dispatchEvent(new Event('aborted'))
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          // Emit one chunk, then wait for abort before closing.
          c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
          const interval = setInterval(() => {
            if (sig.aborted) {
              clearInterval(interval)
              c.error(new DOMException('aborted', 'AbortError'))
            }
          }, 5)
        },
      })
      return Promise.resolve(new Response(body, { status: 200 }))
    })

    let caught: unknown = null
    const p = streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: controller.signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    // Schedule an abort shortly after the first chunk.
    setTimeout(() => controller.abort(), 20)
    await p

    expect(caught).toMatchObject({ kind: 'aborted' })
    expect(abortedListener).not.toBeNull()
  })

  it('invokes onError with kind:"auth" on a 403 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
    let caught: unknown = null
    await streamChat({
      apiKey: 'bad',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'auth', status: 403 })
  })

  it('invokes onError with kind:"network" on unexpected HTTP status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('server error', { status: 500 }))
    let caught: unknown = null
    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'network', message: 'unexpected status 500' })
  })

  it('invokes onError with kind:"network" when response.body is null', async () => {
    const res = new Response(null, { status: 200 })
    Object.defineProperty(res, 'body', { value: null })
    fetchMock.mockResolvedValueOnce(res)
    let caught: unknown = null
    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'network', message: 'empty response body' })
  })

  it('invokes onError with kind:"aborted" when fetch rejects with AbortError', async () => {
    const abortErr = new Error('abort')
    abortErr.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortErr)
    let caught: unknown = null
    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: () => {},
      onUsage: () => {},
      onError: (e) => {
        caught = e
      },
    })
    expect(caught).toMatchObject({ kind: 'aborted' })
  })

  it('ignores non-data SSE lines, invalid JSON, and non-object chunks', async () => {
    const deltas: string[] = []
    const chunks = [
      ': ping comment\n\n',
      'data: not-json\n\n',
      'data: "just a string"\n\n',
      'data: null\n\n',
      'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    fetchMock.mockResolvedValueOnce(sseResponse(chunks))

    await streamChat({
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onUsage: () => {},
      onError: () => {},
    })
    expect(deltas).toEqual(['valid'])
  })
})
