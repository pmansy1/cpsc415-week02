# Chat Client

A simple local web chat app built with React that lets you chat with different AI models through OpenRouter.

## What the program does and how to run it
- It lets you select an AI model, stream responses in real-time, save your chats in your browser, and see the token count and dollar cost for each reply.
- **How to run it**:
  ```bash
  cd chat-client
  npm install
  npm run dev
  ```
  Then open `http://localhost:5173` in your browser and paste your OpenRouter API key when prompted.
- **Environment variables**: You can set `OPENROUTER_API_KEY` in your terminal before running the app to pre-fill your key, or you can just paste it directly into the web UI.

## Two things corrected in the intent draft and why
- **Using IndexedDB instead of localStorage for chats**: The draft wasn't sure where to save chat history, but localStorage only holds about 5MB and would run out of room quickly. IndexedDB gives us way more space so long chats don't crash or slow down the browser.
- **Using plain fetch instead of a backend server or the OpenAI package**: We originally thought we might need a Node proxy server to avoid CORS issues, but OpenRouter allows direct browser calls. Using standard browser `fetch` kept the app simple and was much easier to write tests for than the heavy OpenAI library.

## One line of code explained
- **Where the usage/cost is read** ([`chat-client/src/openrouter/client.ts`](./chat-client/src/openrouter/client.ts), line 188):
  ```typescript
  costUsd: c.usage.cost ?? 0,
  ```
  - This line pulls the dollar cost that OpenRouter returns in the final stream chunk so the app can display how much the response cost right under the assistant's message.

## Two models compared
- **Models tested**: `openai/gpt-4o-mini` and `minimax/minimax-m3` on the prompt *"What is 25 * 14? Explain in one sentence."*
- **How the answers differed**: GPT-4o-mini gave a plain, straightforward answer with a formula definition, whereas MiniMax broke down the mental math steps (25 × 10 + 25 × 4 = 350) before answering.
- **Observed cost**:
  - `openai/gpt-4o-mini`: **$0.000018** (46 tokens total).
  - `minimax/minimax-m3`: **$0.00034** (285 tokens total; it cost more because it generated hidden reasoning tokens first).

## Local model
- I did not test a local model because Ollama was not installed on my machine. A local model would run for free ($0.00) without needing Wi-Fi, but it wouldn't report OpenRouter cost stats and would run slower depending on computer hardware.
