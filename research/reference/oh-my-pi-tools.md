---
title: oh-my-pi (omp) — Complete Agent Tool Inventory
category: reference
tags: [oh-my-pi, omp, tools, coding-agent, reference, lsp, dap, subagents]
status: draft
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/builtin-names.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/index.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/essential-tools.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/xdev.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/vibe.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/sdk.ts
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/vibe-mode.md
confidence: medium
---

# oh-my-pi (omp) — Complete Agent Tool Inventory

## Summary

At commit `40e9368ef0458fd9073329cdff4174895f91bc6b` (v18.8.4, 2026-10-08)
omp exposes **40 model-callable tools** across four groups: **30 built-ins** in
the `BUILTIN_TOOLS` registry, **3 hidden** (`think`, `yield`, `goal`), **5
vibe-mode worker controls**, and **2 settings-gated custom tools**
(`generate_image`, `tts`). A further **4 eval preludes** (`browser`,
`computer`, `ratchet`, `archive`) are capabilities called from inside the
`eval` kernel — explicitly *not* tools, with no schema or renderer.

Each tool declares an **approval tier** (`read` < `write` < `exec`, or a
function of its arguments) and a **load mode** (`essential` = always top-level,
`discoverable` = mounted under `xd://` when `tools.xdev` is on).

## Details

### A. Built-in registry — 30 tools

Canonical source: `BUILTIN_TOOL_NAMES` in
[`builtin-names.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/builtin-names.ts) and
the `BUILTIN_TOOLS` factory map in
[`tools/index.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/index.ts). Legacy alias:
`search` → `grep`.

| # | Tool | Approval | Load | Summary | Gate (default) |
| ---: | --- | --- | --- | --- | --- |
| 1 | `read` | fn → `read` or `exec` | essential | Files, dirs, archives, SQLite, PDFs, notebooks, images, URLs, `ssh://`, internal `scheme://` — one `path` string | always |
| 2 | `write` | fn → `write` | essential | Create/overwrite a file, archive entry, SQLite row, or conflict resolution | always |
| 3 | `edit` | fn → `write` | essential | Hashline (content-hash anchored) patches; stale anchors rejected | always |
| 4 | `bash` | fn | essential | Persistent shell (embedded brush); PTY, background jobs, supervised services | `bash.enabled` (true) |
| 5 | `glob` | `read` | essential | Path lookup by glob; `;`-separated, internal URLs | `glob.enabled` (true) |
| 6 | `grep` | fn → `read` | discoverable | Regex over files, globs, internal URLs | `grep.enabled` (true) |
| 7 | `find` | `read` | essential | **Semantic** grep — describe behavior, get files + line ranges with relevance scores | `find.enabled` = `auto` → needs a native "System One" judge |
| 8 | `ast_grep` | `read` | discoverable | Structural code search via ast-grep | `astGrep.enabled` (**false**) |
| 9 | `ast_edit` | fn | discoverable | Structural rewrites, previewed then applied atomically | `astEdit.enabled` (true) |
| 10 | `task` | `exec` | essential | Spawn subagents — one per call or `tasks[]` batch; isolation + schema-validated results | `task.maxRecursionDepth` = 2 |
| 11 | `wait` | `read` | essential | Block until next background result, peer message, or steering interrupt | `async.enabled` (true) / IRC / `launch.enabled` |
| 12 | `todo` | `read` | discoverable | Ordered mutations over the session todo list with phases | `todo.enabled` (true); withheld when `requireYieldTool` unless prewalk-armed |
| 13 | `ask` | `read` | discoverable | Structured option-picker / free-form questions to the interactive user | `ask.enabled` (true) **and** `canPromptUser \|\| hasUI` |
| 14 | `eval` | `exec` | essential | Persistent Python **and** JS/Bun cells; tool re-entry, `agent()`, `workpool()`, `judge()` | any backend reachable |
| 15 | `web_search` | `read` | discoverable | One query through the configured provider chain | `web_search.enabled` (true) |
| 16 | `github` | fn | discoverable | GitHub CLI ops — repo, files, PRs, search, Actions run-watch | `github.enabled` (**false**) + `gh` available |
| 17 | `lsp` | fn | discoverable | 14 actions: diagnostics, definition, references, hover, symbols, rename, rename_file, code_actions, type_definition, implementation, status, reload, capabilities, request | `lsp.enabled` (true) + session not LSP-disabled |
| 18 | `debug` | fn | discoverable | DAP session driver (28 ops) — breakpoints, stepping, threads, stack, scopes, variables, read/write memory, disassemble | `debug.enabled` (true) |
| 19 | `ida` | fn | discoverable | Open/edit/script IDA Pro databases via shared daemon-broker hosts | `ida.available` (idalib install found) |
| 20 | `security_scan` | `exec` | discoverable | Native security review planning + Codex Security cloud scans | `security.enabled` (**false**) |
| 21 | `checkpoint` | `read` | discoverable | Mark conversation state so `rewind` can collapse it later | `checkpoint.enabled` (**false**) + top-level-or-explicit |
| 22 | `rewind` | `read` | discoverable | End a checkpoint, prune exploratory context, keep a report | same as `checkpoint` (paired) |
| 23 | `context_notes` | fn | essential | Read/replace the branch's persistent experimental context notebook | `compaction.experimentalContextManagement` (**false**) |
| 24 | `new_context` | `write` | essential | Request a fresh context window, preserving notebook + recoverable history | `compaction.experimentalContextManagement` (**false**) |
| 25 | `memory_edit` | `read` | discoverable | Update/forget/invalidate Mnemopi memories by id | `memory.backend` = `mnemopi` |
| 26 | `recall` | `read` | discoverable | Search the active memory backend | `memory.backend` ∈ {hindsight, mnemopi} |
| 27 | `reflect` | `read` | discoverable | Synthesize an answer over the memory backend | `memory.backend` ∈ {hindsight, mnemopi} |
| 28 | `retain` | fn | discoverable | Store durable facts through the memory backend | `memory.backend` ∈ {hindsight, mnemopi} |
| 29 | `learn` | fn | essential | Capture a reusable lesson; optionally promote it to a managed skill | `autolearn.enabled` (**false**) + backend ∈ {hindsight, mnemopi, local} |
| 30 | `manage_skill` | `write` | essential | Create/update/delete an isolated managed skill | `autolearn.enabled` (**false**) |

### B. Hidden tools — 3

Declared in `HIDDEN_TOOL_NAMES`, not advertised in the default inventory:

| Tool | Approval | When it appears |
| --- | --- | --- |
| `think` | `read` | Private scratchpad thoughts; only when `externalThinking` is on **and** the active model supports suppressing native reasoning |
| `yield` | `read` | Submits structured subagent output (`{ data }` / `{ error }`); added when the session sets `requireYieldTool` |
| `goal` | fn | Goal-mode objective management (`create`/`get`/`resume`/`complete`/`drop`); needs `goal.enabled` (true) and no restricting session |

### C. Settings-gated custom tools — 2

These are **not** in `BUILTIN_TOOLS`; the SDK injects them into the registry
when their feature flag is on (`packages/coding-agent/src/sdk.ts`), and removes
them again on reconcile. Both are `write` tier.

| Tool | Setting (default) | What it does |
| --- | --- | --- |
| `generate_image` | `generate_image.enabled` (**false**) | Text-to-image generation and editing; writes to temp paths. Exposed as an `xd://` device when `tools.xdev` is on |
| `tts` | `speechgen.enabled` (**false**) | Speech synthesis to an audio file via the `speech` model role (local Kokoro or xAI Grok Voice) |

### D. Vibe-mode worker controls — 5

`/vibe` replaces the top-level toolset with a **read-only director** surface:
`read`, optionally a parent-owned `todo`, plus these five
([`docs/vibe-mode.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/vibe-mode.md),
[`src/tools/vibe.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/vibe.ts)):

| Tool | Approval | Signature / effect |
| --- | --- | --- |
| `vibe_spawn` | `exec` | `{ cli: "fast" \| "good", prompt, name? }` — start a blank worker with a self-contained brief |
| `vibe_send` | `exec` | `{ session, message }` — steer a streaming turn, queue a next turn, or start one if idle |
| `vibe_wait` | `read` | `{ sessions?, timeout? }` — wait for the first watched turn to settle (default 30 s) |
| `vibe_kill` | `read` | `{ session }` — cancel the turn, clear the queue, release the worker |
| `vibe_list` | `read` | `{}` — sessions in spawn order with tier, state, turn/queue counts, resolved model |

### E. Eval preludes — 4 (not tools)

Capabilities available **inside** `eval` cells, with no parameter schema,
renderer, or load mode. They never enter the model tool inventory
([`src/eval/preludes.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/eval/preludes.ts)):

| Prelude | Gate (default) | What it exposes |
| --- | --- | --- |
| `browser` | `browser.enabled` (true) | Tabs over headless Chromium, CDP-attached apps, or your own Chrome via the relay extension |
| `computer` | `computer.enabled` (**false**) | Host desktop: windows, screenshots, native input, OS accessibility tree, clipboard |
| `ratchet` | `ratchet.enabled` (**false**) | Ratchet test-fraction / off-limits runner contract |
| `archive` | `archive.enabled` (true) | Archive read/write helpers |

### F. Approval and presentation model

**Approval tiers** (`packages/coding-agent/src/tools/approval.ts`) are ordered
`read` < `write` < `exec`. A tool may declare a static tier or a function of
its arguments (`read`, `write`, `edit`, `bash`, `grep`, `github`, `lsp`,
`debug`, `ida`, `ast_edit`, `context_notes`, `retain`, `learn`, `goal`).
Resolution order: per-tool user policy (`tools.approval.<tool>` = `allow` |
`deny` | `prompt`) → approval mode (`always-ask` | `write` | `yolo`,
schema default `yolo`) → tier. Missing context is **fail-closed** to
`always-ask`.

**Load modes** (`tools/essential-tools.ts`): `essential` tools stay in the
top-level schema; `discoverable` tools are unmounted into `xd://` virtual
devices when `tools.xdev` is on (default **true**), reachable as
`read xd://` (list), `read xd://<tool>` (docs + schema), and
`write xd://<tool>` (execute with a JSON args object). Five tools are pinned
top-level regardless (`XDEV_KEEP_TOP_LEVEL`): `todo`, `yield`, `ask`,
`grep`, `web_search`; `read` and `write` are the transport itself.

Essential (13): `read`, `write`, `bash`, `edit`, `glob`, `find`, `eval`,
`task`, `wait`, `learn`, `manage_skill`, `context_notes`, `new_context`.

### G. Discovery, not tools

Beyond the tool list, omp resolves **16+ internal URL schemes** inside the
FS-shaped tools (`read`, `grep`, `glob`, `write`): `agent://`,
`artifact://`, `attachment://`, `cfg://`, `conflict://`, `history://`,
`issue://`/`pr://`, `local://`, `mcp://`, `memory://`, `omp://`,
`proc://`, `rule://`, `security://`, `skill://`, `ssh://`, `vault://`,
`xd://`. `read xd://` lists the mounted device set.

### H. Subagent agent types (for `task`)

Bundled agent definitions in `task/agents.ts`: `scout`, `reviewer`,
`security-reviewer`, `task` (model `@task`), `sonic` (model `@smol`).
Custom agents are discovered from project/user/plugin roots
([`docs/task-agent-discovery.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/task-agent-discovery.md)).

## Gotchas

- **"31 built-in tools" in the README is off by one.** The registry holds 30.
  The README's own per-tool prose lists `generate_image` and `tts` among
  "core tools", but those two are settings-gated custom tools injected by the
  SDK, not registry entries. Adding them to the 30 gets you 32; the honest
  count of *model-callable* tools with everything enabled is **40**
  (30 + 3 hidden + 5 vibe + 2 custom).
- **`read`'s approval tier is argument-dependent.** Internal-URL routing can
  raise it, and reading a PDF as an image (a selector without `:raw`) returns
  `exec` rather than `read`.
- **Hidden ≠ unavailable.** `think`, `yield`, and `goal` are real tools that
  materialize under specific session conditions; they are simply excluded from
  the default inventory listing.
- **`find` is not always present.** Its default is `auto`, which requires a
  native "System One" judge model; with a prompted small judge, `find` is
  absent and `grep`'s prompt drops its `find` hint.
- **Auto-includes can widen a tool list.** A requested list containing
  `grep` pulls in `ast_grep` (if enabled), `edit` pulls in `ast_edit`,
  `checkpoint`/`rewind` are a safety pair, and `read`+`grep` with
  experimental context management pulls in `context_notes`+`new_context`.
  Restricted (subagent) sessions are exempt except for the checkpoint pairing.
- **`todo` disappears for structured subagents.** When a session sets
  `requireYieldTool`, `todo` is withheld unless the subagent is
  prewalk-armed.
- **Preludes are not tools.** `browser`, `computer`, `ratchet`, and
  `archive` have no schema and cannot be called directly; they are reached as
  helpers inside `eval` cells.
- Counts are from a pinned commit and will drift; re-verify against
  `BUILTIN_TOOL_NAMES` before relying on them.

## Related

- [oh-my-pi (omp) — Feature Inventory](./../technology/oh-my-pi-features.md)
- [oh-my-pi — Native Rust Core (pi-shell, pi-natives)](./../technology/oh-my-pi-native-rust-core.md)

## Changelog

- 2026-10-08 — created from the pinned clone `40e9368ef0458fd9073329cdff4174895f91bc6b`
  (v18.8.4): `builtin-names.ts`, `tools/index.ts` (`resolveBuiltinToolPlan`,
  `isToolAllowed`), per-tool `createIf`/approval/loadMode declarations,
  `tools/essential-tools.ts`, `tools/xdev.ts`, `tools/vibe.ts`, `sdk.ts`
  prelude wiring, and `docs/tools/`. **TinyFish was unavailable in this
  environment** (no `mcp__tinyfish__*` tools registered); per AGENTS.md §2.6 the
  fallback was the project's own source and in-repo docs — no third-party web
  search or scraping.
