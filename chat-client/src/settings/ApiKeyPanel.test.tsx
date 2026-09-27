import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiKeyPanel } from './ApiKeyPanel'

describe('ApiKeyPanel', () => {
  it('renders a heading, an input, and a Save button', () => {
    render(<ApiKeyPanel onSave={() => {}} />)
    expect(screen.getByRole('heading')).toHaveTextContent(/api key/i)
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('calls onSave with the trimmed input value when the form is submitted', async () => {
    const onSave = vi.fn()
    render(<ApiKeyPanel onSave={onSave} />)
    await userEvent.type(screen.getByLabelText(/api key/i), '  sk-abc  ')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('sk-abc')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not call onSave when the input is empty or whitespace', async () => {
    const onSave = vi.fn()
    render(<ApiKeyPanel onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/api key/i), '   ')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(<ApiKeyPanel onSave={() => {}} onCancel={onCancel} />)
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    expect(cancelBtn).toBeInTheDocument()
    await userEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
