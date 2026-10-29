---
title: Bun's Experimental AOT Compiler — `bun compile` (TypeScript Types → Native Machine Code)
category: technology
tags: [bun, aot, typescript, javascriptcore, b3, native-compilation, startup-time, webassembly, perry]
status: complete
created: 2026-11-23
updated: 2026-11-23
sources:
  - https://bun.com/docs/compiler/aot
  - https://bun.com/docs/compiler/types
  - https://bun.com/docs/compiler/compatibility
  - https://bun.com/docs/compiler/internals
  - https://x.com/realamlug/status/2109148948602425582
  - https://x.com/mrousavy/status/2104882939838222586
  - https://fr.news.hada.io/topic?id=35124
confidence: high
---

# Bun's Experimental AOT Compiler — `bun compile`

## Summary

In October 2026 Bun shipped an **experimental ahead-of-time compiler** that is a fundamentally
different thing from `bun build --compile`. Rather than bundling JavaScript into a copy of the Bun
runtime, `bun compile` **translates your TypeScript and JavaScript to native machine code at build
time**, using your type annotations to give objects fixed field layouts and to turn property
accesses into single loads at known offsets
([Bun docs](https://bun.com/docs/compiler/aot)).

Key facts up front:

- **It is not in any release.** Not 1.4, 1.4.1, 1.4.2, 1.4.3, or 1.4.4. It is canary-only and
  documented as experimental. Verified 2026-11-23: `bun 1.4.4` → `error: Script not found "compile"`;
  `bun upgrade --canary` → the command exists.
- **The docs exist and are substantial** — 13 pages under `bun.com/docs/compiler/`, including a
  compiler-internals page describing the IR, the pass pipeline, and which repository each stage
  lives in.
- **The win is cost, not peak speed.** Startup and memory improve dramatically; peak throughput
  against the same Bun's JIT is a coin flip and sometimes a large *loss*.
- **It changes JavaScript semantics deliberately.** Built-ins become read-only, and WebAssembly you
  did not import runs 20× slower.

---

## What it actually does

`bun compile` is short for `bun build --compile --aot` and takes every `bun build` flag
([docs](https://bun.com/docs/compiler/aot)). Three other commands accept `--aot`:
`bun check --aot` (reports without building), `bun run --aot` and `bun test --aot` (check, then
run from source under the compiled-mode rules).

The pipeline, from the internals page ([docs](https://bun.com/docs/compiler/internals)):

```text
entry point
   │  Load      resolve imports with bun build's resolver/loaders/macros; parse once into the checker's own tree
   │  Bind      link ES imports, find CommonJS exports, fold process.platform and --define
   │  Check     per-thread TS checker (the one behind bun check, in Rust) — a type error stops the build
   │  Lower     walk the same tree and emit IR, asking the checker questions at nearly every expression
   │  Link      unite types, layouts, keys, strings across files; number once for the whole program
   │  Emit      one byte block: header (schema hash) + sections
   ▼
Bun__AOT__compile()  →  AOT::compileProgram()  in the same process, same thread pool
   │  Read/Type/Verify   decode; every value gets a type from the engine's own rules, not the front end's word
   │  Flow               whole-program value flow: which allocation sites, closures, constants reach each position
   │  Optimize           checks→tests, lookups→slot loads, calls→direct+inlined, dead allocations removed
   │  Slots/Select       field placement, operation selection
   │  Represent          Int32 / Double / Boolean / Cell / JSValue + inserted conversions
   │  Codegen  → B3 → Air → machine code
   │  Image              layout, link calls, outline cold code, merge identical functions
   ▼
executable = copy of the running bun minus unreachable parts  +  the image in its own section
```

Two structural details are worth internalizing:

- **Nothing is bundled and no JavaScript text is ever printed.** Modules stay modules; the program
  goes syntax tree → IR → machine code. This is why the output is *smaller* than `--compile`
  output even though it contains machine code.
- **It spans two repositories.** The front end is in `oven-sh/bun` (`src/aot/`, `src/sema/`);
  the back end is `Source/JavaScriptCore/aot/` in `oven-sh/WebKit`, Bun's JSC fork. Code
  generation reuses **B3**, the SSA IR behind JavaScriptCore's FTL tier. No LLVM, no external
  toolchain, no linker.

---

## The three ideas that make it work

An independent code-level analysis ([`@realamlug`, 2026-10](https://x.com/realamlug/status/2109148948602425582))
distils the design to three assumptions, and this framing is more useful than the marketing:

| Idea | What it buys | What it costs |
| --- | --- | --- |
| **Closed world** | Every call target, captured variable and escape is known at build time | Escapes exist: `eval`/`new Function` drop to the interpreter |
| **Frozen built-ins** | `arr.push(x)` compiles to a real push, not lookup + guard | Reassigning `Array.prototype.push` throws |
| **Sound types** | Field layouts become structs; annotations lower to real runtime checks | Typing lies move work to a guard instead of being free |

At run time **the JIT is off**, and code is mapped read-only straight from the executable. Inline
caches — normally self-modifying code — become plain data slots that stubs read
([amlug](https://x.com/realamlug/status/2109148948602425582)).

Note the naming trap: despite the "sound types" framing, a type mismatch **does not throw**. Bun's
docs are explicit — the call falls back to a compiled slow version of the function that behaves like
plain JavaScript, and the program's observable behaviour stays identical to `bun run`
([docs](https://bun.com/docs/compiler/types)). A secondary write-up that claims a mismatch raises a
`TypeError`, or that `as` performs a real conversion, is **wrong on both counts** (see
[Corrections](#corrections)).

---

## TypeScript types are the input, not decoration

This is the substantive difference from every other JS "compiler". The annotations are not stripped —
they drive code generation, and they are **checked**.

```ts
class Account {
  constructor(public id: number, public balance: number) {}
}
function total(accounts: Account[]): number {
  let sum = 0;
  for (const account of accounts) sum += account.balance;
  return sum;
}
```

Typed code gets three things untyped code cannot have ([docs](https://bun.com/docs/compiler/types)):

1. **Fields at fixed offsets** — `account.balance` is one load at a known offset; no lookup, no
   inline cache.
2. **Unboxed numbers** — `balance` is a raw 64-bit value, not a tagged box that must be unboxed
   before arithmetic.
3. **Direct calls** — the compiler knows which function `total()` calls, so it calls or inlines it.

Crucially, *annotations alone are not what does this*. A class in a plain `.js` file gets the same
fixed layout. What annotations add is reach: where the compiler cannot track a value on its own
(`JSON.parse` output, a route handler's argument), a declared type installs one guard and the code
after it stays on the fast path.

### The typed percentage

Every build prints how much of the program is typed, counting **property accesses** — reads, writes,
`in` tests, deletes:

```text
Dependencies: 3.1% of property accesses are one load: 210 free, 1,320 tested, 5,244 by name (6,774)
92.4% of property accesses are one load: 1,204 free, 61 tested, 38 by name (1,303)
```

| Verdict | Meaning |
| --- | --- |
| `free` | Compiles to one load/store at a fixed offset — Bun already knows the shape |
| `tested` | Runs a shape check first |
| `by name` | Looks the property up at run time — the interpreter speed |

Under 95% the build suggests `--explain`, which lists the worst offenders with a fix for each
(`--explain=guards`, `--explain=json`, `missed-optimizations`, `allocations`). Built-in properties
Bun provides (`req.params.id`, `server.url`, `process.env.PORT`) count as **by name**, so
framework request handlers score low by construction.

---

## Measured here, 2026-11-23 (Bun canary, Linux x64)

I reproduced every claim I could rather than quoting Bun's tables. The account-class program above:

| Check | Result |
| --- | --- |
| `bun run account.ts` | `49500` |
| `bun compile` → run | `49500` — identical |
| Typed % | **100%** (3 free, 0 tested, 0 by name) |
| `bun compile` binary | **68,107,272 B (65 MiB)** |
| `--no-aot` binary | **140,528,328 B (134 MiB)** — **2.06× larger** |
| Source still in binary? | Yes — `strings` finds `balance` 10× |

The docs' claim that "the todo server is 69 MB instead of 140 MB" reproduces almost exactly.

Semantic divergence tests:

| Program | `bun run` | compiled |
| --- | --- | --- |
| `const port: number = "3000"` | runs | **build fails**, `TS2322`, no executable written |
| `query.page as number; page + 1` on `"2"` | `string 21` | `string 21` — **cast does not convert** |
| `double(body.visits)` with `"3"` from `JSON.parse` | `6` | `6` — **no throw**, slow path |
| `Array.prototype.push = () => 0` | `assigned ok` | **`TypeError: Cannot assign to Array.prototype.push because built-in objects are read-only`** |
| `greet.toString()` | full source | full source |
| same, `--no-compile-function-source` | — | `function greet() { [native code] }` |

Startup, `hyperfine --warmup 10 -N`, 20-line program:

| Binary | Size | Mean |
| --- | --- | --- |
| `--no-aot` | 134 MiB | **10.8 ms** ±2.1 |
| `--aot` | 65 MiB | **13.4 ms** ±2.8 |

The AOT binary was **24% slower** on a trivial program. This matches Bun's own admission that "a
program that prints one line goes the other way: 5.05 ms against 4.57 ms". Startup wins only where
there is real module graph to load and JIT to warm.

---

## What Bun's own benchmarks show

All figures below are Bun's, measured 2026-10-22 on one core of an AMD EPYC 9R14, 64 connections,
JIT warmed with ≥200,000 requests per route ([docs](https://bun.com/docs/compiler/aot)).

### Startup and memory — the clear win

| Framework | Peak RSS | Peak private | Start to first response |
| --- | --- | --- | --- |
| `Bun.serve` | 41.8 → 34.4 MB | 16.4 → 12.9 MB | 15.8 → 8.2 ms |
| Hono | 47.2 → 34.9 MB | 19.7 → 12.8 MB | 18.8 → 8.8 ms |
| Elysia | 48.1 → 41.5 MB | 20.4 → 13.0 MB | — |
| TanStack Start | 61.3 → 43.1 MB | 30.9 → 15.6 MB | — |
| `node:http` | 71.0 → 44.9 MB | 35.8 → 19.0 MB | 31.2 → 11.8 ms |
| Fastify | 80.7 → 54.7 MB | 52.4 → 21.0 MB | 77.7 → 17.9 ms |
| Express | 83.5 → 54.7 MB | 51.0 → 23.4 MB | 64.2 → 18.2 ms |
| Koa | 89.8 → 59.5 MB | 56.3 → 29.9 MB | 84.1 → 21.8 ms |

Every server answers its first request sooner; peak memory drops 14–37%, and the larger frameworks
hold about **half** the private memory or less.

### Throughput — a coin flip

Versus `--no-aot`, which is the honest comparator (same Bun, same built-ins, same native modules,
JIT on):

| Framework | vs `--no-aot` | vs Bun 1.4.3 |
| --- | --- | --- |
| `node:http` | **+12.5%** | +37.8% |
| `Bun.serve` | **+3.2%** | +6.2% |
| Hono | +0.3% | +4.0% |
| Express | −0.7% | +26.5% |
| TanStack Start | −4.8% | −2.5% |
| Elysia | −7.3% | −3.8% |
| Fastify | **−10.9%** | +16.9% |
| Koa | **−31.5%** | −13.0% |

Two win, two are level, four lose. Koa loses 31.5% because it is untyped npm JavaScript in many small
packages and one plain-text request makes ~450 lookups by name. A JIT learns which objects reach a
property access by watching; the compiler must prove it at build time
([docs](https://bun.com/docs/compiler/aot)).

Read those columns carefully. Express and Fastify appear to gain a lot over Bun 1.4.3 mostly because
1.4.3 had an older `node:http` — they gain that without `bun compile` too. The `--no-aot` column
is the only one that isolates the compiler.

### The typed-code showcase

The TypeScript 6 compiler, built from its own sources, type-checking the `effect` repository on one
thread — this is what the feature looks like when the hot path is genuinely typed:

| | Bun 1.4.3 | Compiled | Change |
| --- | --- | --- | --- |
| Wall time | 15.05 s | **4.14 s** | 3.6× faster |
| CPU time | 31.3 s | **5.3 s** | 5.9× lower |
| Peak RSS | 2,568 MB | **961 MB** | 2.7× lower |

`@realamlug` measured the same program independently (688 files) and got a different shape worth
recording: wall **5.97 s → 6.01 s**, essentially unchanged, while CPU went **15.7 s → 6.9 s (−57%)**
and instructions **−47%**, at ~2.6 cores busy down to ~1.1. Same output. His read is the sharper one:
*"AOT here isn't faster at peak. It's dramatically cheaper."* The wall-time gap between his numbers
and Bun's is a parallelism difference, not a contradiction.

### Against Go and Rust

Five compiled servers measured against the same eight routes in Go (`net/http`,
`GOMAXPROCS=1`) and Rust (axum, current-thread tokio):

| | K instructions/request | Peak private mem | M instructions to first response |
| --- | --- | --- | --- |
| `node:http`, compiled | 49.8 | 21.0 MB | 19 |
| Elysia, compiled | 56.7 | 12.8 MB | 18 |
| Hono, compiled | 58.2 | 12.4 MB | 11 |
| **Rust** | **70.8** | **2.0 MB** | **1** |
| Express, compiled | 74.9 | 23.2 MB | 48 |
| TanStack Start, compiled | 87.2 | 16.1 MB | 19 |
| **Go** | 130.2 | 6.9 MB | 3 |

The eye-catching result: by requests per second on one core, five of seven compiled servers **beat
Go** (1.1×–1.6×). All seven are behind Rust (1.1×–2.6×). But memory and startup lose to both —
1.8×–3.4× Go's private memory and 6×–12× Rust's. Go and Rust still start in single-digit
microseconds against Bun's ~10 ms.

Treat this table as directional, not settled: it is one core, one machine, one day, and the
comparison set is Bun's own choice of apps.

---

## Compatibility: what breaks

The full compatibility page runs to dozens of deliberate divergences. The ones that decide whether
you can ship are these ([docs](https://bun.com/docs/compiler/compatibility)):

| Constraint | Detail |
| --- | --- |
| **Built-ins are read-only** | Members can be *added*, not replaced. `Array.prototype.push = f` throws. Any dependency that monkey-patches a built-in is out. |
| **Code from strings is interpreted** | `eval`/`new Function` work but run interpreted. zod 4, ajv, fast-json-stringify and Elysia build validators with `new Function`. |
| **Un-imported WASM is ~20× slower** | A `.wasm` you `import` is AOT-compiled; bytes you download or decode are interpreted, and there is no JIT to rescue a tight loop. |
| **Module cache doesn't list the executable's modules** | `delete require.cache[...]` cannot force a re-run. |
| **`spyOn` on an export throws** | Compiled module namespaces reject it. |
| **No breakpoints** | With `--compile-inspector`, console, heap snapshots and CPU profiles work; stepping and breakpoints do not. |
| **No cross-compilation** | `error: bun compile can't cross-compile. It only builds for the platform it runs on` |
| **≥256 FFI JSCallbacks** | Their entry points are compiled in, so the count is fixed. |
| **Deep nesting cap** | >2,000 levels of nested calls stops the build with `TS100301`. |
| **Limited runtime loading** | `import()` of non-embedded code throws unless `--aot-allow-code-from-disk` is set (larger, slower). |

The WASM item is the sharpest edge. A program whose hot loop lives in WebAssembly it does not
statically import does not just get slower — it loses roughly 20×.

---

## What it costs

| Cost | Figure |
| --- | --- |
| Build time, TS 6 compiler | 8.2 s wall, **121 s CPU**, 1.5 GB memory (many-core machine) |
| Build time, small program | ~325 ms wall for the account class here |
| Caching | **None between builds** |
| Binary | 69 MB vs 140 MB for the same program with `--no-aot` — smaller, because the `bun` CLI and the JIT compilers are left out |
| Binary growth from `--compile` output | ~2× larger in some early previews (Claude Code CLI, per `@mrousavy`) |

That last row is not a contradiction: compared against `--no-aot` (JIT-bearing) the AOT binary is
much smaller; compared against the *old* `bun build --compile` of a large app, the added machine
code makes it larger.

`bun compile --trim` and `--trim-locales` strip unused Bun/Node APIs and locale data. `bun compile
--library` builds a publishable package instead of an executable — shipping ES modules, `.d.ts`,
plus `.aot.ts` files (types kept) that `bun compile` can consume with an `"aot"` export condition.

---

## When to use it, and when not to

**Reach for it when the metric is cost:**

- **Serverless / scale-to-zero** — 8–22 ms to first response and 14–37% less memory changes cold-start
  economics far more than a few percent of throughput.
- **Memory-dense deployments** (many containers per box) — private memory roughly halves.
- **CLIs with a real module graph** — the win shows up where there is code to load, not in a
  one-line program.
- **Genuinely typed, self-contained hot code** — the `effect` repo's 5.9× CPU reduction is the ceiling.

**Stay on the JIT when:**

- Peak requests per second matter and your hot path is untyped npm code (Koa, Fastify, Effect).
- A dependency generates its hot code at run time (zod 4, ajv, Elysia).
- You build on one platform and deploy on another — there is no cross-compile for AOT.
- You need to set breakpoints.
- Your WASM is not statically imported.
- Your project has type errors you cannot fix yet — they stop the build, where `bun run` ignores them.

---

## Where it sits: Bun AOT vs Perry vs `--bytecode`

| | Bun `--aot` | Perry | Bun `--bytecode` |
| --- | --- | --- | --- |
| Output | Machine code + a whole JS engine | Machine code, **no engine** | JSC bytecode + a whole JS engine |
| Backend | B3 (JSC's FTL IR) | SWC + LLVM | JSC bytecode format |
| Escape hatch for dynamic code | The interpreter | None — must resolve statically | The interpreter |
| Target platforms | Build platform only | Broad (LLVM), incl. WASM and RISC-V/ESP32 experiments | Cross-compiles to 8 targets |
| Binary | 65 MiB here | ~2.2 MB per early reports | ~87 MiB here |
| Maturity | Experimental, canary-only | Experimental | Shipped since v1.1.30 |

`@realamlug`'s framing is the clearest summary available: **Bun goes top-down** — take one of the
best JS engines in the world and remove the JIT, keeping the GC, hidden classes, megamorphic caches
and the interpreter as a safety net. **Perry goes bottom-up** — no engine at all, and anything that
cannot be resolved statically is a compiler bug to fix rather than a slow path at run time. Getting
Claude Code's 13 MB minified CLI to compile natively took Perry 160 compiler fixes
([amlug](https://x.com/realamlug/status/2109148948602425582)).

The ecosystem converged on Bun's three ideas independently — closed world, immutable intrinsics,
types you can trust — which is a good sign they are the right ones.

---

## Corrections

Two errors appear in circulating secondary coverage. Both were checked against Bun's docs and the
canary binary on 2026-11-23:

1. **"A type mismatch raises a `TypeError`."** False. Bun's docs state the call falls back to a
   compiled slow path and the program behaves as under `bun run`. Measured: `double("3")` prints
   `6` both ways ([docs](https://bun.com/docs/compiler/types)).
2. **"`as` performs a real type conversion, so `(raw as number) + 1` gives `6` instead of `51`."**
   False. Measured: still `"string 21"`, identical to `bun run`. The docs say a cast from a looser
   type costs a guard and never converts; to convert, write `Number(...)`
   ([docs](https://bun.com/docs/compiler/types)).

The source of both is [a Korean-language summary](https://fr.news.hada.io/topic?id=35124) whose other
claims — build-time type checking, read-only prototypes — are accurate. Note also that the same page
lists the flag as `--compile --aot`; the shipped command is `bun compile`.

---

## Changelog

- 2026-11-23 — Created. Feature identified via TinyFish search; primary facts from
  `bun.com/docs/compiler/*`. Every semantic-divergence claim, both binary sizes, the typed
  percentage and the startup comparison measured locally on Bun canary (`1.4.4` + canary upgrade,
  Linux x64). Confirmed absent from all released 1.4.x versions.

## See also

- [Bun's `bun build --compile` — Bundling, Not Compiling](./bun-aot-compiler.md) — the older
  single-file executable feature this one is *not*
- [oh-my-pi — Native Rust Core](./oh-my-pi-native-rust-core.md) — what rewriting a JS runtime in a
  native language actually costs and buys
