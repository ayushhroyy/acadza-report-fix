"""
LLM client — OpenAI-compatible chat completion over any base URL.

The engine runs in two modes:
  --offline (default)  replays the committed per-case outputs in engine/analysis/
                       (see PROMPTS.md §0: model = GLM, outputs committed for audit)
  --live               calls the endpoint with the exact prompts in solver.py /
                       triage.py / reply.py. Set LLM_BASE_URL, LLM_MODEL, LLM_API_KEY.
"""
import json
import os
import urllib.request


def _chat(messages, temperature=0.2, max_tokens=900):
    base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    key = os.environ["LLM_API_KEY"]
    req = urllib.request.Request(
        base.rstrip("/") + "/chat/completions",
        data=json.dumps({"model": model, "messages": messages,
                         "temperature": temperature, "max_tokens": max_tokens}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    return data["choices"][0]["message"]["content"]


def chat_json(system, user, temperature=0.2):
    """One call, JSON out. Tolerates ```json fences."""
    raw = _chat([{"role": "system", "content": system},
                 {"role": "user", "content": user}], temperature=temperature)
    txt = raw.strip()
    if txt.startswith("```"):
        txt = txt.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(txt)
