---
title: Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem
category: technology
tags: [pi, pi-coding-agent, cloudflare, workers, durable-objects, daytona, sandbox, filesystem, agent-harness, edge]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/earendil-works/pi/tree/babe30a7e6c1/packages/coding-agent
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/index.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/sdk.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/tools/grep.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/session-manager.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/containerization.md
  - https://developers.cloudflare.com/workers/runtime-apis/nodejs/
  - https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/
  - https://developers.cloudflare.com/workers/platform/limits/
  - https://developers.cloudflare.com/durable-objects/platform/limits/
  - https://developers.cloudflare.com/sandbox/coding-agents/
  - https://developers.cloudflare.com/sandbox/coding-agents/pi/
  - https://developers.cloudflare.com/agents/harnesses/pi/
  - https://www.daytona.io/docs/en/process-code-execution/
  - https://www.daytona.io/docs/en/file-system-operations/
  - https://www.daytona.io/docs/en/authentication/
  - https://www.daytona.io/docs/en/persistence/
  - https://www.daytona.io/docs/en/typescript-sdk/
  - https://www.daytona.io/dotfiles/claude-coding-live-with-cloudflare-daytona
  - https://github.com/qaml-ai/pi-worker
  - https://harshil.dev/writings/how-i-run-pi-coding-agent-on-cloudflare/
confidence: high
---

# Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem

## TL;DR

- **The package: no.** `@earendil-works/pi-coding-agent` is a Node/Bun terminal program. Its only
  two exports are a single eager barrel that pulls in the CLI/TUI graph and `rpc-entry`; the
  barrel reaches `node:fs`, `node:module`, `node:readline`, `child_process.spawn`, and a
  top-level `readFileSync` of its own `package.json` at import time
  ([index.ts:417](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/index.ts),
  [config.ts:568-571](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/config.ts)).
  A Worker has no such filesystem and no usable `child_process`
  ([Workers node compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)).
- **Workers' `node:fs` is not a workspace.** It is a memory VFS: `/bundle` read-only, `/tmp`
  writable but "unique to each request", timestamps pinned to the Unix epoch, no permissions, no
  watchers, counted against the 128 MB memory limit
  ([fs runtime API](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)).
- **Daytona is a fine filesystem for a Worker, because it needs no SDK.** Its toolbox is plain
  HTTP — `POST https://proxy.app.daytona.io/toolbox/{sandboxId}/process/execute` and
  `GET .../files?path=` — authenticated with a bearer API key
  ([process](https://www.daytona.io/docs/en/process-code-execution/),
  [files](https://www.daytona.io/docs/en/file-system-operations/),
  [auth](https://www.daytona.io/docs/en/authentication/)). Sandboxes also survive a stop with
  their filesystem intact ([persistence](https://www.daytona.io/docs/en/persistence/)).
- **But "pi on Workers with Daytona as its disk" is not one design — it is two, and only one of
  them runs pi.** Either (A) pi runs *inside* the Daytona sandbox and the Worker/DO drives it over
  exec or RPC, or (B) pi-agent-core plus pi-ai runs in the DO and every fs/shell tool becomes an HTTP
  call into the sandbox. Only (A) still has the coding agent's extensions, TUI, compaction, and
  grep; (B) is a re-host, and it loses `grep` outright because the built-in grep always spawns
  `rg` with no injectable backend
  ([grep.ts:119,170](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/tools/grep.ts)).
- **Cloudflare already ships (A) for pi** against Cloudflare Containers: a DO execs
  `pi --mode json --no-session` in a Linux sandbox and proxies the model call through AI Gateway
  ([Run Pi in a sandbox](https://developers.cloudflare.com/sandbox/coding-agents/pi/)). Swap the
  container for Daytona and the same shape works; a Cloudflare engineer published exactly that
  Worker-plus-DO-plus-Daytona pattern for Claude Code
  ([Nightona](https://www.daytona.io/dotfiles/claude-coding-live-with-cloudflare-daytona)).
- **Pick (A) unless you are building a product.** Anything called "pi on Workers" that keeps
  pi's own semantics ends up with the agent in a real Linux box and the Worker as orchestrator.

## Context

Asked 2026-10-29: "can pi coding agent run on Cloudflare Workers, but the filesystem use a
sandbox like Daytona?" The question merges two independent decisions — where the agent loop
executes, and where the files live — and the answer differs for each. This file separates them,
then compares the four designs that come out.

**Pinned revisions.** `@earendil-works/pi` read at
[`babe30a7e6c1`](https://github.com/earendil-works/pi/tree/babe30a7e6c1) (scout read,
2026-10-29), with the installed `@earendil-works/pi-coding-agent` **1.4.0** (`engines.node >=
22.19.0`, exports `.` and `./rpc-entry`) for the doc text. Daytona docs and Cloudflare docs read
2026-10-29.

**Prior coverage in this repo.**
[Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
covers the *durable harness* on a DO (design B's storage half);
[Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) is the positioning
comparison; [Pi Sandbox Integration — Fork or Extensions](./pi-sandbox-integration-fork-vs-extension.md)
covers routing pi's tools into a sandbox from *inside* a pi process. This file is the missing
case: pi's *host* is a Worker.

## Findings

### 1. Two questions, four designs

| Question | If the answer is "Worker" | If the answer is "sandbox" |
| --- | --- | --- |
| Where does the agent loop run? | `pi-agent-core` / `pi-durable` inside a DO | the `pi` process, in Linux |
| Where do the files live? | DO SQLite / R2, or a remote sandbox over HTTP | the sandbox's own disk, mounted at `cwd` |

Crossing them yields the four designs compared in [§6](#6-the-four-designs-side-by-side). The
tempting reading of the question — "keep pi, point `fs` at Daytona" — is the one thing pi does
not offer: nothing in the coding agent accepts an `fs` implementation, and `cwd` is a string
that the built-in tools turn into local `node:fs` calls.

### 2. What the coding agent requires from a host

Every row is load-bearing: each one, alone, disqualifies a Worker.

| Requirement | Evidence in pi 1.4.0 | Workers runtime |
| --- | --- | --- |
| Import must not touch disk | barrel re-exports `main.ts` (`index.ts:417`); `config.ts` does top-level `readFileSync(package.json)` (`config.ts:568-571`) | only `/bundle` is readable |
| Import must not load CLI/TUI | `main.ts:67` → `modes/index.ts:5` → `interactive-mode.ts:7-9,56` (`node:fs`, `node:os`, `spawn`) | `child_process` is an import-only stub |
| No `node:readline` | imported by the graph above; `rpc-mode.ts` also loads the theme module, which reads theme JSON (`theme.ts:387-388`) | import-only stub, not usable |
| A workspace at `cwd` | session manager defaults `cwd` to `process.cwd()` (`session-manager.ts:1814`, `paths.ts:103`) | `process.cwd()` resolves, but nothing is there |
| Read/write/edit/ls on that workspace | tool defaults hardcode `node:fs` (`read.ts:55-59`, `write.ts:34-37`, `edit.ts:92-96`, `ls.ts:43-46`) | VFS, wiped per request |
| `bash` | `bash.ts:112,248`; shell resolved by spawning `which`/`where` (`shell.ts:47,66,86`) | no process spawn |
| `grep` | `ensureTool("rg")` then `spawn(rgPath, …)`, unconditional (`grep.ts:119,170`) | no binary, no spawn |
| `rg` and `fd` on disk | downloaded at runtime into `~/.pi/agent/bin` (`tools-manager.ts:337-352`) | no persistent disk, no exec |
| Durable transcript | JSONL session files (`docs/how-pi-works.md`, or `SessionManager.inMemory()`) | no cross-request disk |
| Extensions | loaded through `node:module` + jiti (`extensions/loader.ts:6-7`) | no module loader for TS at runtime |
| Node ≥ 22.19 | `package.json` `engines` | Workers ships API subsets, not a Node runtime |

Two of these are seams rather than walls, which is what design B exploits: the built-in tools
route through injectable `*Operations` interfaces (`read:50-56`, `write:27-32`, `edit:83-90`,
`ls:34-41`, `bash:75`), and `SessionManager.inMemory()` is genuinely disk-free
(`session-manager.ts:1012-1014,1078,1173-1174`). `find` can even bypass its binary when the
caller supplies a `glob` (`find.ts:115-116,172`). **`grep` is the exception**: its
`GrepOperations` only cover `isDirectory`/`readFile`, so the `rg` spawn cannot be replaced
(`grep.ts:53-58`).

### 3. Why `import` alone already fails

```ts
// what a Worker would have to import to get createAgentSession
import { createAgentSession } from "@earendil-works/pi-coding-agent";
```

The SDK doc frames the package as in-process embedding for **"a Node.js or Bun process"**
([sdk.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sdk.md)),
and the export map has no third entry and no browser/workerd condition — just `.` and
`./rpc-entry` (`package.json:13-25`). There is exactly one dynamic `import()` in the whole
package (`utils/photon.ts:128`), so nothing Node-only is deferred past load. Bundling the barrel
for a Worker therefore drags the TUI, the extension loader, the theme loader, and the downloader
into the graph before a single prompt is sent.

*Not executed:* which line throws first under `workerd` — the top-level `package.json` read or a
stub call — is unverified. See [§8](#8-open-questions).

### 4. Shape A — pi inside a sandbox, the Worker drives

This is the shape Cloudflare documents for pi itself, and it keeps every pi feature because pi is
not modified at all.

| Piece | Cloudflare's recipe | Same shape on Daytona |
| --- | --- | --- |
| Image | `node:24-trixie-slim`, `bash`, `git`, `ripgrep`, `npm i -g @earendil-works/pi-coding-agent@0.87.1`, `sandbox-shim` | a Daytona snapshot built from the same Dockerfile, pre-warmed |
| Invocation | `pi --mode json --no-session --provider cloudflare-ai-gateway --model $MODEL -- "<prompt>"` | identical argv, executed with `POST /toolbox/{id}/process/execute` |
| Stream | one JSON event per line, parsed by the DO | same, or a session/PTY for live output |
| Credentials | Worker holds the gateway token; an `Outbound` handler swaps the placeholder `cf-aig-authorization` header | Worker passes `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` as per-call env, never persisted in the snapshot |
| Egress | sandbox may reach only the gateway and `github.com` | Daytona network allowlist / per-sandbox policy |
| Lifecycle | DO starts the sandbox per task and reads the diff back | DO stores `sandboxId`, stops the sandbox between tasks |

The Cloudflare page is unusually concrete about the two things people get wrong: pin the pi
version ("the flags and event format of Pi can change between releases"), and pass
`PI_OFFLINE=1`, `PI_SKIP_VERSION_CHECK=1`, `PI_TELEMETRY=0` so the containerised agent stops
trying to refresh the model catalog, check for updates, and phone home
([Run Pi in a sandbox](https://developers.cloudflare.com/sandbox/coding-agents/pi/)). The same
page notes pi "runs its tools without approval prompts", so the container is the only boundary.

On Daytona the transport is thinner than it looks, because the toolbox is HTTP:

```ts
// Durable Object holding one conversation + one Daytona sandbox
const res = await fetch(
  `https://proxy.app.daytona.io/toolbox/${sandboxId}/process/execute`,
  {
    method: "POST",
    headers: { authorization: `Bearer ${env.DAYTONA_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      command: `pi --mode json --no-session --provider anthropic --model claude-sonnet-5 -- ${shellQuote(prompt)}`,
      cwd: "workspace",
      timeout: 600,
    }),
  },
);
```

Two details from the docs matter. `process/execute` **defaults to a 10 s timeout**, so long turns
need a session or a PTY instead of one-shot exec
([process](https://www.daytona.io/docs/en/process-code-execution/)). And continuity across turns
should come from pi's own JSONL session files on the sandbox disk (drop `--no-session`, re-invoke
per turn) rather than from replaying transcripts through the Worker — the flag for resuming is
version-specific and `pi --help` is authoritative
([rpc.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/rpc.md)).

The precedent is real: Nightona, by a Cloudflare systems engineer, runs Claude Code inside a
Daytona sandbox with a Worker front end and a `SandboxManager` DO that persists `sandboxId` and
message history, and pre-warms the agent image as a Daytona snapshot
([dotfiles](https://www.daytona.io/dotfiles/claude-coding-live-with-cloudflare-daytona)).

### 5. Shape B — pi's loop in the DO, tools in Daytona

Design B is the one the question literally describes, and it is possible — but not with the
coding-agent package, and not without writing the tools yourself.

| Constraint | Consequence |
| --- | --- |
| `createAgentSession` builds file-backed defaults unless every service is injected (`sdk.ts:198-206`) | pass `modelRuntime`, `settingsManager`, `sessionManager`, `resourceLoader` explicitly |
| A custom `resourceLoader` skips `DefaultResourceLoader` and the extension loader entirely (`sdk.ts:203-206,474`) | the Worker must own skills, prompt templates, and context files |
| `CreateAgentSessionOptions` has no `baseToolsOverride`; the 8 built-in definitions are always constructed (`sdk.ts:47-107`) | construction is I/O-free, so harmless; execution is what must be rerouted |
| Tool defaults are local | supply `operations` for read/write/edit/ls/bash/find, and `excludeTools: ["grep"]` plus your own grep that execs `rg` in the sandbox |
| `SessionManager.inMemory()` is disk-free (`session-manager.ts:1012-1014`) | transcripts must be persisted by the host (DO SQLite) if you want history |
| Import of the barrel is Node-shaped | you cannot `import` the package at all; use `@earendil-works/pi-agent-core` + `pi-ai` directly |

That last row is the real fork in the road. Two published projects took opposite routes:

- **`qaml-ai/pi-worker`** forks the coding agent for Workers: `packages/pi-coding-agent-worker`
  is "a worker-friendly fork/wrapper around `@mariozechner/pi-coding-agent`", with
  SQLite-backed persistent files, code execution in Dynamic Workers, and DO-backed sessions
  ([repo](https://github.com/qaml-ai/pi-worker)).
- **harshil.dev's "Pi on Cloudflare"** starts from `pi-agent-core` + `pi-ai` and supplies its own
  `Storage` implementation, keeping pi's entry types and session tree but replacing the machine:
  one `PiSession` DO per conversation owning the transcript tree, the active leaf, and a durable
  workspace ([write-up](https://harshil.dev/writings/how-i-run-pi-coding-agent-on-cloudflare/)).

Both report the same reason for the effort: "Workers has a request-scoped virtual filesystem, but
it does not persist files across requests or provide the host filesystem a local coding agent
expects" ([harshil.dev](https://harshil.dev/writings/how-i-run-pi-coding-agent-on-cloudflare/)).

If you want to keep design B but not hand-write tool plumbing, `pi-durable` is the piece built for
it: Cloudflare's `PiHarness` runs the durable harness in a DO with SQLite storage and alarm-based
wake-up, and pi-durable already takes a pluggable execution environment per conversation
([Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/),
[prior file](./pi-durable-cloudflare-workers-durable-objects.md)).

### 6. The four designs side by side

| Dimension | A1: pi in Daytona, Worker drives | A2: pi in Cloudflare Sandbox, DO drives | B1: pi-agent-core in DO, tools → Daytona | B2: pi fork in Worker, fs in SQLite/R2 |
| --- | --- | --- | --- | --- |
| Agent loop runs in | Daytona sandbox | Cloudflare container | Durable Object | Worker / DO |
| Files live in | Daytona disk | container disk | Daytona disk via HTTP | DO SQLite / R2 |
| pi package used | `pi` CLI as-is | `pi` CLI as-is | `pi-agent-core` + `pi-ai` (or `pi-durable`) | forked `pi-coding-agent` |
| Extensions / TUI / slash commands | all of them | all of them | none | partial (fork decides) |
| `grep` works | yes, inside the box | yes | only via your own exec | via fork |
| Transcript | pi JSONL on sandbox disk | pi JSONL on container disk | DO SQLite | DO SQLite |
| Tool-call latency | one exec round trip | one exec round trip | 1–3 HTTP round trips | ~0 (local SQL) |
| Long bash / builds | yes (sessions, PTY) | yes | yes, as a sandbox process | no |
| Crash recovery | sandbox persists; DO keeps the id | container lifetime; DO restarts it | durable per task (pi-durable) | durable per task |
| Provider key location | Worker injects per call | Worker injects per call | Worker holds it | Worker holds it |
| Egress control | Daytona policy | Cloudflare Outbound | Daytona policy | n/a |
| Build effort | a DO + one REST client | the documented recipe | a tool shim layer | a fork to maintain |
| Fidelity to "pi" | highest | highest | a new host | medium |

### 7. Constraints and gotchas

| Constraint | Number | Where it bites |
| --- | --- | --- |
| Worker memory | 128 MB | any in-memory VFS or transcript copy ([limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| CPU per request | 30 s default, 5 min max (Paid) | parsing big tool output, diffing ([limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| Subrequests per request | 10,000 (Paid), 50 (Free) | one subrequest per fs/tool call in design B ([limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| Simultaneous outgoing connections | 6 | parallel tool calls against Daytona serialize ([limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| DO CPU | 30 s default, configurable to 5 min | long turns in design B1 ([DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)) |
| Daytona exec timeout | 10 s default | a `bash` tool call that builds something ([process](https://www.daytona.io/docs/en/process-code-execution/)) |
| Daytona filesystem lifetime | survives stop, lost on delete | auto-delete/TTL set on the sandbox destroys it ([api keys](https://www.daytona.io/docs/en/api-keys/)) |

Three non-numeric traps:

1. **The Daytona TypeScript SDK is not the Worker path.** From SDK 0.198.0 the client opens a
   Socket.IO WebSocket for state updates and its docs speak of "Node.js or Bun processes"
   ([typescript-sdk](https://www.daytona.io/docs/en/typescript-sdk/)). Use the documented REST
   endpoints with `fetch` instead. *Unverified:* whether `@daytona/sdk` itself works under
   `workerd`.
2. **`--no-session` is not free.** Cloudflare's recipe uses it to keep the session in memory, which
   throws away continuity between invocations. Design A on Daytona should keep the session files on
   the sandbox disk instead.
3. **Approvals do not exist in this mode.** Pi's JSON/RPC modes run tools without prompting; with a
   real filesystem and network behind the sandbox, the sandbox is the only guard
   ([Run Pi in a sandbox](https://developers.cloudflare.com/sandbox/coding-agents/pi/)).

### 8. Open questions

- **Where exactly does the barrel fail under `workerd`?** Probe: bundle the `.` entry for the
  `workerd` condition, run `wrangler dev`, and record the first thrown error. This decides whether
  a Worker could ever host the coding agent behind a compatibility shim.
- **Is `@daytona/sdk` Workers-safe?** Its Socket.IO default suggests no; a plain-`fetch` REST
  client is the safe assumption until proven otherwise.
- **Can a DO hold a PTY to Daytona?** The toolbox has PTY and streamed log endpoints; whether a
  Worker can attach to that stream and drive `pi --mode rpc` interactively is untested here.
- **Does `pi-agent-core` import cleanly on Workers?** The published projects say yes in practice,
  but their exact package versions were not pinned in what they published.

## Decision guide

| If you want… | Build |
| --- | --- |
| pi's actual behaviour, hosted, single user | **A1 or A2**: pi in the sandbox, DO as the driver |
| a hosted product on Cloudflare's own stack, no third party | **A2**, Cloudflare's documented recipe |
| a sandbox vendor of your choice with Cloudflare at the edge | **A1**, Daytona + DO, Nightona's shape |
| durable multi-client sessions, subagents, background work | **B1** on `pi-durable` (`PiHarness`) |
| a browser terminal that runs a pi-style agent with no containers | **B2**, accept the fork |
| to keep provider keys out of the sandbox | A1/A2 with a Worker-side egress proxy (Cloudflare's `Outbound` handler) |

## Sources

- Pi source, pinned: `earendil-works/pi` @ `babe30a7e6c1`, `packages/coding-agent`
  ([tree](https://github.com/earendil-works/pi/tree/babe30a7e6c1/packages/coding-agent));
  installed `@earendil-works/pi-coding-agent` 1.4.0 for `docs/*.md`.
- Cloudflare: [Workers node compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/),
  [`node:fs` VFS](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/),
  [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
  [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
  [coding agents in a sandbox](https://developers.cloudflare.com/sandbox/coding-agents/),
  [Run Pi in a sandbox](https://developers.cloudflare.com/sandbox/coding-agents/pi/),
  [Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/).
- Daytona: [process](https://www.daytona.io/docs/en/process-code-execution/),
  [files](https://www.daytona.io/docs/en/file-system-operations/),
  [auth](https://www.daytona.io/docs/en/authentication/),
  [persistence](https://www.daytona.io/docs/en/persistence/),
  [TypeScript SDK](https://www.daytona.io/docs/en/typescript-sdk/),
  [Nightona](https://www.daytona.io/dotfiles/claude-coding-live-with-cloudflare-daytona).
- Existing implementations:
  [qaml-ai/pi-worker](https://github.com/qaml-ai/pi-worker),
  [harshil.dev](https://harshil.dev/writings/how-i-run-pi-coding-agent-on-cloudflare/).

## Related

- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
  — the durable harness on a DO: SQLite storage, alarm wake-up, replay safety, limits.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — what durability buys and
  what the terminal product gives up.
- [Pi Sandbox Integration — Fork or Extensions](./pi-sandbox-integration-fork-vs-extension.md) —
  routing pi's tools into a sandbox from inside a running pi process.
- [Upstash Box vs Cloudflare Sandboxes](../product/upstash-box-vs-cloudflare-sandbox.md) and
  [AI Agent Sandboxes Compared](../product/ai-agent-sandbox-comparison.md) — sandbox vendor pricing.
- [Cloudflare Durable Objects in Production](./cloudflare-durable-objects-production-review.md) —
  DO latency and placement, which bounds every design here.

- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — which package is which: pi-ai, pi-agent-core, pi-coding-agent, and the separate pi-durable stack.

## Changelog

- 2026-10-29 — created. Evidence: scout read of `earendil-works/pi` @ `babe30a7e6c1`
  (path:line citations throughout), installed 1.4.0 docs, Cloudflare Workers/DO/Sandbox docs and
  Daytona docs fetched through TinyFish, plus two published pi-on-Workers implementations.
  Unverified items are listed in §8.
