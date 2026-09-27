import { useState, type FormEvent } from 'react'
import styles from './ApiKeyPanel.module.css'

export interface ApiKeyPanelProps {
  onSave: (key: string) => void
  onCancel?: () => void
}

// First-run panel: replaces the composer when no API key is in localStorage.
// Plain presentational component — does not touch storage directly; the caller
// (App) wires `onSave` to `setApiKey` from SettingsContext.
export function ApiKeyPanel({ onSave, onCancel }: ApiKeyPanelProps) {
  const envKey =
    (typeof import.meta !== 'undefined' &&
      typeof import.meta.env?.VITE_OPENROUTER_API_KEY === 'string' &&
      import.meta.env.VITE_OPENROUTER_API_KEY) ||
    ''
  const [value, setValue] = useState(envKey)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0) return
    onSave(trimmed)
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit} aria-label="api-key-setup">
      <h2 className={styles.heading}>Paste your OpenRouter API key</h2>
      <p className={styles.help}>
        Stored only in this browser. Never sent anywhere except OpenRouter.
      </p>
      <label className={styles.label} htmlFor="api-key-input">
        API key
      </label>
      <input
        id="api-key-input"
        className={styles.input}
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className={styles.button} type="submit">
        Save
      </button>
      {onCancel && (
        <button className={styles.cancelButton} type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
