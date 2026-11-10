---
title: Hermes-like App on a pi Backend — pi-coding-agent or pi-agent-core?
category: technology
tags: [pi, pi-coding-agent, pi-agent-core, hermes-agent, backend, sdk, rpc, architecture, comparison]
status: complete
created: 2026-10-31
updated: 2026-11-03
sources:
  - https://hermes-agent.nousresearch.com/docs/user-guide/desktop
  - https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode
  - https://hermes-agent.nousresearch.com/docs/user-guide/profiles
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/cli-integration.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/how-pi-works.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/README.md
  - https://www.npmjs.com/package/@earendil-works/pi-agent-core
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent
  - https://github.com/nousresearch/hermes-agent
confidence: high
---

# Hermes-like App on a pi Backend — pi-coding-agent or pi-agent-core?

## Summary

**Use `@earendil-works/pi-coding-agent` — through its SDK — as the backend. Reach for
`pi-agent-core` only if you deliberately intend to write sessions, compaction, tools, skills and
extensions yourself.**

The question looks like "library vs framework", but the split is not about size. It is about
**who owns the product functions**. A Hermes-like app is defined by exactly the things
`pi-coding-agent` already ships — persistent named agents, per-agent memory and skills, a session
with compaction, a roster, scheduled routines, several front ends over one gateway — and
`pi-agent-core` owns none of them beyond the turn loop itself
([package map](../reference/pi-package-map.md)).

| Requirement (from Hermes) | Owner in pi | `pi-agent-core` | `pi-coding-agent` |
| --- | --- | --- | --- |
| Turn loop, streaming events, steering | `pi-agent-core` | yes | builds on it |
| Tool dispatch + `beforeToolCall`/`afterToolCall` | `pi-agent-core` | yes | builds on it |
| Provider catalog, OAuth, cost accounting | `pi-ai` | via `pi-ai` | via `pi-ai` |
| Persistent session tree, branching, resume | `pi-coding-agent` | no | yes |
| Compaction (summary entry, history kept) | `pi-coding-agent` | no | yes |
| Built-in file/shell tools | `pi-coding-agent` | no | yes |
| Skills (on-demand instruction loading) | `pi-coding-agent` | no | yes |
| Extensions (tools, commands, hooks, providers) | `pi-coding-agent` | no | yes |
| MCP client + codemode + tool search | `pi-coding-agent` | no | yes, opt-in |
| Context files (a `MEMORY.md`-shaped slot) | `pi-coding-agent` | no | yes |
| Process/surface boundary for a UI | `pi-coding-agent` | roll your own | SDK, RPC, JSON, print |
| Per-agent workspace root | `cwd` per session | roll your own | `cwd` per session |
| Roster, group chats, routines, bot-to-bot | nobody | you build | you build |
| Long-term memory curation, session search | nobody | you build | you build |

The last two rows matter: **pi is not a Hermes replacement, it is the half of Hermes that is hard
to retrofit.** Hermes' own docs are explicit that Bot Mode is "a UI over that primitive" — a
profile is "isolated config, memory, skills, credentials, and chat history under
`~/.hermes/profiles/<name>/`", with "no core patches, no background daemons, no extra storage"
([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)). Transposed to pi, a
profile is one `AgentSession` with its own `cwd`, `SessionManager`, and `ResourceLoader`.

## Findings

### 1. What "Hermes-like" actually demands of a backend

Hermes shipped four front ends over one agent process: native desktop, CLI/TUI, a web dashboard, and
a served webapp on `127.0.0.1:9120` — and messaging. Its own doc spells out the constraint:
"Chats run on that gateway, the same process that serves the CLI, the native Desktop and messaging,
so every surface sees one conversation with one queue"
([Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)).

Read as requirements, that yields five things:

1. **A long-lived host process** holding agent state, not a per-request CLI invocation.
2. **N concurrent agents** — one per bot/profile — each with isolated filesystem root, history,
   credentials, and skills.
3. **A streamed event feed per conversation** that many clients can attach to and detach from.
4. **A durable conversation** with a compaction story, because a bot chat is "one permanent Bot
   Chat" where `/new` reroutes to `/compact` ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
5. **Agent capability** — tools, shell, files, MCP, skills — inside that conversation.

Items 1–3 are a transport and lifecycle problem. Item 4 is a session-model problem. Only item 5's
inner loop is `pi-agent-core`.

### 2. Why `pi-coding-agent` is the right default

`pi-coding-agent` is the only layer that answers items 2, 4 and 5 without you rebuilding them. Its
SDK is explicitly not a CLI mode — it embeds the agent in-process:

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({ cwd: "/bots/researcher" });
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    ws.send(event.assistantMessageEvent.delta);
  }
});
await session.prompt("Summarise today's notes");
```

That is the gateway shape: one process, one `AgentSession` per bot, `subscribe()` fanning events out
to WebSocket clients ([SDK](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md)).

The four boundaries you would otherwise implement are injectable, which is what makes it usable as
an app backend rather than only as a CLI:

| Boundary | Option | What it buys a Hermes-like app |
| --- | --- | --- |
| `cwd` | per session | per-bot workspace, context-file discovery, session grouping |
| `sessionManager` | `SessionManager.inMemory(cwd, opts, entries)` | Postgres/object-store history instead of JSONL files on disk — the class is final, so this is hydration plus a `_persist` override, not a driver you implement; proven in [the persistence seam](./pi-session-persistence-external-store.md) |
| `resourceLoader` | `DefaultResourceLoader` with overrides, or custom | per-bot skills, prompt templates, extensions, context files |
| `tools` | `tools`/`noTools`/`excludeTools`/`customTools` | per-bot capability sets, approval gating at the tool layer |

`AgentSessionRuntime` then covers the bot-lifecycle verbs the roster needs — `newSession()`,
`switchSession()`, `fork()`, `importFromJsonl()` — with the caveat that a runtime replacement
rebinds subscriptions, since the old `AgentSession` keeps the old ones ([SDK](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md)).

### 3. The transport choice is separate, and independent

Three transports ship, all over the same agent and session machinery
([CLI integration](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/cli-integration.md)):

| Transport | Boundary | Lifetime | Fit for a Hermes-like app |
| --- | --- | --- | --- |
| SDK | in-process | until you dispose | **the gateway** — many sessions in one Node process |
| RPC | child process, JSONL | long-lived | per-bot process isolation, non-Node gateway, crash containment |
| JSON / print | child process, one-shot | one run | cron routines, scripted jobs, CI-style tasks |

Two practical notes. RPC is strict JSONL — "read stdout as a byte or UTF-8 stream and split records
only on LF", and Node's `readline` is the wrong reader because it also splits on `U+2028`/`U+2029`
([RPC](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/rpc.md)).
And in either transport, a successful `prompt` means *accepted*, not *finished*: wait for
`agent_settled`, not `agent_end`, or you will truncate runs that retry, compact, or pick up a
follow-up. That single mistake is the most common way a hand-rolled gateway loses output.

The mixed design that mirrors Hermes most closely: **SDK for the chat gateway, one-shot JSON for
routines.** Routines are fire-and-forget with a final transcript, which is exactly print/JSON mode's
contract, and it keeps a runaway cron job off the gateway's event loop.

### 4. When `pi-agent-core` is the right call instead

`pi-agent-core` is "stateful agent with tool execution and event streaming. Built on
`@earendil-works/pi-ai`" ([npm](https://www.npmjs.com/package/@earendil-works/pi-agent-core)). It
gives you `Agent`, `agentLoop`, steering/follow-up queues, parallel tool execution,
`prepareRequest`/`finishTurn` hooks, and `streamProxy` for browser-side agents. It gives you no
sessions, no persistence, no compaction, no built-in tools, no skills, no extensions, no MCP.

It is the right dependency in four cases, and only these:

| Case | Why agent-core wins |
| --- | --- |
| Non-Node host (Workers, DO, Deno, edge) | imports no `node:` builtins at all; `pi-coding-agent` does, heavily |
| You own persistence in a real database | its `Agent` does not own a session file, so your storage is the only storage |
| You are re-implementing the harness | a Go port already exists (`bismarck-engine`), and Flue pins `^0.83.0` to do the same |
| A browser bundle is the client | `streamProxy` plus the loop, with no TUI/proxy dependencies dragged in |

Everything in that table is "I am building the harness, not the app". A Hermes-like app is the
opposite: you are building the app *and* inheriting a harness, and the harness is the part that is
already correct.

### 5. What you still build yourself

Be clear-eyed that pi stops before Hermes' top half. None of the following has a pi equivalent:

| Hermes feature | What it actually is | Your work on pi |
| --- | --- | --- |
| Roster with avatars, unread, sections | app data + UI | schema, presence, WS subscription per bot |
| `MEMORY.md` (2,200 chars) / `USER.md` (1,375 chars), agent-curated | a bounded memory file the agent rewrites | a tool that edits a context file; the size cap is your policy |
| Session search over memory | retrieval | index your `SessionManager` store |
| Routines beside the chat | cron + session | scheduler + one-shot JSON run per fire |
| Group chats, bot-to-bot messages | multi-agent orchestration | a broker; each turn is a `session.prompt()` |
| Approval gates | tool-level policy | `beforeToolCall` on `pi-agent-core`, or a `customTools` wrapper |
| Persistent computer per profile | a container/VM | `cwd` plus your sandbox; pi uses the OS permissions of its process |

### 6. Gotchas before you commit

- **SDK sessions do not load the built-in extensions.** The CLI loads `codemode`, `tool_search`,
  and MCP; an SDK host must add `createCodemodeExtension()`, `createToolSearchExtension()`, and
  `createMcpExtension()` to `DefaultResourceLoader.extensionFactories` and call
  `session.bindExtensions()`, because the MCP extension connects its servers on `session_start`
  ([SDK](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md)).
  A Hermes-like app that silently loses MCP is almost always this.
- **Extensions execute in-process** with the host's OS permissions
  ([How Pi Works](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/how-pi-works.md)).
  For a single-user desktop app that is fine. For multi-tenant hosting, per-bot RPC subprocesses are
  the isolation boundary, not per-bot sessions.
- **`session.systemPrompt` is read-only.** Mid-conversation instruction changes are a `system`
  message with `content` or `sections`; there is no setter to reach for (§ SDK).
- **Assigning `session.agent.state.messages` does not replace persisted context.** `SessionManager`
  is authoritative, so importing foreign history means constructing the manager with those entries.
- **`prompt()` while streaming must say steer or follow-up** — it rejects rather than guessing.
- **Versions move in lockstep.** 1.4.0 pins `pi-agent-core` 1.4.0 and `pi-ai` 1.4.0 exactly; do not
  mix. The installed tree is ~156 MB because it includes `pi-tui`, `quickjs-wasi`, and
  `photon-node` — acceptable server-side, disqualifying on edge.

## Verdict

Start on **`pi-coding-agent` via SDK**: one gateway process, one `AgentSession` per bot with its own
`cwd` and resource loader, `subscribe()` to a WebSocket per client, one-shot JSON runs for routines.
Write the roster, memory curation, group chats, and approval policy yourself — that is the actual
product, and pi deliberately does not have an opinion about it.

Choose **`pi-agent-core`** only when the host is not Node, or when your storage must be the only
storage. If you catch yourself re-implementing skills discovery, a session tree, or compaction on
top of it, you have chosen wrongly and should move up a layer.

## Related

- [createAgentSession reference](../reference/pi-createagentSession.md) — the concrete SDK entry
  point the recommendation lands on: options, tool-selection semantics, and runtime siblings.
- [Packaging pi Into Your App](./pi-packaging-into-your-app.md) — the distribution half of the
  same choice: MIT terms, installed footprint, SDK-in-process vs spawned CLI, and the
  single-binary path with its extension caveat.
- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — the three layers,
  what each owns, and why "pi core" is not a package.
- [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md) — what Hermes ships as a product, so the
  feature table above has a source.
- [Flue vs pi-agent-core](./flue-vs-pi-agent-core.md) — the framework-over-agent-core path, with
  its pinned `^0.83.0` cost.
- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — what changes when the host is an edge runtime.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — the other stack, for
  durable long-running agent state.
- [pi-coding-agent Sessions in Your Own Store — The In-Memory Seam](./pi-session-persistence-external-store.md)
  — if you want your own database behind sessions, this is the seam, and it keeps the recommendation
  on `pi-coding-agent` rather than `pi-agent-core`.

## Changelog

- 2026-10-31 — corrected the sessionManager row: it is not a pluggable driver (SessionManager is a final class, no interface), only hydration plus a _persist override. Linked the verified pattern.
- 2026-10-31 — created, answering "pi coding agent or pi agent core for a Hermes-like app".
  Evidence: `pi-coding-agent` 1.4.0 installed docs (SDK, RPC, CLI integration, How Pi Works) at
  repo `babe30a7e6c1`; `pi-agent-core` 1.4.0 README and manifest read from the published tarball;
  Hermes Desktop and Bot Mode docs read via TinyFish on 2026-10-31.
