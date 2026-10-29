---
title: Pi Durable — Production Readiness Assessment
category: technology
tags: [pi, pi-durable, earendil, production, risk, durability, cloudflare, sqlite, migrations, semver]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/README.md#L3
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/CHANGELOG.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/docs/spec.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/package.json
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/harness/agent.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/harness/telemetry.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/src/storage/sqlite/migrations.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/chord/src/sqlite/migrations.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/test-workers/vitest.config.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/test-workers/wake.test.ts
  - https://developers.cloudflare.com/agents/harnesses/pi/
  - https://earendil.com/posts/pi-durable/
  - https://news.ycombinator.com/item?id=49925969
confidence: high
---

# Pi Durable — Production Readiness Assessment

## TL;DR

**Verdict: not production-ready in the "pin it and forget it" sense — but the risk is not the
machinery.** `@earendil-works/pi-durable` declares itself experimental ("The API changes without
notice between releases", [README:3](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/README.md#L3)) and behaves like it: **nine releases
in three weeks**, **53 breaking changes across six versions**, breaking changes inside *patch*
bumps, and **33 more already queued under Unreleased**
([CHANGELOG](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/durable/CHANGELOG.md)).

What is already strong: atomic commit-before-visible, `requestId` idempotency, a crash-loop guard,
a versioned SQLite schema with contiguous migrations, a telemetry schema with spans and metrics, and
**92 test files** — including real `node:sqlite` databases and workerd Durable Object tests that
evict an object mid-stream and resume.

What is missing for a product: any compatibility policy, migration recipes for most breaking
changes, **rollback** (one release rebuilt a table and cannot be rolled back), storage or commit
timeouts, approvals, session deletion, resumable event streams, and graceful drain. Cloudflare's own
harness page lists seven limitations, including "no approval or permission step" and "cannot delete a
conversation yet" ([Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/)).

**Where it fits today:** single-tenant agents, internal tools, and prototypes you can rebuild on a
breaking release. **Where it does not:** multi-tenant SaaS holding customer data you cannot afford to
lose or fail to delete, or anything that needs approvals, long model calls, or a stable API contract.

## Context

Asked 2026-10-29: "pi durable production readiness". Read against `earendil-works/pi` @
[`babe30a7e6c1`](https://github.com/earendil-works/pi/tree/babe30a7e6c1), `packages/durable` **1.4.0** (MIT,
published), its `docs/spec.md` (6,400 lines, declared normative), its CHANGELOG, its test tree, and
Cloudflare's Pi-harness page (updated 2026-10-27). Prior coverage:
[how the harness works on a DO](./pi-durable-cloudflare-workers-durable-objects.md),
[what durability buys](./pi-durable-vs-pi-coding-agent.md),
[chord underneath](./chord-distributed-object-runtime.md).

## Scorecard

| Dimension | Verdict | Evidence | Risk if you ship |
| --- | --- | --- | --- |
| Stated stability | **fail** | "Experimental. The API changes without notice between releases" (`README.md:3`) | you cannot promise an API to your own consumers |
| Semver discipline | **fail** | breaking changes in 1.0.3 and 1.0.4 patch releases; `TaskRuntime.sleep()` removed in 1.4.0 | a patch bump can break your build |
| Change volume | **fail** | 9 releases 2026-10-01 → 10-21; 53 breaking entries; 33 queued | every upgrade is a port, not a bump |
| Migration guidance | **partial** | only 6 of 53 breaking entries carry a "Migration:" recipe | upgrades require reading source |
| Storage durability | **pass** | atomic commits; effect sandwich; commit-before-visible | the core promise holds |
| Schema versioning | **pass** | `durable_schema` table, contiguous migrations, current v2, refuses a newer DB (`storage/sqlite/migrations.ts:113-121`) | safe within a version |
| Rollback | **fail** | 1.4.0 rebuilds `tasks`; "a deployment cannot roll back past this release" | a bad deploy is a one-way door |
| Crash recovery | **pass (with caveat)** | workerd tests evict mid-stream and resume; `restartLimit` 5 stops crash loops (`src/harness/agent.ts:85`) | recoverable, but a poison task ends rather than retries |
| Idempotency | **pass** | `requestId` dedupes resubmission after reopen (`README.md:126-133`) | retries are safe |
| Failure surfacing | **pass** | storage error seals the session; report taxonomy (`storage_failed`, `task_faulted`, …) via `onReport` | failures are visible, not silent |
| Timeouts / drain | **fail** | no storage or commit timeout; `close()` joins non-cooperative code; `abort()` waits on tools that ignore the signal | one stuck tool pins a session |
| Observability | **partial** | telemetry schema: `pi.durable.submit`/`phase` spans, entry/submission events, `tasks.active` and `phase.duration` metrics (`src/harness/telemetry.ts:50-133`) | no event-stream resume; dashboards yes, replay no |
| Test depth | **strong** | 92 files, 4 configurations, real `node:sqlite`, 2 workerd files with eviction/recovery | better than most 1.x libraries |
| Test blind spots | **partial** | Cloudflare path outside workerd is a fake; IndexedDB via `fake-indexeddb`; chord-store variant drops 4 tests | provider-specific bugs can hide |
| Hosting maturity | **partial** | Cloudflare `PiHarness` is official but ~4 weeks old; agents ↔ pi minor versions are coupled | upgrade treadmill with a second vendor |
| Product completeness | **fail** | no approvals, no session deletion, no stream cursor, no graceful eviction | GDPR delete, human-in-the-loop, and long calls are blocked |
| Ecosystem evidence | **thin** | no public production user found; community threads ask whether anyone has experimented | you are the early adopter |

## Findings

### 1. The declared contract is "no contract"

The README's first line is a warning, not a promise. The spec is declared normative
(`docs/spec.md:3`) — meaning the *document* is the API guarantee — but it contains **no
compatibility section**, and a compatibility layer for earlier prototypes is an explicit non-goal
(`docs/spec.md:6405`). There is no deprecation window, no LTS line, and no supported-version matrix
on the Earendil side.

Cloudflare, which does publish a matrix, states the coupling plainly: the three pi packages are
optional peer dependencies of `agents` "at `~1.4.0`… Pi Durable is experimental and its API can
change in minor releases, so each `agents` release supports one Pi minor version. Agents SDK 0.30.0
and later support Pi 1.4" ([Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/)).

> **Operational consequence:** a pi-durable minor upgrade is an `agents` upgrade, and an
> `agents` upgrade is a pi-durable minor upgrade. Plan them as one change.

### 2. Release velocity and semver

| Version | Date | Breaking entries |
| --- | --- | --- |
| 1.0.0 | 2026-10-01 | 0 |
| 1.0.1 | 2026-10-03 | 0 |
| 1.0.2 | 2026-10-04 | 0 |
| 1.0.3 | 2026-10-05 | **4** (patch) |
| 1.0.4 | 2026-10-05 | **2** (patch) |
| 1.1.0 | 2026-10-07 | 2 |
| 1.2.0 | 2026-10-12 | 6 |
| 1.3.0 | 2026-10-15 | 0 |
| 1.4.0 | 2026-10-21 | 6 |
| Unreleased | — | **33** |

Nine releases in twenty-one days, with changelog sections long enough to imply a
large commit volume per release, and breaking changes inside patch versions. Only **six** of the 53 breaking entries carry an
explicit migration recipe; the rest expect you to infer the port.

### 3. Migrations are real, but one-way

The good half: the schema is versioned in a `durable_schema` table with contiguous migrations and a
runner that refuses a non-contiguous jump or a database newer than the code
(`packages/chord/src/sqlite/migrations.ts:24-36`, `storage/sqlite/storage.ts:171`). Documents carry
a second, independent version axis (kind + `version` + `migrate`), and `pi.live` is already at
version 3 with in-place read migrations.

The bad half: **there is no down-migration path.** Release 1.4.0 rebuilds the `tasks` table and the
changelog says outright that "a deployment cannot roll back past this release". A document kind
cannot be renamed by a migration at all (`docs/spec.md:6324-6326`). And the JSONL storage backend has
no schema version and no repair path; its durability without `fsync` is described as weak
(`docs/spec.md:6164,6404`).

### 4. What the tests actually prove

This is the most reassuring part of the assessment, and the part most readers will under-rate:

| Proven | How |
| --- | --- |
| Commit/reopen on a real database | `node:sqlite` `DatabaseSync` against temp-dir files, including reopen and schema introspection (`test/sqlite-storage.test.ts`, `test/sqlite-migrations.test.ts`) |
| DO eviction mid-stream, then resume | workerd via the Cloudflare vitest plugin (`test-workers/wake.test.ts:24,62,79`) |
| Idempotent resubmission | `requestId` dedupe asserted in the same workerd suite |
| Harness breadth | 51 test files for the harness alone; 10 for sessions; codemode, env, tools, images, tool-search |
| Four run modes | default, zero document retention, chord-store, workerd (`package.json:128-130`) |
| No silently disabled tests | 9 `skipIf` (platform or provider-token gates), zero `.todo`/`.skip` |

Blind spots, stated honestly by the tree itself: the Durable Object path outside workerd is a fake
(`test/sqlite-cloudflare.test.ts` uses `node:sqlite` plus a chord helper), IndexedDB is exercised
against `fake-indexeddb`, and the chord-store variant excludes 4 named tests and drops files that
touch raw `tasks`/`durable_metadata` SQL.

### 5. Failure semantics

Implemented, not just documented:

- **Model retries** with a default `maxRetries: 3` (`src/harness/agent.ts:20-23`).
- **Crash-loop guard**: `restartLimit` defaults to 5; the task ends instead of re-running forever
  (`src/harness/agent.ts:85`).
- **Sealing**: any storage error seals the session, nothing is retried, pending waits fail, watches
  end `failed` (`docs/spec.md:6022-6058`).
- **Deferred commits**: `adopt(seq)` publishes a commit exactly when it becomes durable.
- **Replay declarations** per tool (`safe` vs not), so recovery reruns only what is safe.

Missing, and each is an outage shape:

| Gap | What it looks like in production |
| --- | --- |
| No storage/commit timeout | a wedged SQLite call holds the session until the platform kills it |
| `close()` joins non-cooperative code | shutdown hangs on a tool that never returns |
| `abort()` waits for idle | a tool that ignores its signal keeps the session busy |
| No approvals | any tool the model calls runs |
| No session deletion | "delete my data" has no supported path |
| No stream cursor | a dropped client cannot resume; every stream restarts from a snapshot |

### 6. The hosting layer's own limitations

Cloudflare's page is candid, and these are product-blocking for some use cases: no approval or
permission step; event streams always start from a snapshot with no resume cursor; `abort()` waits
on tools that ignore the signal; the wake-up job lives inside a 15-minute alarm and hands off every
10 minutes, so **one model request streaming past 15 minutes can be cut off**; background task
completion is noticed up to 30 seconds late; a running session prevents the object from draining, so
eviction is not graceful; and a conversation cannot be deleted
([Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/)).

### 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Minor upgrade breaks your integration | **high** (happened 6 times in 3 weeks) | medium | pin exact versions; upgrade deliberately; keep a port branch |
| Patch upgrade breaks the build | medium (happened twice) | medium | pin exact; read the changelog before any bump |
| Bad deploy cannot be rolled back | medium | **high** | rehearse migrations on a restored copy; keep a pre-upgrade DB snapshot |
| Stuck tool wedges a session | medium | high | every tool gets its own timeout and cooperative abort |
| Long model call cut at 15 min | low-medium | high | cap output/stream length; split long jobs into tasks |
| Data-deletion request you cannot satisfy | low (until it happens) | **high** | do not store PII you cannot delete; plan a side-channel purge |
| Vendor drift (agents ↔ pi lockstep) | **high** | medium | treat them as one dependency; stage upgrades together |
| You are the first production user | high | medium | budget debugging time; keep the repo checked out and pinned |

## What would move this to "production-ready"

Acceptance criteria to re-check before flipping the verdict:

1. A written compatibility policy with a deprecation window, and no breaking changes in patch
   releases.
2. Down-migrations, or a documented restore path, for every schema bump.
3. Timeouts on storage and commit, and a bounded `close()`.
4. Session deletion plus approvals (or a documented policy layer).
5. A resumable event stream (cursor) and graceful drain.
6. Six months, or at least several minor versions, without a breaking change, plus one public
   production user.

## Decision guide

| Use case | Call |
| --- | --- |
| Prototype, demo, internal tool | **ship it** — pin exact versions, keep the checkout |
| Single-tenant product you operate | **ship with mitigations** from §7, no customer PII |
| Multi-tenant SaaS, long-lived data | **wait** — no deletion, no rollback, churning API |
| Regulated / needs approvals or audit | **wait** — no approval step, no permission model |
| Long-running jobs (>15 min model streams) on Cloudflare | **wait or redesign** into tasks |
| You need an API your own users compile against | **wait**, or wrap it behind your own stable facade |

## Open questions

- Does 1.4.0 actually publish to npm, and does the `agents` `~1.4.0` peer range tolerate a 1.5
  breaking release? Probe: `npm view @earendil-works/pi-durable versions` and read `agents`'
  peerDependencies.
- How long does a Documented migration of a real-sized store take, and is it online? Probe: run the
  migration suite against a copy of a production-sized DB.
- Is there any public production deployment? The only community signal found is a thread asking
  whether anyone has experimented; that is absence of evidence, not evidence of absence.

## Related

- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
  — the harness architecture and its storage mapping.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — what durability buys
  and what the terminal product gives up.
- [Chord — Earendil's Distributed Object Runtime](./chord-distributed-object-runtime.md) — the
  storage engine and migration runner underneath.
- [Cloudflare Durable Objects in Production](./cloudflare-durable-objects-production-review.md) —
  the platform-level reliability review this depends on.

- [Flue vs pi-agent-core — Framework or Loop?](./flue-vs-pi-agent-core.md) — Flue 2.0.3 is built on this package (pinned ^0.83.0), so the choice is framework versus loop, not one engine versus another.
## Changelog

- 2026-10-29 — created. Evidence: scout read of `earendil-works/pi` @ `babe30a7e6c1` (README, CHANGELOG,
  spec, tests, harness source), Cloudflare's Pi harness page, and the Earendil announcement.
  Numbers (9 releases, 53 breaking entries, 33 unreleased, 92 test files) are counted from the
  CHANGELOG and test tree at that revision.
