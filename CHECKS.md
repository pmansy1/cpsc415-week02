# Checks

| Check | Expected | Observed | Pass/fail |
|---|---|---|---|
| Question through OpenRouter | An answer and a usage line | Got a clean 1-sentence definition and the usage line showing `gpt-4o-mini` with 27 prompt and 42 completion tokens (69 total). | Pass |
| Usage record matches | Same model; same or close token counts | Checked OpenRouter's Activity tab right after; the request showed the exact same 27 prompt / 42 completion counts. | Pass |
| System prompt changed | Answer style changes accordingly | Passed `CHAT_SYSTEM_PROMPT` to speak like a pirate; model replied using pirate slang ("Arrr!") and prompt tokens bumped up to 32. | Pass |
| `max_tokens` = 20 | Truncated or empty answer; tokens still billed | Response cut off mid-sentence right after "generating"; completion tokens hit the 20 limit exactly. | Pass |
| Model swapped (step 4) | Different model name in usage; answer may differ | Swapped `CHAT_MODEL` to `minimax/minimax-m3`; gave a different answer focused on token limits and cost 263 total tokens. | Pass |
| Local model (optional) | Answer from localhost; no OpenRouter entry | Skipped because I don't have Ollama or any local model set up on my Mac. | N/A |
