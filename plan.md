# Plan: chat-client

Source: [`spec.md`](./spec.md), [`intent/chat-client.md`](./intent/chat-client.md)

> **Tests are in scope for v1.** This overrides the note in `spec.md` §6. The full test stack and TDD ordering are below.

## Test stack

- **Unit / integration:** Vitest + jsdom + React Testing Library + `@testing-library/user-event` + `@testing-library/jest-dom` + `fake-indexeddb` + `@vitest/coverage-v8`.
- **E2E:** Playwright. OpenRouter is mocked at the network layer via `page.route()` so no live API key is needed in CI.
- **Discipline:** TDD per phase — write tests first, watch them fail, implement to green, refactor. Coverage target: **80% lines/branches on `src/`** (gating before E2E).

## Phases

Each phase ends with a runnable verification step. Tests are written first (RED) inside each phase; implementation follows to make them green.

### Phase 1 — Scaffold
- `npm create vite@latest chat-client -- --template react-ts`.
- Install runtime deps: `openai`, `idb`, `uuid`.
- Install dev deps: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `fake-indexeddb`, `@playwright/test`.
- Configure `vitest.config.ts` (jsdom env, `src/setupTests.ts` for jest-dom + fake-indexeddb).
- Verify: `npm run dev` serves an empty React page; `npx vitest run` exits 0 with no tests.

### Phase 2 — Types & storage (TDD)
- **Tests first:** idb open/put/get/list round-trip; localStorage helpers get/set/remove; title derivation (first 60 chars of first user message).
- **Implement:** `src/types.ts`, `src/storage/idb.ts`, `src/storage/local.ts`.
- Verify: `npx vitest run src/storage` all green; coverage on storage modules ≥90%.

### Phase 3 — Settings + first-run panel (TDD)
- **Tests first:** SettingsContext hydrates from `localStorage` on mount; `setApiKey` writes back; ApiKeyPanel renders when no key, hides when key present.
- **Implement:** `src/settings/SettingsContext.tsx`, `src/settings/ApiKeyPanel.tsx` + CSS module.
- Verify: `npx vitest run src/settings` green.

### Phase 4 — OpenRouter client wrapper (TDD)
- **Tests first:** with `fetch` mocked, assert request URL, `Authorization: Bearer <key>`, `HTTP-Referer`, `X-Title`, body shape; assert SSE parsing dispatches `onDelta` per content chunk and `onUsage` on the final chunk with `cost`; assert `onError` on non-2xx.
- **Implement:** `src/openrouter/client.ts` exporting `streamChat({ apiKey, model, messages, signal, onDelta, onUsage, onError })`. Pure `fetch` — no `openai` SDK (the SDK adds noise we don't need and complicates testing).
- Verify: `npx vitest run src/openrouter` green.

### Phase 5 — Conversation state (TDD)
- **Tests first:** against `fake-indexeddb`, create → append user message → append streaming assistant → finalize with tokens/cost; switch between conversations; `updatedAt` ordering; title derived from first user message.
- **Implement:** `src/state/useConversations.ts`.
- Verify: `npx vitest run src/state` green.

### Phase 6 — UI shell (TDD)
- **Tests first:** Sidebar renders conversation list in `updatedAt` desc order; clicking a row calls `switchTo`; New-chat button calls `create`; ModelPicker reflects and updates `model` in context.
- **Implement:** `src/App.tsx` + CSS module, `src/components/Sidebar.tsx`, `src/components/ModelPicker.tsx`.
- Verify: `npx vitest run src/components` green.

### Phase 7 — Thread + composer + streaming (TDD)
- **Tests first:** MessageBubble shows `tokens` + `costUsd` only after they are set; Composer calls `send` on Enter, inserts `\n` on Shift+Enter, is disabled when `streaming` prop is true; integration test of full send → stream → finalize cycle against mocked OpenRouter.
- **Implement:** `src/components/Thread.tsx`, `src/components/MessageBubble.tsx`, `src/components/Composer.tsx` + CSS modules. Wire `streamChat` into `useConversations`.
- Verify: `npx vitest run` full suite green. **Success criterion #1 reachable manually.**

### Phase 8 — Error states (TDD)
- **Tests first:** ErrorBanner renders the right message for `kind: 'auth' | 'rate_limit' | 'network' | 'storage'`; Retry button re-sends the conversation up to the last completed user message; incomplete-message badge appears on mid-stream failures.
- **Implement:** `src/components/ErrorBanner.tsx` + CSS module. Wire into `streamChat`'s `onError` and `useConversations`'s IndexedDB failure path.
- Verify: full suite green.

### Phase 9 — E2E (Playwright)
- `npx playwright init`; add a single spec `e2e/success-criteria.spec.ts` covering the three `intent/chat-client.md` success outcomes, all with `page.route('**/api/v1/chat/completions', ...)` mocking OpenRouter:
  1. Type a message → streamed reply chunks appear in the DOM → final assistant bubble shows tokens + cost.
  2. Paste an API key → reload → key is still in `localStorage` and composer is enabled (panel hidden).
  3. Send a message → reload → conversation persists, sidebar shows it, click restores the thread.
- Verify: `npx playwright test` green.

### Phase 10 — Coverage gate
- `npx vitest run --coverage`.
- Verify: lines/branches on `src/**` ≥ 80%. If under, add tests for the gap (no implementation-only changes here).

## File tree at end

```
chat-client/
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts
  playwright.config.ts, index.html
  e2e/success-criteria.spec.ts
  src/
    main.tsx, App.tsx, App.module.css, types.ts, setupTests.ts
    storage/{idb.ts, local.ts, idb.test.ts, local.test.ts}
    settings/{SettingsContext.tsx, ApiKeyPanel.tsx, ApiKeyPanel.module.css, *.test.tsx}
    openrouter/{client.ts, client.test.ts}
    state/{useConversations.ts, useConversations.test.ts}
    components/{Sidebar, Thread, Composer, MessageBubble, ModelPicker, ErrorBanner}.{tsx,module.css,test.tsx}
```

## Explicit non-goals (unchanged from spec)

No backend, no proxy, no second provider, no auth, no tests against live OpenRouter (mocked end-to-end).

## Open decisions still parked (from spec §9)

Curated model list, OpenRouter-as-gateway, proxy trigger, cost fallback. None block any phase above.
