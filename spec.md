# Spec: chat-client

Source intent: [`intent/chat-client.md`](./intent/chat-client.md)

## 1. Architecture

Pure-frontend React SPA. No local backend, no proxy, no server process. The browser calls OpenRouter directly. OpenRouter exposes CORS-friendly endpoints and returns a `usage` chunk in its streamed responses, so we don't need a proxy to compute cost.

**Why no backend:** v1 is single-provider (OpenRouter). Adding Claude / Gemini later goes through the same shape — if a future provider blocks browser CORS, we add a minimal local Node proxy at that point, not before.

**Process model:** `npm run dev` boots Vite, the app loads at `http://localhost:5173`. Production build (`npm run build`) produces static assets that can be served by any local static server or opened via `vite preview`.

## 2. Storage

| Data | Store | Notes |
| --- | --- | --- |
| OpenRouter API key | `localStorage` under `chat-client:openrouter-key` | Plaintext at rest in the browser. Acceptable for a single-user local tool; user acknowledges this on first run. |
| Conversations + messages | IndexedDB via `idb` wrapper, database `chat-client`, object store `conversations` | Survives reload, isolated per origin. |
| Settings (model, default system prompt if ever added) | `localStorage` under `chat-client:settings` | |

No telemetry. No analytics. No external storage.

## 3. OpenRouter integration

- Client: a thin wrapper around the browser `fetch` API, hitting `POST https://openrouter.ai/api/v1/chat/completions` with `stream: true`. OpenRouter speaks the OpenAI Chat Completions schema, including SSE. (Earlier draft mentioned the `openai` SDK; replaced with raw `fetch` for cleaner TDD — the SDK adds layers that fight with mocks and we don't need its retry / pagination machinery.)
- Default model: `anthropic/claude-3.5-sonnet`. Model picker exposes any model the user types or selects from a short curated list (v1: that one model only, plus a free-text "model id" input for power users).
- Headers per OpenRouter docs: `Authorization: Bearer <key>`, `HTTP-Referer: http://localhost:5173`, `X-Title: chat-client`.
- Streaming: SSE via the OpenAI client's `stream: true`. Tokens are appended to the message as they arrive (typewriter effect).
- Cost: read from the final `usage` chunk OpenRouter emits on every streamed completion. The chunk exposes `{ prompt_tokens, completion_tokens, total_tokens, cost }` where `cost` is USD. Persist these on the assistant `Message`.

## 4. Data model

```ts
type Role = 'user' | 'assistant' | 'system';

interface Message {
  id: string;            // uuid
  role: Role;
  content: string;       // full text (final, after streaming completes)
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd?: number;      // from OpenRouter usage chunk
  createdAt: number;     // ms epoch
}

interface Conversation {
  id: string;            // uuid
  title: string;         // first 60 chars of first user message, ellipsised
  provider: 'openrouter';
  model: string;         // e.g. "anthropic/claude-3.5-sonnet"
  createdAt: number;
  updatedAt: number;     // bumped on every new message
  messages: Message[];
}
```

Conversations are listed newest-first by `updatedAt`. The active conversation holds an in-progress assistant `Message` whose `content` grows as tokens stream in; once the stream closes, `tokens` and `costUsd` are filled and the row is written to IndexedDB.

## 5. UI layout

Two-pane layout, fixed desktop widths:

```
+----------------+--------------------------------------+
| Sidebar        | Header: model picker, new chat       |
|                +--------------------------------------+
| [ + New chat ] |                                      |
|                | Message thread                       |
| Conv A   2h    |   user: ...                          |
| Conv B   1d    |   assistant: ...  $0.0012  312 tok   |
| Conv C   3d    |                                      |
|                |                                      |
|                +--------------------------------------+
|                | Composer: textarea + Send button     |
+----------------+--------------------------------------+
```

- **Sidebar (left, ~260px):** "New chat" button at top, then a flat chronological list of conversation titles. Click to load. No grouping, no delete UI in v1 (delete via IndexedDB devtools if needed).
- **Header (right top):** model picker (dropdown of curated models + free-text), new-chat shortcut.
- **Thread (right middle):** user and assistant bubbles. Assistant bubbles show `tokens` and `costUsd` after the stream completes.
- **Composer (right bottom):** multi-line textarea. Enter sends, Shift+Enter inserts newline. Disabled while a stream is in flight.
- **First-run state:** if no API key is in `localStorage`, the composer is replaced by a "Paste your OpenRouter API key" panel with a single input + Save button.

## 6. Stack

- **Build:** Vite + React + TypeScript.
- **HTTP / streaming client:** raw `fetch` wrapped in `src/openrouter/client.ts`. SSE parsed by reading `response.body` as a `ReadableStream<Uint8Array>` and decoding chunk-by-chunk.
- **IndexedDB:** `idb` (Jake Archibald's tiny promise wrapper).
- **Styling:** plain CSS modules. No Tailwind, no UI kit.
- **State:** React `useState` + a small context for `{ apiKey, model, setApiKey, setModel }`. Conversation list and active conversation live in component state, hydrated from IndexedDB on mount and written back on each completed message.

No tests in v1 (single-user local tool, no API contract to lock down). TDD discipline kicks in when a second provider lands.

## 7. Error handling

- 401 / invalid key: surface "API key rejected" inline above the composer, do not retry.
- Network failure mid-stream: keep partial assistant text, mark message with an "incomplete" indicator (small badge), expose a Retry button that resumes the same request (re-sends the conversation up to the last completed user message).
- Rate limit (429): show "rate limited" inline, no auto-retry.
- IndexedDB failure: log to console, surface a non-blocking banner. The app stays usable for the current session in memory.

## 8. Out of scope (v1)

Re-stated from `intent/chat-client.md` so this spec is self-contained:

- Voice input / audio transcription.
- Image input / vision.
- File or document upload.
- Tool use / function calling.
- Mobile / responsive layout — laptop screen assumed.
- Custom system prompts or personas.
- Multi-user, sharing, auth.
- **Plus, not implied above but worth flagging:** message edit, message delete, conversation rename, conversation delete from UI, conversation export, search across history, keyboard shortcuts beyond Enter / Shift+Enter.

## 9. Open decisions

Carry-overs from `intent/chat-client.md` not yet locked:

- **Curated model list.** v1 ships with `anthropic/claude-3.5-sonnet` plus a free-text input. Expand later?
- **OpenRouter as long-term gateway.** If yes, Claude / Gemini ride through OpenRouter with one key. If no, each provider needs its own key + client adapter. Affects how we add providers next iteration.
- **Proxy introduction trigger.** What concrete signal (CORS error from a provider) prompts adding the local proxy?
- **Cost fallback.** OpenRouter's `usage.cost` is the source of truth. If it's missing for some models, do we hardcode price tables or just hide the cost display?

Resolve before implementing the post-v1 providers; not blockers for v1.
