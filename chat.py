#!/usr/bin/env python3
"""Single-turn chat client using Python standard library only."""

import json
import os
import ssl
import sys
import urllib.error
import urllib.request


def get_ssl_context():
    ctx = ssl.create_default_context()
    # On macOS, standalone Python installations often don't have CA certs linked by default.
    # Load system CA bundle if present.
    for cafile in ["/etc/ssl/cert.pem", "/private/etc/ssl/cert.pem"]:
        if os.path.exists(cafile):
            try:
                ctx.load_verify_locations(cafile)
                return ctx
            except Exception:
                pass
    return ctx


def main():
    base_url = os.environ.get("CHAT_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    model = os.environ.get("CHAT_MODEL", "openai/gpt-4o-mini")
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("CHAT_API_KEY") or ""
    system_prompt = os.environ.get("CHAT_SYSTEM_PROMPT", "You are a helpful assistant.")
    max_tokens_env = os.environ.get("CHAT_MAX_TOKENS")

    # If talking to external API like OpenRouter, an API key is required
    if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
        print("Error: OPENROUTER_API_KEY or CHAT_API_KEY environment variable is required.", file=sys.stderr)
        sys.exit(1)

    # Get question from CLI argument or fall back to default
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = "In one sentence, what is a context window?"

    url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "cpsc415-week02",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
    }

    if max_tokens_env:
        try:
            payload["max_tokens"] = int(max_tokens_env)
        except ValueError:
            print(f"Warning: Invalid CHAT_MAX_TOKENS value '{max_tokens_env}', ignoring.", file=sys.stderr)

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    ssl_context = get_ssl_context()
    try:
        with urllib.request.urlopen(req, context=ssl_context) as resp:
            body = resp.read().decode("utf-8")
            response_json = json.loads(body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        print(f"HTTP Error {e.code}: {err_msg}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        # Fallback for macOS environments where Python root certificates are unconfigured
        if "CERTIFICATE_VERIFY_FAILED" in str(e):
            try:
                fallback_ctx = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=fallback_ctx) as resp:
                    body = resp.read().decode("utf-8")
                    response_json = json.loads(body)
            except Exception as inner_e:
                print(f"URL Error: {inner_e}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"URL Error: {e.reason}", file=sys.stderr)
            sys.exit(1)

    choice = response_json.get("choices", [{}])[0]
    answer = choice.get("message", {}).get("content", "")
    returned_model = response_json.get("model", model)
    usage = response_json.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    print(answer)
    print()
    print(
        f"Model: {returned_model} | Prompt tokens: {prompt_tokens} | "
        f"Completion tokens: {completion_tokens} | Total tokens: {total_tokens}"
    )


if __name__ == "__main__":
    main()
