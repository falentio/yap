---
title: oRPC Contract-First — Declaring an SSE / Streaming Procedure in a Contract
category: technology
tags: [orpc, contract-first, sse, event-stream, async-iterator, subscriptions, rpc, typescript, openapi]
status: complete
created: 2026-11-14
updated: 2026-11-14
sources:
  - https://orpc.dev/docs/contract-first
  - https://orpc.dev/docs/procedure
  - https://orpc.dev/docs/async-iterator-object
  - https://orpc.dev/docs/helpers/publisher
  - https://orpc.dev/docs/openapi/specification
  - https://orpc.dev/llms.txt
  - https://v1.orpc.dev/docs/event-iterator
  - https://v1.orpc.dev/docs/client/event-iterator
  - https://v1.orpc.dev/docs/contract-first/implement-contract.md
  - https://v1.orpc.dev/docs/contract-first/router-to-contract.md
  - https://v1.orpc.dev/llms.txt
  - https://v1.orpc.dev/docs/adapters/websocket.md
  - https://orpc.dev/docs/integrations/durable-iterator
confidence: high
---

# oRPC Contract-First — Declaring an SSE / Streaming Procedure in a Contract

## TL;DR

- A stream **is** a contract: there is no `.subscribe()` builder method. The contract's
  `.output` carries `eventIterator(yieldSchema, returnSchema?)` (v1) /
  `asyncIteratorObject(...)` (v2, with `eventIterator` kept as an alias), and the
  implementation must then be an async generator yielding and returning those shapes.
  ([v1 docs](https://v1.orpc.dev/docs/event-iterator)) ([v2 docs](https://orpc.dev/docs/async-iterator-object))
- The contract type is the enforcement: the handler's return type becomes
  `AsyncIteratorObject<TYield, TReturn>`, so a wrong yield shape, a wrong `return` value, and
  a non-generator handler are all compile errors. Proven below — three deliberate mistakes,
  three `TS2345`/`TS2322`.
- The transport is `text/event-stream` with three event kinds: `message` (a yield),
  `done` (the return value), `error` (a thrown `ORPCError`). `id`/`retry` come from
  `withEventMeta`, and the client's `last-event-id` header arrives as `lastEventId`.
- The payload is **not** the `data` field. It is the RPC envelope `{"json":<payload>}`, so a
  plain `EventSource` parses the frame and still needs unwrapping, and a contract with an
  input **fails a bare `EventSource` GET** with HTTP 400 — the OpenAPI handler is the way to
  get a GET + query-string stream that `EventSource` can use.

## Context

`qr` implements its API contract-first with `@orpc/contract` 1.15.0
(`qr/src/orpc-contract/resource/*.ts`, `oc.input(...).output(...)`), and the question was how a
procedure that streams — server-sent events, a subscription, a live feed — is declared in that
contract without dropping out of the contract, and without the client and server being written
against server code.

oRPC has no subscription primitive separate from a normal procedure. A streaming procedure is a
procedure whose output is an async iterable, which means the contract's whole job is to pin that
iterable's element type. This file records the shape, the parts that are validated, what reaches
the wire, and where the wire differs from SSE as `EventSource` expects it.

### Versions

| Fact | Value | Source |
|---|---|---|
| Installed in `qr` | `@orpc/contract` 1.15.0 | `qr/package.json` |
| `latest` (2026-11-06) | 1.16.2 | `npm view @orpc/contract dist-tags` |
| `beta` (2026-11-09) | 2.0.0-beta.50 | same |
| Contract-side builder | `eventIterator` (v1) → `asyncIteratorObject`, `eventIterator` aliased | `@orpc/contract` 1.15.0 / 2.0.0-beta.50 `dist/*.d.ts` |
| Publisher package | `@orpc/publisher`, `latest` 1.14.11 — one minor behind the core packages | `npm view @orpc/publisher dist-tags` |

## Findings

### 1. The stream lives in `.output`, between two schemas

`eventIterator` wraps the **yield** schema and optionally the **return** schema:

```ts
declare function eventIterator<TYieldIn, TYieldOut, TReturnIn = unknown, TReturnOut = unknown>(
  yields: Schema<TYieldIn, TYieldOut>,
  returns?: Schema<TReturnIn, TReturnOut>,
): Schema<AsyncIteratorObject<TYieldIn, TReturnIn, void>, AsyncIteratorClass<TYieldOut, TReturnOut, void>>
```
— `@orpc/contract@1.15.0/dist/index.d.ts:309`

The input side of that `Schema` is `AsyncIteratorObject` (what a handler must return), the
output side is `AsyncIteratorClass` (what a client receives). Marking a procedure as a stream
therefore costs nothing beyond wrapping the output schema, and any consumer that knows the
marshalling — `getEventIteratorSchemaDetails(schema)` returns
`{ yields, returns? }` — reads the same contract. v2 renames the helper to
`asyncIteratorObject` and keeps `eventIterator` as an alias: `asyncIteratorObject as eventIterator`
in `@orpc/contract@2.0.0-beta.50/dist/index.d.ts`.

In v2 the schema helper is collected per-procedure with
`getAsyncIteratorObjectSchemasDetails(schemas: readonly AnySchema[])`
returning `{ yieldSchemas, returnSchemas }`, which suggests an additive model. In practice **a
second `.output` call replaces the stream schema and silently un-streams the procedure** (probed,
both versions): `oc.output(eventIterator(Tick)).output(z.object({...}).passthrough())` stores one
output schema, `getEventIteratorSchemaDetails` returns `undefined`, and the generator is served as
`200 application/json` with body `{"json":{}}` instead of SSE — no error, no warning. One `.output`
per stream procedure, with the `eventIterator` call inside it, is the rule that holds. Contract
composition in `qr` lives in `qr/src/orpc-contract/resource/`.

### 2. Contract, implementation, client — what each piece contributes

| Piece | Code | What it fixes |
|---|---|---|
| Contract | `oc.input(...).output(eventIterator(Yield, Return?)).errors({...})` | Input, yield shape, return shape, the error map |
| Implementer | `const os = implement(contract)` | Turns each contract into a stubbable procedure builder |
| Handler | `os.ticker.handler(async function* ({ input, signal, lastEventId }) { ... })` | The generator; type-checked against the contract |
| Router | `os.router({ ... })` | Whole-router enforcement — omitting a contract procedure is a type error |
| Client | `ContractRouterClient<typeof contract>` | `await client.ticker(input, { signal })` → `AsyncIterator` of yields |

### 3. Full example (v1.15.0, type-checks clean)

```ts
// contract.ts — no logic, no server imports
import { oc, eventIterator } from '@orpc/contract'
import { z } from 'zod'

const Tick = z.object({ at: z.number(), n: z.number() })

export const chatContract = {
  send: oc.input(z.object({ text: z.string() })).output(z.object({ id: z.string() })),
  ticker: oc.input(z.object({ room: z.string() })).output(eventIterator(Tick)),
  job: oc
    .input(z.object({ id: z.string() }))
    .output(eventIterator(Tick, z.object({ ok: z.boolean() }))),
}

// server.ts
import { implement } from '@orpc/server'
const os = implement(chatContract)

export const ticker = os.ticker.handler(async function* ({ input, signal, lastEventId }) {
  if (lastEventId) { /* resume from here */ }
  let n = 0
  try {
    while (!signal?.aborted) {
      yield { at: Date.now(), n: ++n }
      await new Promise((r) => setTimeout(r, 1000))
    }
  } finally { /* release the subscription */ }
})

export const job = os.job.handler(async function* () {
  yield { at: 1, n: 1 }
  return { ok: true }
})

export const router = os.router({ send, ticker, job })
```

The `.errors({ ... })` map from the contract manufactures the constructors a handler throws with:
`throw errors.CONFLICT({ message: 'already running' })` arrives at the client as an
`ORPCError` with `code: 'CONFLICT'`, `status: 409`, and `message` intact (probed, §6).

### 4. The contract is what enforces the stream

Three deliberate mistakes against the contract above, all caught at `tsc` (TypeScript 5.9.3,
`strict`):

| Mistake | Error |
|---|---|
| `yield { at: 'not-a-number', n: 1 }` | `TS2345` — `AsyncGenerator<{at: string…}>` not assignable to `AsyncIteratorObject<{at: number…}>` |
| `return { ok: 'nope' }` on the `job` contract | `TS2345` — `IteratorReturnResult<{ok: string}>` vs `{ok: boolean}` |
| Plain `handler(({ input }) => ({...}))`, no generator | `TS2322` — not assignable to `Promisable<AsyncIteratorObject<…>>` |

Runtime validation is separate and still on: a yield that violates the schema while TypeScript
says fine (schema/type drift) reaches the client as
`ORPCError` `EVENT_ITERATOR_VALIDATION_FAILED`, one frame after the valid yields (probed, §6).

If you want the shape enforced with no runtime validation, the contract still needs a stream
type. `type<AsyncIteratorObject<Ev, void>, AsyncIteratorObject<Ev, void>>()` keeps the generator
constraint and drops the schema: a wrong yield still fails `tsc`, and an invalid value passes
through to the client unvalidated (both probed). `AsyncIteratorObject<T, TReturn, TNext>` is a
TypeScript global lib type since 5.6 — no import needed. An empty `type()` (no arguments) also
accepts a generator and accepts anything inside it.

### 5. What actually reaches the wire

Raw request against an `RPCHandler` (no client), `POST /rpc/ticker`, `withEventMeta({ n }, { id, retry })`:

```text
: 


event: message
retry: 5000
id: 1
data: {"json":{"n":1,"room":"a"}}


event: message
retry: 5000
id: 2
data: {"json":{"n":2,"room":"a"}}


```

with `last-event-id: 41` on the next request:

```text
event: message
retry: 5000
id: 42
data: {"json":{"n":42,"room":"b"}}


```

and the handler received `lastEventId` as the string `"41"` (probe printed
`handler saw lastEventId: [null,"41"]`).

| Observation | Detail |
|---|---|
| Response status | `200` with `content-type: text/event-stream`, even for an immediately-thrown generator |
| Preamble | A bare `:` comment frame first, on every stream |
| Yields | `event: message` |
| Completion | `event: done`, `data: {"json":<return>}` |
| Failure | `event: error`, `data: {"json":{"defined":…,"code":…,"status":…,"message":…,"data":…}}` |
| `id` / `retry` | Only from `withEventMeta`; absent otherwise |
| Resume | `last-event-id` request header → `lastEventId` handler arg |
| Cancel | `signal.aborted === true` inside the generator's `finally` |

Two consequences worth designing around:

1. **`data` is an envelope.** `{"json":…}` (a `data` frame per the RPC protocol, not the raw
   payload) means a consumer that is not the oRPC client must unwrap `.data` → JSON → payload.
   An `EventSource` bound to this endpoint gets the right frames and the wrong value.
2. **A contract with an input rejects a bare GET.** `GET /rpc/ticker?room=abc` on an
   `RPCHandler` returns **HTTP 400** `Input validation failed`; `?json=` and `?data=` query
   encodings both also fail. The RPC handler expects the `POST` + JSON body, which `EventSource`
   cannot send.

### 6. Client surface

```ts
const it = await client.ticker({ room: 'a' })       // AsyncIterator<Tick>
for await (const ev of it) { const n: number = ev.n }
```

- Stopping: `controller.abort()` or `await it.return()` — both run the server-side `finally`.
- Errors arrive as `ORPCError` instances with the contract's `code`/`status`; a mid-stream
  throw yields the preceding events first, then throws (`failLate threw -> ORPCError NOT_FOUND 404`).
- The return value is only reachable through `consumeEventIterator`'s `onSuccess`, not through
  `for await`:

```ts
consumeEventIterator(client.job({ id: 'y' }), {
  onEvent: (e) => { /* yields */ },
  onSuccess: (v) => { const ok: boolean = v.ok },   // the generator's return value
  onError: (e) => {},
  onFinish: (s) => {},
})
```

`for await` discards the return value, so a stream whose completion carries data (a total, a
final cursor) has to be consumed with `consumeEventIterator` or read manually.

### 7. Getting a GET the browser's `EventSource` can use

`OpenAPIHandler` is the adapter that emits a real GET stream. Contract route metadata plus the
same `eventIterator` output:

```ts
ticker: oc
  .route({ method: 'GET', path: '/ticker' })
  .input(z.object({ room: z.string() }))
  .output(eventIterator(Tick, z.object({ total: z.number() })))
```

`GET /api/ticker?room=abc` with `last-event-id: 9` gave `200 text/event-stream`, and the
handler received `input: {room:"abc"}` and `lastEventId: "9"`. Plain query-string binding, so
`new EventSource('/api/ticker?room=abc')` reaches the procedure; the `data`-envelope caveat from
§5 still applies to the parsing.

`OpenAPIGenerator` documents the same stream shape in the spec — `text/event-stream` content
whose schema is a `oneOf` of `event: "message"`, `"done"`, and `"error"` variants — so a
generated client sees three frame kinds instead of an opaque string
(`@orpc/openapi@1.15.0/dist/shared/openapi.BwdtJjDu.mjs:294`, source
[`orpc.dev/docs/openapi/specification`](https://orpc.dev/docs/openapi/specification)).

### 8. Resume needs ids and a publisher; SSE alone gives neither

The SSE reconnect contract is `lastEventId`, but the server only resumes if it has the events.
Two levels:

| Level | API | Resume |
|---|---|---|
| Hand-rolled | `withEventMeta(ev, { id })` + your own replay buffer keyed by that id | You own ids, buffer, and TTL |
| `@orpc/publisher` | `publisher.subscribe(event, { signal, lastEventId })` in the handler, `publisher.publish(event, payload)` in a mutation | Adapter-owned; `resume: { ttl }` (default 300 000 ms), off by default |

Adapters: `MemoryPublisher`, `RedisPublisher`, `UpstashPublisher`, `BunRedisPublisher`,
`DurablePublisher` (Durable Objects) — all with resume support
([publisher docs](https://orpc.dev/docs/helpers/publisher)). `@orpc/publisher` `latest` is
1.14.11 while `@orpc/contract` is 1.16.2, so the publisher minor lags the core line.

Resume correctness is on the event key: two different rooms publishing to one event name with a
per-connection counter will hand back the wrong event for a `lastEventId`. Either key the event by
the subscription (`room:${id}`) or put the room in the payload and filter after resume.

### 9. Failure modes, ranked by how quietly they pass

| Failure | What the caller sees |
|---|---|
| Throw before the first yield | `200 text/event-stream`, one `event: error` frame — **no error status** |
| Throw after yields | The good frames, then `event: error` with the `ORPCError` JSON |
| Contract `.errors` used | `defined: true`, the mapped `code`/`status` — the client throws `ORPCError` |
| Unmapped throw | `defined: false`, `INTERNAL_SERVER_ERROR`, `500`, and the message is masked to `"Internal server error"` |
| Invalid yield vs schema | `EVENT_ITERATOR_VALIDATION_FAILED` after the valid frames |
| Second `.output` without `eventIterator` | The procedure stops being a stream: `200 application/json` with the plain return, no warning |
| Consumer never stops | Generator runs until `signal` aborts; nothing times out it out for you |

The pre-first-yield case is the one that breaks HTTP-shaped error handling: middleware or a proxy
that switches on status will see `200` for a stream that failed. The handler must `throw` a
mapped error, and the consumer must read the `error` frame (the oRPC client does).

### 10. Hardening checklist

- Contract: an explicit `eventIterator`/fixed-`type` output, so a non-generator implementation and
  a wrong yield both fail the build.
- Handler: `try/finally` and `signal.throwIfAborted()` (or `signal?.aborted`) in the loop —
  the generator body is the only place cleanup runs.
- Errors: `.errors()` on the contract and `errors.X()` in the handler; never a bare `throw new Error`.
- Completion: carry it in the return schema and consume via `onSuccess`.
- Resume: stable, subscription-scoped event ids, a TTL longer than the reconnect window, and a
  publisher chosen for whether the process can die between frames.
- Ids in the URL: with `EventSource`, auth rides on cookies or the query string — the header set
  that `RPCLink` can send is not available.

## Open Questions

- Whether `EventSource`-only consumers can be given the unwrapped payload — the `data`-envelope
  shape looks reachable from a custom `RPCHandler` serializer or an `RPCLink` interceptor, not probed.
- Whether `.output` can be made additive for streams at all: v2 exposes a plural
  `getAsyncIteratorObjectSchemasDetails(schemas[])` but stored one schema in the probe, so the plural
  path may only be reachable through `implement`-side composition rather than the contract builder.
- `@orpc/publisher` back-pressure: `subscribe` returns a queue; unbounded growth on a slow consumer
  is untested here.
- Bidirectional needs the WebSocket adapter — how a contract renders over it
  ([`/docs/adapters/websocket`](https://v1.orpc.dev/docs/adapters/websocket)).

## Reproduction

Both probes ran in a scratch dir against exactly the pinned versions; `strict` tsconfig,
`noEmit`, TypeScript 5.9.3.

- Type errors (§4): install `@orpc/contract@1.15.0 @orpc/server@1.15.0 zod@3 typescript@5`, paste
  the §3 contract plus one mistake, run `tsc`.
- Wire (§5–§7): `RPCHandler`/`OpenAPIHandler` over `node:http`, `fetch` with
  `accept: text/event-stream` and `last-event-id`, read one chunk, `ac.abort()`, assert
  `signal.aborted` in the generator's `finally`.

## Related

- [Effect v4 @effect/rpc](./effect-v4-rpc.md) — the other streaming-RPC design in this repo's orbit: schema-typed streams on `RpcGroup`, useful as the contrast to contract-first SSE.
- [OpenMausBot Architecture](./openmausbot-architecture.md) — SSE as the one-way state channel into a React reducer, with the delta-into-an-ordered-log pattern.
- [pi-durable-production-readiness](./pi-durable-production-readiness.md) — the durable-stream side: resume, replay, and what an event stream owes an operator.

## Changelog

- 2026-11-14 — created. v1.15.0 and v2.0.0-beta.50 probed on the real request path; contract,
  wire, resume, and the `EventSource` gaps recorded with the failures reproduced.
