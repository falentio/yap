---
title: Effect v4 @effect/rpc — Deep Dive
category: technology
tags: [effect, effect-v4, rpc, typescript, schema, rpcgroup, rpcserver, rpcclient, serialization, middleware, streaming]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://effect.website/blog/releases/effect/40
  - https://effect.website/blog/releases/effect/40-beta
  - https://effect.website/blog/effect-v4beta-launch-to-may-recap
  - https://effect.website/blog/effect-v4beta-july-recap
  - https://effect.website/blog/effect-v4-rc-september-recap
  - https://effect.website/docs/v4/api/effect/rpc/Rpc
  - https://effect.website/docs/v4/api/effect/rpc/RpcGroup
  - https://effect.website/docs/v4/api/effect/rpc/RpcClient
  - https://effect.website/docs/v4/api/effect/rpc/RpcServer
  - https://effect.website/docs/v4/api/effect/rpc/RpcSchema
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcGroup.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcClient.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcSerialization.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcMiddleware.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcMessage.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcSchema.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcTest.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcWorker.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/reactivity/AtomRpc.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/MIGRATION.md
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/migration/v3-to-v4.md
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/CHANGELOG.md
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcServer.test.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcClient.test.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcSerialization.test.ts
confidence: high
---

# Effect v4 @effect/rpc — Deep Dive

Pinned revision: `Effect-TS/effect@ca068cef445101cbb2710c24360ca3a7ab9b94d5` (read 2026-10-08), i.e.
`effect@4.0.2` — the first stable `4.0.x` line. 4.0.1 shipped 2026-10-05 and 4.0.2 on 2026-10-08,
which the [First Week post](https://effect.website/blog/effect-4-first-week) dates "a week" after the
4.0.0 stable release ([Effect 4.0 announcement](https://effect.website/blog/releases/effect/40)).

## TL;DR

- **`@effect/rpc` no longer exists as a package.** Its modules were merged into core `effect`; you
  import from the `effect/rpc` barrel (or `effect/rpc/<Module>`). Everything under `effect/rpc` is
  tagged **`@stability unstable`**, so minor releases may break it even though 4.x is LTS.
- **The contract is now definition-first and schema-native.** A procedure is a value from
  `Rpc.make(tag, { payload, success, error, defect, stream, primaryKey })`; a `RpcGroup` collects
  them; handlers are built with `group.toHandlers` / `toLayer` / `toLayerHandler`; a `Protocol`
  service is the transport seam. There is no `Schema.TaggedRequest` class protocol anymore.
- **Transports are first-class and swappable**: HTTP POST, WebSocket, raw socket, stdio, and
  worker-runner, each as a `layerProtocol*`/`makeProtocol*` pair on both server and client, with
  matching `layerHttp` for the common HTTP/WS case.
- **Serialization became schema-aware** (`RpcSerialization.codecFor`) with JSON, NDJSON, JSON-RPC 2.0,
  ND-JSON-RPC and a compact **`SchemaBinary`** codec. **MessagePack was removed.**
- **The genuinely new v4 capabilities** are: **deferred responses** (a handler may return a
  `Deferred`), **server-originated requests and notifications**, **streaming responses with
  acknowledgement flow-control**, **`Rpc.custom`** output-schema transforms, **`RpcGroup.omit`**, and
  **`RpcMiddleware.Service`** with typed `provides`/`requires`/`clientError` metadata.
- **Adoption caveat:** it is production-grade in structure but explicitly **unstable API**. Treat it as
  "safe to build on, risky to freeze." Re-read the changelog on every minor bump.

## Context

Researched to answer *"what is the new @effect/rpc in Effect v4 and what is actually new?"* — a
practitioner's deep dive, not a marketing summary. It reconstructs the v4 RPC architecture from the
pinned source, records the API deltas against v3, and separates **new capability** from **new
packaging**. If you are porting an existing v3 RPC service, jump to the `## Migration: v3 → v4` section below.

## Findings

### 1. Packaging: the package is gone, the modules moved

`@effect/rpc`, `@effect/platform`, `@effect/cluster`, `@effect/ai`, `@effect/sql` and friends were
**merged into the core `effect` package** in v4; all ecosystem packages now share one version number
and release in lockstep ([40-beta blog](https://effect.website/blog/releases/effect/40-beta),
[MIGRATION.md](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/MIGRATION.md)).
The core package has **zero runtime dependencies** ([Effect 4.0](https://effect.website/blog/releases/effect/40)).

| Concern | v3 | v4 |
|---|---|---|
| Import path | `@effect/rpc` package | `effect/rpc` barrel, or `effect/rpc/<Module>` |
| Versioning | independent `@effect/rpc@0.x` | one version with `effect` (e.g. `4.0.2`) |
| Stability | separate package | modules tagged `@stability unstable` |
| Module set | 11 modules | 12 modules (`Rpc`, `RpcClient`, `RpcClientError`, `RpcGroup`, `RpcMessage`, `RpcMiddleware`, `RpcSchema`, `RpcSerialization`, `RpcServer`, `RpcTest`, `RpcWorker`, `Utils`) |

The barrel is auto-generated and re-exports each module as a namespace
([`rpc/index.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/index.ts)).
**`@stability unstable` means breaking changes are permitted in minor releases**; APIs without the tag
follow strict semver ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/MIGRATION.md)).
The team corrected an initial mistake where unstable modules shipped untagged, then re-tagged them a
week after 4.0.0 ([The First Week](https://effect.website/blog/effect-4-first-week)).

### 2. The core model: `Rpc` → `RpcGroup` → handlers → `Protocol`

A procedure is a **value**, carrying its contract independent of transport
([`Rpc.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts)):

```ts
import { Schema } from "effect"
import { Rpc } from "effect/rpc"

export const Echo = Rpc.make("Echo", {
  payload: { value: Schema.String },   // struct fields OR a Schema
  success: Schema.String,
  error: Schema.String,                // typed failures
  defect: Schema.Defect(),             // untyped defects (default)
})

export const Counts = Rpc.make("Counts", {
  payload: { to: Schema.Number },
  success: Schema.Number,
  stream: true,                        // wraps success/error in RpcSchema.Stream
})

export const GetUser = Rpc.make("GetUser", {
  payload: { id: Schema.String },
  success: User,
  primaryKey: ({ id }) => id,          // cluster dedup / entity routing
})
```

The `Rpc` interface is parameterised by **six** type variables — `Tag, Payload, Success, Error,
Middleware, Requires` — where `Requires` is the *service requirement* introduced by attached
middleware ([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts)).
Utility types derive everything from it: `Rpc.Payload`, `Rpc.Success`, `Rpc.Error`,
`Rpc.SuccessChunk`, `Rpc.Exit`, `Rpc.ServicesClient`, `Rpc.ServicesServer`, `Rpc.ToHandler`.

Notable `Rpc.make` behaviours ([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts)):

- `stream: true` sets `successSchema = RpcSchema.Stream(success, error)` and forces the *normal*
  `errorSchema` to `Schema.Never` — the stream error travels inside the stream schema.
- `primaryKey` turns the payload into a `Schema.Class` implementing `PrimaryKey` (used by cluster
  entities for dedup and routing; see `ClusterWorkflowEngine`).
- `Rpc.custom` builds a **custom constructor that transforms output schemas** — the documented example
  is a `makePaginated` wrapper that rewrites `success` into `{ offset, total, results }`.

`RpcGroup` collects procedures and derives server handler shapes
([`RpcGroup.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcGroup.ts)):

```ts
import { RpcGroup } from "effect/rpc"

export const Group = RpcGroup.make(Echo, Counts, GetUser)
  .middleware(CurrentUser)        // adds middleware to everything above this point
  .prefix("api.")                 // tag prefixes
  // .omit(...) / .merge(...) / .annotate(...) / .annotateRpcs(...)

const Handlers = Group.toLayer({
  Echo: ({ value }) => Effect.succeed(value + "!"),
  Counts: ({ to }) => Stream.range(1, to),
  GetUser: ({ id }) => getUser(id),
})
```

The v4 handler API is **definition-first** (`RpcGroup.toHandlers is definition first`, changelog
PR #2423): `toHandlers` returns a `Context`, `toLayer` a `Layer`, `toLayerHandler` a single-handler
`Layer`. `RpcGroup.omit` is a v4 addition ([Feb–May recap](https://effect.website/blog/effect-v4beta-launch-to-may-recap)).

### 3. Server side: one engine, pluggable protocols

`RpcServer` runs handlers against a `Protocol` service
([`RpcServer.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts)):

| Layer / constructor | Transport | Requires |
|---|---|---|
| `RpcServer.make` / `RpcServer.layer` | whatever `Protocol` is provided | `Protocol`, handlers, middleware, codec services |
| `RpcServer.layerHttp({ group, path, protocol })` | HTTP POST **or** WebSocket (WS is the default) | `RpcSerialization`, `HttpRouter`, handlers |
| `layerProtocolHttp` / `makeProtocolHttp` | HTTP POST, registers a `POST` route | `RpcSerialization`, `HttpRouter` |
| `layerProtocolWebsocket` / `makeProtocolWebsocket` | WebSocket, registers a `GET` upgrade route | `RpcSerialization`, `HttpRouter` |
| `layerProtocolSocketServer` | raw `SocketServer` | `RpcSerialization`, `SocketServer` |
| `layerProtocolStdio` | stdin/stdout (JSON/NDJSON) | `RpcSerialization`, `Stdio` |
| `layerProtocolWorkerRunner` | Web Worker | `WorkerRunnerPlatform` |
| `toHttpEffect` / `toHttpEffectWebsocket` | returns the request effect directly | `RpcSerialization` + handlers |

The `Protocol` service is the transport seam; v4 widened it with **`disconnects`**, **capability
flags** (`supportsAck`, `supportsTransferables`, `supportsSpanPropagation`, `supportsNotifications`)
and a **`codecFor`** hook so the serialization can fill the `unknown` holes of protocol messages
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts),
[migration map](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/migration/v3-to-v4.md)).

Server runtime behaviour worth knowing:

- **Concurrency control** — `concurrency` bounds in-flight handlers with a semaphore; `Rpc.fork`
  (a handler wrapper) escapes the semaphore for that call, and `Rpc.uninterruptible` runs a call in an
  uninterruptible region ([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts)).
- **Fatal defects** — a defect that is neither a typed failure nor an interrupt is sent as a
  connection-level `Defect` message unless `disableFatalDefects` is set.
- **Per-request tracing** — each request runs under a span named after the RPC tag (or
  `${spanPrefix}.${tag}`), with span kind `server` and OpenTelemetry attributes
  `rpc.system.name = "effect_rpc"`, `rpc.method = <tag>` ([tracing source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/internal/tracing.ts),
  [changelog #8867](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/CHANGELOG.md)).
- **HTTP response streaming** — framed serializations stream chunks with a bounded buffer
  (`streamBufferSize`, default 16) unless set to `"unbounded"`.
- **Request-fiber registration** happens *before* the handler runs, closing a cancellation race
  ([changelog](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/CHANGELOG.md)).

### 4. Client side: a generated object client keyed by full tag

`RpcClient.make(group)` returns an object with one method per RPC tag
([`RpcClient.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcClient.ts)):

```ts
const client = yield* RpcClient.make(Group).pipe(
  Effect.provide(
    RpcClient.layerProtocolHttp({ url: "http://localhost:3000/rpc" }).pipe(
      Layer.provide(RpcSerialization.layerNdjson),
      Layer.provide(HttpClient.layer),          // or NodeHttpClient.layer
    )
  )
)

const echoed = yield* client.Echo({ value: "hi" })          // Effect<string, string>
const stream = client.Counts({ to: 3 })                     // Stream<number, ...>
const queue  = yield* client.Counts({ to: 3 }, { asQueue: true }) // Queue.Dequeue
```

Client protocol layers mirror the server: `layerProtocolHttp` (needs `HttpClient`),
`layerProtocolSocket` (needs `Socket`), `layerProtocolWorker` (worker pool). Socket clients get
configurable `pingInterval`/`pingTimeout` (default 5s) and a `retryPolicy`
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcClient.ts)).

Client ergonomics added in v4:

| Feature | What it does |
|---|---|
| `flatten: true` | returns a **single function** `client(tag, payload, opts?)` instead of a tag-keyed object (`RpcClient.Flat`) |
| `asQueue: true` | streaming RPCs return a `Queue.Dequeue` instead of a `Stream` (replaces v3's `asMailbox`) |
| `discard: true` | fire-and-forget: send without awaiting the response |
| `headers` per call | merge request headers for one call |
| `RpcClient.withHeaders` / `CurrentHeaders` | scoped headers for a whole effect; now a `Context.Reference` (was a `FiberRef`) |
| `ConnectionHooks` | service with `onConnect`/`onDisconnect` effects for transport setup/teardown |
| full-tag property names | clients keep the full RPC tag as the property name; **prefix partitioning was removed** |
| `RpcClientError` | one error class wrapping `WorkerErrorReason \| SocketErrorReason \| HttpClientErrorSchema \| RpcClientDefect` |

### 5. Serialization: schema-aware, MessagePack removed

`RpcSerialization` is a service exposing `contentType`, `includesFraming` and a **`codecFor`** that
maps a `Schema.Top` to a codec — the mechanism that lets one wire format carry arbitrarily typed
payloads ([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcSerialization.ts)).

| Layer | Content type | Framing | Notes |
|---|---|---|---|
| `layerJson` | `application/json` | no | for transports that frame themselves |
| `layerNdjson` | `application/ndjson` | yes | newline-delimited; default for streaming HTTP |
| `layerJsonRpc` | `application/json` | no | JSON-RPC 2.0 envelopes |
| `layerNdJsonRpc` | `application/json-rpc` | yes | newline-delimited JSON-RPC 2.0 |
| `layerSchemaBinary` | binary | yes | compact **`SchemaBinary`**; 16 MiB default frame cap; optional payload fingerprints |

**MessagePack RPC serialization was removed**; the migration map routes `layerMsgPack` and friends to
`layerSchemaBinary` ([migration map](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/migration/v3-to-v4.md)).
Buffer-limit failures surface as `MaxBufferSizeExceeded`. Schema-aware RPC serialization landed during
the beta (PR #7390).

### 6. Middleware: typed provides/requires with a client half

`RpcMiddleware.Service` declares a middleware **service class** with explicit metadata
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcMiddleware.ts)):

```ts
class CurrentUser extends RpcMiddleware.Service<CurrentUser, {
  provides: User            // service provided to downstream handlers
  requires: Database        // services the middleware itself needs
  clientError: ClientFailure // client-only error type
}>()("CurrentUser", {
  error: AuthError,          // server-visible failure schema
  requiredForClient: true,   // generated clients must provide a client layer
}) {}

const ServerAuth = CurrentUser.layer(/* ... */)
const ClientAuth = RpcMiddleware.layerClient(CurrentUser, clientImpl)
```

- On the **server**, attached middleware wraps the handler effect, receiving
  `{ client, requestId, rpc, payload, headers }` and translating `provides` into `requires`.
- On the **client**, `layerClient` installs a wrapper that can inspect and modify the outgoing
  `Request` before calling `next`, and can carry a client-only error.
- Attaching middleware via `Rpc.middleware`/`RpcGroup.middleware` updates the RPC's `Requires`
  parameter, so missing services are a **compile-time** error.

### 7. Streaming, deferred responses, and server-originated messages (the new bits)

**Streaming.** `stream: true` makes the RPC's success a `Stream`. The server batches chunk writes and,
when the transport supports acks, gates each write behind a latch so a slow client applies
backpressure ([server source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts)).
The exit for a streaming RPC has a **void success** — elements arrive as `Chunk` messages and the
terminal `Exit` carries only failure. Chunk decode failures are isolated to the affected request and
interrupt it on the server without dropping the connection (changelog #8627).

**Deferred responses.** A handler may return `Effect<Deferred<Success, Error>>` instead of the value
directly. The server detects a `Deferred` on exit and installs an observer that emits the real `Exit`
when the deferred completes — so the *response* is produced out of band from the *handler* that
accepted it ([server source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts),
`ResultFrom` type in [`Rpc.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/Rpc.ts)).
Added during the beta ([Feb–May recap](https://effect.website/blog/effect-v4beta-launch-to-may-recap)).

**Server-originated requests and notifications.** `RpcMessage.FromServerEncoded` now includes
`RequestEncoded`, and `RequestEncoded.isNotification: true` marks a notification (no id, no
response). This lets a server push a request or a fire-and-forget notification to a client over a
persistent transport (changelog PR #7354; `supportsNotifications` capability flag). Buffered HTTP
transports **drop** notifications because they cannot carry a response stream.

**Keepalive.** Socket transports use `Ping`/`Pong` frames; any decoded server frame counts as
liveness, and a missed pong fails in-flight calls even when transient retries are enabled.

### 8. Testing, atoms, and worker integration

| Module | Purpose |
|---|---|
| `RpcTest.makeClient(group)` | in-memory client wired straight to the group's handlers over the no-serialization path — no HTTP/socket/worker needed |
| `RpcWorker` | `InitialMessage` service + `layerInitialMessage`/`initialMessage` to send one schema-encoded value to a worker before normal RPC |
| `AtomRpc` (`effect/reactivity`) | `Service()(id, { group, protocol })` exposes `query` (atoms / pull atoms for streams) and `mutation` (invalidate reactivity keys); supports `requiredForClient` middleware and serialization keys for hydration |

## Migration: v3 → v4

The migration map is exhaustive; the RPC-relevant deltas
([migration/v3-to-v4.md](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/migration/v3-to-v4.md)):

| v3 | v4 |
|---|---|
| `@effect/rpc` | `effect/rpc` (package merged into `effect`) |
| `Schema.TaggedRequest` / `Rpc.fromTaggedRequest` | **removed** — declare the contract with `Rpc.make(tag, {...})` |
| `RpcGroup` auto-converting TaggedRequest classes | `RpcGroup.make(...rpcs)` with explicit `Rpc.make` definitions |
| `Rpc.Context` | `Rpc.Services` / `Rpc.ServicesClient` / `Rpc.ServicesServer` |
| `RpcClient.RpcClient.Prefixes` / `NonPrefixed` | removed — full tag is the client property name |
| `asMailbox` | `asQueue` |
| `RpcClient.currentHeaders` (FiberRef) | `RpcClient.CurrentHeaders` (Context.Reference); use `RpcClient.withHeaders` |
| `RpcGroup.HandlerContext` / `HandlersContext` | `HandlerServices` / `HandlersServices` |
| `RpcMiddleware.Tag` | `RpcMiddleware.Service` (typed `provides`/`requires`/`error`/`clientError`/`requiredForClient`) |
| `RpcMiddleware.TagClass.Optional` | removed — model fallback inside the middleware effect |
| `RpcSerialization.layerMsgPack` / `msgPack` | `RpcSerialization.layerSchemaBinary` |
| `RpcServer.layerHttpRouter` | `RpcServer.layerHttp` |
| `RpcServer.layerProtocolHttpRouter` | `RpcServer.layerProtocolHttp` (one HttpRouter service, no router tag) |
| `RpcServer.toHttpApp` / `toHttpAppWebsocket` | `toHttpEffect` / `toHttpEffectWebsocket` |
| `RpcServer.toWebHandler` | `HttpRouter.toWebHandler(RpcServer.layerHttp(...).pipe(...))` |
| `RpcServer.fiberIdClientInterrupt` | `RpcSchema.ClientAbort` cause annotation |
| `RpcMessage.RequestId` (unbranded) | branded `string \| number` |
| `WorkerRunner.SerializedRunner` / `Worker.*Serialized` | typed `RpcGroup` + `RpcServer.layerProtocolWorkerRunner` / `RpcClient.layerProtocolWorker` |
| `RpcSchema.isStreamSerializable` | `RpcSchema.isStreamSchema(schema)` |

## A runnable shape

The tests are the best working reference; this mirrors
[`RpcSerialization.test.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcSerialization.test.ts)
and [`RpcServer.test.ts`](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/test/rpc/RpcServer.test.ts):

```ts
import { Effect, Layer, Schema, Stream } from "effect"
import { HttpClient } from "effect/http"
import { HttpRouter } from "effect/http"
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc"

// 1. Contract
class EchoError extends Schema.Error<EchoError>("EchoError")({
  _tag: Schema.tag("EchoError"),
  at: Schema.Number,
}) {}

const Rpcs = RpcGroup.make(
  Rpc.make("Echo", { payload: { value: Schema.String }, success: Schema.String }),
  Rpc.make("Counts", { payload: { to: Schema.Number }, success: Schema.Number, stream: true }),
  Rpc.make("Fail", { error: EchoError, success: Schema.String }),
)

// 2. Handlers (definition-first)
const Handlers = Rpcs.toLayer({
  Echo: ({ value }) => Effect.succeed(`${value}!`),
  Counts: ({ to }) => Stream.range(1, to),
  Fail: () => Effect.fail(new EchoError({ at: 1 })),
})

// 3. Server: HTTP POST protocol on /rpc
const Server = RpcServer.layerHttp({
  group: Rpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(Layer.provide(Handlers), Layer.provide(RpcSerialization.layerNdjson))

// Serve it with HttpRouter.serve(Server) on a platform server, or in tests:
// const { dispose, handler } = HttpRouter.toWebHandler(Server)

// 4. Client
const client = await Effect.runPromise(
  RpcClient.make(Rpcs).pipe(
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: "http://localhost:3000/rpc" }).pipe(
        Layer.provide(RpcSerialization.layerNdjson),
        Layer.provide(HttpClient.layer),
      ),
    ),
  ),
)

const echoed = await Effect.runPromise(client.Echo({ value: "hi" }))   // "hi!"
```

For tests, skip the transport entirely:

```ts
const client = yield* RpcTest.makeClient(Rpcs).pipe(Effect.provide(Handlers))
```

## Gotchas

- **Everything under `effect/rpc` is unstable.** A minor `effect` bump may break it; the changelog is
  the contract, not semver.
- **WebSocket is the default for `layerHttp`**; pass `protocol: "http"` explicitly for POST. Buffered
  HTTP transports cannot deliver server notifications.
- **Streaming HTTP responses are buffered by default (`streamBufferSize`, 16).** A producer that runs
  ahead of a slow reader is throttled — set `"unbounded"` only if you have measured the trade-off
  (a test asserts the default bounds production).
- **`stream: true` moves the error into the stream schema**; the RPC-level `error` becomes
  `Schema.Never`. Client code sees stream errors in the `Stream` channel, not the initial `Effect`.
- **Streaming exits have a void success.** Do not expect the terminal `Exit` to carry the last value.
- **MessagePack is gone.** Porting v3 configs means switching to `SchemaBinary` or NDJSON.
- **`primaryKey` is a cluster concern.** Outside cluster entities it only changes the payload into a
  class; it does not affect plain RPC dispatch.

## Open Questions

- The v4 RPC **guide** page is not published yet (only the API reference); the canonical worked
  examples currently live in the tests and `ai-docs/`. [unverified: whether a prose guide is planned]
- `Rpc.custom` is documented but used only in its own docstring in the pinned revision — its maturity
  for user-facing pagination/transform patterns is unproven. [unverified]
- Server-originated requests/notifications are supported by the protocol but buffered HTTP drops
  notifications; the exact set of transports that reliably deliver them at scale is untested here.
- No published benchmark of `SchemaBinary` vs NDJSON throughput for RPC in this revision. [unverified]

## Related

- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md) — unrelated
  topic; kept here only as the other `technology` entry.

## Changelog

- 2026-10-08 — created. Researched via TinyFish (`mcp__tinyfish__search` / `mcp__tinyfish__fetch_content`)
  plus a shallow clone of `Effect-TS/effect` pinned at `ca068cef` (`effect@4.0.2`). Primary evidence is
  the pinned source and the official v4 blog/API docs.
