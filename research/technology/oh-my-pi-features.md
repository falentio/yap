---
title: oh-my-pi (omp) — Feature Inventory
category: technology
tags: [coding-agent, ai, cli, rust, typescript, lsp, dap, subagents]
status: draft
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://github.com/can1357/oh-my-pi
  - https://omp.sh
  - https://www.npmjs.com/package/@oh-my-pi/pi-coding-agent
confidence: medium
---

# oh-my-pi (omp) — Feature Inventory

## TL;DR

- **oh-my-pi** ("omp") is an MIT-licensed, terminal-first coding agent by
  **Stencil Labs** ([@can1357](https://github.com/can1357)), forked from Mario
  Zechner's **Pi** ([pi-mono](https://github.com/badlogic/pi-mono)). Repo:
  [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi).
- It markets itself as "a coding agent with the IDE wired in": **30 built-in
  tools** (README says 31), **14 LSP ops**, **28 DAP debug ops**, **60+ model providers**, **23
  web-search backends**, and (per its README) roughly **~80k lines of Rust** doing in-process
  work other harnesses shell out for.
- Differentiators vs. peers: an embedded **native toolchain** (in-process
  ripgrep/glob/find + an embedded bash with 67 in-process utilities), **real
  LSP and DAP integration**, **hashline** content-hash edits, **first-class
  subagents** with workspace isolation, **stream-time rule injection (TTSR)**,
  an **advisor** watchdog model, **collab** live session sharing, and
  **ACP/RPC/SDK** embedding.
- Distribution: npm `@oh-my-pi/pi-coding-agent`, a curl installer at
  [omp.sh](https://omp.sh), Homebrew tap, Nix flake, and Windows PowerShell
  installer. Weekly npm downloads were **240,513** for the week ending
  2026-10-04.

## Context

Researched on **2026-10-08** to inventory the feature surface of the `omp`
coding agent, primarily from its own repository at a pinned commit so the
claims survive branch movement. Scope: user-facing features (tools, commands,
providers, integrations), not a code review.

**Pinned revision.** `40e9368ef0458fd9073329cdff4174895f91bc6b` — version
**18.8.4**, released 2026-10-08 ([`package.json`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/package.json),
[CHANGELOG](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/CHANGELOG.md)). Read 2026-10-08.

## Findings

### 1. Project identity and shape

| Field | Value |
| --- | --- |
| Name / CLI | `oh-my-pi` / `omp` |
| Owner | Stencil Labs, Inc. ([stencil.so](https://stencil.so)) |
| Upstream | Fork of Pi (`badlogic/pi-mono` by @mariozechner) |
| License | MIT (vendored `brush-core` keeps its upstream license) |
| Version at read | 18.8.4 (2026-10-08) |
| Language | TypeScript (Bun runtime) + Rust native crates |
| Platforms | macOS, Linux, Windows (x64 + arm64) |
| Stars / forks | 34,584 / 3,755 (GitHub API, 2026-10-08) |

Source: [`README.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`package.json`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/package.json).

### 2. Built-in tools (30 in the registry, plus 2 settings-gated)

The canonical list is the `BUILTIN_TOOLS` factory map in
[`src/tools/index.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/index.ts) — 30 names (`BUILTIN_TOOL_NAMES` in
[`src/tools/builtin-names.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/builtin-names.ts)
holds the same 30):
`read`, `bash`, `edit`, `ast_grep`, `ast_edit`, `ask`, `debug`,
`ida`, `eval`, `github`, `glob`, `grep`, `find`, `lsp`,
`checkpoint`, `rewind`, `context_notes`, `new_context`, `security_scan`,
`task`, `wait`, `todo`, `web_search`, `write`, `memory_edit`,
`retain`, `recall`, `reflect`, `learn`, `manage_skill`. Three hidden tools
(`yield`, `goal`, `think`) exist but are not advertised.

Highlights, with what makes each unusual:

- **`read`** — one `path` string handles files, directories, archives,
  SQLite databases, PDFs, notebooks, images, documents, **URLs**, remote
  `ssh://` paths, and internal `scheme://` URIs. Documented at
  [`docs/tools/read.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/read.md).
- **`edit`** — default **hashline** mode: the model anchors edits to
  **content hashes** instead of retyping lines, so stale anchors are rejected
  before a bad patch lands ([README §11](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **`ast_grep` / `ast_edit`** — structural search and rewrites over 50+
  tree-sitter grammars; `ast_edit` returns a *proposed* card and applies
  atomically after an `xd://resolve` accept ([README §19](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **`eval`** — persistent **Python and JavaScript/Bun** kernels where the
  cell code can call back into the agent's own tools over a loopback bridge
  ([`docs/python-repl.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/python-repl.md),
  [`docs/tools/eval.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/eval.md)).
- **`lsp`** — 14 actions: `diagnostics`, `definition`, `references`,
  `hover`, `symbols`, `rename`, `rename_file`, `code_actions`,
  `type_definition`, `implementation`, `status`, `reload`,
  `capabilities`, `request`. Renames go through
  `workspace/willRenameFiles` so re-exports and barrels update first
  ([`docs/tools/lsp.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/lsp.md)).
- **`debug`** — drives **real DAP adapters** (lldb-dap, dlv, debugpy, …) with
  28 documented ops including breakpoints, stepping, threads, stack, scopes,
  variables, `read_memory`/`write_memory`, `disassemble`, and
  `custom_request` ([`docs/tools/debug.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/debug.md)).
- **`task`** — subagent fan-out, one per call or a `tasks[]` batch, each in
  an isolated worktree/overlay; results come back **schema-validated**
  ([`docs/tools/task.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/task.md)).
- **`browser` / `computer`** — Eval preludes that drive headless Chromium, a
  CDP-attached app, your own Chrome via a relay extension, or the **host
  desktop** (windows, screenshots, native input, OS accessibility tree,
  clipboard) ([README §20–21](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **`web_search`** — one query over a provider chain, handing URLs to
  `read` ([`docs/tools/web_search.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/tools/web_search.md)).
- **`github`** — GitHub CLI operations (repo, PR, issues, code search,
  Actions run-watch) as a single dispatch tool.
- **`generate_image` / `tts`** — image gen/edit (Gemini, GPT, xAI Grok) and
  text-to-speech via xAI Grok Voice (5 voices, WAV/MP3). Unlike the 30 above,
  these two are *settings-gated custom tools* the SDK injects into the registry
  when their feature flags are on, not entries in `BUILTIN_TOOLS`
  ([`src/sdk.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/sdk.ts), [`src/tools/image-gen.ts`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/tools/image-gen.ts)).
- **Memory tools** — `retain`, `recall`, `reflect`, `memory_edit`,
  `learn`, `manage_skill`, plus `checkpoint`/`rewind` for context
  collapse ([README §13](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`docs/memory.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/memory.md)).
- **`security_scan`** — off by default; native security reviews plus Codex
  Security cloud scans.

Setting-gated and off by default: `github`, `security_scan`,
`generate_image`, `tts`, `checkpoint`, `rewind`, and the memory tools.

### 3. Native Rust core (README says ~80k; measured ~143k)

Six crates plus a vendored bash, exposed as one platform-tagged N-API addon
([README §"~80,000 lines of Rust"](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md),
[`docs/native-crates.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/native-crates.md)):

> **Correction (2026-10-08).** The "~80k" figure is stale. The README's own
> six-crate table sums to ~75k, but those same crates measure **~143k** raw
> lines at this pinned commit, and all first-party crates under `crates/`
> measure **~299k**. See
> [oh-my-pi — Native Rust Core](./oh-my-pi-native-rust-core.md) for the full
> measurement and a breakdown of `pi-shell` and `pi-natives`.

| Crate | Role | README | Measured |
| --- | --- | ---: | ---: |
| `pi-shell` | Embedded bash engine, persistent sessions, in-process coreutils dispatch | 38,000 | 40,969 |
| `pi-natives` | N-API surface (grep, glob, desktop, PTY, tokens, …) | 25,000 | 81,062 |
| `pi-walker` | Parallel ignore-aware walker + shared scan cache | 5,200 | 7,568 |
| `pi-iso` | Workspace isolation: apfs, btrfs, zfs, reflink, overlayfs, projfs, rcopy | 3,300 | 4,845 |
| `pi-ast` | tree-sitter + ast-grep matching, structural summaries | 2,900 | 4,646 |
| `pi-voice` | Audio capture/playback, Opus, live WebRTC | 1,000 | 3,708 |

Plus `pi-edit` (hashline edit engine) and `pi-builtins`: **133** Rust
source files in `crates/pi-builtins/src`, implementing bash builtins plus
in-process coreutils-class utilities (`ls`, `sed`, `sort`, `xargs`,
`jq`, `rg`, `fd`, `diff`, `sha256sum`, …). The README counts **58**
utilities in one place and **67** in another — a documentation inconsistency
worth noting ([`crates/pi-builtins/src`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/crates/pi-builtins/src),
[README §Rust Crates](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).

The practical payoff claimed: no `fork/exec` on the hot path, and the same
binary runs on Windows without a WSL bridge.

### 4. Models and providers

- **60+ providers**, routed across **nine model roles**: `default`, `smol`
  (cheap fan-out), `slow` (deep reasoning), `plan`, `commit`, `vision`,
  `task`, `advisor`, `tiny` ([README](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- Coverage spans frontier APIs (Anthropic, OpenAI, Gemini/Vertex, xAI,
  DeepSeek, Groq, Cerebras, Bedrock, Azure, OpenRouter, …), subscription
  "coding plans" (Cursor, GitHub Copilot, GitLab Duo, Kimi, MiniMax, GLM,
  Qwen, …), and local servers (Ollama, LM Studio, llama.cpp, vLLM, LiteLLM).
- **Custom OpenAI-compatible providers** are declared in
  `~/.omp/agent/models.yml`, with eleven accepted API dialects including
  `openai-completions`, `anthropic-messages`, and `bedrock-converse-stream`.
- **Four routing knobs**: per-role **fallback chains**, **path-scoped** model
  sets, **round-robin credentials** with per-key backoff, and per-role model
  selection.
- **Local tiny models** run on-device for session titles, memory, speech, and
  dictation via `modelRoles.tiny`/`memory`/`speech`/`dictation`
  ([`docs/local-models.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/local-models.md)).

### 5. Web search (23 backends)

`web_search` walks a 23-provider chain (`auto`) or pins one: perplexity,
gemini, anthropic, codex, xai, zai, exa, **tinyfish**, jina, kagi, tavily,
firecrawl, brave, kimi, parallel, synthetic, searxng, duckduckgo, startpage,
google, ecosia, mojeek, and a consolidated `public`. Site-aware extractors
cover code hosts (github/gitlab), 12 package registries, arXiv/Semantic
Scholar, forums (Stack Overflow/Reddit/HN), docs (MDN/readthedocs/docs.rs),
and vuln databases (NVD, OSV, CISA KEV) ([README](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).

### 6. Slash commands (93 names in source)

The built-in registry
([`src/slash-commands/`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/slash-commands))
declares 93 command names, including: `add`, `advisor`, `agents`,
`annotate`, `branch`, `btw`, `changelog`, `cleanse`, `collab`,
`compact`, `computer`, `context`, `debug`, `effort`, `export`,
`extended-context`, `fast`, `fork`, `fresh`, `git`, `goal`,
`handoff`, `hub`, `install`, `jobs`, `join`, `live`, `login`,
`loop`, `marketplace`, `mcp`, `memory`, `model`, `move`, `new`,
`pause`, `plan`, `plan-review`, `plugins`, `prewalk`, `queue`,
`ratchet`, `record`, `reload-plugins`, `review`, `security`,
`session`, `settings`, `share`, `skills`, `slow`, `ssh`, `stats`,
`stream`, `switch`, `tan`, `todo`, `tools`, `trace`, `tree`,
`update`, `usage`, `vibe`, `wt`, and more.

### 7. Standout subsystems

- **Subagents + Agent Hub** — `task` fans out workers in isolated
  worktrees; `Alt+A` opens Agent Hub to watch, steer, revive, or kill them
  ([README §5](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`docs/agent-hub.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/agent-hub.md)).
  Isolation backends: apfs, btrfs, zfs, reflink, overlayfs, projfs, rcopy.
- **Advisor** — a second model in the `advisor` role reads every turn on its
  own context and injects notes/concerns/blockers inline
  ([README §6](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`docs/advisor-watchdog.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/advisor-watchdog.md)).
- **TTSR (Time-Traveling Stream Rules)** — regex rules that abort the stream
  mid-token, inject the rule as a system reminder, and retry from the same
  point; injections survive compaction
  ([`docs/ttsr-injection-lifecycle.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/ttsr-injection-lifecycle.md)).
- **Collab** — `/collab` publishes a live session over a relay with a link and
  QR; read-write pairing or `/collab view` read-only; frames are sealed
  client-side ([README §7](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`docs/collab.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/collab.md)).
- **Vibe mode** — `/vibe` demotes the top-level session to a **director** with
  a read-only toolset, driving persistent background workers
  ([`docs/vibe-mode.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/vibe-mode.md)).
- **Prewalk** — one-shot handoff from the planning model to a cheaper/faster
  model once implementation begins ([`docs/prewalk.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/prewalk.md)).
- **Memory** — five backends: `off`, `local`, `hindsight`, `mnemopi`
  (local SQLite), `sharpshooter` ([README §13](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md),
  [`docs/memory.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/memory.md)).
- **Compaction** — two strategies, including **snapcompact**, which rasterizes
  discarded history into dense PNG "pixel-font" frames that vision models read
  back, with no LLM call ([README](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md),
  [`packages/snapcompact`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/snapcompact)).
- **`omp commit`** — splits the working tree into atomic commits ordered by
  dependency, rejecting cycles, scoring source above tests/docs
  ([README §16](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **Conflict resolution** — each merge conflict becomes a URL; writing
  `@theirs`/`@ours`/`@base` to `conflict://N` resolves it, with
  `conflict://*` for bulk ([README §18](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **Internal URL schemes** — sixteen internal schemes (`pr://`, `issue://`,
  `agent://`, `skill://`, `ssh://`, `artifact://`, `conflict://`,
  `memory://`, `rule://`, `security://`, `vault://`, `xd://`, …) resolve
  inside the ordinary FS-shaped tools, so `read pr://1428` looks like
  `read src/foo.ts` ([README §17](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md),
  [`src/internal-urls/`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/packages/coding-agent/src/internal-urls)).
- **Magic keywords** — prose words in a prompt inject hidden per-turn
  instructions: `ultrathink`, `orchestrate`, `workflowz`, `jevify`
  ([`docs/magic-keywords.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/magic-keywords.md)).
- **Code review** — `/review` spawns reviewer subagents returning a
  P0–P3-ranked verdict; `/annotate code-review` pins notes to diff lines
  ([README §10](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).

### 8. Extensibility, integrations, and entry points

- **Extensions** — TypeScript modules registering tools, slash commands,
  hotkeys, renderers, and event handlers
  ([`docs/extensions.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/extensions.md)).
- **Skills / hooks / custom tools / marketplaces** — a Claude-Code-compatible
  plugin registry at `.omp-plugin/marketplace.json` (falling back to
  `.claude-plugin/marketplace.json`); plugins install at user or project
  scope ([README](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md), [`docs/marketplace.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/marketplace.md)).
- **Discovery** — on first run omp reads rules, skills, and MCP servers from
  `.claude`, `.cursor`, `.windsurf`, `.gemini`, `.codex`, `.cline`,
  `.github/copilot`, and `.vscode` with no migration step
  ([`docs/context-files.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/context-files.md),
  [`docs/mcp-config.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/mcp-config.md)).
- **Four entry points** — interactive TUI, `omp -p` one-shot, `omp --mode rpc`
  (NDJSON over stdio), and `omp acp` (Agent Client Protocol for editors such
  as Zed), plus a Node SDK (`createAgentSession`, `ModelRegistry`,
  `SessionManager`, `discoverAuthStorage`) and RPC SDKs in
  [Go/Rust/Python](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/sdk) ([README §"Four entry points"](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/README.md)).
- **Auth broker / gateway** — centralized credential storage with OAuth
  refresh and an HTTP forward proxy so clients never hold provider credentials
  ([`docs/auth-broker-gateway.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/auth-broker-gateway.md)).
- **Other shipped surfaces** — `omp stream` (Twitch-style terminal
  livestream to live.omp.sh), `omp share` (encrypted session links),
  speech-to-text, TTS, `omp git` fullscreen UI, storage GC, usage/limits
  reporting, and a `robomp` self-hosted GitHub triage bot built on
  `omp --mode rpc` ([`docs/cli-reference.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/cli-reference.md),
  [`python/robomp`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/python/robomp)).

### 9. Documentation and distribution

- **82 Markdown files** under [`docs/`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs), covering tools, providers,
  session model, TUI internals, native crates, and porting from pi-mono.
- Install paths: curl (`https://omp.sh/install`), Homebrew
  (`can1357/tap/omp`), Bun (`bun install -g @oh-my-pi/pi-coding-agent`),
  Nix flake, mise, and a Windows PowerShell installer.
- npm: 667 published versions; latest `18.8.4`; **240,513 downloads** for the
  week ending 2026-10-04 ([npm registry](https://registry.npmjs.org/@oh-my-pi/pi-coding-agent)).

## Open Questions

- Are the README's benchmark lifts (Grok Code Fast 6.7% → 68.3%, Grok 4 Fast
  −61% tokens, MiniMax 2.1×) reproducible from the bundled
  `typescript-edit-benchmark` and `metaharness` packages, or vendor-reported?
  `[unverified]`
- The README cites "58" and "67" in-process command-line utilities in different
  places; the actual shipped count is unclear without enumerating the registry.
  `[unverified]`
- Windows parity: the "no WSL bridge" claim is plausible from the crate layout
  but was not executed here. `[unverified]`
- Tool count: the README badge says **31 built-in tools**, while the shipped
  `BUILTIN_TOOLS` map and `BUILTIN_TOOL_NAMES` list contain **30**. Three hidden
  tools (`yield`, `goal`, `think`) and two settings-gated custom tools
  (`generate_image`, `tts`) sit outside those lists, so "31" may be a rounded or
  stale count. `[unverified]`
- Relationship to upstream Pi: how far has the fork diverged, and does it track
  pi-mono releases? `[unverified]` — see
  [`docs/porting-from-pi-mono.md`](https://github.com/can1357/oh-my-pi/blob/40e9368ef0458fd9073329cdff4174895f91bc6b/docs/porting-from-pi-mono.md).

## Related

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — how each agent shortens a full context window, and what T3's handoff does differently
- [oh-my-pi — Native Rust Core (pi-shell, pi-natives)](./oh-my-pi-native-rust-core.md) — what `pi-shell` is, why the Rust core is large, and a correction of the "~80k" figure
- [oh-my-pi (omp) — Complete Agent Tool Inventory](../reference/oh-my-pi-tools.md) — every model-callable tool with approval tiers, load modes, and gating settings
- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md)
- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md)
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — Earendil's durable harness (sibling to this `pi`) running in a Cloudflare Durable Object

## Changelog

- 2026-10-08 — created. Primary source is the repo at pinned commit
  `40e9368ef0458fd9073329cdff4174895f91bc6b` (v18.8.4) plus the GitHub and npm
  APIs. **TinyFish was unavailable in this environment** (no
  `mcp__tinyfish__*` tools were registered), so per AGENTS.md §2.6 the fallback
  was a shallow `git clone --depth 1` of the project's own source plus direct
  GitHub/npm API reads; no non-TinyFish web search or scraping was used, and
  every claim here traces to the repo or an official API response.
  `confidence: medium` pending a TinyFish-sourced pass for the vendor-reported
  benchmark numbers.
- 2026-10-08 — corrected the "~80k lines of Rust core" claim after measuring the
  pinned clone: the README's six-crate table is stale (~143k raw lines for the
  same crates, ~299k for all first-party crates). Detail moved to
  [oh-my-pi — Native Rust Core](./oh-my-pi-native-rust-core.md).
