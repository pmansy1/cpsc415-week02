import type { Message } from '../types'
import { MessageBubble } from './MessageBubble'
import styles from './Thread.module.css'

export interface ThreadProps {
  messages: Message[]
  incompleteId?: string | null
}

export function Thread({ messages, incompleteId }: ThreadProps) {
  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Send a message to start the conversation.</p>
      </div>
    )
  }
  return (
    <div className={styles.thread} data-testid="thread">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          incomplete={m.id === incompleteId}
        />
      ))}
    </div>
  )
}
