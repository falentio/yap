---
title: AgentSessionServices — the Cwd-Bound Service Bundle in the pi SDK
category: reference
tags: [pi, pi-coding-agent, sdk, agentsessionservices, createagentsessionservices, model-runtime, settings-manager, resource-loader, diagnostics, reference]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/agent-session-services.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/sdk.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/model-runtime.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/resource-loader.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sdk.md
  - https://pi.dev/docs/latest/sdk
confidence: high
---

# AgentSessionServices — the Cwd-Bound Service Bundle in the pi SDK

## Summary

`AgentSessionServices` is the **five-field bundle of everything a session needs except the session**:
which directory it runs in, which credentials and model catalog it resolves against, which settings
apply, and which skills/prompts/extensions/context files it sees. `createAgentSessionServices({ cwd })`
builds and returns that bundle. It creates **no `AgentSession` and no `SessionManager`** — by design, so
the caller can resolve a model, a thinking level, and a tool set *against the target cwd* before a
session exists.

```typescript
const services = await createAgentSessionServices({ cwd, agentDir?, settingsManager?, modelRuntime? });

services.cwd              // absolute, via resolvePath
services.agentDir         // absolute; defaults to getAgentDir()
services.modelRuntime     // ModelRuntime: providers, credentials, model catalog, virtual models
services.settingsManager  // SettingsManager: global <agentDir>/settings.json + project <cwd>/.pi/settings.json
services.resourceLoader   // ResourceLoader, already reloaded and fully populated
services.diagnostics      // AgentSessionRuntimeDiagnostic[] — non-fatal problems, not exceptions
```

It is one of four constructors; the split exists so a runtime can rebuild services whenever the cwd
changes:

| Function | Returns | Creates a session? | Creates services? |
|---|---|---|---|
| `createAgentSessionServices({ cwd, … })` | `AgentSessionServices` | no | yes |
| `createAgentSessionFromServices({ services, sessionManager, … })` | `{ session, extensionsResult, modelFallbackMessage }` | yes | no |
| `createAgentSession(options)` | same result shape | yes | yes, inline, when not given |
| `createAgentSessionRuntime(factory, …)` | `AgentSessionRuntime` | on every replacement | via your factory |

`docs/sdk.md` mentions services exactly once, in the runtime sentence: each replacement
"recreates services for the target working directory". Everything below is from the 1.5.0 source plus
probes run on pi-coding-agent 1.5.0 / Node 26.13.0 on 2026-11-06.

## Details

### The five fields

| Field | Type | Where it comes from | Fixed for the bundle's life? |
|---|---|---|---|
| `cwd` | `string` | `resolvePath(options.cwd)` — relative paths are resolved against `process.cwd()` | yes; one bundle per cwd |
| `agentDir` | `string` | `resolvePath(options.agentDir)`, else `getAgentDir()` | yes |
| `modelRuntime` | `ModelRuntime` | your instance if passed, else `ModelRuntime.create({ authPath: <agentDir>/auth.json, modelsPath: <agentDir>/models.json, signal })` | yes, but mutated: extension registrations land in it |
| `settingsManager` | `SettingsManager` | your instance if passed, else `SettingsManager.create(cwd, agentDir)` | yes, and it keeps reading files on later setters |
| `resourceLoader` | `ResourceLoader` | always a **new** `DefaultResourceLoader({ …resourceLoaderOptions, cwd, agentDir, settingsManager })`, then `await reload()` | no — `reload()` re-discovers everything |
| `diagnostics` | `AgentSessionRuntimeDiagnostic[]` | problems collected during creation | a plain mutable array |

Measured identity: passing `modelRuntime` and `settingsManager` returns **the same objects**
(`svc.modelRuntime === myRuntime` and `svc.settingsManager === mySettings` both `true`). The resource loader is
never yours unless you replace the whole class: `resourceLoaderOptions` cannot override
`cwd`/`agentDir`/`settingsManager` — the function spreads your object first and then writes those three
over it (measured: a cast `resourceLoaderOptions.cwd = "/tmp/WRONG"` left `services.cwd` and the
discovered settings untouched).

The exact file paths this resolves, and the switch that removes each one: [Default Discovery Paths](./pi-sdk-default-discovery.md).

### What creation does, in order

1. `resolvePath()` on `cwd` and `agentDir` (`agentDir` defaults to `getAgentDir()`).
2. Build or adopt the `ModelRuntime` (reading `auth.json` and `models.json` from `agentDir`).
3. Build or adopt the `SettingsManager` — measured: project `<cwd>/.pi/settings.json` **wins over**
   `<agentDir>/settings.json` (a probe with `defaultModel` in both returned the project value, and
   `defaultThinkingLevel: "high"` came through with it).
4. Construct a `DefaultResourceLoader` and `await resourceLoader.reload(options.resourceLoaderReloadOptions)`.
   **Extension factories run here**, not at `bindExtensions` — measured: an inline factory logged during
   `createAgentSessionServices`, while `session_start` did not fire until `bindExtensions({})`.
5. Drain three queues the extensions filled during load, registering each into the model runtime:
   `pendingProviderRegistrations` → `registerProvider`, `pendingNativeProviderRegistrations` →
   `registerNativeProvider`, `pendingVirtualModelRegistrations` → `registerVirtualModel`. Each queue is
   **emptied** afterwards. Measured: a provider registered by an extension was immediately resolvable —
   `services.modelRuntime.getModel("svc-demo", "m1")` answered, and all three queues read `0`.
6. `await modelRuntime.refresh({ allowNetwork: false })` — local catalog only, no network at build time.
7. Apply `extensionFlagValues` (below) and push any problems into `diagnostics`.

Cost, measured with every discovery switch off: **83 ms** for `createAgentSessionServices`, versus
**9 ms** for a following `createAgentSessionFromServices`. The bundle is the expensive half; rebuilding
it per `/new` is the real price of the runtime's cwd correctness.

### Extension registration is bridged here

This is the function that turns an extension's `pi.registerProvider()`/`registerVirtualModel()` calls
into real entries in the model runtime, because those calls land in queues during the load phase and
nothing else drains them:

| Extension throws from | Diagnostic message (verbatim) | Result |
|---|---|---|
| `registerVirtualModel` conflicting with a physical model | `Extension "<inline:1>" error: Virtual model anthropic/claude-fable-5 conflicts with a physical model.` | other extensions still register; session creation continues |
| any `registerProvider`/`registerNativeProvider` failure | `Extension "<path>" error: <message>` | same — non-fatal |
| inline factory | identified as `<inline:N>` | — |

Measured: with one failing virtual-model extension **and** one working provider extension, `diagnostics`
held the one error while `svc.modelRuntime.getModel("dup", "a")` still resolved. Services never throw
for a bad registration.

### `extensionFlagValues`

A `Map<string, boolean | string>` of CLI-style `--flag` values, matched against flags the loaded
extensions declared with `pi.registerFlag(name, { type: "boolean" | "string" })`:

| Input | Outcome |
|---|---|
| boolean flag, any supplied value | `runtime.flagValues.set(name, true)` — measured `[["beta",true]]` |
| string flag, string value | stored as given |
| string flag, `true` | diagnostic `Extension flag "--label" requires a value` |
| undeclared name | diagnostic `Unknown option: --nope` |
| same, with no extensions loaded | diagnostic `Unknown option: --beta` — still an error, not a warning |

### Diagnostics: what lands here and what does not

| Event | In `services.diagnostics`? | Where instead |
|---|---|---|
| extension registration failure | yes | — |
| bad `extensionFlagValues` entry | yes | — |
| extension file fails to load/parse | **no** | `resourceLoader.getExtensions().errors` — measured `Failed to load extension: ParseError: Missing semicolon.` |
| extension path does not exist | **no** | same `errors` array |
| cwd does not exist | **no** | nowhere — measured: created services for `/tmp/pi-svc/definitely-missing`, no throw, no diagnostic |
| agentDir does not exist | **no** | it is **created on disk** as a side effect of opening settings/auth storage |

The runtime docstring is explicit about why they are values rather than exceptions: the app layer
decides whether a warning is shown and whether an error aborts startup.

### `createAgentSessionFromServices` forwards, it does not re-derive

| Input | Forwarded as |
|---|---|
| `services.cwd`, `agentDir`, `modelRuntime`, `settingsManager`, `resourceLoader` | the same objects, into `createAgentSession`'s options |
| `sessionManager` | required from the caller |
| `model`, `thinkingLevel`, `scopedModels` | session options |
| `tools`, `excludeTools`, `noTools`, `customTools` | the tool-selection knobs |
| `sessionStartEvent` | passed through |

Two measured consequences:

- **It does not return `diagnostics`.** Result keys are exactly `session`, `extensionsResult`,
  `modelFallbackMessage` — `b.diagnostics` was `undefined`. This is why the canonical runtime factory has to
  write `diagnostics: services.diagnostics` itself.
- **The session's cwd comes from services, not from the session manager.** Passing a
  `SessionManager.inMemory("/tmp/pi-svc/other")` alongside services built for `/tmp/pi-install-probe` still
  produced a session rooted at the services cwd; `AgentSession` exposes no `cwd` at all, so this is
  observable only through tools and the system prompt.

The system prompt is not taken literally: with `systemPrompt: "svc-probe"`, `session.systemPrompt` came back as
`"svc-probe\n\n<cwd>\n/tmp/pi-install-probe\n</cwd>"` — a `<cwd>` block is appended at session creation.

### Reuse rules

- **One bundle per cwd.** `cwd` is baked into the loader, the settings manager, and (through
  `settingsManager`) into which settings apply. Reusing a bundle after a cwd change misroutes every
  path-bound tool; the runtime solves this by calling your factory again.
- **One bundle, many sessions.** Measured: two sessions from the same services object were distinct
  `AgentSession` instances sharing the same `model` instance — cheap and safe, as long as you do not
  need different tools or settings per session.
- **Re-resolution is free only where you skip services.** Pass a `modelRuntime` and
  `settingsManager` to keep a warm catalog and settings across bundles, but let `resourceLoader` be
  rebuilt: it is the part that discovers cwd-bound extensions, skills, and prompts.
- **Live resource refresh happens on the loader, not the bundle.** `services.resourceLoader.reload()` is
  how a host picks up a new skill or extension without rebuilding services.

## Gotchas

- **`createAgentSessionFromServices` silently drops `diagnostics`.** If you log diagnostics from its
  result you log nothing. Read `services.diagnostics` (or what your factory attached) instead.
- **`resourceLoaderOptions` is a partial, and the three identity fields are not yours to set.** TypeScript
  rejects it (`Omit<DefaultResourceLoaderOptions, "cwd" | "agentDir" | "settingsManager">`), and a cast at
  runtime is overwritten. Pass `cwd`/`agentDir`/`settingsManager` at the top level.
- **No cwd validation.** Unlike the runtime's session-manager check, services accept a nonexistent
  directory without a throw or a diagnostic; the failure surfaces later, from tools or a `pwd`.
- **A missing `agentDir` is created.** Measured: `/tmp/pi-svc/no-agent-dir` did not exist before the call and
  did after it. Do not treat absence as "no global config".
- **Extension load errors are not in `diagnostics`.** A parse error or a nonexistent
  `additionalExtensionPaths` entry appears in `resourceLoader.getExtensions().errors`; services reported
  `[]` for both. Check both places or you will miss every broken extension.
- **Extension factories already ran; `session_start` has not.** Anything an extension does at factory time
  (registering providers, flags, tools) is in place before your first session; anything it does on
  `session_start` waits for `session.bindExtensions({})`.
- **Queues are drained, not replayed.** `pendingProviderRegistrations` and friends are cleared by the first
  `createAgentSessionServices` that sees them. Two bundles built from one loader leave the second without
  the extension's provider registrations.
- **`diagnostics` is a mutable array you may share.** The runtime reuses the same instance
  (`runtime.services.diagnostics === runtime.diagnostics`); pushing into it after creation is visible to both.

## Related

- [createAgentSessionRuntime — the Session-Owning Runtime in the pi SDK](./pi-agent-session-runtime.md) — the
  caller that rebuilds this bundle on every `/new`, `/resume`, `/fork`, and import.
- [createAgentSession — pi SDK Entry Point Reference](./pi-createagentSession.md) — the same options with
  services built inline, and the `defaultModel`/`defaultThinkingLevel` resolution services feeds.
- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the ordered path, including
  isolation via `ResourceLoader` switches that travel through `resourceLoaderOptions`.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`): `agent-session-services.d.ts/.js`, `sdk.js`,
  `model-runtime.js`, `settings-manager.js`, plus probes covering path resolution, field identity,
  project/global settings precedence, extension provider and virtual-model registration with its
  diagnostics, flag-value errors, cwd/agentDir edge cases, and two-session reuse of one bundle.
