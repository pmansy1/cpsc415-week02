# Chat Client

A simple Python CLI script that asks a question to an AI model through OpenRouter using just Python's standard library.

## What it does and how to run it
- It takes a question in the terminal, sends it to OpenRouter, prints the answer, and prints the token counts at the end.
- **Environment variables**:
  - `OPENROUTER_API_KEY`: your OpenRouter key
  - `CHAT_MODEL`: model name (defaults to `openai/gpt-4o-mini`)
  - `CHAT_BASE_URL`: API URL (defaults to `https://openrouter.ai/api/v1`)
- **How to run**:
  ```bash
  export OPENROUTER_API_KEY="your-key-here"
  python3 chat.py "In one sentence, what is a context window?"
  ```

## Two things I corrected in the intent draft
- **Using a Python CLI instead of a React app**: The AI initially tried to build a React web app using npm packages. I fixed it to a simple Python script using only the standard library (`urllib.request`) like the lab asked.
- **Reading the API key from environment variables**: The AI wanted to save the key to a file. I changed it to read from `OPENROUTER_API_KEY` in the environment so no secrets get committed to GitHub.

## One line of code explained
- **Where usage is read** ([`chat.py`](./chat.py), line 96):
  ```python
  usage = response_json.get("usage", {})
  ```
  - This grabs the `usage` dictionary from the API response so I can grab and print the prompt, completion, and total token counts.

## Two models compared
- **Models**: `openai/gpt-4o-mini` vs `minimax/minimax-m3` on the prompt *"In one sentence, what is a context window?"*
- **Difference in answer**: GPT-4o-mini gave a simple definition of what a context window is, while MiniMax focused on it being the hard limit on total input and output tokens.
- **Observed costs (from OpenRouter Activity)**:
  - `openai/gpt-4o-mini`: **$0.000029** (27 prompt, 42 completion, 69 total tokens)
  - `minimax/minimax-m3`: **$0.000318** (186 prompt, 77 completion, 263 total tokens; cost more because of reasoning tokens)

## Local model
- I didn't test a local model because I don't have Ollama installed on my laptop. A local model would be free ($0.00) and work offline, but it wouldn't show up on OpenRouter's activity page.
