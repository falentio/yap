---
title: Pi Coding Agent — Which AGENTS.md Files It Loads (Subdirectory Scope)
category: technology
tags: [pi, pi-coding-agent, agents-md, context-files, instructions, earendil]
status: complete
created: 2026-10-12
updated: 2026-11-10
sources:
  - https://pi.dev/
  - https://github.com/code-yeongyu/pi-nested-agents-md
  - https://www.npmjs.com/package/@earendil-works/pi-coding-agent
  - local install @earendil-works/pi-coding-agent@1.1.0: dist/core/resource-loader.js, dist/cli/args.js, docs/configuration.md, docs/security.md
confidence: high
---

# Pi Coding Agent — Which AGENTS.md Files It Loads (Subdirectory Scope)

## TL;DR

- **No.** Pi does **not** read `AGENTS.md` files from subdirectories of the
  repo. It loads context files from exactly three places, once, at session
  start: the agent directory, the working directory, and the working
  directory's **ancestors** (walking up to `/`).
- A file like `src/AGENTS.md` loads only when pi is launched with its working
  directory at or below `src` — making it the cwd or an ancestor of the cwd.
  Launching from the repo root leaves `src/AGENTS.md` unread.
- Discovery is **static**, not on-demand: it is not re-run when the agent
  reads a file inside a subdirectory. Nested per-directory context is a
  third-party extension's job — `pi-nested-agents-md` injects ancestor
  `AGENTS.md` files into the `read` tool result.
- One file per directory wins, chosen in this priority order:
  `AGENTS.override.md` -> `AGENTS.md` -> `AGENTS.MD` -> `CLAUDE.md` ->
  `CLAUDE.MD`. `AGENTS.override.md` replaces (does not merge with) the other
  names **in the same directory only**.

## Context

Question asked: does pi coding agent read AGENTS.md in a subdirectory of the
repo? The answer lives in the resource loader (`loadProjectContextFiles`), and
it is reproducible with a one-shot prompt against a scratch directory tree.

Verified against the local install of `@earendil-works/pi-coding-agent`
**v1.1.0**, read 2026-10-12. Line references point at that installed `dist`
(the shipped bundle):
`~/.vite-plus/packages/@earendil-works/pi-coding-agent/fa83c445-1289-4326-a562-1fb00d11ecfd/`.

## Findings

### The discovery algorithm

`loadContextFileFromDir(dir)` picks at most one file per directory
(`dist/core/resource-loader.js:115-134`):

the candidate list is, in order: `AGENTS.override.md`, `AGENTS.md`,
`AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD`.

The first existing candidate wins; the other names in that directory are not
read at all. `loadProjectContextFiles` then composes the list
(`dist/core/resource-loader.js:165-193`):

1. The agent directory's context file loads first (global scope).
2. It then walks from `cwd` to the filesystem root, collecting one context
   file per directory and `unshift`-ing each, so the final list reads
   outermost-first with the cwd's file last.

There is **no downward traversal**. Nothing in the loader enumerates
subdirectories of cwd, and nothing re-runs discovery per tool call.

### What that means, directory by directory

| Location, relative to the working directory | Loaded at startup? | Why |
|---|---|---|
| `~/.pi/agent/AGENTS.md` (agent dir) | Yes | Global context, loaded first, outside the repo walk |
| `./AGENTS.md` (the cwd) | Yes | cwd is the first directory the ancestor walk reads |
| `../AGENTS.md`, `../../AGENTS.md`, ... up to `/` | Yes | The walk continues up through every ancestor |
| `./src/AGENTS.md` (subdirectory of cwd) | No | Never visited — the walk only goes up |
| `./packages/api/AGENTS.md` | No | Same |
| A sibling directory of the cwd | No | Not on the ancestor chain |
| `./src/AGENTS.md` when cwd is `./src` | Yes | It is now the cwd itself |
| `./AGENTS.override.md` next to `./AGENTS.md` | Yes, the override wins | Same-directory replacement, not a merge |
| `./CLAUDE.md` when `./AGENTS.md` exists | No | `AGENTS.md` outranks it in the candidate list |

### Reproducing it

Scratch tree: `/tmp/ctx-test/root/AGENTS.md` says `CODEWORD-ROOT`,
`/tmp/ctx-test/root/sub/AGENTS.md` says `CODEWORD-SUB`. Three one-shot runs
that read no files and ask only for the passphrases already in context:

| cwd | Answer | Reading |
|---|---|---|
| `/tmp/ctx-test/root/sub` | `CODEWORD-ROOT, CODEWORD-SUB` | `sub` is the cwd, so both its own file and the ancestor load |
| `/tmp/ctx-test/root` | `CODEWORD-ROOT` | `sub/` is now a subdirectory and is not visited |
| `/tmp/ctx-test/root/deep` (no AGENTS.md anywhere in `deep`) | `CODEWORD-ROOT` | Still only ancestors, never siblings or children |

The programmatic check through the exported `loadProjectContextFiles` agrees:
with `cwd=/tmp/ctx-test/root/sub` it returns the agent-dir file,
`/tmp/ctx-test/root/AGENTS.md`, and `/tmp/ctx-test/root/sub/AGENTS.md`; the
nested `deeper/AGENTS.md` never appears from any of the three cwds.

### Getting subdirectory context anyway

| Approach | How | Trade-off |
|---|---|---|
| Launch from the subdirectory | `cd src && pi` | Scope is fixed for the whole session; loses repo-root resolution |
| Third-party extension | [`pi-nested-agents-md`](https://github.com/code-yeongyu/pi-nested-agents-md) walks up from each file the agent reads and appends the nearest `AGENTS.md` files to the `read` result | Not core; per-session dedupe, 32 KiB per file and 128 KiB per read caps, needs an `npm install` in its directory |
| Manually | Reference `./src/AGENTS.md` from the root file, or paste it | No magic; the agent must actually read it |

## Gotchas

- **Discovery is not dynamic.** Only `/reload` re-reads context files
  mid-session; adding `src/AGENTS.md` while pi runs does nothing until then.
- **Context files ignore project trust.** They load even when the project is
  untrusted, so treat any folder's instructions as untrusted input
  (`docs/security.md:57`). `-nc` / `--no-context-files` disables discovery
  entirely for a run (`dist/cli/args.js:329`).
- **One file per directory.** `AGENTS.override.md` does not *add* to
  `AGENTS.md`; it stands in for it in that directory. `CLAUDE.md` and
  `AGENTS.md` in the same folder never both load.
- **Nested git worktrees are deduped.** A linked worktree nested under its
  main repo would otherwise load the main repo's context file twice; pi
  detects that and skips the shadowed copy
  (`dist/core/resource-loader.js:136-163`).
- **The walk is cwd-based, not repo-based.** Parent directories above the repo
  load too, so `~/AGENTS.md` or `/home/AGENTS.md` is picked up on the way to
  `/`.

## Open Questions

- Whether a future pi release adds opt-in nested discovery; today nested
  loading is cited third-party behavior only.
- Whether the SDK's `agentsFilesOverride` is a better seam than an extension
  for teams wanting a repo-defined nested policy. [unverified]

## Related

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — how each agent shortens a full context window, and what T3's handoff does differently
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md)
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md)
- [Pi Per-Project Configuration — the .pi Directory and the Project-Trust Gate](../reference/pi-project-configuration.md) — the `AGENTS.md` discovery rule beside the trust-gated `.pi` tree: context files load either way, and `packages/AGENTS.md` still needs the cwd.

## Changelog

- 2026-11-10 — linked the per-project configuration reference.
- 2026-10-12 — created. Source read of `resource-loader.js` at pi v1.1.0, plus
  three live one-shot runs confirming cwd-and-ancestors-only discovery.
