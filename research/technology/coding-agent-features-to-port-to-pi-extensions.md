---
title: Coding-Agent Features Worth Porting to Pi as Extensions — Amp, Claude Code, Codex, OpenCode and Peers
category: technology
tags: [coding-agent, pi, extensions, amp, claude-code, codex, opencode, hooks, subagents, permissions]
status: complete
created: 2026-10-26
updated: 2026-10-26
sources:
  - https://ampcode.com/docs
  - https://code.claude.com/docs/en/hooks
  - https://opencode.ai/docs/plugins/
  - https://learn.chatgpt.com/docs/developer-commands
  - https://learn.chatgpt.com/docs/sandboxing
  - https://opencode.ai/docs/permissions/
  - https://cursor.com/docs/rules
  - https://docs.cline.bot/core-workflows/checkpoints
  - https://aider.chat/docs/git.html
  - https://code.claude.com/docs/en/checkpointing
  - https://code.claude.com/docs/en/permissions
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
confidence: medium
---

# Coding-Agent Features Worth Porting to Pi as Extensions

## TL;DR

- **Seven primitives account for almost every worthwhile feature** across Amp, Claude Code,
  Codex, OpenCode and the peers: permissions, external-process hooks, checkpoints, a
  second-opinion advisor, scoped instruction files, declarative agent profiles, and the
  post-edit feedback loop. The rest is packaging, or hosted infrastructure that does not port.
- **pi's biggest gap is permissions.** Seven independent products ship a per-tool, per-argument
  allow/ask/deny policy with a one-flag auto mode. pi's own docs say it never asks before
  running a tool, and its `permission-gate.ts` example is a proof of concept, not a policy
  engine. This is the one row that is both missing and consensus.
- **pi's biggest missing *seam* is out-of-process hooks.** Claude Code runs shell, HTTP, prompt
  and agent handlers on 33 lifecycle events and uses the exit code as the decision. pi's hooks
  are richer but in-process TypeScript only, so a hook cannot be a bash script.
- **Best value per unit effort: the Oracle/advisor tool** (`S`) — Amp's Oracle, Claude Code's
  advisor and Aider's architect are the same idea: one `registerTool` + one
  `ctx.modelRegistry.streamSimple()` call on a stronger model with a read-only loadout.
- **The sleeper is Codex's `/import`** — read a Claude Code / Cursor setup and emit pi skills,
  prompt templates and extension config. Cheapest adoption lever on the board.
- **Most of what peers ship, pi already has**: `--print`/`--mode json`/`--mode rpc`, session
  fork/resume, compaction, providers, MCP, themes, prompt templates. The port list is short
  because the platform is not.
- **2026 corrections that invalidate the 2025 landscape:** Amp deleted handoff, fork, the VS Code
  extension, slash commands and default approvals; Gemini CLI was replaced by Antigravity CLI
  on 2026-06-18; Continue was acquired by Cursor.

## Context

Question: across the shipping coding agents (Amp, Claude Code, Codex CLI, OpenCode, and
peers such as Cursor CLI, Copilot CLI, Gemini CLI, Aider, Cline/Roo, Crush, goose, Zed,
Kiro), which user-visible features are worth rebuilding as **pi extensions** — and which
are either already native to pi, cosmetic, or impossible without native code or hosted
infrastructure?

Read date **2026-10-26**. Method: a six-worker swarm, each worker fetching vendor docs
through TinyFish and writing its own inventory to `/tmp/swarm-pi-ext/<slice>.md`; this
file is the synthesis. The pi side was read from the installed docs at
`@earendil-works/pi-coding-agent/docs/` (extensions.md 400 lines, tui.md 195,
compaction.md 463, mcp.md 272, virtual-models.md 114, sdk.md 147, skills.md 93).

Prior work in this repo, built on rather than repeated:

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — already covers the compaction axis for Claude Code, Codex, OpenCode, pi, Gemini CLI, Cursor and Amp.
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) and [omp Tool Inventory](../reference/oh-my-pi-tools.md) — omp is a pi fork, so it is the existing proof of what pi's architecture can be pushed to; its native-Rust parts are out of scope here.

## 1. What pi can already express

A port is only worth proposing where pi's extension API has a seat for it. This matrix is
read off the installed docs, not inferred:

| Capability | Expressible? | The API, or what blocks it |
|---|---|---|
| Custom tool with schema | yes | `pi.registerTool` — TypeBox params, `execute()`, `content` + `details`, optional `outputSchema`/`structuredContent` |
| Slash command with args | yes | `pi.registerCommand`; `ExtensionCommandContext` adds wait-for-idle, reload, session replacement |
| Keyboard shortcut / CLI flag | yes | `pi.registerShortcut`, `pi.registerFlag` |
| Intercept a tool call before it runs | yes | `tool_call` hook — mutate `input` or return `{ block: true, reason }`; a handler that throws fails closed |
| Rewrite a tool result after it runs | yes | `tool_result` — replace `content` and `structuredContent` |
| Inject context before a run | yes | `before_agent_start` (`systemPromptOptions`, `messageType`), `context`, `context_with_system` |
| Replace the compaction summarizer | yes | `session_before_compact` (+ `session_compact_failed`); `examples/extensions/custom-compaction.ts` |
| Register an MCP server at runtime | yes | `pi.registerMcpServer(name, config)` / `unregisterMcpServer`, incl. `exposure` and `toolExposure` |
| Custom model provider | yes | `pi.registerProvider` |
| Per-request model routing | yes | `pi.registerVirtualModel({ route(request, ctx) })` returning `{ model, thinkingLevel }`, plus branch-persisted router `state` |
| Classifier / second-opinion model call | yes | `ctx.modelRegistry.streamSimple()`, `classify()`, `findOfType("classifier")` |
| Persistent off-context state | yes | `pi.appendEntry()` (durable, not sent) vs tool-result `details` (branch-following) vs `pi.sendMessage()` (in-context) |
| Custom TUI rendering | yes | `renderCall`/`renderResult`, `pi.registerToolRenderer((toolName, next) => …)`, `ctx.ui.custom()` |
| Notifications, dialogs, status, widgets | yes | `ctx.ui` — `notify`, `confirm`, `status`, `widget`, `title`, `editor` |
| Permission gate / approval policy | yes | `tool_call` + MCP-style `annotations` (`readOnlyHint`, `destructiveHint`, `openWorldHint`) + `ctx.ui.confirm`; `examples/extensions/permission-gate.ts` |
| Tool-search / lazy tool surface | yes | `exposure: direct / model-only / codemode / deferred / hidden` + `prepareLoadout()` — `codemode` itself is built only from these |
| Nested tool calls from a tool | yes | `ctx.executeTool(name, args, { signal, onUpdate })`; re-enters validation and hooks, keeps `parentToolCallId` |
| Background process outliving a turn | **no** (needs supervision) | `pi.exec` is one-shot: it buffers output and returns. Start children from `session_start`/a tool and supervise them yourself, with a PTY dependency for anything interactive; no API for a long-running child, so output cannot stream into a tool result |
| File-snapshot undo / checkpoints | yes-with-caveat | No filesystem journal: `tool_call` runs before a write but cannot read the pre-image, `tool_result` runs after the bytes changed, and bash writes bypass both. Needs a shadow VCS (`git stash create`) or wrapped mutating tools |
| Shell-command hooks (Claude Code style) | yes-with-caveat | Nothing runs argv on an event today; an extension can, but pi's own hooks are in-process TypeScript — a bridge is the extension |
| Block/steer a queued message mid-turn | no | Not exposed to extensions; `input` sees raw input before a run, not mid-run steering |
| Subagent fan-out | yes-with-caveat | No first-class subagent primitive or control plane; the SDK supports it and two installed extensions do it (`nested-agents`, `repo-scout`), but each port re-implements session lifecycle, locking, cancellation and cleanup |
| Hosted thread store, share links, cloud machines | no | Requires a service; out of scope for an extension |

Three consequences that shape the port list:

1. **Nothing in the tool/permission/routing layer needs native code.** Every primitive above
   is TypeScript over the extension API, which is why so many of the rows below are S or M.
2. **The missing seam is event-shaped, not tool-shaped.** pi has richer hooks than most peers
   in-process, but has no way to run *external* commands on those hooks — the Claude Code
   contract (exit 0 allow, exit 2 block + stderr, other = warn) has no equivalent.
3. **Anything hosted is disqualified on principle** — Orbs, cloud tasks, share links,
   multiplayer — regardless of how good the feature is.

## 2. Amp (ampcode) — the smallest surface, the sharpest primitives

Amp is the cautionary case for this whole exercise: **most of what the 2025 manual described
has been deleted.** Between 2025-10 and 2026-10 Sourcegraph removed the VS Code extension
(2026-03-05), forking (2026-01-13), handoff (2026-05-06, replaced by auto-compaction at 90%),
the TODO tool, slash and custom commands, themes, and default tool approvals. `/manual` now
redirects to `/docs`; the package renamed `@sourcegraph/amp` to `@ampcode/cli` on 2026-05-14.
Permissions ship as a built-in plugin, so "port the allow-lists" means port a **policy hook**,
not a config file. Whatever is ported here should be ported for the primitive, not because
Amp still has it.

| Feature | What it does | pi surface | Value | Effort | Evidence |
|---|---|---|---|---|---|
| **Oracle** | Read-only second-opinion subagent on a stronger, slower model, exposed as a tool | `registerTool` + `streamSimple` + read-only loadout | 5 | S | https://ampcode.com/docs/tools |
| **Review agent + Checks** | `amp review`; one reviewer agent per `.agents/checks/*.md` | command + skills + subagent fan-out | 5 | M | https://ampcode.com/news/liberating-code-review |
| **Secret redaction** | Rewrites secrets to `[REDACTED:aws-access-key-id]` before they reach the model | `tool_result` + `before_provider_request` | 4 | M | https://ampcode.com/news/secret-redaction |
| **Tool policy hook** | Per-tool, per-argument allow / reject / ask / delegate | `tool_call` | 4 | M | https://ampcode.com/news/tool-level-permissions |
| **Skill-scoped MCP** | `mcp.json` beside a SKILL.md loads only `includeTools` when the skill loads | skill hook + `registerMcpServer` | 4 | M | https://ampcode.com/docs/customize/skills |
| **Glob-scoped AGENTS.md** | Subtree guidance loads on read; `globs:` front matter gates rules | `context` hook | 4 | M | https://ampcode.com/docs/customize/agents-md |
| **Goal-directed handoff** | Extracts only the next task's context into a fresh session | command + fork | 4 | S | https://ampcode.com/news/handoff |
| **Dial role routing** | One mode = model + effort + prompt + tools + oracle | `registerVirtualModel` | 4 | M | https://ampcode.com/docs/the-dial |
| **Thread references** | `@T-…` pulls another thread in, extracted by a reader subagent | tool + skill | 4 | M | https://ampcode.com/docs/threads |
| Thread naming + labels | Auto-title, rename, labels, `label:` search | hook + command + UI | 3 | S | https://ampcode.com/docs/threads |
| Commit provenance | `Amp-Thread-ID` + coauthor trailers link commits to threads | `tool_call` on bash | 3 | S | https://ampcode.com/docs/cli/settings |
| Thread map | Graph of fork/handoff/mention lineage | TUI + command | 3 | M | https://ampcode.com/news/thread-map |
| Thread export | `.md` per thread URL, `amp threads markdown T-…` | command | 3 | S | https://ampcode.com/docs/threads |
| Calibrated decisions | `amp.ai.decide` returns typed choices with probabilities | provider + classifier model | 3 | M | https://ampcode.com/docs/customize/decision-models |
| Headless stream JSON | `-x --stream-json`, stdin multi-turn, Claude Code compat | command (wraps the CLI) | 3 | M | https://ampcode.com/docs/cli/streaming-json |
| Ship workflow | Commit, push, PR follow-up with an editable prompt | command + hook | 3 | S | https://ampcode.com/docs/projects |

**Why Oracle is the single best row on this board.** Amp deliberately under-prompts the
oracle so cost only lands when the main agent asks for a second opinion. In pi that is one
`registerTool` with a read-only loadout (`ctx.executeTool` reachable only to read/grep/glob),
one `ctx.modelRegistry.streamSimple()` call on a pinned stronger model, and `usage` folded
into the tool result so session totals stay honest. Effort S, and it improves the main loop
without slowing it.

**Why secret redaction is second.** It is the only feature here that changes the threat model
rather than the ergonomics: pi's `tool_result` hook can rewrite content *and*
`structuredContent` before the model ever sees it, and `before_provider_request` can catch
secrets that arrive by another path. Nobody else in this comparison ships it as a first-class
primitive.

**Not worth porting from Amp:** Orbs, runners, Puck, Slack, multiplayer, Space (hosted
infrastructure); share links and visibility tiers (hosted store, native-required); cross-client
remote control (relay service); thread colours/pin/snooze (cosmetic); `amp.tools.disable`
(pi's active-tool set already does it); `ask_user_choice` (`ctx.ui` dialogs); `AMP_TOOLBOX`
executables (MCP supersedes); the editor review panel/Tab/diagnostics (extension killed
2026-03-05).

## 3. Codex — a workstation product now, and `/import` is its best idea

Codex CLI has become a surface of the larger "ChatGPT Work" product: config is layered
(`~/.codex/config.toml`, project `.codex/config.toml`, `--profile` files, managed org policy),
hooks exist as **managed MCP hooks that run on the cloud coordinator**, skills can declare MCP
dependencies, and command execution is resumable (`features.unified_exec`, `write_stdin`).
Most of that is infrastructure, and infrastructure does not port. Three things do.

| Feature | What it does | pi surface | Value | Effort | Evidence |
|---|---|---|---|---|---|
| **`/import`** | Imports a Claude Code or Cursor setup into Codex | command | 4 | M | https://learn.chatgpt.com/docs/developer-commands |
| **`/goal`** | Sets a task goal; the model checks it after turns | `agent_before_settle` | 4 | S | https://learn.chatgpt.com/docs/developer-commands |
| **Auto review of denials + `/approve`** | A denied action is reviewed, then approvable in-session | `tool_call` + UI | 4 | M | https://learn.chatgpt.com/docs/developer-commands |
| `/worktree` | Continues the session in a git worktree | command | 3 | M | https://learn.chatgpt.com/docs/developer-commands |
| `/diff` | Reviews the working-tree diff in-session | command + UI | 3 | S | https://learn.chatgpt.com/docs/developer-commands |
| Resumable exec (`write_stdin`) | A long command stays alive and accepts stdin | blocked by pi's gap 1 | 4 | L | https://learn.chatgpt.com/docs/config-file/config-reference |
| Permission profiles + `/permissions` | Named approval/sandbox policy sets, switchable mid-session | `tool_call` + command | 4 | M | https://learn.chatgpt.com/docs/sandboxing |
| `/debug-config` | Shows the resolved config layers | command | 3 | S | https://learn.chatgpt.com/docs/developer-commands |
| Sandbox modes (seatbelt / landlock / Windows) | OS-level syscall and network confinement | native-required | 4 | — | https://learn.chatgpt.com/docs/sandboxing |
| Managed MCP hooks, plugins, marketplaces | Org policy, hook callbacks on a cloud coordinator | native-required (hosted) | 2 | — | https://learn.chatgpt.com/docs/config-file/config-reference |

**`/import` is the sleeper.** Every agent in this study competes for the same users, and the
cheapest adoption lever is reading the *other* agent's config: `.claude/settings.json` hooks,
`CLAUDE.md`, `.cursor/rules/*.mdc`, `AGENTS.md`. For pi — which has no built-in permission
engine, no hook file format, and a narrower instruction-file scope — an importer that reads
Claude Code settings and Cursor rules and emits pi skills, prompt templates, and an extension
config would convert a locked-in setup into a working pi setup in one command. Codex shipped
exactly this, which is the strongest evidence that the demand is real.

**Auto review of denials** is the other idea worth stealing: a denial is not a terminal state,
it is a queue. Claude Code asks, Codex defers the decision to a reviewer and exposes it as
`/approve`, and pi's `tool_call` hook can already *defer* by returning a reason — what is
missing is the queue and the UI to drain it.

**Not worth porting from Codex:** managed MCP hooks and plugin marketplaces (cloud coordinator
infrastructure); the OS sandbox implementations (native system calls — pi could only wrap an
existing sandbox binary); `/pets`, `/theme`, `/title`, `/statusline` (cosmetic, and pi's
`ctx.ui` covers status and title); `/memories` (value 2, silent context growth); config-layer
profiles beyond a thin `--profile` flag.

*(This section was written in the main thread from a targeted TinyFish fetch of
`learn.chatgpt.com` — the dedicated Codex worker did not report before the write-up began. The
row set is smaller than the other inventories for that reason; see Open questions.)*
## 4. Claude Code — hooks are the product, everything else is packaging

Claude Code has the largest surface in the set (40 candidate features in the worker's
inventory) and the least portable one: its differentiator is not a feature but a **protocol** —
hooks defined in a settings file, executed as external processes, with a documented
block/allow/ask contract. That is the one thing pi cannot do today.

| Feature | What it does | pi surface | Value | Effort | Evidence |
|---|---|---|---|---|---|
| **Settings-file hooks** | Shell/HTTP/MCP/prompt/agent handlers on 33 lifecycle events | hook bridge (missing) | 5 | M | https://code.claude.com/docs/en/hooks |
| **`PreToolUse` decision protocol** | allow/deny/ask/defer + `updatedInput` + `additionalContext` | `tool_call` | 5 | S | https://code.claude.com/docs/en/hooks |
| **Permission modes** | default/acceptEdits/plan/auto/dontAsk/bypassPermissions | `tool_call` + UI | 5 | L | https://code.claude.com/docs/en/permission-modes |
| **Permission rules** | `Tool(specifier)` allow/ask/deny, param matching, `additionalDirectories` | `tool_call` | 5 | L | https://code.claude.com/docs/en/permissions |
| **Skill frontmatter semantics** | `allowed-tools`, `model`, `effort`, `paths`, `context: fork`, `user-invocable` | command + hook | 5 | M | https://code.claude.com/docs/en/skills |
| Skill/agent-scoped hooks | Hooks declared in a SKILL.md or agent frontmatter, with `once` | hook | 4 | S | https://code.claude.com/docs/en/hooks |
| Skill re-injection after compaction | Invoked skill bodies re-attached, 5k per skill, 25k total | `session_before_compact` | 4 | S | https://code.claude.com/docs/en/context-window |
| Subagent frontmatter | 17 fields; the load-bearing ones are tools, model, maxTurns, skills, mcpServers, isolation | tool + hook | 4 | M | https://code.claude.com/docs/en/sub-agents |
| Fork subagents | Subagent inherits the parent conversation, is observable and steerable | tool (thin) | 3 | S | https://code.claude.com/docs/en/sub-agents |
| Dynamic workflows | A JS script orchestrates dozens of subagents, resumable | tool | 4 | L | https://code.claude.com/docs/en/workflows |
| `/goal` | Model checks a completion condition after every turn | `agent_before_settle` | 4 | S | https://code.claude.com/docs/en/goal |
| `asyncRewake` hooks | Background hook wakes the agent on exit 2 | hook | 4 | S | https://code.claude.com/docs/en/hooks |
| `onFailure: block` | A hook that cannot start blocks the action | hook | 3 | S | https://code.claude.com/docs/en/hooks |
| Hook `if` prefilter | Evaluates one permission rule before running the hook | hook | 3 | S | https://code.claude.com/docs/en/hooks |
| Output styles | Named instruction sets that reshape every response | command | 4 | S | https://code.claude.com/docs/en/output-styles |
| CLAUDE.md hierarchy | Root-to-cwd concat, nested lazy load, `@import` depth 4 | `context` hook | 4 | M | https://code.claude.com/docs/en/memory |
| `.claude/rules/` path globs | Rules load only when matching files are touched | `context` hook | 3 | S | https://code.claude.com/docs/en/memory |
| Checkpoints + `/rewind` | Snapshot per prompt; restore code, conversation, or both | command + shadow VCS | 4 | M | https://code.claude.com/docs/en/checkpointing |
| Summarize from/up to here | Compaction scoped to a transcript region | `session_before_compact` | 3 | M | https://code.claude.com/docs/en/checkpointing |
| **Advisor tool** | Consults a stronger model mid-task with the full transcript | tool + `streamSimple` | 4 | M | https://code.claude.com/docs/en/advisor |
| `opusplan` | Opus while planning, switches to Sonnet to execute | virtual model | 4 | M | https://code.claude.com/docs/en/model-config |
| Fallback model chain | Try listed models when the primary is overloaded | provider | 4 | M | https://code.claude.com/docs/en/model-config |
| `/context` | What actually consumes the window: skills, MCP, CLAUDE.md | command | 3 | S | https://code.claude.com/docs/en/sessions |
| `/usage` | Token/cost panel plus plan-limit advice | command | 3 | M | https://code.claude.com/docs/en/costs |
| Budget cap | `--max-budget-usd` stops the run | hook | 3 | S | https://code.claude.com/docs/en/cli-reference |
| Monitor tool | Watches a process, log, or WebSocket and interjects on events | tool | 3 | M | https://code.claude.com/docs/en/tools-reference |
| OTel telemetry | `claude_code.*` metrics, logs and spans with GenAI attributes | hook | 3 | M | https://code.claude.com/docs/en/monitoring-usage |
| `/doctor` | Audits installs, hooks, skills, context cost, permissions | command | 3 | M | https://code.claude.com/docs/en/skills |

**The hook protocol is the port.** Not the individual events — pi already has more in-process
event seams than Claude Code has hook points. What Claude Code adds is the *out-of-process*
shape: a hook is an argv (or an HTTP endpoint, or an MCP tool) plus a JSON payload on stdin,
and the exit code carries the decision — `0` allow, `2` block and feed stderr back to the
model, anything else a non-blocking warning. That shape is what makes hooks writable in bash,
Python, or Go by people who will never learn a TypeScript extension API. pi's equivalent would
be a small extension that reads a `hooks.json`, spawns the command per event, and translates
the exit code into `{ block, reason }` for `tool_call`, a message for `before_agent_start`, or a
notification for `agent_settled`.

**Two convergences worth naming.** Claude Code's `advisor` tool is Amp's `Oracle` under a
different name — both let the main model consult a stronger, slower model with the transcript
already loaded, and both are a `registerTool` + `streamSimple` in pi. And `opusplan` is pi's
`registerVirtualModel({ route })` with a two-phase router, which pi's own `jev-router.ts`
example already demonstrates.

**Not worth porting from Claude Code:** custom slash commands (merged into skills in 2.1.x and
covered by pi's prompt templates); session branch/fork/resume, headless `-p`, effort levels
(all native to pi already); agent teams (peer sessions over a network — native-required);
plugins and marketplaces plus "Mods" (a hosted distribution and runtime story, and Mods is
the extension runtime itself, which is what pi already is); auto memory (value 2).

## 5. OpenCode — the permission engine is the feature

OpenCode (repo moved to `anomalyco/opencode`; docs build 2026-10-24, read at `dev` @
`ed74ec82`) is the most *architecturally* similar peer: its V2 plugin API already split hooks
into prompt / context / model-request / HTTP layers, which is the shape pi ships natively. So
the port is **semantics, not names** — and the semantic pi lacks outright is permissions.

| Feature | What it does | pi surface | Value | Effort | Evidence |
|---|---|---|---|---|---|
| **Permission engine** | allow/ask/deny per tool, glob-matched, per agent, `--auto` | `tool_call` + command + flag + UI | 5 | M | https://opencode.ai/docs/permissions/ |
| **Agent profiles** | Declarative agent: model, temperature, step cap, prompt, tools, permissions | command + hook | 5 | M | https://opencode.ai/docs/agents/ |
| **Git snapshot undo/redo** | `/undo` reverts the message and its file changes; `/redo` restores | command + shadow VCS | 5 | L | https://opencode.ai/docs/tui/ |
| Read-only Plan agent | Denies edits, allows plan files, asks before bash | command + hook | 4 | S | https://opencode.ai/docs/agents/ |
| `permission.ask` review hook | A plugin rewrites the ask/allow/deny decision; can LLM-review the action | `tool_call` | 4 | M | https://opencode.ai/v2/docs/build/plugins/migrate-v1/ |
| `external_directory` + `.env` guards | Blocks paths outside the worktree; `.env` reads need approval | `tool_call` | 4 | S | https://opencode.ai/docs/permissions/ |
| Post-edit formatters | Runs the language formatter on a written file via `$FILE` | `tool_result` + tool | 4 | M | https://opencode.ai/docs/formatters/ |
| Post-edit diagnostics | Feeds typecheck/lint errors back into the loop | `tool_result` + tool | 4 | M | https://opencode.ai/docs/lsp/ |
| `doom_loop` guard | Asks when an identical tool call repeats three times | `tool_call` | 3 | S | https://opencode.ai/docs/permissions/ |
| `shell.env` hook | Injects env vars into every shell execution | `user_bash`-adjacent hook (gap: user bash) | 3 | S | https://opencode.ai/docs/plugins/ |
| Compaction hooks | Inject or replace the compaction prompt; control auto-continue | `session_before_compact` | 3 | S | https://opencode.ai/docs/plugins/ |
| `chat.params` / `chat.headers` | Per-request temperature, token cap, provider headers | `before_provider_request` | 3 | S | https://opencode.ai/v2/docs/build/plugins/ |
| Command bash injection | Expands shell output into the prompt; binds agent/model per command | command + hook | 3 | S | https://opencode.ai/docs/commands/ |
| Attention notifications | Desktop notify and sound on completion or a pending prompt | `ctx.ui` | 3 | S | https://opencode.ai/docs/tui/ |
| `/init` AGENTS.md | Scans the repo, writes or improves AGENTS.md in place | command | 3 | S | https://opencode.ai/docs/rules/ |
| `tool.definition` transform | Rewrites tool descriptions and params sent to the model | `prepareLoadout` + hook | 3 | M | https://raw.githubusercontent.com/sst/opencode/dev/packages/plugin/src/index.ts |

**The permission gap is real and documented.** pi's own docs state it never asks before running
a tool; the shipped `permission-gate.ts` example is a proof of concept, not a policy engine.
Every other agent in this study ships a policy engine with the same four knobs — per-tool
allow/ask/deny, glob-matched arguments, per-agent scoping, and a one-flag auto mode. That
agreement across seven independent products is the strongest signal in this report: it is not
a taste question, it is a missing layer.

**Not worth porting from OpenCode:** the raw plugin event stream (pi's event set is finer);
the models.dev provider matrix (pi has `registerProvider`; importing a moving catalog is a
treadmill); the auth hook (pi's `custom-provider` already does OAuth); headless `run --format
json`, `serve` + SDK (pi has `--mode json`, `--mode rpc`, and `sdk.md`); ACP (a long-lived
stdio JSON-RPC adapter, outside the extension API); share links (hosting); themes, keybinds,
`tui.json` (native); `/export`, `/compact`, `/editor`, `/sessions`, `/resume`, `/fork` (native).

## 6. Peers — one primitive each, and where they agree

| Feature | Agent | What it does | pi surface | Value | Effort | Evidence |
|---|---|---|---|---|---|---|
| **Glob-scoped rule files** | Cursor (`.mdc`), Kiro steering | Attaches instructions to matching paths, not the whole session | `context` hook | 5 | M | https://cursor.com/docs/rules |
| **Plan/Act tool gating** | Cline | A read-only mode that physically cannot write or run | command + hook | 5 | S | https://docs.cline.bot/core-workflows/plan-and-act |
| **Shadow-git checkpoints** | Cline, Gemini CLI | Snapshots the tree per tool step; restores code, chat, or both | command + shadow VCS | 5 | M | https://docs.cline.bot/core-workflows/checkpoints |
| **Per-edit auto-commit + undo** | Aider | One descriptive commit per model edit, instantly revertible | `tool_result` + command | 5 | M | https://aider.chat/docs/git.html |
| **Lint/test repair loop** | Aider | Runs linters/tests on touched files, feeds failures into the next turn | `tool_result` + hook | 5 | M | https://aider.chat/docs/usage/lint-test.html |
| **Mode objects** | Roo Code | A named mode = tool set + file scope + model + prompt | command + hook | 5 | M | https://roocodeinc.github.io/Roo-Code/features/custom-modes/ |
| **Specialist agents with a tool allowlist** | Copilot CLI | A directory of agents dispatched with their own tools and model | command + tool | 5 | M | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli |
| **LSP-backed context** | Crush | Diagnostics and definitions from real language servers | tool | 5 | L | https://github.com/charmbracelet/crush |
| Architect dual-model split | Aider | Planner model proposes, editor model applies the diff | virtual model | 4 | M | https://aider.chat/docs/usage/modes.html |
| Tree-sitter repo map | Aider | Rank-ordered, token-budgeted symbol map of the repo | tool + hook | 4 | L | https://aider.chat/docs/repomap.html |
| Bounded autonomous continuation | Copilot CLI | Agent self-continues up to N turns, then stops | `agent_before_settle` | 4 | S | https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/delegate-tasks-to-cca |
| Recipes with schema + retry | goose | Parameterised workflow returning validated JSON, retrying on failure | command + tool | 4 | M | https://goose-docs.ai/docs/guides/recipes/recipe-reference/ |
| Permission policy that hides tools | Crush, Cline | A denied tool vanishes from the model's view entirely | `exposure: hidden` + `tool_call` | 4 | S | https://github.com/charmbracelet/crush/blob/main/docs/config/README.md |
| **Process-level hook contract** | Gemini CLI, Kiro | Hooks in any language via stdin and exit codes | hook bridge | 3 | M | https://geminicli.com/docs/hooks/ |
| Instruction-file compat loader | Zed | Honours `.cursorrules` / `.clinerules` / `CLAUDE.md` / `GEMINI.md` | `context` hook | 3 | S | https://zed.dev/docs/ai/instructions |
| Spec pipeline with task waves | Kiro | requirements, design, tasks, run in dependency-ordered waves | command + tool | 3 | L | https://kiro.dev/docs/specs/ |
| PR-babysitting handoff | Copilot CLI | Pushes the task to a cloud worker, returns a draft PR | hook | 3 | M | https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/delegate-tasks-to-cca |

**Two 2026 corrections** that changed verdicts: Gemini CLI was replaced by **Antigravity CLI**
on 2026-06-18, and **Continue was acquired by Cursor**. Both agents' docs now describe products
that no longer exist in the form the 2025 comparisons assume; treat third-party "agent
landscape" posts older than a quarter as fiction.

**Not worth porting from the peers:** Cursor `--print` / `--output-format` (pi has `--print`,
`--mode json`, `--mode rpc`); Cursor cloud agents (VM provisioning, secrets, multi-repo
checkout); Gemini `/compress`, checkpoint tags, extension registry (compaction, fork, and
npm-style loading exist); Gemini `/ide` (needs an editor protocol, not a launcher); Roo's mode
marketplace and goose's activities (curated data and desktop-only UI); Devin playbooks (the
vendor is migrating them to Skills from 2026-10-24); Continue invokable prompts (pi prompt
templates); Aider `--watch` AI comments (fragile watcher) and its leaderboard (eval harness);
Crush's executable `crushrc` (a security surface); Antigravity's agent-team dashboard
(cosmetic over subagents); Zed ACP (native protocol surface).

## 7. Convergence — rank by how many products agree, not by novelty

Seven clusters account for almost every row in sections 2–5. The count is the evidence: a
primitive that seven independent teams rebuilt is a missing *layer*, not a missing feature.

| Cluster | Who ships it | The shared shape | pi status |
|---|---|---|---|
| **Permission policy** | Claude Code (modes + rules), OpenCode (engine + `--auto`), Codex (`approval_policy`), Amp (tool policy plugin), Cursor-ish (Crush deny-hides), Cline (auto-approve) | per-tool + per-argument allow/ask/deny, scoped per agent, one flag for unattended | **missing** — `tool_call` + annotations can express it, nothing ships it |
| **External-process hooks** | Claude Code (shell/HTTP/MCP handlers), Gemini CLI, Kiro | argv + JSON on stdin + exit code as the decision | **missing** — pi hooks are in-process TS only |
| **Checkpoint / undo** | Claude Code (`/rewind`), OpenCode (`/undo`), Cline (shadow git), Aider (per-edit commit), Gemini (checkpointing) | snapshot the tree per step, restore code and/or conversation | **partial** — fork/rewind moves conversation, not files |
| **Second-opinion advisor** | Amp (Oracle), Claude Code (advisor), Aider (architect) | consult a stronger/slower model with the transcript before committing | **expressible, unshipped** — `registerTool` + `streamSimple` |
| **Scoped instruction files** | Cursor (`.mdc` globs), Claude Code (`.claude/rules`), Amp (`globs:` front matter), Zed (compat loader) | instructions attach to the paths being touched, not the session | **partial** — AGENTS.md is cwd-and-ancestors only |
| **Declarative agent/mode profiles** | OpenCode (agents), Roo (modes), Copilot (agents dir), Claude Code (subagent frontmatter), Amp (Dial) | one file = model + tools + permissions + prompt | **partial** — skills cover prompt+tools, not model+permissions |
| **Post-edit feedback loop** | Aider (lint/test), OpenCode (formatters, LSP), Crush (LSP) | the edit's own errors arrive as the next turn | **missing** — nothing reacts to a write |

## 8. What pi cannot do — the three gaps that bound every estimate

Read off the installed 1.4.0 tree with source line references (from the capability-map slice):

1. **No process supervision and no PTY.** `pi.exec` runs one command, buffers, returns. A
   long-running child has to be supervised by the extension itself, with a PTY dependency for
   anything interactive, and its output cannot stream into a tool result. Blocks: persistent
   shell, `wait`-style background jobs, `Monitor`-style watchers, interactive `!` commands.
2. **No filesystem journal, so no honest undo.** `tool_call` fires before a write but cannot
   read the pre-image; `tool_result` fires after the bytes changed; bash writes bypass both.
   Every checkpoint/rewind port therefore needs a shadow VCS (`git stash create`), wrapped
   mutating tools, or both — and even then undo is honest only for agent-issued tool writes.
3. **No subagent control plane.** The SDK makes subagents possible and two installed extensions
   prove it (`nested-agents`, `repo-scout`), but there is no child registry, steering bus,
   isolation backend, or UI. Every fan-out port re-implements session creation, resource
   loading, locking, eviction, cancellation and cleanup — which is why the effort floor for a
   review fan-out is **L**, not M.

Runners-up, narrower but real: no `tool_choice` (cannot force a tool call), no mid-stream
inject-and-resume (rule injection degrades to abort + retry), and no resolver seam inside the
built-in `read`/`grep` (an internal-URL scheme needs the whole tool replaced, though
`createReadTool({ operations })` makes that cheaper than it sounds).

**How this changes the ranking.** A row earns `S` only when it is one hook plus one prompt.
Anything that touches files (undo, checkpoints) or spawns agents (review fan-out, agent teams)
starts at `M` and usually lands at `L` — the effort column below reflects pi's gaps, not the
peer's implementation size.

## 9. The ranked port list

Ordered by value, then by effort. `Value` is behaviour change per unit of adoption friction;
`Effort` already accounts for pi's three gaps (§8), so a peer's `S` can become `M` here.

| # | Extension | Primitive stolen from | pi surface | Value | Effort |
|---|---|---|---|---|---|
| 1 | **Permission policy engine** | Claude Code modes + rules, OpenCode engine, Codex permission profiles, Amp tool policy, Crush deny-hides, Cline auto-approve | `tool_call` + `annotations` + `exposure: hidden` + command + flag | 5 | M |
| 2 | **External-process hook bridge** | Claude Code settings hooks, Gemini CLI / Kiro hooks | `tool_call`, `before_agent_start`, `agent_settled`, `session_before_compact` | 5 | M |
| 3 | **Oracle / advisor tool** | Amp Oracle, Claude Code advisor, Aider architect | `registerTool` + `streamSimple` + read-only loadout | 5 | S |
| 4 | **Plan/Act mode gate** | Cline, OpenCode plan agent, Codex `/plan` | command + `tool_call` + `setActiveTools` | 5 | S |
| 5 | **Post-edit feedback loop** | Aider lint/test, OpenCode formatters + diagnostics | `tool_result` + tool + hook | 5 | M |
| 6 | **Shadow-git checkpoints + undo** | Claude Code `/rewind`, OpenCode `/undo`, Cline checkpoints, Aider per-edit commit | `tool_call` + command + shadow VCS | 5 | M |
| 7 | **Glob-scoped rules + instruction loader** | Cursor `.mdc`, Claude Code `.claude/rules`, Amp `globs:`, Zed compat | `context` hook | 4 | M |
| 8 | **Declarative agent/mode profiles** | OpenCode agents, Roo modes, Copilot agents dir, Claude subagent frontmatter, Amp Dial | command + tool + virtual model | 4 | M |
| 9 | **Review fan-out** | Amp `review` + Checks, Codex `/review` | command + skills + subagents | 4 | L |
| 10 | **Secret redaction** | Amp | `tool_result` + `before_provider_request` | 4 | M |
| 11 | **Skill re-injection after compaction** | Claude Code | `session_before_compact` | 4 | S |
| 12 | **`/goal` completion loop** | Claude Code, Codex | `agent_before_settle` | 4 | S |
| 13 | **Bounded autonomous continuation** | Copilot CLI autopilot | `agent_before_settle` | 4 | S |
| 14 | **`/import` config migration** | Codex | command | 4 | M |
| 15 | **Denial queue + `/approve`** | Codex auto-review | `tool_call` + UI | 4 | M |
| 16 | **Skill-scoped MCP** | Amp | skill hook + `registerMcpServer` | 4 | M |
| 17 | **Doom-loop guard** | OpenCode | `tool_call` | 3 | S |
| 18 | **Attention notifications** | OpenCode | `ctx.ui` | 3 | S |
| 19 | **Commit provenance trailers** | Amp (`Amp-Thread-ID`) | `tool_call` on bash | 3 | S |
| 20 | **LSP-backed context tool** | Crush | tool | 5 | L |
| 21 | **Tree-sitter repo map** | Aider | tool + hook | 4 | L |
| 22 | **Dynamic workflows** | Claude Code | tool | 4 | L |
| 23 | **Resumable exec (`write_stdin`)** | Codex | tool (blocked by gap 1) | 4 | L |

## 10. Build order

**Wave 0 — one afternoon each, no architecture.** #3 Oracle, #4 Plan/Act gate, #11
skill re-injection, #12 `/goal`, #13 bounded continuation, #18 notifications. Each is one hook
or one tool plus one prompt; together they close most of the day-to-day gap.

**Wave 1 — the missing layer.** #1 permissions first, because #4, #14, #15 and every
`acceptEdits`-style mode depend on it; then #2 the hook bridge, which is only worth shipping
once a policy already exists to be expressed in shell; then #15 the denial queue, which is the
UX half of #1.

**Wave 2 — context quality.** #5 feedback loop, #7 glob-scoped rules, #16 skill-scoped MCP,
#10 secret redaction. These change what the model sees rather than what it may do.

**Wave 3 — only with a design first.** #6 checkpoints (needs the shadow-VCS decision from gap
2), #9 review fan-out (needs a child registry, gap 3), #20/#21 (LSP and tree-sitter — a real
dependency and a real token budget), #23 resumable exec (needs process supervision, gap 1).

**If only one ships:** the permission policy engine. Seven independent products built one, it
is the prerequisite for three other rows, and it is the difference between an agent you can
leave unattended and one you cannot.

## 11. Open questions and limits

- **The Codex slice is thinner than the others.** Its worker did not report before this file
  was written; the section was produced in the main thread from a targeted fetch of
  `learn.chatgpt.com` and covers the CLI surface, not the cloud-orchestration details.
- **pi may gain permissions natively.** If upstream adds an approval layer, row 1 collapses
  from `M` to `S` and rows 4/14/15 get cheaper with it. Check upstream before starting.
- **The hook bridge has a packaging question**: one general bridge that reads a `hooks.json`,
  or per-agent compatibility shims (Claude Code settings format, Gemini format)? The former is
  smaller; the latter is what makes `/import` (#14) work.
- **`/import` needs a decision on scope.** Reading another agent's config is easy; deciding
  which parts to honour (hooks as hooks? rules as skills? permissions as policy?) is the work.
- **Effort ratings are shape-based, not measured.** They come from API surfaces and existing
  examples (`custom-compaction.ts`, `permission-gate.ts`, `jev-router.ts`, `git-checkpoint.ts`),
  not from completed ports.
- **Nothing here was built.** No row was prototyped; the pi-side claims are read from the
  installed 1.4.0 docs and types, and the peer-side claims from vendor docs on 2026-10-26.

## Related

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — the compaction axis in depth; rows 11 and 12 here assume its findings.
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — the fork that already pushed pi's architecture furthest; rows 20–23 are its territory.
- [omp Tool Inventory](../reference/oh-my-pi-tools.md) — per-tool approval tiers and load modes, the closest existing design to row 1.

## Changelog

- 2026-10-26 — created from a six-worker swarm (Amp, Claude Code, Codex, OpenCode, peers, pi
  capability map). Amp, Claude Code, OpenCode, peers and the capability map reported fully;
  Codex was filled in from the main thread. Draft written incrementally; synthesis sections
  9–11 added last.

