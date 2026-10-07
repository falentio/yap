---
title: Turso for Production Use — Reliability Assessment
category: technology
tags: [turso, libsql, sqlite, database, production, reliability, embedded-replicas]
status: complete
created: 2026-10-07
updated: 2026-10-07
sources:
  - https://turso.tech/
  - https://docs.turso.tech/libsql
  - https://docs.turso.tech/features/embedded-replicas/introduction
  - https://docs.turso.tech/cloud/limitations
  - https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap
  - https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7
  - https://turso.tech/blog/turso-cloud-goes-diskless
  - https://turso.tech/blog/how-does-the-turso-cloud-keep-your-data-durable-and-safe
  - https://turso.tech/pricing
  - https://status.turso.tech/incidents
  - https://status.turso.tech/incidents/2026-03/2026-05
  - https://perun.au/insights/turso-production/
  - https://www.nazarboyko.com/articles/sqlite-in-production-with-turso-and-libsql
  - https://forum.atuin.sh/t/libsql-turso-as-the-backend-db/989
  - https://turso.tech/blog/beyond-the-single-writer-limitation-with-tursos-concurrent-writes
  - https://turso.tech/blog/turso-0.5.0
confidence: medium
---

# Turso for Production Use — Reliability Assessment

## TL;DR

- **Yes, Turso is production-viable today — but only for the right workload shape.** The
  stable, production-grade thing is **libSQL** (a C fork of SQLite) + **Turso Cloud**.
  The Rust rewrite ("Turso Database", formerly *Limbo*) is **beta** and its concurrent-write
  (MVCC) support is explicitly **experimental**; do not build production on it yet.
- **The workload filter is decisive:** embedded replicas accelerate **reads** (local-file
  speed) but **every write pays a network round-trip to a single primary**. Read-heavy apps
  (content, dashboards, catalogs, config, per-tenant/per-agent DBs) are the sweet spot.
  Write-heavy apps (chat, event ingestion, IoT telemetry) get little upside and a real tax.
- **Durability is strong, availability is only moderate.** Turso advertises 11 nines of
  durability (inherited from AWS S3/S3 Express) and continuous PITR backups. But the
  uptime SLA is **99.95%** and the diskless architecture runs in a **single availability
  zone** — an AZ event is a real outage risk.
- **There is real incident history.** A **2023-12-04 free-tier data leak + data loss**
  incident (0.07% of databases) and a **2026-08-04 502 cascade** (~30 customers). The
  team publishes honest post-mortems, which is a positive signal, but the track record
  is not spotless.
- **The biggest practical risks are architectural, not uptime:** silent stale reads across
  replicas, split-writer data loss, token-expiry silent failures, migration/replica races,
  and per-account database-limit exhaustion in multi-tenant designs.
- **Vendor-direction risk is real.** In Jan 2025 Turso discontinued edge replicas and
  multi-DB schemas for new users, moved to a closed-source server, and had layoffs. The
  paid-plan commitment was honored, but the roadmap has shifted once already. **On
  2026-10-02 Supabase announced it is acquiring Turso** ($150M raise; founder joins
  Supabase) — see [the deep dive](./turso-data-loss-incidents.md) for what is and isn't
  committed.

## Context

Researched to answer: *"Is Turso reliable for a production use case, and are there any
issues?"* This is a go/no-go input for adopting Turso (Turso Cloud and/or libSQL) as a
production database. It separates the **stable** product (libSQL/Turso Cloud) from the
**beta** one (the Rust rewrite), and separates **reliability** (uptime, durability,
incidents) from **correctness/architecture** (consistency, write path, limits).

## Findings

### 1. What "Turso" actually is (naming matters)

Turso is **one engine with three ways to run it**, and the names are easy to conflate
([turso.tech/product](https://turso.tech/product)):

| Thing | Status | What it is |
|-------|--------|-----------|
| **libSQL** | Production-ready | Open-source C **fork of SQLite**; adds server mode, WAL replication, embedded replicas, vector search. Backwards-compatible with SQLite. |
| **Turso Cloud** | Managed service (GA) | Hosts databases; embedded replicas, HTTP access, PITR, branching. |
| **Turso Database** (ex-*Limbo*) | **Beta** | From-scratch **rewrite of SQLite in Rust**; adds MVCC / `BEGIN CONCURRENT`. |

The docs state libSQL is a "production-ready fork of SQLite"
([docs.turso.tech/libsql](https://docs.turso.tech/libsql)). What runs in production
**today** is libSQL; the Rust rewrite is the future but is **not** the thing to put under a
real workload now — its MVCC support is "explicitly experimental with known limitations"
([nazarboyko.com](https://www.nazarboyko.com/articles/sqlite-in-production-with-turso-and-libsql)).

> **Decision:** if you adopt Turso for production in 2026, you are adopting **libSQL +
> Turso Cloud**, not the Rust rewrite.

### 2. Reliability — durability is excellent, availability is moderate

**Durability (strong).** Turso Cloud commits to **99.999999999% (11 nines)** data
durability, inherited from AWS S3 / S3 Express One Zone, with **continuous backups** and
**point-in-time restore up to 90 days** ([durability blog](https://turso.tech/blog/how-does-the-turso-cloud-keep-your-data-durable-and-safe)).
The diskless architecture means every write is acknowledged only **after** it lands in S3
Express, and backups are free side-effects of normal writes. For *"will I lose committed
data?"* the answer is largely no, modulo the incident below.

**Availability (moderate).** The [diskless blog](https://turso.tech/blog/turso-cloud-goes-diskless)
states a **99.95% uptime SLA** and notes the architecture runs in a **single availability
zone**; multi-AZ writes are "something we consider doing in the future." A single-AZ
architecture means an AWS AZ event is a direct availability risk. 99.95% ≈ **4.4 hours of
allowed downtime per year**.

**Incident history (non-zero, transparently reported):**

| Date | Incident | Impact |
|------|----------|--------|
| 2023-12-04 | Free-tier **data leak + data loss** — buggy migration gave some DBs a shared/empty backup ID; recreate-from-backup leaked and lost recent writes | 0.07% of DBs ([post-mortem](https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7)) |
| 2026-05-08 | Some databases affected by **AWS US-EAST-1 outage** | Databases moved to new machines ([status](https://status.turso.tech/incidents/2026-03/2026-05)) |
| 2026-05-22 | Turso API unavailable | Resolved same day |
| 2026-08-04 | **Elevated 502s** on DB queries — a multitenant server went down, retries cascaded into a routing-layer load issue | ~30 customers ([status](https://status.turso.tech/incidents)) |

The 2026-08-04 incident is notable because it shows a **blast-radius amplification** failure
(one server down → retry storm → routing overload), not just an isolated node failure.
[status.turso.tech](https://status.turso.tech/incidents) shows no reported incidents in
Sep–Oct 2026, and third-party trackers report operational status
([pulsetic.com](https://pulsetic.com/status/turso/)).

**Third-party skepticism exists.** The Atuin project declined to adopt Turso, citing that
"Turso's offline sync is still in public beta" and "Turso has had multiple publicly
acknowledged data loss incidents"
([forum.atuin.sh](https://forum.atuin.sh/t/libsql-turso-as-the-backend-db/989)). **That
claim was verified in depth** — there are three documented incidents (2023-10 cross-tenant
**exposure**, 2023-12 **leak + loss**, 2025-01 reported **loss** in the AWS beta region), all
tracing to control-plane migrations, not engine bugs. See
[Turso Data Loss & Data Exposure Incidents — Deep Dive](./turso-data-loss-incidents.md).

### 3. The core architectural tradeoff: reads are fast, writes are taxed

Embedded replicas place a **real SQLite file in your app process**. Reads hit the local file
(~microseconds); writes are sent to the **remote primary** and reflected back
([docs](https://docs.turso.tech/features/embedded-replicas/introduction)). Indicative p50
figures ([nazarboyko.com](https://www.nazarboyko.com/articles/sqlite-in-production-with-turso-and-libsql)):

| Operation | Plain SQLite (local, WAL) | Turso embedded replica |
|-----------|---------------------------|------------------------|
| Point `SELECT` by PK | ~0.01 ms | ~0.02 ms |
| Single `INSERT` | ~0.05 ms | **~15–50 ms** (write to primary) |

Because SQLite is **single-writer**, all writes funnel through one primary: sustained write
throughput is roughly **1,000–5,000 writes/sec, network-bound**. The Rust rewrite's
`BEGIN CONCURRENT` targets this, but Turso's own post admits "performance limitations on row
version management and concurrency that we'll be working on"
([concurrent writes blog](https://turso.tech/blog/beyond-the-single-writer-limitation-with-tursos-concurrent-writes)).

> **Rule:** embedded replicas are **a read accelerator with a write tax.** Read-heavy =
> excellent fit. Write-heavy = wrong shape.

### 4. Correctness gotchas (the issues that actually bite)

These are documented failure patterns, not hypotheticals
([perun.au](https://perun.au/insights/turso-production/),
[nazarboyko.com](https://www.nazarboyko.com/articles/sqlite-in-production-with-turso-and-libsql)):

1. **Stale reads across replicas.** Read-your-writes is guaranteed **only on the replica
   that issued the write**. A different replica/region serves old data until it syncs —
   **silently, with no error**, and with **no hard bound on how long the gap lasts**. Reads
   that can't tolerate staleness (e.g. "did this payment go through?") must read the primary.
2. **Split-writer data loss.** If app code writes directly to the local SQLite file (bypassing
   the libSQL client) — easy when a Rust/Go/Python app already has a SQLite dependency — the
   local write is **silently discarded** on the next sync. Symptom: data persists locally,
   then vanishes minutes later with no exception.
3. **Token-expiry silent failures.** Expired JWT auth tokens can cause empty result sets or
   fall back to local reads without surfacing a loud error in some SDKs — especially in edge
   runtimes (Cloudflare Workers, Vercel Edge) with no background refresh loop.
4. **Migration/replica race.** The primary applies schema changes immediately; replicas lag.
   During blue-green deploys this produces a window of elevated errors. Fix: gate deploys on
   `db.sync()` completing on every replica.
5. **libSQL WASM size limit.** The JS libSQL WASM binary **exceeds 1.5 MB compressed**, over
   Cloudflare Workers' **1 MB** limit — fails at deploy time (works locally). Workaround: use
   the HTTP API path or a Durable Object binding.
6. **Multi-tenant quota exhaustion.** Per-account database limits (free tier ~100–500
   databases; paid tiers finite) can be hit silently if tenant DBs aren't cleaned up on churn,
   causing signup failures.

### 5. Operational limitations & lock-in

- **Pragma differences on Turso Cloud:** `user_version` and `application_id` are read-only;
  `busy_timeout` and `journal_mode` are unsupported (Turso manages them)
  ([limitations](https://docs.turso.tech/cloud/limitations)). Migrations that use
  `PRAGMA user_version` must switch to a table-based scheme.
- **Server is closed source.** As of Jan 2025, Turso's new multitenant server is
  **proprietary**; only the client remains strictly open source. Self-hosting on libSQL is
  still possible (same protocols) ([roadmap post](https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap)).
- **Roadmap churn.** In Jan 2025 Turso discontinued **edge replicas** and **multi-DB
  schemas/`ATTACH`** for new users, moved free tier to AWS, renamed Limbo → Turso, and had
  **layoffs**. Paid customers were explicitly grandfathered: *"if you're a current paid
  customer of Turso, your existing production workloads will continue running exactly as
  they do today."*
- **Embedded replica footguns:** do not open the local DB while syncing (corruption risk);
  can't be used in filesystem-less serverless; a 1-byte row still writes a 4 KB frame
  ([docs](https://docs.turso.tech/features/embedded-replicas/introduction)).

### 6. Cost

Pricing is usage-based ([turso.tech/pricing](https://turso.tech/pricing)):

| Plan | Price | Databases | Storage | PITR | Support |
|------|-------|-----------|---------|------|---------|
| Free | $0 | 100 | 5 GB | 1 day | Community |
| Developer | $4.99/mo | Unlimited | 9 GB | — | Community |
| Scaler | ~$24.92/mo | Unlimited | 24 GB | 30 days | Community |
| Pro | ~$416.58/mo | Unlimited | 50 GB | 90 days | Priority email |
| Enterprise | Custom | Unlimited | 50 GB+ | 90 days | 24×7 |

Note: **per-account database counts are finite on free tier**, and row-read/write/sync
overages bill automatically. Idle databases cost only storage — favorable for
per-tenant/per-agent fleets.

## Open Questions

- What is the **observed** (not SLA) uptime over the last 12 months, measured externally? The
  status page is self-reported.
- Does Turso Cloud have a **multi-AZ** option now, or is single-AZ still the default as of
  2026-10? (The diskless post says multi-AZ is "future".)
- How mature is **Turso Sync** (the recommended replacement for embedded replicas) — still
  beta? Docs recommend it for new projects but it's built on the beta Rust engine.
- Real-world **write-heavy** throughput numbers at scale, beyond the 1–5k writes/sec estimate.
- Whether `[unverified]` the 2026-08-04 cascade has had follow-up mitigations published.

## Verdict

| Use case | Recommendation |
|----------|----------------|
| Read-heavy, global low-latency reads; per-tenant/per-agent DBs; local-first/mobile sync | **Good fit.** libSQL + Turso Cloud is production-viable. |
| Write-heavy (chat, ingestion, telemetry) | **Poor fit.** Single-writer + write round-trip. Use Postgres. |
| Strict cross-region read-your-writes without thought | **Poor fit** unless you read the primary for critical reads. |
| Betting on the Rust rewrite / MVCC for production now | **No.** Beta, experimental concurrency. |
| Needing an SLA >99.95% or multi-AZ by default | **Check current terms.** Historically single-AZ. |

**Bottom line:** Turso is *reliable enough* for read-heavy production workloads with an
operational plan for its consistency gotchas. It is **not** a drop-in Postgres replacement
for write-heavy or strongly-consistent cross-region workloads, and its history includes at
least one data-loss incident plus roadmap churn. Adopt with eyes open; design around
staleness, write throughput, and database-count limits.

## Related

- `../reference/` — add a SQLite/libSQL cheat sheet here if this becomes a working tool.
- `../howto/` — add an "embedded replicas deploy gate" guide if adopted.

## Changelog

- 2026-10-07 — created. Researched via TinyFish (`mcp__tinyfish__search` /
  `mcp__tinyfish__fetch_content`) across 16 sources listed in front matter.
