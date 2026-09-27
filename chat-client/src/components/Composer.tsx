import { useState, type KeyboardEvent } from 'react'
import styles from './Composer.module.css'

export interface ComposerProps {
  onSend: (text: string) => void
  streaming: boolean
}

// Bottom-of-thread input. Enter sends, Shift+Enter inserts a newline. Disabled
// while a stream is in flight so the user can't double-fire a request.
export function Composer({ onSend, streaming }: ComposerProps) {
  const [value, setValue] = useState('')

  function trySend() {
    const trimmed = value.trim()
    if (trimmed.length === 0) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      trySend()
    }
  }

  return (
    <div className={styles.composer}>
      <label className={styles.label} htmlFor="composer-input">
        Message
      </label>
      <textarea
        id="composer-input"
        className={styles.textarea}
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={streaming}
        placeholder={streaming ? 'Waiting for reply…' : 'Type a message…'}
      />
      <button
        className={styles.sendButton}
        type="button"
        onClick={trySend}
        disabled={streaming}
      >
        Send
      </button>
    </div>
  )
}
