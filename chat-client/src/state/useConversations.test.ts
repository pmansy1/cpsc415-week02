import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useConversations } from './useConversations'
import { openDb } from '../storage/idb'
import { deriveTitle, type Conversation, type Message } from '../types'

beforeEach(async () => {
  localStorage.clear()
  const db = await openDb()
  await db.clear('conversations')
})

describe('useConversations', () => {
  it('starts with no conversations and no active id', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => {
      expect(result.current.conversations).toEqual([])
      expect(result.current.activeId).toBeNull()
      expect(result.current.active).toBeNull()
    })
  })

  it('create() makes a new conversation, persists it, and switches to it', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))

    let created: Conversation | null = null
    await act(async () => {
      created = await result.current.create()
    })
    expect(created).not.toBeNull()
    expect(created!.title).toBe('New chat')
    expect(created!.provider).toBe('openrouter')
    expect(created!.messages).toEqual([])

    await waitFor(() => {
      expect(result.current.activeId).toBe(created!.id)
      expect(result.current.active?.id).toBe(created!.id)
      expect(result.current.conversations).toHaveLength(1)
    })
  })

  it('appendUserMessage derives the title from the first user message', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    await act(async () => {
      await result.current.appendUserMessage('Hello world from a test')
    })
    await waitFor(() => {
      expect(result.current.active?.title).toBe('Hello world from a test')
      expect(deriveTitle('Hello world from a test')).toBe('Hello world from a test')
    })
  })

  it('appendUserMessage trims and updates title once (no overwrite on later messages)', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    await act(async () => {
      await result.current.appendUserMessage('  First message  ')
    })
    await waitFor(() => expect(result.current.active?.title).toBe('First message'))
    await act(async () => {
      await result.current.appendUserMessage('Second message')
    })
    await waitFor(() => expect(result.current.active?.title).toBe('First message'))
  })

  it('startAssistantMessage appends an empty assistant message and returns its id', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    await act(async () => {
      await result.current.appendUserMessage('hi')
    })

    let assistantMessage: Message | null = null
    await act(async () => {
      assistantMessage = await result.current.startAssistantMessage()
    })
    await waitFor(() => {
      expect(assistantMessage).not.toBeNull()
      const m = result.current.active?.messages.at(-1)
      expect(m?.role).toBe('assistant')
      expect(m?.content).toBe('')
      expect(m?.id).toBe(assistantMessage!.id)
    })
  })

  it('appendAssistantDelta grows the assistant message content', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    await act(async () => {
      await result.current.appendUserMessage('hi')
    })
    let assistantId = ''
    await act(async () => {
      assistantId = (await result.current.startAssistantMessage()).id
    })
    await act(async () => {
      await result.current.appendAssistantDelta(assistantId, 'Hel')
    })
    await act(async () => {
      await result.current.appendAssistantDelta(assistantId, 'lo')
    })
    await waitFor(() => {
      const m = result.current.active?.messages.at(-1)
      expect(m?.content).toBe('Hello')
    })
  })

  it('finalizeAssistant attaches tokens and cost to the assistant message', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    await act(async () => {
      await result.current.appendUserMessage('hi')
    })
    let assistantId = ''
    await act(async () => {
      assistantId = (await result.current.startAssistantMessage()).id
    })
    await act(async () => {
      await result.current.appendAssistantDelta(assistantId, 'Hi there')
    })
    await act(async () => {
      await result.current.finalizeAssistant(assistantId, {
        prompt: 1,
        completion: 2,
        total: 3,
        costUsd: 0.0042,
      })
    })
    await waitFor(() => {
      const m = result.current.active?.messages.at(-1)
      expect(m?.tokens).toEqual({ prompt: 1, completion: 2, total: 3 })
      expect(m?.costUsd).toBe(0.0042)
    })
  })

  it('switchTo changes the active conversation', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    let idA = ''
    let idB = ''
    await act(async () => {
      idA = (await result.current.create()).id
    })
    await act(async () => {
      await result.current.switchTo(null as unknown as string) // not allowed, but
      idB = (await result.current.create()).id
    })

    // After creating B, active should be B.
    expect(result.current.activeId).toBe(idB)

    await act(async () => {
      await result.current.switchTo(idA)
    })
    expect(result.current.activeId).toBe(idA)
    expect(result.current.active?.id).toBe(idA)
  })

  it('list is sorted by updatedAt descending as messages accumulate', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    let firstId = ''
    await act(async () => {
      firstId = (await result.current.create()).id
    })
    // Bumping updatedAt by appending messages on the first conversation.
    await act(async () => {
      await result.current.appendUserMessage('bump')
    })
    // Ensure clock advances so the second conversation has a strictly greater timestamp.
    await new Promise((resolve) => setTimeout(resolve, 15))
    // Creating a second conversation should appear newer.
    let secondId = ''
    await act(async () => {
      secondId = (await result.current.create()).id
    })
    await waitFor(() => {
      const ids = result.current.conversations.map((c) => c.id)
      expect(ids[0]).toBe(secondId)
      expect(ids).toContain(firstId)
    })
  })

  it('hydrates from IndexedDB on a second mount', async () => {
    const { result: r1, unmount } = renderHook(() => useConversations())
    await waitFor(() => expect(r1.current.conversations).toEqual([]))
    await act(async () => {
      await r1.current.create()
    })
    unmount()

    const { result: r2 } = renderHook(() => useConversations())
    await waitFor(() => {
      expect(r2.current.conversations).toHaveLength(1)
    })
  })

  it('deleteMessage removes the message from the active conversation', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })
    let assistantId = ''
    await act(async () => {
      await result.current.appendUserMessage('hello')
      assistantId = (await result.current.startAssistantMessage()).id
    })
    await act(async () => {
      await result.current.appendAssistantDelta(assistantId, 'partial')
    })
    await act(async () => {
      await result.current.deleteMessage(assistantId)
    })
    await waitFor(() => {
      expect(result.current.active?.messages.find((m) => m.id === assistantId)).toBeUndefined()
    })
  })

  it('throws when mutating functions are called with no active conversation', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))

    await expect(result.current.appendUserMessage('test')).rejects.toThrow('no active conversation')
    await expect(result.current.startAssistantMessage()).rejects.toThrow('no active conversation')
    await expect(result.current.appendAssistantDelta('id', 'delta')).rejects.toThrow('no active conversation')
    await expect(
      result.current.finalizeAssistant('id', { prompt: 1, completion: 1, total: 2, costUsd: 0 }),
    ).rejects.toThrow('no active conversation')
    await expect(result.current.deleteMessage('id')).rejects.toThrow('no active conversation')
  })

  it('throws when active conversation is missing from store', async () => {
    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.conversations).toEqual([]))
    await act(async () => {
      await result.current.create()
    })

    // Wipe store from underlying IDB so getConversation returns undefined
    const db = await openDb()
    await db.clear('conversations')

    await expect(result.current.appendUserMessage('test')).rejects.toThrow(
      'active conversation missing from store',
    )
    await expect(result.current.startAssistantMessage()).rejects.toThrow(
      'active conversation missing from store',
    )
    await expect(result.current.appendAssistantDelta('id', 'delta')).rejects.toThrow(
      'active conversation missing from store',
    )
    await expect(
      result.current.finalizeAssistant('id', { prompt: 1, completion: 1, total: 2, costUsd: 0 }),
    ).rejects.toThrow('active conversation missing from store')
    await expect(result.current.deleteMessage('id')).rejects.toThrow(
      'active conversation missing from store',
    )
  })
})
