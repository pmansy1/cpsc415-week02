import { useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import styles from './ModelPicker.module.css'

// Short curated list of OpenRouter model ids that work for general chat.
// v1 is OpenRouter-only; the free-text input below lets users paste any
// other OpenRouter model id without code changes.
const CURATED = [
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
  { id: 'minimax/minimax-m3', label: 'MiniMax M3 (minimax/minimax-m3)' },
]

export function ModelPicker() {
  const { model, setModel } = useSettings()
  const isCurated = CURATED.some((m) => m.id === model)
  const [customSelected, setCustomSelected] = useState(!isCurated)

  const isCustom = customSelected || !isCurated

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor="model-picker">
        Model
      </label>
      <select
        id="model-picker"
        className={styles.select}
        value={isCustom ? '__custom__' : model}
        onChange={(e) => {
          const v = e.target.value
          if (v === '__custom__') {
            setCustomSelected(true)
            return
          }
          setCustomSelected(false)
          setModel(v)
        }}
      >
        {CURATED.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {isCustom && (
        <input
          className={styles.customInput}
          aria-label="custom model id"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="provider/model-id"
        />
      )}
    </div>
  )
}
