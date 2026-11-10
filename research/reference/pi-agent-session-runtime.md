---
title: createAgentSessionRuntime — the Session-Owning Runtime in the pi SDK
category: reference
tags: [pi, pi-coding-agent, sdk, createagentsessionruntime, agentsessionruntime, session-manager, cwd, rebind, reference]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/agent-session-runtime.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/agent-session-services.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/13-session-runtime.ts
  - https://pi.dev/docs/latest/sdk
confidence: high
---

# createAgentSessionRuntime — the Session-Owning Runtime in the pi SDK

## Summary

`createAgentSessionRuntime(factory, { cwd, agentDir, sessionManager, sessionStartEvent? })` returns an
`AgentSessionRuntime`: a **long-lived owner of "the current session"** for a host that must replace
sessions at runtime — new chat, resume, fork, import. It never builds a session itself. It stores your
**factory** and replays it for every replacement, because each replacement may target a different
working directory and therefore needs fresh cwd-bound services.

```typescript
const runtime = await createAgentSessionRuntime(createRuntime, { cwd, agentDir, sessionManager });
runtime.session          // the current AgentSession — changes on every replacement
runtime.services         // its cwd-bound services (modelRuntime, settings, resource loader)
runtime.cwd              // effective cwd of the current session

await runtime.newSession();                  // → { cancelled: boolean }
await runtime.switchSession(path);           // → { cancelled: boolean }
await runtime.fork(entryId, { position });   // → { cancelled: boolean; selectedText?: string }
await runtime.importFromJsonl(path);         // → { cancelled: boolean }
await runtime.dispose();
```

| Constructor | Builds | Use when |
|---|---|---|
| `createAgentSession(options)` | services **and** one session | one cwd, one conversation |
| `createAgentSessionServices({ cwd, … })` | services only | you need to resolve model/tools against a cwd before a session exists |
| `createAgentSessionFromServices({ services, sessionManager, … })` | one session on existing services | inside a runtime factory, or after your own resolution step |
| `createAgentSessionRuntime(factory, options)` | services + session + **replacement machinery** | the host has `/new`, `/resume`, `/fork`, or import |

The CLI itself is a client of this API: `dist/main.js` builds the runtime once, and
`interactive-mode.js` routes `/new`, `/resume`, and the RPC host's `newSession`/`switchSession` through it.

Everything below is from the 1.5.0 declarations and runtime source (`agent-session-runtime.js`), plus
probes run on pi-coding-agent 1.5.0 / Node 26.13.0 on 2026-11-06.

## Details

A runtime is also what the exported `InteractiveMode` wraps: [UI Options](./pi-sdk-ui-options.md).

### The factory contract

```typescript
type CreateAgentSessionRuntimeFactory = (options: {
  cwd: string;
  agentDir: string;
  sessionManager: SessionManager;
  sessionStartEvent?: SessionStartEvent;
  projectTrustContext?: ProjectTrustContext;
}) => Promise<CreateAgentSessionRuntimeResult>;

interface CreateAgentSessionRuntimeResult extends CreateAgentSessionResult {
  services: AgentSessionServices;          // required: the runtime adopts it
  diagnostics: AgentSessionRuntimeDiagnostic[];  // required
}
```

`CreateAgentSessionResult` is `{ session, extensionsResult, modelFallbackMessage }`, so the union is what
`createAgentSession()` already returns plus `services` and `diagnostics` — which is why the canonical
factory is three lines:

```typescript
const factory: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd, settingsManager });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, tools, customTools })),
    services,
    diagnostics: services.diagnostics,
  };
};
```

[createAgentSessionServices](./pi-agent-session-services.md) is the other half of this contract —
what the bundle builds, what it validates, and where its diagnostics come from.

What the factory must close over, and what it must not: **process-global fixed inputs** (your settings
manager, model runtime, tool list, credential paths) travel by closure; **everything cwd-bound**
(settings that read from the project, resource discovery, built-in tool roots) must be rebuilt from the
`cwd` argument on every call, which is exactly what `createAgentSessionServices({ cwd })` does.
Resolve any relative resource path to an absolute one before it reaches services — later cwd switches
would otherwise reinterpret it.

The runtime validates `options.sessionManager`'s cwd before the first factory call
(`assertSessionCwdExists`), then constructs `AgentSessionRuntime(result.session, result.services,
createRuntime, result.diagnostics, result.modelFallbackMessage)`.

### Replacement lifecycle, measured

Every replacement is **tear the old runtime down, then build the new one**. The order, captured from
extensions and host callbacks during `newSession()`:

| # | Step | Observed |
|---|---|---|
| 1 | `session_before_switch` handler | `before_switch:new` — return `{ cancel: true }` to abort the whole replacement |
| 2 | `await session.abort()` | an in-flight turn is aborted **and persisted** into the outgoing file |
| 3 | `session_shutdown` handler | `shutdown:new` (reason is `new`; `quit` on `dispose()`) |
| 4 | `setBeforeSessionInvalidate` callback | `invalidate` — synchronous, before the old context goes stale |
| 5 | `session.dispose()` | old listeners, extension contexts, file handles released |
| 6 | factory runs for the new cwd | new services, new `AgentSession` |
| 7 | `setup(sessionManager)` (`newSession` only) | `setup ran` — then `refreshContext()` |
| 8 | `setRebindSession` callback | `rebind` — **the only place you can re-attach to the new session** |
| 9 | `withSession(ctx)` | receives `session.createReplacedSessionContext()` |

Measured aborted-turn persistence: a 350 ms in-flight prompt, then `newSession()`. The old
session's last assistant message carried `stopReason: "aborted"`, the prompt promise **resolved**
(not rejected), the outgoing JSONL existed with 6 entries, and `old === runtime.session` was `false`.

### The four replacement verbs

| Verb | Session manager it builds | `sessionStartEvent.reason` | Measured result |
|---|---|---|---|
| `newSession({ parentSession?, setup?, withSession? })` | `SessionManager.create(this.cwd, sessionDir)`, or `SessionManager.inMemory(this.cwd)` when the current one is in-memory | `"new"` | new file in the same dir, `messages: 0`; in-memory runtime stayed in-memory across the call |
| `switchSession(path, { cwdOverride?, withSession?, projectTrustContextFactory? })` | `SessionManager.open(path, undefined, cwdOverride)` | `"resume"` | history restored (`messages`), and `runtime.cwd` switched to the file's cwd |
| `fork(entryId, { position?, withSession? })` | persisted: `SessionManager.open(currentFile)` + `createBranchedSession(leaf)`; in-memory: branch in place | `"fork"` | see the fork rules below |
| `importFromJsonl(inputPath, cwdOverride?)` | copies the file into the session dir, then `SessionManager.open(destination, dir, cwdOverride)` | `"resume"` | copy landed as `pi-import-source.jsonl`, second import as `pi-import-source-1.jsonl` |

Each returns `{ cancelled: boolean }` (plus `selectedText` for `fork`). `cancelled: true` means a
`session_before_switch` / `session_before_fork` handler vetoed it — measured: the runtime's session
and file were untouched, and the log held only `before_switch:resume`.

### cwd is a property of the session, not the runtime

`newSession()` **keeps** `this.cwd`. `switchSession`, `fork` (persisted), and `importFromJsonl` adopt
the target session's stored cwd and recreate services for it. Measured: runtime started in
`/tmp/pi-install-probe`, switched to a session whose cwd was `/tmp/pi-cwd-other`; afterwards
`runtime.cwd` and `runtime.services.cwd` both read `/tmp/pi-cwd-other`, and
`session.executeBash("pwd")` answered `/tmp/pi-cwd-other`. Anything you cached from the old
`services` (the resource loader, the model runtime's resolved tools) is stale after a switch.

If the stored cwd no longer exists, `switchSession` throws `MissingSessionCwdError` **before** the
teardown, so the runtime survives intact; passing `{ cwdOverride }` imports it against a cwd you pick.

### fork semantics

| `position` | Leaf used | Effect | Measured |
|---|---|---|---|
| `"before"` (default) | the selected user entry's **parent** | branches *above* the message so it can be re-sent | 2 user messages → **0** after forking before the first one; `selectedText` returned `"Say ALPHA"` |
| `"at"` | the selected entry itself | keeps that message and everything before it | 1 user message retained |

Errors, verbatim: `Invalid entry ID for forking` for an unknown id, and for `"before"` on a non-user
entry; `This session has not been saved yet. Send a message before cloning or forking it.` when the
current session file has not been written yet (lazy persistence).

### Rebind and invalidate hooks

```typescript
runtime.setRebindSession(async (session) => {
  await session.bindExtensions({});          // emits session_start for the NEW session
  unsubscribe?.();
  unsubscribe = session.subscribe(onEvent);
});
runtime.setBeforeSessionInvalidate(() => { /* synchronous host teardown */ });
```

Both are optional and both are load-bearing:

- **`bindExtensions` is not automatic.** Without it in the rebind hook, a replacement session never
  emits `session_start`, so extension startup work (MCP server connections, for example) never happens.
  Measured: with a rebind hook that did nothing, the log after `newSession()` was
  `before_switch:new | session_shutdown:new` — **no** `session_start:new`. With `bindExtensions` in the
  hook: `shutdown:new | invalidate | setup ran | start:new | rebind`.
- **Subscriptions die with the session.** A listener attached to the pre-replacement session fired
  **0** times afterwards, while the new session's fired once. Every listener, and any cached
  `getActiveToolNames()`, belongs to a dead object after a swap.
- **`withSession` is post-rebind.** It receives a `ReplacedSessionContext` (the extension command context
  plus `sendMessage`/`sendUserMessage`), which is the supported way to post a greeting into a freshly
  created session without racing the rebind.

### Diagnostics and model fallback

`AgentSessionRuntimeDiagnostic` is `{ type: "info" | "warning" | "error", message: string }`. Runtime
creation returns them instead of printing or exiting: the app layer decides what to show and whether
to abort. `runtime.diagnostics` is the **same array instance** as `services.diagnostics`
(`rt.services.diagnostics === rt.diagnostics` was `true`), replaced wholesale on each swap.

Extension load failures are **not** in there — a nonexistent `additionalExtensionPaths` entry produced
`services.diagnostics: []` and instead
`extensionsResult.errors: [{ path: "/tmp/not-a-real-extension.ts", error: "Extension path does not exist: …" }]`.
Carry `extensionsResult` out of the factory if you want to surface those.

`modelFallbackMessage` is set when a restored session's saved model is unavailable; it is refreshed on
each replacement along with the session.

## Gotchas

- **A factory throw leaves the runtime pointing at a disposed session.** The teardown (steps 1–5) has
  already run when the factory is called. Measured with a factory that threw on its second call:
  `newSession()` rejected with the factory's error, `runtime.session === old`, the old session was
  idle and disposed, and a later `prompt()` **resolved** after emitting a single `agent_settled` event
  with **zero** messages appended and a stale `getLastAssistantText()`. Recovery is another
  `newSession()` once the factory works — measured: new object, `messages: 0`, prompt answered. Wrap
  replacement calls in try/catch and verify `runtime.session !== previousSession` before using it.
- **`switchSession` fails safely, a factory does not.** Cwd validation and unknown paths throw before
  teardown, so the old session stays live. The window of danger is only the factory itself.
- **The error classes are not exported from the package entry.** `SessionImportFileNotFoundError` and
  `MissingSessionCwdError` exist, but `import` … from "@earendil-works/pi-coding-agent"` fails with
  *does not provide an export named 'SessionImportFileNotFoundError'*. Match on `error.name` or
  `constructor.name`; the import error carries `filePath`.
- **`importFromJsonl` copies, it does not move.** The file is copied into the current session dir
  (suffixing `-1`, `-2` on collision) and the copy is what the runtime opens; the source stays where
  it was. Importing a file already stored in that dir opens it in place.
- **`fork` needs a written session file.** With lazy persistence a brand-new session has no file yet,
  and `fork` throws `This session has not been saved yet…` until the first entry is written.
- **In-memory runtimes stay in memory.** `newSession()` on an `inMemory()` manager calls
  `SessionManager.inMemory(cwd)`; `sessionFile` remained `undefined` before and after. Do not build a
  "/new" button expecting files to appear just because the first manager was in-memory.
- **`dispose()` is async and fires `session_shutdown` with reason `quit`**, then
  `beforeSessionInvalidate`, then `session.dispose()`. `await` it; the measured log on dispose was
  `session_shutdown:quit` followed by `beforeSessionInvalidate`.
- **`runtime.cwd` is not `session.cwd`.** `AgentSession` does not expose `cwd`; the runtime does, and it
  is the current session's cwd. Read it from the runtime, or keep your own copy.
- **Each replacement recreates services.** Anything expensive you built into the factory (a model
  catalog refresh, an MCP handshake) repeats on every `/new`. Hoist what is truly global into the
  closure and leave only cwd-bound work to the factory.

## Related

- [createAgentSession — pi SDK Entry Point Reference](./pi-createagentSession.md) — the single-session
  constructor and the option matrix this runtime's factory passes through.
- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the ordered SDK path,
  including the working runtime snippet.
- [pi Session Persistence in an External Store](../technology/pi-session-persistence-external-store.md) — what
  `switchSession`/`fork`/`importFromJsonl` become when the JSONL files are not the source of truth.
- [Hermes-like App on a pi Backend](../technology/hermes-like-app-on-pi-backend.md) — the bot-lifecycle verbs
  this runtime supplies to a long-lived host.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`): `agent-session-runtime.d.ts`, `agent-session-services.d.ts`,
  and `agent-session-runtime.js`, plus ~10 probes covering the replacement ordering, aborted-turn
  persistence, cwd adoption, fork before/at, JSONL import and collision suffixing, cancel handling,
  rebind/invalidate hooks, in-memory runtimes, missing-cwd errors, and the factory-throw failure mode.
