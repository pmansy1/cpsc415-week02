import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../types'

const base = (overrides: Partial<Message>): Message => ({
  id: 'm',
  role: 'user',
  content: 'hi',
  createdAt: 0,
  ...overrides,
})

describe('MessageBubble', () => {
  it('renders the message content', () => {
    render(<MessageBubble message={base({ content: 'Hello there' })} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('uses different class names for user and assistant bubbles', () => {
    const { container: u } = render(<MessageBubble message={base({ role: 'user' })} />)
    const { container: a } = render(
      <MessageBubble message={base({ role: 'assistant' })} />,
    )
    const uClass = u.firstElementChild?.className ?? ''
    const aClass = a.firstElementChild?.className ?? ''
    expect(uClass).not.toEqual(aClass)
  })

  it('shows tokens and cost on assistant bubbles when both are present', () => {
    render(
      <MessageBubble
        message={base({
          role: 'assistant',
          content: 'Hi',
          tokens: { prompt: 5, completion: 3, total: 8 },
          costUsd: 0.001234,
        })}
      />,
    )
    expect(screen.getByText(/8 tok/i)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.001234/)).toBeInTheDocument()
  })

  it('omits tokens/cost when the assistant message is not finalized', () => {
    render(
      <MessageBubble
        message={base({ role: 'assistant', content: 'in progress…' })}
      />,
    )
    expect(screen.queryByText(/tok/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('marks a partial assistant message with an "incomplete" badge', () => {
    render(
      <MessageBubble
        message={base({ role: 'assistant', content: 'halfway' })}
        incomplete
      />,
    )
    expect(screen.getByText(/incomplete/i)).toBeInTheDocument()
  })
})
