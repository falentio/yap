---
title: Create a Pi Agent Session — SDK How-To
category: howto
tags: [pi, pi-coding-agent, sdk, createagentsession, agentsession, session-manager, custom-tools, resource-loader, howto]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/01-minimal.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/11-sessions.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/13-session-runtime.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/14-codemode-mcp.ts
  - https://pi.dev/docs/latest/sdk
confidence: high
---

# Create a Pi Agent Session — SDK How-To

## Goal

Boot a working `AgentSession` from `@earendil-works/pi-coding-agent` inside your own Node/Bun
process, send it a prompt, stream its output, keep or discard its transcript, and shut it down.
End state: a session you configured deliberately — tools chosen, discovery under control,
persistence decided — that answers a prompt and disposes without leaking.

Reference material for every option lives in
[createAgentSession — pi SDK Entry Point Reference](../reference/pi-createagentSession.md);
this file is the ordered path through it. All numbers below were measured on
**pi-coding-agent 1.5.0, Node 26.13.0, npm layout**, on 2026-11-06.

## Prerequisites

| Requirement | Value |
|---|---|
| Package | `@earendil-works/pi-coding-agent@1.5.0` (MIT) |
| Runtime | Node `>=22.19.0` or Bun; the package is **ESM-only** |
| Module syntax | ESM: `import`, or a `.mts`/`"type": "module"` file. `require()` fails — see Troubleshooting |
| Parameter schemas | TypeBox, from the `typebox` package (`Type.Object(...)`) |
| Provider credential | One reachable model with an API key, or `prompt()` throws `No API key found for <provider>` |
| Duration | Install is seconds on npm; the first `createAgentSession()` call is async (loads extensions, skills, prompts, themes, context files) |

Install, and note the two packaging traps:

```bash
npm i @earendil-works/pi-coding-agent   # package dir measured 27 MB in an isolated probe
bun add @earendil-works/pi-coding-agent
pnpm add @earendil-works/pi-coding-agent && pnpm add typebox   # pnpm's strict node_modules hides typebox
```

`typebox` is a transitive dependency, so npm hoists it to `node_modules/typebox` and `import { Type } from "typebox"`
resolves. pnpm does not hoist, so add it as a direct dependency. It is **not** re-exported by
`pi-coding-agent`, and `@earendil-works/pi-ai` no longer exports `Type` at 1.5.0 (importing it there is a
type error: `has no exported member 'Type'`).

## Steps

### 1. Boot the smallest session that answers

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();
try {
  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });
  await session.prompt("What files are in the current directory?");
} finally {
  session.dispose();
}
```

`createAgentSession()` returns `{ session, extensionsResult, modelFallbackMessage }` and resolves only after
resource loading finished. With no options it uses `process.cwd()`, `~/.pi/agent` for credentials and
global resources, the stored settings, and the host's discovered extensions and skills — which is
convenient locally and wrong for an app you ship (step 3).

### 2. Read the answer, or stream it

| Need | Call | Measured behaviour |
|---|---|---|
| Final text only | `session.getLastAssistantText()` | The last assistant message's text; `undefined` when that message is an error or has no text |
| Progressive output | `session.subscribe(fn)` before `prompt()` | `message_update` + `assistantMessageEvent.type === "text_delta"` carries each chunk |
| "Pi will not continue on its own" | `event.type === "agent_settled"` | Fires after queued follow-ups drain; `agent_end` fires per low-level run, so it is the wrong done-signal |
| Whole transcript | `session.messages` | Includes the `system` message as element 0 |
| Token/cost accounting | `session.getSessionStats()` | `{sessionId, userMessages, assistantMessages, toolCalls, toolResults, totalMessages, tokens, cost, contextUsage}` |

`subscribe()` returns the unsubscribe function; call it in `finally` next to `dispose()`.

### 3. Take control of discovery (do this before shipping)

A default session inherits the machine it runs on. Measured system-prompt sizes, same cwd, same code:

| Resource loader configuration | Active extension tools | System prompt |
|---|---|---|
| `new DefaultResourceLoader({ cwd, agentDir: getAgentDir() })` | host's (`todo`, ...) | **41,524 chars** |
| `... noExtensions: true` | `todo` (skills still load) | 41,524 chars |
| `... noExtensions, noSkills, noPromptTemplates, noContextFiles, systemPrompt: "..."` | fixed by you | **88 chars** |

`noExtensions` alone does **not** shrink the prompt: skills (82 discovered from the host),
prompt templates, themes, and `AGENTS.md` context files are separate loaders. Shut off each one you
do not want, and pass your own `systemPrompt`:

```typescript
import { DefaultResourceLoader, getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";

const settingsManager = SettingsManager.inMemory({ compaction: { enabled: true } });
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  settingsManager,
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
  systemPrompt: "You are a weather assistant. Use the forecast tool, then answer in one line.",
});
await resourceLoader.reload(); // required: the loader is empty until this resolves
```

Skills discovery reaches beyond `~/.pi`: the loader also reads `~/.agents/skills` and
`<cwd>/.agents/skills`, which is where all 30 of the skills in the 30-skill probe came from. Use a
**fresh `agentDir`** as well as the `no*` flags when you want zero host resources — a fresh agent
dir alone still left the `~/.agents/skills` set loaded.

### 4. Choose the tools

Pass `tools`, and understand that the list changes meaning by shape (all measured):

| Option | Active tools | Note |
|---|---|---|
| `{}` | `read,bash,edit,write` + self-activating extension tools | Defaults come from the `defaultTools` setting |
| `tools: ["read"]` | `read` | Allowlist; custom tools are dropped unless named |
| `tools: ["read","forecast"]` + `customTools: [forecast]` | `read,forecast` | Custom tool must be named in the allowlist |
| `tools: ["+forecast"]` | defaults + `forecast` | Deltas apply to the defaults |
| `tools: ["read","+forecast"]` | **throws** | `Invalid tools option: tool names cannot be mixed with +name or -name entries` |
| `tools: []` | none | Same as `noTools: "all"` |
| `noTools: "all"` | none | Also drops custom tools |
| `noTools: "builtin"` | extension tools + custom tools only | Built-ins dropped, the rest kept |
| `noTools: true` (JS) | same as `"builtin"` | Truthy, not typed — see Troubleshooting |
| `excludeTools: ["bash","todo"]` | defaults minus those | Applied after `tools`; reaches extension and MCP tools |

Register your own tool with `defineTool`, which exists to keep parameter types from widening to
`unknown` when the tool travels in an array:

```typescript
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const forecast = defineTool({
  name: "forecast",
  label: "Forecast",
  description: "Return a canned forecast for a city",
  promptSnippet: "forecast: canned forecast for a city", // without this the tool is absent from <tools>
  parameters: Type.Object({ city: Type.String() }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `${params.city}: 21C, clear` }],
    details: { city: params.city }, // required by AgentToolResult, even for a throwaway value
  }),
});
```

`promptSnippet` is what lists the tool in the system prompt's `<tools>` block. Measured with
`tools: ["forecast"]`: no snippet gave `<tools>\n(none)\n...` and a 9,196-char prompt; with a snippet,
`- forecast: canned forecast for a city` and 9,238 chars. A snippet-less tool is still declared to the
model through the provider's tool list, so it remains callable — measured end to end: `add` without a
snippet was absent from `<tools>` and the run still produced `[CALL add]` and `"19 + 23 = **42**"`. The
snippet buys the model a one-line description next to the name, not permission to call.

### 5. Decide persistence

| `sessionManager` | `session.sessionFile` | Written when |
|---|---|---|
| omitted | `<agentDir>/sessions/<slugified-cwd>/<ISO-timestamp>_<uuid>.jsonl` | Lazily: path exists, file does **not** until the first entry |
| `SessionManager.inMemory()` | `undefined` | Never |
| `SessionManager.create(cwd, dir)` | `<dir>/<timestamp>_<uuid>.jsonl` | On the first entry; `mkdir` handled |
| `SessionManager.continueRecent(cwd, dir)` | the newest file's path | Appends; `messages` restored |
| `SessionManager.open(path)` | that path | Appends |
| `SessionManager.inMemory(cwd, opts, entries)` | `undefined` | Hydrates from entries you supply |

`SessionManager.list(cwd, dir)` and `SessionManager.findById(cwd, id, dir)` enumerate and resolve
sessions; `listed[0].firstMessage` is the first user message. The manager, not
`session.agent.state.messages`, is authoritative for context: restoring history means constructing
the session over a manager that holds those entries.

### 6. Queue work while a run is in flight

```typescript
const run = session.prompt("Count from 1 to 30, one number per line.");
await new Promise((r) => setTimeout(r, 300));
await session.prompt("Stop counting and say HALT.", { streamingBehavior: "steer" });
await session.followUp("Finally say BYE.");   // returns "queued" | "handled"
await run;
await session.waitForIdle();
```

Measured event order for that sequence: `agent_start → turn_start → queue_update → turn_end →
turn_start (steer delivered) → turn_end → turn_start (follow-up delivered) → turn_end → agent_end →
agent_settled`, final text `"BYE"`. Two rules follow:

- `prompt()` on a streaming session **rejects** unless you pass `streamingBehavior`. Measured message:
  `Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.`
- `prompt()` resolves **after** queued follow-ups finish, not when its own turn ends. Measured at
  3,759 ms: `agent_settled`, `prompt resolved`, and `waitForIdle()` all resolved in the same tick.

### 7. Replace the session instead of creating siblings

Reserve `AgentSessionRuntime` for a host that needs new-session, resume, fork, or JSONL import:

```typescript
import {
  createAgentSessionFromServices, createAgentSessionRuntime, createAgentSessionServices,
  getAgentDir, SessionManager, type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";

const factory: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return { ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })), services, diagnostics: services.diagnostics };
};

const runtime = await createAgentSessionRuntime(factory, {
  cwd: process.cwd(), agentDir: getAgentDir(), sessionManager: SessionManager.create(process.cwd(), "./sessions"),
});

await runtime.newSession();                       // runtime.session is a NEW AgentSession
const session = runtime.session;
await session.bindExtensions({});                 // re-emits session_start
const unsubscribe = session.subscribe(onEvent);   // resubscribe: the old listener is dead
```

Measured: after `newSession()`, a listener attached to the previous session fired **0** times while
the new one fired once. Old subscriptions, extension bindings, and any cached tool list must be
rebuilt for `runtime.session`. `switchSession(path)` and `importFromJsonl(path)` behave the same way.
Full contract, ordering, and failure modes: [createAgentSessionRuntime](../reference/pi-agent-session-runtime.md). What the bundle itself builds, validates, and reports:
[AgentSessionServices](../reference/pi-agent-session-services.md). Which paths those defaults walk, and what MCP needs:
[Default Discovery Paths](../reference/pi-sdk-default-discovery.md). For a terminal, browser, or RPC surface over the same session:
[UI Options](../reference/pi-sdk-ui-options.md).

### 8. Dispose

`session.dispose()` aborts active work, invalidates extension contexts, and drops listeners; call it
from `finally`. Measured edge cases on 1.5.0:

| Situation | Result |
|---|---|
| `dispose()` mid-run | The in-flight `prompt()` promise **resolved** (not rejected); the aborted assistant message carries `stopReason: "aborted"` |
| `prompt()` after `dispose()` | Accepted and completed, appending messages. `dispose()` is not a fence — do not keep the object |
| `dispose()` twice | Fine |

## Verification

Run the end-to-end file from step 3–5 together, then check these lines in its output:

| Check | Expected |
|---|---|
| `session.getActiveToolNames()` | Exactly the tools you asked for (`forecast` only, in the isolated probe) |
| `session.systemPrompt.length` | Small when you passed `systemPrompt` — 112 chars in the isolated probe, vs 41,524 by default |
| `session.sessionFile` | A path under your `sessionDir`; `existsSync` `false` at create, `true` after the first prompt |
| Final answer | Matches the tool's canned output (`"Lisbon: 21°C and clear."`) |
| `getSessionStats().tokens` | Non-zero and plausible (`{"input":717,"output":52,...}`) |

The probe output, pi 1.5.0 on 2026-11-06:

```text
tools: forecast | promptLen: 112
[call forecast] Lisbon: 21°C and clear.
answer: "Lisbon: 21°C and clear."
file: 2026-11-05T17-50-34-817Z_01a1acd5-7d40-7110-8024-9e7cf383e2d6.jsonl | stats: {"input":717,"output":52,"cacheRead":0,"cacheWrite":0,"total":769}
```

The same file ran unchanged under `bun run` (Bun 1.4.4), producing identical output.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_PACKAGE_PATH_NOT_EXPORTED` / `No "exports" main defined` from `require()` | The package is `"type": "module"` with an `import`-only `exports` map | Use ESM: `import` in a `.mjs`/`.mts` file or `"type": "module"`, or dynamic `await import()` |
| TS1309 "cannot use 'await' at the top level" | The file compiled as CommonJS | Rename to `.mts`, or set `"type": "module"` |
| `has no exported member 'Type'` from `@earendil-works/pi-ai` | 1.5.0 dropped the TypeBox re-export | `import { Type } from "typebox"` and install it (mandatory under pnpm) |
| `Property 'details' is missing ... required in type 'AgentToolResult'` | `execute()` returned only `{ content }` | Return `{ content, details }` — `details: {}` is fine |
| `Type ... is not assignable to type 'ToolDefinition<TSchema, unknown, any>'` for a hand-built object | Without `defineTool`, params widen to `unknown` inside `customTools` | Wrap the literal in `defineTool({...})` |
| The model says the custom tool does not exist | An allowlist `tools: [...]` omitted the custom tool's name | Add its name, or use `tools: ["+name"]` / `excludeTools` instead |
| System prompt is tens of kilobytes long | Default discovery loaded host skills, prompt templates, and `AGENTS.md` | `noSkills`/`noPromptTemplates`/`noContextFiles`/`noThemes` + explicit `systemPrompt` |
| Skills you never installed still show up | `~/.agents/skills` and `<cwd>/.agents/skills` are scanned in addition to `~/.pi` | `noSkills: true`, or a `skillsOverride` returning `{ skills: [], diagnostics: [] }` |
| `Agent is already processing...` | A second `prompt()` arrived during streaming | Pass `{ streamingBehavior: "steer" \| "followUp" }`, or call `steer()`/`followUp()` |
| `No API key found for <provider>` | No credential for the resolved model, or an empty `ModelRuntime` | `ModelRuntime.create({ authPath })` + `setRuntimeApiKey(provider, key)`, then pass both `modelRuntime` and `model` |
| `prompt()` resolves but the answer is empty and `getLastAssistantText()` is `undefined` | The provider returned an error inside the assistant message | Check `session.messages.at(-1).stopReason === "error"` and `.errorMessage` |
| `noTools: true` keeps tools enabled | It is typed `"all" \| "builtin"`; truthy is read as `"builtin"` | Pass `"all"` — measured: `noTools: true` left `todo` active, `"all"` left none |
| `new DefaultResourceLoader(...)` throws `this.systemPromptOverride is not a function` | The option is `systemPrompt: string`, not an override callback | Use `systemPrompt`, or override `getSystemPrompt` in a custom `ResourceLoader` |

## Related

- [createAgentSession — pi SDK Entry Point Reference](../reference/pi-createagentSession.md) — every option, its default,
  and the tool-selection matrix this guide walks through.
- [Hosting Many pi Sessions From One Program](../technology/hosting-many-pi-sessions.md) — what changes when
  step 1's one session becomes many: which parts stay per-session, which the process owns, and the
  one-file-one-writer rule.
- [Provide and Invoke Skills in pi — Discovery, Frontmatter, and /skill:name](./pi-skills.md) — what the
  `noSkills`/`skillsOverride` knobs in step 3 actually control, from discovery paths to the
  injected `<skill>` block.
- [Packaging pi Into Your App — SDK Dependency, Spawned CLI, or Single Binary](../technology/pi-packaging-into-your-app.md) —
  whether to embed in-process at all, and the process/memory cost of each shape.
- [Pi RPC Mode — Driving the Coding Agent as a JSONL Subprocess](../technology/pi-rpc-mode.md) — the out-of-process alternative
  when the host is not Node.
- [Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore](./durable-pi-state-on-ephemeral-vm.md) — what to do with the
  JSONL session files once this guide produces them.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`) plus ~25 probe scripts run against a fresh npm install under
  Node 26.13.0 and Bun 1.4.4 (option matrix, prompt sizes, event order, dispose semantics, persistence,
  runtime replacement). Corrects the older reference note that `noTools: true` is "silently ignored": at
  1.5.0 a truthy `noTools` behaves like `"builtin"`.
