# Intent: chat-client

## Goal
A local-only React web app that lets you chat with AI providers through a single interface, keeps your API keys in one place, and persists your conversations. v1 ships with OpenRouter and shows token count / estimated cost per reply.

## Who it is for
You, as the sole user. Today you juggle CLI tools for Claude, OpenRouter, and Gemini, and store API keys in `.env` files scattered across projects. This consolidates those keys and conversations behind one local UI.

## Constraints
- Runs locally on your machine; nothing is deployed to the public internet.
- Frontend is React (your preference).
- v1 supports **OpenRouter only**. Claude (Anthropic) and Gemini (Google) are planned for follow-on iterations behind the same UX.
- Streaming responses (typewriter effect) are in v1.
- Cost / usage tracking is in v1.
- Single user; no accounts or auth.

## Not in scope (v1)
- Voice input / audio transcription.
- Image input / vision (screenshots, PDFs).
- File or document upload.
- Tool use / function calling (web search, code execution, etc.).
- Mobile or responsive layout — laptop screen assumed.
- Custom system prompts or personas.
- Multi-user, sharing, or any form of auth.

## Success looks like
1. Open the app in a browser, type a message, see a streamed reply from an OpenRouter model.
2. Paste your OpenRouter API key once; close and reopen the browser, the key is still there.
3. After each reply, see token count and estimated cost displayed next to the assistant message.

## Open questions
Resolve before writing `spec.md`:
- **Pure-frontend vs. tiny local backend?** A pure-frontend app can store keys in `localStorage` / IndexedDB, but CORS rules for some providers may force a small local proxy. Decide before locking the architecture.
- **Where do conversations live?** `localStorage`, IndexedDB, or a local file via the backend?
- **Default model(s)?** Which OpenRouter model(s) appear in the picker on first launch?
- **Cost source.** Hardcoded price-per-token for common models, fetched from a JSON shipped with the app, or pulled from OpenRouter's `/generation` response (which already includes cost)?
- **Sidebar organization.** Flat chronological list, grouped by provider, or grouped by model?
- **Adding Claude / Gemini later.** Same code paths as OpenRouter (OpenAI-compatible client), or per-provider adapters? Affects how the abstraction is shaped now.
- **Provider routing later.** Does OpenRouter stay the unified gateway (so all three providers flow through one key), or does each provider get its own key and client?

**Approved by:** _pending review_
