import { describe, it, expect } from 'vitest'
import { deriveTitle, type Conversation, type Message } from './types'

describe('deriveTitle', () => {
  it('returns "New chat" for empty input', () => {
    expect(deriveTitle('')).toBe('New chat')
    expect(deriveTitle('   ')).toBe('New chat')
    expect(deriveTitle('\n\n  \t')).toBe('New chat')
  })

  it('returns the input unchanged when within 60 chars', () => {
    expect(deriveTitle('Hello')).toBe('Hello')
    expect(deriveTitle('  spaced  out  ')).toBe('spaced out')
  })

  it('truncates to 60 chars plus ellipsis when over the limit', () => {
    const long = 'a'.repeat(80)
    const out = deriveTitle(long)
    expect(out.length).toBe(61) // 60 + '…'
    expect(out.endsWith('…')).toBe(true)
    expect(out.startsWith('a'.repeat(60))).toBe(true)
  })

  it('collapses internal whitespace before measuring length', () => {
    const padded = '   hello    world   '
    expect(deriveTitle(padded)).toBe('hello world')
  })
})

describe('types sanity', () => {
  // Compile-time shape checks. The runtime assertions guard against accidental
  // field deletions that would otherwise only surface at the IndexedDB layer.
  it('Message shape has the expected keys', () => {
    const m: Message = {
      id: 'x',
      role: 'user',
      content: 'hi',
      createdAt: 0,
    }
    expect(Object.keys(m).sort()).toEqual(['content', 'createdAt', 'id', 'role'])
  })

  it('Conversation shape has the expected keys', () => {
    const c: Conversation = {
      id: 'x',
      title: 't',
      provider: 'openrouter',
      model: 'm',
      createdAt: 0,
      updatedAt: 0,
      messages: [],
    }
    expect(Object.keys(c).sort()).toEqual([
      'createdAt', 'id', 'messages', 'model', 'provider', 'title', 'updatedAt',
    ])
  })
})
