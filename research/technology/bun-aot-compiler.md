---
title: Bun's AOT Compiler — `bun build --compile` Standalone Executables
category: technology
tags: [bun, bundler, aot, standalone-executable, javascriptcore, bytecode, cli-distribution, deno, node-sea]
status: complete
created: 2026-11-23
updated: 2026-11-23
sources:
  - https://bun.com/docs/bundler/executables
  - https://bun.com/blog/bun-v1.1.30
  - https://flaviocopes.com/javascript-single-executable/
  - https://bunup.dev/docs/advanced/compile.html
  - https://github.com/oven-sh/bun/issues/39800
  - https://github.com/oven-sh/bun/issues/45374
confidence: high
---

# Bun's AOT Compiler — `bun build --compile` Standalone Executables

> **Not the same feature as `bun compile`.** This file covers `bun build --compile`, which
> bundles JavaScript into a copy of the Bun runtime. Bun's *experimental* AOT compiler —
> `bun compile` / `--aot`, which emits native machine code driven by your TypeScript types — is
> a separate, newer, canary-only feature. See
> [Bun's Experimental AOT Compiler](./bun-compile-aot-native.md).

## Summary

There is no separate "Bun AOT compiler" binary. Ahead-of-time compilation in Bun is a
**flag on the bundler**: `bun build ./cli.ts --compile --outfile mycli`
([Bun docs](https://bun.com/docs/bundler/executables)). Bundling and "compiling" are the same
pass: the bundler walks your imports, inlines your code and npm dependencies, then splices the
result into a copy of the Bun runtime (JavaScriptCore included) to produce one native executable.

"Compile" here does **not** mean machine code generation from your JavaScript. Your code travels
inside the binary as source (or as JSC bytecode with `--bytecode`), and the runtime loads it at
startup — the same model as `deno compile` and Node's `node --build-sea`
([flaviocopes.com, 2026-10-07](https://flaviocopes.com/javascript-single-executable/)). What some
of Bun's flags do *is* genuine ahead-of-time work: parsing (`--bytecode`), layout
(`--bytecode-order`) and constant folding (`--define`) move runtime cost to build time.

---

## How it works

The pipeline, from entrypoint to running process:

```text
cli.ts
  │  bundler: resolve imports, inline npm deps, apply --define / plugins / minify
  ▼
bundled module graph (JS, or JSC bytecode with --bytecode)
  │  linker: append to a downloaded/cached Bun runtime binary
  ▼
./mycli  ← one file: Bun runtime + your module graph (+ embedded assets)
  │  exec
  ▼
Bun initialises → loads the embedded module graph from /$bunfs → runs your entrypoint
```

Two implementation details matter in practice:

- **The embedded filesystem is `/$bunfs`.** Files embedded with `with { type: "file" }` or
  `--asset` appear inside the binary at `/$bunfs/root/...` and are readable through `Bun.file()`
  and `node:fs` ([docs](https://bun.com/docs/bundler/executables)).
- **Cross-compilation downloads a runtime per target.** Bun fetches the runtime for the target
  it lacks and caches it, which is why `--target` works from one machine
  ([flaviocopes.com](https://flaviocopes.com/javascript-single-executable/)).

---

## Flags that change what "AOT" means

| Flag | What moves to build time | Measured effect |
| --- | --- | --- |
| *(none)* | Module resolution, inlining of npm deps | Baseline: 90,798,048 B binary for a 6-line CLI here |
| `--minify` | Dead code, identifier length, whitespace | Docs claim MBs saved on a large app; on a tiny app it grew the binary here (see Gotchas) |
| `--bytecode` | JSC parse + optimize passes per module | Docs: `tsc` starts 2× faster |
| `--no-optimize-bytecode` | Skips the optimizer passes | Correctness escape hatch |
| `--bytecode-order=<file>` | Bytecode layout, from a recorded profile | Docs: cold start 1.0s → 0.53s; −40 MB startup RSS on a large CLI |
| `--compile-jit-policy <n>` | JIT tier-up thresholds scaled at startup | Keeps startup code in the interpreter longer |
| `--define K=V` | Constant folding, dead-branch elimination | Zero runtime cost |
| `--splitting` | Lazy chunks stay on disk, loaded at runtime | Breaks the "one file" property |

The profile-guided layout (`--bytecode-order`) is the most interesting one: run the binary once
with `BUN_BYTECODE_ORDER_OUT=myapp.order`, rebuild with that profile, and JavaScriptCore's hot
bytecode lands contiguously at the front of the file so the loader reads and decodes less of it.
Functions are matched by a **hash of their syntax**, not by name or position, so a stale profile
still applies to changed code and one profile works for every `--target`
([docs](https://bun.com/docs/bundler/executables)). `bytecodeOrderStats()` from `bun:jsc` reports
`hot`/`cold` coverage, which is the signal to re-record.

---

## Cross-compilation targets

| `--target` | OS | Arch | Libc |
| --- | --- | --- | --- |
| `bun-linux-x64` | Linux | x64 | glibc |
| `bun-linux-arm64` | Linux | arm64 | glibc |
| `bun-linux-x64-musl` | Linux | x64 | musl (Alpine) |
| `bun-linux-arm64-musl` | Linux | arm64 | musl |
| `bun-darwin-x64` | macOS | x64 | — |
| `bun-darwin-arm64` | macOS | arm64 | — |
| `bun-windows-x64` | Windows | x64 | — |
| `bun-windows-arm64` | Windows | arm64 | — |

Segments may come in any `-`-delimited order, and x64 `.exe` is added automatically for Windows
([docs](https://bun.com/docs/bundler/executables)). On x64, Bun ships **one** binary targeting
Nehalem (SSE4.2) that selects AVX2/AVX-512 paths at runtime; the legacy `-baseline` and `-modern`
suffixes resolve to that same binary, so there is no longer a CPU tier to choose.

---

## Size and startup, measured three ways

Independent benchmark from 2026-10-07, one small read-a-Markdown-file CLI, Apple Silicon, startup
as the median of 40 runs ([flaviocopes.com](https://flaviocopes.com/javascript-single-executable/)):

| Implementation | File size (macOS) | File size (Linux x64) | Startup |
| --- | --- | --- | --- |
| Rust (same tool) | 446 KB | — | 1.3 ms |
| Bun | 62 MB | 81 MB | 7 ms |
| Deno | 68 MB | 105 MB | 20 ms |
| Node.js SEA | 146 MB | 150 MB | 24 ms |

Bun produced the smallest and fastest of the three; the win traces back to the Bun runtime binary
being smaller than Node's to begin with, not to the compile step
([flaviocopes.com](https://flaviocopes.com/javascript-single-executable/)).

**Reproduced here, 2026-11-23, Bun 1.4.3, Linux x64 glibc:**

```text
6-line CLI, no flags                     90,798,048 B  (86.6 MiB)
6-line CLI, --minify --bytecode          92,264,416 B  (88.0 MiB)   +1.6%
empty "console.log" entrypoint           90,798,048 B  — proves the floor is the runtime
wall time, ./plain cli.ts (3 runs)       0.01 0.01 0.01 s
wall time, ./mini  cli.ts (3 runs)       0.00 0.00 0.00 s
```

Two conclusions from that: the ~86 MiB floor is **entirely the Bun runtime**, so an empty program
and a small one cost the same; and `--minify`/`--bytecode` **added** 1.6% here rather than
shrinking it — the docs' size claim is about large applications where dead code dominates.

The docs are honest about the ceiling: *"Bun's binary is still way too big and we need to make it
smaller"* ([docs](https://bun.com/docs/bundler/executables)).

---

## Bun vs Deno compile vs Node SEA

Wide comparison across the three built-in single-executable tools:

| Dimension | Bun `build --compile` | Deno `compile` | Node `--build-sea` |
| --- | --- | --- | --- |
| Build command | Flag on the bundler | Own subcommand | Flag on `node` + bundler |
| Bundles npm deps | Yes, automatically | Yes (`--bundle`), else embeds tree | No — you bundle first |
| Bundle size (Linux x64) | 81 MB | 105 MB | 150 MB |
| Startup | 7 ms | 20 ms | 24 ms |
| Ahead-of-time bytecode | `--bytecode`, `--bytecode-order` | No | `useCodeCache` |
| Cross-compile | `--target` (8 targets) | `--target` (6 targets) | Per-platform build |
| Permission model | None baked in | Baked in at compile time | None |
| Type check at build | No | Yes (default; `--no-check`) | No |
| Native `.node` addons | Embeddable | `--self-extracting` | Write out and load manually |
| Swap the engine | No (JSC fixed) | `--engine quickjs` (~37 MB) | No (V8 fixed) |
| Runtime your code ends on | Bun | Deno | Node |

Sources: sizes/startup from [flaviocopes.com](https://flaviocopes.com/javascript-single-executable/);
Bun-specific flags from [Bun docs](https://bun.com/docs/bundler/executables).

The decision in one line: pick Bun for the smallest, fastest artifact and happiest npm story; Deno
when you want permissions locked into the binary or a swappable small engine; Node SEA when the
program genuinely needs Node's semantics and a vendored Node cannot be avoided
([flaviocopes.com](https://flaviocopes.com/javascript-single-executable/)).

Vercel's `pkg` is archived at 5.8.1 and its README redirects to Node SEA; the maintained fork is
`@yao-pkg/pkg`. `nexe` is likewise legacy. Neither is a candidate for new work
([flaviocopes.com](https://flaviocopes.com/javascript-single-executable/)).

---

## Embedding assets, output mode, and runtime config

| Feature | Mechanism | Note |
| --- | --- | --- |
| Single file | `with { type: "file" }` | Returns a `/$bunfs/...` path string |
| Whole directory | `--asset ./public` (repeatable) | Lives under `import.meta.dir`; symlinks and empty dirs skipped |
| Text inline | `.txt` or `with { type: "text" }` | Stored once, returned without a heap copy; not in `Bun.embeddedFiles` |
| SQLite | `with { type: "sqlite", embed: "true" }` | Read-write, but **in memory** — writes vanish on exit |
| N-API addon | `require("./addon.node")` | `node-pre-gyp` indirection must resolve directly |
| Frontend assets | `import index from "./index.html"` | v1.2.17+; `Bun.serve` serves them with correct MIME/cache |
| Standalone check | `Bun.isStandaloneExecutable` | Cheap; unlike `embeddedFiles.length`, allocates no `Blob`s |
| Workers | Add the worker file as an extra entrypoint | Static `new Worker()` detection does not exist yet |
| Runtime args | `--compile-exec-argv` → `process.execArgv` | Or `BUN_OPTIONS` env at run time |
| Act as the Bun CLI | `BUN_BE_BUN=1` | v1.2.16+; ignores the embedded entrypoint |

Config loading differs between dev and prod by design: in a standalone executable
`tsconfig.json` and `package.json` loading is **off** by default, while `.env` and
`bunfig.toml` loading is **on** — and the docs warn the latter two may flip to off in a future
version. Opt in or out explicitly (`--compile-autoload-*`, `--no-compile-autoload-*`) if your
deployment depends on determinism ([docs](https://bun.com/docs/bundler/executables)).

---

## Gotchas

### `--bytecode` does not hide your source

This is the single most common misconception. The JavaScript sits inside the executable as text:

```text
$ strings plain | grep -o 'split(/'      → split(/
$ strings mini  | grep -o 'cli.ts: '     → cli.ts:      # --bytecode build, same leak
```

Measured here on Bun 1.4.3, and confirmed independently for all three runtimes by
[flaviocopes.com](https://flaviocopes.com/javascript-single-executable/). The docs say it plainly:
*"Bytecode compilation doesn't obscure source code."* Never put secrets in the source.

`Bun.embeddedFiles` deliberately excludes bundled `.ts`/`.js` — which is a listing exclusion, not
protection ([docs](https://bun.com/docs/bundler/executables)).

### `BUN_BE_BUN` and `BUN_OPTIONS` turn a signed binary into a script runner

An open issue (2026-10-15, Bun 1.4.x) documents this as a real macOS trust-boundary problem:
`BUN_BE_BUN=1` is checked natively in `cli.zig` **before** the embedded module graph loads, so the
app cannot refuse it; `BUN_OPTIONS="--preload <file>"` runs caller code before your entrypoint;
`BUN_INSPECT`/`BUN_INSPECT_CONNECT_TO` attach a debugger that can evaluate code. A keychain item
ACL-pinned to the executable's signing identity is then readable by any local process that takes
one of those paths. The requested fix — `--no-compile-be-bun`, `--no-compile-bun-options` — does
not exist yet; `--no-compile-autoload-bunfig` covers only the `bunfig.toml` `preload` variant
([oven-sh/bun#45374](https://github.com/oven-sh/bun/issues/45374)).

Until it ships: do not sign a compiled Bun executable as a secret-bearing trust anchor.

### Sourcemaps leak native memory on every thrown error

Open bug, reproduced by a Bun collaborator on 1.4.0-canary: with **any** sourcemap mode other
than `none`, each `error.stack` read leaks roughly one native string (~47 B/request in the
reproduction) in the C++ stack-remapping path. A 150-connection load test pushed RSS from 119 MB
to a stuck 554 MB with `--sourcemap`; the `--sourcemap=none` build settled flat at 121 MB. The
leak is native, so `Bun.gc(true)` does not reclaim it
([oven-sh/bun#39800](https://github.com/oven-sh/bun/issues/39800)).

The uncomfortable tradeoff: the docs recommend `--sourcemap` for production, and this is the
one class of app that cannot ship it — a long-lived server that throws on hot paths.

### Dynamic paths are invisible to the bundler

A computed `import()`, a worker, or a `./my.db` path is not a static import, so it is not
embedded. Bun then resolves it **relative to the process's current working directory** and errors
if absent — the cause of the recurring "compiled executable can't find a module" reports
([oven-sh/bun#14649](https://github.com/oven-sh/bun/discussions/14649), modern-SQLite note in
[docs](https://bun.com/docs/bundler/executables)). Fix by listing the file as an extra entrypoint,
embedding it with `--asset`, or using `with { type: "file" }`; `--disallow-code-generation-from-strings=strict`
makes the refusal explicit instead of filesystem-dependent.

### Unsupported flags

`--outdir` (use `--outfile`), `--public-path`, `--target=node`, `--target=browser` (except HTML
entrypoints), and `--no-bundle` — Bun always bundles everything. Verified locally:
`error: cannot use --compile with --outdir`
([docs](https://bun.com/docs/bundler/executables)).

### Platform details worth knowing

- **macOS signing:** a Bun executable needs JIT entitlements — `com.apple.security.cs.allow-jit`
  and friends — and codesigning *support* needs Bun ≥ 1.2.4
  ([docs](https://bun.com/docs/bundler/executables)).
- **Windows metadata:** `--windows-icon`, `--windows-hide-console`, and title/publisher/version
  are set at build time, but **only `hideConsole` survives cross-compilation** — the rest need
  Windows APIs.
- **One file per platform:** a macOS binary does not run on Linux, and x64 Linux does not run on
  ARM servers.

---

## When to reach for it

Use `bun build --compile` for:

- **CLI distribution** — one file, no `node_modules`, no runtime prerequisite. This is the
  strongest case and the one the docs' own example uses.
- **Startup-sensitive CLIs** — `--bytecode` plus a recorded `--bytecode-order` profile is the
  only PGO story among the three built-in tools.
- **Full-stack single artifacts** — v1.2.17+ embeds HTML/CSS/JS referenced from server code, so a
  `Bun.serve` app ships as one file with no separate static-asset deploy step.
- **Replacing a vendored Node** — small container images and appliance-style deploys.

Do **not** reach for it for:

- **Hiding code or secrets** — a `strings` run recovers your source, bytecode or not.
- **Small binaries** — the ~86 MiB floor is paid even by an empty program; Rust is 200× smaller.
- **Long-lived servers that throw** — the sourcemap leak is unbounded on the error path.
- **Secret-bearing signed binaries** — `BUN_BE_BUN`/`BUN_OPTIONS`/`BUN_INSPECT` remain open
  escape hatches.

---

## Changelog

- 2026-11-23 — Added a pointer to `./bun-compile-aot-native.md`; clarified in the summary that
  `bun build --compile` is bundling, not the experimental `bun compile` AOT compiler.
- 2026-11-23 — Created. All external facts via TinyFish search + `fetch_content`. Size, startup,
  source-visibility, embedded-file, and unsupported-flag results measured locally on Bun 1.4.3
  (Linux x64 glibc) rather than taken from docs.

## See also

- [Bun's Experimental AOT Compiler (`bun compile`)](./bun-compile-aot-native.md) — the *other*
  AOT feature: TypeScript types lowered to native machine code via JSC's B3, canary-only
- [Vite CLI Dependencies](./vite-cli-dependencies.md) — a sibling bundler-internals note (who
  parses the CLI, who performs the build)
- [Modern JavaScript Video Player Libraries](./js-video-player-libraries.md) — another 2026
  wide-table landscape comparison
