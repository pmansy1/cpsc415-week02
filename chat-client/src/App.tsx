import { useEffect, useRef, useState } from 'react'
import { SettingsProvider, useSettings } from './settings/SettingsContext'
import { ApiKeyPanel } from './settings/ApiKeyPanel'
import { useConversations } from './state/useConversations'
import { streamChat, type StreamUsage, type StreamError } from './openrouter/client'
import { Sidebar } from './components/Sidebar'
import { ModelPicker } from './components/ModelPicker'
import { Thread } from './components/Thread'
import { Composer } from './components/Composer'
import { ErrorBanner, type ErrorKind } from './components/ErrorBanner'
import type { ClientMessage } from './openrouter/client'
import styles from './App.module.css'

export function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  )
}

function Shell() {
  const { apiKey } = useSettings()
  const [editingKey, setEditingKey] = useState(false)

  if (!apiKey || editingKey) {
    return (
      <ApiKeyPanelRoute
        onDone={() => setEditingKey(false)}
        canCancel={Boolean(apiKey)}
      />
    )
  }
  return <Chat onEditKey={() => setEditingKey(true)} />
}

function ApiKeyPanelRoute({
  onDone,
  canCancel,
}: {
  onDone?: () => void
  canCancel?: boolean
}) {
  const { setApiKey } = useSettings()
  return (
    <ApiKeyPanel
      onSave={(k) => {
        setApiKey(k)
        onDone?.()
      }}
      onCancel={canCancel ? onDone : undefined}
    />
  )
}

function Chat({ onEditKey }: { onEditKey?: () => void }) {
  const { apiKey, model } = useSettings()
  const {
    conversations,
    activeId,
    active,
    create,
    switchTo,
    appendUserMessage,
    startAssistantMessage,
    appendAssistantDelta,
    finalizeAssistant,
    deleteMessage,
  } = useConversations()
  const [streaming, setStreaming] = useState(false)
  const [incompleteId, setIncompleteId] = useState<string | null>(null)
  const [error, setError] = useState<{ kind: ErrorKind; message?: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight stream when the active conversation changes.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [activeId])

  function mapErrorKind(e: StreamError): ErrorKind {
    if (e.kind === 'auth' || e.kind === 'rate_limit' || e.kind === 'aborted' || e.kind === 'network') {
      return e.kind
    }
    return 'network'
  }

  async function streamIntoAssistant(assistantId: string, priorMessages: ClientMessage[]) {
    if (!apiKey) return
    setIncompleteId(null)
    setError(null)
    setStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    await streamChat({
      apiKey,
      model,
      messages: priorMessages,
      signal: abort.signal,
      onDelta: async (delta) => {
        await appendAssistantDelta(assistantId, delta)
      },
      onUsage: async (usage: StreamUsage) => {
        await finalizeAssistant(assistantId, usage)
      },
      onError: (e: StreamError) => {
        if (e.kind === 'aborted') return // intentional abort on switch; no banner
        setIncompleteId(assistantId)
        setError({ kind: mapErrorKind(e), message: e.message })
      },
    })
    setStreaming(false)
    abortRef.current = null
  }

  async function handleSend(text: string) {
    if (!apiKey) return
    if (!model.trim()) {
      setError({
        kind: 'network',
        message: 'Please select or type a model ID before sending.',
      })
      return
    }
    try {
      let conv = active
      if (!conv) {
        conv = await create()
      }
      await appendUserMessage(text)

      const assistant = await startAssistantMessage()
      const priorMessages: ClientMessage[] = [
        ...conv.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ]
      await streamIntoAssistant(assistant.id, priorMessages)
    } catch {
      // ignore
    }
  }

  async function handleRetry() {
    if (!apiKey || !active) return
    const incomplete = incompleteId
    if (!incomplete) {
      setError(null)
      return
    }
    // Drop the partial assistant message and stream a new one against the
    // same prior context (everything up to the last completed user message).
    await deleteMessage(incomplete)
    const fresh = await startAssistantMessage()
    const priorMessages: ClientMessage[] = active.messages
      .filter((m) => m.id !== incomplete)
      .map((m) => ({ role: m.role, content: m.content }))
    setIncompleteId(null)
    await streamIntoAssistant(fresh.id, priorMessages)
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNew={() => {
          void create()
        }}
        onSelect={switchTo}
      />
      <main className={styles.main}>
        <header className={styles.header}>
          <ModelPicker />
          {onEditKey && (
            <button
              type="button"
              className={styles.keyButton}
              onClick={onEditKey}
              title="Change OpenRouter API Key"
            >
              API Key
            </button>
          )}
        </header>
        {error && <ErrorBanner kind={error.kind} message={error.message} onRetry={handleRetry} />}
        <Thread messages={active?.messages ?? []} incompleteId={incompleteId} />
        <Composer onSend={handleSend} streaming={streaming} />
      </main>
    </div>
  )
}
