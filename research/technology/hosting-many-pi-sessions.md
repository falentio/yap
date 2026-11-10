---
title: Hosting Many pi Sessions From One Program — Topologies, Isolation, and the One-Process Limits
category: technology
tags: [pi, pi-coding-agent, sdk, sessions, concurrency, session-manager, rpc, isolation, multi-tenant, fan-out]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/cli-integration.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sessions.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/output-guard.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/loader.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/utils/shell.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/rpc/rpc-mode.ts
confidence: high
---

# Hosting Many pi Sessions From One Program — Topologies, Isolation, and the One-Process Limits

## Summary

**Yes — the SDK has no session cap, and sessions are independent objects.** Two sessions in one
Node process keep separate transcripts, models, cwds, tool sets, and event streams, and a
200-session fan-out ran to completion with 200 distinct answers. What is *not* independent is
everything the process itself owns: one stdout, one set of terminal keystrokes, one extension
factory cache, one detached-child registry. Those are the boundaries that decide your topology, not
the session object.

Three shapes work, in ascending cost and descending coupling:

| Shape | Isolation | Cost | Reach for it when |
|---|---|---|---|
| N `AgentSession` in one process | Per-session objects; shared process globals | ~1.4 MB RSS/session, no extra processes | A server or CLI that owns its own output surface |
| One `AgentSessionRuntime` per thread, same process | Each thread owns its session *and* its replacement | Same, plus a services bundle per runtime | Users need new/resume/fork per thread |
| One `pi --mode rpc` child per session | Full process isolation, own memory, own crash domain | ~106 MB RSS/turn per child | Untrusted work, per-tenant resource limits, non-Node hosts |

The single hard rule: **one session file gets one live writer.** Two live sessions over the same
`.jsonl` both append and fork the tree silently; the second writer's turns land on the first
writer's leaf, so the two "branches" share context (measured below). Use one file per session, or
one runtime that swaps the session in place.

## What is genuinely per-session

Measured on pi-coding-agent 1.5.0, Node 26.13.0. Two sessions, same process, prompted in parallel:

| Dimension | Result |
|---|---|
| Transcript | Independent: A remembered `111`, B remembered `222`, 5 messages each |
| Message identity | No shared message objects between sessions |
| Alias / cwd | Independent: two `cwd`s read different `who.txt` contents correctly |
| Model | Independent: `setModel` on B left A on its own model |
| `modelRuntime` / `settingsManager` | New instance per session unless you pass one; passing one is shared by identity |
| Event stream | Independent listeners; `dispose()` of one left the other's stream running |
| `abort()` | Scoped: A aborted mid-run, B finished normally |
| `sessionId` / `sessionFile` | Distinct per session, even when created concurrently |
| `session.dispose()` | Tears down A only; B kept streaming and completed |

Verification, 8 sessions prompted in parallel, one answer each and no cross-talk:

```text
answers: t0=thread-t0 t1=thread-t1 t2=thread-t2 t3=thread-t3 t4=thread-t4 t5=thread-t5 t6=thread-t6 t7=thread-t7
```

Scale run, in-memory managers, extensions off: 20 parallel prompts, 20/20 fulfilled, 20 distinct
answers, 4.5 s. At 200 sessions: created in 5.7 s, 200/200 fulfilled in 14.5 s, 200 distinct
answers, RSS 142 → 364 MB (~1.1 MB/session at that width, 1.4 MB steady marginal at 100).

Nothing in the package carries session-scoped module state: `agent-session.ts`'s only module-level
object is a `WeakMap` keyed by `StreamFn`
([agent-session.ts:167](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/agent-session.ts#L167)),
and there is no `process.chdir` anywhere in the package, so cwd rides on the session.

## What the process owns

These are shared by every session in the process. They are the actual design constraints.

| Global | Behaviour | Consequence for a multi-session host |
|---|---|---|
| Session JSONL appends | Bare `appendFileSync`, no lock, no reload ([session-manager.ts:1188](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1188)) | Two managers on one file append cleanly but never see each other's entries |
| `extensionCache` | One map, one `extensionCacheCwd`; a different cwd clears all of it ([loader.ts:133-152](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/loader.ts#L133-L152)) | Two cwds re-execute every factory on each switch (measured 4 executions per side over 4 alternations) |
| `process.stdout.write` | `takeOverStdout()` redirects it to stderr; `restoreStdout()` resets it globally, unguarded by a session count ([output-guard.ts:45-79](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/output-guard.ts#L45-L79)) | `createAgentSession` leaves stdout alone; `runRpcMode` does not |
| Detached bash children | One process-wide `Set`; killed by shutdown handlers, not by `dispose()` ([shell.ts:200-214](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/utils/shell.ts#L200-L214)) | A `bash 'cmd &'` outlives its session (`dispose()` left the background `sleep` alive) |
| `auth.json` / `models.json` caches | Path-keyed singletons; writes serialized by `proper-lockfile` | Sessions on one `agentDir` share credentials; a distinct `agentDir` per tenant is the isolation knob |
| `undici` dispatcher / `globalThis.fetch` | Replaced process-wide at startup | One HTTP policy for the whole process |
| Terminal (TUI) | Two `InteractiveMode` instances draw full-screen frames to the same stdout | The last frame wins; keystrokes reach both |
| Process lifetime | The CLI is single-mode and ends in `process.exit` | One CLI process = one session, by construction |

Settings do survive concurrent writers: `SettingsManager` re-reads under the lock and merges only
the changed field, and a 10-write interleave from two managers on one `settings.json` landed both
`httpIdleTimeoutMs` and `cacheWarming` with the file still parseable.

## Shape 1 — N sessions in one process

The default SDK path. Keep a registry, create on demand, prompt in parallel, `dispose()` in a
`finally`, and **do not point two live sessions at one file**.

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const sessions = new Map<string, AgentSession>();
const open = async (threadId: string) => {
  const { session } = await createAgentSession({
    cwd: workdirFor(threadId),
    sessionManager: SessionManager.create(workdirFor(threadId), "./sessions"),
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
  });
  sessions.set(threadId, session);
  return session;
};
```

Give each session its own `SessionManager.create` (or `inMemory()` when the host persists), and
one `sessionDir` per tenant. Sessions that must never share credentials get their own `agentDir`
and their own `ModelRuntime`.

The one in-session concurrency rule still applies: a second `prompt()` while streaming rejects
unless you pass `streamingBehavior`, exactly as it does with a single session
(`Agent is already processing. Specify streamingBehavior ('steer' or 'followUp')...`, measured).

### Two managers on one file

Both append; neither reloads. Measured: A wrote `ALPHA`, B wrote `BETA` into the same file, then A
asked for its names and answered **`BETA`** — the file's current leaf, not its own branch. B, asking
the same question, answered `BETA` too. Neither view contained the other's message
(`contains BETA: false` on A's own `messages`), so the divergence is invisible until a reopen.

Reopening that file is worse than a merge: the tree has two children on one node and the persisted
leaf order decides which branch the model sees. Reopened after the cross-process version of the same
test, only `REPLY0` survived into context — `REPLY1` was the abandoned branch (`roles:
system,user,assistant,user,assistant`, one branch point). Nothing throws, nothing warns.

### One manager shared by two sessions

Legitimate when the two sessions are *views* of one conversation, not parallel writers. Measured:
same `sessionId`, shared history, and a passphrase written by one session was recalled by the other
(`ORANGE`). Same-manager prompts still queue per session, so one of them silently writes onto the
other's leaf — same divergence, by design.

## Shape 2 — One runtime per thread

`AgentSessionRuntime` owns exactly one session and replaces it. One runtime per thread gives each
thread its own new/resume/fork and a clean `withSession` hook, still inside one process
([runtime reference](../reference/pi-agent-session-runtime.md)).

```typescript
const runtime = await createAgentSessionRuntime(factory, initial);
await runtime.newSession();            // old session disposed, runtime.session replaced
```

Two measured interactions matter when runtimes coexist:

- `newSession()` during an in-flight run **disposes** the old session; its `prompt()` promise
  resolves rather than rejecting, and the replacement carries 0 messages. A caller that only
  `await`s the old prompt cannot tell the turn was orphaned.
- Every `bindExtensions` call is per runtime, so each gets its own `session_start` and its own MCP
  `AbortController`; nothing is process-global about extension binding.

The factory throw hazard is per runtime and unchanged: a factory failure leaves that runtime holding
a disposed session whose `prompt()` resolves with stale text.

## Shape 3 — One RPC child per session

Full process isolation. Three children, three sessions, three distinct `sessionId`s, 3/3 memory
recalls correct behind a deliberate same-file resume, all six exits clean on `stdin` close (SIGPIPE
free). Failure containment is real: one child left running with an unresolvable model did not affect
the other.

Cost, measured per child: ~106 MB RSS and a settle wait of ~10 s for three concurrent first turns.
Spawning is your throttle — cap concurrency at the supervisor, not inside pi.

The protocol-level caveats live in [RPC mode](./pi-rpc-mode.md): `agent_settled` is the only done
signal, `prompt` responses mean *accepted*, and stdin close is the shutdown. Two additions for a
multi-session supervisor: RPC input lines are dispatched with `void`, so a `new_session` can
interleave with another command in the same child
([rpc-mode.ts:807-811](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/rpc/rpc-mode.ts#L807-L811)),
and `runRpcMode` calls `takeOverStdout()`, so a host that also prints to stdout loses it.

A whole-child fork of a thread is a second spawn with `--fork <file>` in the destination cwd, not a
session swap — `switch_session` retains the source cwd. That is the shape
[T3 Code](./t3-code-pi-coding-agent-integration.md) uses: one detached child per session, retired
with it, `--no-session` for ephemeral ones.

## The surfaces you cannot share

| Surface | Two in one process | Evidence |
|---|---|---|
| TUI (`InteractiveMode`) | Both `init()` render; the frames overwrite each other on one stdout and both attach stdin | two instances on two runtimes both rendered the full header/footer |
| RPC mode | `takeOverStdout()` is per process; one `restoreStdout()` restores for everyone | [output-guard.ts:72](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/output-guard.ts#L72) |
| The `pi` CLI binary | One session per process, always | [main.ts:896-946](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/main.ts#L896): single-mode dispatch then `process.exit` |

So: an in-process host that needs many sessions writes its own renderer, or renders one session at
a time. It does not stack TUIs. See [UI options](../reference/pi-sdk-ui-options.md) for the
`uiContext` surface a custom renderer implements.

## Choosing

| Requirement | Shape |
|---|---|
| A server with one session per chat, its own web UI | 1, one registry, one `sessionDir` per tenant |
| Per-thread new / resume / fork from that server | 2, one runtime per thread |
| Untrusted users, per-tenant CPU/memory caps | 3, one child per session behind a supervisor |
| Batch: 200 one-shot analyses | 1, one process, cap in-flight `prompt()` calls |
| Two conversations shown side by side in a terminal | 1, own renderer; not two TUIs |
| A session that must outlive its sibling's crash | 3 |

Rough ceilings from the measured runs, before the provider becomes the limit: hundreds of idle
in-process sessions are fine (~1.4 MB each), and 200 concurrent `prompt()`s completed against one
local provider. The binding constraint at that width is token throughput, not the runtime.

## Gotchas

- **Prompt concurrency is per session.** `Promise.all` over N *different* sessions is fine; two
  `prompt()`s on one session need `streamingBehavior`.
- **`dispose()` is not a fence.** It aborts, but `prompt()` after `dispose()` still resolves — with
  0 messages and `getLastAssistantText() === undefined` in the measured post-dispose probe. Drop the
  reference; do not reuse it.
- **`dispose()` ignores the process globals.** It does not restore stdout, kill tracked detached
  children, or clear the extension cache.
- **A fresh `agentDir` per tenant carries cost both ways.** Isolates credentials and trust, and
  re-parses `models.json` for each distinct path.
- **Session creation is async and loads extensions.** Concurrent creates work (6/6, identical
  prompt length, distinct ids) but each pays the load; create off the hot path.
- **`SessionManager.findById` and `list` take the cwd they are scoped to.** A supervisor that groups
  sessions per tenant must pass the tenant cwd, or it will not see them.

## Related

- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the single-session
  path this extends, including the queueing and persistence knobs.
- [createAgentSessionRuntime](../reference/pi-agent-session-runtime.md) — the replace-the-session
  contract behind shape 2.
- [Pi RPC Mode](./pi-rpc-mode.md) — the protocol behind shape 3.
- [pi Custom Session Store](./pi-custom-session-store.md) — session-dir precedence and the
  concurrent-writer tree fork from the CLI side.
- [T3 Code ↔ pi-coding-agent](./t3-code-pi-coding-agent-integration.md) — a production
  one-child-per-session supervisor, with its resume and rollback rules.
- [Hermes-like App on a pi Backend](./hermes-like-app-on-pi-backend.md) — the architecture question
  this topology choice sits under.
- [UI Options for a Programmatic pi Session](../reference/pi-sdk-ui-options.md) — what to implement
  when stacking TUIs is not an option.

## Changelog

- 2026-11-10 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`) with ~20 probe scripts under Node 26.13.0: parallel
  isolation, 8/20/200-session fan-out and RSS, same-file and same-manager divergence, RPC
  multi-child runs, two-TUI rendering, post-`dispose()` behaviour, and the process-global inventory
  read from pinned source.
