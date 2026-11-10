---
title: Cloudflare Durable Objects and SQLite in Production — Reliability Review, With an APAC Focus
category: technology
tags: [cloudflare, durable-objects, sqlite, serverless, stateful, actors, apac, latency, reliability, incident-review]
status: complete
created: 2026-10-28
updated: 2026-11-09
sources:
  - https://developers.cloudflare.com/durable-objects/platform/limits/
  - https://developers.cloudflare.com/durable-objects/reference/data-location/
  - https://developers.cloudflare.com/durable-objects/platform/pricing/
  - https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
  - https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
  - https://developers.cloudflare.com/changelog/post/2025-04-07-sqlite-in-durable-objects-ga/
  - https://developers.cloudflare.com/changelog/post/2026-06-19-apac-ne-apac-se-location-hints/
  - https://developers.cloudflare.com/d1/platform/limits/
  - https://blog.cloudflare.com/sqlite-in-durable-objects
  - https://simonwillison.net/2024/Oct/13/zero-latency-sqlite-storage-in-every-durable-object/
  - https://where.durableobjects.live/
  - https://where.durableobjects.live/api/v3/data.json
  - https://news.ycombinator.com/item?id=48846757
  - https://news.ycombinator.com/item?id=32996261
  - https://orangecloud.report/products/durable-objects/
  - https://shattered.io/cloudflare-outage-august-2026/
  - https://pulsetic.com/status/cloudflare/incidents/138453/
  - https://pulsetic.com/status/cloudflare/incidents/144850/
  - https://community.cloudflare.com/t/durable-objects-availability-degraded-in-asia-pacific/821828
  - https://community.cloudflare.com/t/increased-errors-for-r2-and-durable-objects-in-the-asia-pacific-apac-region/744263
  - https://www.reddit.com/r/CloudFlare/comments/1qm9uxb/durableobjects_location_when_instantiated_via/
  - https://www.reddit.com/r/CloudFlare/comments/1k3irnx/cloudflare_worker_d1_consistently_taking_800ms/
  - https://www.reddit.com/r/CloudFlare/comments/1qk6z8q/anyone_hosted_saas_fully_on_cloudflare_mine_slow/
  - https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8
  - https://ainoya.dev/posts/durable-object/
  - https://www.lambrospetrou.com/articles/durable-objects-cloudflare/
  - https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/index.md
  - https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/index.md
  - https://developers.cloudflare.com/basin-sql/index.md
  - https://developers.cloudflare.com/k2/index.md
  - https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
  - https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
  - https://developers.cloudflare.com/durable-objects/release-notes/
  - https://developers.cloudflare.com/workers/platform/limits/
  - https://www.cloudflare.com/business-sla/
  - https://www.cloudflarestatus.com/history
  - https://pulsetic.com/status/cloudflare/incidents/157723/
  - https://community.cloudflare.com/t/increased-errors-for-durable-objects-in-western-europe/977371
  - https://usewire.io/engineering/why-were-moving-wire-off-cloudflare-durable-objects/
  - https://camelai.com/blog/should-you-build-on-cloudflare
  - https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/
  - https://celld.dev/
  - https://github.com/denoland/celld
confidence: medium
---

# Cloudflare Durable Objects and SQLite in Production — Reliability Review, With an APAC Focus

## TL;DR

- **The durability is not the weak point.** A SQLite-backed Durable Object (the feature the
  question calls "durable SQLite") streams its WAL to object storage every 10 s or 16 MB, and
  acknowledges a write only after three of five replicas in separate nearby data centers
  confirm it ([Willison on Varda's post](https://simonwillison.net/2024/Oct/13/zero-latency-sqlite-storage-in-every-durable-object/),
  [Cloudflare's SRS design post](https://blog.cloudflare.com/sqlite-in-durable-objects),
  [HN](https://news.ycombinator.com/item?id=32996261)). The complaint that recurs among
  operators is the opposite of "it loses data": **you cannot move the state**, and a bad host
  or a bad placement takes the object away from you on Cloudflare's schedule, not yours
  ([HN: Why we're moving off Durable Objects](https://news.ycombinator.com/item?id=48846757),
  [Orange Cloud Report](https://orangecloud.report/products/durable-objects/)). Both teams
  that published a 2026 migration away from DOs open by saying the same thing — placement and
  a vector index that could not come inside the object were the reasons, "not reliability" —
  and both stay on Workers for everything else
  ([Wire](https://usewire.io/engineering/why-were-moving-wire-off-cloudflare-durable-objects/),
  [camelAI](https://camelai.com/blog/should-you-build-on-cloudflare)).
- **For APAC the binding constraint is placement, not the platform.** Durable Objects run in a
  small subset of Cloudflare's network — the community tracker measures **10.76% of PoPs** and
  I count **30 host colos worldwide, 8 of them in APAC**: `SIN`, `HKG`, `NRT`, `KIX`,
  `ICN`, `SYD`, `MEL`, `BNE`
  ([where.durableobjects.live](https://where.durableobjects.live/),
  [v3 dataset](https://where.durableobjects.live/api/v3/data.json)). India, Indonesia,
  Malaysia, Thailand, Vietnam, the Philippines, Taiwan and New Zealand have **no local DO
  host**; their traffic is served from Singapore, Hong Kong, Japan or Australia. Measured
  nearest-region RTT ranges from ~19 ms (Tokyo) to **172 ms (Wellington)**.
- **Region hints are a footgun in APAC.** A DO does not change location after creation
  ([data location docs](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
  Picking `apac` for a Sydney audience costs ~558 ms instead of ~28 ms under `oc`; picking
  `apac-ne` for an Indian audience costs ~488 ms instead of ~93 ms under `apac`. The hints
  are best-effort, not guarantees
  ([changelog 2026-06-19](https://developers.cloudflare.com/changelog/post/2026-06-19-apac-ne-apac-se-location-hints/)).
- **DO has a documented incident history, and APAC carries three of the five entries.** Public
  status records name APAC-specific Durable Object degradation on 2024-12-04 (R2 + DO,
  Singapore), 2025-07-29 (availability degraded in Asia Pacific) and 2026-09-17 (DO +
  downstream, 1 h 16 m), plus the August 2026 streak and — newest, and outside APAC — 19 h 41 m
  of DO errors in Western Europe from 2026-11-05
  ([2024-12-04](https://community.cloudflare.com/t/increased-errors-for-r2-and-durable-objects-in-the-asia-pacific-apac-region/744263),
  [2025-07-29](https://community.cloudflare.com/t/durable-objects-availability-degraded-in-asia-pacific/821828),
  [2026-09-17](https://pulsetic.com/status/cloudflare/incidents/138453/),
  [Aug 2026](https://shattered.io/cloudflare-outage-august-2026/),
  [2026-11-05](https://pulsetic.com/status/cloudflare/incidents/157723/)). None published a
  root cause.
- **Verdict.** DO + SQLite is production-ready as a **coordination and per-entity state
  layer** — rooms, sessions, counters, per-user databases, agent state. It is not ready to be
  the **only** copy of a business's data, the home of a long-running agent loop, the hot path
  for a shared table, or a vector index. In APAC it is also not ready to be a latency-critical
  hot path for users outside the eight host metros without deliberate hinting and a fallback.

## Context

The question is whether Cloudflare Durable Objects, and the SQLite storage attached to them,
hold up in production. It is answerable rather than vibes-based: Cloudflare publishes hard
limits and placement rules, and a community site publishes what placement actually resolves
to per colo with measured RTTs. Public incident history and operator write-ups fill in the
rest. It is also the shortest question in this repo with the most prior art behind it, so
every number below is re-read from source rather than carried forward.

Terminology, because the question mixes two names. There is no Cloudflare product called
"Durable SQLite". There are **SQLite-backed Durable Objects**: Durable Objects whose storage
backend is SQLite instead of the deprecated key-value backend. They went GA on 2025-04-07 with
a 10 GB database per object, and they are the only backend available to new namespaces —
Workers Free can create nothing else, and the KV backend is closed to new namespaces on paid
plans too ([GA changelog](https://developers.cloudflare.com/changelog/post/2025-04-07-sqlite-in-durable-objects-ga/),
[pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Class lifecycle
now runs through a declarative `exports` block, whose `storage` field accepts `"sqlite"` for a
new class and whose docs keep the KV backend "available for existing namespaces"
([class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)).
So the practical question for a new class is not "SQLite or KV" but "is this object model
sound for my workload".

## "Safe" is three different questions

The question "is DO + SQLite safe for production" bundles three claims that hold or fail
independently. Answering them together is how teams end up either over-scared or
under-prepared.

| Claim | What it means | Verdict | Why |
| --- | --- | --- | --- |
| **Durability** | A write that returned success is not lost | **Yes, with a real RPO** | 3-of-5 replica ack plus WAL batches every 10 s / 16 MB; 30-day PITR per object ([Willison](https://simonwillison.net/2024/Oct/13/zero-latency-sqlite-storage-in-every-durable-object/), [PITR API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)) |
| **Availability** | The object answers when called | **Mostly, not to an SLA you can hold** | 8 APAC host colos, a documented incident history, single-host blast radius — see [the incident record](#the-incident-record) |
| **Contractual guarantee** | Cloudflare owes you something when it fails | **No product-specific uptime SLA** | The published SLA defines "Service" as Cloudflare's network and APIs and names no DO line ([business SLA](https://www.cloudflare.com/business-sla/)); durability is documented as behaviour, not as a commitment |

The third row is the one teams miss, and it is the real answer to "is it safe". Every other
answer here — replication, PITR, graceful `SQLITE_FULL` — describes *engineering behaviour*.
None of it is a number Cloudflare contracts to deliver. The
[business SLA](https://www.cloudflare.com/business-sla/) is written over "the Service" — the
information, tools and APIs reached through Cloudflare — and commits to "100% Uptime" of
serving Customer Content against that definition; Durable Objects, Workers and D1 are not
named anywhere in it, and the Enterprise counterpart defers to a negotiated subscription
agreement. So the honest framing is: **the platform behaves durably, but you cannot buy a
durability or availability guarantee for it.** If a contract requires an uptime number, that
number has to come from your architecture — replication to a second system, a read fallback, a
queue-and-replay path — not from the platform.

This is also why the "durable" in Durable Objects misleads. As one operator put it in the
[migration thread](https://news.ycombinator.com/item?id=48846757): "The objects are durable,
but not endurable." The word describes the storage primitive, not a service commitment.

## Naming: four products, one phrase

"Cloudflare durable SQL" could mean any of four shipped things, and only one of them is what
this review covers. Check which you actually want before reading the verdict:

| Product | What it is | Status | Fits the DO question? |
| --- | --- | --- | --- |
| **SQLite-backed Durable Objects** | SQLite inside a single-threaded actor, 10 GB each | GA | **This file** |
| **D1** | Managed SQLite database, thousands per account, read replication | GA | Alternative, not a substitute — no per-entity mutual exclusion |
| **Basin SQL** | Distributed query engine over Apache Iceberg tables on R2 | GA, ex-R2 SQL | No — analytics over object storage, not transactional per-entity state |
| **K2** | Durable log, Kafka-shaped, produce/consume with retention | **Public beta** | No — a log, not a database |

Basin SQL is "durable" in that the Iceberg tables persist in R2, but it is an *analytics*
engine: it answers `SELECT` across large datasets and gives you no actor, no SQLite, no
per-object serialization ([page](https://developers.cloudflare.com/basin-sql/index.md)). K2 is
a durable *log* with a configurable retention window and subscriptions — the right shape for
an event stream, the wrong shape for queryable entity state, and still in beta with a 10 GB
per-account cap ([page](https://developers.cloudflare.com/k2/index.md)). Neither changes the
production-safety verdict for DO + SQLite.

## What the platform actually promises

### Durability

Write path, from Varda's design post as summarised by Willison: the WAL streams to object
storage in batches capped at **16 MB or 10 seconds**, and to cover the gap inside that window a
committed write is forwarded to **five replicas in separate nearby data centers** and
acknowledged once **three** confirm
([source](https://simonwillison.net/2024/Oct/13/zero-latency-sqlite-storage-in-every-durable-object/)).
An HN commenter states the same 3-of-N property independently
([HN 2022](https://news.ycombinator.com/item?id=32996261)).

The consequence is a real RPO smaller than one batch interval, plus **30 days of point-in-time
recovery** that is on by default for SQLite-backed objects, covers the entire database (SQL
rows *and* the hidden `__cf_kv` table), and is scoped per object — so "one DO per user" makes
it "per-user restore" for free
([PITR API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[operator write-up of the API](https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8)).
The API is code-only: `getCurrentBookmark()`, `getBookmarkForTime(ts)` and
`onNextSessionRestoreBookmark(bookmark)`, which returns the pre-restore bookmark so a bad
restore is itself reversible; `ctx.abort()` applies it. There is no dashboard button and no
restore in local dev ([same gist](https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8)).

### Limits that bound the design

| Dimension | Limit | Source |
| --- | --- | --- |
| Storage per object | 10 GB | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Storage per account | Unlimited (Paid) / **5 GB (Free)** — the free cap is per account, not per object | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Requests per object | Soft **1,000 rps**; overload returns an error after queueing | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Simple-op throughput, in practice | ~500–1,000 rps, work-dependent | [Rules of DOs](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) |
| Memory | 128 MB per isolate — the isolate is shared, the bill is not | [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| CPU per invocation | 30 s default, 5 min via `limits.cpu_ms` | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Wall time | Unlimited for DO RPC/HTTP; **15 min for alarms** | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Key + value | **8 MB** combined | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| SQL row / string / BLOB | **8 MB** | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| SQL statement length | 100 KB | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| WebSocket message received | 32 MiB (was 1 MiB until 2025-10-25) | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [release notes](https://developers.cloudflare.com/durable-objects/release-notes/) |
| Columns per table | 100 | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Bound parameters per query | 100 | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| `LIKE`/`GLOB` pattern | **50 bytes** | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Outgoing connections | 6 simultaneous per request | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |

Three of these bite more than their line suggests. The **50-byte LIKE pattern** rules out
user-supplied search prefixes beyond a few characters. The **100 bound parameters** and
**100 KB statement** rules land on the same shape — a per-user bulk import — so it has to be
chunked, not built with placeholders. And **128 MB** is the wall a long-lived object hits
first: past it the isolate is reset, the caller gets `Durable Object's isolate exceeded its
memory limit and was reset`, and the error does not say what was holding the memory
([camelAI](https://camelai.com/blog/should-you-build-on-cloudflare)). The key/value and row
sizes moved from 2 MB to 8 MB and belong in the "size a blob here" band, not the "paste a
document here" band.

At 10 GB the object stops accepting writes with `SQLITE_FULL`; reads and deletes continue so
you can drain
([limits](https://developers.cloudflare.com/durable-objects/platform/limits/)). That is a
better failure mode than most databases manage, but the code has to catch it.

### Cost shape

SQLite objects bill on rows, not on reads: 25 billion row reads/month included then
$0.001/M, 50 million rows written/month then $1.00/M, 5 GB-month storage included then
$0.20/GB-month, with **deletes billed as rows written**, `setAlarm()` billed as one row
written, and every index update counted as an extra row written — so an index turns one
`INSERT` into six billed rows
([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).
The row meter counts *writes the object makes*, not user intent, so a chatty write pattern
on behalf of 81 users can run to 4 billion billed rows and a bill with a comma in it
([RetainDB post-mortem](https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/)).
Compute runs $0.15/M requests and $12.50/M GB-s with 128 MB charged whether or not used —
so a fleet of many mostly-idle objects is billed as many mostly-idle 128 MB processes unless
hibernation applies ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)).

The write-side rate is the one to model before committing to a per-user fan-out design: an
object that rewrites a small row on every page view turns page views into write cost.

## APAC: the placement you get is not the placement you expect

### Where Durable Objects actually live

The community tracker reports **10.76% of Cloudflare PoPs** hosting DOs, and computed
**606,273 objects created in the last hour** at the time of reading (2026-11-09)
([where.durableobjects.live](https://where.durableobjects.live/)). Pulling the v3 dataset
gives the actual host set — **30 distinct colos**, against 288 colos that reported:

| Region | Host colos | Count |
| --- | --- | --- |
| Americas | `ATL` `DEN` `DFW` `EWR` `IAD` `LAX` `MIA` `ORD` `SJC` | 9 |
| Europe / ME / Africa | `AMS` `ARN` `CDG` `FRA` `LHR` `LIS` `MAD` `MRS` `MXP` `OTP` `PRG` `VIE` `WAW` | 13 |
| APAC | `SIN` `HKG` `NRT` `KIX` `ICN` `SYD` `MEL` `BNE` | 8 |

Derived from
[v3 data](https://where.durableobjects.live/api/v3/data.json), read 2026-11-09. Note what is
missing from APAC: **no host in India, Indonesia, Malaysia, Thailand, Vietnam, the Philippines,
Taiwan, mainland China, or New Zealand.** `PER` and `AKL` are user-facing colos with no
local DO host.

### Measured RTT by APAC market

Nearest-region RTT and the host colo(s) actually chosen, from the same dataset. "Region" is
the nearest of `apac`, `apac-se`, `apac-ne`, `oc`.

| Colo | Market | Nearest region | Host(s) chosen (likelihood) | Nearest RTT |
| --- | --- | --- | --- | --- |
| `SIN` | Singapore | `apac` | `SIN` (1.00) | 29 ms |
| `KUL` | Kuala Lumpur | `apac` | `SIN` (1.00) | 36 ms |
| `CGK` | Jakarta | `apac` | `SIN` (1.00) | 29 ms |
| `CJB` | Coimbatore | `apac` | `SIN` (1.00) | 30 ms |
| `BKK` | Bangkok | `apac-se` | `SIN` (1.00) | 40 ms |
| `ICN` | Seoul | `apac-ne` | `ICN` (1.00) | 39 ms |
| `NRT` | Tokyo | `apac-ne` | `NRT` 0.43 / `KIX` 0.57 | 19 ms |
| `HKG` | Hong Kong | `apac` | `HKG` (1.00) | 52 ms |
| `TPE` | Taipei | `apac` | `NRT` 0.54 / `HKG` 0.31 / `KIX` 0.15 | 45 ms |
| `MNL` | Manila | `apac` | `SIN` 0.66 / `HKG` 0.34 | 56 ms |
| `MAA` | Chennai | `apac-se` | `SIN` (1.00) | 55 ms |
| `HYD` | Hyderabad | `apac-se` | `SIN` (1.00) | 53 ms |
| `DAC` | Dhaka | `apac-se` | `SIN` (1.00) | 53 ms |
| `BOM` | Mumbai | `apac` | `SIN` (1.00) | 60 ms |
| `DEL` | Delhi | `apac` | `SIN` 0.83 / `HKG` 0.17 | 80 ms |
| `HAN` | Hanoi | `apac` | `HKG` (1.00) | 73 ms |
| `SGN` | Ho Chi Minh City | `apac-se` | `SIN` (1.00) | 95 ms |
| `PNH` | Phnom Penh | `apac-se` | `SIN` 0.78 / `HKG` 0.22 | 69 ms |
| `BWN` | Bandar Seri Begawan | `apac` | `SIN` 0.50 / `HKG` 0.50 | 69 ms |
| `SYD` | Sydney | `oc` | `SYD` 0.38 / `MEL` 0.38 / `BNE` 0.25 | 22 ms |
| `MEL` | Melbourne | `oc` | `SYD` 0.67 / `MEL` 0.33 | 26 ms |
| `PER` | Perth | `oc` | `SYD` (1.00) | 49 ms |
| `AKL` | Auckland | `oc` | `SYD` 0.33 / `BNE` 0.33 / `MEL` 0.33 | 120 ms |
| `CHC` | Christchurch | `oc` | `SYD` (1.00) | 129 ms |
| `WLG` | Wellington | `oc` | `MEL` (1.00) | 172 ms |
| `KHI` | Karachi | `apac` | `SIN` 0.70 / `HKG` 0.30 | 127 ms |
| `LHE` | Lahore | `apac-se` | `HKG` 0.50 / `SIN` 0.50 | 144 ms |

Two things fall out. First, **Southeast Asia is the well-served corner** — Jakarta and
Coimbatore reach `SIN` in 29–30 ms, a normal regional cloud round trip, not an edge-computing
miracle. Second, **the long tail is bad and structural**: Wellington pays 172 ms to every DO
write and Christchurch 129 ms, and no hint improves either, because no host exists nearer than
Australia.

Three readings now exist for this table (2026-10-28, 2026-10-30, 2026-11-09), and the honest
use of them is to watch what *moves*. This pass, Ho Chi Minh City **doubled** (53 → 95 ms),
Karachi rose 87 → 127 ms, Manila rose 45 → 56 ms with the mix shifting back toward `HKG`,
and Hanoi's own nearest-region label flipped from `apac-se` to `apac` with `HKG` as its only
host. Christchurch improved 160 → 129 ms and now routes to `SYD` alone. The host set itself
did not change at all: still exactly **30 colos, 8 of them in APAC**. So treat the per-market
milliseconds as routing observations that drift by tens of percent between samples, and the
structural facts — which colos host, which markets have none — as the durable finding.

### The region-label trap

Because the object never relocates, the hint chosen at creation is the object's home for its
whole life, and the labels are coarser than the markets inside them. Cross-region RTT for the
same user colo:

| User colo | `apac` | `apac-se` | `apac-ne` | `oc` |
| --- | --- | --- | --- | --- |
| `SYD` (Sydney) | 558 ms | 858 ms | 312 ms | **28 ms** |
| `DEL` (Delhi) | **93 ms** | 106 ms | 488 ms | 819 ms |
| `CGK` (Jakarta) | **30 ms** | 37 ms | 263 ms | 689 ms |
| `NRT` (Tokyo) | **21 ms** | 208 ms | 21 ms | 362 ms |
| `WLG` (Wellington) | 547 ms | 687 ms | 517 ms | **172 ms** |

Derived from
[v3 data](https://where.durableobjects.live/api/v3/data.json), read 2026-11-09. A single wrong
hint is a 5–20× latency penalty that never gets fixed, because Cloudflare notes only that "dynamic relocation of existing Durable Objects is
planned for the future" ([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
The same page lists `sam`, `afr` and `me` as hints that **do not spawn objects at all** —
South American, African and Middle Eastern hints land in a nearby supported location instead,
with South America resolving to Eastern North America.

The documentation's own advice is to omit the hint and let placement follow the first `get()`
([changelog 2026-06-19](https://developers.cloudflare.com/changelog/post/2026-06-19-apac-ne-apac-se-location-hints/)).
That advice is right for a product with one audience and wrong for one with several, and it
produces the failure mode a Cloudflare-community regular describes: if an admin backend, a
cron job or a queue consumer instantiates objects on behalf of users, **every object lands near
the backend** — "say you're in Canada and your app hits it big in Myanmar ... their request is
traveling half way around the world" for the rest of that user's life
([r/CloudFlare](https://www.reddit.com/r/CloudFlare/comments/1qm9uxb/durableobjects_location_when_instantiated_via/)).

Jurisdictions do not help APAC either. They exist for `eu`, `us` and `fedramp` only
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
There is no APAC jurisdiction, so an India-DPDP, Indonesia-PDP or Japan-APPI data-residency
requirement cannot be expressed as a DO constraint — only as a best-effort location hint.

### The incident record

Durable Objects and their dependents have a documented failure history. It is a
published-incident floor, not a rate — the count tracks what Cloudflare filed, and the newest
entry names no root cause:

| Date | Incident | Duration / severity | Source |
| --- | --- | --- | --- |
| 2026-11-05 13:23 → 11-06 09:05 UTC | "Increased Errors for Durable Objects" **in Western Europe** — the first named DO incident since the September one, 19 h 41 m, unconfirmed resolution (monitoring then closed with no root cause published) | 19 h 41 m, minor | [pulsetic](https://pulsetic.com/status/cloudflare/incidents/157723/), [community](https://community.cloudflare.com/t/increased-errors-for-durable-objects-in-western-europe/977371), [status history](https://www.cloudflarestatus.com/history) |
| 2024-12-04 | Increased errors for R2 **and Durable Objects**, Asia-Pacific, Singapore region | resolved next day | [community](https://community.cloudflare.com/t/increased-errors-for-r2-and-durable-objects-in-the-asia-pacific-apac-region/744263) |
| 2025-07-29 | "Durable Objects availability degraded in Asia Pacific" | resolved next day | [community](https://community.cloudflare.com/t/durable-objects-availability-degraded-in-asia-pacific/821828) |
| 2026-08-14 | Durable Objects and Workflows availability drop, inside a 13-incident 8-day streak that also produced 5xx in **Bangkok and Jakarta** | — | [shattered.io](https://shattered.io/cloudflare-outage-august-2026/) |
| 2026-09-17 23:37 → 09-18 00:54 UTC | Increased errors for Durable Objects and downstream services, Asia Pacific | 1 h 16 m, minor | [pulsetic](https://pulsetic.com/status/cloudflare/incidents/138453/) |

Outside APAC, the pattern repeats at similar cadence: Durable Objects availability in Eastern
North America on 2026-10-05 for 5 h 21 m, then two more ENAM DO incidents on 2026-10-28 of
1 h 25 m and 3 h 11 m
([2026-10-05](https://pulsetic.com/status/cloudflare/incidents/144850/)). An independent review
site counts **115 status-page incidents in three years** published under or naming Durable
Objects, **9 major or critical**, median time open **1.6 h**, and cautions that the count tracks
what Cloudflare published rather than what broke
([Orange Cloud Report](https://orangecloud.report/products/durable-objects/)).

The regional skew matters more than the totals. 8 host colos across all of APAC means a single
host failure or a single network path problem concentrates across a much larger share of users
than the same event would in the 13-colo European set. The November incident is the boring
counter-example: it ran **19 h 41 m** in a top-coverage region and stayed "Minor", because
Europe has 13 hosts to absorb it and a per-region error elevation is rarely a full outage
there. APAC has the same failure modes over a third of the host count.

## What operators actually report

The recurring criticisms cluster into six claims, and the durability claim is not one of them.
How long each team had run on the platform is in the entry, because it decides how much weight
the claim carries.

**1. You cannot move the state.** The most-linked objection in the 2026 write-ups: "With a DO
you're at the mercy of the platform's placement and migration", and the team's unlock was
running the same stack in a customer's own cloud, which a DO structurally cannot do
([HN](https://news.ycombinator.com/item?id=48846757)). Wire, an agent-context product that
had run every container as a DO since its first day, made the same call on 2026-07-07 after
benchmarking a rebuilt data plane against the original on identical data, and lists it third
of four: "Location hints exist at creation, but an object never moves afterward, so a
container created from London serves an agent fleet in Virginia forever. And you cannot buy
dedicated capacity for one tenant". It wanted placement that follows the caller and isolation
as a paid tier, and opens by saying the exit is "because of four structural limits, not
reliability" — Wire keeps Workers for the API, frontends, control plane and processing, and
calls DOs "close to a perfect fit for thousands of small, mostly idle stateful units"
([Wire](https://usewire.io/engineering/why-were-moving-wire-off-cloudflare-durable-objects/)).
A commenter on the same thread puts the distinction more sharply: "The objects are durable,
but not endurable." Another: "Durability is not the problem, but because the state lives
somewhere you structurally can't relocate. That constraint never shows up in a benchmark, it shows up in an enterprise procurement
call."

Worth reading that thread for the pushback rather than the headline: the author concedes
Cloudflare is "the gold standard" on availability and that matching its durability is "the
hardest part of this", and multiple commenters call moving to Fly Machines "an instant nope"
on availability grounds. The thread is a portability argument, not a reliability one. The
capability behind both exits is the same: no way to put a DO on infrastructure you control.
That is closing from below — celld, a Deno project, runs Workers, Durable Objects, KV,
Queues, D1 and Workflows on machines you own, with cell state in your own S3 bucket and a
single winner per cell enforced by a conditional bucket write
([celld](https://celld.dev/), [repo](https://github.com/denoland/celld)) — but self-hosting a
managed primitive buys portability by taking on its operations, and it is not the service
Cloudflare runs.

**2. Blast radius of a single host.** "Each object lives on one machine at a time, so bad
hardware can take a whole set of objects offline. If they coordinate something important, that
layer is simply gone until placement recovers, and the customer has nothing useful to act on"
([Orange Cloud Report](https://orangecloud.report/products/durable-objects/)). The same review
names input/output gate deadlocks, uninspectable storage growth, and per-object throughput
ceilings that appear only in production. Its recommendation is blunt: treat DOs as "a
coordination cache you can afford to lose, never a system of record or a fleet's single point
of failure."

**3. Observability is thin where it matters.** "Observability that tells you too little about
an unhealthy object" is the phrasing; the concrete complaint is that a stuck or slow object is
hard to distinguish from a slow caller, and there is no supported way to enumerate live
instances ([same review](https://orangecloud.report/products/durable-objects/),
[r/CloudFlare on listing live objects](https://www.reddit.com/r/CloudFlare/comments/1kba43y/list_the_do_instances/)).

**4. Latency reports are usually not DO's fault — except when they are.** The loudest APAC
latency threads turn out to be ISP peering, not platform placement: a 500 ms-per-request
complaint resolved to an ISP path problem, and Argo at $5 setup plus $0.10/GB took it from
500 ms+ to 100–200 ms
([r/CloudFlare](https://www.reddit.com/r/CloudFlare/comments/1qk6z8q/anyone_hosted_saas_fully_on_cloudflare_mine_slow/)).
An Indian developer's 800–1000 ms D1 calls were traced to Indian ISPs routed to Europe on the
free plan, with the thread's local expert noting that "Asia Pacific is a pretty wide region
… with the instability of the Asia Pacific internet in general, latency could vary a lot"
([r/CloudFlare](https://www.reddit.com/r/CloudFlare/comments/1k3irnx/cloudflare_worker_d1_consistently_taking_800ms/)).
The same thread contains the APAC-specific line worth remembering: "Cloudflare talked about
supporting Durable Objects and thus D1 Databases directly in India eventually" — written two
years ago, and as of 2026-11-09 the placement dataset still shows every Indian colo served from
Singapore or Hong Kong.

**5. Objects are restarted out from under you, and memory is the wall.** Two mechanics make it
worse than it sounds. A deploy never waits for an object: `deferred` only buys time until the
object hibernates or `max_delay` is reached, in-flight HTTP/RPC requests that touch storage are
stopped immediately, and WebSocket connections are terminated so the new instance can take
over ([lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)).
The 128 MB isolate cap applies to whatever the object holds, so a long-lived one is reset
mid-work. camelAI measured what building around both costs on a coding agent: every turn had
to be resumable ("one production thread survived 15 restarts in a row and still finished
correctly"), one long chat crashed its object **about 2,500 times over two days** — load the
saved stream, exceed 128 MB, reset before cleanup runs — so the fix was buffer caps and a
circuit breaker after three consecutive crashes, and cold starts were logged **over 10
seconds** with "no stated baseline to design around"
([camelAI](https://camelai.com/blog/should-you-build-on-cloudflare)).

**6. The cost meters on writes, so a design mistake is unbounded.** RetainDB, a memory layer
with **81 users**, woke up to a **$35,000** monthly bill: 4.01 billion Durable Object storage
rows written ($3,962 of it) from a queue loop that re-enqueued every async write, with $15,635
of KV writes beside it. Not a platform defect — it is what a per-write meter does to a
re-enqueue bug — but nothing in the product bounds it for you
([post-mortem](https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/)).

Positive reports exist and are consistent about *why*: the zero-latency synchronous SQL removes
the N+1 problem at the root ("101 queries are function calls that complete in a few
milliseconds"), the object model collapses a Redis-plus-servers architecture into one primitive,
and the failure modes are design errors (god object, blocking external calls in the object)
rather than platform errors
([ainoya.dev](https://ainoya.dev/posts/durable-object/),
[lambrospetrou.com](https://www.lambrospetrou.com/articles/durable-objects-cloudflare/)).

## Does a Durable Object stay where it was created?

**Yes at the data-center level, no at the server level.** The two are different words and the
docs use both, which is where the confusion comes from.

| Level | Does it move? | Source |
| --- | --- | --- |
| **Data center / colo** | **No.** "Durable Objects do not currently change locations after they are created." | [data location](https://developers.cloudflare.com/durable-objects/reference/data-location/) |
| **Server within that colo** | **Yes.** "Durable Objects migrate among healthy servers." | [what are DOs](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/index.md) |
| **Host in the runtime's judgement** | **Yes.** "Workers runtime decisions on where to host objects" is a listed shutdown cause, and the runtime also decides when a hibernated object goes inactive "for example deciding to move the object to a different host". | [lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) |

So an object created in Singapore stays *in the Singapore colo region* for its whole life, but
the individual machine hosting it can change underneath you. Migration between servers is
invisible to your code — it is an implementation detail of the runtime, which is why you never
manage it. Migration between **colocations** is what does not happen, and that is the one that
decides your latency.

The following are all true of an object created in Singapore:

| Fact | Detail |
| --- | --- |
| Stays in `SIN` | Unless the *hint* resolves elsewhere — see below |
| All requests route to it | A Tokyo or Frankfurt client pays the round trip to `SIN`, every time |
| `locationHint` only on first `get()` | A later hint on an existing object is ignored silently |
| Region-label trap | `apac` and `apac-se` both resolve near `SIN`, but `oc` would not |

**The gotcha: "created in Singapore" is not something you can directly request.** There is no
`locationHint: "sin"`. Hints are coarse regions (`apac`, `apac-se`, `apac-ne`, `oc`, …), and
they resolve to a colo that minimises latency *from the hinted region*
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
You ask for `apac-se` and Singapore is the likely outcome; you cannot pin `SIN` itself. The
docs also call hints "a best effort and not a guarantee" — unlike jurisdictions, which *are*
enforced, a hint may land your object in a different colo that the platform judges closer to
the region you named.

### What is not documented

There is no published statement about what happens to an object's **placement** when its
home colo fails outright or is removed — the docs describe requests being "forwarded to the
data center where the Durable Object, or state, is located", but say nothing about that data
center becoming unavailable [unverified]. Note the distinction: the runtime moves an object
between **hosts** freely, and the lifecycle page lists exactly that as a shutdown reason, but
it moves it back into the same **colo**. The one explicit forward-looking line is the
footnote that **"dynamic relocation of existing Durable Objects is planned for the future"**
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)),
which implies the current behaviour is fixed placement and that relocation is not yet possible.
Treat a host failure as *temporary unavailability of that object* rather than *automatic
migration to another region*, and design a degraded path accordingly.

For the call shapes and the pick-a-region table, see
[Provide a locationHint for a Cloudflare Durable Object](../howto/cloudflare-durable-object-location-hint.md).

## Where SQLite specifically bites

**Index writes are billed as rows.** Every row update of an index counts as an additional row
written, as does every virtual-table write
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). A
table with five indexes turns one `INSERT` into six billed rows. At $1.00/M rows written past
the 50 M allowance this is cheap for a per-user object and expensive for a hot shared one.

**Extensions are a subset, and a missing one changes your architecture.** FTS5 (including
`fts5vocab`), JSON1 and the math functions are present; anything else needs a workaround
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).
No `ATTACH`, so cross-object joins are application-level. A vector index is the case that
matters now: SQLite has no vector extension in the DO build, so embeddings go to Vectorize,
which is a network hop on the hottest path and a second copy of state that can drift. That was
Wire's first listed reason for leaving, and it is not fixable in place
([Wire](https://usewire.io/engineering/why-were-moving-wire-off-cloudflare-durable-objects/)).

**Synchronous means synchronous.** The SQL API blocks, which is the entire point (no context
switch, no network) and also the entire hazard: a slow query blocks the object's event loop,
which is why the runtime leans on input and output gates for correctness
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).

**Recovery is operator-code, not a product feature.** 30 days of PITR is excellent and free,
whole-database per object, and reversible once armed — `onNextSessionRestoreBookmark()`
returns the pre-restore bookmark and the docs spell out that a second recovery to it undoes the
first. But nothing invokes it for you, it does not exist in local dev ("a durable log of data
changes is not stored locally"), and it does not cover >30 days, account loss, or namespace
deletion ([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[gist](https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8)). The realistic
gap is not durability, it is tooling: "theoretically recoverable" versus "an operator can
recover a user in five minutes" is a day of work that most teams skip, and PITR is invisible to
an operator who was not told it exists.

**Schema migrations need `transactionSync()`.** Wrapping a migration batch in
`transactionSync` makes it atomic — all migrations or none
([cris-o.com](https://www.cris-o.com/notes/sqlite-migrations-durable-objects/)), which matters
because a partially applied migration inside a 10 GB database has no other rollback path except
PITR.

## Where a Durable Object is *not* the right home

Everything above is about the storage. The failures that reach customers come from elsewhere,
so the design question is really "should this be an object at all". Two workloads answer no
loudly, and they are the two reasons the 2026 exits cite.

**A long-running unit of work.** The object model is per-request: single-threaded, 128 MB, and reset on deploys and runtime
decisions, so "the longer an agent runs, the more likely something restarts it partway
through" ([camelAI](https://camelai.com/blog/should-you-build-on-cloudflare)).
Past "minutes" you pay for restart survival — journalling, checkpointing, buffer caps, circuit
breakers — and that machinery writes rows, which is the next problem.

**A hot shared database.** A DO is one single-threaded process, so a table behind common
lookups takes a per-object ~1,000 rps ceiling. camelAI's inference project had a **5.6 MB** D1
database, 15,000 rows, a few hundred queries a minute; when D1 began rejecting even a plain
`SELECT 1` with `D1 DB is overloaded. Requests queued for too long.`, a Cloudflare engineer
explained it as the database landing beside a noisy neighbour, and named the fix as a change to
**DO storage's threading model** — the process this page is about. They moved to Postgres over
Hyperdrive and kept DOs for per-account usage and concurrency
([camelAI](https://camelai.com/blog/should-you-build-on-cloudflare)). The surviving shape is
the one in the [decision guide](#decision-guide): small, per-entity, coordination.

## Comparison

Stateful per-entity storage, the options a Cloudflare-shaped team actually weighs. Columns are
the candidates; rows are the dimensions that decide.

| Dimension | Durable Objects + SQLite | D1 | Turso Cloud (libSQL) | Fly Machines + SQLite |
| --- | --- | --- | --- | --- |
| Unit of state | One object = one actor + one 10 GB DB | One database, up to 10 GB | One database per DB/server | One machine, local file |
| Per-entity fan-out | Unlimited objects, no extra cost beyond usage | 50,000 DBs/account (paid) | Plan-dependent | One machine per tenant |
| Placement control | `locationHint` at first `get()`, best-effort, never changes | Region chosen at creation | Region per database | Region per machine, you pick |
| Write model | Serialized per object, synchronous inside the object | Single-threaded per DB, ~1,000 qps at 1 ms | MVCC on the Rust engine; libSQL differs | Real SQLite; your call |
| Durability story | 3-of-5 replica ack; WAL to object storage every 10 s/16 MB | Cloudflare-managed replication | Replication, no published SLA [unverified] | You own the disk |
| Point-in-time restore | 30 days, per object, API-only, reversible | 30 days (paid) / 7 days (free), 10 restores / 10 min | Plan-dependent [unverified] | Snapshots, your problem |
| Latency floor in APAC | 19–172 ms depending on market (see table) | Similar placement geography | Region-pinned, not edge | Region-pinned, not edge |
| Failure blast radius | One host takes a set of objects | One DB | One DB | One tenant each |
| Ops surface | Zero infra, but no instance enumeration | Zero infra | Managed, more knobs | You run the fleet |
| Restart / memory wall | Deploy or runtime kills the object; 128 MB reset | Not the failure mode | Your process | Your process |
| Portability off-platform | None on the platform; a data plane must be rebuilt (celld self-hosts the API, not your placement) | Export via `d1 export` | libSQL-compatible | Full control |
| Cited user verdict | Coordination cache, not system of record; two 2026 exits for placement and vector search, neither citing reliability | "Isn't ready" for anything with paying users, from an overload post-mortem | Preview engine, no SLA | Trusted less than CF for availability |

Sources: DO columns from the [limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
and [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) pages and the
[placement dataset](https://where.durableobjects.live/api/v3/data.json); D1 columns from the
[D1 limits page](https://developers.cloudflare.com/d1/platform/limits/) and the
[r/CloudFlare thread](https://www.reddit.com/r/CloudFlare/comments/1k3irnx/cloudflare_worker_d1_consistently_taking_800ms/);
Turso columns from [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md);
Fly columns from the [HN thread](https://news.ycombinator.com/item?id=48846757) where a team
describes migrating and commenters push back on the availability trade; the restart/memory row
from the [lifecycle page](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
and the [camelAI post](https://camelai.com/blog/should-you-build-on-cloudflare); cited
verdicts from [Wire](https://usewire.io/engineering/why-were-moving-wire-off-cloudflare-durable-objects/),
[camelAI](https://camelai.com/blog/should-you-build-on-cloudflare) and the
[Orange Cloud Report](https://orangecloud.report/products/durable-objects/).

The D1 column deserves a caveat: D1 and DO are not competitors so much as different shapes of
the same trade. D1 is a single-threaded database with 50,000 databases per account; a
SQLite-backed DO is a single-threaded database *plus* the compute that owns it, priced the same
per row. If the workload is "query a per-user database and return rows", D1 is simpler. If it
is "serialize operations on an entity", DO is the only one of the two that gives you the mutual
exclusion.

## Decision guide

**DO + SQLite holds up in production when:**

- Objects are small and numerous, and the coordination unit is genuinely per-entity: a room, a
  session, a document, a tenant, an agent conversation.
- The APAC audience sits in or near Singapore, Hong Kong, Tokyo, Osaka, Seoul, Sydney,
  Melbourne or Brisbane — i.e. within ~60 ms of a host colo. Ho Chi Minh City now measures
  95 ms against `SIN`; treat 60 ms as the line and re-measure before trusting a market near it.
- The object is derived or recoverable state that a slower path can rebuild, or it is the
  system of record *and* you have built the restore tooling on top of PITR.
- You can put an explicit hint at creation time and route creation from the user's own request
  rather than from a backend, cron or queue.
- The read path can tolerate a round trip to a host metro, with KV or Cache in front of reads
  that must be edge-local.

**It does not hold up when:**

- The data is the business's only copy, nobody has written the restore path, and the write
  volume is high enough that the row meter is itself the risk.
- The unit of work runs for minutes to hours. Every deploy and every runtime decision restarts
  it, and 128 MB is the ceiling, so the durability you have to build is turn-level resumability.
- A single shared table is the hot path. One object is a ~1,000 rps single thread; fan it out
  or put a real database behind it.
- Retrieval is vector search. There is no vector extension, so the index lives in a separate
  service, on the hot path, as a second copy of state.
- The APAC audience is in India, Indonesia (outside Jakarta), Vietnam, the Philippines, New
  Zealand outside Auckland, or Pakistan, and the interaction is latency-critical.
- A regulator wants data to stay in an APAC country. Jurisdictions are `eu`/ `us`/ `fedramp`
  only.
- You need to move state between providers, or run in a customer's cloud.
- You need more than ~1,000 rps on a single logical entity and cannot shard it into a fan-in
  tree.
- You need enumerable instances for operations work, or sub-second diagnosis of a stuck object.
- You need a **contractual** uptime number. DO has no product-specific SLA, so the guarantee has
  to come from your own redundancy, not from the platform.

## Open Questions

- **India.** Cloudflare has said DOs in India are planned; the placement dataset still shows
  every Indian colo served from `SIN` or `HKG` as of 2026-11-09. No announced date.
- **Dynamic relocation.** "Planned for the future" since at least the 2026-06 docs revision. If
  it ships, the worst APAC failure mode (wrong hint at creation, permanent) goes away.
- **The 10 GB ceiling per object.** `SQLITE_FULL` with reads and deletes still working is a
  graceful floor, but there is no documented path to grow past it, and no cross-object join to
  shard around it.
- **Observability.** Whether the DO metrics surface distinguishes a slow object from a slow
  caller well enough for APAC operators to page on. Not verified in this pass.
- **The incident rate.** Five named DO incidents across 2024–2026 is a floor (published
  incidents only), not a rate, and none published a root cause. A real comparison needs
  per-region uptime probes; nobody appears to publish any for DOs.
- **The November Western Europe incident.** 19 h 41 m of elevated errors, no cause stated, no
  follow-up posted. Whether the DO storage threading change camelAI says Cloudflare promised has
  landed, and whether it changes this failure class, is not trackable from public docs.
- **Memory.** 128 MB per isolate, capped and billed as full, is the limit operators hit most
  often and the most common ask in the agents post. A raised cap would retire part of the "not
  for long work" verdict.

## Related

- [Architectural Decisions for a Pusher-Compatible Server on Cloudflare Durable Objects](./pusher-server-durable-objects-architecture.md)
  — how the same limits (hibernation, attachment size, connection budget) shape a real DO
  design, decision by decision.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md)
  — a DO-backed agent harness that leans on SQLite storage and alarms; shows the 128 MB and
  alarm wall-time limits from the inside.
- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md) and
  [Turso Data Loss & Data Exposure Incidents](./turso-data-loss-incidents.md) — the closest
  alternative for per-entity SQLite, assessed on the same axes and harder on the SLA question.
- [Bun's AOT Compiler — `bun build --compile`](./bun-aot-compiler.md) — unrelated to DOs, but
  the same reviewer habit: separate what the platform promises from what users report.

## Changelog

- 2026-11-09 — **third pass, re-gathered through TinyFish,** which resolved this session and
  retires the curl fallback recorded on 2026-10-30. Every primary page was re-read; all the ones
  carrying a "Last updated" stamp had moved. **Corrections:** key/value and row sizes are **8 MB**
  (not 2 MB), "`1 GB on Free` per object" was wrong (the 5 GB free cap is per account), and a
  100 KB statement cap and the 32 MiB WebSocket message limit (1 MiB until 2025-10-25) were
  missing from the table. The placement dataset drifted and both RTT tables were recomputed from
  a fresh read — Ho Chi Minh City doubled to 95 ms, Wellington 172 ms, Sydney's `apac` penalty
  558 ms — with the drift named rather than smoothed; the structural facts held at 30 host colos
  / 8 in APAC / 10.76%. **New:** the 2026-11-05 Western Europe DO incident (19 h 41 m, minor, no
  root cause), and the incident heading lost "APAC" because the newest entry is not APAC. The
  `[unverified]` hedge on the SLA is replaced with the actual text: the Business SLA is written
  over "the Service", names no Cloudflare product, and defers Enterprise terms to a negotiated
  agreement. Two 2026 migration write-ups (Wire, camelAI) were added — both say the exit is not
  about reliability — with the restart and memory mechanics as operators actually hit them (2,500
  resets on one chat, 15 restart-surviving turns, >10 s cold starts), the RetainDB $35k bill, and
  celld as the self-host answer to the portability objection. Added a section on where a DO is
  the wrong home, a restart/memory row in the comparison, and corrected the "KV is closed to new
  namespaces" overreach — `exports` can still declare a KV-backed class; the provisioned
  namespace decides. `confidence` stays `medium` for the same reasons as before.
- 2026-10-30 — added **Does a Durable Object stay where it was created?** after a follow-up
  question about an object created in Singapore. Resolved the apparent contradiction between
  "do not currently change locations" (data-location page) and "migrate among healthy servers"
  (what-are-DOs page): the object is pinned to a **colo**, not to a **machine**. Recorded that
  `SIN` cannot be requested directly (hints are regions, best-effort), and that placement under
  colo failure is **undocumented**, with the "dynamic relocation ... planned for the future"
  footnote as the only signal. Flagged that as `[unverified]`.
- 2026-10-30 — **re-verified and extended.** Re-read the live placement dataset and the
  primary Cloudflare docs. Structural findings unchanged (30 host colos, 8 in APAC, 10.65%
  coverage, 10 GB per object, `SQLITE_FULL` leaves reads and deletes working). Corrected the
  drifted per-market RTT and region-label tables and explained the drift rather than silently
  overwriting it — router observations move between samples; the structural facts do not. Added
  **"Safe" is three different questions**, which separates durability, availability and
  contractual guarantee and records that DO has no product-specific uptime SLA; added **Naming:
  four products, one phrase**, covering D1, **Basin SQL** (GA, formerly R2 SQL, Iceberg
  analytics) and **K2** (public beta durable log), none of which is DO + SQLite.
  **Fallback declared, per §2 rule 6:** TinyFish was configured for this session
  (`.pi/agent/mcp.json`, `exposure: hidden`, tools routed to codemode) but its tools never
  resolved — `tools.mcp__tinyfish__search` and `searchTools("tinyfish search")` both failed to
  find them after a direct probe. Search and fetch therefore went through `curl` against the
  primary sources already cited in this file plus Cloudflare's own markdown doc endpoints
  (`/llms.txt`, `Accept: text/markdown`). Every re-verified fact above comes from Cloudflare's
  documentation or the placement dataset, both first-party, so `confidence` stays `medium`
  rather than dropping to `low`; the SLA claim is explicitly marked `[unverified]` because the
  SLA page is JavaScript-rendered and could not be read in full. Re-verify through TinyFish
  when it is available again.
- 2026-10-28 — created. Researched via TinyFish (`mcp__tinyfish__search` /
  `mcp__tinyfish__fetch_content`) across Cloudflare's DO limits, data-location, pricing,
  SQLite storage API and Rules pages, the SQLite GA and APAC-hint changelogs, the D1 limits
  page, Varda's SQLite design post as summarised by Willison, the `where.durableobjects.live`
  v3 dataset (from which the APAC RTT and cross-region tables were computed, not copied), the
  HN "moving off Durable Objects" thread, the Orange Cloud Report review, four APAC/ENAM
  status incidents, and four operator write-ups from Reddit, a gist, and personal blogs.
  Confidence is `medium`: the placement numbers are measured and the limits are official, but
  the incident counts are published-incident floors rather than uptime measurements, and none
  of the APAC latency numbers are from a load test of a single object.
