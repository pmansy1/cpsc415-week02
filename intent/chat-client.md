# Intent: chat-client

## Goal
A command-line chat client written in Python using only the standard library that sends a single question to an LLM via OpenRouter and prints the answer along with token usage statistics.

## Who it is for
A student or developer who wants a minimal, zero-dependency CLI tool to query AI models directly from the terminal without installing third-party libraries or running a web server.

## Constraints
- **Language**: Python 3 standard library only (`urllib.request`, `json`, `os`, `sys`). No external packages, no `pip install`.
- **Configuration**: `CHAT_BASE_URL` (default `https://openrouter.ai/api/v1`), `CHAT_MODEL` (e.g. `openai/gpt-4o-mini`), and `OPENROUTER_API_KEY` (or `CHAT_API_KEY`) read strictly from environment variables. No secrets stored in code or repository files.
- **Behavior**: Sends one question passed via command-line argument (or defaults to `"In one sentence, what is a context window?"`), prints the response, and outputs a final line with model name and input/output token counts.

## Not in scope
- Streaming responses (typewriter effect).
- Multi-turn conversation history.
- Web UI, browser frontend, or graphical interfaces.
- Third-party packages (`requests`, `openai` SDK).
- Automatic retries or multi-provider routing.

## Success looks like
1. Running `python3 chat.py "In one sentence, what is a context window?"` sends the request to OpenRouter, prints the answer, and prints a final line with model name and prompt/completion/total token counts.
2. Changing `CHAT_MODEL` in the environment points the program at a different model with no code changes.
3. Token counts printed by the program match the usage recorded on OpenRouter Activity.

## Open questions
- None for Week 2.

## Corrections made to agent draft
1. Corrected from a multi-turn React web app using the `openai` package to a single-turn Python CLI tool using standard library only (`urllib.request`).
2. Corrected configuration to read base URL, model name, and API key strictly from environment variables (`CHAT_BASE_URL`, `CHAT_MODEL`, `OPENROUTER_API_KEY`) rather than storing keys in files or browser storage.

**Approved by:** Patrick, September 29, 2026
