// Thin localStorage helpers. Single-user local tool, plaintext at rest is fine.

const KEY_API = 'chat-client:openrouter-key'
const KEY_SETTINGS = 'chat-client:settings'

export function getApiKey(): string | null {
  return localStorage.getItem(KEY_API)
}

export function setApiKey(k: string): void {
  localStorage.setItem(KEY_API, k)
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY_API)
}

export interface Settings {
  model: string
}

export function getSettings(): Settings | null {
  const raw = localStorage.getItem(KEY_SETTINGS)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Settings
  } catch {
    return null
  }
}

export function setSettings(s: Settings): void {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(s))
}
