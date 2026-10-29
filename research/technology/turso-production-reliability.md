---
title: Turso for Production Use — Reliability Assessment
category: technology
tags: [turso, libsql, sqlite, database, production, reliability, embedded-replicas, uptime, mvcc]
status: complete
created: 2026-10-07
updated: 2026-10-28
sources:
  - https://status.turso.tech/
  - https://status.turso.tech/incidents
  - https://docs.turso.tech/turso-cloud
  - https://docs.turso.tech/libsql
  - https://docs.turso.tech/introduction
  - https://docs.turso.tech/features/embedded-replicas/introduction
  - https://docs.turso.tech/sync/usage
  - https://docs.turso.tech/features/point-in-time-recovery
  - https://docs.turso.tech/cloud/limitations
  - https://docs.turso.tech/tursodb/concurrent-writes
  - https://docs.turso.tech/sdk/http/reference
  - https://docs.turso.tech/sdk/ts/reference
  - https://github.com/tursodatabase/libsql
  - https://github.com/tursodatabase/turso
  - https://turso.tech/blog/turso-cloud-goes-diskless
  - https://turso.tech/blog/how-does-the-turso-cloud-keep-your-data-durable-and-safe
  - https://turso.tech/blog/turso-0.7.0
  - https://turso.tech/blog/turso-0.8.0
  - https://turso.tech/blog/turso-group-commit
  - https://turso.tech/blog/concurrent-writes-on-turso-cloud
  - https://turso.tech/blog/beyond-the-single-writer-limitation-with-tursos-concurrent-writes
  - https://turso.tech/blog/turso-cloud-new-regions
  - https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan
  - https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap
  - https://turso.tech/blog/turso-is-joining-supabase
  - https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7
  - https://turso.tech/blog/prevent-accidental-deletes-with-database-and-group-delete-protection
  - https://turso.tech/blog/sqlite-encryption-in-production
  - https://turso.tech/pricing
  - https://aws.amazon.com/blogs/storage/how-turso-built-a-transactional-database-using-amazon-s3-express-one-zone/
  - https://perun.au/insights/turso-production/
  - https://kanopylabs.com/blog/sqlite-for-production-turso-litefs-d1
  - https://news.ycombinator.com/item?id=49934784
  - https://www.beri.net/article/supabase-turso-acquisition-database-per-agent-sqlite-postgres-pricing-continuity
  - https://pulsetic.com/status/turso/
confidence: medium
---

# Turso for Production Use — Reliability Assessment

## TL;DR

- **"Turso" is now two production surfaces at different maturities, and the
  split is what decides this question.** libSQL on Turso Cloud is the
  battle-tested path. The Rust rewrite — **Turso Database** — left beta at
  v0.7.0 on 2026-07-13, but running that engine *on Turso Cloud* is still
  **early preview** (`turso db create --tursodb`), per the platform's own docs
  ([docs.turso.tech/turso-cloud](https://docs.turso.tech/turso-cloud)).
- **There is no published uptime SLA.** The "99.95%" figure that circulates as
  Turso's SLA is Turso quoting *AWS's SLA for a single availability zone of S3
  Express One Zone* — the storage layer the platform sits on
  ([diskless post](https://turso.tech/blog/turso-cloud-goes-diskless)). No
  contractual availability commitment, and no SLA of any kind, was named at the
  Supabase acquisition either
  ([beri.net](https://www.beri.net/article/supabase-turso-acquisition-database-per-agent-sqlite-postgres-pricing-continuity)).
- **Observed availability is bimodal.** The AWS region monitors read ≈99.99% at
  90 days. The per-city "Global" probes do not: **8 of 15 were below 99.95% on
  the 30-day window**, with Singapore and Johannesburg near 99.70% — roughly
  **2 hours of downtime in the last 30 days**
  ([status page snapshot](../../sources/datasets/turso-cloud-region-uptime-2026-10-28.md)).
  The cheap regions are the ones with the weakest observed record.
- **The write-path ceiling moved in 2026 but is not GA.** `BEGIN CONCURRENT`
  (row-level MVCC) entered **early preview on Turso Cloud on 2026-08-03**, and
  Turso 0.8 (2026-09-29) reports 9,500 TPS at 64 connections with p99.9
  transaction latency of 2.4 ms, against SQLite's 1,370 TPS and 1.2 s
  ([0.8 post](https://turso.tech/blog/turso-0.8.0)). Those are local-engine
  microbenchmarks, not Turso Cloud round-trip numbers.
- **Verdict, sharpened:** production-viable for **read-heavy, per-tenant or
  per-agent workloads on libSQL**, with your own independent backups and an
  explicit staleness policy. **Not** a Postgres replacement for
  strongly-consistent multi-region writes. **Not** a place to put a critical
  path on the new engine yet.

## Context

Researched originally on 2026-10-07 to answer *"is Turso reliable for a
production use case, and are there any issues?"*, then revisited on 2026-10-28
because four of that version's claims had moved and two were wrong.

What changed in the intervening three weeks, and what this revision adds:

| Item | 2026-10-07 version | 2026-10-28 |
|---|---|---|
| Rust engine status | "beta, do not build on it" | Out of beta at v0.7.0 (2026-07-13); still pre-1.0; **early preview on Turso Cloud** |
| Concurrent writes | "experimental, Rust engine only" | **Early preview on Turso Cloud** since 2026-08-03 |
| 99.95% "SLA" | Stated as Turso's SLA | It is AWS's single-AZ S3 Express SLA, quoted by Turso. No Turso SLA found |
| Observed uptime | Open question | Answered — see §2.2; 8 of 15 probes below 99.95% |
| Paid-tier DB count | "finite" | Pricing page says **Unlimited**; 2025 announcement said 1,000 — unresolved |
| Incidents since | Through 2026-08-04 | Adds 2026-10-16 (Fly regions) and 2026-10-26 (us-east-1 LB) |

The question this file answers is narrow and practical: **if I put a real
workload on Turso Cloud next month, what breaks, how often, and what do I have
to build myself?**

## Findings

### 1. Two engines, three maturity levels

The platform docs are explicit that Turso Cloud hosts two engines, and that the
newer one is preview-quality *on the platform* even though the engine itself has
left beta ([docs.turso.tech/turso-cloud](https://docs.turso.tech/turso-cloud)):

| Surface | Status | Engine | Constraints |
|---|---|---|---|
| **libSQL on Turso Cloud** | Production-grade | C fork of SQLite | Single writer per database; WAL replication |
| **Embedded replicas** | "Fully supported in production" | libSQL | Local file; writes go to primary |
| **Turso Sync** | Recommended for new sync projects | Turso Database | Last-push-wins conflict resolution |
| **Turso Database engine, standalone** | Out of beta (v0.7.0 → v0.8) | Rust rewrite | Pre-1.0; some features flagged experimental |
| **Turso Database on Turso Cloud** | **Early preview** | Rust rewrite | `turso db create --tursodb` |

Two corrections to the earlier reading of this:

1. The [libSQL repo README](https://github.com/tursodatabase/libsql) still says
   *"Turso is currently in beta"*. That README is **stale** — v0.7.0 removed the
   beta warning from GitHub and the SDKs on 2026-07-13
   ([release post](https://turso.tech/blog/turso-0.7.0)). Prefer the release
   post over the README.
2. "Out of beta" is not "done". The same release post sets the bar explicitly:
   *"Our bar is SQLite-level reliability... Until we get there, we recommend
   keeping regular independent backups."* That is the vendor telling you the
   engine is not yet trusted to keep your data on its own.

libSQL's own status is not ambiguous. The docs page states it outright:

> "If you're starting a new project, we recommend Turso Database. **For
> mission-critical workloads that need a battle-tested foundation today, libSQL
> is the right choice.**"
> — [docs.turso.tech/libsql](https://docs.turso.tech/libsql)

The repository README says the same in maintenance-mode terms: *"libSQL is
actively maintained, but new features are being developed in Turso"*
([GitHub](https://github.com/tursodatabase/libsql)).

That is a rare thing for a vendor to publish — the two-engine split stated
plainly, with the recommendation inverted from the marketing default. It should
settle the choice for anyone building something they have to keep.

> **Adoption rule:** libSQL on Turso Cloud for anything you need to keep. The
> Rust engine only where you can afford to be the one who finds the bug.

### 2. Availability: what is promised, and what is measured

#### 2.1 There is no published SLA

Searches for a Turso service-level agreement, uptime commitment, or service
credit schedule returned no Turso document. What the internet quotes as
"Turso's 99.95% SLA" traces to one sentence in the diskless architecture post,
which is describing the *substrate*, not a commitment to the customer:

> "Data durability is still guaranteed to be 99.999999999% (that's 11 9s) by AWS
> SLAs, but the uptime SLA is that of a single availability zone, which
> according to AWS is 99.95%."
> — [diskless post, 2025-04-07](https://turso.tech/blog/turso-cloud-goes-diskless)

Read precisely: 11 nines of **durability** is an AWS SLA that Turso inherits by
construction. 99.95% of **availability** is the AWS single-AZ number that Turso
inherits as its *ceiling*. Neither is a Turso promise, and neither carries a
credit.

The acquisition announcement did not add one: *"neither company names a price,
an SLA or a close date"*
([beri.net, 2026-10-03](https://www.beri.net/article/supabase-turso-acquisition-database-per-agent-sqlite-postgres-pricing-continuity)).

> **Implication:** you cannot buy an availability guarantee from Turso at any
> published tier, including Pro at ~$417/month. If your contracts require one,
> it needs to be negotiated, and the negotiation is with a company being
> acquired.

#### 2.2 Observed uptime is bimodal, and the weak half is the cheap half

Full captured table in
[sources/datasets/turso-cloud-region-uptime-2026-10-28.md](../../sources/datasets/turso-cloud-region-uptime-2026-10-28.md).
Headline numbers, 90-day and 30-day windows:

| Population | 90-day range | 30-day range | Below 99.95% at 30d |
|---|---|---|---|
| AWS region monitors (10 regions) | 99.986–99.995% | 100% | 0 of 10 |
| "Global" city probes (15 cities) | 99.901–99.993% | 99.701–99.980% | **8 of 15** |

The eight Global probes under 99.95% at 30 days, with the downtime that implies
over a 720-hour window:

| City | 30d uptime | Downtime in 30d |
|---|---|---|
| Singapore | 99.701% | ~2h 09m |
| Johannesburg | 99.705% | ~2h 07m |
| Los Angeles | 99.811% | ~1h 22m |
| Stockholm | 99.817% | ~1h 19m |
| London | 99.873% | ~55m |
| Toronto | 99.877% | ~53m |
| Sydney | 99.914% | ~37m |
| Dallas | 99.938% | ~27m |

**How to read this without overclaiming.** The AWS monitors and the Global
probes are different measurements. The page says the Global figures come from
"querying a database deployed in all regions", and warns that "other factors
like individual host failures can affect your databases further"
([status.turso.tech](https://status.turso.tech/)). Turso does not document
which footprint each probe covers. The 2026-10-16 incident — *"Degraded for Fly
regions"* — is consistent with the degraded probes living in the **legacy
Fly.io multi-region footprint** rather than the AWS one. That is an inference,
not a published fact.

**What is safe to say:** if you deploy to an AWS region, the platform's own
monitors show ≈99.99%. If you consume the legacy multi-region replication
footprint, expect materially worse — around two hours a month in the worst
locations. Those are also the locations teams pick for latency to Asian and
African users, which is exactly the reason to choose a multi-region database.

Also worth noting: **vendor self-reporting is all you get.** The only
third-party tracker found, Pulsetic, claimed "0 incidents on record since Jul
2026" on 2026-10-28 while the vendor page listed two October incidents
([pulsetic.com](https://pulsetic.com/status/turso/)). A tracker that misses
logged incidents is not a corroborating source.

#### 2.3 Incident history

| Date | Scope | Cause per Turso | Duration |
|---|---|---|---|
| 2023-10-17 → 11-20 | Val Town tenant isolation | Deploy changed group/DB detection | ~5 weeks undetected |
| 2023-12-04 | 0.07% of free-tier DBs | Migration wrote an empty backup ID | leak + loss |
| 2025-01-22 | AWS beta region | User-reported; no post-mortem found | reported loss |
| 2026-05-08 | Some DBs | AWS US-EAST-1 outage | not stated |
| 2026-05-22 | Platform API | not stated | same day |
| 2026-08-04 | AWS us-east-1 | Multitenant server down → retry cascade → routing overload | **48m** |
| 2026-10-16 | Fly regions | not stated | ~1 day to resolve |
| 2026-10-26 | AWS us-east-1 | "Malfunctioning load balancer caused intermittent timeouts" | **1h 40m** |

Sources: [status incidents](https://status.turso.tech/incidents),
[2023-12 post-mortem](https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7).
The full incident archaeology, including the corrected count and the "multiple
data loss incidents" claim, is in
[Turso Data Loss & Data Exposure Incidents](./turso-data-loss-incidents.md).

Two observations that matter for planning:

1. **The 2026 pattern is load-balancer and routing faults in us-east-1, not
   storage faults.** 2026-08-04 and 2026-10-26 are the same shape: a control
   path in the busiest region hurts availability while the durable data is
   untouched. Assume us-east-1 is your risk concentration if you default there —
   which is the default.
2. **Durations are short but frequent enough to plan for.** 48 minutes and 100
   minutes inside 83 days is roughly 3 hours/year of *reported* database-query
   degradation in us-east-1 alone, before counting unreported host-level events.

### 3. Durability: genuinely strong, with a single-AZ asterisk

The storage model is the strongest part of the product, and it is worth
understanding because it explains both the durability claim and the availability
ceiling ([durability post](https://turso.tech/blog/how-does-the-turso-cloud-keep-your-data-durable-and-safe),
[diskless post](https://turso.tech/blog/turso-cloud-goes-diskless),
[AWS case study](https://aws.amazon.com/blogs/storage/how-turso-built-a-transactional-database-using-amazon-s3-express-one-zone/)):

- A database is split into **128 kB segments**; the set of live segments is a
  *generation*. Local NVMe is only a **cache** — S3 is the source of truth.
- The **WAL since the last generation is written to S3 Express One Zone**, and
  *"only after the data is safely stored in S3 Express, is the transaction
  acknowledged."* Durable write latency averages **6.4 ms** in AWS's own write-up.
- Servers checkpoint aggressively, *"usually after each 1MB written"*, because
  the entire WAL must be resident locally to serve any query.
- S3 Express One Zone is **not replicated across availability zones**. Durability
  survives that (11 nines); availability does not — an AZ event is an outage.

The competitive significance: this is the only mainstream SQLite host whose
durable write path is a single-digit-millisecond object-store append instead of
an fsync to local disk, and it is what makes per-database provisioning at
millions-of-databases scale economically possible. It is also entirely
proprietary — the server went closed-source in January 2025
([roadmap post](https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap)).

### 4. The write path in 2026: MVCC arrives as a preview

This is the largest change since the previous revision, and the one most likely
to be misreported.

libSQL inherits SQLite's single-writer lock: concurrent writers get
`SQLITE_BUSY` and queue. Turso Database replaces it with row-level MVCC, and on
**2026-08-03** Turso opened concurrent writes on Turso Cloud as an **early
preview, open to everybody**
([announcement](https://turso.tech/blog/concurrent-writes-on-turso-cloud)):

```sql
PRAGMA journal_mode = 'mvcc';
BEGIN CONCURRENT;
-- writes here
COMMIT;   -- conflicts surface at commit, row granularity
```

Application code must detect and retry conflicts
([docs](https://docs.turso.tech/tursodb/concurrent-writes)) — the commit can
fail, which is a semantics change from "the write blocks" to "the write may be
rejected". Turso 0.8 then added group commit to fix the tail latency that
early MVCC exposed ([0.8 post](https://turso.tech/blog/turso-0.8.0),
[group commit post](https://turso.tech/blog/turso-group-commit)):

| Metric | Turso 0.8 | SQLite | Claim |
|---|---|---|---|
| p99.9 transaction latency, 32 conns | 2.4 ms | 1.2 s | 500x lower |
| Concurrent write throughput, 64 conns | 9,500 TPS | 1,370 TPS | 7x higher |

**Three caveats before quoting these.**

1. They are **local-engine microbenchmarks**, not Turso Cloud over the network.
   A Turso Cloud write still crosses the network to a primary and, per §3, waits
   for an S3 Express append.
2. **Early preview is not a support commitment.** Nothing in the pricing or SLA
   discussion covers it.
3. Independent observers dispute the engine's bulk-write performance. A
   ClickBench contributor reported import throughput collapsing to "4 kilobytes
   per second" and abandoning the dataset after a year; a Turso maintainer
   replied that it is on the radar but "not the highest priority right now"
   ([HN thread](https://news.ycombinator.com/item?id=49934784)). Benchmark
   yourself before assuming the 7x.

Turso's own earlier MVCC write-up is the one to read for the caveat rather than
the number: it concedes "performance limitations on row version management and
concurrency that we'll be working on"
([2025 post](https://turso.tech/blog/beyond-the-single-writer-limitation-with-tursos-concurrent-writes)).

For libSQL — the surface you should actually use — the old ceiling stands. An
independent 2026 comparison puts the practical limit at *"the low tens of
thousands of writes per second under ideal conditions, and much lower with
complex transactions"*
([kanopylabs](https://kanopylabs.com/blog/sqlite-for-production-turso-litefs-d1)).

### 5. Read path: embedded replicas, or Turso Sync

Two distinct mechanisms, and the docs now have a preference
([embedded replicas](https://docs.turso.tech/features/embedded-replicas/introduction)):

| Dimension | Embedded Replicas | Turso Sync |
|---|---|---|
| Engine | libSQL | Turso Database |
| Replication unit | **pages** | **logical change-data-capture** |
| Local writes | Only with `offline: true` | First-class; explicit `push()` / `pull()` |
| Conflict model | Write to primary; last sync wins locally | **Last push wins**, row-level |
| Maturity | "Fully supported in production" | Recommended for new projects |
| Bandwidth | Higher (page frames) | "Significantly less" |

The semantics that bite are the same in both: **embedded replicas give
read-your-writes only on the replica that issued the write**. Every other
replica serves stale data until it syncs, with no error and no bound. Turso Sync
is more explicit about what that costs: *"COMMITTED WRITE transactions which
overlap with WRITE transactions that are still open MAY be delayed"*
([sync usage](https://docs.turso.tech/sync/usage)). That sentence is the one to
paste into a design review.

The deciding argument is still workload shape, not feature set:

| Workload | Fit | Reason |
|---|---|---|
| Read-heavy catalog, content, config, dashboards | **Good** | Local reads in microseconds; writes rare |
| Per-tenant / per-agent DB fleet | **Good** | A file per tenant is the cheapest isolation in the industry |
| Mobile / offline-first with sync | **Good**, on Sync | Seasonal connectivity, local writes are the point |
| Cross-region read-after-write for money | **Poor** | No bound on replica staleness |
| Chat, event ingestion, telemetry | **Poor** | Write round-trip per statement |
| Analytics over 100M+ rows | **Wrong tool** | No columnar engine; see the ClickBench complaints |

### 6. Correctness gotchas that actually bite

The five failure patterns catalogued by Perun Engineering remain accurate as of
this revision ([perun.au](https://perun.au/insights/turso-production/)), and two
more belong on the list:

1. **Split-writer data loss.** App code writes to the local SQLite file with a
   vanilla driver while the libSQL client also writes; the local write is
   **silently discarded** on next sync. Easy in Rust/Go/Python, where a SQLite
   dependency is already present. Symptom: data persists locally, then vanishes
   with no exception.
2. **Token-expiry silent failures.** Expired JWT tokens can yield empty result
   sets or local-only reads in edge runtimes that have no background refresh
   loop.
3. **Migration/replica race.** Primary applies DDL immediately; replicas lag.
   Blue-green deploys get a window of inconsistent reads. Gate deploys on
   `db.sync()` completing everywhere.
4. **libSQL WASM size limit.** The WASM binary exceeds Cloudflare Workers' 1 MB
   compressed limit at deploy time (works locally). Use the HTTP API or a
   Durable Object binding.
5. **Multi-tenant quota exhaustion.** Signups start failing when tenant DBs are
   never cleaned up on churn.
6. **HTTP transaction and connection timeouts.** SQL over HTTP gives a
   transaction **5 seconds** to complete and closes an idle connection after
   **10 seconds** ([HTTP reference](https://docs.turso.tech/sdk/http/reference)).
   Long migrations, batch backfills, and `VACUUM`-style operations issued over
   HTTP will be cut off mid-flight, and a half-applied non-transactional
   migration leaves the database in a state you then have to repair.
7. **Sync puts on an open write transaction are dropped.** With Turso Sync,
   committed writes that overlap a still-open write transaction "may be
   delayed" — push with no write transaction open or lose the ordering
   assumption you thought you had
   ([sync usage](https://docs.turso.tech/sync/usage)).

> **Pattern:** every one of these is *silent*. None is a crash. None appears in
> an error-rate dashboard. That is the real reliability hazard with Turso, more
> so than its two-hour months in Singapore.

### 7. Platform limits you hit in production

| Limit | Value / behaviour | Consequence |
|---|---|---|
| `PRAGMA user_version` | Read-only | Migration tracking must use a `_schema_version` table |
| `PRAGMA application_id` | Read-only | Use a `_metadata` table |
| `PRAGMA busy_timeout` | Unsupported, no effect | Retry logic is yours to write |
| `PRAGMA journal_mode` | Unsupported on libSQL Cloud | Cannot switch to MVCC on libSQL; `mvcc` is a Turso-engine feature |
| HTTP transaction window | 5 s | Long transactions must use a driver connection, not HTTP |
| HTTP idle connection | Closed after 10 s | Connection reuse needs the baton kept warm |
| Server source | Closed since Jan 2025 | Self-hosting the *cloud* is not possible; libSQL is |
| Multi-DB schemas / `ATTACH` | Removed for new users, Jan 2025 | One database = one schema; cross-DB joins impossible |
| Per-account database count | Free: 100. Paid: page says **Unlimited**; 2025 announcement said 1,000 | Unresolved — confirm before designing a 10k-tenant fleet on Developer |
| Regions | 10 AWS regions (4 continents) as of 2026-10-01 | Legacy Fly regions still exist and are the degraded ones |

Sources: [limitations](https://docs.turso.tech/cloud/limitations),
[HTTP reference](https://docs.turso.tech/sdk/http/reference),
[regions post](https://turso.tech/blog/turso-cloud-new-regions),
[roadmap post](https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap),
[pricing](https://turso.tech/pricing).

The removed-database-limit conflict is worth naming plainly: the pricing page
says *Unlimited* for every paid tier, while the 2025 Developer-plan announcement
says *1,000*, and the earlier Scaler plan was documented at 10,000. Do not
design a per-tenant fleet on "Unlimited" until someone at Turso confirms it in
writing — and remember §7 of the acquisition note: no commitments were made
about future pricing.

### 8. Operations: backup, recovery, portability

Point-in-time recovery is real, automatic, and — importantly — **not an
in-place restore** ([PITR docs](https://docs.turso.tech/features/point-in-time-recovery)):

| Plan | PITR window | Deleted-DB recovery |
|---|---|---|
| Free | 1 day | — |
| Developer | 10 days | 5 days |
| Scaler | 30 days | 5 days |
| Pro | 90 days | 5 days |
| Enterprise | 90 days | 5 days |

Recovery mechanics — read these before an incident, not during one:

- Backups are created **automatically at every COMMIT**; there is no backup job
  to configure and nothing to schedule.
- A restore **creates a new database**. You then update your connection string,
  issue a new token, and delete the old database by hand. Restores count against
  your database quota.
- PITR **cannot bring back a deleted database**. Paid plans get a separate
  five-day deleted-database recovery window.
- Delete Protection exists (April 2025) for databases and groups
  ([announcement](https://turso.tech/blog/prevent-accidental-deletes-with-database-and-group-delete-protection)),
  but it guards deliberate deletes, not the migration/backup-ID class of bug that
  caused the 2023 incident.

Against that, two things you should build yourself:

1. **An independent dump on a schedule you control.** `turso db shell <db> .dump`
   produces a portable SQL file with no internal tables
   ([CLI docs](https://docs.turso.tech/cli/db/shell)). Turso's own v0.7 release
   post tells you to keep independent backups. Take that literally: if the
   control plane is the thing that breaks — which is what broke in every
   documented incident — a backup inside that control plane is not a backup.
2. **A restore drill.** The PITR cutover is manual, involves a new token, and
   changes the connection string. If nobody has timed that end to end, your RTO
   is a guess.

Portability is otherwise good: SQLite file format, `sqlite3`-loadable dumps, and
an open-source client. The lock-in is the control plane and the closed-source
server, not the data.

### 9. Security and compliance

| Item | Status | Source |
|---|---|---|
| SOC 2 Type II | Certified | [encryption post](https://turso.tech/blog/sqlite-encryption-in-production) |
| Encryption at rest | Volume- and backup-level | [healthcare page](https://turso.tech/healthcare) |
| BYOK | Per-database customer-held keys, Pro+ | [pricing](https://turso.tech/pricing) |
| HIPAA / BAA | Advertised on paid tiers | pricing |
| Data residency | Per-region buckets; 10 AWS regions | [durability post](https://turso.tech/blog/how-does-the-turso-cloud-keep-your-data-durable-and-safe) |
| BYOC | AWS bring-your-own-cloud deployment exists | [AWS post](https://aws.amazon.com/blogs/storage/how-turso-built-a-transactional-database-using-amazon-s3-express-one-zone/) |

The residency claim is architectural rather than policy: "each database region
has its own S3 bucket, guaranteeing that data doesn't leave the jurisdiction
where the compute takes place." That is stronger than a contractual promise, and
it is the one place where Turso's design beats a typical managed Postgres.

### 10. Cost

Current published pricing ([turso.tech/pricing](https://turso.tech/pricing)):

| Plan | Price | Databases | Storage | Rows read/mo | Rows written/mo | PITR |
|---|---|---|---|---|---|---|
| Free | $0 | 100 | 5 GB | 500 M | 10 M | 1 day |
| Developer | $4.99/mo | Unlimited | 9 GB +$0.75/GB | 2.5 B +$1/B | 25 M +$1/M | 10 days |
| Scaler | $24.92/mo | Unlimited | 24 GB +$0.50/GB | 100 B +$0.80/B | 100 M +$0.80/M | 30 days |
| Pro | $416.58/mo | Unlimited | 50 GB +$0.45/GB | 250 B +$0.75/B | 250 M +$0.75/M | 90 days |

Two cost facts that decide architectures:

- **Idle databases cost storage only.** This is what makes one-database-per-agent
  or per-user economically sane, and it is the product's actual differentiator.
  The free tier has had **no cold starts** since 2025-03-31
  ([Developer plan post](https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan)).
- **Writes are metered separately from reads, at ~25 M/month on the cheap tier.**
  A workload doing one write per request reaches the Developer write allowance at
  about 10 requests/second sustained. Chat and telemetry blow through it; a
  catalog does not.

### 11. Vendor risk after the Supabase acquisition

Supabase announced on **2026-10-02** that it is acquiring Turso, alongside a
$150M raise ([announcement](https://turso.tech/blog/turso-is-joining-supabase)).
Stated commitments: Turso keeps running, Turso Database stays open source, and
there is a "graduation path" toward Postgres.

Independent reporting adds the constraints the announcement leaves out: **no
price, no close date, no SLA, and no commitment about future pricing**; Supabase
says 70% of new databases on its platform are created by AI tools, which is the
strategic reason a Postgres company bought a SQLite one
([beri.net](https://www.beri.net/article/supabase-turso-acquisition-database-per-agent-sqlite-postgres-pricing-continuity)).

Stack that on the January 2025 churn — edge replicas discontinued, multi-DB
schemas removed for new users, server closed, free tier moved to AWS, layoffs —
and the pattern is a company that has re-aimed its product twice in two years.
Each re-aim was handled decently for existing paid customers. None was
predictable from outside.

> **What this means operationally, concretely:** keep the data portable (§8),
> avoid designing around a specific tier's quota (§7), and do not build on a
> preview surface whose sponsor may reprioritise it (§1).

## Open Questions

| Question | Status 2026-10-28 |
|---|---|
| Is there a contractual uptime SLA? | **Answered: no public one.** None found on the site, pricing, or in the acquisition terms |
| Is Turso Cloud still single-AZ? | **Answered: yes.** No multi-AZ option published; the diskless design is single-AZ by construction |
| Is libSQL in maintenance mode? | **Answered: effectively yes** — "actively maintained, but new features are being developed in Turso" |
| Is Turso Sync production-ready? | **Partly.** Recommended for new projects by the docs; built on a pre-1.0 engine |
| Observed uptime over 12 months? | **Partly.** 30/60/90-day windows captured; no 12-month or third-party series exists |
| Is the paid-tier database count unlimited? | **No — unresolved.** Pricing says Unlimited, 2025 post says 1,000 |
| Does multi-AZ exist for Enterprise/BYOC? | **Unknown.** `[unverified]` — worth asking directly if you need it |
| Will the 2026 us-east-1 load-balancer incidents recur? | **Unknown.** Two in 83 days, no published RCA for either |
| Does the 70% AI-created-databases claim hold? | **`[unverified]`** — Supabase's own figure, not independently checked |

## Verdict

| Use case | Recommendation | Binding constraint |
|---|---|---|
| Read-heavy app on libSQL, single region | **Adopt** | Take your own dumps; budget for ~1h/quarter of us-east-1 degradation |
| Per-tenant / per-agent DB fleet | **Adopt** | Confirm the database-count cap in writing first |
| Multi-region reads with an explicit staleness policy | **Adopt with care** | 8 of 15 probes below 99.95% at 30 days |
| Mobile / offline-first | **Adopt on Turso Sync** | Last-push-wins is your merge policy whether you chose it or not |
| Write-heavy ingestion, chat, telemetry | **Do not adopt** | Per-statement network round-trip; libSQL single writer |
| Cross-region read-after-write for payments | **Do not adopt** | No bound on replica staleness |
| Critical path on the Rust engine | **Do not adopt yet** | Early preview on Turso Cloud; pre-1.0 |
| Contractual SLA requirement | **Do not adopt** | No published SLA at any tier |
| Analytics / large scans | **Do not adopt** | Wrong engine class |

**Bottom line.** Turso's *durability* engineering is the best in the SQLite-hosting
space and its *availability* is ordinary — roughly 99.99% on AWS regions, worse
in the legacy multi-region footprint, with no guarantee attached and a real
one-to-two-hour incident every couple of months in its busiest region. Its
production risk was never the storage layer; it is the **silent** failure modes
(stale replicas, discarded local writes, expired tokens, HTTP transaction
cutoffs) and the **vendor's habit of re-aiming the product**.

That combination is fine for the workload it was built for — many small,
read-heavy, per-tenant databases where a two-hour regional wobble is a
degradation and not a business event. It is not fine as a general Postgres
replacement, and the 2026 engine work does not change that yet.

## Related

- [Turso Data Loss & Data Exposure Incidents — Deep Dive](./turso-data-loss-incidents.md) — the incident archaeology behind §2.3 and §11.
- [Turso Cloud Region Uptime Snapshot — 2026-10-28](../../sources/datasets/turso-cloud-region-uptime-2026-10-28.md) — captured status-page data behind §2.2.
- [Drizzle Effect Integration](./drizzle-effect-integration.md) — client-layer integration if this becomes a build decision.

## Changelog

- 2026-10-28 — **major revision.** Corrected three claims: (1) the Rust engine is
  out of beta since v0.7.0 (2026-07-13), though it is *early preview* on Turso
  Cloud; (2) the "99.95% SLA" is AWS's single-AZ S3 Express figure quoted by
  Turso, not a Turso commitment — no SLA found at any tier; (3) paid-tier
  database counts are listed as Unlimited, conflicting with the 2025
  announcement's 1,000. Added observed per-region uptime (8 of 15 probes below
  99.95% at 30 days), the 2026-10-16 and 2026-10-26 incidents, concurrent-writes
  early preview and 0.8 benchmarks, HTTP transaction/connection timeouts, PITR
  and deleted-DB recovery semantics, SOC 2 and BYOK posture, Turso Sync conflict
  model, and post-acquisition terms. Resolved or re-scoped every prior open question.
  Researched via TinyFish (`mcp__tinyfish__search` /
  `mcp__tinyfish__fetch_content`) across 35 sources.
- 2026-10-07 — created. Researched via TinyFish across 16 sources listed in
  front matter.
