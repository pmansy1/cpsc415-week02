// Vitest setup: register jest-dom matchers, replace IndexedDB with
// fake-indexeddb so storage code can run under jsdom, and explicitly clean
// up React Testing Library between tests (RTL's auto-cleanup via the
// vitest globals path needs an explicit hook when `globals: false`).

import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
