---
title: pi-agent-core vs pi-coding-agent — The Loop and the Product
category: technology
tags: [pi, earendil, pi-agent-core, pi-coding-agent, agent-loop, harness, sdk, comparison, packages]
status: complete
created: 2026-11-02
updated: 2026-11-02
sources:
  - https://www.npmjs.com/package/@earendil-works/pi-agent-core
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent
  - https://github.com/earendil-works/pi/tree/main/packages/agent
  - https://github.com/earendil-works/pi/tree/main/packages/coding-agent
  - https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md
confidence: high
---

# pi-agent-core vs pi-coding-agent — The Loop and the Product

## Summary

- **They are two different layers of one stack, not two products.** `@earendil-works/pi-agent-core` is
  the agent loop as a library; `@earendil-works/pi-coding-agent` is the CLI product that depends on
  it. The coding agent's manifest pins `"@earendil-works/pi-agent-core": "1.5.0"` next to `pi-ai`,
  `pi-codemode`, `pi-mcp`, and `pi-tui` (`pi-coding-agent/package.json:40-48`). Nothing depends the
  other way.
- **`pi-agent-core` is ~2,200 lines of declaration and runtime in 6 JS files, 308 KB, and imports
  zero `node:` builtins.** Its only runtime import is `pi-ai`
  (`pi-agent-core/dist/agent.js:1-6`, `dist/index.js`). The coding agent is 22 MB across 339 JS
  files, 150 of which import a `node:` builtin.
- **You cannot do "sessions" in `pi-agent-core`.** No session store, no branching, no compaction, no
  tools, no skills, no prompts, no extensions, no UI. It gives you `Agent`, `agentLoop`,
  `streamProxy`, and the message/tool/event types — and your host supplies everything else.
- **The real decision is which layer your host already is.** A CLI/TUI/editor plugin wants a
  `AgentSession`; an edge worker, browser bundle, or a server with its own database wants the loop.
- **The coding agent is not "agent-core plus a frontend".** Its `AgentSession` adds persistence,
  compaction, retries, cache warming, extension loading, tool loadouts with namespacing, MCP,
  codemode, skills, prompt templates, trust, and three I/O modes (`.pi`).
- **`pi-agent-core` is not private to the product.** It is published as a general library — "Stateful
  agent with tool execution and event streaming" ([npm](https://www.npmjs.com/package/@earendil-works/pi-agent-core))
  — and third parties embed or port it ([Note Pi](https://community.obsidian.md/plugins/note-pi),
  [bismarck-engine](https://pkg.go.dev/github.com/aleksandrgradoboev-svg/bismarck-engine)).

Version under study: both packages at **1.5.0**, read from the installed tree at
`/home/kevin/.vite-plus/packages/@earendil-works/pi-coding-agent/dbb2308a-7cc8-4f11-adf7-c0a4af1b4ba7/lib/node_modules/@earendil-works/`,
2026-11-02. The 1.4.0 tree is mapped in [Pi Package Map](../reference/pi-package-map.md); the split
did not change between the versions.

## Context

Asked 2026-11-02: "what is pi coding agent difference with pi agent core". The answer is a
responsibility split, so it is written as one: what each package owns, what each *cannot* do, and
the hosting consequences of the split. [Pi Package Map](../reference/pi-package-map.md) already
settles that "pi core" is not a package and that the two layers are `pi-ai` + `pi-agent-core`
below a `pi-coding-agent` product; this file is the package-level compare the map points at.

## 1. Where each one sits

```text
pi-ai ................. providers, auth, model catalog, streaming, cost
   └── pi-agent-core ... Agent, agentLoop, stream proxy, message/tool/event types
          ├── your host (a Worker, a browser app, your server, Flue)
          └── pi-coding-agent ... AgentSession, tools, sessions, extensions, modes, TUI
                 └── pi codemode, pi mcp, pi tui
```

`pi-coding-agent` imports `Agent` and `AgentSession` from agent-core and *also* imports `pi-ai`
directly, so model access never routes through the loop package
(`dist/core/agent-session.d.ts:15-17`).

## 2. Wide comparison

| Dimension | `@earendil-works/pi-agent-core` | `@earendil-works/pi-coding-agent` |
| --- | --- | --- |
| One-line scope | the turn loop as a library | the CLI, SDK, and modes around it |
| Published for | embedding by any host | running Pi itself |
| Package size | 308 KB, 6 JS files | 22 MB, 339 JS files |
| `node:` builtins at import | none | 150 files, 13 distinct builtins |
| Runtime imports | `pi-ai` only | `pi-ai`, `pi-agent-core`, `pi-codemode`, `pi-mcp`, `pi-tui`, `chalk`, `undici`, … |
| Entry point | `new Agent({...})`, `agentLoop()` | `pi` binary, `createAgentSession()`, RPC, JSON mode |
| Loop ownership | is the loop | constructs it and wraps it |
| Providers and auth | none — takes a `StreamFn` | `ModelRuntime`, `/login`, per-provider config |
| Tools | none — you pass `AgentTool`s | read, write, edit, bash, powershell, grep, find, ls |
| Context window discipline | `transformContext` hook only | compaction engine, thresholds, cache warming |
| Persistence | none | JSONL session tree, branching, fork, import |
| Extensions and hooks | 5 config fields | full extension API, 40+ lifecycle events |
| Skills, AGENTS.md, templates | none | resource loader, `/reload`, prompt templates |
| MCP, codemode, tool search | none | all three, as extensions |
| UI | none (events only) | TUI, print, JSON, RPC, SDK |
| Concurrency model | single agent, steering/follow-up queues | sessions replaceable via `AgentSessionRuntime` |
| Failure handling | `abort()` | retries, retry budgets, crash logs, bug reports |
| Config surface | none on disk — passed in code | `~/.pi/agent`, `.pi/`, settings, env, CLI flags |
| Hosts that can run it | Workers, browsers, servers, CLIs | Node/Bun only |
| Version pin | yours | pins agent-core exactly, in lockstep |

## 3. What `pi-agent-core` actually exposes

Five exports (`dist/index.js`):

| Export | What it is |
| --- | --- |
| `Agent` | stateful agent: `prompt()`, `continue()`, `steer()`, `followUp()`, `abort()`, `subscribe()` |
| `agentLoop`, `agentLoopContinue`, `runAgentLoop` | the loop without the object (`agent-loop.d.ts:47,80`) |
| `streamProxy` | browser→backend stream proxying (`proxy.d.ts:106`) |
| `setDefaultStreamFn` | install a transport globally |
| `types` | `AgentMessage`, `AgentTool`, `AgentEvent`, `AgentState`, `ToolExecutionMode` |

Configuration is code, and it is small: `convertToLlm`, `transformContext`, `toolExecution`,
`beforeToolCall`, `afterToolCall`, `prepareRequest`, `finishTurn`, `steeringMode`,
`followUpMode`, `thinkingBudgets`, `getApiKey`, `sessionId`, `identity` (`agent.d.ts`). That is the
whole "harness". The README's examples are the product's scenarios minus the product: stream text
deltas to stdout, gate `bash` in `beforeToolCall`, prune in `transformContext`.

The loop itself is deliberately careful, and the care is where its value sits — preflight after
argument validation, a barrier on assistant `message_end` before tool preflight, batch
early-termination when every tool result sets `terminate: true`, tool-result ordering preserved
against parallel completion order, awaited subscriber settlement before `agent_end` resolves
(`pi-agent-core/README.md`).

## 4. What `pi-coding-agent` adds on top

Below the TUI, `dist/core/` is a product runtime:

| Area | Files |
| --- | --- |
| Session lifecycle | `agent-session.ts`, `agent-session-runtime.ts`, `session-manager.ts`, `session-format` |
| Compaction | `compaction/` — cut points, summaries, branch summarization, auto thresholds |
| Tools | `tools/` — `bash`, `edit`, `read`, `write`, `grep`, `find`, `ls`, `powershell`, renderers |
| Extensions | `extensions/` — runner, wrapper, tool rendering, commands, shortcuts, providers |
| Resources | `resource-loader.ts`, `skills.ts`, `prompt-templates.ts`, `package-manager.ts` |
| Models and auth | `model-runtime.ts`, `model-registry.ts`, `auth-storage.ts`, `models-store.ts` |
| Integrations | `mcp-servers.ts`, `extensions/mcp`, `extensions/codemode`, `extensions/tool-search` |
| Durability of the process | `retry`, `crash-log.ts`, `bug-report.ts`, `cache-warmer.ts` |
| I/O modes | `modes/interactive`, `modes/print-mode.ts`, `modes/json`, `modes/rpc` |

The extension API is the largest single gap. An extension holds `registerTool`,
`registerCommand`, `registerShortcut`, `registerProvider`, `registerMcpServer`,
`appendEntry`, `executeTool`, and `ctx.ui.*` dialogs and TUI components, plus `on()` over
session, compaction, agent, turn, message, tool, model, and input events
(`dist/core/extensions/types.d.ts:1210-1252`). None of it exists in agent-core; the closest
equivalents are the three tool/request hooks.

## 5. The API shape, side by side

```typescript
// pi-agent-core — you bring the model, the tools, and the storage
const agent = new Agent({
  initialState: { systemPrompt: "You are helpful.", model },
  streamFn: models.streamSimple.bind(models),
  convertToLlm: (m) => m.filter(isLlmMessage),
});
agent.subscribe((e) => e.type === "message_update" && write(e.assistantMessageEvent.delta));
await agent.prompt("Hello!");
```

```typescript
// pi-coding-agent — the same turn, with everything resolved from disk
const { session } = await createAgentSession({ cwd: process.cwd() });
try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

The second form reads settings, `auth.json`, extensions, skills, `AGENTS.md`, and the session file
for you. `CreateAgentSessionOptions` is correspondingly about wiring *replacement* services —
`modelRuntime`, `resourceLoader`, `sessionManager`, `settingsManager`, `tools`, `noTools`,
`customTools` — not about capabilities that are absent (`dist/core/sdk.d.ts:9-72`).

## 6. Verification — the builtin-free property is real

```text
$ grep -rho 'from "node:[a-z/]*"' dist --include=*.js | sort -u      # pi-coding-agent
from "node:buffer" from "node:crypto" from "node:events" from "node:fs" ... 13 total, 150 files

$ grep -rn 'from "node:' dist/*.js                                 # pi-agent-core
(no matches)
```

`pi-agent-core`'s entire import list is `@earendil-works/pi-ai` and its own four modules. That is
the property the hosting story turns on: the Node assumptions — `node:fs` tools, the `rg` binary,
`process.cwd()`, the eager CLI barrel — all live one layer up, with the coding agent
([Workers/Daytona](../technology/pi-coding-agent-cloudflare-workers-daytona-fs.md)).

## 7. What the split costs you

| If you choose… | You write | You inherit |
| --- | --- | --- |
| `pi-agent-core` | persistence, compaction, tools, prompts, skills, extensions, UI, retries | the loop's correctness and its builtin-free hosting |
| `pi-coding-agent` | nothing beyond your integration | Node, a 22 MB install tree, the product's shape and config semantics |

Choosing the loop also means re-deriving decisions the product already made and tested: where the
cut point of a compaction goes, how a tool result order survives parallel execution, what happens
when a session file is half-written, how a tool name collides across namespaces.

Choosing the product means accepting Node: no Worker, no browser, no CJS host without an eager
barrel to work around.

## 8. When each is right

| Situation | Choice |
| --- | --- |
| CLI or TUI, or an editor/IDE plugin | `pi-coding-agent` SDK |
| Chat product with sessions, compaction, tools, MCP, per-workspace files | `pi-coding-agent` SDK or RPC ([Hermes-like app](./hermes-like-app-on-pi-backend.md)) |
| Keep conversations in Postgres instead of JSONL | still `pi-coding-agent`, via `SessionManager.inMemory` ([the seam](./pi-session-persistence-external-store.md)) |
| Cloudflare Worker or Durable Object | `pi-agent-core` — the product cannot run there |
| Browser app streaming through your backend | `pi-agent-core` with `streamProxy` |
| One agent inside a system you already own the storage and sandbox of | `pi-agent-core` |
| Framework with project shape and deployment handled | neither directly — Flue wraps agent-core ([Flue vs pi-agent-core](./flue-vs-pi-agent-core.md)) |
| Crash-surviving turns, several clients on one conversation | neither — `pi-durable` is the other stack ([Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md)) |

## 9. The seams between them, and one direction that does not exist

- **agent-core → coding agent.** No seam. The product constructs the loop; you cannot plug a
  product runtime into the library.
- **coding agent → agent-core.** Leaky in the other direction: `session.agent` is public, so an SDK
  host can reach the raw `Agent` and its hooks past `AgentSession`'s compaction and persistence.
- **Shared vocabulary.** `ThinkingLevel`, `AgentMessage`, and `AgentTool` are agent-core types
  re-exported through the product (`dist/core/extensions/types.d.ts:10`), so an integration touching
  both compiles against agent-core whether or not it wanted that package.
- **Lockstep versions.** `pi-coding-agent` depends on exactly `pi-agent-core` `1.5.0`, not `^`. A
  forced upgrade of one is untested against the other.

## Gotchas

- **"Install pi core"** names nothing; the installable names are
  `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`.
- **`pi-agent-core` has no session store.** `sessionId` is a provider cache hint
  (`agent.d.ts:24`), not persistence. The README's "Session and Thinking Budgets" heading is
  misleading on first read.
- **`pi-agent-core` ships no tools and no providers.** `new Agent()` needs a `streamFn`; without
  one it throws rather than falling back.
- **The coding agent's `core/` directory is not `pi-agent-core`.** `src/core/` is where
  `createAgentSession` and `SessionManager` live.
- **Imports of the coding agent drag Node in.** Bundling for a Worker from `pi-coding-agent`
  means stubbing `node:fs`, `node:child_process`, and `rg`.
- **`agentLoop()` is observational.** Raw loop streams do not await your async handlers before the
  next producer phase; `Agent` does. Use the class when handler ordering matters.

## Related

- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — the dependency graph
  and the three senses of "core".
- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — the hosting consequence of the builtin split.
- [Hermes-like App on a pi Backend](./hermes-like-app-on-pi-backend.md) — the product decision this
  compare feeds.
- [pi-coding-agent Sessions in Your Own Store](./pi-session-persistence-external-store.md) — why
  "use Postgres" does not force you down a layer.
- [Flue vs pi-agent-core](./flue-vs-pi-agent-core.md) — a framework built on the loop.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — the second, unrelated
  stack.
- [CONTRIBUTING.md](https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md)
  — the prose that uses "core" for the two lower packages, and the scope rule behind it.

## Changelog

- 2026-11-02 — created at 1.5.0, both packages read from the installed tree.
