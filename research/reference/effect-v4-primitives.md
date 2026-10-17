---
title: Effect v4 Primitives — A Reader's Map
category: reference
tags: [effect, effect-v4, typescript, functional-programming, effect-system, dependency-injection, concurrency, streams, schema]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Effect.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Option.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Result.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Exit.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Cause.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Context.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Layer.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Scope.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Fiber.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Ref.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Queue.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/PubSub.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Deferred.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Stream.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Schedule.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Schema.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/01_basics/01_effect-gen.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/01_basics/02_effect-fn.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/01_basics/10_creating-effects.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/04_errors/01_error-handling.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/05_resources/10_acquire-release.ts
  - https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/03_services/20_layer-composition.ts
confidence: high
---

# Effect v4 Primitives — A Reader's Map

Verified against `effect@4.0.2` (commit `ca068cef`, read 2026-10-08) on Node 24.21.0.
Every **Verified output** block below is real captured program output, not an illustration.
Illustrative snippets are abridged for readability; the executed versions are longer.

## Summary

Effect is **one idea with a large standard library built on it**. The idea: describe work as a
*value* instead of performing it, so the runtime can compose, retry, interrupt, parallelize, and
observe that work. Everything else — `Option`, `Layer`, `Stream`,
`Schedule` — is a consequence of taking that seriously.

- **The one type that matters:** `Effect<A, E, R>` — succeeds with `A`, fails with
  `E`, requires services `R`.
- **The one habit:** `Effect.gen(function*() { ... })` plus `yield*`. It reads like
  async/await, but the "async" is a full effect runtime.
- **The one payoff:** `E` and `R` are in the type. A function that can fail with
  `NotFound` *says so*; a function that needs a database *says so*, and the compiler will
  not let you run it without providing one.
- **The one trap:** nothing happens until you run it. A stray `Effect.log(...)` that is
  never `yield*`-ed or passed to `runPromise` silently does nothing.

## Details

### 1. The mental model: `Effect<A, E, R>`

`Effect<A, E, R>` is a *description* of a computation
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Effect.ts)):

| Parameter | Meaning | Example |
|-----------|---------|---------|
| `A` | the success value | `User`, `void` |
| `E` | the *typed* failure channel | `NotFound \| Timeout` |
| `R` | required services (the environment) | `Database \| Logger` |

Building one does nothing. Running one does the work:

```ts
let ran = 0
const counted = Effect.sync(() => { ran++; return "side effect" })
// ran is still 0 here
Effect.runSync(counted)   // now ran === 1
```

**Verified output** (the laziness is observable):

```text
before run: ran = 0
after run:  ran = 1 (running an Effect performs the work)
```

This is the biggest adjustment coming from async/await, where calling a function *is* the work. In
Effect, an unexecuted effect is inert data.

### 2. Creating effects

```ts
Effect.succeed(42)                      // a known value
Effect.sync(() => Date.now())           // sync side effect that will not throw
Effect.try({ try: () => JSON.parse(s), catch: (cause) => new ParseError({ cause }) })
Effect.promise(() => fetch(url))        // a Promise (cannot fail in the type)
Effect.tryPromise({ try: () => fetch(url), catch: (cause) => new NetworkError({ cause }) })
```

The `try` family is where a thrown exception becomes a *typed* value in `E`.
`Effect.sync` is for code you assert cannot throw; if it does, that is a **defect** (see §4).

### 3. `Effect.gen` and `Effect.fn`

`Effect.gen` is the workhorse — imperative style, `yield*` to unwrap:

```ts
const program = Effect.gen(function*() {
  const user = yield* getUser(id)        // unwraps Effect<User, NotFound>
  const posts = yield* getPosts(user.id) // short-circuits on NotFound
  return { user, posts }
})
```

`Effect.fn` wraps a *reusable* function so it gets a tracing span and a proper name:

```ts
const add = Effect.fn("add")(function*(a: number, b: number) {
  return a + b
})
```

Guidance from the official docs
([ai-docs](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/ai-docs/src/01_effect/01_basics/02_effect-fn.ts)):
use `Effect.fn("name")` for anything that is a useful tracing boundary, and
`Effect.fnUntraced` for library internals and hot paths. **Avoid** a function that only
wraps and returns an `Effect.gen`.

> **Gotcha.** `Effect.fn` takes combinators as *extra arguments*, not via `.pipe`:
> `Effect.fn("f")(body, Effect.catch(...))`.

### 4. The error model: four types, four jobs

Effect separates four things that most languages collapse into "an exception":

| Type | Is it... | Runtime? | Typical use |
|------|----------|----------|-------------|
| `Option<A>` | present or absent — *no error information* | no | "no row found" when absence is normal |
| `Result<A, E>` | already succeeded or failed — *plain data* | no | synchronous validation, parse results |
| `Exit<A, E>` | the *outcome* of a finished Effect, including interruption | no | inspecting a completed effect, tests |
| `Cause<E>` | the full *why* of a failure (typed failures + defects + interrupts) | no | diagnostics, `Exit.cause` |

`Option` and `Result` are inert data — inspecting them cannot run side effects.
`Exit` is what you get from `Effect.exit` / `runPromiseExit`; its
failure side is a `Cause`.

`Cause.Reason<E> = Fail<E> | Die | Interrupt` is the key distinction
([source](https://github.com/Effect-TS/effect/blob/ca068cef445101cbb2710c24360ca3a7ab9b94d5/packages/effect/src/Cause.ts)):

- **`Fail<E>`** — an *expected*, typed error. Recoverable; lives in the `E` channel.
- **`Die`** — a **defect**: a bug or an unrecoverable invariant violation. *Not* in
  `E`; it is thrown outside the type system on purpose.
- **`Interrupt`** — cancellation, a first-class outcome rather than an error.

**Verified output:**

```text
typed failure hasFails: true
defect hasDies:       true
```

### 5. Handling errors

```ts
effect.pipe(Effect.catchTag("NotFound", (e) => Effect.succeed(fallback)))
effect.pipe(Effect.catchTags({ NotFound: h1, Timeout: h2 }))   // exhaustive over tags
effect.pipe(Effect.catch((e) => Effect.succeed("any")))        // catch-all
effect.pipe(Effect.mapError((e) => new Wrapped({ cause: e }))) // reshape the error channel
effect.pipe(Effect.orDie)                                      // typed error -> defect
```

Define errors as classes so tags are checked:
`class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.String }) {}`

**Verified output:**

```text
catchTag: found
catchTags: miss:9
catchAll: any
```

`catchTags` is exhaustive: adding a new error to `E` breaks the call site until
you handle it. That is the point of typed errors.

### 6. `Context` — dependency injection without a container

A service is a *key*; `Context` is the typed map from keys to implementations.

```ts
class Db extends Context.Service<Db, { readonly query: (sql: string) => Effect.Effect<string> }>()(
  "app/Db"
) {}

// inside an effect, ask for it
const db = yield* Db
const rows = yield* db.query("SELECT 1")

// provide it
program.pipe(Effect.provide(DbLive))
```

The key insight: the *requirement is in the type*. `yield* Db` adds `Db` to
`R`, and the compiler refuses to run the effect until something provides it. There is no
runtime "service not found" in correct code.

Use `Context.Reference` for services with a default value (feature flags, config) — it is
the v4 replacement for the old `FiberRef`.

### 7. `Layer` — wiring, as a value

A `Layer<ROut, E, RIn>` is a *recipe* for building services: it outputs `ROut`, can
fail with `E`, and needs `RIn`. Layers compose:

```ts
const LoggerLive = Layer.succeed(Logger)({ log: (m) => Effect.sync(() => console.log(m)) })

// Db needs Logger
const DbLive = Layer.effect(Db, Effect.gen(function*() {
  const logger = yield* Logger
  return Db.of({ query: (sql) => logger.log(sql).pipe(Effect.as("row:" + sql)) })
}))

const App = DbLive.pipe(Layer.provide(LoggerLive))  // Logger is consumed
```

- `Layer.provide` feeds a dependency in and **consumes** its output.
- `Layer.provideMerge` feeds it in and **keeps** the output available.
- `Layer.mergeAll` combines layers, keeping all outputs.

**Layers are memoized.** Building a layer runs its acquisition effect once per memo map, so a shared
connection pool is not created per consumer.

**Verified output:**

```text
[logger] query: SELECT 1
Context/Layer chain: row:SELECT 1
memoized layer built 1 time(s); both reads saw: [ 1, 1 ]
```

### 8. `Scope` and `acquireRelease` — resources

`acquireRelease` pairs an acquisition with a finalizer; the finalizer runs when the
enclosing `Scope` closes, **whatever the exit** (success, failure, or interruption):

```ts
const resource = Effect.acquireRelease(
  Effect.sync(() => openHandle()),                // acquire
  (handle) => Effect.sync(() => handle.close())   // release
)

const used = yield* Effect.scoped(Effect.gen(function*() {
  const handle = yield* resource
  return yield* useHandle(handle)
}))   // release runs here
```

**Verified output** (the finalizer is observably ordered):

```text
inside scope: acquire > use:handle
after scope:   acquire > use:handle > release
```

You rarely call `Scope.make` yourself: `Effect.scoped`, `Layer`, and
`Stream.runCollect` all manage scopes for you.

### 9. `Fiber` — concurrency with structure

Forking creates a fiber (a lightweight thread). `Effect.forkChild` ties its lifetime to the
parent; `Effect.forkScoped` ties it to a scope. Both are *structured*: when the parent or
scope ends, the child is interrupted — it cannot leak.

```ts
const fiber = yield* Effect.forkChild(Effect.succeed("child"))
const value = yield* Fiber.join(fiber)     // Fiber.join(fiber), not fiber.join()

yield* Effect.all([a, b, c])                                // sequential by default
yield* Effect.all([a, b, c], { concurrency: "unbounded" })  // parallel
yield* Effect.forEach(items, (i) => work(i), { concurrency: 5 })
yield* Effect.race(a, b)                                    // first to finish wins
```

**Verified output** — note that `Effect.all` is sequential unless told otherwise:

```text
fork/join: child
Effect.all: [ 1, 2 ]
forEach: [ 2, 4, 6 ]
race: fast
Effect.all default order: a,b,c
Effect.all parallel order: c,b,a
Effect.forEach default order: x,y,z
```

The last three lines are the same three effects with different delays (30ms, 10ms, 1ms):
sequential finishes in submission order, `{ concurrency: "unbounded" }` finishes in completion
order. Sequential is the safe default because it preserves ordering and backpressure.

**Verified output** — a scoped child runs, then is interrupted on scope close:

```text
forkScoped child ran, then was interrupted when scope closed: started
```

### 10. State and coordination primitives

| Primitive | Semantics | Analogy |
|-----------|-----------|---------|
| `Ref<A>` | one fiber-safe mutable value; updates are atomic | a mutable variable, but safe |
| `Deferred<A, E>` | a one-shot cell many fibers can await | a promise you complete manually |
| `Queue<A, E>` | each value goes to **one** consumer | a work queue |
| `PubSub<A>` | each value goes to **every** subscriber | a broadcast bus |

`Ref` is the one to internalize. `Ref.modify` returns the computed value and stores
the new one:

```ts
const ref = yield* Ref.make(0)
yield* Ref.update(ref, (n) => n + 1)
const prev = yield* Ref.modify(ref, (n) => [n, n * 10] as const)  // prev = old value
```

**Verified output** — 100 concurrent increments are exact, which is the whole point:

```text
Ref: get = 2 | modify returned prev = 2 | new = 20
Ref after 100 concurrent increments: 100
Deferred: opened
Queue drained: [ 1, 2, 3 ]
PubSub both subscribers got: 7 7
```

`PubSub.subscribe` is **scoped** — the subscription is cleaned up when the scope closes.

### 11. `Stream` — effectful sequences

A `Stream<A, E, R>` is to `Effect` what an array is to a value: many
`A` over time, lazily pulled, with backpressure.

```ts
Stream.make(1, 2, 3).pipe(Stream.map((n) => n * 2))     // transform
Stream.range(1, 5).pipe(Stream.filter(isOdd), Stream.take(2))
stream.pipe(Stream.runCollect)                           // -> Chunk<A>
stream.pipe(Stream.run(Sink.sum))                        // fold
```

**Verified output:**

```text
Stream.map/runCollect: [ 2, 4, 6 ]
Stream.range/filter/take: [ 1, 3 ]
Stream.run(Sink.sum): 10
Stream.unfold: [ 0, 1, 2 ]
```

A stream is lazy: it does nothing until `runCollect` / `run` / `runDrain`.

### 12. `Schedule` — retry and repeat policies

`Schedule.recurs(n)` is "n more times"; `Schedule.exponential(base)` is backoff;
`Schedule.spaced(d)` is a fixed gap.

```ts
flaky.pipe(Effect.retry(Schedule.recurs(5)))
effect.pipe(Effect.repeat(Schedule.recurs(3)))     // returns the SCHEDULE's output
slow.pipe(Effect.timeout("50 millis"))             // fails with a Timeout error
```

**Verified output:**

```text
Effect.retry(Schedule.recurs(5)): succeeded on attempt 3 | total attempts: 3
Effect.repeat(Schedule.recurs(3)): output = 3 | body ran 4 times (initial + 3)
retry with max([exponential, recurs(3)]): Failure | attempts: 4
Effect.timeout too slow -> Failure
Effect.timeout in time  -> Success
```

### 13. `Schema` — one declaration, three roles

A schema validates, **decodes** (unknown → typed), and **encodes** (typed → wire). It is also the
source of the TypeScript type.

```ts
const Person = Schema.Struct({
  name: Schema.NonEmptyString,
  age: Schema.Int,
  nickname: Schema.OptionFromNullOr(Schema.String)
})

const decoded = yield* Schema.decodeUnknownEffect(Person)(input)  // may fail with SchemaError
const encoded = yield* Schema.encodeEffect(Person)(value)         // typed -> representation
```

`Schema.Class` adds a *nominal* class with a constructor:

```ts
class User extends Schema.Class<User>("User")({ id: Schema.Int, email: Schema.NonEmptyString }) {}
const u = User.make({ id: 1, email: "a@b.c" })
u instanceof User   // true — it is a real class, not a structural object
```

`Schema.TaggedError` makes an error class that is both a schema and a throwable.

**Verified output:**

```text
decodeUnknown: Ada 36 nickname isNone: true
decode invalid -> Failure
encode: {"name":"Ada","age":36,"nickname":"countess"}
Schema.Class instance: true a@b.c
Schema.Class decode: true 2
```

Decoding failure lands in the **typed error channel** (`SchemaError`), not a throw.

### 14. Running an effect

| Runner | Returns | Use |
|--------|---------|-----|
| `Effect.runSync` | `A` (throws on failure/async) | tests, purely synchronous effects |
| `Effect.runPromise` | `Promise<A>` | application entrypoint |
| `Effect.runPromiseExit` | `Promise<Exit<A, E>>` | when you want the failure as data |
| `Effect.exit` | `Effect<Exit<A, E>>` | convert an effect to its outcome *inside* an effect |
| `Layer.launch` | runs a layer for its lifetime | servers, long-lived apps |

At the very top, platform packages provide `NodeRuntime.runMain` (or equivalent), which
handles signals, exit codes, and logging.

### 15. The dual API

Almost every combinator has two forms: **data-last** (for `.pipe`) and **data-first**
(direct call). Both are the same function.

```ts
Effect.succeed(5).pipe(Effect.map((n) => n + 1))   // data-last
Effect.map(Effect.succeed(5), (n) => n + 1)        // data-first
```

**Verified output:**

```text
dual: pipe = 6 | direct = 6 (same fn)
dual (Option): 10 10
```

Convention: use `.pipe` for multi-step chains, the direct form for one-shot calls.

## Gotchas

| Symptom | Cause | Fix |
|---------|-------|-----|
| Nothing happens; logs never appear | An `Effect` was created but never run or `yield*`-ed | `yield*` it, or pass it to a runner; effects are lazy descriptions |
| `yield* (intermediate value) is not iterable` | Used a Promise/plain value where an Effect is expected | Wrap it: `yield* Effect.promise(...)` / `Effect.succeed(...)` |
| `fiber.join is not a function` | `join` is a module function, not a method (v4) | `Fiber.join(fiber)` |
| `Service not found: X` | The effect ran without providing `X` | Add it to the `Layer.provide` chain; the type error usually appears first |
| `Service not found: effect/Scope` | Used a scoped API (e.g. `PubSub.subscribe`) outside a scope | Wrap in `Effect.scoped` |
| `Effect.repeatN` / `Schedule.intersect` not a function | v3 names removed or renamed in v4 | Use `Schedule.recurs`, `Schedule.max` / `min` |
| `min([exponential, recurs(n)])` retries forever | `min` recurs while **any** schedule recurs; `exponential` never stops | Use `max` (recurs only while **all** recurs) |
| `Effect.repeat` returns a number, not your value | It returns the *schedule's* output | Use `Effect.tap` to observe the body |
| A defect vanishes from `E` | Defects are `Die`, deliberately outside the typed channel | Inspect via `Exit` / `Cause.hasDies`; `catchTag` will not see them |
| `Effect.fn` combinators ignored | Passed them via `.pipe` | Pass as extra arguments: `Effect.fn("f")(body, Effect.catch(...))` |
| `runSync` throws "async" | The effect suspends (sleep, promise, fiber) | Use `runPromise` |
| `Ref.modify` result looks wrong | It returns the *first* tuple element and stores the second | Return `[result, newValue]` |
| `PubSub.take` vs `Queue.take` confusion | A subscription is not a queue | Use `PubSub.take(subscription)` |

## Related

- [Effect v4 @effect/rpc — Deep Dive](../technology/effect-v4-rpc.md) — these primitives applied to
  a wire protocol: `Schema` as contract, `Layer` as transport wiring,
  `Stream` for streaming responses.
- [Effect v4 RPC in a Modular Monolith — Product Service](../howto/effect-v4-rpc-modular-monolith-product-service.md)
  — a worked repository / service / RPC example built from these primitives.
- [Drizzle ORM with Effect-TS — Integration Lines](../technology/drizzle-effect-integration.md) — the
  `Context`/`Layer` pattern applied to a database service, and how `Schema` decoding pairs with a
  generated SQL-schema module.

## Changelog

- 2026-10-08 — created. Every example type-checked and executed against `effect@4.0.2`
  (`Effect-TS/effect@ca068cef`); "Verified output" blocks are real program output.
  Sources: the pinned module source and the repository's `ai-docs` walkthroughs.
