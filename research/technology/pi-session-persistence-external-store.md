---
title: pi-coding-agent Sessions in Your Own Store — The In-Memory Seam
category: technology
tags: [pi, pi-coding-agent, session-manager, persistence, postgres, sqlite, sdk, hermes-agent]
status: complete
created: 2026-10-31
updated: 2026-11-03
sources:
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/session-manager.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/sdk.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/session-format.md
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent
confidence: high
---

# pi-coding-agent Sessions in Your Own Store — The In-Memory Seam

## Summary

**"I want different persistence" does not force you down to `pi-agent-core`.** `pi-coding-agent`'s
session store is replaceable in practice, just not through the mechanism you would expect: there is
**no `SessionStore` interface to implement**. `SessionManager` is a final class — private
constructor, private fields — so you cannot subclass it or substitute a structurally equal object
(the private members make it nominal in TypeScript).

What you get instead is a **hydrate-on-boot, capture-on-append** seam, and it is enough:

| Need | Mechanism | Verified |
| --- | --- | --- |
| Load history from your DB | `SessionManager.inMemory(cwd, options, entries: FileEntry[])` — its own docstring: "optionally from entries held outside the filesystem" | 6 entries hydrated, 0 files created |
| Capture every append | override `manager._persist(entry)` — public in the `.d.ts`, called as `this._persist(entry)` from `_appendEntry` | caught all 7 append paths |
| Or capture via events | `AgentSession` event `{ type: "entry_appended", entry }` | declared in `AgentSessionEvent` |
| Rebuild the LLM context after reload | `buildSessionContext()` / `buildSessionContext(entries, leafId)` | round-trip context and leaf identical |
| Keep compaction working | compaction is an ordinary entry in the stream | summary replaced earlier messages after reload |

The result: **your database is the system of record, pi holds one entry tree in RAM per active
session, and it never touches the filesystem.** Measured: 7 entries, 1,309 bytes of JSON total,
`getSessionFile()` undefined, `isPersisted()` false, zero files on disk.

## Findings

### 1. The shape of the store, and why there is no interface

The session is an **append-only tree**, one JSON object per entry, linked by `id`/`parentId`, with a
leaf pointer as the cursor. That is the whole contract — it is the
[JSONL session format](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/session-format.md),
and it maps one-to-one onto a table of `(session_id, seq, entry_json)` plus a `leaf_id` column.

The asymmetry worth knowing before you plan around it:

| Boundary | Kind | Can a host implement it? |
| --- | --- | --- |
| `ResourceLoader` | **interface**, with `DefaultResourceLoader implements ResourceLoader` | yes — documented for "when the host owns resource storage" |
| `SessionManager` | concrete class, private ctor | **no** — no interface exists |
| `SettingsManager` | concrete class | no, but it has in-memory constructors |

So the SDK's four injectable boundaries are not equally injectable. Skills, prompt templates,
extensions and context files are an interface you can implement; **sessions are not.** That is the
single fact that makes people conclude "I need agent-core for a real database" — and it is the wrong
conclusion.

### 2. Hydration is a documented constructor argument

```typescript
static inMemory(cwd?: string, options?: NewSessionOptions, entries?: FileEntry[]): SessionManager;
// /** Create an in-memory session (no file persistence), optionally from entries held outside the filesystem. */
```

`FileEntry = SessionHeader | SessionEntry`: the header first, then entries in append order. Your
query is `SELECT entry_json FROM session_entries WHERE session_id = $1 ORDER BY seq`, and the rows are
already the right shape because the JSONL file *is* a sequence of those objects.

Verified against a realistic history — user, assistant, user, assistant, a compaction boundary, then a
post-compaction user turn:

```text
hydratedEntries: 6         isPersisted: false        sessionFile: null
leafId: "a5"               sessionDir: ""            filesOnDisk: []
contextMessages: ["compactionSummary", "user", "assistant", "user"]
```

Two things to read from that: hydration worked, and **compaction still applied** — the summary
replaced the pre-boundary turns in the model context, exactly as it would from a file. Resuming a
compacted bot is not a special case.

### 3. Capture has two seams, and one is strictly better

**Seam A — `entry_appended`.** `AgentSessionEvent` includes `{ type: "entry_appended"; entry: SessionEntry }`.
Clean, typed, part of the documented event stream. Limitation: it fires for appends the *session*
makes. An extension that calls `sessionManager.appendCustomEntry(...)` directly bypasses it.

**Seam B — override `_persist`.** `_appendEntry` does:

```javascript
_appendEntry(entry) {
    this.fileEntries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;
    this._persist(entry);          // ← this-call, so an instance override wins
}
```

Because it is a `this.` call, assigning `manager._persist = (entry) => db.append(entry)` redirects
**every** append path. Verified by driving one of each append method:

| Append call | Captured |
| --- | --- |
| `appendMessage` | `message` |
| `appendModelChange` | `model_change` |
| `appendThinkingLevelChange` | `thinking_level_change` |
| `appendUsage` | `usage` |
| `appendCustomEntry` | `custom` |
| `appendCompaction` | `compaction` |
| `appendLabelChange` | `label` |

7 of 7, and the manager still held 7 entries with no files written. In in-memory mode the original
`_persist` early-returns (`if (!this.persist || !this.sessionFile) return;`), so overriding it
replaces a no-op rather than skipping a side effect you still need.

Use both: `entry_appended` for anything user-visible, `_persist` as the durability backstop.

### 4. Reload is exact, including the leaf

Serialize each entry back to JSON, reload cold into a fresh manager, and rebuild:

```text
roundTripIdenticalContext: true     roundTripIdenticalLeaf: true
pureFunctionMatchesManager: true    totalBytes: 1309 (7 entries, 152–259 B each)
```

`buildSessionContext(entries, leafId)` is a **pure function** over entries plus a leaf, and it returned
a context identical to the live manager's. That matters twice: it proves the round-trip, and it means
a bot's model context can be reconstructed anywhere — a worker, a test, a replayer — without booting
pi.

Entry volume is small: this whole two-turn-plus-compaction history is ~1.3 KB. Persisting per entry
(not per token) is cheap; a message entry is written when the message ends, not streamed.

### 5. What stops working, and what to write instead

Every **path-shaped** API becomes unusable, because your sessions have no paths:

| File-shaped API | Replace with |
| --- | --- |
| `SessionManager.open/continueRecent/forkFrom/findById/list/listAll` | your own queries |
| `AgentSessionRuntime.switchSession(sessionPath)` | build a manager from rows, then `createAgentSession` |
| `AgentSessionRuntime.fork(entryId)` | your own fork: copy the branch's entries under a new session id |
| `AgentSessionRuntime.importFromJsonl(inputPath)` | JSON is already your storage format |
| `session.getSessionFile()` | `undefined` — never key off it |
| `createBranchedSession()` | returns `undefined` when not persisting |

Branching itself still works within a session (`branch(entryId)`, `branchWithSummary`,
`appendContextEdit`) — it moves the leaf, and your next captured entry carries the new `parentId`.
Only the *cross-file* operations are lost.

`createAgentSession({ sessionManager, cwd, agentDir })` accepts a non-persisted manager with no
warning and no fallback file: verified, `sessionFileAfterCreate: null`.

### 6. Verdict

Keep `pi-coding-agent`. Put the session store behind a small adapter module with three functions:

```typescript
loadEntries(sessionId): FileEntry[]                       // header + entries, ordered
const manager = SessionManager.inMemory(cwd, {}, loadEntries(id));
manager._persist = (entry) => appendEntry(sessionId, entry);  // durability backstop
// per bot: createAgentSession({ sessionManager: manager, cwd: botDir, agentDir })
```

Then your memory/roster/routine features query your own tables, and pi never learns where sessions
live. Reach for `pi-agent-core` only if the host is not Node or your storage must be the *only* copy
in a system pi cannot model — which, per the test above, is not the case for a Hermes-shaped app.

## Gotchas

- **`_persist` is underscore-prefixed public API.** It appears in the `.d.ts` and is called
  dynamically, so the override works — but it is not a contract. Pin the version, and add a smoke
  test that asserts your override still receives a `message` and a `compaction` entry on upgrade.
- **Compaction entries embed the whole system message.** `CompactionEntry.systemMessage` is "complete
  prompt and tool state at this compaction boundary". Drop it in your serializer and a resumed,
  compacted session loses its tool declarations — persist entries whole, never field-picked.
- **You cannot subclass `SessionManager`** (private constructor), so the override goes on the
  instance. Do not try to wrap it in a class of your own and pass that to `createAgentSession`; the
  private members make it type-incompatible.
- **Memory scales with active sessions × history length.** Every hydrated entry stays in the
  manager's `fileEntries` and index. Use `getEntryCount()` (no copy) for observability, and evict
  idle bots' sessions — a gateway holding 50 open bots holds 50 full histories.
- **Multi-writer is yours to prevent.** pi assumes one process owns a session at a time; the leaf
  pointer is local state. Give each session one writer (partition by session id, or a lease row) —
  two gateway processes on one session will interleave `parentId` chains into a corrupted tree.
- **Set `sessionId` for provider caching.** A stable id per bot conversation keeps provider-side
  prompt caches warm across restarts; a fresh id per boot silently costs you cache reads.
- **`agentDir` still points at the filesystem** for credentials, settings and model config. Moving
  sessions to your DB does not move auth; pass a per-tenant `agentDir` or a custom `ModelRuntime`
  with a `CredentialStore`.
- **`getSessionDir()` returns an empty string in memory.** Guard any logging or UI that assumes a
  path.

## Evidence

Probe run 2026-10-31 against `@earendil-works/pi-coding-agent` **1.4.0** on Node 26.13.0, importing
the installed `dist` directly:

```text
--- hydration + compaction + round-trip ---
hydratedEntries 6      leafId a5      isPersisted false     sessionFile null
contextMessages [compactionSummary, user, assistant, user]    sessionDir ""
roundTripIdenticalContext true   roundTripIdenticalLeaf true   totalBytes 1309
filesOnDisk []

--- capture seam ---
overriddenPersistCaughtTypes [message, model_change, thinking_level_change,
                              usage, custom, compaction, label]      count 7
createAgentSessionAccepted true    filesAfterEverything []
```

## Related

- [pi Custom Session Store — The Directory Knob, the Extension Takeover, and What Breaks](./pi-custom-session-store.md)
  — the layer above this one: relocating the JSONL directory (`sessionDir` / env / flag, symlink
  and trust caveats, picker scope) and the extension `_persist` takeover, instead of replacing the manager.
- [Hermes-like App on a pi Backend — pi-coding-agent or pi-agent-core?](./hermes-like-app-on-pi-backend.md)
  — the layer choice this refines; persistence was the one requirement that could have flipped it.
- [Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore](../howto/durable-pi-state-on-ephemeral-vm.md)
  — the file-level variant: sealing JSONL session files to an object bucket without the SDK, for a host whose disk is thrown away.
- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — why
  `pi-coding-agent` owns sessions and `pi-agent-core` does not.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — the alternative when the
  runtime, not your database, should own durability.
- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — the cost of the layer below this one when the host is an edge runtime.

## Changelog

- 2026-11-03 — re-verified the seam on 1.5.0 (tag `v1.5.0`, `f9a26365`): `SessionManager.inMemory`
  still hydrates with `isPersisted()` false and no session file, `_appendEntry` still calls
  `this._persist(entry)` at `session-manager.ts:1198`, and a `_persist` override captured
  `thinking_level_change, message, custom, compaction`. Added the link to the directory-level
  sibling below; no claim in this file changed.
- 2026-10-31 — created, answering "I plan for different persistence from the pi coding agent".
  Evidence: read of the installed 1.4.0 `session-manager.d.ts`, `agent-session.d.ts`,
  `resource-loader.d.ts`, `sdk.d.ts` and `session-manager.js`; plus three executed probes in
  `/tmp/pi-persist-probe` (hydration, capture override, `createAgentSession` acceptance), outputs
  quoted verbatim above.
