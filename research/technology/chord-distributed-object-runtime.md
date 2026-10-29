---
title: Chord — Earendil's Distributed, Hot-Reloadable Object Runtime
category: technology
tags: [pi, earendil, chord, pi-durable, runtime, rpc, hot-reload, replicated-state, sqlite, plugins]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/README.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/docs/guide.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/package.json
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/index.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/host.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/contract.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/object.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/state.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/reload.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/link.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/next/index.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/storage/store/storage.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/session/transaction.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/harness/task-graph.ts
  - https://libraries.io/npm/@earendil-works%2Fchord
  - https://npm.io/package/@earendil-works/chord
confidence: high
---

# Chord — Earendil's Distributed, Hot-Reloadable Object Runtime

## TL;DR

- **Chord is `@earendil-works/chord`**, published alongside pi at 1.4.0: a runtime for building an
  application "out of objects that live in several processes (a server, workers, browser tabs) and
  can be hot reloaded while they run. An object is state plus code at an address […] Everyone gets
  a reference, never the object"
  ([README:3](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/README.md)).
- **It is not part of the coding agent.** `pi-coding-agent` does not depend on chord at all; the
  coding agent's extensions are jiti-loaded TypeScript modules, a different mechanism.
- **Its one real consumer is `pi-durable`** — and even there, only as a *library*, not as a host
  framework: no `createHost`, `defineFacet`, `ipcLink`, `webSocketLink`, or `replicatedState`
  import exists in durable's source. What durable takes is the delta tracker (its transaction
  engine), `Watch`, `Context`/telemetry, JSON helpers, the `chord/next` store, and chord's SQLite
  drivers for Node and Durable Objects.
- **The package carries two API generations.** The root export is the settled v1 surface (contracts,
  hosts, facets, references, replicated state, links, reload); `chord/next` is explicitly
  experimental and holds the document engine, the store, and its own host/link/jobs layers.
- **"Chord-tracked documents" in pi-durable's spec is the `chord/next` engine**, not v1. Chord v1
  has no documents at all; durable's own `Document` type lives in durable and only borrows chord's
  `JsonValue` and `Op` types.

Pinned: repo [`babe30a7e6c1`](https://github.com/earendil-works/pi/tree/babe30a7e6c1), package version **1.4.0**,
read 2026-10-29. On npm: a 1.2.0 release is listed by [libraries.io](https://libraries.io/npm/@earendil-works%2Fchord);
whether 1.4.0 is published is **[unverified]** from this checkout.

## Details

### 1. The model in one paragraph

You declare a **contract** (a runtime TypeBox value describing an object type, its address input, and
its members), deploy its code as a **facet** into a **host** process, and get an object created on
demand at an address as **state plus code** (`contract.ts:166,171,219,254`, `host.ts:84,96,105`,
`object.ts:79`). Callers never hold the object — they hold a **reference** (`object.ts:760`), and
a **principal** decides which variant and which methods that reference may reach
(`object.ts:564`, `host.ts:170-175`). Because every call crosses a **link** — in-memory, Node IPC, or
WebSocket, framed by a versioned wire protocol (`link.ts:5,272,339,414`, `wire.ts:24`) — placement is
a deployment decision, not a code change: `hostNamed`/`hostFamily` on a member decides where work
runs (`contract.ts:39,44`).

**Hot reload** is the point of the exercise: a `Reload` procedure (`reload.ts:177`) swaps code while
in-flight work finishes on the code it started with (`reload.ts:23,38`). That is much harder than
swapping a module and is why state cells are declared with a schema and a stable identity across
reloads (`object.ts:156-200`).

### 2. Concepts

| Concept | What it is | Where |
| --- | --- | --- |
| Host | the process that serves contracts and owns objects/rooms of code | `host.ts:192,251,255` |
| Facet / plugin | a plugin deployed as one facet per host kind, loaded by `defineFacet`, addressed by `PluginRef` | `host.ts:84,96,105` |
| Contract | TypeBox-validated object type + address input + members; `remote` or `local` | `contract.ts:166,171,219,254` |
| Member | `method(args?, result?)` or `opaque(id)`; `hostNamed`/`hostFamily` set placement | `contract.ts:31-34,39,44,64` |
| Object / factory | instance = state + code at an address; lifetime `referenced` or `host` | `object.ts:48,76,79` |
| Reference / principal | proxied handle; principal selects variant and method visibility | `object.ts:564,760`, `host.ts:170-175` |
| Declarations | `state`, `derive`, `resource`, `on`, `task`, `get`, `register`, `expose` on the factory's `self` | `object.ts:156-200` |
| Replicated state | standalone observable JSON with atomic revisions and ops-based deltas, independent of hosts | `state.ts:14,404-413` |
| Delta | transactional tracker, structural diff, immutable apply, wire codec | `delta/README.md:1` |
| Registry | plugin-shared typed tables | `registry.ts:3,11` |
| Link / wire | one `Link` interface with memory, Node IPC, WebSocket transports; versioned protocol | `link.ts:5,272,339,414`, `wire.ts:24` |
| Reload | procedure + options + report; old code drains, new code serves | `reload.ts:23,38,177` |

### 3. The export map tells you the two generations apart

Eleven subpaths (`package.json:9-64`), and the split is not cosmetic:

| Subpath | Contents | Status |
| --- | --- | --- |
| `.` | contracts, objects, hosts, links, registry, reload, state, watch, wire | settled v1 |
| `./context` | `Context` with `abortSignal` + `TelemetrySpan` | stable |
| `./delta` | transactional delta engine | stable |
| `./output` | output helpers | stable |
| `./node` | child host processes: `createHostManager`, `forkDriver`, `childControl`, `processLock`, `nodeLoader` | stable |
| `./sqlite`, `./sqlite/node`, `./sqlite/cloudflare` | portable schema/migration helpers + Node and DO drivers | stable |
| `./telemetry-sqlite` | SQLite-backed `TelemetryStore` on pi-telemetry contracts | stable |
| `./next` | documents, store, host/link/jobs — the experimental v2 | **experimental** |

The root barrel re-exports with `sideEffects: false` (`src/index.ts:1-91`, `package.json:61`), so a
bundler can drop what an embedder does not use — which is how `pi-durable` gets away with importing
narrow subpaths.

### 4. How `pi-durable` actually uses chord

| Durable concern | Chord piece | Note |
| --- | --- | --- |
| Atomic session transactions | `track`, `PendingOps`, `Prepared`, `Tracker`, `Change` from `chord/delta` | the commit machinery is chord's, not durable's (`session/transaction.ts:3,681,712`) |
| Document watches during a run | `Watch` | durable builds the watch directly (`session/session.ts:1441,1453-1458`) |
| Storage engine | `ChordStore`, `StoreOwnerTables`, table definitions, commit and document read/write from `chord/next` | the one `chord/next` surface in use (`storage/store/storage.ts:5-13`, `tables.ts:7`, `commit.ts:7-21`) |
| SQLite portability | `chord/sqlite` schema helpers, `chord/sqlite/node`, `chord/sqlite/cloudflare` | one storage design, two drivers (`storage/sqlite/schema.ts:1`, `node.ts:2`, `cloudflare.ts:1`) |
| Task graph / scheduler | `Watch`, `applyImmutable`, `ownedSlice`, `withTelemetry`, `awaitWithContext` | `harness/task-graph.ts:139,269`, `harness/scheduler.ts:555,1745` |
| Public API | re-exported watch types | `durable/src/index.ts:1` |
| Telemetry | `Context` carries a `TelemetrySpan` defaulting to pi-telemetry's no-op span | `context/index.ts:1,13-15` |

**What durable does not use:** the distributed runtime. No `createHost`, `createHostManager`,
`ipcLink`, `webSocketLink`, `memoryLinkPair`, `defineFacet`, `defineRegistry`,
`replicatedState`, or `chord/next/host|link|jobs` imports appear in `packages/durable/src`. The one
other consumer in the monorepo, `pi-env`, imports nothing but the `Context` type
(`packages/env/src/watch.ts:1`, `list-files.ts:1`, `remote-env.ts:5`).

### 5. What Chord is not

| Guess | Reality |
| --- | --- |
| "Pi's plugin system" | that is the coding agent's jiti-loaded `ExtensionAPI` modules; chord's facets belong to chord hosts |
| "Pi's document database" | v1 has no documents; `pi-durable`'s documents are durable's own type over chord's `JsonValue`/`Op`, persisted by the `chord/next` store |
| "A sandbox" | no process or capability isolation; it moves calls between processes, it does not confine them |
| "Required by the coding agent" | `pi-coding-agent` has no chord dependency |
| "Stable API end to end" | `chord/next` is flagged experimental in-package (`src/next/index.ts:1-2`) and `pi-durable` depends on it for storage |

### 6. Why pi-durable sits on chord rather than rolling its own

Two of pi-durable's guarantees are exactly chord's primitives:

1. **Commit-before-visible transactions.** The effect sandwich needs a tracker that stages ops, validates
   them against immutable state, and applies them atomically — `chord/delta` already is that engine.
2. **One storage, several processes.** Chord's `Context` (abort signal + telemetry span), `Watch`, and
   portable SQLite drivers let the same durable storage run under Node and inside a Durable Object
   without a second implementation. That is what makes the Cloudflare `PiHarness` a wiring exercise
   rather than a rewrite — see
   [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md).

## Gotchas

- **Name the version when you cite chord behaviour.** The package ships v1 and `chord/next` together;
  "chord has documents" is true of `next` and false of the root export.
- **Chord is not a product surface.** Nothing in the coding agent exposes it; a user asking "what is
  chord" is usually one hop away from `pi-durable`'s storage.
- **Lockstep versions.** Chord is released with the pi family at the same version as
  `pi-coding-agent` and `pi-durable` (1.4.0 here), so mixing versions is unsupported.
- **`chord/next` is a moving target** — `pi-durable` marks the whole package experimental for this
  reason.

## Open questions

- Is `@earendil-works/chord` 1.4.0 actually published to npm (a 1.2.0 release is indexed)? Probe:
  `npm view @earendil-works/chord version`.
- How much of `chord/next` beyond the store (`OwnerTable`, query types, jobs) does `pi-durable`
  reach transitively? The import trace was cut at the search limit, not at a boundary.

## Related

- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — where chord sits in
  the eleven-package graph.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
  — the harness that runs on this storage.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — why the durable stack is
  a separate product.

- [Pi Durable — Production Readiness Assessment](./pi-durable-production-readiness.md) — the release/API churn, migration and rollback risks, what the tests do and do not prove, and the go/no-go gates.
## Changelog

- 2026-10-29 — created, answering "what is pi chord". Evidence: scout read of `earendil-works/pi`
  @ `babe30a7e6c1` (path:line anchors throughout), the chord README/guide, and npm listings.
