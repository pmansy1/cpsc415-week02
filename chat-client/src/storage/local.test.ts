import { describe, it, expect, beforeEach } from 'vitest'
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getSettings,
  setSettings,
} from './local'

beforeEach(() => {
  localStorage.clear()
})

describe('api key helpers', () => {
  it('returns null when no key is stored', () => {
    expect(getApiKey()).toBeNull()
  })

  it('round-trips a key through set then get', () => {
    setApiKey('sk-test-123')
    expect(getApiKey()).toBe('sk-test-123')
  })

  it('clears a stored key', () => {
    setApiKey('sk-test-123')
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })

  it('overwrites an existing key', () => {
    setApiKey('first')
    setApiKey('second')
    expect(getApiKey()).toBe('second')
  })
})

describe('settings helpers', () => {
  it('returns null when no settings are stored', () => {
    expect(getSettings()).toBeNull()
  })

  it('round-trips arbitrary settings shape', () => {
    const s = { model: 'anthropic/claude-3.5-sonnet' }
    setSettings(s)
    expect(getSettings()).toEqual(s)
  })

  it('replaces settings on each call (no merge)', () => {
    setSettings({ model: 'm1' })
    setSettings({ model: 'm2' })
    expect(getSettings()).toEqual({ model: 'm2' })
  })

  it('survives independent writes between api key and settings', () => {
    setApiKey('k')
    setSettings({ model: 'm' })
    expect(getApiKey()).toBe('k')
    expect(getSettings()).toEqual({ model: 'm' })
    clearApiKey()
    expect(getSettings()).toEqual({ model: 'm' }) // settings untouched
  })

  it('returns null when stored settings is invalid JSON', () => {
    localStorage.setItem('chat-client:settings', '{corrupt-json')
    expect(getSettings()).toBeNull()
  })
})
