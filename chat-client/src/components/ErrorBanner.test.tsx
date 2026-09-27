import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBanner, type ErrorKind } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders an auth error with a specific message', () => {
    render(<ErrorBanner kind="auth" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/api key rejected/i)
  })

  it('renders a rate-limit error with a specific message', () => {
    render(<ErrorBanner kind="rate_limit" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/rate limited/i)
  })

  it('renders a network error with a specific message', () => {
    render(<ErrorBanner kind="network" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/network/i)
  })

  it('renders an aborted error with a specific message', () => {
    render(<ErrorBanner kind="aborted" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/aborted/i)
  })

  it('renders a storage error with a specific message', () => {
    render(<ErrorBanner kind="storage" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/storage/i)
  })

  it('invokes onRetry when the Retry button is clicked', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner kind="network" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not render a Retry button when onRetry is omitted', () => {
    render(<ErrorBanner kind="network" />)
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('exhaustive: every documented kind renders without throwing', () => {
    const kinds: ErrorKind[] = ['auth', 'rate_limit', 'network', 'aborted', 'storage']
    for (const k of kinds) {
      expect(() => render(<ErrorBanner kind={k} />)).not.toThrow()
    }
  })
})
