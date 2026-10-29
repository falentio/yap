# Howto

Index of research files in `research/howto/`.

<!-- Add new entries here as: - [Title](./slug.md) — one-line description (YYYY-MM-DD) -->

## Entries

- [Star a GitHub repository — gh CLI vs GitHub MCP server](./github-star-repository.md) — `gh api --method PUT /user/starred/{owner}/{repo}` versus the MCP `star_repository`/`unstar_repository` tools, why the MCP `stargazers` toolset is not enabled by default, and the 204-vs-exit-code verification trap (2026-02-14)
- [Effect v4 RPC in a Modular Monolith — Product Service (Repository / Service / RPC Layers)](./effect-v4-rpc-modular-monolith-product-service.md) — A type-checked, end-to-end layered example: Schema domain, repository port + SQLite adapter, service with domain-only errors, `effect/rpc` contract, typed auth middleware, HTTP server/client, and an in-memory swap for tests (2026-10-08)
- [Production Error Handling in Effect v4 — Logging, ErrorReporter, and Sentry](./effect-v4-production-error-handling.md) — The four-layer observability answer: structured logging with `annotateLogs`, the `ErrorReporter` incident boundary (ignore/severity/attributes annotations), automatic reporting in the RPC and HTTP servers, the official `@sentry/effect` SDK vs a custom reporter, `Redacted` secret masking, and the retry-reporting interaction (2026-10-08)
- [Calisthenics from Zero — Beginner Progression Guide](./calisthenics-beginner-progression.md) — Nine movement patterns with an ordered rung ladder each, the Recommended Routine's 3×5→3×8 progression rule and 10X0 tempo, the 12–20 weekly-sets hypertrophy band, and a supply-side nutrition plan for a 165cm/46–52kg underweight beginner (2026-02-14)
- [Daily Calisthenics Workout — 7-Day Block](./daily-calisthenics-workout.md) — The companion plan: three strength days (A/B/C) pairing push with pull, three recovery days of joint prep and walking, one off day, the 3×5→3×8 rung rule, a starting-rung self-test, and the eating schedule for a 46–52 kg trainee (2026-02-14)
