import styles from './ErrorBanner.module.css'

export type ErrorKind = 'auth' | 'rate_limit' | 'network' | 'aborted' | 'storage'

const MESSAGES: Record<ErrorKind, string> = {
  auth: 'API key rejected. OpenRouter returned 401/403.',
  rate_limit: 'Rate limited. Slow down and try again in a moment.',
  network: 'Network error. Check your connection and retry.',
  aborted: 'Request aborted.',
  storage: 'Local storage error. Conversations may not persist this session.',
}

export interface ErrorBannerProps {
  kind: ErrorKind
  message?: string
  onRetry?: () => void
}

export function ErrorBanner({ kind, message, onRetry }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.message}>{message || MESSAGES[kind]}</span>
      {onRetry && (
        <button className={styles.retry} type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
