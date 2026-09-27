import type { Message } from '../types'
import styles from './MessageBubble.module.css'

export interface MessageBubbleProps {
  message: Message
  incomplete?: boolean
}

export function MessageBubble({ message, incomplete }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const bubbleClass = isAssistant ? styles.assistant : styles.user
  const finalized = isAssistant && message.tokens && message.costUsd !== undefined

  return (
    <div className={`${styles.bubble} ${bubbleClass}`} data-role={message.role}>
      <div className={styles.content}>{message.content}</div>
      {finalized && (
        <div className={styles.meta}>
          <span className={styles.metaItem}>{message.tokens!.total} tok</span>
          <span className={styles.metaItem}>${message.costUsd!.toFixed(6)}</span>
        </div>
      )}
      {incomplete && (
        <span className={styles.incomplete} data-testid="incomplete-badge">
          incomplete
        </span>
      )}
    </div>
  )
}
