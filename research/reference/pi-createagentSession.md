---
title: createAgentSession — pi SDK Entry Point Reference
category: reference
tags: [pi, pi-coding-agent, sdk, createagentsession, agentsession, tool-selection, session-manager, reference]
status: complete
created: 2026-11-03
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.5.0
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/sdk.ts
confidence: high
---

# createAgentSession — pi SDK Entry Point Reference

## Summary

`createAgentSession(options?)` builds one `AgentSession`: a conversation with its model, tools,
system prompt, compaction state, and extension runtime, wired to a `SessionManager`,
`SettingsManager`, `ModelRuntime`, and `ResourceLoader`. Every one of those is optional; omitted
ones are constructed by `DefaultResourceLoader` and friends, so the zero-argument call discovers
whatever the current directory and `~/.pi/agent` provide.

```typescript
const { session, extensionsResult, modelFallbackMessage } = await createAgentSession();
```

Everything below is from the 1.5.0 type declarations (`dist/core/sdk.d.ts`,
`dist/core/agent-session.d.ts`) plus runtime probes; nothing here is inferred from prose docs.

## Details

### Signature and result

| Item | Type |
|---|---|
| Input | `CreateAgentSessionOptions` (all fields optional) |
| Resolves to | `Promise<CreateAgentSessionResult>` |
| `result.session` | `AgentSession` — the conversation |
| `result.extensionsResult` | `LoadExtensionsResult` — `{ extensions, errors, runtime }` for host UI setup |
| `result.modelFallbackMessage` | `string \| undefined` — set when a restored session's saved model was unavailable |

`createAgentSession` is async because construction loads extensions, skills, prompt templates,
themes, and AGENTS.md context files.

### Options

| Option | Type | Default when omitted | Notes |
|---|---|---|---|
| `cwd` | `string` | `process.cwd()` | Project discovery, tool paths, session grouping |
| `agentDir` | `string` | `~/.pi/agent` | Credentials, models.json, global extensions, session store |
| `modelRuntime` | `ModelRuntime` | runtime over `agentDir/auth.json` + `models.json` | Canonical model/auth resolution |
| `model` | `Model` | settings, else first available | Pass a `pi-ai` model object |
| `thinkingLevel` | `ThinkingLevel` | settings, else `"medium"` (clamped to model) | `off`…`xhigh`/`max` |
| `scopedModels` | `{model, thinkingLevel?}[]` | from settings | The Ctrl+P cycle set |
| `noTools` | `"all" \| "builtin"` | unset | `"all"` = no tools; `"builtin"` = drop read/bash/edit/write, keep extension tools |
| `tools` | `string[]` | `defaultTools` setting, else built-ins | Allowlist **or** `+name`/`-name` deltas — never both |
| `excludeTools` | `string[]` | none | Denylist, applied after `tools`, MCP included |
| `customTools` | `ToolDefinition[]` | none | Registered and active on creation |
| `resourceLoader` | `ResourceLoader` | `DefaultResourceLoader` | Supply your own to own discovery entirely |
| `sessionManager` | `SessionManager` | `SessionManager.create(cwd)` | Persistent JSONL tree; `SessionManager.inMemory()` for none |
| `settingsManager` | `SettingsManager` | `SettingsManager.create(cwd, agentDir)` | `SettingsManager.inMemory({...})` for overrides |
| `sessionStartEvent` | `SessionStartEvent` | none | Metadata for extension runtime startup |

### Tool selection, measured

Four knobs interact, and `tools` is not one thing. Probed against a machine whose `~/.pi/agent`
loads 7 extensions (so "extension tools" means real ones: `todo`, `repo_scout`, `poteto_*`):

| Configuration | `getActiveToolNames()` | Notes |
|---|---|---|
| `{}` (defaults) | `read, bash, edit, write, todo` | Built-ins plus extension tools that self-activate |
| `{ noTools: "all" }` | `[]` | System prompt shrank 57,659 → 8,336 chars |
| `{ noTools: "builtin" }` | `todo` | Only built-ins dropped |
| `{ tools: ["read","bash"] }` | `read, bash` | Allowlist: extension tools also disappear from callable set |
| `{ tools: ["+todo","-bash"] }` | `read, edit, write, todo` | Deltas against the default selection |
| `{ tools: ["read","+todo"] }` | **throws** | `Invalid tools option: tool names cannot be mixed with +name or -name entries` |
| `{ tools: [] }` | `[]` | Same effect as `noTools: "all"` |
| `{ excludeTools: ["bash"] }` | `read, edit, write, todo` | Denylist wins after `tools` |
| `{ customTools: [echo] }` | `…, echo` | Custom tools are appended and active by default |
| `{ customTools: [echo], tools: ["echo"] }` | `echo` | Allowlist trims custom tools too |

Two tool lists matter and they are not the same: `getActiveToolNames()` is what the model may
call now; `getCallableToolNames()` is everything registered and reachable (an allowlist narrows
both, a mere `noTools` narrows only the active set). `getAllTools()` returns `ToolInfo[]`, and
`setActiveToolsByName(names)` changes the active set at runtime.

The system prompt is derived from the active tool set — that is why dropping tools cut it from
57.7 KB to 8.3 KB — so tool selection is also a token-budget decision.

### Session members you will actually use

| Group | Members |
|---|---|
| Run | `prompt(text, {images?})`, `steer()`, `followUp()`, `abort()`, `waitForIdle()`, `isStreaming`, `isIdle` |
| Events | `subscribe(listener)` → unsubscribe; `agent_settled` is the completion signal |
| Read state | `messages`, `model`, `thinkingLevel`, `systemPrompt`, `sessionId`, `sessionName`, `sessionFile`, `state`, `getActiveToolNames()`, `getAllTools()`, `getToolDefinition(name)` |
| Model | `setModel()`, `cycleModel(dir?)`, `setThinkingLevel()`, `cycleThinkingLevel()`, `getAvailableThinkingLevels()`, `supportsThinking()`, `scopedModels` |
| Queue | `clearQueue()`, `pendingMessageCount`, `getSteeringMessages()`, `getFollowUpMessages()`, `setSteeringMode()`, `setFollowUpMode()` |
| Context | `compact(instructions?)`, `abortCompaction()`, `isCompacting`, `autoCompactionEnabled`, `getContextUsage()`, `getSessionStats()`, `refreshContext()` |
| Shell | `executeBash(cmd, onChunk?)`, `abortBash()`, `isBashRunning`, `hasPendingBashMessages` |
| History | `navigateTree(targetId)`, `getUserMessagesForForking()`, `exportToHtml()`, `exportToJsonl()`, `setSessionName()` |
| Lifecycle | `dispose()`, `reload(options?)`, `bindExtensions(bindings)`, `hasExtensionHandlers(eventType)` |

`session.cwd` is **not** public API: the config accepts `cwd`, the session does not expose it
(`undefined` at runtime in 1.5.0). Keep your own reference.

### The sibling constructors

| Function | For |
|---|---|
| `createAgentSession(options)` | One session, one cwd. Start here. |
| `createAgentSessionServices(options)` | Build the cwd-bound services alone — see [AgentSessionServices](./pi-agent-session-services.md) |
| `createAgentSessionFromServices(options)` | Create a session on services you already built |
| `createAgentSessionRuntime(factory, {cwd, agentDir, sessionManager, sessionStartEvent?})` | A long-lived host that swaps sessions |

`AgentSessionRuntime` is what you reach for when the host must support `/new`, `/resume`,
`/fork`, or JSONL import. It owns the current `AgentSession` plus its services and exposes
`switchSession(sessionPath)`, `newSession({parentSession, setup, withSession})`,
`fork(entryId, {position: "before"|"at"})`, `importFromJsonl(path)`, `services`, `diagnostics`,
`modelFallbackMessage`, and `dispose()`. Every replacement **tears the old runtime down first**,
so existing `subscribe()` listeners belong to a dead session and must be rebound —
`setRebindSession(fn)` and `setBeforeSessionInvalidate(fn)` exist for exactly that.

[createAgentSessionRuntime](./pi-agent-session-runtime.md) gets its own reference: the factory contract,
the replacement ordering, and the failure modes.

### Minimum custom `ResourceLoader`

Ten methods, all synchronous except `reload` (verified against the typechecked
`examples/sdk/12-full-control.ts`):

```typescript
const resourceLoader: ResourceLoader = {
  getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => "You are a minimal assistant. Available: read, bash.",
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
  reload: async () => {},
};
```

If you only need to kill discovery while keeping defaults, use
`new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true })`,
`await loader.reload()`, and pass it in — that is shorter than reimplementing the interface.

### Session storage default

With no `sessionManager`, the session is **file-backed and lazy**: `sessionFile` points at
`<agentDir>/sessions/<slugified-cwd>/<ISO-timestamp>_<uuid>.jsonl`, and the file does not exist
until the first entry is written. Verified: the path materialised, `existsSync()` was `false`
right after creation. Pass `SessionManager.inMemory()` (or `inMemory(cwd, opts, entries)` to
hydrate from your own store) when the host owns persistence.

### Settings and credentials

`SettingsManager.inMemory({ compaction: { enabled: false } })` flipped
`session.autoCompactionEnabled` to `false` in the probe — settings objects are merged over
defaults, not required whole. For credentials, construct `ModelRuntime.create({authPath,
modelsPath})` and call `setRuntimeApiKey(provider, key)`, then pass both the runtime and the
model; that keeps an app's own key out of the user's `auth.json`.

## Gotchas

- **`noTools` is not a boolean.** It is `"all" | "builtin"`. `noTools: true` fails the type
  check, and in plain JavaScript it is **not** ignored: a truthy value reads as `"builtin"`, so the
  built-ins disappear while extension tools stay. Measured at 1.5.0: `noTools: true` left the extension tool `todo`
  active, where `noTools: "all"` left none.
- **`tools` changes meaning by shape.** Plain names = allowlist; only `+x`/`-x` = deltas
  against the defaults; mixing them throws at construction. `[]` is an allowlist that enables
  nothing, which is why it matches `noTools: "all"`.
- **`excludeTools` applies after `tools`** and reaches MCP tools; an allowlist that omits
  `mcp__*` entries drops them, and `tools: []` drops MCP entirely.
- **The JSDoc example in `sdk.d.ts` shows `continueSession: true`, and that option does not
  exist** in `CreateAgentSessionOptions`. Continuing a session is `switchSession` on
  `AgentSessionRuntime`, or constructing a `SessionManager` over the existing history.
- **Defaults are not hermetic.** A zero-option call loads the host's `~/.pi/agent` extensions
  (7 in the probe), so an embedder shipping to strangers must pass `DefaultResourceLoader({
  noExtensions: true })` or its own loader.
- **The system prompt is a function of the active tools** (57.7 KB vs 8.3 KB measured). Reading
  it before and after a tool change is a cheap sanity check on your configuration.
- **`getActiveToolNames()` ≠ `getCallableToolNames()`.** Log both when debugging why a tool
  never runs.
- **`dispose()` is mandatory.** It aborts work, invalidates extension contexts, and removes
  listeners; a leaked session keeps the process alive and holds file handles.
- **Rebind after runtime replacement.** Listeners attached to the old `AgentSession` go silent
  after `newSession`/`switchSession`/`fork`; use `setRebindSession`.
- **Nothing here needs a model call.** Construction resolves a model but sends no request — the
  probes above ran offline against a configured provider.

## Related

- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the ordered path through
  these options: install traps, discovery isolation, the tool matrix, persistence, queueing, and dispose
  semantics, each measured.

## Changelog

- 2026-11-06: Corrected the `noTools: true` gotcha — a truthy value is read as
  `"builtin"`, not ignored (re-measured on 1.5.0); linked the SDK how-to.
- 2026-11-03: Created from pi 1.5.0 `dist/core/sdk.d.ts`, `agent-session.d.ts`,
  `agent-session-runtime.d.ts`, the typechecked SDK examples, and two runtime probes (option
  matrix and custom-tool/session-file behaviour).
