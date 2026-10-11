# Technology

Index of research files in `research/technology/`.

<!-- Add new entries here as: - [Title](./slug.md) — one-line description (YYYY-MM-DD) -->

## Entries

- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md) — Is Turso/libSQL production-viable? Durability 11 nines, 99.95% SLA, incident history, write-path tradeoffs, and correctness gotchas (2026-10-07)
- [Turso Data Loss & Data Exposure Incidents — Deep Dive](./turso-data-loss-incidents.md) — Verifies the "multiple data loss incidents" claim: three incidents (2023-10 exposure, 2023-12 leak+loss, 2025-01 reported loss), shared root cause, and the Supabase acquisition (2026-10-07)
- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md) — The v4 RPC architecture from the pinned source: definition-first Rpc/RpcGroup, pluggable Protocol transports, schema-aware serialization (SchemaBinary, MessagePack removed), typed middleware, streaming/deferred responses, and the v3→v4 migration map (2026-10-08)
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — Feature inventory of the omp coding agent at v18.8.4 (pinned SHA): 31 tools, native Rust core, LSP/DAP, subagents, providers, search backends, extensions (2026-10-08)
- [oh-my-pi — Native Rust Core (pi-shell, pi-natives)](./oh-my-pi-native-rust-core.md) — What `pi-shell` is (embedded bash + a 29k-line output minimizer), why `pi-natives` is ~81k lines, and a correction of the README's stale "~80k lines of Rust" figure (2026-10-08)
- [Reading a File From the End — Reverse Streaming, Suffix Ranges, and Tail Semantics](./read-file-from-end.md) — Why no runtime streams backwards: seek+read is the only primitive, HTTP suffix ranges (`bytes=-N`), the reverse-block recipe, UTF-8/line-boundary gotchas, and the local-API comparison table (2026-10-08)
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — Earendil's experimental durable agent harness and the official Cloudflare `PiHarness` Lifecycle capability: commit-before-visible durability, DO SQLite storage, alarm wake-up, replay-safety, and the 128 MB / 15 min limits (2026-10-08)
- [Watching File Changes on S3 Object Storage](./s3-file-change-detection.md) — Push beats poll: S3 Event Notifications to SQS/Lambda/SNS/EventBridge compared, sequencer dedupe recipe, polling and Inventory fallbacks (2026-10-09)
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — How a thread's context moves when the CLI agent changes: detach-and-lazy-reopen, native resume vs. budgeted ContextHandoff summaries, continuation-identity gating, and delegation carrying prompt-only context (2026-10-09)
- [Modern JavaScript Video Player Libraries — 2026 Landscape](./js-video-player-libraries.md) — 2026 consolidation: Video.js v10 (GA 2026-10-01) merges Video.js, Plyr, Vidstack, Media Chrome & Mux Player; player-UI vs streaming-engine split, wide feature + bundle-size tables, and a decision guide (2026-10-11)