---
title: Upstash Box vs Cloudflare Sandboxes — Price Comparison
category: product
tags: [ai-agents, sandbox, containers, serverless, upstash, cloudflare, pricing]
status: complete
created: 2026-10-15
updated: 2026-10-15
sources:
  - https://upstash.com/pricing/box
  - https://upstash.com/pricing/box.md
  - https://upstash.com/blog/upstash-box
  - https://developers.cloudflare.com/sandbox/sdk/platform/pricing/
  - https://developers.cloudflare.com/containers/platform/pricing/
  - https://developers.cloudflare.com/containers/platform/limits/
  - https://developers.cloudflare.com/containers/concepts/architecture/
  - https://developers.cloudflare.com/containers/faq/
  - https://developers.cloudflare.com/workers/platform/pricing/
  - https://developers.cloudflare.com/durable-objects/platform/pricing/
  - https://developers.cloudflare.com/workers/observability/logs/workers-logs/
  - https://www.cloudflare.com/products/sandboxes/
confidence: high
---

# Upstash Box vs Cloudflare Sandboxes — Price Comparison

Two agent-sandbox products with **different billing axes**:

- **Upstash Box**: active **CPU core-hours** only. Memory is free. Fixed
  2/4/8 vCPU box shapes, auto-freeze when idle.
- **Cloudflare Sandboxes**: **vCPU-seconds** (active) + **GiB-seconds of
  provisioned memory** + GB-seconds of disk, on the Containers platform, on a
  $5 Workers Paid floor.

The single most useful fact from this comparison: **Cloudflare CPU is cheaper
per core-hour than Upstash CPU, and Cloudflare memory is the expensive part.**
Every "which is cheaper" answer follows from that split.

## The wide table

| Dimension | Upstash Box | Cloudflare Sandboxes |
|---|---|---|
| **Billing unit** | Active CPU core-hour | vCPU-second + GiB-second + GB-second |
| **CPU rate** | $0.10 to $0.40/active CPU hour, i.e. **$0.050/core-hour flat** | $0.000020/vCPU-second = **$0.072/vCPU-hour** |
| **Memory rate** | **$0** | $0.0000025/GiB-second = $0.009/GiB-hour |
| **Disk rate** | $0.10/GB-month | $0.00000007/GB-second = $0.00025/GB-hour |
| **Fixed monthly floor** | $0 | $5 Workers Paid |
| **Free allowance** | 5 CPU hours/mo, 10 concurrent boxes | 375 vCPU-min, 25 GiB-hrs, 200 GB-hrs/mo, inside $5 |
| **Metering granularity** | active CPU only | every 10 ms while running |
| **Machine shapes** | 3 fixed: 2/4/8 vCPU, 3:2 vCPU:GB | 6 presets + custom (1-4 vCPU, max 12 GiB, min 3 GiB/vCPU) |
| **Idle behaviour** | Auto-freeze, $0, storage kept | `sleepAfter` default 10 min, billing stops |
| **Disk across sleep** | Preserved | Ephemeral, fresh disk from image |
| **Always-on option** | Fixed: $8 / $16 / $32 per box-month | None; pay the running meter |
| **Region** | AWS us-east-1 only | Global, nearest free instance |
| **Custom images** | Coming soon | BYO Docker image today |
| **Built-in LLM budget** | $1/mo Free, $100/mo paid, BYOK | None |
| **Concurrency cap** | 1,000 boxes (soft, on request) | 1,500 vCPU / 6 TiB RAM / 30 TB disk per account |

Sources: [Upstash Box pricing](https://upstash.com/pricing/box),
[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/),
[Containers limits](https://developers.cloudflare.com/containers/platform/limits/).

## Verified arithmetic

Every rate below was read from the vendor page on 2026-10-15 and re-derived.

| Quantity | Derivation | Result |
|---|---|---|
| Cloudflare CPU | $0.000020/vCPU-sec x 3600 | **$0.072/vCPU-hour** |
| Cloudflare memory | $0.0000025/GiB-sec x 3600 | **$0.009/GiB-hour** |
| Cloudflare disk | $0.00000007/GB-sec x 3600 | **$0.00025/GB-hour** |
| Upstash per core | $0.10 / 2 vCPU | **$0.050/core-hour** |
| Upstash Medium | $0.20 / 4 vCPU | $0.050/core-hour |
| Upstash Large | $0.40 / 8 vCPU | $0.050/core-hour |

The Upstash rate is **linear in cores**: all three sizes are exactly
$0.050/core-hour. The size tiers buy disk and a keep-alive price, not a CPU
discount.

## Cloudflare per-shape cost (730 running hours per month)

| Shape | vCPU | RAM | Disk | Memory only, per hr | CPU @100%, per hr | **Total @100%, per hr** | **@100%, per mo** | **@10% CPU, per mo** |
|---|---|---|---|---|---|---|---|---|
| lite | 1/16 | 256 MiB | 2 GB | $0.0023 | $0.0050 | $0.0073 | $5.30 | $2.34 |
| basic | 1/4 | 1 GiB | 4 GB | $0.0090 | $0.0180 | $0.0280 | $20.45 | $8.62 |
| standard-1 | 1/2 | 4 GiB | 8 GB | $0.0360 | $0.0360 | $0.0740 | $54.03 | $30.38 |
| standard-2 | 1 | 6 GiB | 12 GB | $0.0540 | $0.0720 | $0.1290 | $94.19 | $46.88 |
| standard-3 | 2 | 8 GiB | 16 GB | $0.0720 | $0.1440 | $0.2200 | $160.62 | $66.02 |
| standard-4 | 4 | 12 GiB | 20 GB | $0.1080 | $0.2880 | $0.4010 | $292.76 | $103.54 |

Two things fall out. Memory is roughly **half the bill at standard-1 and above**
even at 10% CPU. And 24/7 operation is expensive at any utilization:
standard-3 runs $66/month even when the CPU is nearly idle.

## Breakeven: Upstash Fixed ($8/mo) vs a matched Cloudflare box

Closest matched shape: Upstash **Fixed Small** (2 vCPU / 4 GB / 5 GB, $8)
against Cloudflare **standard-3** (2 vCPU / 8 GiB / 16 GB). Cloudflare has no
4 GiB 2-vCPU preset, so the comparison is generous to Cloudflare on RAM and disk.

| Cloudflare CPU utilization | $/hour (standard-3) | Running hours to reach $8 | Days |
|---|---|---|---|
| 5% | $0.0832 | 96 | 4.0 |
| 10% | $0.0904 | 89 | 3.7 |
| 25% | $0.1120 | 71 | 3.0 |
| 50% | $0.1480 | 54 | 2.3 |
| 100% | $0.2200 | 36 | 1.5 |

**A Cloudflare standard-3 matches a whole month of Upstash Fixed Small after
1.5 to 4 days of running time.** Past that, Upstash is cheaper for the rest of
the month. At 24/7, standard-3 costs **$160.62 against $8, a 20x gap**.

## A working-week sandbox (8h/day, 5 days/week = 173 running hours)

This is the shape most dev and preview boxes actually have.

| Shape @100% CPU | Monthly cost, 173 h |
|---|---|
| lite | $1.25 |
| basic | $4.85 |
| standard-1 | $12.80 |
| standard-2 | $22.32 |
| standard-3 | $38.07 |
| standard-4 | $69.38 |

At this duty cycle Cloudflare's small shapes beat Upstash Fixed Small:
`basic` at $4.85 and `standard-1` at $12.80 straddle the $8 line. Upstash's $8
wins once the box exceeds about 54 to 96 running hours at a standard-3 shape,
or when you need 4 GB or more of resident RAM.

## Five workloads, costed

Each workload is priced twice per platform: at the **closest matching shape** and
at the **cheapest shape that still fits** the RAM and vCPU requirement. All
figures are per month.

### The workloads

| # | Workload | Boxes | Running h/mo each | CPU util | Working set | Shape of the work |
|---|---|---|---|---|---|---|
| W1 | CI agent test runner | 1 | 36 | 100% | 8 GB | short, brutal, occasional |
| W2 | Dev/preview box, always on | 1 | 730 | 5% | 8 GB | always awake, mostly idle |
| W3 | Code interpreter per request | 2000 | 0.05 (3 min) | 50% | 1 GB | many tiny isolated jobs |
| W4 | Fleet of 20 parallel agents | 20 | 120 | 30% | 4 GB | wide, steady, moderate |
| W5 | Nightly data pipeline | 1 | 60 | 90% | 12 GB | memory-hungry batch |

### Results

| # | Workload | Cloudflare shape | Cloudflare | Upstash shape | Upstash | Cheaper by |
|---|---|---|---|---|---|---|
| W1 | CI runner | standard-3, 36h @100% | **$7.92** | Small, 36 active h | $3.60 | Upstash, $4.32 |
| W1b | CI runner, 6 GB fits | standard-2, 36h @100% | **$4.64** | Small, 36 active h | $3.60 | Upstash, $1.04 |
| W2 | Dev box always on | standard-3, 730h @5% | $60.76 | Small keep-alive | **$8.00** | Upstash, $52.76 |
| W2b | same, metered Upstash | standard-3, 730h @5% | **$60.76** | Small PAYG, 730 h | $73.00 | Cloudflare, $12.24 |
| W3 | Code interpreter x2000 | basic, 2000 x 3min @50% | **$1.90** | Small, 100 active h | $10.00 | Cloudflare, $8.10 |
| W3b | same, pessimistic | basic, 2000 x 3min @50% | **$1.90** | Small, 1000 active h | $100.00 | Cloudflare, $98.10 |
| W4 | Fleet of 20 agents | standard-1 x20, 120h @30% | **$117.16** | Small x20, 120h | $240.00 | Cloudflare, $122.84 |
| W4b | same, more vCPU headroom | standard-1 x20, 120h @30% | **$117.16** | Medium x20, 120h | $480.00 | Cloudflare, $362.84 |
| W5 | Nightly pipeline, 12 GB | standard-4, 60h @90% | **$22.33** | Large, 60 active h | $24.00 | Cloudflare, $1.67 |
| W5b | same, 8 GB fits | standard-3, 60h @90% | $12.34 | Medium, 60 active h | **$12.00** | Upstash, $0.34 |

### Cloudflare cost breakdown per workload

Shows why each number lands where it does. Memory is the recurring theme.

| # | Shape | CPU | Memory | Disk | Total | Memory share |
|---|---|---|---|---|---|---|
| W1 | standard-3, 36h @100% | $5.18 | $2.59 | $0.15 | $7.92 | 33% |
| W2 | standard-3, 730h @5% | $5.26 | $52.56 | $2.94 | $60.76 | **87%** |
| W3 | basic, 100 container-h | $0.90 | $0.90 | $0.10 | $1.90 | 47% |
| W4 | standard-1 x20, 2400 h | $25.92 | $86.40 | $4.84 | $117.16 | **74%** |
| W5 | standard-4, 60h @90% | $15.55 | $6.48 | $0.30 | $22.33 | 29% |

W2 and W4 are *memory bills wearing a compute costume*: 87% and 74% of spend is
provisioned RAM. That is exactly the axis Upstash prices at zero.

### Reading the five results

1. **W1: Upstash wins narrowly.** A 36-hour CI run costs $3.60 in active CPU
   hours against $7.92 for a standard-3. The gap is the memory and disk that
   Cloudflare provisions for the whole 36 hours. But if 6 GiB is enough, the
   gap closes to $1.04 — small enough that the $5 plan floor, not the meter,
   decides the winner.
2. **W2: the keep-alive question decides it.** Metered against metered,
   Cloudflare is slightly cheaper ($60.76 vs $73.00) because 5% CPU never
   justifies Upstash's 2-core minimum. Flip Upstash to the $8 keep-alive and
   the answer inverts by $52.76. This is the single highest-leverage choice in
   the whole comparison.
3. **W3: Cloudflare wins decisively.** 2000 three-minute jobs are 100
   container-hours total. Cloudflare bills 100 small-hours, $1.90. Upstash
   bills *box-awake* time, so even the optimistic 100-active-hour model costs
   $10, and a realistic wake-per-request pattern costs $100. Per-job cost:
   $0.00095 on Cloudflare.
4. **W4: Cloudflare wins by 2x to 4x.** Twenty parallel agents at 30% CPU
   fit `standard-1` shapes at $117.16. Upstash needs 20 Small boxes at $240,
   because a 4 vCPU box is still only 30% busy, and the fleet multiplies every
   inefficiency by twenty.
5. **W5: a near-tie that turns on the RAM line.** A 12 GiB working set forces
   `standard-4` and Cloudflare wins by $1.67. If 8 GiB fits, Upstash Medium at
   $12.00 wins by $0.34. The pipeline is 90% CPU, the one place Upstash's
   free memory does not help and Cloudflare's cheaper CPU does.

### Scoreboard

| Platform | Wins across the 5 base cases | Wins including variants |
|---|---|---|
| Cloudflare Sandboxes | 3 (W3, W4, W5) | 6 of 10 rows |
| Upstash Box | 2 (W1, W2 via keep-alive) | 4 of 10 rows |

Neither platform dominates. Cloudflare wins where jobs are **short and
numerous** or **CPU-dense**; Upstash wins where a box is **long-lived** or
**RAM-heavy**.
## Where each one wins

- **Cloudflare wins on real CPU dollars.** Upstash's 2-core floor means a
  1-core workload pays for capacity it cannot use, while Cloudflare's `basic`
  (1/4 vCPU) and `standard-2` (1 vCPU) sell exactly what is needed.
- **Cloudflare wins on sub-vCPU work.** `lite` at 1/16 vCPU has no Upstash
  analogue at all.
- **Upstash wins on memory**, decisively: $0 against $0.009/GiB-hour. 8 GiB
  held for a month is $52.56 on Cloudflare.
- **Upstash wins on always-on**, by roughly 20x at matched shapes.
- **Upstash wins above 4 vCPU.** Cloudflare's custom-instance cap is 4 vCPU /
  12 GiB, so a true 8 vCPU box needs two standard-4 containers (~$585/month
  against Upstash Fixed Large at $32).
- **Cloudflare wins on placement and images**: global, nearest free instance,
  BYO Docker today.

## Hidden lines on the Cloudflare bill

Sandboxes are not a standalone product. Three meters plus two optional ones:

1. **Containers**: the vCPU/memory/disk table above.
2. **Workers**: 10M requests + 30M CPU-ms included in the $5, then $0.30/M
   requests and $0.02/M CPU-ms
   ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
   A sandbox hit once per request uses one Worker request per call; 1M sandbox
   calls per month sits inside the included 10M.
3. **Durable Objects**: one per sandbox instance, billed wall-clock while active
   and unable to hibernate. 400,000 GB-s + 1M requests included, then
   $12.50/M GB-s and $0.15/M requests
   ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)).
   A 128 MB object that never hibernates burns 328,500 GB-s/month, about
   $4.11, so hibernating is worth doing.
4. **Egress** (optional): 1 TB/month included in NA/EU, then $0.025/GB; a
   second terabyte is $25.60
   ([Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)).
5. **Workers Logs** (optional): 20M events included on Paid, then $0.60/M
   ([Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)).
   Container logs move to Observability pricing from 2026-12-01
   ([Containers FAQ](https://developers.cloudflare.com/containers/faq/)).

Upstash's box price is close to the whole bill. The extras are storage at
$0.10/GB-month on Pay as You Go and the LLM token budget ($1 free, $100 paid,
or BYOK for any provider on any plan).

## Gotchas

- **Cloudflare memory bills on provisioned size, not usage.** "Memory and disk
  usage are based on the *provisioned* resources for the instance type you
  select, while CPU usage is based on active usage only." A sleeping container
  bills nothing; a running one bills its full RAM allocation whether or not it
  uses it.
- **Cloudflare keeps charging until sleep.** `sleepAfter` defaults to 10
  minutes, so a sandbox touched once an hour still bills about 10 minutes of
  provisioned RAM every time.
- **Cloudflare disk is ephemeral across sleep.** Persistence means snapshots
  (20 GB max, 30-day retention) or FUSE to R2. Upstash preserves storage
  through auto-freeze.
- **A Cloudflare container needs a Worker and a Durable Object.** Cold starts
  are "often in the 1-3 second range". You cannot reach a container over raw
  TCP/UDP from an end user.
- **Upstash has one region** (AWS us-east-1) and no custom Docker images yet.
  That is what the lower price buys.
- **Upstash's headline is per box-hour, not per core-hour.** 100% of 2 cores for
  an hour is $0.20, per its own FAQ.
- **The Upstash free tier is thin**: 5 CPU hours/month, which covers about half
  a month of a 1-core workload and under 3 days at 2 cores full tilt.

## Recommendation

| If your workload is... | Pick | Why |
|---|---|---|
| Dev or preview box that stays up | Upstash Fixed Small, $8/mo | 20x cheaper than a matched always-on container |
| Bursty agent runs, 4 GB+ RAM | Upstash Box Pay as You Go | Memory is free |
| 8h/day working weeks, small RAM | Cloudflare `basic`/`standard-1` | $4.85 to $12.80/mo straddles $8 at light duty |
| Short single-vCPU code execution | Cloudflare `basic`/`standard-2` | sells 1/4 and 1 vCPU; Upstash's floor is 2 |
| Needs global placement or custom images | Cloudflare Sandboxes | only option today |
| Already paying Workers Paid | Cloudflare | marginal cost is the meter only |

## Changelog

- 2026-10-29: **Rate-unit caveat, figures not yet revised.** This file prices
  Upstash at $0.050/core-hour, reading the $0.10/$0.20/$0.40 card as a
  per-box-hour price split across cores. Upstash's own FAQ worked example
  ("100% of 2 cores for one hour costs $0.2") and its blog example (10 min of
  CPU ~ $0.02) both imply **$0.10/core-hour**, i.e. a busy 2-core Small at
  $0.20/hour and $146/month. Every Upstash figure below is therefore the low
  end of a 2x band. The conclusion (Cloudflare memory is the expensive part,
  Upstash wins always-on) survives; the Upstash CPU line may double. See
  [Agent 37 vs Upstash Box](./ai-agent-sandbox-comparison.md) for the derivation.
- 2026-10-15: **Corrections after re-verification.** Five figures in the first
  draft were wrong and are fixed here.
  1. Always-on comparison said "about $68/mo" and "about $136/mo". Wrong. At
     matched shapes it is **$160.62/mo** (standard-3 vs Fixed Small) and
     **$292.76/mo** (standard-4 vs Fixed Medium). The $68 figure only held at
     about 10% CPU.
  2. The CPU comparison is now stated in the direction the numbers support:
     Cloudflare is $0.072/vCPU-hour, Upstash is $0.050/core-hour, but Upstash's
     2-core floor makes it the more expensive choice for single-core work.
  3. The "10 boxes x 50 CPU-hours = $36 vs $50" case ignored memory and
     conflated core-hours with vCPU-hours. Corrected to $40.50 (Cloudflare
     `basic`) against $25.00 (Upstash, 500 core-hours at $0.05).
  4. The 8 vCPU claim now states Cloudflare's real cap (4 vCPU) and prices the
     workaround at two standard-4 containers (~$585/mo).
  5. Added the Durable Objects wall-clock cost (~$4.11/mo at 128 MB if it never
     hibernates) and Workers Logs, both missing from the first draft.

  All arithmetic re-derived from the vendor pages; every fetch went through
  TinyFish.
- 2026-10-15: Added the five-workload cost model (W1-W5) with matched-shape and
  cheapest-fit variants, a Cloudflare per-workload cost breakdown, and a
  scoreboard. Three scripting errors caught and fixed while building it: an
  initial run double-multiplied instance count (W3 read $3801.60), per-instance
  rounding skewed W3 by $0.30, and the W3 breakdown row listed CPU $0.50 and
  disk $0.50 against true values of $0.90 and $0.10. Every row is now derived
  unrounded and cross-checked by hand.

## See also

- [Agent 37 vs Upstash Box](./ai-agent-sandbox-comparison.md) — per-minute uptime, active core-hour, VM-second and vCPU+GiB+GB-second side by side, and why this file's $0.05/core-hour reading may be 2x optimistic.
- [boat.dev Alternatives — Pay-As-You-Go Sandboxes With No Monthly Minimum](./boat-dev-pay-as-you-go-alternatives.md) — zero-floor alternatives, with Upstash Box's $0.05/core-hour rate placed against seven others.
- [pi durable Cloudflare Workers Durable Objects](../technology/pi-durable-cloudflare-workers-durable-objects.md)
