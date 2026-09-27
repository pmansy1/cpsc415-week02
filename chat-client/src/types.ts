// Shared types for the chat client. Persisted to IndexedDB as-is.

export type Role = 'user' | 'assistant' | 'system'

export type Provider = 'openrouter'

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface Message {
  id: string
  role: Role
  content: string
  tokens?: TokenUsage
  costUsd?: number
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  provider: Provider
  model: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

// First 60 chars of the first user message, ellipsised. Pure function so
// it can be unit-tested and reused from useConversations.
export function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return 'New chat'
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 60) + '…'
}
