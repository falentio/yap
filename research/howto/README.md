# Howto

Index of research files in `research/howto/`.

<!-- Add new entries here as: - [Title](./slug.md) — one-line description (YYYY-MM-DD) -->

## Entries

- [Effect v4 RPC in a Modular Monolith — Product Service (Repository / Service / RPC Layers)](./effect-v4-rpc-modular-monolith-product-service.md) — A type-checked, end-to-end layered example: Schema domain, repository port + SQLite adapter, service with domain-only errors, `effect/rpc` contract, typed auth middleware, HTTP server/client, and an in-memory swap for tests (2026-10-08)
- [Production Error Handling in Effect v4 — Logging, ErrorReporter, and Sentry](./effect-v4-production-error-handling.md) — The four-layer observability answer: structured logging with `annotateLogs`, the `ErrorReporter` incident boundary (ignore/severity/attributes annotations), automatic reporting in the RPC and HTTP servers, the official `@sentry/effect` SDK vs a custom reporter, `Redacted` secret masking, and the retry-reporting interaction (2026-10-08)
