import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import type { Conversation } from '../types'

const sampleConv = (overrides: Partial<Conversation>): Conversation => ({
  id: 'c',
  title: 't',
  provider: 'openrouter',
  model: 'm',
  createdAt: 0,
  updatedAt: 0,
  messages: [],
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
})

describe('Sidebar', () => {
  it('renders the "New chat" button', () => {
    const onNew = vi.fn()
    const onSelect = vi.fn()
    render(
      <Sidebar
        conversations={[]}
        activeId={null}
        onNew={onNew}
        onSelect={onSelect}
      />,
    )
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
  })

  it('renders conversations in the order given (caller is responsible for sorting)', () => {
    const onNew = vi.fn()
    const onSelect = vi.fn()
    const convs = [
      sampleConv({ id: 'newer', title: 'Newer chat', updatedAt: 200 }),
      sampleConv({ id: 'older', title: 'Older chat', updatedAt: 100 }),
    ]
    render(
      <Sidebar
        conversations={convs}
        activeId={null}
        onNew={onNew}
        onSelect={onSelect}
      />,
    )
    // items[0] is the "New chat" button; conversation rows come after.
    expect(within(screen.getByRole('list')).getAllByRole('listitem').map(
      (li) => li.textContent,
    )).toEqual(['Newer chat', 'Older chat'])
  })

  it('marks the active conversation with aria-current', () => {
    const onNew = vi.fn()
    const onSelect = vi.fn()
    const convs = [
      sampleConv({ id: 'a', title: 'A' }),
      sampleConv({ id: 'b', title: 'B' }),
    ]
    render(
      <Sidebar
        conversations={convs}
        activeId="b"
        onNew={onNew}
        onSelect={onSelect}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(items[1]).toHaveAttribute('aria-current', 'true')
  })

  it('calls onNew when the "New chat" button is clicked', async () => {
    const onNew = vi.fn()
    const onSelect = vi.fn()
    render(
      <Sidebar
        conversations={[]}
        activeId={null}
        onNew={onNew}
        onSelect={onSelect}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /new chat/i }))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect with the conversation id when a row is clicked', async () => {
    const onNew = vi.fn()
    const onSelect = vi.fn()
    const convs = [
      sampleConv({ id: 'a', title: 'A' }),
      sampleConv({ id: 'b', title: 'B' }),
    ]
    render(
      <Sidebar
        conversations={convs}
        activeId={null}
        onNew={onNew}
        onSelect={onSelect}
      />,
    )
    const bRow = screen.getByRole('button', { name: 'B' })
    await userEvent.click(bRow)
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('renders an empty state when there are no conversations', () => {
    render(
      <Sidebar conversations={[]} activeId={null} onNew={() => {}} onSelect={() => {}} />,
    )
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
  })
})
