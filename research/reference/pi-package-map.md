---
title: Pi Package Map — What "Pi Core" Refers To
category: reference
tags: [pi, earendil, packages, pi-agent-core, pi-ai, pi-coding-agent, pi-durable, architecture]
status: complete
created: 2026-10-29
updated: 2026-10-31
sources:
  - https://github.com/earendil-works/pi/tree/babe30a7e6c1
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/package.json
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/src/index.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/src/agent.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/src/agent-loop.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/src/types.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/CHANGELOG.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/ai/README.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/README.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/package.json
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/sdk.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/CONTRIBUTING.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/README.md
confidence: high
  - https://www.npmjs.com/package/@earendil-works/pi-agent-core
  - https://community.obsidian.md/plugins/note-pi
  - https://pkg.go.dev/github.com/aleksandrgradoboev-svg/bismarck-engine
  - https://www.jsdelivr.com/package/npm/@earendil-works/pi-codemode
---

# Pi Package Map — What "Pi Core" Refers To

## Summary

- **"Pi core" is not a package.** The name does not exist as an export, a package, or a documented
  product. In the repo it appears only as prose — "pi's core is minimal", "belongs in the core" —
  in [CONTRIBUTING.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/CONTRIBUTING.md)
  and issue-triage copy.
- The thing people mean by "the core" is **two packages**: `@earendil-works/pi-ai` (providers,
  auth, streaming, cost) and `@earendil-works/pi-agent-core` (the agent loop). The third layer,
  `@earendil-works/pi-coding-agent`, is the **product**: CLI, TUI, tools, sessions, extensions.
- **`pi-agent-core` imports no `node:` builtins at all** — its only runtime import is `pi-ai`.
  That is why an edge host starts from it ([edge hosting](./../technology/pi-coding-agent-cloudflare-workers-daytona-fs.md))
  and why the coding agent does not.
- **There are two independent agent stacks.** `pi-ai → pi-agent-core → pi-coding-agent` and
  `chord → pi-durable → pi-env`. `pi-durable` never imports `pi-agent-core`; its sessions,
  tasks, and documents are a separate runtime.
- A third sense of "core" is a **directory**: `packages/coding-agent/src/core/` holds the SDK's
  building blocks (`createAgentSession`, `SessionManager`, the built-in tools). "Import from
  core" means import that directory's exports, not `pi-agent-core`.

Version under study: all packages at **1.4.0**, repo
[`babe30a7e6c1`](https://github.com/earendil-works/pi/tree/babe30a7e6c1), read 2026-10-29.

## Details

### 1. The dependency graph

```text
pi monorepo — 11 packages
├── pi-telemetry ......... leaf: telemetry contracts + conformance tests
│
├── stack 1 (the coding agent)
│   ├── pi-ai ............ providers, auth, model streaming, cost   (deps: pi-telemetry)
│   ├── pi-agent-core .... Agent, agentLoop, stream proxy, types    (deps: pi-ai, typebox)
│   └── pi-coding-agent .. CLI + TUI + tools + sessions + extensions
│                          (deps: pi-agent-core, pi-ai, pi-codemode, pi-mcp, pi-tui)
│
├── stack 2 (the durable runtime)
│   ├── chord ............ host runtime for hot-reloadable plugins  (deps: pi-telemetry)
│   ├── pi-durable ....... durable conversation/task/document runtime
│   │                      (deps: chord, pi-ai, pi-codemode, pi-telemetry)
│   └── pi-env ........... remote exec environments over SSH        (deps: chord, pi-durable)
│
└── leaves consumed by the coding agent
    ├── pi-codemode ...... sandboxed JS whose only capability is tool calls (quickjs-wasi)
    ├── pi-mcp ........... standalone MCP client (cross-spawn)
    ├── pi-tui ........... differential-rendering TUI (marked)
    └── pi-evals ......... private behavioural evals for the coding agent
```

Only 7 of the 11 appear in the root README's package table; `pi-codemode`, `pi-mcp`,
`pi-env`, and `pi-evals` are absent from it
([README.md:72-84](https://github.com/earendil-works/pi/blob/babe30a7e6c1/README.md)).

### 2. Package inventory

| Package | What it owns | Internal deps |
| --- | --- | --- |
| `pi-telemetry` | vendor-neutral telemetry contracts, reference adapter, typed schemas | none |
| `pi-ai` | multi-provider LLM API: catalogs, auth resolution, streaming, cost tracking | `pi-telemetry` |
| `pi-agent-core` | "general-purpose agent with transport abstraction, state management, and attachment support" | `pi-ai` |
| `pi-tui` | terminal UI with differential rendering | none (external only) |
| `pi-codemode` | sandboxed JavaScript where the only capability is calling injected tools | none (quickjs-wasi) |
| `pi-mcp` | standalone MCP client | none (cross-spawn) |
| `pi-coding-agent` | the CLI product: tools, sessions, resources, extensions, TUI | `pi-agent-core`, `pi-ai`, `pi-codemode`, `pi-mcp`, `pi-tui` |
| `chord` | typed host runtime for hot-reloadable plugins, replicated state, RPC over JSON links | `pi-telemetry` |
| `pi-durable` | durable conversation, task, and document runtime (experimental) | `chord`, `pi-ai`, `pi-codemode`, `pi-telemetry` |
| `pi-env` | remote execution environments over SSH (Rust daemon + `RemoteExecutionEnv`) | `chord`, `pi-durable` |
| `pi-evals` | private behavioural evals for the coding agent | devDeps only |

### 3. What `pi-agent-core` actually is

The smallest thing that runs an agent turn. Export map is `"."` only — no `./node`, no harness
subpath ([packages/agent/package.json:8-14](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/agent/package.json)):

| Export | What it is |
| --- | --- |
| `Agent` | the stateful agent object (`agent.ts:194`) |
| `agentLoop` and helpers | the low-level turn loop (`agent-loop.ts:47,80,801`) |
| `streamProxy` | wraps a `StreamFn` for retries/aborts (`proxy.ts:106`) |
| stream-fn setter | plug your own transport (`stream-fn.ts:11`) |
| types | messages, tools, events (`types.ts:33`) |

Its source imports **no `node:` builtins**; the only runtime import is `pi-ai`
(`agent.ts:14`, `agent-loop.ts:20`, `proxy.ts:17`, `types.ts:16`). It supplies no providers, no
models, no auth, no HTTP — it takes a `StreamFn` and pi-ai's message/tool types
(`types.ts:25-45`).

Scope shrank over time: sessions, compaction, skills, prompt templates, telemetry schemas, and the
durable runtime were all removed from this package; durable sessions moved to `pi-durable`
(`packages/agent/CHANGELOG.md:41`).

### 4. The three layers, by responsibility

| Responsibility | `pi-ai` | `pi-agent-core` | `pi-coding-agent` |
| --- | --- | --- | --- |
| Provider catalog, auth, streaming, cost | yes | no | wires it in |
| The turn loop, tool dispatch, events | no | yes | constructs it |
| Built-in tools (read, bash, edit, write, grep, find, ls, powershell) | no | no | yes |
| Session tree, branching, in-memory vs JSONL | no | no | yes |
| Skills, prompt templates, context files | no | no | yes |
| Extensions, custom tools, hooks | no | no | yes |
| TUI / interactive mode | no | no | yes |
| `node:` builtins at import | none needed | none | many |

`pi-coding-agent` builds the `Agent` and wraps it in `AgentSession`
(`src/core/sdk.ts:2,191`, `src/core/agent-session.ts:266,393`); the built-in tool set is
`src/core/tools/index.ts:96`, sessions are `src/core/session-manager.ts:987`, resources come from
`src/core/resource-loader.ts:180,342`, extensions from `src/core/extensions/runner.ts:364`, and the
interactive mode sits on `pi-tui` (`src/modes/interactive/interactive-mode.ts:31-54`).

### 5. Why the distinction matters for hosting

`pi-agent-core` being builtin-free is the whole reason a Worker/DO can host the *loop*: the Node
assumptions — `node:fs` tools, `rg` binaries, `process.cwd()`, the eager CLI barrel — all live one
layer up, in `pi-coding-agent`. See
[Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./../technology/pi-coding-agent-cloudflare-workers-daytona-fs.md)
for what that costs and which two designs follow.

### 6. Is `pi-agent-core` "only the engine of the coding agent"?

No — the claim is wrong in both directions. It is *a* runtime layer the coding agent builds on,
and it is also a standalone library that other projects embed or port.

| Reading of the claim | Verdict | Why |
| --- | --- | --- |
| It is the coding agent's engine | half true | `pi-coding-agent` constructs the `Agent` and wraps it in `AgentSession` (`sdk.ts:2,191`, `agent-session.ts:266,393`), but it depends on `pi-ai` directly too, so model access never routes through agent-core |
| It exists only for the coding agent | false | published as a general library: "Stateful agent with tool execution and event streaming. Built on `@earendil-works/pi-ai`" ([npm](https://www.npmjs.com/package/@earendil-works/pi-agent-core)); third parties embed it — the Obsidian plugin *Note Pi* bundles `pi-agent-core` + `pi-ai` into `main.js` ([Note Pi](https://community.obsidian.md/plugins/note-pi)), and the Go project *bismarck-engine* is "the Go port of pi's agent runtime (`@earendil-works/pi-agent-core`)" ([pkg.go.dev](https://pkg.go.dev/github.com/aleksandrgradoboev-svg/bismarck-engine)) |
| The coding agent needs it for sessions and compaction | false | that layer is above it — sessions, compaction, resources, and extensions live in `packages/coding-agent/src/core/` |
| Everything Earendil ships runs on agent-core | false | `pi-durable` is a second stack on `chord` and never imports it; `pi-ai` does not depend on it either |
| It is a thin wrapper over `pi-ai` | false | it adds the loop, tool dispatch, `AgentMessage` vs LLM-message conversion (`convertToLlm`), `transformContext`, steering/follow-up queues, hooks, and the event stream |

Inside the monorepo it is also a shared building block, not only the CLI's dependency: the
`pi-codemode` documentation tells integrators to run nested tool calls through
`runToolCall()` from `@earendil-works/pi-agent-core` so hooks apply
consistently ([pi-codemode](https://www.jsdelivr.com/package/npm/@earendil-works/pi-codemode)).

The accurate one-liner: **`pi-ai` is the model layer, `pi-agent-core` is
the agent runtime, and `pi-coding-agent` is the product built on both.** "Engine" is
fine as shorthand as long as it means the loop only — providers, sessions, compaction, tools,
skills, extensions, and the TUI all live elsewhere.

## Gotchas

- **Do not say "install pi core".** The installable names are `@earendil-works/pi-ai`,
  `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent` (plus `pi-durable`).
- **`pi-durable` is not `pi-agent-core` + durability.** It is a second stack on `chord`; it never
  imports `pi-agent-core`, and its harness is its own implementation.
- **Version pins must move together.** The packages are released in lockstep — the installed
  `pi-coding-agent` 1.4.0 depends on exactly `pi-agent-core` 1.4.0 and `pi-ai` 1.4.0.
- **"Core" in the coding agent means the directory.** `packages/coding-agent/src/core/` is where
  `createAgentSession`, `SessionManager`, and the tools live; it is not `pi-agent-core`.
- **"Engine" is shorthand, not scope.** `pi-agent-core` is the loop; providers are `pi-ai`, and sessions/compaction/tools/extensions/TUI are `pi-coding-agent`.
- **The root README under-reports the monorepo** — four packages are undocumented there.

## Related

- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./../technology/pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — the hosting comparison that turns on this split.
- [pi-agent-core vs pi-coding-agent — The Loop and the Product](./../technology/pi-agent-core-vs-pi-coding-agent.md)
  — the package-level compare the three-layer split here implies: what the loop owns, what only the
  product owns, and which host fits each.
- [Pi Durable vs the Pi Coding Agent](./../technology/pi-durable-vs-pi-coding-agent.md) — the two
  agent stacks compared as products.
- [Pi Durable on Cloudflare Workers & Durable Objects](./../technology/pi-durable-cloudflare-workers-durable-objects.md)
  — the durable stack's harness, storage, and limits.

- [Chord — Earendil's Distributed Object Runtime](./../technology/chord-distributed-object-runtime.md) — what the `chord` row in the graph actually is, and why only `pi-durable` (and one `Context` import in `pi-env`) consumes it.
- [Flue vs pi-agent-core — Framework or Loop?](./../technology/flue-vs-pi-agent-core.md) — a framework built on agent-core, with the version-pin and lock-in costs spelled out.
- [Hermes-like App on a pi Backend — pi-coding-agent or pi-agent-core?](./../technology/hermes-like-app-on-pi-backend.md) — applies this split to a product decision: which layer a Hermes-shaped app should build on, and when agent-core is the right smaller dependency.

## Changelog

- 2026-10-31 — linked [Hermes-like App on a pi Backend](./../technology/hermes-like-app-on-pi-backend.md) from Related: the map split is the decision that file applies.
- 2026-11-02 — linked [pi-agent-core vs pi-coding-agent](./../technology/pi-agent-core-vs-pi-coding-agent.md) (re-read at 1.5.0) from Related.
- 2026-10-29 — added §6: is `pi-agent-core` only the coding agent engine? Verdict table plus the external embedders (Note Pi for Obsidian, the Go `bismarck-engine` port, `pi-codemode` use of `runToolCall()`).

- 2026-10-29 — created, answering "what is pi core". Evidence: scout read of
  `earendil-works/pi` @ `babe30a7e6c1` (path:line anchors throughout) plus the installed
  `@earendil-works/pi-coding-agent` 1.4.0 dependency manifest.
