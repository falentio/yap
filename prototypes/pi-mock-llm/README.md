# pi-mock-llm — a fake model for pi extension development

Two ways to give a pi extension a model without paying for one:

| File | What it is |
|------|------------|
| `faux-probe.ts` | In-process fake model. No HTTP, no server. Uses pi-ai's own `fauxProvider`. |
| `server.mjs` | Zero-dependency OpenAI-compatible HTTP mock (`/v1/chat/completions`, SSE). |
| `mock-provider.ts` | Registers the HTTP mock as a pi provider (`mock/mock-1`). |
| `compact-probe.ts` | Forces a compaction from an extension command. |
| `drive-rpc.mjs` | Drives real pi over RPC: N turns, then `/compact`. |
| `script.json` | Scripted replies, matched by regex against the conversation. |
| `run.sh` | Runs both paths end to end. |

## One command

```bash
./run.sh
```

Expected:

```text
== HTTP mock ==
turn ok: Tell me a story about a lighthouse keeper.
turn ok: Continue the story, add a storm.
turn ok: Continue again, describe the morning.
compact ok: true
summary: ## Summary - Goal: develop a pi compaction extension against a fake model. ...
tokensBefore: 834 -> estimatedTokensAfter: 241
== in-process faux provider ==
...
compact ok: true
summary: ... Fake model wrote this summary in-process.
tokensBefore: 587 -> estimatedTokensAfter: 132
```

## By hand

```bash
node server.mjs --port 8899 --script script.json --log /tmp/mock.jsonl &
pi -e ./mock-provider.ts --provider mock --model mock-1 -p "hello" --no-builtin-tools
```

The server loads `script.json` once at startup; restart it after editing replies.

## Why compaction needs a fake this good

`/compact` is not one model call. pi finds a cut point, then sends a fresh
summarization prompt containing `<conversation>` markup, plus a second
turn-prefix request when the cut splits a turn. The mock logs every request, so
`/tmp/mock-project/requests.jsonl` shows exactly what pi sent — that log is the
thing worth asserting on in a test.

## Maintained copy

The working copy of these assets lives in the `pi-fake-model` skill
(`~/.pi/agent/skills/pi-fake-model/assets/`). Edit it there; this folder is the
research snapshot.
