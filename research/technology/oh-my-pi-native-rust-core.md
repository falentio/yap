---
title: oh-my-pi — Native Rust Core (pi-shell, pi-natives) and the "~80k lines" Claim
category: technology
tags: [oh-my-pi, omp, rust, napi, brush-shell, coding-agent, minimizer, tokenizer, native]
status: draft
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://github.com/can1357/oh-my-pi
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-shell
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-natives
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-builtins
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/native-crates.md
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/natives-shell-pty-process.md
  - https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/natives-architecture.md
confidence: medium
---

# oh-my-pi — Native Rust Core (pi-shell, pi-natives) and the "~80k lines" Claim

## TL;DR

- **`pi-shell` is not a shell binary.** It is the Rust **runtime core** that
  runs an *embedded* bash (the [brush](https://github.com/reubeno/brush)
  interpreter, vendored at [`crates/vendor/brush-core`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/vendor/brush-core))
  *inside* the omp process, so the agent's `bash` tool needs no `/bin/bash`
  fork and no `rg`/`grep`/`find` binaries on the host.
- Its surprising size is **not** shell parsing: **~28.6k of its ~41k lines
  (≈71%) are a command-output "minimizer"** — 24 filters that rewrite verbose
  `git`, `cargo`, Gradle/JVM, Docker, npm, cloud-CLI, and lint output into a
  compact form before the model sees it.
- **`pi-natives`** is the N-API `cdylib` — the JS-facing surface. It is large
  because it is effectively a **stdlib for the agent**: grep, glob, find, text
  width/ANSI, AST (tree-sitter), syntax highlight, PTY, process mgmt, desktop
  control (screenshots/input/accessibility trees), image/PNG/SIXEL rendering,
  BPE tokenizers for 8 model families, Mermaid→ASCII, and embedded OAuth
  loopback servers.
- **The "~80k lines of Rust core" figure is stale, not inflated.** It is the sum
  of the README's own six-crate table (≈75.4k), but those same six crates
  measure **~143k raw lines** at this pinned commit — `pi-natives` alone grew
  from the stated 25k to **~81k**. Total first-party Rust under `crates/`
  (excluding vendored crates) is **~299k raw / ~246k code lines** across
  **691 `.rs` files**.

## Context

A follow-up to [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md),
which repeated the README's headline of "**~80k lines of Rust core**". This file
answers two questions raised by that number:

1. **What is `pi-shell`?** — it is listed as a crate but the feature inventory
   only said "embedded bash engine".
2. **Why is there ~80k lines of Rust?** — and is the figure even right?

Method: line counts from the pinned clone at
`40e9368ef0458fd9073329cdff4174895f91bc6b` (v18.8.4, 2026-10-08), plus the
repo's own architecture docs. Counts are `wc -l` over `*.rs` unless stated;
"code lines" means non-blank, non-comment lines (`grep -hvE '^\s*(//|/\*|\*|$)'`).

## Findings

### 1. What `pi-shell` actually is

The crate's own header is one line — "Runtime-agnostic brush shell execution"
([`crates/pi-shell/src/lib.rs`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-shell/src/lib.rs)). What that
means in practice:

- It **embeds brush**, a Rust reimplementation of bash, and drives it
  programmatically. Session creation is configured for agent use: environment
  inheritance **disabled** and rebuilt explicitly, profile/rc loading
  **skipped**, bash-mode builtins, `exec` and `suspend` disabled
  ([`docs/natives-shell-pty-process.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/natives-shell-pty-process.md)).
- Two execution modes: **one-shot** (`executeShell`) and a **persistent
  `Shell` session** whose cwd, variables, and jobs survive across tool calls —
  which is why consecutive `bash` calls in omp share state.
- It owns **process plumbing** — process groups, cancellation tokens,
  timeouts, and cross-platform process-tree kill
  ([`src/process.rs`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-shell/src/process.rs), 1,806 lines).
- It wires the **host-injected filesystem** (`pi-vfs`): shell redirections,
  globs, and `cwd` changes can be routed through a callback, so internal
  `scheme://` URLs work inside shell commands, not just in the `read` tool.
- It registers an optional **`git` builtin** (`PI_SMART_GIT`) that serves
  `git worktree add` through `pi-vcs` with copy-on-write clones, falling back
  to the real git binary for anything unsupported
  ([`src/git.rs`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-shell/src/git.rs)).

The 41k lines break down as:

| Area | ~Lines | Share |
| --- | ---: | ---: |
| `minimizer/` (output rewriting) | 28,585 | 70% |
| `shell.rs` (brush session driver) | 7,419 | 18% |
| `process.rs` (process groups, kill, cancel) | 1,806 | 4% |
| `git.rs` (smart git builtin) | 947 | 2% |
| `windows.rs`, `output_decode.rs`, `cancel.rs` | ~1,000 | 3% |
| tests | ~1,180 | 3% |
| **total** | **~40,969** | 100% |

So the honest one-liner is: **`pi-shell` ≈ 12k lines of shell runtime + 29k
lines of output minimizer.**

### 2. The minimizer — where the bulk of `pi-shell` goes

The minimizer detects what command produced a chunk of captured output, then
applies a command-aware filter to shrink it. It is not on by default in the
raw native layer; the `bash` tool passes minimizer settings into the shell
session, and when it rewrites output it **saves the original as a separate
`bash-original` artifact** first and leaves a
`[raw output: artifact://<id>]` footer
([`docs/bash-tool-runtime.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/bash-tool-runtime.md)).

Architecture: `detect` → `plan` → `pipeline` → `engine` → per-command
`filters`. A `plan` step decides between three modes — `None`,
`WholeCommand`, and `SegmentedChain` (running a safe `&&`/`;` chain
segment-by-segment so each segment gets its own filter). Filters only run on
captures of **1,000+ characters**; anything shorter passes through verbatim.

The 24 filter modules, by size:

| Filter | ~Lines | Filter | ~Lines |
| --- | ---: | --- | ---: |
| `jvm` (Gradle/Maven) | 3,066 | `cargo` | 1,005 |
| `git` | 2,844 | `bun` | 725 |
| `listing` (`ls`/`tree`-style) | 2,048 | `python` | 709 |
| `cloud` (AWS/GCP/Azure CLIs) | 1,797 | `go` | 683 |
| `docker` | 1,583 | `glab` | 620 |
| `pkg` (npm/pnpm/yarn) | 1,234 | `dotnet` | 583 |
| `ruby` | 1,138 | `js_tools` | 564 |
| `system` | 1,091 | `node_tests` | 534 |
| `lint` | 1,083 | `gt` (Graphite) | 481 |
| `rust_tools` | 171 | `gh` | 433 |
| `binary_tools` | 124 | `cpp` | 343 |
| `generic` | 19 | `mod` (dispatch/registry) | 1,035 |

Plus engine 1,345, detect 914, pipeline 701, plan 568. The `git` filter alone
handles 19 subcommands (`status`, `diff`, `log`, `worktree`, `rebase`, …),
and deliberately **passes through** patch-bearing output (`git show` file
content, `stash -p`) rather than mangling it.

This is the mechanism behind omp's claim that shell output is "minimized" —
it is a large, hand-written, per-toolchain output compactor, not a generic
truncator.

### 3. What `pi-natives` is — and why it is ~81k lines

`pi-natives` is the **top-level N-API `cdylib`**: the Rust side of
`@oh-my-pi/pi-natives`, exposing JS classes/functions and re-exporting the
other crates. `lib.rs` declares ~45 public modules
([`src/lib.rs`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-natives/src/lib.rs)).

Top-level module files (the "surface" layer):

| Module | ~Lines | What it does |
| --- | ---: | --- |
| `grep.rs` | 3,886 | ripgrep-backed search binding |
| `text.rs` | 2,110 | ANSI-aware width, truncation, column slicing, SGR-preserving wrap |
| `keys.rs` | 1,759 | Kitty keyboard protocol + xterm fallback, perfect-hash lookup |
| `snapcompact.rs` | 1,641 | bitmap-frame rasterization + PNG encode for context compression |
| `ast.rs` | 1,592 | ast-grep matching / structural rewrites |
| `vcs.rs` | 1,559 | in-process git/jj binding |
| `edit.rs` | 1,018 | edit-engine binding |
| `pty.rs` | 980 | native PTY for `sudo`/`ssh` prompts |
| `shell.rs` | 903 | shell binding over `pi-shell` |
| `highlight.rs` | 890 | syntax highlighting (11 semantic categories, 30+ aliases) |
| `diff.rs` | 684 | structured diffing |
| `task.rs` | 680 | blocking work on the libuv pool, cancellation, timeout |
| `fd.rs` | 667 | filesystem walker |
| `crash_handler.rs` | 607 | native crash capture/reporting |
| `tty_writer.rs` | 580 | terminal writes |
| `power.rs` | 528 | macOS power assertions |
| `glob.rs` | 518 | glob discovery |
| `clipboard.rs`, `appearance.rs`, `js.rs`, `glob_util.rs`, `workspace.rs`, `iso.rs`, `ps.rs`, `sixel.rs`, `prof.rs` | 234–476 each | clipboard, dark/light detection, JS bridge, walker, workspace scan, isolation, process tree, SIXEL image rendering, flamegraph profiler |

…and **four large subtrees** that explain the crate's growth:

| Subtree | ~Lines | What it does |
| --- | ---: | --- |
| `desktop/` | 28,977 | window/display enumeration, screen capture, native input, and OS **accessibility (AX) trees** for macOS / Windows / Linux (X11 + Wayland) — the engine behind the `computer` tool |
| `mermaid/` | 12,821 | Mermaid → ASCII/Unicode renderer: flowcharts (Sugiyama layering + A* edge routing), sequence, class, ER, and XY-chart diagrams |
| `utok/` | 5,462 | **Universal offline tokenizer**: exact BPE counting for 8 model families (o200k, cl100k, Claude, Qwen3, DeepSeek V3, Kimi K2, GLM-5, Jev) with vocab data zstd-embedded — no network, no tokenizer runtime |
| `oauth_callback/` | 4,891 | per-OS embedded OAuth loopback callback servers (darwin/linux/win32) |

Note that the README's own per-crate table describes `pi-natives` as "The
N-API surface — every module in the table below | 25,000", and its per-module
table omits `desktop`, `mermaid`, `utok`, `oauth_callback`, `vcs`,
`edit`, `shell`, `pdf`, `svg`, `predict`, and others. That omission is
where the stale 25k figure comes from.

### 4. The other crates

First-party crates (raw `*.rs` lines / code-only lines):

| Crate | Raw | Code | Role |
| --- | ---: | ---: | --- |
| `pi-builtins` | 97,618 | 77,521 | bash builtins + in-process coreutils-class utilities |
| `pi-natives` | 81,062 | 67,202 | N-API surface (above) |
| `pi-shell` | 40,969 | 33,146 | embedded shell + minimizer (above) |
| `pi-edit` | 30,113 | 27,057 | hashline/patch edit engine, streaming previews, atomic apply |
| `pi-vcs` | 13,162 | 11,211 | in-process git (**gitoxide**) and jj (**jj-lib**) |
| `pi-predict` | 8,284 | 6,439 | word-completion engines (ngram, SmolLM, macOS spelling) |
| `pi-walker` | 7,568 | 6,371 | parallel ignore-aware filesystem walker + scan cache |
| `pi-vfs` | 6,408 | 5,139 | injectable async filesystem (URL-preserving) |
| `pi-iso` | 4,845 | 3,809 | isolation backends: APFS, btrfs/ZFS reflink, overlayfs, ProjFS, rcopy |
| `pi-ast` | 4,646 | 3,761 | tree-sitter/ast-grep language registry + summarization |
| `pi-voice` | 3,708 | 2,953 | mic/playback, Opus, live WebRTC |
| `pi-diff` | 1,020 | 858 | jsdiff-compatible Myers diff, no FFI |

Vendored (`crates/vendor/`, patched via `[patch.crates-io]`): `napi`
30,839, `brush-core` 27,407, `brush-parser` 10,102, `cfg_aliases` 372,
`tree-sitter-go` 74.

### 5. `pi-builtins` — the other half of "in-process"

`pi-builtins` is where the "no `fork/exec`" claim is cashed out. Its
`Cargo.toml` header is explicit: it is a locally-patched fork of brush's
`brush-builtins` for the POSIX/bash builtins, **plus** one module per
in-process command-line utility, ported from uutils coreutils/findutils/sed and
jaq ([`crates/pi-builtins/Cargo.toml`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-builtins/Cargo.toml),
[`crates/pi-builtins/LICENSE`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-builtins/LICENSE)).

Measured registry contents at this commit:

- `default_builtins()` — 114 distinct names (bash builtins and aliases).
- `utility_builtins()` — **60** utility commands: `cat`, `ls`, `sed`,
  `sort`, `uniq`, `wc`, `head`, `tail`, `find`, `grep`, `rg`,
  `fd`, `diff`, `jq`, `xargs`, `tr`, `cut`, `paste`, `comm`,
  `mkdir`, `rm`, `mv`, `cp`, `ln`, `stat`, `touch`, `tee`,
  `truncate`, `seq`, `date`, `hostname`, `uname`, `whoami`, `which`,
  `realpath`, `readlink`, `basename`, `dirname`, `nproc`, `mktemp`,
  `printenv`, the checksum family (`md5sum`, `sha1sum`, `sha224sum`,
  `sha256sum`, `sha384sum`, `sha512sum`, `b2sum`, `cksum`), `base32`,
  `base64`, `sponge`, `ifne`, `isutf8`, `ts`, `combine`, `errno`,
  `yes`.
- `process_builtins()` — **8** more: `nohup`, `pgrep`, `pidwait`,
  `pkill`, `ps`, `sleep`, `timeout`, `top`.

The README cites "**58**" utilities in §09 and "**67**" in the crate table; the
measurable basis is **60 utility + 8 process builtins = 68** registered names
(excluding two internal helpers), so both README figures are in the right
neighbourhood but neither matches exactly. `[unverified]` which count is
canonical.

The utilities were formerly ~50 separate vendored crates driven through a
thread-local I/O shim; they are now ordinary builtins against an explicit
`host::Host` view of the shell (`src/host.rs`) — the crate header calls this
out as the consolidation that produced the current layout.

### 6. Verdict on the "~80k lines" figure

| Measurement | Lines |
| --- | ---: |
| README headline ("Roughly ~80,000 lines of Rust core") | ~80,000 |
| Sum of the README's own six-crate table (38k + 25k + 5.2k + 3.3k + 2.9k + 1k) | 75,400 |
| **Same six crates, measured at this commit** | **142,798** |
| All first-party crates under `crates/` (excl. `crates/vendor`) | 299,403 |
| …code-only (excl. blanks/comments) | 245,822 |
| All of `crates/` incl. vendored | 368,197 |
| `.rs` file count | 691 |

**The headline is a stale understatement, not marketing inflation.** The
README's per-crate table (which the "~80k" figure is the sum of) still lists
`pi-natives` at 25,000 lines against a measured ~81,062, and its
`pi-natives` sub-table omits the four large subtrees that now dominate the
crate (`desktop` 29k, `mermaid` 13k, `utok` 5.5k, `oauth_callback` 4.9k).
The README's second claim — "Another ~80k lines ride along vendored" — is in the
same ballpark as the measured `crates/vendor` total (68,794 raw), though it
frames the builtins as vendored when they now live in the first-party
`pi-builtins` crate.

## Open Questions

- Which of "58" / "67" / 60+8 is the canonical in-process utility count? The
  registry yields 60 + 8; the README says both 58 and 67. `[unverified]`
- Are the per-crate LoC numbers in the README generated from a script (and thus
  just stale) or hand-maintained? `[unverified]` — the repo ships
  `scripts/session-stats/` but no obvious LoC-table generator was found.
- `pi-builtins` carries ported uutils/jaq logic under their own licenses; the
  effective license surface of a distributed `omp` binary is worth a separate
  read of `THIRD-PARTY-NOTICES.txt`. `[unverified]`
- Whether the minimizer is on by default end-to-end (the native layer defaults
  `enabled: true` in tests, but the `bash` tool supplies the real config).
  `[unverified]`

## Related

- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md)
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — the opposite design point: durability via storage + tasks, "anywhere there is a JavaScript runtime"

## Changelog

- 2026-10-08 — created. Line counts measured with `wc -l` / `grep -v` over the
  pinned clone `40e9368ef0458fd9073329cdff4174895f91bc6b` (v18.8.4); architecture
  claims cited to `docs/native-crates.md`, `docs/natives-shell-pty-process.md`,
  and `docs/natives-architecture.md`. **TinyFish was unavailable in this
  environment** (no `mcp__tinyfish__*` tools registered); per AGENTS.md §2.6 the
  fallback was the project's own source plus its in-repo docs — no third-party
  web search or scraping was used.
