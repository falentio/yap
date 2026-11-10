---
title: Pi Durable vs the Pi Coding Agent — What Durable Buys You
category: technology
tags: [pi, pi-durable, coding-agent, harness, durability, multi-client, earendil, comparison]
status: complete
created: 2026-10-27
updated: 2026-11-03
sources:
  - https://earendil.com/posts/pi-durable/
  - https://github.com/earendil-works/pi/tree/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable
  - https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable/src/session/session.ts
  - https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable/src/harness/types.ts
  - https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable/docs/spec.md
  - https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/coding-agent/src/core/session-manager.ts
  - https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/coding-agent/src/experimental/durable/README.md
  - https://developers.cloudflare.com/agents/harnesses/pi/
confidence: high
---

# Pi Durable vs the Pi Coding Agent — What Durable Buys You

## TL;DR

- **Durable buys you three things the coding agent structurally cannot have: a turn that
  survives process death, several clients on one conversation, and an agent you can embed in
  someone else's product.** Everything else on the list is downstream of those.
- The **coding agent** is an excellent terminal product: one person, one process, one TUI,
  hardened. It writes its transcript as it goes but records no intent before acting, so a
  killed turn loses the turn; two processes can open one session file with no lock.
- **Pi Durable** is a durable-execution kernel: every model call, tool call, and compaction is
  a checkpointed task; input is deduplicated by `requestId`; state is published only after it
  commits. Crash recovery, multiplayer, and subagents fall out of that one invariant.
- **You pay for it in product surface.** No extensions with `ctx.ui` or slash commands, no
  resume picker, no `/login`, no approval step, and an explicitly experimental API.

## Context

Asked 2026-10-27: "advantage of Pi Durable compared to Pi coding agent". The two packages share
Earendil's code and taste, so the honest answer is not "durable is better" — it is a specific
list of guarantees that only exist when the agent loop is written as durable tasks, plus a
matching list of conveniences that only exist in the terminal product.

Prior coverage in this repo is [the Pi Durable / Cloudflare study](./pi-durable-cloudflare-workers-durable-objects.md),
which covers *how* the harness works on Workers and Durable Objects. This file is the
positioning comparison: what you gain, what you give up, and which one to reach for.

**Pinned revision.** Both packages read from
[`earendil-works/pi`](https://github.com/earendil-works/pi) at commit
`ce950d78f424dcaf9f5d6a03ce80ab141130eb1d`, pi-durable **1.1.0**. Read 2026-10-27.

## Findings

### 1. Earendil's own framing

> Pi the coding agent is built to run on your (remote) machine, inside a terminal, driven by one
> person. If the process dies, you look at what happened and tell it to continue. […] We need a
> harness that runs anywhere, can be reached from different surfaces, supports infinitely long
> conversations, survives catastrophic internal and external failures, and lets multiple humans
> steer the same agents. Pi Durable is that harness. It does not replace the Pi coding agent. It
> is a framework for building any agentic application, coding agents included.
> — [Earendil, Pi Durable](https://earendil.com/posts/pi-durable/)

Three of those five claims are architectural ("runs anywhere", "survives failures", "multiple
humans"); two are product-shaped ("different surfaces", "infinitely long conversations"). The
table below is that sentence made checkable.

### 2. The comparison

Items across the columns; dimensions down the rows.

| Dimension | Pi Durable (`@earendil-works/pi-durable`) | Pi coding agent (`@earendil-works/pi-coding-agent`) |
| --- | --- | --- |
| Shape | Library + harness: storage, tasks, registry | Terminal application with a TUI |
| Built for | Many agents, many clients, embedded in your app | One agent, one person, one terminal |
| Process model | N processes attach to one storage; one owner at a time | One process owns the session file; no lock |
| Transcript | Immutable entries, atomic commit, commit-before-visible | JSONL append per completed message |
| In-flight turn on crash | Checkpointed; `harness.resume()` continues it | Lost; nothing to resume |
| Tool call on crash | Intent committed first, then rerun if `replay: "safe"` | No intent record; the call is simply gone |
| Input idempotency | `requestId` dedupes a retried submit exactly-once | None |
| Streaming text on crash | Partial answer stays, marked aborted | Partial text never persisted |
| Concurrency | Many conversations per harness, plus forks | One conversation per process |
| Clients | Any number; `viewState()` / `watch()` from a snapshot | One; no cross-process event stream |
| Steering | Any client, `whenBusy: "steer"` mid-run | The terminal only |
| Compaction | `pi.compaction` durable task, runs in background | Synchronous in-turn function, no checkpoint |
| Memory | Working set only (active transcripts, live tasks) | Entire session in memory for the process lifetime |
| Storage | Pluggable: memory, SQLite, JSONL, Cloudflare, your own | JSONL under `~/.pi/agent/sessions/` |
| Execution env | Pluggable per conversation (local or remote) | Local filesystem and shell |
| Subagents | A conversation owned by a tool's task, ~a few lines | Not a primitive; each extension re-implements lifecycle |
| Background work | Background tasks and timers that survive restarts | Not a concept |
| App state | Typed documents committed with the transcript | Extension state via `appendEntry` |
| Extensions | `{ name, tools, sections, hooks, tasks }` on a registry | `(pi: ExtensionAPI) => void` modules with `ctx.ui` |
| Extension lifecycle | Replaceable while running, names stored per conversation | Loaded at startup, `/reload` |
| Approval gate | A hook you write; you own the UI and the memo | `ctx.ui.confirm` in a `tool_call` handler |
| Slash commands / shortcuts | None | First class |
| Release posture | Experimental: "API changes without notice" | 1.0, hardened |

Evidence is in §3 (advantages) and §4 (costs); the mechanism behind each durable row is cited
there rather than repeated.

### 3. Where the advantage is real

#### 3.1 A turn survives the process dying

This is the load-bearing one. The coding agent appends a message only when the *complete* message
event arrives — streamed partial text lives in memory
(`packages/coding-agent/src/core/agent-session.ts:1162`) — and it records no tool intent before
running a tool, so a crash mid-tool leaves an assistant entry whose tool call has no result.
Startup never resumes an interrupted turn: the only `resume()` calls in the tree are in the
experimental durable paths
([`experimental/durable/runtime.ts:332`](https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/coding-agent/src/experimental/durable/runtime.ts)).

Pi Durable inverts that. `Session.commit()` is atomic across entries, documents, and task
records ([`session.ts:86`](https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable/src/session/session.ts)),
and the spec's two invariants are "all visible progress is durable, there is no volatile
publication path" (`packages/durable/docs/spec.md:65`–`:67`). Tool intent is a committed record
carrying its replay policy, written *before* execution (`packages/durable/src/harness/tool.ts:37`–`:38`).
Recovery is then a decision, not a guess: rerun if the tool declared `replay: "safe"`, otherwise
tell the model it was interrupted.

What the user actually gets: close the laptop, redeploy the container, OOM the box — the same
`Harness.open(storage)` plus `harness.resume()` continues the run, and a client that retries its
submit with the same `requestId` receives the original submission rather than asking again
(`packages/durable/src/harness/submissions.ts:155`).

#### 3.2 Several clients on one conversation

Durable commits *every* piece of UI-relevant state, so a late joiner is a read, not a
reconstruction. `Conversation.viewState()` returns the current view and `watch()` streams the
exact operations of each commit
([`types.ts:564`](https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/durable/src/harness/types.ts));
`submit({...}, { whenBusy: "steer" })` lets any client push into a running turn; queued input is
itself a committed document (`packages/durable/src/harness/inbox.ts:14`), so it survives a crash
too.

The coding agent has no equivalent, and not for lack of effort: its session file has no lock
(`grep lock` in `session-manager.ts` matches only `textContent`), and nothing in `core/`
subscribes to a session file, so two processes can open one session and both append unchecked.
"Multiplayer" in the terminal product means two terminal windows and a hope.

The invariant that makes this safe is worth naming, because it is a constraint rather than a
feature: **one process owns a storage at a time**, and "old and new Harness instances must never
own the same Session concurrently: open the new one after the old one's `close()` resolved"
(`packages/durable/docs/spec.md:3289`). Durable does not give you shared mutable state; it gives
you a single writer and any number of readers.

#### 3.3 You can embed it in someone else's product

The coding agent is an application: it owns the TUI, the keybindings, the session picker, the
`/login` flow. Pi Durable owns none of that — `PiHarness` "does not choose the transport",
`Harness.open()` takes whatever storage and execution environment you inject, and the whole
package's dependency list is `pi-ai`, `chord`, `diff`, `typebox`
(`packages/durable/package.json:96`–`:101`). No Node APIs in the SQLite/JSONL storage code, so it
runs on Bun or in a Durable Object with a thin adapter.

That is why the same harness ends up behind a Slack bot, a web app, a Workers agent, and — this is
the tell — a small coding agent of Earendil's own. The vacation-planner demo is the shape to
copy: ~1,300 lines of TypeScript, most of it a TUI that borrows components from the coding agent.

#### 3.4 Long conversations stay cheap

Two mechanisms, both cheap to verify:

- **Background compaction.** Compaction is the built-in task `pi.compaction` with checkpointed
  phases, so it can run while the conversation continues; the conversation blocks on it only when
  the next request would not otherwise fit (`packages/durable/src/harness/compaction.ts:103`,
  `:419`). The coding agent compacts synchronously inside the turn from `_checkCompaction()`
  (`packages/coding-agent/src/core/agent-session.ts:2947`), and a crash mid-summarization writes
  nothing.
- **Working-set memory.** Durable keeps only loaded documents and the live working set in memory
  (`packages/durable/src/session/session.ts:54`), reading context per request between a head
  marker and the tail (`packages/durable/src/harness/context.ts:23`). The coding agent holds
  `fileEntries: FileEntry[]` plus a `byId` map for the entire session
  (`packages/coding-agent/src/core/session-manager.ts:994`–`:995`).

Subagents are the second-order win: a conversation owned by a tool's task, so a subagent survives
a crash, counts its own cost, and can be shown under the tool call
([Earendil](https://earendil.com/posts/pi-durable/)). In the coding agent there is no subagent
primitive at all — every port re-implements session lifecycle, locking, and cleanup (see
[features worth porting](./coding-agent-features-to-port-to-pi-extensions.md)).

#### 3.5 The running agent is malleable by design

`registry.install()` replaces an extension by name in one step; a tool call already running
finishes on the code it started with and the next call uses the new code. Conversations store
extension and tool **names**, never code, so a restart picks up whatever the new process installs
(`packages/durable/src/harness/types.ts:311`). Per-conversation selection
(`thread.configure({ tools: { remove: [deploy] } })`) means a reviewer conversation can be
read-only on a cheaper model while the main one deploys.

The coding agent has `pi.setActiveTools()` and `/reload`, but its extension set is a startup
property of one process, and its configuration carries no notion of "this conversation uses these
tools".

### 4. What you give up

Everything here is a real coding-agent feature that Pi Durable does **not** have. The clearest
list is the coding agent's own durable backend, which names what it deliberately omits:
"sessions list and resume picker, forks and tree navigation, **extensions**, prompt templates,
images, `/login`"
([`experimental/durable/README.md:66`](https://github.com/earendil-works/pi/blob/ce950d78f424dcaf9f5d6a03ce80ab141130eb1d/packages/coding-agent/src/experimental/durable/README.md)).

| You lose | Why it does not port |
| --- | --- |
| Extensions as you know them | Different object entirely: `ctx.ui`, commands, shortcuts, custom renderers, `pi.registerProvider` |
| Approval UX | Durable has no approval step; you write a `beforeTool` hook and own the prompt and its `memo` |
| Session picker, tree navigation | Durable has forks with ancestry but no `/tree`/`/resume` UI |
| Prompt templates, images, `/login` | Host application concerns; PiHarness leaves them to you |
| A TUI | You build it; the examples borrow the coding agent's components |
| Stability | "Experimental. The API changes without notice between releases" (`packages/durable/README.md`) |

Two more costs that rarely make the docs:

- **Write amplification.** Checkpoint-per-step and commit-before-visible mean more storage writes
  per turn than one JSONL append. No published benchmark compares the two on the same workload.
- **A different mental model.** Tasks, ownership trees, commits, memos, replay policy. The coding
  agent's model is "a message list and a tool loop"; the durable model is closer to a workflow
  engine with an LLM inside it.

### 5. Decision guide

| You are building | Pick |
| --- | --- |
| A CLI/TUI coding agent for yourself | Coding agent |
| A chat surface where a user closes the tab mid-answer | Pi Durable |
| A bot several people steer at once | Pi Durable |
| Something that runs for hours across deploys | Pi Durable |
| A terminal product needing approvals and slash commands today | Coding agent |
| A coding agent you want to *embed* or host for others | Pi Durable (Earendil's own path) |
| Anything needing an extension you already wrote for the coding agent | Coding agent |

### 6. The line is moving

The coding agent now ships an experimental durable backend
(`packages/coding-agent/src/experimental/`) that runs the coding agent on a Pi Durable harness,
building the registry by hand from `CodingTools` plus a prompt section
(`packages/coding-agent/src/experimental/durable/harness-setup.ts:51`). So "durable" is becoming a
mode of the product, not only an alternative to it — and the reverse flow is Earendil's stated
plan: "lessons we learn building agentic applications on Pi Durable will flow back into Pi the
coding agent as they prove themselves valuable."

The practical consequence for a decision made today: durable's advantages are the *durability and
concurrency* guarantees, not "durable has features the coding agent lacks" — the feature gap is
scheduled to close, the architectural gap is not.

## Open Questions

- **What does a checkpoint per step actually cost?** No benchmark of commits/turn or p50 turn
  latency versus the coding agent on the same model and tools. Probe: run one fixed transcript
  through each and count writes and wall time.
- **How far does the coding agent's experimental durable backend go?** It currently omits
  extensions; whether the UI-bearing extension surface is ported at all (rather than re-hosted) is
  unstated.
- **Does per-conversation tool selection survive extension replacement cleanly** when a
  conversation selected a tool that the new process no longer installs? `resolveAgent()` reads
  names from state (`packages/durable/src/harness/agent.ts:162`); the missing-name behavior was
  not traced.
- **Approval semantics under crash:** a `beforeTool` hook that asks a human and stores the answer
  in a `memo` is the documented pattern, but nothing defines what happens if the human answers
  after the task is already interrupted.

## Related

- [Pi RPC Mode](./pi-rpc-mode.md) — the coding agent's own JSONL subprocess protocol: the
  non-Node embedding path, its 33 commands, and why `agent_settled` is the completion signal.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
  — the hosting study: commit-before-visible durability, DO SQLite storage, alarm wake-up, limits,
  and §8 on why the extensions are not the coding agent's.
- [Coding-agent features worth porting to pi extensions](./coding-agent-features-to-port-to-pi-extensions.md)
  — the coding agent's capability matrix, including why subagents have no first-class primitive.
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — a third position: fork the coding
  agent and add features rather than split out a harness.

- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md) — the same split seen from the hosting side, including why the coding agent’s own `grep` blocks a remote-filesystem port.

- [Chord — Earendil's Distributed Object Runtime](./chord-distributed-object-runtime.md) — the runtime behind `pi-durable` (delta transactions, watches, the `chord/next` store, SQLite drivers), and not a dependency of the coding agent.
- [Pi Durable — Production Readiness Assessment](./pi-durable-production-readiness.md) — the release/API churn, migration and rollback risks, what the tests do and do not prove, and the go/no-go gates.
## Changelog

- 2026-10-27 — created. Evidence: scout read of `earendil-works/pi` @
  `ce950d78f424dcaf9f5d6a03ce80ab141130eb1d` (path:line cited throughout), the Earendil
  announcement, and the installed `@earendil-works/pi-coding-agent` docs. **Fetch fallback:** the
  Earendil post was read with `curl` because the TinyFish MCP tools are exposed only through code
  mode (`toolExposure: codemode`) and code mode was not available in this session; its quotes are
  short and verbatim, but re-fetch through TinyFish to satisfy §2 of `AGENTS.md`.
- Claim flags: the coding-agent multi-process corruption risk is inference (no lock exists; that
  two O_APPEND writers interleave badly in practice was not executed), labeled as such in §3.2.
