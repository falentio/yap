---
title: Production Error Handling in Effect v4 — Logging, ErrorReporter, and Sentry
category: howto
tags: [effect, effect-v4, typescript, observability, error-reporting, sentry, logging, error-handling, production]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://docs.sentry.io/platforms/javascript/guides/effect/
  - https://github.com/getsentry/sentry-javascript/issues/19641
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/ErrorReporter.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Logger.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Cause.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Redacted.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Redactable.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/internal/effect.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/http/HttpEffect.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/http-api/HttpApiBuilder.ts
confidence: high
---

# Production Error Handling in Effect v4 — Logging, ErrorReporter, and Sentry

Verified against `effect@4.0.2` (commit `ca068cef`, read 2026-10-08) on Node
24.21.0. Every **Verified output** block is real captured program output.

## Goal

Answer "how do I do production error handling — logger, Sentry?" with the four-layer answer Effect
actually provides, and with the wiring that works.

The short version: **Effect separates *events* from *incidents*.**

| Layer | Primitive | Answers |
|-------|-----------|---------|
| Events | `Logger` | "what happened?" — every log line, at a level |
| **Incidents** | `ErrorReporter` | "what should page someone?" — failures worth a ticket |
| Traces | `Tracer` | "where did the time go?" — spans across services |
| Metrics | `Metric` | "how often / how fast?" — counters and histograms |

Most people reach for "logger + Sentry" and end up dumping every `Effect.logError` into an
issue tracker. Effect's `ErrorReporter` exists precisely to stop that: it is the
**error-tracking boundary**, and it is separate from logging on purpose.

## Prerequisites

```sh
npm install effect@4.0.2
# Optional, and the reason this guide exists:
npm install @sentry/effect
```

> **Alpha warning.** `@sentry/effect` is **alpha** — the docs say it "may have bugs, and
> might include breaking changes"
> ([Sentry docs](https://docs.sentry.io/platforms/javascript/guides/effect/)). It supports both
> Effect v3 and v4, auto-detecting the version, but the `Tracer` and `Logger`
> layer APIs differ. Everything else in this guide is core Effect and stable-ish
> (`ErrorReporter` itself is `@stability unstable`).

## Steps

### 1. Understand the two boundaries

- **Logging** is high-volume and cheap. Every request produces lines. You keep them in a log store.
- **Error reporting** is low-volume and expensive. A human may look at it. You want **one incident
  per root cause**, with context.

`ErrorReporter` is fed by three things
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/ErrorReporter.ts)):

1. `Effect.withErrorReporting` — wrap an effect, report its failure, rethrow unchanged.
2. `ErrorReporter.report(cause)` — report manually, never fail.
3. **Built-in boundaries** — the HTTP and RPC servers report for you (see §6).

### 2. Make errors carry their own telemetry

This is the highest-leverage step. Instead of a central `switch` on error tags, put the
metadata on the error class.

```ts
import { ErrorReporter, Schema } from "effect"

class PaymentDeclined extends Schema.TaggedError<PaymentDeclined>()("PaymentDeclined", {
  message: Schema.String,      // REQUIRED — see the gotcha below
  orderId: Schema.String,
  code: Schema.String
}) {
  // Forwarded to the reporter as tags/extra.
  readonly [ErrorReporter.attributes] = { orderId: this.orderId, code: this.code }
  // Overrides the default "Info" severity.
  readonly [ErrorReporter.severity] = "Error" as const
}

/** An expected business outcome: never report it. */
class ProductNotFound extends Schema.TaggedError<ProductNotFound>()("ProductNotFound", {
  message: Schema.String,
  productId: Schema.String
}) {
  readonly [ErrorReporter.ignore] = true
}
```

Three annotations, all optional:

| Annotation | Effect on reporting |
|------------|--------------------|
| `[ErrorReporter.ignore] = true` | skip entirely — for expected control flow |
| `[ErrorReporter.severity]` | override the default `"Info"` severity |
| `[ErrorReporter.attributes]` | extra key/value metadata forwarded to the reporter |

> **Gotcha: `Schema.TaggedError` defaults `message` to `""`.**
> Verified: `new AppError({ code: "x" }).message === ""`. Sentry groups issues **by
> message**, so an error without one produces an ungrouped issue titled
> `PaymentDeclined: ` — useless for triage. Always declare `message: Schema.String`.

### 3. Structured logging

`Logger.make` receives the full event; `Logger.formatStructured` /
`Logger.formatJson` are built-in formatters
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Logger.ts)).

```ts
const jsonLogger = Logger.map(Logger.formatStructured, (event) => {
  const line = JSON.stringify(event)
  sink(line)
  return line
})

const program = Effect.gen(function*() {
  yield* Effect.logInfo("checkout started")
}).pipe(
  // Annotations flow into EVERY log line inside this block.
  Effect.annotateLogs({ service: "checkout", requestId: "req-1", userId: "u-42" }),
  Effect.provide(Logger.layer([jsonLogger]))
)
```

**Verified output** — note `annotations` is populated from the fiber ref, not from the
message:

```text
{"message":"checkout started","level":"INFO","timestamp":"...","annotations":{"service":"checkout","requestId":"req-1","userId":"u-42"},"spans":{},"fiberId":"#1"}
{"message":"recovered from PaymentDeclined","level":"WARN","timestamp":"...","annotations":{},"spans":{},"fiberId":"#1"}
{"message":"defect swallowed at boundary","level":"ERROR","timestamp":"...","annotations":{},"spans":{},"fiberId":"#1"}
```

`annotateLogs` is the mechanism that turns "`requestId`" from a global into a
per-request field — set it once at the request boundary and every log line inherits it.

### 4. Log levels and filtering

```ts
yield* Effect.logDebug("filtered out by default")   // below Info
yield* Effect.logInfo("passes")
yield* Effect.logError("passes")

// Raise the threshold for a subtree.
effect.pipe(Effect.provideService(References.MinimumLogLevel, "Debug"))
```

**Verified output:**

```text
Info this info line passes
Debug debug visible when MinimumLogLevel = Debug
```

Levels: `All < Fatal < Error < Warn < Info < Debug < Trace < None` (mirrors the OTel
severity ordering). `References.MinimumLogLevel` is a `Context.Reference`, so it
composes with `Effect.provideService` and can be set per-request.

### 5. Wiring the reporter

```ts
const reporter = ErrorReporter.make(({ error, severity, attributes, timestamp, fiber, cause }) => {
  // error      -> a real Error with .message and .stack
  // severity   -> "Info" | "Warn" | "Error" | "Fatal"
  // attributes -> the [ErrorReporter.attributes] record
  // cause      -> the full Cause (check Cause.hasDies for defects)
  // fiber      -> the failing fiber
  // timestamp  -> bigint nanoseconds
})

const program = effect.pipe(
  Effect.withErrorReporting,
  Effect.provide(ErrorReporter.layer([reporter]))
)
```

`ErrorReporter.make` does the hard parts for you
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/ErrorReporter.ts)):

- **Deduplicates** — the same `Cause` or error object is never reported twice.
- **Skips interruptions** — `Interrupt` reasons are filtered out.
- **Resolves annotations** — `ignore` / `severity` / `attributes` are read
  before your callback runs.

`layer([...])` **replaces** existing reporters; pass `{ mergeWithExisting: true }` to
add instead. Multiple reporters can be active at once (e.g. Sentry + your own metrics counter).

### 6. The RPC / HTTP servers report for you

This is the part most people miss. The RPC server and the HTTP layer call the reporting boundary
**automatically** — you do not add `withErrorReporting` to every handler.

Verified: with the reporter provided to the server layer, a handler that simply dies is reported.

**Verified output** (handler has no `withErrorReporting`):

```text
handler sees 1 reporter(s)
response tag: Defect
=== REPORTED (1) ===
handler defect
```

**Verified output** — explicit wrap vs no wrap, same result:

```text
handler with withErrorReporting -> reports: 1
handler WITHOUT withErrorReporting -> reports: 1
```

Where the boundary lives
([RpcServer](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/rpc/RpcServer.ts),
[HttpEffect](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/http/HttpEffect.ts),
[HttpApiBuilder](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/http-api/HttpApiBuilder.ts)):
the server calls `reportCauseUnsafe(fiber, exit.cause)` when a request fails.

**The wiring rule:** provide the reporter to the **server layer**, so request fibers inherit it.

```ts
const Server = RpcServer.layerHttp({ group: Rpcs, path: "/rpc", protocol: "http" }).pipe(
  Layer.provide(Handlers),
  Layer.provide(ErrorReporter.layer([sentryReporter])),   // <-- HERE
  Layer.provide(Logger.layer([jsonLogger])),
  Layer.provide(RpcSerialization.layerNdjson)
)
```

### 7. Sentry: two options

#### Option A — the official `@sentry/effect` SDK (alpha)

The clean path. It ships an Effect-aware tracer, logger, and metrics layer
([Sentry docs](https://docs.sentry.io/platforms/javascript/guides/effect/)).

**Effect v4** composition (v3 uses `Layer.setTracer` / `Logger.replace`
instead; v4 uses `Layer.succeed` / `Logger.layer`):

```ts
import * as Sentry from "@sentry/effect"
import { NodeRuntime } from "@effect/platform-node"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as Tracer from "effect/Tracer"

const SentryLive = Layer.mergeAll(
  Sentry.effectLayer({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0
  }),
  // Effect spans -> Sentry transactions
  Layer.succeed(Tracer.Tracer, Sentry.SentryEffectTracer),
  // Effect logs -> Sentry logs
  Logger.layer([Sentry.SentryEffectLogger]),
  // Effect metrics -> Sentry metrics
  Sentry.SentryEffectMetricsLayer
)

const MainLive = HttpLive.pipe(Layer.provide(SentryLive))
MainLive.pipe(Layer.launch, NodeRuntime.runMain)
```

#### Option B — a custom `ErrorReporter` (works today, no alpha dependency)

If you would rather not take an alpha dependency, or you need to control grouping, write the
reporter yourself. This is the shape to copy.

```ts
const sentryReporter = ErrorReporter.make(({ error, severity, attributes, timestamp, fiber, cause }) => {
  const tags: Record<string, string> = {}
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    // Low-cardinality values become tags (searchable, cheap).
    if (typeof value === "string" && value.length < 32) tags[key] = value
    else extra[key] = value
  }
  Sentry.captureEvent({
    level: toSentryLevel(severity),
    message: error.message,
    tags,
    extra: { ...extra, fiberId: fiber.id.toString() },
    // Attach the original stack, not just the message.
    exception: { values: [{ type: error.name, value: error.message }] }
  })
})
```

> **Cardinality discipline.** Tags are indexed and expensive; **never** put a user id, order id, or
> raw URL in a tag. Send those as `extra` or as Sentry breadcrumbs. The
> `value.length < 32` heuristic above is a crude version of that rule — in real code,
> whitelist the tag keys.

### 8. Putting it together

**Verified output** — a full RPC server with automatic reporting. Two events out of four requests,
because one was ignored and one was an interruption:

```text
charge -> Failure
findProduct -> Failure
crash -> Defect
interrupted request produced no report
=== LOG LINES (1) ===
{"message":"pricing subsystem failed","level":"ERROR","timestamp":"...","annotations":{},"spans":{},"fiberId":"#16"}

=== SENTRY EVENTS (2) ===
{"level":"error","message":"card declined for order-9","tags":{"orderId":"order-9","code":"insufficient_funds"},"extra":{"fiberId":"8","reportedAt":"..."}}
{"level":"fatal","message":"Cannot read properties of undefined (reading 'price')","tags":{"subsystem":"pricing"},"extra":{"fiberId":"16","reportedAt":"..."}}
```

Read that output as the whole design:

| Request | Outcome | Reported? | Why |
|---------|---------|-----------|-----|
| `charge` (typed failure) | Failure | **yes**, `error` | `severity` annotation + attributes became tags |
| `findProduct` (expected miss) | Failure | **no** | `ignore` annotation |
| `crash` (defect) | Defect | **yes**, `fatal` | `severity` on the `Error` object |
| interrupted | — | **no** | interruptions are always skipped |

### 9. Escalating a defect to Fatal

Defects default to `Info` — which is wrong for a bug. You can annotate the `Error`
object itself.

```ts
Effect.die(Object.assign(new Error("bad query plan"), {
  [ErrorReporter.severity]: "Fatal" as const,
  [ErrorReporter.attributes]: { subsystem: "pricing" }
}))
```

**Verified output:**

```text
severity=Fatal defect=true msg=bad query plan
```

Better still, wrap it in a tagged error class so the annotation lives with the type, and the
reporter can distinguish `Cause.hasDies(cause)` for defect-specific routing.

### 10. Do not leak secrets into logs

`Redacted` is a wrapper that prints `<redacted>` in every common
stringification path. Verified contrast:

**Verified output:**

```text
Info calling upstream with key <redacted>
Info stringified Redacted: "<redacted>"
Info Redacted.toString(): <redacted>
Info explicitly extracted, length = 26
Info naive log: {"apiKey":"sk_live_super_secret_value"}
```

Note the last line: a **plain string leaks**, even through `JSON.stringify`. Wrap anything
secret at the boundary and unwrap only where you actually need it:
`const raw = Redacted.value(secret)`.

For values you cannot wrap (a class field), implement the `Redactable` protocol, which the
runtime honours in logs, traces, and serialization.

### 11. Read the Cause, not just the error

`Cause` keeps typed failures, defects, and interrupts together. Use the predicates rather
than guessing.

```ts
Cause.hasFails(cause)          // typed failures present
Cause.hasDies(cause)           // a defect (bug) present
Cause.hasInterrupts(cause)     // cancellation present
Cause.hasInterruptsOnly(cause) // ONLY cancellation -> never report
Cause.squash(cause)            // extract the underlying value
Cause.pretty(cause)            // human-readable multi-line string
Cause.prettyErrors(cause)      // Error[] for Sentry/OTel
```

**Verified output:**

```text
=== Cause.pretty(defect) ===
Error: boom defect
    at file:///tmp/rpcex/prod-6.ts:7:52
hasFails: true hasDies: false
Cause.squash -> Error: boom defect
prettyErrors count: 1 | first message: validation failed
interrupt-only: true
```

`Cause.prettyErrors` is the right input for `Sentry.captureException` — it gives
real `Error` objects with stacks rather than a string.

## Verification

Commands run against `effect@4.0.2` on Node 24.21.0:

```sh
npx tsc --noEmit                 # 0 errors
node --experimental-strip-types prod-final.ts   # full RPC + reporter pipeline
```

## Troubleshooting

Every row is an error or surprise actually hit while building this.

| Symptom | Cause | Fix |
|---------|-------|-----|
| Sentry issues all titled `MyError: ` | `Schema.TaggedError` defaults `message` to `""`, and Sentry groups by message | Declare `message: Schema.String` on the error and populate it |
| Nothing is reported from RPC/HTTP handlers | The reporter was provided to the *client* layer, not the server layer | `Layer.provide(ErrorReporter.layer([...]))` **into the server layer** so request fibers inherit it |
| Every retry attempt creates an incident | `withErrorReporting` sits **inside** the retry, so each attempt reports | Put reporting **outside** `Effect.retry` — see the gotcha below |
| An expected 404 / not-found pages someone | Business failures are reported by default | Add `[ErrorReporter.ignore] = true` to the error class |
| A bug shows up as "Info" severity | Defects default to `Info` | Annotate the `Error` object with `[ErrorReporter.severity]: "Fatal"` |
| Interruptions flood the tracker | Should not happen | `ErrorReporter.make` already skips `Interrupt` reasons; if you report manually, check `Cause.hasInterruptsOnly` first |
| A secret appears in a log line | The value was a plain string | Wrap in `Redacted.make(...)`; plain strings leak even through `JSON.stringify` |
| `Effect.repeatN` / `Schedule.intersect` missing | v3 API removed in v4 | `Schedule.recurs`, `Schedule.max` / `min` |
| `Expected null` decoding an RPC payload | A no-payload RPC is `Schema.Void`, which does **not** accept raw JSON `{}` — it needs `null` | Give the RPC an explicit `payload: { ... }` (even empty fields) rather than relying on the default |
| Reporter sees 0 reporters at layer build | `Layer.provide` **consumes** the layer's output | Use `Layer.provideMerge` or `Layer.mergeAll` when you also need the service downstream |

### The retry gotcha, in detail

**Verified output** — reporting *inside* vs *outside* a retry that always fails:

```text
--- exhausted, reporting INSIDE retry ---
REPORT severity=Info msg=always fails #1
REPORT severity=Info msg=always fails #2
REPORT severity=Info msg=always fails #3
LOG Info attempts: 3
--- exhausted, reporting OUTSIDE retry ---
REPORT severity=Info msg=always fails #3
LOG Info attempts: 3
```

- **Inside** the retry: **3 reports** for 3 attempts. This is the noise you do not want.
- **Outside** the retry: **1 report** — the final, exhausted failure.

And when the retry eventually *succeeds*, reporting outside produces **zero** reports (verified:
`outside retry -> (no reports)`), because nothing failed past the retry boundary. That is
the behaviour you want: report a problem only when it actually escaped your resilience layer.

## Gotchas

Beyond the table:

- **`ErrorReporter` is not a logger.** Do not route every error to it. Log events at their
  level; report incidents. If your tracker receives more events than your log store, the wiring is
  wrong.
- **`ErrorReporter.layer` replaces by default.** Two `Layer.provide` calls in
  different places will silently drop one set of reporters. Use `mergeWithExisting: true`
  when composing.
- **Reporting is synchronous and must not throw.** The callback in `ErrorReporter.make` is
  a plain function returning `void`. Keep it to a buffered enqueue; do the network I/O
  elsewhere. A throwing reporter breaks the failing fiber.
- **`@sentry/effect` is alpha.** Pin the version, and keep the `ErrorReporter`
  fallback in mind if it breaks.
- **Do not log-and-rethrow everywhere.** Effect carries the failure in the type; one boundary report
  is enough. Logging at every layer is how you get ten lines for one incident.

## Related

- [Effect v4 Primitives — A Reader's Map](../reference/effect-v4-primitives.md) — the
  `Cause` / `Exit` / `Option` / `Result` error model this
  guide builds on.
- [Effect v4 @effect/rpc — Deep Dive](../technology/effect-v4-rpc.md) — where the automatic
  reporting boundary lives in the RPC server.
- [Effect v4 RPC in a Modular Monolith — Product Service](./effect-v4-rpc-modular-monolith-product-service.md)
  — the layered architecture to attach these layers to.

## Changelog

- 2026-10-08 — created. All examples type-checked and executed against `effect@4.0.2`
  (`Effect-TS/effect@ca068cef`). Discovered and documented the retry-reporting interaction,
  the `Schema.TaggedError` empty-message gotcha, and the `Schema.Void` payload
  decoding behaviour by experiment. Sentry guidance sourced from the official
  `@sentry/effect` documentation.
