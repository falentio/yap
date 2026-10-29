---
title: Cloudflare Durable Objects and SQLite in Production — Reliability Review, With an APAC Focus
category: technology
tags: [cloudflare, durable-objects, sqlite, serverless, stateful, actors, apac, latency, reliability, incident-review]
status: complete
created: 2026-10-28
updated: 2026-10-28
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
confidence: medium
---

# Cloudflare Durable Objects and SQLite in Production — Reliability Review, With an APAC Focus

## TL;DR

- **The durability is not the weak point.** A SQLite-backed Durable Object (the feature the
  question calls "durable SQLite") streams its WAL to object storage every 10 s or 16 MB, and
  acknowledges a write only after three of five replicas in separate nearby data centers
  confirm it ([Willison on Varda's post](https://simonwillison.net/2024/Oct/13/zero-latency-sqlite-storage-in-every-durable-object/),
  [HN](https://news.ycombinator.com/item?id=32996261)). The complaint that recurs among
  operators is the opposite of "it loses data": **you cannot move the state**, and a bad host
  or a bad placement takes the object away from you on Cloudflare's schedule, not yours
  ([HN: Why we're moving off Durable Objects](https://news.ycombinator.com/item?id=48846757),
  [Orange Cloud Report](https://orangecloud.report/products/durable-objects/)).
- **For APAC the binding constraint is placement, not the platform.** Durable Objects run in a
  small subset of Cloudflare's network — the community tracker measures **10.76% of PoPs** and
  I count **30 host colos worldwide, 8 of them in APAC**: `SIN`, `HKG`, `NRT`, `KIX`,
  `ICN`, `SYD`, `MEL`, `BNE`
  ([where.durableobjects.live](https://where.durableobjects.live/),
  [v3 dataset](https://where.durableobjects.live/api/v3/data.json)). India, Indonesia,
  Malaysia, Thailand, Vietnam, the Philippines, Taiwan and New Zealand have **no local DO
  host**; their traffic is served from Singapore, Hong Kong, Japan or Australia. Measured
  nearest-region RTT ranges from ~23 ms (Singapore) to **172 ms (Wellington)**.
- **Region hints are a footgun in APAC.** A DO does not change location after creation
  ([data location docs](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
  Picking `apac` for a Sydney audience costs ~558 ms instead of ~28 ms under `oc`; picking
  `apac-ne` for an Indian audience costs ~488 ms instead of ~93 ms under `apac`. The hints
  are best-effort, not guarantees
  ([changelog 2026-06-19](https://developers.cloudflare.com/changelog/post/2026-06-19-apac-ne-apac-se-location-hints/)).
- **APAC has a documented DO incident history.** Public status records name APAC-specific
  Durable Object degradation on 2024-12-04 (R2 + DO, Singapore), 2025-07-29 (availability
  degraded in Asia Pacific), and 2026-09-17 (DO + downstream, 1 h 16 m), plus the August 2026
  incident streak
  ([2024-12-04](https://community.cloudflare.com/t/increased-errors-for-r2-and-durable-objects-in-the-asia-pacific-apac-region/744263),
  [2025-07-29](https://community.cloudflare.com/t/durable-objects-availability-degraded-in-asia-pacific/821828),
  [2026-09-17](https://pulsetic.com/status/cloudflare/incidents/138453/),
  [Aug 2026](https://shattered.io/cloudflare-outage-august-2026/)).
- **Verdict.** DO + SQLite is production-ready as a **coordination and per-entity state
  layer** — rooms, sessions, counters, per-user databases, agent state. It is not ready to be
  the **only** copy of a business's data, and in APAC it is not ready to be a latency-critical
  hot path for users outside the eight host metros without deliberate hinting and a fallback.

## Context

A team building an APAC-facing product asks whether Cloudflare Durable Objects, and the
SQLite storage attached to them, hold up in production. Two things make the question
answerable rather than vibes-based: Cloudflare publishes hard limits and placement rules, and
a community site publishes what placement actually resolves to per colo with measured RTTs.
Public incident history and operator write-ups fill in the rest.

Terminology, because the question mixes two names. There is no Cloudflare product called
"Durable SQLite". There are **SQLite-backed Durable Objects**: Durable Objects whose storage
backend is SQLite instead of the deprecated key-value backend. They went GA on 2025-04-07 with
a 10 GB database per object, and they are the only backend available to new namespaces —
Workers Free can create nothing else, and the KV backend is closed to new namespaces on paid
plans too ([GA changelog](https://developers.cloudflare.com/changelog/post/2025-04-07-sqlite-in-durable-objects-ga/),
[pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). So the
practical question is not "SQLite or KV" but "is this object model sound for my workload".

## What the platform actually promises

### Durability

Write path, from Varda's design post as summarised by Willison: the WAL streams to object
storage in batches capped at **16 MB or 10 seconds**, and to cover the gap inside that window
a committed write is forwarded to **five replicas in separate nearby data centers** and
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
The API is code-only: `getCurrentBookmark()`, `getBookmarkForTime(ts)`,
`onNextSessionRestoreBookmark(bookmark)` (which returns the pre-restore bookmark, so a bad
restore is itself reversible) and `ctx.abort()` to apply it. There is no dashboard button and
no restore in local dev ([same gist](https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8)).

### Limits that bound the design

| Dimension | Limit | Source |
| --- | --- | --- |
| Storage per object | 10 GB (1 GB on Free) | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Requests per object | Soft **1,000 rps**; overload returns an error after queueing | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Simple-op throughput, in practice | ~500–1,000 rps, work-dependent | [Rules of DOs](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) |
| Memory | 128 MB per isolate, shared by co-located objects, billed as full | [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| CPU per invocation | 30 s default, 5 min via `limits.cpu_ms` | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Wall time | Unlimited for DO RPC/HTTP; **15 min for alarms** | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Key + value | 2 MB combined | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| SQL row / string / BLOB | 2 MB | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Columns per table | 100 | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Bound parameters per query | 100 | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| `LIKE`/`GLOB` pattern | **50 bytes** | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Outgoing connections | 6 simultaneous per request | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |

Two of these bite more than their line suggests. The **50-byte LIKE pattern** rules out
user-supplied search prefixes beyond a few characters. The **100 bound parameters** rules out
large multi-row inserts built with placeholders, which is exactly the shape a per-user import
wants. Neither is documented prominently outside the limits table.

At 10 GB the object stops accepting writes with `SQLITE_FULL`; reads and deletes continue so
you can drain
([limits](https://developers.cloudflare.com/durable-objects/platform/limits/)). That is a
better failure mode than most databases manage, but the code has to catch it.

### Cost shape

SQLite objects bill on rows, not on reads: 25 billion row reads/month included then
$0.001/M, 50 million rows written/month then $1.00/M, 5 GB-month storage included then
$0.20/GB-month, with **deletes billed as rows written**, `setAlarm()` billed as one row
written, and every index update counted as an extra row written
([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).
Compute runs $0.15/M requests and $12.50/M GB-s with 128 MB charged whether or not used —
so a fleet of many mostly-idle objects is billed as many mostly-idle 128 MB processes unless
hibernation applies ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)).

The write-side rate is the one to model before committing to a per-user fan-out design: an
object that rewrites a small row on every page view turns page views into write cost.

## APAC: the placement you get is not the placement you expect

### Where Durable Objects actually live

The community tracker reports **10.76% of Cloudflare PoPs** hosting DOs, and computed
**606,273 objects created in the last hour** at the time of reading
([where.durableobjects.live](https://where.durableobjects.live/)). Pulling the v3 dataset
gives the actual host set — **30 distinct colos**, against 288 colos that reported:

| Region | Host colos | Count |
| --- | --- | --- |
| Americas | `ATL` `DEN` `DFW` `EWR` `IAD` `LAX` `MIA` `ORD` `SJC` | 9 |
| Europe / ME / Africa | `AMS` `ARN` `CDG` `FRA` `LHR` `LIS` `MAD` `MRS` `MXP` `OTP` `PRG` `VIE` `WAW` | 13 |
| APAC | `SIN` `HKG` `NRT` `KIX` `ICN` `SYD` `MEL` `BNE` | 8 |

Derived from
[v3 data](https://where.durableobjects.live/api/v3/data.json), read 2026-10-28. Note what is
missing from APAC: **no host in India, Indonesia, Malaysia, Thailand, Vietnam, the Philippines,
Taiwan, mainland China, or New Zealand.** `PER` and `AKL` are user-facing colos with no
local DO host.

### Measured RTT by APAC market

Nearest-region RTT and the host colo(s) actually chosen, from the same dataset. "Region" is
the nearest of `apac`, `apac-se`, `apac-ne`, `oc`.

| User colo | Market | Nearest region | Serving DO colo(s) | RTT |
| --- | --- | --- | --- | --- |
| `SIN` | Singapore | `apac` | `SIN` | 23 ms |
| `KUL` | Kuala Lumpur | `apac` | `SIN` | 30 ms |
| `CGK` | Jakarta | `apac` | `SIN` | 30 ms |
| `BKK` | Bangkok | `apac-se` | `SIN` | 37 ms |
| `CMB` | Colombo | `apac-se` | `SIN` | 28 ms |
| `ICN` | Seoul | `apac-ne` | `ICN` | 38 ms |
| `NRT` | Tokyo | `apac-ne` | `NRT` 19 / `KIX` 28 | 21 ms |
| `HKG` | Hong Kong | `apac` | `HKG` | 52 ms |
| `TPE` | Taipei | `apac` | `NRT` 46 / `KIX` 45 / `HKG` 73 | 56 ms |
| `BOM` | Mumbai | `apac` | `SIN` | 54 ms |
| `MNL` | Manila | `apac` | `HKG` 56 / `SIN` 71 | 58 ms |
| `MAA` | Chennai | `apac-se` | `SIN` | 48 ms |
| `HAN` | Hanoi | `apac` | `HKG` | 71 ms |
| `CCU` | Kolkata | `apac-se` | `SIN` | 71 ms |
| `DEL` | Delhi | `apac` | `SIN` 80 / `HKG` 138 | 93 ms |
| `SGN` | Ho Chi Minh City | `apac-se` | `SIN` | 86 ms |
| `SYD` | Sydney | `oc` | `SYD` 22 / `BNE` 31 / `MEL` 34 | 28 ms |
| `MEL` | Melbourne | `oc` | `MEL` 26 / `SYD` 28 | 26 ms |
| `PER` | Perth | `oc` | `SYD` | 47 ms |
| `AKL` | Auckland | `oc` | `SYD` 120 / `BNE` 161 / `MEL` 168 | 145 ms |
| `CHC` | Christchurch | `oc` | `SYD` | 130 ms |
| `WLG` | Wellington | `oc` | `MEL` | **172 ms** |
| `KHI` | Karachi | `apac` | `HKG` 127 / `SIN` 179 | 153 ms |
| `LHE` | Lahore | `apac-se` | `HKG` 144 / `SIN` 252 | 200 ms |

Two things fall out. First, **Southeast Asia is genuinely well served** — a Jakarta or Kuala
Lumpur user reaches Singapore in 30 ms, which is a normal regional cloud round trip, not an
edge-computing miracle. Second, **the long tail is bad and structural**: a Wellington user pays
172 ms to every DO write, a Lahore user 200 ms, and neither has any hint that improves it,
because no host exists nearer.

### The region-label trap

Because the object never relocates, the hint chosen at creation is the object's home for its
whole life, and the labels are coarser than the markets inside them. Cross-region RTT for the
same user colo:

| User colo | `apac` | `apac-se` | `apac-ne` | `oc` |
| --- | --- | --- | --- | --- |
| `SYD` (Sydney) | 558 ms | 858 ms | 312 ms | **28 ms** |
| `DEL` (Delhi) | **93 ms** | 106 ms | 488 ms | 819 ms |
| `CGK` (Jakarta) | **30 ms** | 37 ms | 263 ms | 689 ms |
| `NRT` (Tokyo) | 21 ms | 237 ms | **18 ms** | 369 ms |
| `WLG` (Wellington) | 547 ms | 687 ms | 517 ms | **172 ms** |

Derived from
[v3 data](https://where.durableobjects.live/api/v3/data.json). A single wrong hint is a 3–20×
latency penalty that never gets fixed, because Cloudflare notes only that "dynamic relocation
of existing Durable Objects is planned for the future"
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
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

### The APAC incident record

Durable Objects and their dependents have a documented APAC failure history:

| Date | Incident | Duration / severity | Source |
| --- | --- | --- | --- |
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
than the same event would in the 13-colo European set.

## What operators actually report

The recurring criticisms cluster into four claims, and the durability claim is not one of them.

**1. You cannot move the state.** The most-linked objection in the 2026 write-ups, in the
words of the team leaving DOs: "With a DO you're at the mercy of the platform's placement and
migration" — and their stated unlock was running the same stack in a customer's own cloud,
which a DO structurally cannot do
([HN](https://news.ycombinator.com/item?id=48846757)). A commenter on the same thread puts the
distinction more sharply: "The objects are durable, but not endurable." Another: "Durability is
not the problem, but because the state lives somewhere you structurally can't relocate. That
constraint never shows up in a benchmark, it shows up in an enterprise procurement call."

Worth reading that thread for the pushback rather than the headline: the author concedes
Cloudflare is "the gold standard" on availability and that matching its durability is "the
hardest part of this", and multiple commenters call moving to Fly Machines "an instant nope"
on availability grounds. The thread is a portability argument, not a reliability one.

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
An Indian developer's 800–1000 ms D1 calls were traced to Indian ISPs being routed to Europe on
the free plan, with the thread's local expert noting that "Asia Pacific is a pretty wide region
… with the instability of the Asia Pacific internet in general, latency could vary a lot"
([r/CloudFlare](https://www.reddit.com/r/CloudFlare/comments/1k3irnx/cloudflare_worker_d1_consistently_taking_800ms/)).
The same thread contains the APAC-specific line worth remembering: "Cloudflare talked about
supporting Durable Objects and thus D1 Databases directly in India eventually" — written two
years ago, and as of 2026-10-28 the placement dataset still shows every Indian colo served from
Singapore.

Positive reports exist and are consistent about *why*: the zero-latency synchronous SQL removes
the N+1 problem at the root ("101 queries are function calls that complete in a few
milliseconds"), the object model collapses a Redis-plus-servers architecture into one primitive,
and the failure modes are design errors (god object, blocking external calls in the object)
rather than platform errors
([ainoya.dev](https://ainoya.dev/posts/durable-object/),
[lambrospetrou.com](https://www.lambrospetrou.com/articles/durable-objects-cloudflare/)).

## Where SQLite specifically bites

**Index writes are billed as rows.** Every row update of an index counts as an additional row
written, as does every virtual-table write
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). A
table with five indexes turns one `INSERT` into six billed rows. At $1.00/M rows written past
the 50 M allowance this is cheap for a per-user object and expensive for a hot shared one.

**Extensions are a subset.** FTS5 (including `fts5vocab`), JSON1 and the math functions are
present; anything else needs a workaround
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).
No `ATTACH`, so cross-object joins are application-level.

**Synchronous means synchronous.** The SQL API blocks, which is the entire point (no context
switch, no network) and also the entire hazard: a slow query blocks the object's event loop,
which is why the runtime leans on input and output gates for correctness
([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)).

**Recovery is operator-code, not a product feature.** 30 days of PITR is excellent and free,
whole-database per object, and reversible once armed — but nothing invokes it for you, it does
not exist in local dev, and it does not cover >30 days, account loss, or namespace deletion
([gist](https://gist.github.com/cameronapak/23b75b34e78c88ea1b41fc9a80c8eac8)). The realistic
gap is not durability, it is tooling: "theoretically recoverable" versus "an operator can
recover a user in five minutes" is a day of work that most teams skip.

**Schema migrations need `transactionSync()`.** Wrapping a migration batch in
`transactionSync` makes it atomic — all migrations or none
([cris-o.com](https://www.cris-o.com/notes/sqlite-migrations-durable-objects/)), which matters
because a partially applied migration inside a 10 GB database has no other rollback path except
PITR.

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
| Latency floor in APAC | 23–172 ms depending on market (see table) | Similar placement geography | Region-pinned, not edge | Region-pinned, not edge |
| Failure blast radius | One host takes a set of objects | One DB | One DB | One tenant each |
| Ops surface | Zero infra, but no instance enumeration | Zero infra | Managed, more knobs | You run the fleet |
| Portability off-platform | None; state can't be relocated | Export via `d1 export` | libSQL-compatible | Full control |
| Cited user verdict | Coordination cache, not system of record | "Isn't ready" for latency-critical (2024 view) | Preview engine, no SLA | Trusted less than CF for availability |

Sources: DO columns from the [limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
and [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) pages and the
[placement dataset](https://where.durableobjects.live/api/v3/data.json); D1 columns from the
[D1 limits page](https://developers.cloudflare.com/d1/platform/limits/) and the
[r/CloudFlare thread](https://www.reddit.com/r/CloudFlare/comments/1k3irnx/cloudflare_worker_d1_consistently_taking_800ms/);
Turso columns from [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md);
Fly columns from the [HN thread](https://news.ycombinator.com/item?id=48846757) where a team
describes migrating and commenters push back on the availability trade.

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
  Melbourne or Brisbane — i.e. within ~60 ms of a host colo.
- The object is derived or recoverable state that a slower path can rebuild, or it is the
  system of record *and* you have built the restore tooling on top of PITR.
- You can put an explicit hint at creation time and route creation from the user's own request
  rather than from a backend, cron or queue.
- The read path can tolerate a round trip to a host metro, with KV or Cache in front of reads
  that must be edge-local.

**It does not hold up when:**

- The data is the business's only copy and nobody has written the restore path.
- The APAC audience is in India, Indonesia (outside Jakarta), Vietnam, the Philippines, New
  Zealand outside Auckland, or Pakistan, and the interaction is latency-critical.
- A regulator wants data to stay in an APAC country. Jurisdictions are `eu`/ `us`/ `fedramp`
  only.
- You need to move state between providers, or run in a customer's cloud.
- You need more than ~1,000 rps on a single logical entity and cannot shard it into a fan-in
  tree.
- You need enumerable instances for operations work, or sub-second diagnosis of a stuck object.

## Open Questions

- **India.** Cloudflare has said DOs in India are planned; the placement dataset still shows
  every Indian colo served from Singapore as of 2026-10-28. No announced date.
- **Dynamic relocation.** "Planned for the future" since at least the 2026-06 docs revision. If
  it ships, the worst APAC failure mode (wrong hint at creation, permanent) goes away.
- **The 10 GB ceiling per object.** `SQLITE_FULL` with reads and deletes still working is a
  graceful floor, but there is no documented path to grow past it, and no cross-object join to
  shard around it.
- **Observability.** Whether the DO metrics surface distinguishes a slow object from a slow
  caller well enough for APAC operators to page on. Not verified in this pass.
- **The APAC incident rate.** Four named APAC DO incidents across 2024–2026 is a floor
  (published incidents only), not a rate. A real comparison would need per-region uptime
  probes, which nobody appears to publish for DOs.

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
