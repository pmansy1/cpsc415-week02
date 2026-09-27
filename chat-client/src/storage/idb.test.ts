import { describe, it, expect, beforeEach } from 'vitest'
import {
  openDb,
  listConversations,
  getConversation,
  putConversation,
} from './idb'
import type { Conversation } from '../types'

const sample = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  title: 'Hello',
  provider: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  messages: [],
  ...overrides,
})

describe('idb storage', () => {
  beforeEach(async () => {
    // Wipe the store between tests. Do NOT close the connection — idb caches
    // the open handle and a closed connection triggers InvalidStateError on
    // the next openDb() call within the same file.
    const db = await openDb()
    await db.clear('conversations')
  })

  it('puts and gets a conversation by id', async () => {
    const c = sample({ id: 'a', title: 'A' })
    await putConversation(c)
    const got = await getConversation('a')
    expect(got).toEqual(c)
  })

  it('upserts (overwrites) when putting with the same id', async () => {
    await putConversation(sample({ id: 'a', title: 'A' }))
    await putConversation(sample({ id: 'a', title: 'A2' }))
    const got = await getConversation('a')
    expect(got?.title).toBe('A2')
  })

  it('returns undefined when getting a missing id', async () => {
    expect(await getConversation('missing')).toBeUndefined()
  })

  it('lists conversations sorted by updatedAt descending', async () => {
    await putConversation(sample({ id: 'old', updatedAt: 100 }))
    await putConversation(sample({ id: 'mid', updatedAt: 200 }))
    await putConversation(sample({ id: 'new', updatedAt: 300 }))
    const list = await listConversations()
    expect(list.map((c) => c.id)).toEqual(['new', 'mid', 'old'])
  })

  it('preserves nested messages on round-trip', async () => {
    const c = sample({
      id: 'm',
      messages: [
        { id: 'm1', role: 'user', content: 'hi', createdAt: 1 },
        { id: 'm2', role: 'assistant', content: 'hello', createdAt: 2,
          tokens: { prompt: 1, completion: 2, total: 3 }, costUsd: 0.001 },
      ],
    })
    await putConversation(c)
    const got = await getConversation('m')
    expect(got?.messages).toEqual(c.messages)
  })
})
