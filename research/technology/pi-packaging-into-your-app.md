---
title: Packaging pi Into Your App — SDK Dependency, Spawned CLI, or Single Binary
category: technology
tags: [pi, pi-coding-agent, packaging, distribution, sdk, rpc, bun-compile, bundling, licensing, embedding]
status: complete
created: 2026-11-03
updated: 2026-11-03
sources:
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/how-pi-works.md
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.5.0
confidence: high
---

## Summary

**Yes, and MIT lets you redistribute it.** `@earendil-works/pi-coding-agent` at 1.5.0 is
**MIT**, needs **Node >= 22.19.0**, and installs as a normal npm dependency. You do not have to
fork or vendor the source: `npm i @earendil-works/pi-coding-agent` gives your app both an
importable module (`createAgentSession`) and an executable at `node_modules/.bin/pi`.

The real decision is not "can I", it is **which boundary your app owns** — and the answer is
mostly decided by whether your host process is Node/Bun:

| If your app is… | Ship it as | Why |
|---|---|---|
| Node / Bun (server, Electron main, CLI) | SDK import, in-process | No IPC, no child supervision, full API |
| Node, but you want the agent isolated or upgraded separately | Spawn `node_modules/.bin/pi --mode rpc` | Process boundary + the 33-command RPC surface |
| Not Node (Go, Rust, Python, Tauri, .NET) | Spawn the CLI in RPC mode | Language-independent JSONL over stdio |
| Single-file distribution with no Node on the box | `bun build --compile` **your own SDK entry** | ~146 MB binary that boots the full agent, extensions included |

Two traps are worth knowing before you choose. In-process sessions load the host's `~/.pi`
config unless you pass your own loader. And single-file bundling behaves **differently by what
you compile**: a binary compiled from the package's SDK entry boots the full agent with its
TypeScript extensions intact, while compiling pi's prebuilt RPC entry loses the extension
loader. Both are measured below.

## What installing actually puts on disk

Measured on pi 1.5.0, npm layout, fresh install
([package.json](https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.5.0)):

| Path | Size | Contents |
|---|---|---|
| `<pkg>/` total | **158 MB** | Package plus its nested `node_modules` |
| `dist/` | 22 MB | `dist/index.js` (SDK entry), `dist/bundle/` (CLI), `.d.ts`, maps |
| `dist/bundle/` | **9.3 MB** | Pre-bundled CLI: `cli.js` shim + `cli-runtime.js` + `chunks/` |
| `node_modules/` | 132 MB | Runtime deps, dev-ish tools, TUI native prebuilds |

The 132 MB is not all needed at runtime. The CLI bundle's chunks externalize **only Node
builtins** for static imports — `node:fs`, `node:path`, `node:child_process`, `node:http`,
`node:tty`, … — so the JavaScript is already self-contained. What it still resolves at *runtime*
is a short dynamic list: `jiti` (1.8 MB, the TypeScript extension loader),
`@silvia-odwyer/photon-node` (2.2 MB, WASM image processing), `quickjs-wasi` (1.6 MB, the
codemode sandbox), plus optional probes (`kerberos`, `@aws-sdk/signature-v4a`).

`@earendil-works/pi-tui` ships **native prebuilds** as `.node` files: darwin-arm64, darwin-x64,
linux-x64 and linux-arm64 (X11), win32-x64, win32-arm64. They are for the terminal UI only — the
SDK import path never touched them in my probe.

## Licences (all six packages, verified in the installed tree)

| Package | Version | Licence | Engines |
|---|---|---|---|
| `pi-coding-agent` | 1.5.0 | MIT | node >= 22.19.0 |
| `pi-agent-core` | 1.5.0 | MIT | node >= 22.19.0 |
| `pi-ai` | 1.5.0 | MIT | node >= 22.19.0 |
| `pi-tui` | 1.5.0 | MIT | node >= 22.19.0 |
| `pi-mcp` | 1.5.0 | MIT | node >= 22.19.0 |
| `pi-codemode` | 1.5.0 | MIT | node >= 22.19.0 |

MIT means you may bundle it into a closed-source product and redistribute, keeping the copyright
notice. Two packaging consequences follow from MIT-plus-fork-friendliness: the docs ship a
**"Fork and rebrand Pi"** recipe — `package.json` gains
`{"piConfig": {"name": "my-agent", "configDir": ".my-agent"}}` and the top-level `bin` field
sets the executable name — which changes the banner, config paths, and derived env var names
([cli-integration.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md)).
Check the installed `package.json` rather than older blog posts: this repo has a separate FSL
study, and FSL is not what 1.5.0 ships.

## Shape 1 — SDK, in-process (recommended for Node/Bun hosts)

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory() });
try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

`session.subscribe()` streams the same events as JSON/RPC mode; `agent_settled` is still the
"will not continue on its own" signal. Everything is injectable — `modelRuntime`, `model`,
`settingsManager`, `sessionManager`, `resourceLoader`, `tools`/`customTools` — which is what
makes it shippable to users who have no `~/.pi` on disk
([sdk.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)).

**Verified:** importing `SessionManager` from a bare `node_modules` symlink and constructing
`SessionManager.inMemory()` works with no config; `createAgentSession({sessionManager, noTools: "all"})`
created a live session, resolved a model, and disposed cleanly.

Isolation knobs that matter when the host is a user's machine:

| Risk | Knob |
|---|---|
| Picks up the user's `~/.pi` extensions | `DefaultResourceLoader({ noExtensions: true })` |
| Picks up project `.pi/` settings | custom `settingsManager` |
| Writes session files | `SessionManager.inMemory()` |
| Uses the user's stored API keys | explicit `modelRuntime`/`model` and your own key |
| Loads built-in codemode/MCP | not loaded by SDK sessions by default — add `createCodemodeExtension()`, `createToolSearchExtension()`, `createMcpExtension()` yourselves |

That last row is real behaviour, not theory: a zero-option session in this environment loaded
**7 extensions** from `~/.pi/agent/extensions` and enabled their tools (`todo`, `repo_scout`, …),
because SDK sessions use the default resource loader. `noTools` does not change what loads, only what
is active, and it is typed `"all" | "builtin"` — not a boolean. See the
[createAgentSession reference](../reference/pi-createagentSession.md).

## Shape 2 — Spawn the installed CLI (Node hosts that want isolation)

`npm i` already leaves a working executable at `node_modules/.bin/pi`, and
`RpcClient` from the same package starts it, correlates ids, and exposes typed methods
(`promptAndWait()`, `steer()`, `compact()`, `getEntries()`, …). Ship the dependency, not the
source. This is the only shape with **zero** bundling risk.

Measured: `node dist/bundle/rpc-entry.js --no-session` from the installed package answers
`get_state` immediately. The bundle also exposes a dedicated `./rpc-entry` export that presets
`--mode rpc`, sets `PI_CODING_AGENT=true` and `AI_AGENT=pi`, and silences Node warning output —
which is what you want inside an app rather than `cli.js`.

The CLI runs under Bun as well as Node: `bun dist/bundle/cli.js --version` printed `1.5.0`.

## Shape 3 — Single self-contained binary (`bun build --compile`)

Measured on bun 1.4.4:

| Target | Command | Result |
|---|---|---|
| SDK **session** program → binary | `bun build --compile ./boot.mjs` | **146 MB**, boots a session with all **7 extensions** loaded, zero `node_modules` on disk |
| SDK program → plain Node ESM | `bun build ./index.mjs --target=node` | **7.2 MiB** single `.mjs` (2222 modules, tree-shaken to that entry), runs with no `node_modules` |
| pi's prebuilt RPC entry → binary | `bun build --compile dist/bundle/rpc-entry.js` | **144 MB**, starts, RPC works **only** with `--no-extensions` |

So "package pi into my app" as one file is real, no Node install required — and the good
recipe is **your own entry that calls `createAgentSession`**, not pi's prebuilt RPC bundle.
The 7 MiB figure is the other extreme: what the SDK adds to a Node app when the bundler can
tree-shake to what you call. Treat it as a floor, not a promise.

### The `jiti` wall — specific to pi's prebuilt bundle

The compiled binary's RPC loop answered `get_state` with `--no-extensions` and went silent
without it, emitting:

```
Error: Failed to load extension "…/extensions/todos/index.ts": Failed to load extension:
Cannot find module 'jiti'
Require stack: - /$bunfs/root/pi-rpc-bin
```

Three fixes I tried, in order of what a packager should actually do:

| Attempt | Result |
|---|---|
| Statically `import "jiti"` before the RPC entry, then compile | **Fails** — the chunk's own dynamic `require("jiti")` still resolves from `/$bunfs/root` |
| `--no-extensions` | **Works** — RPC answers, but built-in codemode, tool_search, and MCP go away |
| Re-add via `-e builtin:<name>` | `builtin:tool_search` was **unknown in 1.5.0** and the process died before answering |

Practical recipe: keep `dist/bundle` plus a small `node_modules` containing `jiti` (and
`@silvia-odwyer/photon-node` if you use image input) beside the binary, or accept
`--no-extensions` and register the capabilities you need through the SDK instead.

### Why the SDK binary is not affected

The wall is a property of pi's **own prebundling step**, which already externalized `jiti`
before Bun ever saw the file. Compile an entry that imports `createAgentSession` from the
package instead and Bun walks the real module graph, so `jiti` lands in the binary:

| Same program | Runtime | Extensions loaded | `node_modules` needed |
|---|---|---|---|
| `createAgentSession` under `node` | Node 26 | 7, 0 errors | Yes |
| `bun build --compile boot.mjs`, run from `/tmp` | Bun | 7, 0 errors | **No** |

### Other single-file warts observed

- `--version` prints `0.0.0` in a compiled binary: the version is read from `package.json`,
  which is not in the compiled filesystem. Set your own version string.
- A bundle-only copy of `dist/bundle` behaves the same way — self-contained JavaScript, but
  version and `jiti` both come from the package around it.
- The binary runs Bun's runtime, so `process.version` reports Bun's Node-compat version
  (`v26.12.1` on bun 1.4.4), not your installed Node.

## Shape 4 — Rebranded fork

Only worth it if you need a different `pi` binary name or config directory permanently
(`piConfig.name`, `piConfig.configDir`, `bin`). Everything else — SDK, RPC, JSONL — is
available without forking. `PI_CODING_AGENT_DIR` overrides the config directory at runtime,
which is usually enough to keep your app's state out of a user's `~/.pi/agent`.

## Which shape to pick — in-process or spawned

The API and the packaging are two separate decisions. `createAgentSession` in-process is the
better **default** for a Node/Bun host, and compiling your own SDK entry is the better
**single-file** recipe. But in-process is not cheaper, and it gives up things a child process
provides for free.

Measured cost on this machine (pi 1.5.0, node 26.13):

| What you pay | RSS |
|---|---|
| Bare `node` process | 41 MB |
| + `import "@earendil-works/pi-coding-agent"` | **130 MB** (+89 MB before any session exists) |
| + one session, defaults, 7 extensions | 142–150 MB (boot 166 ms) |
| + each further session | ~7 MB (5 sessions: 173 MB) |
| One spawned RPC child, `--no-extensions` | 116 MB |
| One spawned RPC child, 7 extensions | 136 MB |

So the in-process win is **latency and API surface**, not footprint: importing the package costs
about what a whole child process costs. What in-process buys you:

- Streaming straight into your UI with no JSONL round trip.
- `customTools` closures, `executeBash(cmd, onChunk)`, and `session.subscribe()` without a protocol.
- Session methods the RPC surface does not expose at all: `navigateTree`,
  `setActiveToolsByName`, `getCallableToolNames`, `bindExtensions`, `exportToJsonl`,
  `getToolDefinition`, `reload`. RPC has 33 commands, not the whole class.
- One deployment unit and no zombie children.

What a spawned child buys you, and the five cases where it wins even on Node:

| Reason to spawn | Why in-process loses |
|---|---|
| The agent runs arbitrary shell as a feature | `bash` inherits your process's uid, files, and env; a child can be sandboxed or run as another user |
| Crash and OOM containment | A runaway agent takes your whole server down with it |
| Per-tenant fan-out | N children are isolated; N sessions share one heap and one event loop |
| Upgrading pi independently | In-process pins the agent to your app's release train |
| Host is not Node | No SDK to import |

The honest summary: **use `createAgentSession` unless the agent is untrusted code execution or
you need fan-out isolation** — in those cases spawn, and use RPC mode for the boundary.

## Gotchas

- **`dist/bundle` is self-contained JavaScript, not a self-contained distribution.** Static
  imports are Node builtins only; `jiti`, `photon-node`, and `quickjs-wasi` load at runtime.
- **Keep `package.json` next to the bundle** or you lose version reporting (`0.0.0`).
- **`--no-extensions` also disables built-in extensions** (codemode, tool_search, MCP), not
  just user ones. A wrong `builtin:<name>` is fatal at startup, not a warning.
- **The `jiti` wall is a property of pi's prebuilt RPC bundle, not of Bun.** Compiling your own
  `createAgentSession` entry produced a 146 MB binary that loaded all 7 extensions from a
  directory with no `node_modules` at all.
- **SDK sessions load the host's extensions by default.** Pass
  `DefaultResourceLoader({ noExtensions: true })` when shipping to strangers.
- **Node >= 22.19.0** is declared by every pi package; `dist/bundle/cli.js` calls
  `enableCompileCache()` from `node:module`, so older Nodes are not a supported target.
- **Native prebuilds exist only for the TUI.** If you never enter interactive mode, the `.node`
  files are dead weight you can drop from a vendor tree.
- **MIT still needs the notice.** Redistributing the binary or the bundle means carrying the
  copyright/licence text for pi and its dependencies.
- **A compiled binary is ~144 MB.** If payload size matters, ship Node + `npm i` and spawn, or
  use the SDK in-process.

## Related

- [T3 Code × pi — How an Orchestrator Drives the pi Coding Agent Over RPC](./t3-code-pi-coding-agent-integration.md) — the product-scale instance of the spawn rung: detached child, hand-rolled framer, generated extension.

- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the working
  `createAgentSession()` recipe this shape describes, measured step by step.
- [Hermes-like App on a pi Backend](./hermes-like-app-on-pi-backend.md) — the layer above this
  note: pi-coding-agent vs pi-agent-core, and the SDK-vs-RPC-vs-JSON transport split.
- [Pi RPC Mode](./pi-rpc-mode.md) — the wire protocol a spawned CLI exposes.
- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — the other deployment extreme, where bundling the SDK for workerd drives the same questions.
- [Pi Package Map](../reference/pi-package-map.md) — which package owns what before you vendor.
- [The Functional Source License](./functional-source-license.md) — the licence to
  check if you evaluate an older or forked pi build.

## Changelog

- 2026-11-06: Corrected the `noTools: true` note above — a truthy value is not ignored, it reads as
  `"builtin"`, so built-ins drop while extension tools stay (re-measured on 1.5.0); the loading
  mechanism it described is unchanged. Linked the SDK how-to from the in-process shape.
- 2026-11-03: Correction and new measurements. Compiling **pi's prebuilt RPC entry** hits the
  `jiti` wall; compiling **your own `createAgentSession` entry** does not — the same 7
  extensions load from a directory with no `node_modules`. Added the measured RSS table
  (bare node 41 MB, import +89 MB, ~7 MB per extra session, spawned child 116–136 MB) and the
  in-process-versus-spawned decision section.
- 2026-11-03: Created. Measured on pi 1.5.0, node v26.13.0, bun 1.4.4: installed footprint,
  bundle externals, SDK import and session creation, `bun build --compile` of both an SDK entry
  and pi's RPC entry, the `jiti` failure and its `--no-extensions` workaround.
