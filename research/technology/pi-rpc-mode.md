---
title: Pi RPC Mode — Driving the Coding Agent as a JSONL Subprocess
category: technology
tags: [pi, coding-agent, rpc, jsonl, subprocess, ipc, protocol, harness, rpc-client]
status: complete
created: 2026-11-03
updated: 2026-11-03
sources:
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/rpc-client.ts
confidence: high
---

## Summary

RPC mode is pi's third output mode next to the TUI and print/JSON: `pi --mode rpc` runs the
whole coding agent as a **long-lived child process** whose interface is newline-delimited JSON —
commands in on stdin, responses and session events out on stdout. There is no TTY and no
one-shot exit. A client speaks four record families: `command` (in), `response` (out, one per
command), **session event** (out, unsolicited, sharing its shape with `--mode json`), and the
`extension_ui_request`/`extension_ui_response` subprotocol that lets an extension's
`ctx.ui.select()` render in your UI instead of a terminal.

Pick it when the host is not Node/Bun (Python, Go, Rust, a browser backend), when the agent
should be isolated in its own process, or when you are writing an IDE/custom client. Inside
Node, the in-process SDK or the exported `RpcClient` wrapper is less work than raw JSONL.

## Where it sits among pi's interfaces

Compared items across the columns; the dimensions are the rows.

| Dimension | TUI (`pi`) | Print (`-p`) | JSON (`--mode json`) | RPC (`--mode rpc`) | SDK (in-process) |
|---|---|---|---|---|---|
| Transport | Terminal I/O | stdout text | stdout JSONL | stdin+stdout JSONL | Function calls |
| Lifetime | Until quit | One prompt batch, exits | One prompt batch, exits | Long-lived, many prompts | Host process |
| Input | Keystrokes | Prompt args | Prompt args | `prompt`/`steer`/`follow_up` commands | Method calls |
| Mid-run steering | Esc / queued input | None | None | `steer` command | Direct API |
| Session header record | n/a | None | First record | Absent — use `get_state` | n/a |
| Extension dialogs | Native | Auto/failed | Not served | `extension_ui_request` subprotocol | Host's own UI |
| State inspection | Slash commands | None | Events only | 33 commands (`get_state`, `get_tree`, …) | Full API |
| Language | Any (human) | Any (shell) | Any (pipe) | Any (JSONL parser) | Node/Bun only |
| Typical use | Interactive work | Scripts, CI | Progress logs, `jq` | IDE, IDE-like app, non-Node host | Embedded agent |

The docs frame the split exactly this way: SDK for in-process Node/Bun hosts, RPC for "other
languages, isolated processes, IDEs, or custom clients"
([rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)).

## Starting it

```bash
pi --mode rpc --no-session
```

`--mode <mode>` accepts `text` (default), `json`, `rpc` — confirmed with `pi --help` on
pi 1.5.0. Every other CLI flag still applies: `--provider`, `--model`, `--name`, `--cwd`,
`--session-dir`, tool and resource selection. Two differences matter to a client:

- **`@file` prompt arguments are rejected.** Content goes through the `prompt` command instead
  ([rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)).
- **`--no-session` does not mean "no session id".** The process still has an id; `get_state`
  simply omits the `sessionFile` field (observed below).

## Protocol shape

Four record families, one direction of responsibility each:

| Direction | Record | Purpose |
|---|---|---|
| stdin | command | Prompt, inspect state, change config, manage the session |
| stdout | `response` | One per command: success/failure plus optional `data` |
| stdout | session event | Unsolicited run, message, tool, queue, compaction, retry activity |
| Both | `extension_ui_request` / `extension_ui_response` | Extension dialogs and status |

Correlation is by an **optional string `id`** the client attaches to any command; the matching
response repeats it. Handling is asynchronous, so a client must key on `id`, never on response
order. Events carry no `id`, except `bash_execution_update`, which repeats the id of the
`bash` command that spawned it.

Three shapes come back on failure: `{"success":false,"error":"..."}` with the command's id; a
`parse` response with **no** id for malformed JSON; and, for anything after a prompt is
accepted, no response at all — late failures surface in the message and event stream.

## Run lifecycle — the one thing clients get wrong

`success: true` on a `prompt` means *accepted*, not *finished*. `data.disposition` says which:

- `"started"` — a run began for this prompt.
- `"queued"` — the run was busy and Pi queued it (requires `streamingBehavior` while streaming).
- `"handled"` — an extension command or input handler consumed it; **no run started**, so do
  not wait for `agent_settled`.

After acceptance, keep reading events. `agent_end` closes one low-level agent run but retry,
overflow recovery, compaction, steering, and follow-ups can all follow. **`agent_settled` is the
"Pi will not continue on its own" signal.** Install the event listener *before* sending the
prompt, or a fast completion arrives before anyone is listening.

Shutdown is equally simple and equally easy to miss: **close the child's stdin**. Pi disposes the
runtime and exits; an extension can also request shutdown, in which case Pi finishes after the
current command or the active run's `agent_settled`.

## Framing rules

Strict JSONL. One complete JSON object per line, terminated with LF. The three traps the docs
call out, each of which a generic line reader fails:

1. **Split on LF only**, stripping an optional preceding CR. Unicode line separator (U+2028) and
   paragraph separator (U+2029) are *valid inside JSON strings* and are not boundaries. Node's
   `readline` splits on both — it is explicitly the wrong tool
   ([json.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md)).
2. **Read stdout continuously.** Pi honors backpressure, so a client that stops reading stalls
   the process. Honor stdin backpressure when writing.
3. **Stdout is protocol-only.** Diagnostics and logging go to stderr, and stderr is not protocol
   data. A real example from the probe below: a model-not-found warning appeared on stderr while
   every stdout byte stayed valid JSONL.

## Command inventory (33)

Counted from the reference page's headings on pi 1.5.0
([rpc-commands.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md)):

| Group | Commands |
|---|---|
| Prompting | `prompt`, `steer`, `follow_up`, `abort`, `clear_queue`, `new_session` |
| State | `get_state`, `get_messages` |
| Models | `set_model`, `cycle_model`, `get_available_models` |
| Thinking | `set_thinking_level`, `cycle_thinking_level`, `get_available_thinking_levels` |
| Queue modes | `set_steering_mode`, `set_follow_up_mode` |
| Compaction | `compact`, `set_auto_compaction` |
| Retry | `set_auto_retry`, `abort_retry` |
| Shell | `bash`, `abort_bash` |
| Session | `get_session_stats`, `export_html`, `switch_session`, `fork`, `clone`, `get_fork_messages`, `get_entries`, `get_tree`, `get_last_assistant_text`, `set_session_name` |
| Discovery | `get_commands` |

Behaviour worth knowing beyond the signatures:

- **`prompt` while streaming** errors unless it carries `streamingBehavior: "steer"` (deliver
  after the current turn's tool calls, before the next LLM call) or `"followUp"` (deliver when
  the agent stops). Extension commands such as `/mycommand` execute immediately even mid-run.
  `/skill:name` and prompt templates are expanded before sending; `steer`/`follow_up` reject
  extension commands.
- **`bash` is not a tool call.** It runs a shell command and stores a `BashExecutionMessage`
  that is folded into the next prompt's context as a `UserMessage` (unless
  `excludeFromContext`). Its output streams as `bash_execution_update` events immediately, but
  the model only sees it on the *next* prompt.
- **`get_entries` is the durable cursor**, not `get_messages`. It returns append-only session
  entries (including pre-compaction history and abandoned branches) with stable ids; pass the
  last id as `since` to resume incrementally across client restarts. An unknown `since` is a
  `success: false`. `leafId` tells you in one round trip whether the active branch moved.
- **`clear_queue` before `abort`** reproduces interactive Esc: pop the queued text, abort, then
  restore it in the client editor (`abort` alone *continues* messages left in the session).
- **`get_commands`** lists extension commands, prompt templates, and skills with `source` and
  `sourceInfo` (path, scope, package origin). Built-in TUI commands (`/settings`, `/hotkeys`)
  are absent by design — they only exist in interactive mode.

## Event stream

Session events are shared with `--mode json`; the JSON mode prepends a `session` header record
that RPC mode deliberately omits.

| Kind | Events | Notes |
|---|---|---|
| Agent | `agent_start`, `agent_end`, `agent_settled`, `turn_start`, `turn_end` | `agent_end` ≠ done; wait for `agent_settled` |
| Message | `message_start`, `message_update`, `message_end` | `message_end.message` is authoritative |
| Tool | `tool_execution_start`, `tool_execution_update`, `tool_execution_end` | Correlate on `toolCallId`; `durationMs` is the tool's own `execute()` time |
| Queue/state | `queue_update`, `entry_appended`, `session_info_changed`, `thinking_level_changed` | `queue_update` carries the whole current queue |
| Compaction | `compaction_start` (`manual`/`threshold`/`overflow`), `compaction_end` | `willRetry` on successful overflow recovery |
| Retry | `auto_retry_start`/`_end`, `summarization_retry_scheduled`/`_attempt_start`/`_finished` | `auto_retry_end.success:false` + `finalError` on final failure |
| RPC-only | `bash_execution_update`, `extension_error` | `extension_error` fires when an extension handler throws |

`message_update` is **delta-only on the wire**. The SDK's cumulative `message` field and each
`assistantMessageEvent.partial` snapshot are stripped so stream size stays linear. Reconstruct by
appending `delta` per `contentIndex`, then replace the block with the authoritative `content`
from `text_end` / `thinking_end` / `toolcall_end`, and replace the whole message with
`message_end.message`.

## Extension UI subprotocol

`ctx.mode` is `"rpc"` and `ctx.hasUI` is **true** in RPC mode, because `ctx.ui` works through a
request/response channel rather than a terminal
([rpc-extension-ui.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-extension-ui.md)):

| Class | Methods | Client obligation |
|---|---|---|
| Dialog | `select`, `confirm`, `input`, `editor` | Reply `extension_ui_response` with the same `id`, or Pi auto-resolves at `timeout` |
| Fire-and-forget | `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text` | Display or ignore; no reply |

Dialog replies carry `value` (select/input/editor), `confirmed` (confirm), or `cancelled: true`
(dismissed — the extension sees `undefined`, or `false` for confirm). An
`extension_ui_response` does **not** also produce a command response.

Several `ExtensionUIContext` members degrade to no-ops in RPC mode because they need a real
terminal: `custom()`, `onTerminalInput()`, `setFooter`/`setHeader`, `setEditorComponent`,
autocomplete providers, theme getters, and `setTheme()` (which returns
`{ success: false, error: "Theme switching not supported in RPC mode" }`). The docs' advice is to
guard terminal-only features on `ctx.mode === "tui"`, not on `ctx.hasUI`.

## Writing a client

TypeScript: the package exports `RpcClient`, which spawns the CLI, correlates ids, and exposes
typed methods — `prompt`, `steer`, `followUp`, `abort`, `clearQueue`, `newSession`,
`getState`, `setModel`, `cycleModel`, `setThinkingLevel`, `compact`, `setAutoCompaction`,
`setAutoRetry`, `bash`, `abortBash`, `getSessionStats`, `exportHtml`, `switchSession`,
`fork`, `clone`, `getEntries`, `getTree`, `getLastAssistantText`, `setSessionName`,
`getCommands`, plus the waiting helpers `waitForIdle`, `collectEvents`, and
**`promptAndWait`** — the latter installs the listener before prompting, which is why it does not
race a fast completion
([rpc-client.d.ts](https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.5.0)).

Any other language: use a **binary pipe reader**, not a text line reader. The docs' Python
example writes one `{"id":"prompt-1","type":"prompt","message":"…"}` line, then loops on
`process.stdout.readline()`, printing `assistantMessageEvent.delta` for
`type == "message_update"` and breaking on `agent_settled`.

## Verified probe (2026-11-03, pi 1.5.0)

Three commands piped into a fresh process, stdin closed afterwards:

```console
$ printf '{"id":"a1","type":"get_state"}\n{"id":"a2","type":"get_available_thinking_levels"}\n{"id":"a3","type":"bogus_command"}\n' \
  | pi --mode rpc --no-session --provider anthropic --model claude-sonnet-4-20250514
{"type":"extension_ui_request","id":"8184…","method":"setStatus","statusKey":"precompute"}
{"id":"a1","type":"response","command":"get_state","success":true,"data":{"model":{…},"thinkingLevel":"xhigh",…,"sessionId":"01a1a111-…","autoCompactionEnabled":true,"messageCount":0,"pendingMessageCount":0}}
{"id":"a2","type":"response","command":"get_available_thinking_levels","success":true,"data":{"levels":["off","minimal","low","medium","high","xhigh","max"]}}
{"id":"a3","type":"response","command":"bogus_command","success":false,"error":"Unknown command: bogus_command"}
```

What the run establishes beyond the docs:

- **Ids round-trip**, and an unknown command name is a clean `success: false` naming the command,
  not a crash — the `type` field is echoed into `command`.
- **`--no-session` still yields a `sessionId`** and omits `sessionFile` entirely, so a client
  must treat the field as optional.
- **The UI subprotocol runs outside any command.** Two fire-and-forget `setStatus` records
  (`statusKey: "precompute"`) arrived from a loaded extension, one at startup and one at
  shutdown, with no dialog and no reply. A client that assumes stdout is strictly
  request/response will mis-parse them.
- **stderr stays clean of protocol.** A `Warning: Model "claude-sonnet-4-20250514" not found for
  provider "anthropic". Using custom model id.` line landed on stderr while every stdout line
  parsed as JSON.
- **Closing stdin is a sufficient shutdown.** The process exited on its own; no `abort` or signal
  needed.

## Turn identity over RPC

RPC carries no turn id. `turn_start` / `turn_end` are in-process events, and a `prompt` response
carries none either, so a client that needs a durable per-turn key has to mint its own. T3 Code does
exactly that and only binds pi's tree afterwards; the mechanics are in
[t3-code-turn-storage-vs-pi-turn.md](./t3-code-turn-storage-vs-pi-turn.md).

## Gotchas

- `success: true` on `prompt` is acceptance, not completion. Wait for `agent_settled`, and skip
  that wait entirely when `disposition` is `"handled"`.
- Subscribe to events **before** prompting; `promptAndWait()` exists to make that ordering
  impossible to get wrong.
- `readline` and friends corrupt the stream on `U+2028`/`U+2029`. Split on LF in bytes.
- A client that stops draining stdout stalls Pi. Backpressure is honored in both directions.
- `bash` output reaches the model on the *next* prompt, not the current run.
- Use `get_entries` with `since` for resumable client state; `get_messages` is neither
  append-only nor branch-aware.
- `ctx.hasUI` is `true` in RPC mode. Guarding on it will not keep terminal-only UI code from
  running.
- `@file` arguments are rejected; `--name`/`-n` sets the initial session name that
  `get_state.sessionName` then reports.

## Packaging and distribution

- [T3 Code × pi — How an Orchestrator Drives the pi Coding Agent Over RPC](./t3-code-pi-coding-agent-integration.md) — the largest public client of this mode: what it sends, what it refuses to mirror, and the four `t3.*` records it injects into the stream.

- [Hosting Many pi Sessions From One Program](./hosting-many-pi-sessions.md) — how many RPC children a supervisor should hold, what each costs (~106 MB RSS), and why a fork is a second `--fork` process rather than a session swap.

Shipping RPC mode inside a product — spawned CLI, `bun build --compile` binary, and the `jiti` wall that makes `--no-extensions` necessary — is measured in [Packaging pi Into Your App](./pi-packaging-into-your-app.md).

## Changelog

- 2026-11-03: Initial write-up from the pi 1.5.0 bundled docs, the exported `RpcClient` type
  declarations, and a live three-command probe. GitHub doc links verified to resolve.
