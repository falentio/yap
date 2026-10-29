---
title: Pi Sandbox Integration — Fork Pi or Build Extensions?
category: technology
tags: [pi, sandbox, extensions, agent-harness, architecture]
status: complete
created: 2026-10-27
updated: 2026-10-27
sources:
  - local:node_modules/@earendil-works/pi-coding-agent/docs/extensions.md
  - local:node_modules/@earendil-works/pi-coding-agent/docs/containerization.md
  - local:node_modules/@earendil-works/pi-coding-agent/docs/sdk.md
  - https://github.com/earendil-works/pi
confidence: high
---

# Pi Sandbox Integration — Fork Pi or Build Extensions?

Version under study: `@earendil-works/pi-coding-agent` **0.83.0**, read from the
installed package at `/home/kevin/node_modules/@earendil-works/pi-coding-agent`
on 2026-10-27. Doc paths below are relative to that package root (`docs/*.md`,
`dist/core/*.js`, `examples/extensions/*`). Every claim marked *proven* was
executed against that install; the commands are in [Evidence](#evidence).

## TL;DR

- **Extensions, not a fork.** pi already exposes the three seams a sandbox
  needs: replace or wrap `bash` (`pi.registerTool`), route user `!` commands
  (`user_bash`), and intercept every tool call (`tool_call`).
- **A shared sandbox instance does not require a fork either.** `pi.events` is
  an in-process `EventEmitter`: it carries live object references and functions,
  not serialized copies, so one extension can hand another the actual sandbox
  handle.
- **A module-level singleton does not work.** Each extension is imported by its
  own jiti instance with `moduleCache: false`
  (`dist/core/extensions/loader.js:325-326`), so a "shared" import is evaluated
  once per extension — two different objects. Proven below.
- **Fork only in two narrow cases:** foreign extensions must consume the handle
  with compile-time types and you refuse the bus contract, or built-in tools must
  be *enforced* through the sandbox. The second is a real gap: an extension
  cannot reroute another extension's tool execution
  (`docs/containerization.md` §"Choose a pattern").

## Context

The question: integrate a sandbox into pi, and let more than one extension reach
the same sandbox instance. Is that a fork of pi or a set of extensions?

The answer depends on what "the sandbox instance object" is, and the two shapes
answer differently:

| Sandbox shape | Handle is | Sharing is |
| --- | --- | --- |
| Local process/VM/container driver held in this process (Anthropic sandbox-runtime, Gondolin, Docker driver) | live object with sockets, child processes, fds | a reference-passing problem, same process |
| Remote managed sandbox (E2B, Cloudflare Sandboxes, Daytona, Upstash Box) | `{ id, endpoint, token }` plus a stateless client | a data-passing problem, no shared object at all |

The fork-or-extension question only exists for the first shape. For the second,
every extension builds its own client from a descriptor, and pi needs no new
seam.

## Options at a glance

| Dimension | Single extension, N tools | Separate extensions + `pi.events` | SDK embed (`extensionFactories`) | Fork pi |
| --- | --- | --- | --- | --- |
| Shared live handle | module scope, trivial | passes by reference, proven | closure over host object | via new core service |
| Compile-time typing | yes | contract types only, untyped at the bus | yes | yes |
| Works for extensions you don't own | no | yes | only ones you register | yes |
| Survives `/reload` | rebuilt with the extension | needs explicit re-resolve + unsubscribe | rebuilt with the host | depends on patch |
| Upgrade cost | none | none | none | rebase every release |
| Sees other tools' calls | no | no | no | can enforce routing |
| Effort | smallest | small | medium (own entrypoint) | large and permanent |

Release cadence is the whole argument against the last column: 267 changelog
entries, `0.82.0` on 2026-07-24, `0.82.1` on 2026-07-25, `0.83.0` on 2026-07-29
(`CHANGELOG.md`), and the extension loader is exactly the file a service registry
would touch.

## Findings

### 1. What pi already gives a sandbox

| Seam | API | Where it is documented |
| --- | --- | --- |
| Replace `bash` entirely | `pi.registerTool({ ...createBashTool(cwd), execute })` | `docs/extensions.md` §"Overriding Built-in Tools" |
| Rewrite or block a call, keep the built-in | `tool_call` event returning `{ input }` or a block | extensions.md §"Tool Events" |
| Route `!` commands | `user_bash` event returning `{ operations }` | extensions.md §"User Bash Events" |
| Publish the handle | `pi.events.emit` / `.on`, returns an unsubscribe | extensions.md §"pi.events" |
| Per-session lifecycle | `session_start` (`reason`: `startup`/`reload`/`new`/`resume`/`fork`) and `session_shutdown` | extensions.md §"Session Events" |
| Run pi itself inside a sandbox | Gondolin extension, plain Docker, NVIDIA OpenShell | `docs/containerization.md` |

Two working examples ship in the package:

- `examples/extensions/sandbox/index.ts` — wraps every bash call with
  `@anthropic-ai/sandbox-runtime` (`SandboxManager.wrapWithSandbox`), overrides
  `bash`, and returns the same operations for `user_bash`. Config merges from
  `~/.pi/agent/extensions/sandbox.json` and `<cwd>/.pi/sandbox.json`. This is the
  OS-level (Seatbelt / bubblewrap) shape.
- `examples/extensions/gondolin/index.ts` — routes `read`, `write`, `edit`,
  `bash`, `grep`, `find`, `ls` into a local micro-VM.

Neither example publishes its handle, which is the gap the next section fills.

### 2. Sharing across extensions: what works, what doesn't

**Module singleton: no.** `loadExtensionModule` creates a fresh jiti instance per
extension with `moduleCache: false`, so an import shared by two extensions is
evaluated twice. Proven: two extensions import the same `shared.ts`; the first
sets `state.value = 42`, the second reads `0`, and the module's random `marker`
differs between them.

```
A marker=72iiz7wjnml set=42
B marker=dn9p3nz9hit saw=0
```

This also kills the "publish a convention npm package that holds a registry"
idea. Types travel fine; state does not.

**`pi.events`: yes.** The bus is one `EventEmitter` created once per
`ResourceLoader` (`dist/core/resource-loader.js:158`) and handed to every
extension (`loader.js:401`). The payload is `unknown`, passed by reference.
Proven: a producer registers `sandbox:get` and replies with a live object
carrying a method; the consumer receives that object and calls
`sandbox.exec("ls")` successfully.

Two properties of the implementation matter:

- Handlers are wrapped in an async function before `emitter.on`
  (`dist/core/event-bus.js`), so the body runs synchronously up to its first
  `await`. A reply before any `await` lands in the same tick; a reply after one
  lands a microtask later. A synchronous callback contract therefore works only
  by accident. **Use a Promise-based request with a timeout.**
- `on()` returns an unsubscribe, and nothing on the reload path clears the bus.
  A long-lived listener from a pre-reload extension stays subscribed unless that
  extension unsubscribes on `session_shutdown`. Marked *source-read*: not
  exercised.

**Ordering.** A consumer that emits from its factory gets nothing when it loads
before the producer. Proven: emitting in the factory with the consumer loaded
first returns `NONE`; the same emit from a `session_start` handler returns the
sandbox. `session_start` is the correct resolution point because all factories
have run by then.

**Closure over the host object (SDK).** `DefaultResourceLoader` accepts
`extensionFactories`, inline `(pi) => void` functions
(`docs/sdk.md` §"Extensions"). The host process owns the sandbox and passes it by closure, so
the handle is typed and needs no bus. The cost is owning your entrypoint instead
of running the `pi` binary.

### 3. Recommended shape

One **sandbox-host extension** owns lifecycle, and a small **contract module**
carries types plus channel names only. Consumers resolve the handle at
`session_start` or at first use, never at factory time.

```
pi process
├── sandbox-host extension
│   ├── owns the driver (VM, container, sandbox-runtime)
│   ├── subscribes "sandbox:request"
│   ├── starts on session_start, disposes on session_shutdown
│   └── unsubscribes what it registered on shutdown
├── contract module (types + channel constants, no state)
├── consumer extension: bash routing
├── consumer extension: network-egress tool
└── consumer extension: test runner
```

The contract is four lines of shape:

```ts
// request
pi.events.emit("sandbox:request", { resolve, reject, acq: "acme/sandbox-v1" });
// reply
pi.events.on("sandbox:request", async (req) => req.resolve(handle));
```

Rules that keep this honest:

1. Resolve in `session_start`, not in the factory (proven ordering failure).
2. Reply is async-safe: the consumer awaits a Promise with a timeout, because a
   producer that `await`s before replying misses a synchronous read.
3. The producer unsubscribes on `session_shutdown`; the bus is not cleared on
   reload.
4. Consumers must re-resolve after `session_start` with `reason: "reload"`
   (`ctx.reload()` emits `session_shutdown` first, then reloads and re-emits
   `session_start`). Treat any held handle as dead across that boundary.
5. Decide per-session vs per-process deliberately. `session_start` reason `new`,
   `resume`, and `fork` all reuse the process; a sandbox scoped to a session
   needs a fresh instance on each, and a process-scoped sandbox needs a guard so
   it is not rebuilt on every session switch.
6. Do not put a second copy of the state in the contract module. Types only.

### 4. If the sandbox is remote, skip the bus

For E2B, Cloudflare Sandboxes, Daytona, and Upstash Box the handle is a
descriptor plus credentials. Publish the descriptor as data (session entry, env
var, or file) and let each extension construct its own client. There is no live
object to share, so `pi.events` adds a hop and no value. See
[Upstash Box vs Cloudflare Sandboxes](../product/upstash-box-vs-cloudflare-sandbox.md)
for what those bill.

### 5. When a fork is actually right

Two cases, and only two:

1. **Foreign extensions must consume the handle with types.** If third-party
   authors are expected to call `ctx.sandbox.exec()`, an untyped bus contract is
   weak. The fork patch is a `pi.registerService(name, impl)` +
   `ctx.getService(name)` pair in `dist/core/extensions/loader.js` and
   `types.d.ts`, with disposal ordering on reload. This is a small patch and a
   permanent rebase.
2. **Built-in tools must be enforced, not advisory.** An extension can rewrite a
   `tool_call` input or block it, but it cannot redirect execution. Another
   extension's tool that calls `fetch` or `fs.writeFile` runs on the host
   (`containerization.md`: "other custom extension tools still run on the host
   unless they also delegate their operations"). Enforcing a boundary for code
   you do not control means either the fork or running the whole `pi` process in
   the sandbox (Docker/OpenShell/Gondolin), which needs no fork at all.

Note that case 2 usually resolves to the containerization pattern, not to a
patch: if the process itself is inside the boundary, every extension is inside
it too.

## Open Questions

- Does the bus listener leak on reload actually bite in practice, or does the
  runner drop the old runtime's listeners somewhere not grepped here? Confirmed
  by reading `loader.js`/`resource-loader.js`/`event-bus.js` only, not by driving
  `/reload` and counting replies.
- Whether `ctx.reload()` is common enough on this workload to justify the
  unsubscribe discipline, versus a process-scoped sandbox that deliberately
  outlives sessions.
- Cost of the SDK entrypoint route against the stock binary in a packaged
  install (auth, updates, `pi install`-style package management).

## Evidence

Run against pi 0.83.0 in print mode (`-p`). Extension factories and
`session_start` run before the model turn, so the model's answer is irrelevant;
the assertions land in files on disk.

The two decisive fixtures, trimmed:

```ts
// shared.ts
export const state = { value: 0, marker: Math.random().toString(36).slice(2) };
// a.ts: import { state } from "./shared.ts"; state.value = 42 in the factory
// b.ts: import { state } from "./shared.ts"; append `saw=${state.value}` in the factory
```

```ts
// bus-a.ts: on("sandbox:get", (p) => p.reply({ id: "sbx-1", exec: (c) => `ran ${c}` }))
// bus-b.ts: emit("sandbox:get", { reply: (sb) => ... }) in the factory and in session_start
```

```bash
# module singleton: two objects, not one
pi -e /tmp/pi-share/a.ts -e /tmp/pi-share/b.ts -p "hi"
# A marker=72iiz7wjnml set=42
# B marker=dn9p3nz9hit saw=0        → separate module instances

# live object over pi.events
pi -e /tmp/pi-share/bus-a.ts -e /tmp/pi-share/bus-b.ts -p "hi"
# got=sbx-1 exec=ran ls            → reference and method survived the bus

# load-order failure and the session_start fix (consumer loaded first)
pi -e /tmp/pi-share/bus-b2.ts -e /tmp/pi-share/bus-a.ts -p "hi"
# factory got=NONE
# session_start got=sbx-1

# async producer, Promise-based request
pi -e /tmp/pi-share/req-b.ts -e /tmp/pi-share/req-a.ts -p "hi"
# resolved=sbx-async exec=ran ls
```

## Related

- [Features Worth Porting to Pi as Extensions](./coding-agent-features-to-port-to-pi-extensions.md) — ranks sandboxed bash and the OS sandbox in the port list, and lists `bash` as unsandboxed in pi.
- [Upstash Box vs Cloudflare Sandboxes](../product/upstash-box-vs-cloudflare-sandbox.md) — pricing for the remote-sandbox shape.
- [Open-Source Grok Bot Alternatives with First-Class Sandbox VMs](./open-source-grok-bot-alternatives.md) — sandbox provider interfaces worth copying (Docker, E2B, K8s+Kata, Daytona).

- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md) — the hosting question: which sandbox can stand in for the filesystem when the host is a Cloudflare Worker.

## Changelog

- 2026-10-27 — created. Read against pi 0.83.0; sharing behaviour proven with four local experiments.
