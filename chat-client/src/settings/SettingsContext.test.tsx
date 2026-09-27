import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SettingsProvider, useSettings } from './SettingsContext'
import { getApiKey, getSettings, clearApiKey } from '../storage/local'

beforeEach(() => {
  localStorage.clear()
})

function Probe() {
  const s = useSettings()
  return (
    <div>
      <span data-testid="key">{s.apiKey ?? '(none)'}</span>
      <span data-testid="model">{s.model}</span>
      <button onClick={() => s.setApiKey('kk')}>setKey</button>
      <button onClick={() => s.setModel('m2')}>setModel</button>
    </div>
  )
}

describe('SettingsContext', () => {
  it('defaults to no key and the default model when storage is empty', () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('key')).toHaveTextContent('(none)')
    expect(screen.getByTestId('model')).toHaveTextContent('anthropic/claude-3.5-sonnet')
  })

  it('hydrates the api key from localStorage on mount', () => {
    localStorage.setItem('chat-client:openrouter-key', 'pre-existing')
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('key')).toHaveTextContent('pre-existing')
  })

  it('hydrates the model from localStorage settings on mount', () => {
    localStorage.setItem('chat-client:settings', JSON.stringify({ model: 'm-from-disk' }))
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    expect(screen.getByTestId('model')).toHaveTextContent('m-from-disk')
  })

  it('setApiKey writes to localStorage and updates context', () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    act(() => {
      screen.getByText('setKey').click()
    })
    expect(getApiKey()).toBe('kk')
    expect(screen.getByTestId('key')).toHaveTextContent('kk')
  })

  it('setModel writes to localStorage settings and updates context', () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    act(() => {
      screen.getByText('setModel').click()
    })
    expect(getSettings()).toEqual({ model: 'm2' })
    expect(screen.getByTestId('model')).toHaveTextContent('m2')
  })

  it('clearApiKey (manual) wipes storage but leaves the model', () => {
    localStorage.setItem('chat-client:openrouter-key', 'k')
    localStorage.setItem('chat-client:settings', JSON.stringify({ model: 'm' }))
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    act(() => {
      clearApiKey()
    })
    expect(getApiKey()).toBeNull()
    expect(getSettings()).toEqual({ model: 'm' })
  })

  it('throws an error when useSettings is called outside of SettingsProvider', () => {
    // Suppress console.error from React during boundary error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useSettings must be used inside <SettingsProvider>')
    spy.mockRestore()
  })
})
