---
title: AI Agent Sandboxes Compared — Agent 37, Upstash Box, boat.dev, Cloudflare, Runtime, Lizard, Instabox, boxd
category: product
tags: [agent37, upstash, boat, cloudflare, runtime, lizard, instabox, boxd, sandbox, ai-agents, pricing, gvisor, microvm, containers, firecracker]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://www.agent37.com/
  - https://www.agent37.com/pricing
  - https://www.agent37.com/compare
  - https://www.agent37.com/compare/upstash-box
  - https://www.agent37.com/docs
  - https://www.agent37.com/docs/quickstart
  - https://www.agent37.com/blog/claude-agent-sdk-sandbox
  - https://www.ycombinator.com/companies/agent-37
  - https://upstash.com/box
  - https://upstash.com/pricing/box
  - https://upstash.com/pricing/box.md
  - https://upstash.com/docs/box/overall/pricing
  - https://upstash.com/docs/box/overall/quickstart
  - https://upstash.com/blog/upstash-box-vs-e2b
  - https://boat.dev/
  - https://docs.boat.dev/pricing
  - https://developers.cloudflare.com/sandbox/
  - https://developers.cloudflare.com/sandbox/platform/pricing/
  - https://developers.cloudflare.com/containers/platform/pricing/
  - https://developers.cloudflare.com/containers/platform/limits
  - https://withruntime.com/pricing
  - https://withruntime.com/
  - https://lizard.build/pricing
  - https://lizard.build/sandboxes
  - https://instabox.sh/docs/limits.md
  - https://instabox.sh/llms.txt
  - https://boxd.sh/pricing
  - https://boxd.sh/llms-full.txt
  - https://boxd.sh
confidence: medium
---

# AI Agent Sandboxes Compared — Agent 37, Upstash Box, boat.dev, Cloudflare, Runtime, Lizard, Instabox, boxd

Eight products that all rent an agent a computer, priced on six different meters.
That is the whole story: each vendor meters something different, so the same
2 vCPU / 4 GB box costs **$0.003 to $0.11 per vCPU-hour** depending on whose
meter you buy, and the winner changes with the duty cycle.

## TL;DR

- **Six meters, 49× spread.** Agent 37 charges per *minute of sandbox uptime*
  ($0.80/vCPU-month, CPU unmetered). Upstash bills *active CPU only* (memory
  free) or a flat $8–$32 keep-alive. boat.dev charges per *second of VM uptime*
  at $0.018/h for the shape, with a $20/month prepaid floor. Cloudflare bills
  *vCPU-seconds plus provisioned GiB-seconds plus GB-seconds*, inside a $5
  Workers Paid plan. Runtime bills *active vCPU-hours plus reserved GiB-hours*,
  with no plan fee. Lizard charges a flat $0.0162-$0.0648 per box-hour by size;
  Instabox bills vCPU-hours at $0.004 plus GiB-hours at $0.00225. boxd bills vCPU on
  the size, RAM on *resident* memory and disk on *written* bytes, then hibernates the
  machine to disk-only after four hours without traffic. Normalised, that is
  **$0.0030 / $0.0055 / $0.0081 / $0.0085 / $0.0090 / $0.0400 / $0.1030 /
  $0.110-$0.148 per vCPU-hour** at full allocation, a 49× spread.
- **Agent 37 wins every workload I costed at matched shapes**, by 1.5× to 20×
  (155× on a sleeping box), because its uptime meter ignores CPU while everyone
  else charges for it.
- **The discount is bought with oversubscription.** $0.80 per vCPU-month is
  **2.9% of an EC2 `c6a.large` vCPU-month** ($27.92). Agent 37's own copy says
  standard sandboxes "share host resources" and "sustained heavy CPU can be
  limited on busy hosts", with reserved cores at 4× and a full VM at 2.5×
  ([vs Upstash](https://www.agent37.com/compare/upstash-box),
  [pricing](https://www.agent37.com/pricing)).
- **boat.dev is the only one selling a real VM** at these prices — own kernel,
  Docker, systemd, a 60fps desktop, 51 GB disk included, no egress bill — but
  the $20 plan is prepaid time that expires monthly, so a light month bills $20
  for $0.72 of VM time ([pricing](https://docs.boat.dev/pricing)).
- **Cloudflare is the most expensive at matched shapes by a wide margin**, not
  because of CPU but because it bills **provisioned memory** at $0.009/GiB-hour:
  a 2 vCPU / 8 GiB `standard-3` holding 8 GiB costs $52.56/month in RAM alone,
  even frozen at 0.5% CPU ([pricing](https://developers.cloudflare.com/containers/platform/pricing/)).
  Its micro shapes remain the cheapest way to run genuinely tiny jobs.
- **The two newcomers bracket boat.dev.** Lizard's flat $0.0162/h and Instabox's
  $0.017/h for 2 vCPU / 4 GB are 10% apart, both below boat's $0.018 and Cloudflare's
  $0.22, both far above Agent 37's $0.0060, and both Firecracker microVMs, so a real
  kernel is now priced like a container. Lizard adds a $19 plan and 2 TB of egress;
  Instabox adds a free 4 vCPU / 8 GiB machine, but no public IPv4 and a fixed
  30-minute idle pause
  ([Lizard](https://lizard.build/pricing), [Instabox](https://instabox.sh/docs/limits.md)).
- **boxd is the most expensive VM here and the only one that bills what you use.**
  $150/month for its default 2 vCPU / 8 GiB, against $26.28 for boat's 4 vCPU / 8 GB,
  because $34 per vCPU-month is what a KVM machine with a fork button costs.
  Hibernate it and the same machine is **$1.40/month** for 20 GB on disk. It is the
  only vendor here whose RAM line falls when your process gets smaller.
- **Runtime is the honest meter, and still not the cheapest.** $0.025 per
  active vCPU-hour plus $0.0075 per GiB-hour, Firecracker microVMs with their
  own kernel, no plan fee, a 99% API-uptime credit, and SSO/SCIM/audit logs free
  ([pricing](https://withruntime.com/pricing)). It beats Cloudflare by 2.8× and
  Upstash PAYG by 2.5× at full CPU, but still loses to Agent 37: Agent 37
  charges $0.0060/h for the whole 2 vCPU / 4 GB box, against Runtime's
  $0.03125/h idle floor and $0.08/h fully busy.
- **One vendor ambiguity must be resolved before you budget Upstash**: its rate
  card and its own worked examples imply different units, a 2× gap on every
  number below. See [Gotchas](#gotchas).

## Context

Asked on 2026-10-29 to compare "agents 37" with the Upstash sandbox, then to
widen the comparison to boat.dev and Cloudflare Sandboxes. The two narrower
files that already cover parts of this ground are
[Upstash Box vs Cloudflare Sandboxes](./upstash-box-vs-cloudflare-sandbox.md)
(price model, Cloudflare per-shape costs) and
[boat.dev Alternatives](./boat-dev-pay-as-you-go-alternatives.md) (eight
zero-floor sandboxes, boat's floor economics). This file is the four-way
head-to-head with the pricing laid out in full. Lizard and Instabox were added on
the same day as the two flat-rate microVM vendors that land between boat.dev and
Runtime on price. Runtime was added the same day
from its pricing page, because its meter (active CPU plus reserved memory) sits
between the two extremes and it was the only major vendor missing from the
table.

## The six meters

| | Agent 37 | Upstash Box | boat.dev | Cloudflare Sandboxes | Runtime | Lizard | Instabox | boxd |
|---|---|---|---|---|---|---|---|---|
| **You pay for** | Minutes of uptime | Active CPU core-hours | Seconds of VM uptime | vCPU-s + provisioned GiB-s + GB-s | Active vCPU-hours + reserved GiB-hours | Seconds of sandbox uptime, flat per size | Seconds of running machine: vCPU + GiB + storage | vCPU on the size, RAM and disk on actual use |
| **CPU is** | Included in uptime | The meter | Included in uptime | Metered, active only | The meter, above a 50 mCPU floor | Included in the flat size | Part of the allocated shape | Billed while running, on the full vCPU count |
| **Idle is** | Billed until you stop it or enable auto-sleep | Free (auto-freezes) | Free once stopped | Billed on RAM/disk while awake; free asleep | Free once auto-paused at 300 s; storage only | Billed while running; pause stops compute | Billed while running; auto-pause stops it | Hibernates after 4 h without traffic: disk only |
| **Your floor** | $0 | $0 (free tier) | **$20/mo prepaid, expires** | **$5/mo Workers Paid** | $0 (prepaid credit from $10) | **$19/mo Pro**, $19 of credits included | **$0 free tier**, then $20/mo Pro | **$0**, no plan; $30 credits, card required |

## Detailed pricing

### Rate card, every published unit

| Dimension | Agent 37 | Upstash Box | boat.dev | Cloudflare Sandboxes | Runtime | Lizard | Instabox | boxd |
|---|---|---|---|---|---|---|---|---|
| **vCPU rate** | $0.0011/vCPU-h ($0.80/vCPU-month) | $0.10/core-h (Small) — see unit caveat | $0.009/vCPU-h ($0.018/box-h) | $0.000020/vCPU-s = $0.072/vCPU-h | $0.025/vCPU-h active; $18.25/vCPU-month reserved | Flat per box: $0.0162 / $0.0324 / $0.0648 per hour | $0.004/vCPU-hour | $0.047/vCPU-h ($34.31/vCPU-month) |
| **RAM rate** | $0.00096/GB-h ($0.70/GB-month) | **$0** | Included in the shape | $0.0000025/GiB-s = **$0.009/GiB-h** | $0.0075/GiB-h = $5.48/GiB-month while running | Included in the flat size | $0.00225/GiB-hour | $0.014/GiB-h ($10.22/GiB-month), resident only |
| **Disk rate** | $0.00012/GB-h ($0.09/GB-month) | $0.10/GB-month; included on keep-alive | Included: 51 / 51 / 111 / 251 GB | $0.00000007/GB-s = $0.1825/GB-month | Paused storage $0.08/GB-month; volume $0.11/GiB-month | 5 / 20 / 50 GB included; volumes $0.14/GB-month | $0.00011/GiB-hour (~$0.08/GiB-month); 20 GiB included | $0.000096/GiB-h ($0.07/GiB-month), written only |
| **Billing increment** | 1 minute | Core-hour, sub-hour granularity unstated [unverified] | 1 second | 10 ms | Per second, no one-minute minimum [unverified grain] | 1 second | 1 second | 1 second, settled every 15 min |
| **Monthly floor** | $0 (prepaid wallet) | $0 | **$20** (prepaid VM time, expires end of period) | **$5** Workers Paid | $0 (credit from $10) | $19 Pro (credits, not a fee) | $0 free; Pro $20 + usage | $0, no plan, no seat fee |
| **Free allowance** | $5 credit, card required | 5 CPU-h + 10 boxes/mo, recurring | 7-day trial, 25 compute hours, card | 375 vCPU-min, 25 GiB-h, 200 GB-h inside the $5 | 100 h of a 1 GB machine in first 30 days, no card | 7-day trial, $5 credits, card | 1 machine at 4 vCPU / 8 GiB, no card | $30 credits, card required |
| **Idle behaviour** | Full rate unless auto-sleep or stop | Auto-freeze 6 h (PAYG) / never (keep-alive) | Stopped = $0; disk kept 14 days, then deleted | Sleep after 10 min default; disk is fresh from image on wake | Auto-pause after 300 s; RAM, files and processes kept | Idle time billed; pause sets compute to $0 | Auto-pause 30 min (free); 5-30 min or off (paid) | Hibernate at 4 h no traffic; optional auto-suspend bills RAM |
| **Egress** | Not published [unverified] | Not published [unverified] | **Not billed** | 1 TB free NA/EU, then $0.025/GB | Inbound free; 100 GiB/mo out free, then $0.02/GB | 2 TB per account per 30 days included | $0.02/GB; VM upload capped ~50 Mbit/s | Not published [unverified] |
| **Snapshots** | Automatic backups included | $0.10/GB-month (storage) | Auto, unlimited, 14 days; 10 saved per $20 plan, then $0.056/snapshot/day | 20 GB max, 30-day retention; or mount R2 | $0.08/GB-month | Not priced separately [unverified] | 5 free, then storage-metered | Fork <200 ms, snapshots, checkpoints, all included |
| **Max shape** | Resizable, no published list | 8 vCPU / 16 GB | 16 vCPU / 32 GB (needs $100 plan) | 4 vCPU / 12 GiB custom (1–4 vCPU, ≥3 GiB/vCPU) | 16 vCPU / 64 GiB / 400 GiB disk | 8 vCPU / 16 GB sandbox | 8 vCPU / 16 GB (Pro); 32 / 64 (Team) | 4 vCPU / 16 GB self-serve; 8 / 32 by email |
| **Concurrency** | Not published [unverified] | 1,000 boxes default | 100 / 300 / 1,000 / 2,000 by plan | 1,500 vCPU + 6 TiB + 30 TB per account | 100 sandboxes (4 on free) | 100 sandboxes; 40 vCPU running (Pro) | Free 1; Pro 500 machines (100 running) | 50 machines per org (pricing page) or 100 (docs) |

### Every published shape, priced

Hourly columns are **compute only at full utilisation**; separately billed disk
is excluded so the shapes compare.

| Provider | Shape | vCPU | RAM | Disk | Published rate | 1 h | 173 h | 730 h |
|---|---|---|---|---|---|---|---|---|
| Agent 37 | standard 2 vCPU / 4 GB | 2 | 4 GB | choose | $0.0060/h | $0.006 | $1.04 | $4.40 |
| Agent 37 | standard 4 vCPU / 8 GB | 4 | 8 GB | choose | $0.0121/h | $0.012 | $2.09 | $8.80 |
| Agent 37 | standard 8 vCPU / 16 GB | 8 | 16 GB | choose | $0.0241/h | $0.024 | $4.17 | $17.60 |
| Agent 37 | VM 2 vCPU / 4 GB (2.5×) | 2 | 4 GB | choose | $0.0151/h | $0.015 | $2.61 | $11.00 |
| Agent 37 | Performance 2 vCPU / 4 GB (4×) | 2 | 4 GB | choose | $0.0241/h | $0.024 | $4.17 | $17.60 |
| Upstash | Small PAYG | 2 | 4 GB | 5–10–20 GB | A $0.20 / B $0.10 per box-h | A $0.20 / B $0.10 | A $34.60 / B $17.30 | A $146 / B $73 |
| Upstash | Medium PAYG | 4 | 8 GB | 5–10–20 GB | A $0.80 / B $0.20 per box-h | A $0.80 / B $0.20 | A $138.40 / B $34.60 | A $584 / B $146 |
| Upstash | Large PAYG | 8 | 16 GB | 5–10–20 GB | A $3.20 / B $0.40 per box-h | A $3.20 / B $0.40 | A $553.60 / B $69.20 | A $2,336 / B $292 |
| Upstash | Small keep-alive | 2 | 4 GB | included | $8/box-month | flat | flat | $8.00 |
| Upstash | Medium keep-alive | 4 | 8 GB | included | $16/box-month | flat | flat | $16.00 |
| Upstash | Large keep-alive | 8 | 16 GB | included | $32/box-month | flat | flat | $32.00 |
| boat.dev | small (full VM) | 2 | 4 GB | 51 GB | $0.018/h | $0.018 | $3.11 | $13.14 |
| boat.dev | default (full VM) | 4 | 8 GB | 51 GB | $0.036/h | $0.036 | $6.23 | $26.28 |
| boat.dev | large (full VM) | 8 | 16 GB | 111 GB | $0.072/h | $0.072 | $12.46 | $52.56 |
| boat.dev | xlarge (full VM) | 16 | 32 GB | 251 GB | $0.200/h | $0.20 | $34.60 | $146.00 |
| Runtime | 2 vCPU / 4 GiB, fully busy | 2 | 4 GiB | paused storage | $0.0800/h | $0.080 | $13.84 | $58.40 |
| Runtime | 2 vCPU / 4 GiB, waiting on a model | 2 | 4 GiB | paused storage | $0.0313/h | $0.031 | $5.41 | $22.81 |
| Runtime | 4 vCPU / 8 GiB, fully busy | 4 | 8 GiB | paused storage | $0.1600/h | $0.160 | $27.68 | $116.80 |
| Runtime | 16 vCPU / 64 GiB, fully busy | 16 | 64 GiB | paused storage | $0.8800/h | $0.880 | $152.24 | $642.40 |
| Lizard | Small (2 vCPU / 4 GB) | 2 | 4 GB | 5 GB | $0.0162/h | $0.016 | $2.80 | $11.83 |
| Lizard | Medium (4 vCPU / 8 GB) | 4 | 8 GB | 20 GB | $0.0324/h | $0.032 | $5.61 | $23.65 |
| Lizard | Large (8 vCPU / 16 GB) | 8 | 16 GB | 50 GB | $0.0648/h | $0.065 | $11.21 | $47.30 |
| Instabox | 2 vCPU / 4 GiB (Pro) | 2 | 4 GiB | 20 GiB + root | $0.0170/h | $0.017 | $2.94 | $12.41 |
| Instabox | 4 vCPU / 8 GiB (default) | 4 | 8 GiB | 20 GiB + root | $0.0340/h | $0.034 | $5.88 | $24.82 |
| Instabox | 8 vCPU / 16 GiB (Pro) | 8 | 16 GiB | 20 GiB + root | $0.0680/h | $0.068 | $11.76 | $49.64 |
| boxd | 1 vCPU / 4 GiB (full resident) | 1 | 4 GiB | 100 GiB written | $0.1030/h | $0.103 | $17.82 | $75.19 |
| boxd | 2 vCPU / 8 GiB (default) | 2 | 8 GiB | 100 GiB written | $0.2060/h | $0.206 | $35.64 | $150.38 |
| boxd | 4 vCPU / 16 GiB | 4 | 16 GiB | 100 GiB written | $0.4120/h | $0.412 | $71.28 | $300.76 |
| Cloudflare | lite (microVM) | 1/16 | 256 MB | 2 GB | $0.0073/h | $0.0073 | $1.25 | $5.30 |
| Cloudflare | basic (microVM) | 1/4 | 1 GiB | 4 GB | $0.0280/h | $0.0280 | $4.85 | $20.45 |
| Cloudflare | standard-1 (microVM) | 1/2 | 4 GiB | 8 GB | $0.0740/h | $0.0740 | $12.80 | $54.03 |
| Cloudflare | standard-2 (microVM) | 1 | 6 GiB | 12 GB | $0.1290/h | $0.1290 | $22.32 | $94.19 |
| Cloudflare | standard-3 (microVM) | 2 | 8 GiB | 16 GB | $0.2200/h | $0.2200 | $38.07 | $160.62 |
| Cloudflare | standard-4 (microVM) | 4 | 12 GiB | 20 GB | $0.4010/h | $0.4010 | $69.38 | $292.76 |

Upstash columns are **A** = the card read per core-hour ($0.10/core-h on
Small), **B** = the card read per box-hour ($0.10 per Small box-hour, i.e.
$0.05/core-h). The two readings differ by 2× on every cell.

Disk, at list rate (Cloudflare's is provisioned per instance type, so its row
is a rate, not a menu):

| Provider | 4 GB | 10 GB | 20 GB | 51 GB |
|---|---|---|---|---|
| Agent 37 | $0.36/mo | $0.90/mo | $1.80/mo | $4.59/mo |
| Upstash PAYG | $0.40/mo | $1.00/mo | $2.00/mo (limit) | not offered |
| boat.dev | included | included | included | included |
| Cloudflare | $0.73/mo | $1.83/mo | $3.65/mo | $9.31/mo |
| Runtime | $0.32/mo | $0.80/mo | $1.60/mo | $4.08/mo |
| boxd | $0.28/mo | $0.70/mo | $1.40/mo | $3.58/mo |

Lizard and Instabox bundle the disk into the shape (5-50 GB and 20 GiB), and bill
beyond it at $0.14/GB-month and $0.08/GiB-month; they are left out of the table
because no single per-GB rate applies.

### Normalised unit prices

The only fair way to compare six meters.

| Provider | $/vCPU-hour, full allocation | $/GB-RAM-hour | $/GB-disk-month | What is in the number |
|---|---|---|---|---|
| **Agent 37 standard** | **$0.00301** | $0.00096 | $0.09 | Shared, burstable CPU |
| Agent 37 VM | $0.00466 | $0.00096 | $0.09 | Own kernel, 2.5× compute |
| Agent 37 Performance | $0.00630 | $0.00096 | $0.09 | Reserved cores, 4× compute |
| **Upstash keep-alive** | **$0.00548** | $0 | included | Flat, 730 h |
| Upstash PAYG (A / B) | $0.10 / $0.05 | $0 | $0.10 | Consumer of CPU |
| **Lizard Medium** | **$0.00810** | included | included (20 GB) | Firecracker microVM, flat per size |
| **Instabox 4 vCPU / 8 GiB** | **$0.00850** | included | $0.08 | Firecracker microVM, vCPU + GiB while running |
| **boat.dev small** | **$0.00900** | included | included | Full VM, own kernel |
| **Runtime** | **$0.04000** | $0.0075 | $0.08 (paused) | Firecracker microVM, metered with a 50 mCPU floor |
| **boxd 2 vCPU / 8 GiB** | **$0.10300** | $0.01400 | $0.0701 | KVM, resident-RAM billing, own kernel |
| **Cloudflare** | **$0.110–$0.148** | **$0.009** | $0.1825 | microVM, provisioned RAM |

The gap from Agent 37 to Cloudflare is **49×**; to Runtime, 13× at full CPU
(5× on its idle floor); to boxd, 34×; to boat.dev, Lizard and Instabox,
2.7-3×; to Upstash keep-alive, 1.8×. Cloudflare's number is stable across all six shapes
($0.110–$0.148/vCPU-hour) because its memory:CPU ratio is fixed at roughly
3–8 GiB per vCPU.

### What $20 a month buys

| Provider | Hours of the 2 vCPU / 4 GB shape |
|---|---|
| Agent 37 standard | **3,318 h** (4.5 always-on months) |
| Agent 37 VM | 2,147 h |
| Upstash keep-alive | 1,825 h (2.5 box-months) |
| Lizard Small | 1,235 h |
| Instabox 2 vCPU / 4 GiB (Pro) | 1,176 h |
| Upstash PAYG, reading B | 200 h |
| Upstash PAYG, reading A | 100 h |
| boat.dev small | 1,111 h |
| Runtime, fully busy | 250 h |
| Runtime, waiting on a model | 640 h |
| Cloudflare standard-1, 100% CPU | 270 h |
| boxd 2 vCPU / 4 GiB resident | 133 h |
| Cloudflare standard-3, 100% CPU | 91 h |
| Cloudflare standard-3, 10% CPU | 221 h |
| Cloudflare lite, 100% CPU | 2,757 h (at 1/16 vCPU) |

## Shape focus — 4 vCPU / 8 GB

The same four vendors at the shape most agent fleets actually buy. Shapes are
exact except where a vendor has none; Cloudflare has no 4 vCPU / 8 GiB preset,
so it is priced twice — `standard-4` (4 vCPU / 12 GiB, CPU match) and
`standard-3` (2 vCPU / 8 GiB, RAM match). Disk is 10 GB everywhere except
boat, which includes 51 GB.

| Provider | Shape used | vCPU | RAM | Rate at full use | 1 h | 730 h @ 100% | 730 h @ 5% | Disk/mo |
|---|---|---|---|---|---|---|---|---|
| **Agent 37** standard | as requested | 4 | 8 GB | $0.0121/h | $0.012 | **$8.80** | **$8.80** | $0.90 (10 GB) |
| Agent 37 VM (2.5×) | as requested | 4 | 8 GB | $0.0186/h | $0.019 | $13.60 | $13.60 | $0.90 (10 GB) |
| Agent 37 Performance (4×) | as requested | 4 | 8 GB | $0.0252/h | $0.025 | $18.40 | $18.40 | $0.90 (10 GB) |
| **Upstash** Medium PAYG | exact match | 4 | 8 GB | A $0.80 / B $0.20 per box-h | A $0.80 / B $0.20 | A **$584** / B **$146** | A $29.20 / B $7.30 | $1.00 (10 GB) |
| Upstash Medium keep-alive | exact match | 4 | 8 GB | $16/box-month | flat | **$16.00** | $16.00 | included |
| **boat.dev** default | exact match | 4 | 8 GB | $0.036/h | $0.036 | **$26.28** | **$26.28** | included (51 GB) |
| **Runtime** | exact match | 4 | 8 GiB | $0.1600/h | $0.160 | **$116.80** | $47.45 | $0.64 (8 GiB paused) |
| **boxd** | 4 vCPU shape, 8 GiB resident | 4 | 8 GiB (of 16) | $0.3000/h | $0.300 | **$219.70** | **$219.70** | $0.70 (10 GB) |
| **Lizard** Medium | exact match | 4 | 8 GB | $0.0324/h | $0.032 | **$23.65** | **$23.65** | included (20 GB) |
| **Instabox** | exact match | 4 | 8 GiB | $0.0340/h | $0.034 | **$24.82** | **$24.82** | included (20 GiB) |
| **Cloudflare** standard-4 | CPU match, +4 GiB | 4 | 12 GiB | $0.4010/h | $0.401 | **$292.76** | $93.03 | $3.68 (20 GB) |
| Cloudflare standard-3 | RAM match, −2 vCPU | 2 | 8 GiB | $0.2200/h | $0.220 | $160.62 | $60.76 | $2.94 (16 GB) |

Hourly columns are compute only; the last column carries disk, which Cloudflare
cannot size — it is provisioned with the instance type (16 GB on
standard-3, 20 GB on standard-4) and billed whether or not it is used.

Read the 100% and 5% columns together. **Agent 37's and boat's two columns are
identical** — they bill uptime, so a busy box and an idle-awake box cost the
same. Upstash's CPU line falls the full 20× with utilisation, and its keep-alive
is flat either way. **Cloudflare's total does not**: the CPU line falls 20×, but
provisioned RAM and disk keep billing, so the month only moves from $292.76 to
$93.03 on `standard-4`.

### Scenarios at 4 vCPU / 8 GB

Ten GB of separately billable disk; Cloudflare carries its provisioned 16 GB
(`standard-3`) or 20 GB (`standard-4`) instead. "%" is share of the
allocated vCPUs. Upstash A/B are the two readings of its rate card.

| Scenario | Agent 37 | Upstash keep-alive | Upstash PAYG (A / B) | boat.dev | Cloudflare standard-4 | Cloudflare standard-3 | Runtime | Lizard | Instabox | boxd |
|---|---|---|---|---|---|---|---|---|---|---|
| **S1** Always-on, 730 h, 5% CPU | **$9.70** | $16.00 | $30.20 / $8.30 | $26.28 | $93.03 | $60.76 | $47.45 | $23.65 | $24.82 | $219.70 |
| **S2** Always-on, 730 h, 100% CPU | **$9.70** | $16.00 | $585.00 / $147.00 | $26.28 | $292.76 | $160.62 | $116.80 | $23.65 | $24.82 | $219.70 |
| **S3** Dev box, 173 h, 15% CPU | **$2.99** | $16.00 | $21.76 / $6.19 | $20.00 | $27.03 | $16.89 | $12.98 | $5.61 | $5.88 | $52.07 |
| **S4** Dev box, 173 h, 100% CPU | **$2.99** | $16.00 | $139.40 / $35.60 | $20.00 | $69.38 | $38.07 | $27.68 | $5.61 | $5.88 | $52.07 |
| **S5** 2,000 jobs × 3 min, 25% CPU | **$2.11** | $16.00 | $21.00 / $6.00 | $20.00 | $18.50 | $11.20 | $8.50 | $3.24 | $3.40 | $30.10 |
| **S6** Near-idle, 730 h, 0.5% CPU | **$0.90** sleeping / $9.70 awake | $16.00 | $1.00 (freezes) | $26.28 | $83.57 | $56.03 | $0.64 paused / $44.71 up | $0 paused / $23.65 up | $1.61 paused / $24.82 up | $0.70 hibernated / $219.70 up |
| **S7** Nightly batch, 60 h, 90% CPU | **$1.62** | $16.00 | $44.20 / $11.80 | $20.00 | $22.33 | $12.34 | $9.00 | $1.94 | $2.04 | $18.06 |
| **S8** 20 agents × 120 h, 30% CPU | **$46.93** | $320.00 | $596.00 / $164.00 | $86.40 | $478.66 | $286.16 | $216.00 | $77.76 | $81.60 | $722.30 |
| **S9** 100-agent fleet, 730 h, 5% CPU | **$970** | $1,600 | $3,020 / $830 | $2,628 | $9,303 | $6,076 | $4,745 | $2,365 | $2,482 | $21,970 |

What changes when the shape doubles from 2 vCPU / 4 GB:

- **Agent 37 exactly doubles**, $4.76 to $9.70 for a full month: its price is
  linear in vCPU and RAM, so the shape is a dial, not a tier.
- **Upstash doubles too**, Small to Medium ($8 to $16 keep-alive, $73/$146 to
  $146/$584 metered), and Medium is the last size before the jump to 8 cores.
- **boat's floor stops binding.** At 4 vCPU / 8 GB the `default` box hits the
  $20 plan after 556 hours, so a working month is real usage ($26.28) rather
  than prepaid time — boat's meter is at its most competitive here.
- **Runtime roughly doubles with the shape too**, $58.40 to $116.80 at full CPU,
  and is the one vendor here whose 4/8 bill is CPU-dominated (memory is 37% of
  it, against 58% on Agent 37).
- **Cloudflare has to overshoot.** `standard-4` gives 12 GiB where 8 GiB was
  asked, and the 4 extra GiB cost $31.54/month at full use; `standard-3` halves
  the CPU instead. Either way you pay for RAM you did not ask for.
- **The ordering does not change**: Agent 37 $9.70, Upstash keep-alive $16,
  boat $26.28, Lizard $23.65, Instabox $24.82, boxd $219.70, Cloudflare $160.62–$292.76 for the same always-on month — a
  **17× to 30× spread** on one shape, with boxd's $219.70 the price of a
  machine that can be forked mid-run. The only flip is the 100-agent fleet,
  where Upstash PAYG under reading B ($830) beats Agent 37 ($970) and
  keep-alive ($1,600), and Cloudflare's $9,303 is the reason to check the RAM
  line before scaling a fleet on it.

## Costed workloads

Shape is 2 vCPU / 4 GB and 10 GB disk unless noted; "%" is share of the box's
allocated vCPUs. Agent 37 is the standard tier. Cloudflare is `standard-3`
(2 vCPU / 8 GiB / 16 GB), the nearest CPU match; `standard-1` figures follow.

| Workload | Agent 37 | Upstash keep-alive | Upstash PAYG (A / B) | boat.dev | Cloudflare | Runtime | Lizard | Instabox | boxd | Winner |
|---|---|---|---|---|---|---|---|---|---|---|
| **W1** Always-on agent, 730 h, 5% CPU | **$5.30** | $8.00 | $8.30 / $4.65 | $20.00 | $60.76 | $23.73 | $11.83 | $12.41 | $110.20 | Agent 37 (PAYG-B $4.65 edges it) |
| **W2** Dev box, 173 h, 15% CPU | **$1.94** | $8.00 | $6.19 / $3.60 | $20.00 | $16.89 | $6.49 | $2.80 | $2.94 | $26.12 | Agent 37 |
| **W3** Dev box, 173 h, 100% CPU | **$1.94** | $8.00 | $35.60 / $18.30 | $20.00 | $38.07 | $13.84 | $2.80 | $2.94 | $26.12 | Agent 37 |
| **W4** 2,000 jobs × 3 min, 25% CPU | **$1.50** | $8.00 | $6.00 / $3.50 | $20.00 | $11.20 | $4.25 | $1.62 | $1.70 | $15.10 | Agent 37 |
| **W5** Near-idle, 730 h, 0.5% CPU | $0.36 sleeping / $5.30 awake | $8.00 | $1.00 (freezes) | $20.00 | $56.03 | $0.40 paused / $22.81 up | $0 paused / $11.83 up | $1.61 paused / $12.41 up | $0.70 hibernated / $110.20 up | Agent 37 sleeping |
| **W6** Nightly batch, 60 h, 90%, 4 vCPU / 8 GB | **$1.62** | $16.00 | $44.20 / $22.60 | $20.00 | $22.33 | $9.00 | $1.94 | $2.04 | $18.06 | Agent 37 |
| **W7** 100-agent fleet, 730 h, 5% CPU | **$530** | $800 | $830 / $465 | $1,314 | $6,076 | $2,373 | $1,183 | $1,241 | $11,020 | Agent 37, or Upstash PAYG-B at $465 |

Cloudflare at `standard-1` (0.5 vCPU / 4 GiB / 8 GB, the nearest RAM match)
instead: W1 $29.07, W2 $7.51, W3 $12.80, W4 $4.70, W5 $27.88, W7 $2,907. W6
needs 4 vCPU and has no `standard-1` equivalent.

Six things fall out:

1. **Agent 37 wins at every shape and duty cycle I costed** except two
   technicalities: Upstash's frozen box on W5 ($1.00), and Upstash PAYG under
   reading B on the 100-box fleet ($465 vs $530).
2. **boat's $20 floor is the deciding line for small work.** Its meter is
   excellent ($3.11 for a 173-hour month) and irrelevant, because the plan
   bills $20 whether or not you use it.
3. **Cloudflare's bill is dominated by provisioned memory at low CPU** — 86% of
   W1 and 94% of W5. Its CPU rate is competitive ($0.072/vCPU-hour); the RAM
   line is what costs.
4. **Runtime is not even the runner-up any more.** At 2 vCPU / 4 GB, Lizard
   ($11.83) and Instabox ($12.41) undercut Runtime's full month ($58.40 busy,
   $22.81 at its floor) and lose only to Agent 37, Upstash keep-alive and Upstash
   PAYG-B. Runtime's memory line ($5.48/GiB-month) is what keeps a long-lived box
   expensive.
5. **boxd is the most expensive line in every 2 vCPU / 4 GB row**
   ($110.20 for a full month, 21× Agent 37) and the cheapest in exactly one:
   a machine that hibernates ($0.70 against Agent 37's $0.36). Its rate card buys
   fork-from-running-state, a persistent kernel and an SSH endpoint, none of which the
   uptime vendors sell; at a flat 4 GiB per vCPU it cannot be bought small enough to
   compete on price.
6. **The 2× Upstash ambiguity changes winners, not just numbers.** Reading A
   makes Upstash the worst value of the four on CPU-busy work; reading B makes
   it a near-tie with Agent 37 on the fleet case. Get an invoice.

## Breakeven

| Comparison | Breakeven |
|---|---|
| Agent 37 vs Upstash PAYG, 2 vCPU / 4 GB | Agent 37's $4.40 compute = **44 busy core-hours** (A) or **88** (B); i.e. 22 or 44 full-box hours a month |
| Agent 37 vs Upstash keep-alive | No breakeven: Agent 37 is cheaper from minute one ($4.76 vs $8.00) |
| Agent 37 vs boxd | Agent 37 is 34× cheaper per vCPU-hour, 21× on a 2 vCPU / 4 GB month; boxd only wins once the machine hibernates |
| Agent 37 vs boat.dev, Lizard, Instabox | No crossover: all three bill every running second at 2.7-3× Agent 37's per-vCPU rate |
| Agent 37 vs Cloudflare | Cloudflare is 37× the $/vCPU-hour; no duty cycle closes that |
| boat.dev vs its own floor | $20 buys 1,111 h of `small`; below that, a competitor without a floor is cheaper |
| Agent 37 vs Runtime | Runtime beats Agent 37's $4.40 monthly compute below **55 h fully busy** or **141 h at its idle floor**; above that Agent 37 is cheaper |

## Where each wins

| Situation | Pick | Why |
|---|---|---|
| Per-customer always-on agents, sold as a product | **Agent 37** | Cheapest box-month, harness templates, Composio, white-label kit, spend caps |
| Sustained CPU-bound work (builds, tests, data) | **Agent 37** | Uptime meter ignores CPU; 7–14× cheaper on the batch case |
| Docker, systemd, a desktop, a dedicated IP | **boat.dev** | Only one here that is a full VM by default, with 51 GB disk and free egress |
| A box that must not be throttled | **Upstash** or **boat** | Metered CPU / dedicated VM; Agent 37's cheap tier is shared by design |
| Genuinely tiny jobs (functions, 256 MB) | **Cloudflare** `lite` | $5.30 for a 730-hour month at 1/16 vCPU; no competitor goes that small |
| Already on Workers Paid, need edge placement | **Cloudflare** | Runs inside your Worker, global placement, R2 mounts |
| SDK, CLI and MCP on day one | **Upstash** | `@upstash/box`, `upstash-box`, `mcp.upstash.com` |
| No card, free tier today | **Upstash** | 5 CPU-h and 10 boxes recurring; everyone else gates on a card |
| Fixed, forecastable bill | **Upstash keep-alive** or **boat plan** | Both are published flat monthly numbers |
| Cheapest microVM with a PaaS behind it | **Lizard** | $0.0162/h flat, 2 TB egress, Postgres/Redis/S3 in the same account |
| A machine you can fork mid-run | **boxd** | <200 ms with memory, disk and processes; snapshots and checkpoints included |
| EU-resident VMs with a public IPv4 per machine | **boxd** | Bare metal in Germany, self-host option, SSH and no SDK |
| A free 4 vCPU / 8 GiB machine to try today | **Instabox** | No card, desktop + Chromium, Claude Code and Codex preinstalled |
| A Firecracker microVM at a metered rate, with an SLA | **Runtime** | $0.025/vCPU-h active, own kernel, 99% uptime with automatic credit |
| Porting off E2B, Daytona, Vercel Sandbox or Blaxel | **Runtime** | One import change (`withruntime.e2b`), same API shape |
| Multi-region outside the US/EU | **None** | Agent 37 and Instabox don't document regions; Upstash is us-east-1; boat is EU-only; Lizard is US East + EU West; Cloudflare is global |

## Isolation

| | Agent 37 | Upstash Box | boat.dev | Cloudflare | Runtime | Lizard | Instabox | boxd |
|---|---|---|---|---|---|---|---|---|
| **Boundary** | gVisor user-space kernel (standard); own kernel on VM tier | Shared-kernel container (`runc`) | Full VM, own kernel | microVM, own kernel and network | Firecracker microVM, own kernel, Runtime's own servers | Firecracker microVM, own kernel | Firecracker microVM, Debian 13, own kernel | KVM, custom Rust VMM (not Firecracker), own kernel, Ubuntu 24.04 |
| **Vendor's own honesty** | "Shared host resources"; disk quota per tenant | Says microVMs are "a stronger boundary than Box's container" | Ships VMs, no user-space trickery | "No other workload shares it" | Names Firecracker and where enforcement sits | Publishes a 300-run start benchmark | Publishes limits, not benchmarks | Publishes a CI benchmark and a 3-way comparison vs exe.dev and sprites.dev |
| **Inbound** | No public hostname on hosts; Cloudflare edge + API key; signed per-port URLs | No private-network or metadata reach; preview URLs published through the SDK/MCP | Public IPv6 per sandbox, public port URLs | HTTP only through your Worker; `enableInternet` toggle | Previews, custom domains, TCP ports; IPv6 included | Not documented [unverified] | HTTPS ports and SSH; no public IPv4 | Per-VM public IPv4, HTTPS subdomain, custom domains, TCP/UDP |
| **Outbound** | Per-instance allow/deny, IPv4 ranges only | Egress allowlist | Unrestricted, not billed | Worker-mediated; blockable | 100 GiB/mo free, then $0.02/GB; intra-region free | 2 TB included, then not published | $0.02/GB, ~50 Mbit/s per VM | Per-machine egress allowlist; --isolated drops integrations |
| **Secrets** | Encrypted at rest; keys in the workspace | Attach Headers injects secrets host-side, never into the box | Optional AI credentials proxy ($1/day + $1/1k requests) | Credentials stay in the Worker | Read-only keys, per-key daily limits, per-create cost cap | Bring your Claude or ChatGPT plan once | Org secrets injected by the outbound proxy | Org-scoped environment variables shared across machines |
| **Desktop / browser** | Browser automation, live desktop | Headless Chromium, live view, recordings | 60fps virtual desktop, Chrome preinstalled | None built in; bring an image | Browser driving with screenshots and previews | Built-in desktop and Chromium | Desktop + Chromium, shareable live view | Headless Chrome and Docker preinstalled; no desktop |
| **Docker** | VM tier only | No | Yes, plus systemd | Yes, any image | Yes: root, apt, sudo, Compose, own Dockerfile | Not stated for sandboxes [unverified] | Yes: root, sudo, Docker, systemd | Yes, preinstalled with the Python, Go, Node and Claude Code toolchain |
| **Compliance** | SOC 2 Type I, reports on request | Not stated on Box pages [unverified] | Not stated [unverified] | Cloudflare's broader programme [unverified for Sandboxes] | 99% API uptime, 10% automatic credit; SOC 2 unstated [unverified] | SOC 2 coming soon; SSO/RBAC on Enterprise | Not stated [unverified] | EU data residency; SSO and audit logs on Custom; self-host |

Ranked by boundary strength on the default tier: **Cloudflare microVM ≈ boat
VM > Agent 37 gVisor > Upstash container**. Ranked by price: exactly the
reverse. That trade-off is the decision.

The mechanics behind those labels — what a gVisor syscall actually crosses, and why a microVM boundary is a different mechanism rather than just "more" — are in [gVisor vs a Hypervisor](../technology/gvisor-vs-hypervisor.md).

## Gotchas

- **Upstash's rate card and its worked examples disagree by 2×.** The card says
  "$0.10 per active CPU hour" for a 2-core Small box; the FAQ on the same page
  says "using 100% of 2 cores for one hour costs **$0.2**", and the blog's
  example (10 min of CPU ≈ $0.02) only reconciles with **$0.10 per core-hour**
  ([pricing](https://upstash.com/pricing/box),
  [vs E2B](https://upstash.com/blog/upstash-box-vs-e2b)). Read as core-hours,
  the per-core price also rises with box size ($0.10 / $0.20 / $0.40). Both
  readings appear in this file as A and B; the earlier repo files used the
  $0.05/core-hour reading and are therefore possibly 2× optimistic.
- **Upstash's disk limits disagree too**: 10 / 20 / 30 GB on the HTML pricing
  page, **5 / 10 / 20 GB** in `/pricing/box.md` and the docs
  ([box.md](https://upstash.com/pricing/box.md),
  [docs](https://upstash.com/docs/box/overall/pricing)).
- **Lizard bills idle time and its $19 is a plan, not a free tier.** A running
  sandbox is billed even while idle; only a successful pause zeroes compute, and the
  trial needs a card. Its Small sandbox has 5 GB of disk, thin for a repo plus a
  toolchain.
- **Instabox's free tier shrank before it shipped.** A 17 October write-up described
  five free 4 vCPU / 8 GB machines; the docs now say one, with five snapshots and a
  fixed 30-minute idle pause. Free machines are 4/8 only, and a machine has no
  public IPv4: HTTP ports and SSH go through an HTTPS gateway, and uploads are
  capped near 50 Mbit/s.
- **Both newcomers publish their own comparison tables.** Lizard's 300-run benchmark
  (228 ms median against E2B, Daytona and Modal) is self-run from a Railway runner;
  Instabox publishes limits rather than timings. Neither has been through a neutral
  third-party test.
- **boxd publishes two rate cards that differ by 25%.** The pricing page says
  EUR 0.049/vCPU-h, EUR 0.015/GiB-h and EUR 0.0001/GiB-h; the docs say EUR 0.039,
  EUR 0.012 and EUR 0.00008, plus a USD card at $0.047, $0.014 and $0.000096. The
  default machine is quoted as about EUR 0.22/h on one page and about EUR 0.17
  ($0.21) on the other. The machine quota disagrees too: 50 per organization on the
  pricing page, 100 in the docs. This file uses the USD card, so every boxd figure
  here is the cheaper of the two readings.
- **boxd sleeps on *network* silence, not CPU silence.** A machine goes to standby
  after its timeout with no traffic in either direction; CPU work, disk work and local
  timers do not count. A four-hour compile with no network call hibernates mid-build,
  and a hibernated machine wakes only on a connection through boxd (HTTPS, SSH or
  `boxd machine exec`) — not on a raw exposed port and not on its own cron
  jobs.
- **boxd's RAM meter punishes a process that grows.** Billing is on resident memory
  sampled every second, so a Postgres or a JVM that settles at 7 of 8 GiB pays 3.5
  times what the 2 GiB quote assumed. Its 100 GiB disk is billed on written bytes only,
  which makes it the cheapest disk here at $0.07/GiB-month.
- **Runtime's memory is the most expensive RAM here.** $0.0075/GiB-hour is
  $5.48/GiB-month while compute runs, 7.8× Agent 37's $0.70/GB-month. A 4 GiB
  box that stays awake costs $21.90/month in memory alone, before a single
  vCPU-second.
- **Runtime's idle floor means an awake sandbox never costs zero.** 50 millicores
  is $0.03125/h, or $22.81/month for a 2 vCPU / 4 GB box that is technically
  doing nothing. The cheap number depends on letting it pause after 300 s; a
  sandbox holding a websocket or streaming output never pauses.
- **Runtime's comparison table leaves out the one vendor cheaper than it.** Its
  page claims 42%-88% savings against fourteen other providers and lists fifteen
  (Northflank through Runloop). Agent 37 and Upstash Box are not among them, and
  Agent 37's list rate for the same job is a fraction of Runtime's.
- **boat's $20 is prepaid VM time, not a subscription, and it expires.** Every
  dollar returns as VM time at the rate card, but "included VM time expires at
  the end of the billing period" — a 10-hour month bills $20 for $0.18 of VM
  time ([pricing](https://docs.boat.dev/pricing)).
- **boat deletes a stopped sandbox's disk after 14 days**, automatic snapshots
  included. A hibernating agent fleet must either keep paying or take saved
  snapshots (10 per $20 of plan, then $0.056/snapshot/day).
- **boat meters starts, not just time.** The $20 plan allows 12 / 60 / 200
  starts per minute / hour / day; bursting to 3× costs $0.03–$0.07 per start.
  A fan-out pattern that creates thousands of short sandboxes hits this before
  it hits the VM-time limit.
- **boat is EU-only** (Germany, Finland, France), and `xlarge` requires the
  $100 plan. Seats multiply the plan: a 5-seat org on $20 pays $100.
- **Cloudflare bills memory and disk on provisioned size, CPU on active use.**
  "Memory and disk usage are based on the *provisioned* resources for the
  instance type you select, while CPU usage is based on active usage only"
  ([pricing](https://developers.cloudflare.com/containers/platform/pricing/)).
  An idle-but-awake container is therefore a pure memory bill: $52.56/month for
  8 GiB.
- **Cloudflare's disk is ephemeral across sleep** — a woken sandbox starts from
  the image unless you snapshot (20 GB max, 30-day retention) or mount R2.
  `sleepAfter` defaults to 10 minutes, so a box touched hourly bills about
  10 minutes of provisioned RAM every time.
- **A Cloudflare sandbox needs a Worker and a Durable Object**, and both bill on
  top of Containers. There is no standalone container endpoint, and no
  raw TCP/UDP from an end user.
- **Cloudflare has no 2 vCPU / 4 GiB preset.** The nearest CPU match is
  `standard-3` (2 vCPU / 8 GiB / 16 GB), which over-charges RAM 2×; custom
  sizes need ≥3 GiB per vCPU. Don't price a "2 vCPU / 4 GB" Cloudflare box
  without stating which shape you substituted.
- **"Cloudflare Sandboxes" is two products.** Containers (Linux microVM) is the
  one that compares here; Dynamic Workers (JS/Python/WASM isolates) is a
  different, cheaper primitive with no shell.
- **Agent 37 bills an awake box whether or not it is working.** Auto-sleep is a
  toggle: "Enable auto-sleep or stop it to reduce that charge"
  ([pricing](https://www.agent37.com/pricing)). Leave it off and an idle agent
  costs the full shape rate.
- **Agent 37's standard tier is explicitly shared** and its own comparison page
  says so; reserved cores cost 4×, a VM 2.5×. The pricing page and the
  comparison page also describe those multipliers differently — two tiers or
  one tier described twice, not stated plainly anywhere I read.
- **Every Agent 37 latency number is self-measured** on pages that rank it first
  against a named competitor, over short windows (n = 37, 38, 811). Upstash's
  cited timings are its own five-run European test; Cloudflare's are vendor
  claims. None of the three is an independent benchmark.
- **The "94% lower cost" headline is a 57-hour month.** The homepage calculator
  defaults to 57 running hours (7% duty). At 730 hours the same comparison is
  40% ([pricing](https://www.agent37.com/pricing)).
- **boat's disk numbers differ by source**: 51 / 51 / 111 / 251 GB on its own
  pricing docs, 12 / 50 / 125 GB in Agent 37's comparison table. Trust the
  vendor's docs; treat third-party tables as approximate.

## Picks

| If you are... | Pick | The one-line reason |
|---|---|---|
| Shipping a per-customer agent product | Agent 37 | Cheapest box-month plus the scaffolding (templates, Composio, white-label kit) |
| Running an internal coding agent over a repo | Upstash Box | SDK + MCP + git-to-PR + browser, on a container you are not sharing |
| Needing Docker, systemd, a desktop, an IP | boat.dev | The only full-VM-by-default option, with 51 GB disk and free egress |
| Already on Workers, wanting global placement | Cloudflare | Runs inside your Worker, but budget the RAM line first |
| Cost-tuning 100+ long-lived agents | Agent 37, then re-measure | $530 vs $800 (keep-alive) vs $1,314 (boat) at list |
| A predictable bill with an established vendor | Upstash keep-alive | Fixed $8–$32 per box, no oversubscription clause |
| Prototyping today with no card | Upstash free tier | 5 CPU-h + 10 boxes, recurring |
| A metered, microVM-isolated sandbox with a real SLA | Runtime | Firecracker, 99% uptime credit, free SSO and audit log |

## Open Questions

- **Does Agent 37's shared tier hold up under sustained load?** No independent
  benchmark exists and no throughput floor is published.
- **Where does Agent 37 run, and what is its concurrency ceiling?** Neither is
  documented; both matter for a fleet.
- **Which Upstash rate is real?** One invoice resolves a 2× swing on every
  number in this file. [unverified]
- **Is Upstash Box SOC 2, and does boat have any attestation?** Neither states
  one on its product pages. [unverified]
- **Does Cloudflare's Sandbox SDK ship git/browser tooling**, or is
  git-to-PR / Chromium a DIY layer on the image? [unverified]
- **Is Lizard's sandbox CPU allocated or shared?** The flat per-size rate implies a
  fixed slice, but no CPU-share or throttle policy is published. [unverified]
- **Which regions does Instabox run in**, and is the $20 Pro fee a credit or a
  charge on top of usage? [unverified]
- **Does boxd bill RAM for standby?** The docs say vCPU bills only while running and
  standby bills RAM plus disk, so 8 GiB resident at rest would be $10.22/month — a
  charge no other vendor here makes. [unverified]
- **What is boxd's egress rate?** Nothing is published beyond the per-machine
  allowlist. [unverified]
- **Is Runtime's paused-memory snapshot reliable across hosts**, and what does a
  16 GiB pause actually cost once files are included? [unverified]
- **Does Runtime hold SOC 2 or ISO 27001?** The pricing page lists SSO, SCIM and a
  400-day audit log but no attestation. [unverified]
- **What does boat charge for a long-idle fleet** beyond snapshot fees, now that
  stopped disks die at 14 days? [unverified]

## Related

- [Agent 37's Standard Tier — Why It Is So Cheap and What You Trade Away](./agent37-standard-tier-tradeoffs.md) — the mechanism and the trade-offs behind this file's cheapest column.
- [Upstash Box vs Cloudflare Sandboxes — Price Comparison](./upstash-box-vs-cloudflare-sandbox.md) — the full Cloudflare per-shape model and breakevens reused here.
- [boat.dev Alternatives — Pay-As-You-Go Sandboxes With No Monthly Minimum](./boat-dev-pay-as-you-go-alternatives.md) — boat's floor economics against eight zero-floor providers.
- [pi sandbox integration — fork vs extension](../technology/pi-sandbox-integration-fork-vs-extension.md) — how a remote sandbox handle differs from a local one.

## Changelog

- 2026-10-29 — added boxd as the eighth column. boxd is a Dutch pre-seed
  (BlueYard-led $2M, September 2026) selling persistent KVM machines: $0.047/vCPU-h,
  $0.014/GiB-h on resident memory, $0.000096/GiB-h on written disk, hibernating to
  disk-only after four hours of network silence. It is the first vendor here whose RAM
  and disk meters track actual use, the most expensive per-VM option at full memory
  ($150.38/month for 2 vCPU / 8 GiB), and the cheapest once hibernated ($1.40).
  Recorded its two disagreeing rate cards (25% apart), the 50-vs-100 machine quota,
  and the network-silence hibernation trap.
- 2026-10-29 — added Lizard and Instabox as sixth and seventh columns. Lizard
  is a flat-rate Firecracker sandbox on a deployment platform ($0.0162-$0.0648 per
  box-hour, $19 plan with credits, 2 TB egress); Instabox is a Firecracker
  VM billed at $0.004/vCPU-h plus $0.00225/GiB-h with a one-machine free tier. Added
  six shape-ladder rows, the 4 vCPU / 8 GiB rows, and three gotchas (Lizard's idle
  billing and thin disk, Instabox's 5-to-1 free-tier change and missing IPv4, both
  vendors' self-published comparisons).
- 2026-10-29 — added Runtime as a fifth column from its pricing page: the
  active-vCPU plus reserved-memory meter, its idle floor and pause behaviour, four
  shape-ladder rows, 4 VMs at 4 vCPU / 8 GiB, and three gotchas (memory rate, idle
  floor, a comparison table that omits the one cheaper vendor). Its 1,000-run
  arithmetic was re-derived: $0.64 checks out as 240 GiB-s of memory plus 20
  vCPU-s of CPU per run.
- 2026-10-29 — added the 4 vCPU / 8 GB shape section: a per-vendor shape table (Agent 37's VM and Performance tiers included) and nine scenarios at that shape. Cloudflare has no 4 vCPU / 8 GiB preset, so it is priced twice (`standard-4` 4 vCPU / 12 GiB, `standard-3` 2 vCPU / 8 GiB).
- 2026-10-29 — created as `agent37-vs-upstash-box.md`, then widened the same
  day to four providers at the user's request and renamed to
  `ai-agent-sandbox-comparison.md`. Added boat.dev and Cloudflare Sandboxes as
  columns, a full published-shape price ladder (21 rows), a disk-price table, a
  normalised $/vCPU-hour table, a "what $20 buys" table, seven costed
  workloads, and boat-specific gotchas (expiring prepaid time, 14-day disk
  deletion, start-rate limits, EU-only). Vendor inconsistencies recorded rather
  than resolved: Upstash's core-hour unit (priced both ways as A and B), its
  disk limits (5/10/20 vs 10/20/30 GB), Agent 37's 2.5× vs 4× tier multipliers,
  and boat's disk size (51/51/111/251 vs 12/50/125 GB).
