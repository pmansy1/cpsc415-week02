import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  listConversations,
  getConversation,
  putConversation,
} from '../storage/idb'
import { getSettings } from '../storage/local'
import { deriveTitle, type Conversation, type Message } from '../types'
import type { StreamUsage } from '../openrouter/client'

export interface UseConversations {
  conversations: Conversation[]
  activeId: string | null
  active: Conversation | null
  create: () => Promise<Conversation>
  switchTo: (id: string | null) => void
  appendUserMessage: (content: string) => Promise<Message>
  startAssistantMessage: () => Promise<Message>
  appendAssistantDelta: (id: string, delta: string) => Promise<void>
  finalizeAssistant: (id: string, usage: StreamUsage) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
}

// Hook wrapping IndexedDB-backed conversation state. Single source of truth:
// `state` (in memory) is written through to IndexedDB on every mutation and
// re-hydrated on mount.
//
// The hook tracks `activeId` both in state (for re-renders) AND in a ref (for
// closure reads). Without the ref, mutating functions called from an event
// handler that awaits `create()` would still see the pre-create `activeId`,
// because React state updates are not visible to the in-flight closure.
export function useConversations(): UseConversations {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  // Synchronous ref write during render is fine — refs are designed for this.
  activeIdRef.current = activeId

  // Hydrate from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await listConversations()
      if (cancelled) return
      setConversations(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist a conversation (and update local list state) by id.
  const persist = useCallback(async (c: Conversation) => {
    await putConversation(c)
    setConversations((prev) => {
      const next = prev.filter((x) => x.id !== c.id)
      next.push(c)
      return next.sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }, [])

  const create = useCallback(async (): Promise<Conversation> => {
    const now = Date.now()
    const model = getSettings()?.model ?? 'anthropic/claude-3.5-sonnet'
    const c: Conversation = {
      id: uuid(),
      title: 'New chat',
      provider: 'openrouter',
      model,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    await persist(c)
    activeIdRef.current = c.id
    setActiveId(c.id)
    return c
  }, [persist])

  const switchTo = useCallback((id: string | null) => {
    activeIdRef.current = id
    setActiveId(id)
  }, [])

  const active = useMemo<Conversation | null>(() => {
    if (!activeId) return null
    return conversations.find((c) => c.id === activeId) ?? null
  }, [conversations, activeId])

  const appendUserMessage = useCallback(
    async (content: string): Promise<Message> => {
      const id = activeIdRef.current
      if (!id) throw new Error('no active conversation')
      const current = await getConversation(id)
      if (!current) throw new Error('active conversation missing from store')
      const m: Message = {
        id: uuid(),
        role: 'user',
        content,
        createdAt: Date.now(),
      }
      const isFirstUser = !current.messages.some((x) => x.role === 'user')
      const next: Conversation = {
        ...current,
        title: isFirstUser ? deriveTitle(content) : current.title,
        updatedAt: Date.now(),
        messages: [...current.messages, m],
      }
      await persist(next)
      return m
    },
    [persist],
  )

  const startAssistantMessage = useCallback(async (): Promise<Message> => {
    const id = activeIdRef.current
    if (!id) throw new Error('no active conversation')
    const current = await getConversation(id)
    if (!current) throw new Error('active conversation missing from store')
    const m: Message = {
      id: uuid(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    const next: Conversation = {
      ...current,
      updatedAt: Date.now(),
      messages: [...current.messages, m],
    }
    await persist(next)
    return m
  }, [persist])

  const appendAssistantDelta = useCallback(
    async (id: string, delta: string): Promise<void> => {
      const convId = activeIdRef.current
      if (!convId) throw new Error('no active conversation')
      const current = await getConversation(convId)
      if (!current) throw new Error('active conversation missing from store')
      const next: Conversation = {
        ...current,
        messages: current.messages.map((m) =>
          m.id === id ? { ...m, content: m.content + delta } : m,
        ),
      }
      await persist(next)
    },
    [persist],
  )

  const finalizeAssistant = useCallback(
    async (id: string, usage: StreamUsage): Promise<void> => {
      const convId = activeIdRef.current
      if (!convId) throw new Error('no active conversation')
      const current = await getConversation(convId)
      if (!current) throw new Error('active conversation missing from store')
      const next: Conversation = {
        ...current,
        messages: current.messages.map((m) =>
          m.id === id
            ? {
                ...m,
                tokens: { prompt: usage.prompt, completion: usage.completion, total: usage.total },
                costUsd: usage.costUsd,
              }
            : m,
        ),
      }
      await persist(next)
    },
    [persist],
  )

  const deleteMessage = useCallback(
    async (id: string): Promise<void> => {
      const convId = activeIdRef.current
      if (!convId) throw new Error('no active conversation')
      const current = await getConversation(convId)
      if (!current) throw new Error('active conversation missing from store')
      const next: Conversation = {
        ...current,
        updatedAt: Date.now(),
        messages: current.messages.filter((m) => m.id !== id),
      }
      await persist(next)
    },
    [persist],
  )

  return {
    conversations,
    activeId,
    active,
    create,
    switchTo,
    appendUserMessage,
    startAssistantMessage,
    appendAssistantDelta,
    finalizeAssistant,
    deleteMessage,
  }
}

// Avoid an unused-export lint warning when consumers want the hydration flag.
export type { Conversation, Message }
