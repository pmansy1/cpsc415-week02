import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

describe('Composer', () => {
  it('renders a textarea and a Send button', () => {
    render(<Composer onSend={() => {}} streaming={false} />)
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('calls onSend with the text on Enter, then clears the textarea', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} streaming={false} />)
    const ta = screen.getByRole('textbox', { name: /message/i })
    await userEvent.type(ta, 'hello world')
    await userEvent.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith('hello world')
    expect(onSend).toHaveBeenCalledTimes(1)
    expect((ta as HTMLTextAreaElement).value).toBe('')
  })

  it('inserts a newline on Shift+Enter and does not call onSend', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} streaming={false} />)
    const ta = screen.getByRole('textbox', { name: /message/i })
    await userEvent.type(ta, 'line1')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    await userEvent.type(ta, 'line2')
    expect((ta as HTMLTextAreaElement).value).toBe('line1\nline2')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not call onSend on Enter when the textarea is empty or whitespace-only', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} streaming={false} />)
    const ta = screen.getByRole('textbox', { name: /message/i })
    ta.focus()
    await userEvent.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()

    await userEvent.type(ta, '   ')
    await userEvent.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables the textarea and Send button while streaming', () => {
    render(<Composer onSend={() => {}} streaming={true} />)
    expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('sends when the Send button is clicked', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} streaming={false} />)
    const ta = screen.getByRole('textbox', { name: /message/i })
    await userEvent.type(ta, 'click send')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('click send')
  })
})
