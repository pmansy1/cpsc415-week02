import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelPicker } from './ModelPicker'
import { SettingsProvider, useSettings } from '../settings/SettingsContext'

function Probe() {
  const { model } = useSettings()
  return <span data-testid="probe-model">{model}</span>
}

beforeEach(() => {
  localStorage.clear()
})

describe('ModelPicker', () => {
  it('renders a select with the current model preselected', () => {
    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('anthropic/claude-3.5-sonnet')
    expect(screen.getByTestId('probe-model')).toHaveTextContent('anthropic/claude-3.5-sonnet')
  })

  it('updates the context model when the user picks a different option', async () => {
    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, 'openai/gpt-4o')
    expect(select.value).toBe('openai/gpt-4o')
    expect(screen.getByTestId('probe-model')).toHaveTextContent('openai/gpt-4o')
  })

  it('persists the chosen model across remounts', async () => {
    const { unmount } = render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, 'openai/gpt-4o')
    unmount()

    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select2 = screen.getByRole('combobox') as HTMLSelectElement
    expect(select2.value).toBe('openai/gpt-4o')
  })

  it('does not change the model when selecting the custom sentinel option', async () => {
    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, '__custom__')
    expect(screen.getByTestId('probe-model')).toHaveTextContent('anthropic/claude-3.5-sonnet')
  })

  it('renders custom input when model is not in curated list and updates model on change', async () => {
    localStorage.setItem('chat-client:settings', JSON.stringify({ model: 'custom/model-x' }))
    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const customInput = screen.getByLabelText('custom model id') as HTMLInputElement
    expect(customInput).toBeInTheDocument()
    expect(customInput.value).toBe('custom/model-x')

    await userEvent.type(customInput, '-updated')
    expect(screen.getByTestId('probe-model')).toHaveTextContent('custom/model-x-updated')
  })

  it('reveals custom input when selecting Custom... from the dropdown and updates model', async () => {
    render(
      <SettingsProvider>
        <ModelPicker />
        <Probe />
      </SettingsProvider>,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, '__custom__')
    const customInput = screen.getByLabelText('custom model id') as HTMLInputElement
    expect(customInput).toBeInTheDocument()
    await userEvent.clear(customInput)
    await userEvent.type(customInput, 'meta-llama/llama-3.3-70b-instruct')
    expect(screen.getByTestId('probe-model')).toHaveTextContent('meta-llama/llama-3.3-70b-instruct')
  })
})
