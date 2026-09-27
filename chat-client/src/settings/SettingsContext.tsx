import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getApiKey, setApiKey, getSettings, setSettings, type Settings } from '../storage/local'

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'

export interface SettingsValue {
  apiKey: string | null
  model: string
  setApiKey: (k: string) => void
  setModel: (m: string) => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously during the first render so tests and the UI see
  // the stored values without waiting for a useEffect tick.
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey())
  const [model, setModelState] = useState<string>(
    () => getSettings()?.model ?? DEFAULT_MODEL,
  )

  const value = useMemo<SettingsValue>(
    () => ({
      apiKey,
      model,
      setApiKey: (k: string) => {
        setApiKey(k)
        setApiKeyState(k)
      },
      setModel: (m: string) => {
        const next: Settings = { model: m }
        setSettings(next)
        setModelState(m)
      },
    }),
    [apiKey, model],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const v = useContext(SettingsContext)
  if (!v) throw new Error('useSettings must be used inside <SettingsProvider>')
  return v
}
