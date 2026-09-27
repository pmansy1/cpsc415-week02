// OpenRouter streaming chat client. Pure fetch + ReadableStream — no SDK, so
// the parsing logic is right here and unit-testable.

import type { Role } from '../types'

export interface ClientMessage {
  role: Role
  content: string
}

export interface StreamUsage {
  prompt: number
  completion: number
  total: number
  costUsd: number
}

export type StreamError =
  | { kind: 'auth'; status: number; message: string }
  | { kind: 'rate_limit'; status: number; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'aborted'; message: string }

export interface StreamChatArgs {
  apiKey: string
  model: string
  messages: ClientMessage[]
  signal: AbortSignal
  onDelta: (delta: string) => void
  onUsage: (usage: StreamUsage) => void
  onError: (err: StreamError) => void
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const REFERER = 'http://localhost:5173'
const TITLE = 'chat-client'

export async function streamChat(args: StreamChatArgs): Promise<void> {
  const { apiKey, model, messages, signal, onDelta, onUsage, onError } = args

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': REFERER,
        'X-Title': TITLE,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      onError({ kind: 'aborted', message: 'request aborted' })
    } else {
      onError({
        kind: 'network',
        message: err instanceof Error ? err.message : 'fetch failed',
      })
    }
    return
  }

  if (!response || !response.ok) {
    if (!response) {
      onError({ kind: 'network', message: 'empty response' })
      return
    }
    let detail = `unexpected status ${response.status}`
    try {
      const text = await response.text()
      const data = JSON.parse(text)
      if (data.error?.message) {
        detail = data.error.message
      }
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      onError({
        kind: 'auth',
        status: response.status,
        message: detail !== `unexpected status ${response.status}` ? detail : 'API key rejected',
      })
    } else if (response.status === 429) {
      onError({
        kind: 'rate_limit',
        status: response.status,
        message: detail !== `unexpected status ${response.status}` ? detail : 'rate limited',
      })
    } else {
      onError({
        kind: 'network',
        message: detail,
      })
    }
    return
  }

  if (!response.body) {
    onError({ kind: 'network', message: 'empty response body' })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Split on SSE event boundary (\n\n) and keep any trailing partial
      // event in the buffer for the next iteration. Awaiting each event
      // ensures onDelta / onUsage complete in order — important because
      // finalizeAssistant must see every persisted delta before it sets
      // tokens / cost on the message.
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        await handleSSEEvent(event, onDelta, onUsage)
      }
    }
    // Drain anything still buffered.
    if (buffer.trim().length > 0) await handleSSEEvent(buffer, onDelta, onUsage)
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      onError({ kind: 'aborted', message: 'request aborted' })
    } else {
      onError({
        kind: 'network',
        message: err instanceof Error ? err.message : 'stream read failed',
      })
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
}

async function handleSSEEvent(
  raw: string,
  onDelta: (d: string) => void | Promise<void>,
  onUsage: (u: StreamUsage) => void | Promise<void>,
): Promise<void> {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      continue
    }
    await dispatchChunk(parsed, onDelta, onUsage)
  }
}

interface ChunkShape {
  choices?: Array<{ delta?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number }
}

async function dispatchChunk(
  parsed: unknown,
  onDelta: (d: string) => void | Promise<void>,
  onUsage: (u: StreamUsage) => void | Promise<void>,
): Promise<void> {
  if (typeof parsed !== 'object' || parsed === null) return
  const c = parsed as ChunkShape
  const content = c.choices?.[0]?.delta?.content
  if (typeof content === 'string' && content.length > 0) await onDelta(content)
  if (c.usage) {
    await onUsage({
      prompt: c.usage.prompt_tokens ?? 0,
      completion: c.usage.completion_tokens ?? 0,
      total: c.usage.total_tokens ?? 0,
      costUsd: c.usage.cost ?? 0,
    })
  }
}
