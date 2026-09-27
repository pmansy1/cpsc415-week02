import type { Conversation } from '../types'
import styles from './Sidebar.module.css'

export interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onNew: () => void
  onSelect: (id: string) => void
}

// Left-pane conversation list. The caller (App) controls ordering — Sidebar
// renders conversations in the order given. Sorting by updatedAt desc is the
// caller's responsibility so this component stays trivially testable.
export function Sidebar({ conversations, activeId, onNew, onSelect }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="conversations">
      <button className={styles.newButton} onClick={onNew}>
        + New chat
      </button>
      {conversations.length === 0 ? (
        <p className={styles.empty}>No conversations yet.</p>
      ) : (
        <ul className={styles.list}>
          {conversations.map((c) => {
            const isActive = c.id === activeId
            return (
              <li
                key={c.id}
                className={isActive ? `${styles.item} ${styles.itemActive}` : styles.item}
                aria-current={isActive ? 'true' : undefined}
              >
                <button
                  className={styles.itemButton}
                  onClick={() => onSelect(c.id)}
                >
                  {c.title}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
