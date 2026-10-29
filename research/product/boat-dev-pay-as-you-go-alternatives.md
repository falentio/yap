---
title: boat.dev Alternatives — Pay-As-You-Go Sandboxes With No Monthly Minimum
category: product
tags: [sandbox, ai-agents, pricing, boat, fly-sprites, daytona, agent37, upstash, devbox]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://docs.boat.dev/pricing
  - https://boat.dev/compare
  - https://fly.io/pricing
  - https://fly.io/sprites
  - https://sprites.dev/pricing
  - https://docs.sprites.dev/
  - https://docs.sprites.dev/quickstart
  - https://docs.fly.io/sprites/working-with-sprites
  - https://community.fly.io/t/more-sprites-plans/26857
  - https://www.daytona.io/pricing
  - https://www.daytona.io/docs/en/billing/
  - https://www.daytona.io/docs/en/persistence/
  - https://www.daytona.io/docs/en/sandboxes/
  - https://www.daytona.io/docs/en/ssh-access/
  - https://www.agent37.com/pricing
  - https://www.agent37.com/docs
  - https://www.agent37.com/docs/agents-api/ssh
  - https://www.agent37.com/compare/boat
  - https://www.agent37.com/solutions/agent37-vs-exe-dev
  - https://upstash.com/pricing/box
  - https://upstash.com/docs/box/overall/shell
  - https://namespace.so/pricing
  - https://namespace.so/docs/devbox
  - https://modal.com/pricing
  - https://e2b.dev/pricing
  - https://exe.dev/pricing
  - https://vercel.com/docs/vercel-sandbox/pricing
  - https://www.hetzner.com/cloud/cost-optimized/
confidence: high
---

# boat.dev Alternatives — Pay-As-You-Go Sandboxes With No Monthly Minimum

The ask: boat.dev's shape (a persistent full Linux VM you can shell into, with
a disk, snapshots, and per-second billing) without the **$20/month plan**.

The short answer: **Fly Sprites** is the closest drop-in, **Agent37** is the
cheapest zero-subscription option, and **Daytona** is the best sandbox API with
SSH and a $200 free start. boat is still cheaper per hour than every
dedicated-VM option here, so the switch only pays off below roughly 60 to 110
active hours a month (or with Agent37's shared tier).

## What the $20 actually is

boat's plan is **prepaid VM time, not a fee**: "A plan is a monthly price that
your card pays. It is not a fee. Every dollar comes back as VM time at the
rates above" ([boat pricing](https://docs.boat.dev/pricing)). The catch is the
next sentence: "Included VM time expires at the end of the billing period."

| boat fact | Value | Source |
|---|---|---|
| Minimum plan | $20/mo, returns as 555 h of `default` (4 vCPU / 8 GB) | [pricing](https://docs.boat.dev/pricing) |
| `small` (2 vCPU / 4 GB / 51 GB) | $0.018/h | [pricing](https://docs.boat.dev/pricing) |
| `default` (4 vCPU / 8 GB / 51 GB) | $0.036/h | [pricing](https://docs.boat.dev/pricing) |
| Idle | stopped sandbox costs nothing, disk kept 14 days | [pricing](https://docs.boat.dev/pricing) |
| Trial | 7-day free trial with card, 25 free hours to start | [pricing](https://docs.boat.dev/pricing), [compare](https://boat.dev/compare) |
| Region | EU only | [compare](https://boat.dev/compare) |

So the real requirement is not "no subscription". It is "**no month where I pay
$20 and get less than $20 of use**". A light month on boat bills $20 for
$0.72 of VM time; that is the pattern to escape.

The trap: boat's per-hour rate is 5x to 20x cheaper than the alternatives
below. Moving to a zero-floor provider lowers the *floor* and raises the
*rate*. You win only while monthly usage stays under about $20 of boat time,
which is 555 hours of `default` (23 days of always-on 4 vCPU / 8 GB).

## Wide table — billing, no monthly minimum

All eight have a $0 monthly floor. Rates are list prices, per hour, at full
allocation unless marked.

| Dimension | Fly Sprites | Daytona | Agent37 | Upstash Box | Fly Machines | Namespace Devbox | Modal Sandbox | E2B Hobby |
|---|---|---|---|---|---|---|---|---|
| **Floor** | $0 | $0 | $0 | $0 | $0 | $0 (Developer) | $0 (Starter) | $0 |
| **Billing unit** | CPU-hour + GB-hour + storage | vCPU-h + GiB-h + GiB-h | minute of awake time | active CPU core-hour | second + volume | devbox minute | per second | per second |
| **2 vCPU / 4 GB** | $0.164/h | $0.166/h | $0.006/h | $0.05/core-h | $0.092/h | $0.24/h (S, burst 4/8) | $0.238/h | $0.101/h |
| **4 vCPU / 8 GB** | $0.329/h | $0.331/h | $0.012/h | $0.05/core-h | $0.183/h | $0.24/h (S) | $0.476/h | $0.202/h |
| **Idle cost** | $0 warm or cold | disk only | disk only | $0 frozen | rootfs $0.15/GB-mo | $0 stopped | $0 | $0 paused |
| **Free start** | $30 trial credit | $200 compute | $5 credit (card) | 5 CPU-h/mo, recurring | none | 30-day trial, no card | $30/mo, recurring | $100 once |
| **Rounding** | per second | per second | per minute | per core-hour | per second | 1 min minimum | per second | per second |

Derived rates: Sprites CPU $0.0385/CPU-h + RAM $0.021875/GB-h
([pricing](https://sprites.dev/pricing)); Daytona vCPU $0.0504/h + memory
$0.0162/GiB-h ([pricing](https://www.daytona.io/pricing)); Agent37 $0.80/vCPU
+ $0.70/GB per 730-h month ([pricing](https://www.agent37.com/pricing));
Upstash $0.05/core-hour, 2 cores at 100% = $0.20/h
([FAQ](https://upstash.com/pricing/box)); Fly `performance-2x` and
`performance-4x` ([pricing](https://fly.io/pricing)); Namespace $0.004 per
Devbox Minute, S consumes 1 ([pricing](https://namespace.so/pricing)); Modal
sandboxes at 3x list, one "core" is 2 vCPU
([pricing](https://modal.com/pricing)); E2B 2 vCPU $0.000028/s
([pricing](https://e2b.dev/pricing)).

## Wide table — what you actually get

| Dimension | Fly Sprites | Daytona | Agent37 | Upstash Box | Fly Machines | Namespace Devbox | Modal Sandbox | E2B Hobby |
|---|---|---|---|---|---|---|---|---|
| **Isolation** | Firecracker microVM | container, Linux VM class | gVisor, or full VM | Docker container | Firecracker microVM | KVM VM | gVisor container | Firecracker microVM |
| **Persistent disk** | full ext4, unlimited life | yes, kept until delete | yes, billed while retained | 10 GB, kept through freeze | volumes, $0.15/GB-mo | volume, $0.20/GB used | Volumes $0.09/GiB-mo | snapshot only |
| **Shell** | `sprite console` | `daytona ssh` | SSH, scp, VS Code Remote | SSH over box host | `fly ssh console` | SSH, IDE, web terminal | exec API only | exec API only |
| **Idle sleep** | automatic, seconds | manual stop | auto-sleep, must enable | automatic freeze | `auto_stop` | auto-stop after 15 min | scale to zero | auto-pause |
| **Regions** | Fly regions | multiple | not documented | us-east-1 only | global | user region | multiple | multiple |
| **Session cap** | none | none | none | none | none | none | not documented | **1 h on Hobby** |
| **Best for** | agent dev box | sandbox API + SSH | cheapest dev box | agent boxes, idle-heavy | DIY microVMs | dev environments | serverless bursts | code execution |

Notes: Daytona runs **Linux containers by default** and offers VM sandboxes
with a dedicated kernel ([sandboxes](https://www.daytona.io/docs/en/sandboxes/)).
Upstash Box is a Docker container with its own filesystem and SSH access
([shell](https://upstash.com/docs/box/overall/shell)). Modal documents no shell
access, so it is not a boat replacement. E2B's Hobby tier caps a session at one
hour ([pricing](https://e2b.dev/pricing)); E2B's public rate table prices vCPU
only, so its RAM bill is on top of that and its true hourly rate is higher than
the figure shown.

## Cost model — three months of use

Assumptions: USD list prices, no tax, disk kept for the whole month. Sprites is
billed on *measured* CPU and RAM, modeled here at 60% of allocated vCPU and
full allocated RAM (an upper bound). Upstash is modeled at 50% CPU
utilization. Agent37 is the standard gVisor tier unless marked VM. Daytona
reserves vCPU and RAM for the whole active period and bills disk while stopped.

| Workload | boat | Fly Sprites | Daytona | Agent37 gVisor | Agent37 VM | Upstash Box | Fly Machines | Namespace |
|---|---|---|---|---|---|---|---|---|
| **A** 2 vCPU / 4 GB, 40 h, 10 GB | **$20** (usage $0.72) | $5.81 | $7.41 | $1.14 | $1.50 | $3.00 | $5.17 | $11.60 |
| **B** 4 vCPU / 8 GB, 173 h, 20 GB | **$20** (usage $6.23) | $48.92 | $58.87 | $3.89 | $7.01 | $19.30 | $34.71 | $45.52 |
| **C** 4 vCPU / 8 GB, 730 h, 20 GB | $26.28 | $205.17 | $243.35 | $10.60 | $23.80 | $75.00 | $136.81 | $179.20 |

Reading it:

- **A light month (A): the floor is the whole bill.** boat charges $20 for work
  that costs $0.72 on its own meter, and every zero-floor option above bills
  less than $20. Agent37 is 17x cheaper, at $1.14.
- **A working week at 4 vCPU / 8 GB (B): the floor stops mattering.** Only
  Agent37 ($3.89) and Upstash at 50% CPU ($19.30) come in under the $20 plan;
  Sprites ($48.92), Daytona ($58.87), Fly Machines ($34.71) and Namespace
  ($45.52) all cost more than paying boat's floor for a full month.
- **Always-on (C): boat wins outright.** $26.28 against $205 on Sprites and
  $243 on Daytona. Agent37's shared gVisor tier is the only zero-floor option
  under boat, and it is shared CPU by design.
- **The crossover is ~$20 of boat VM time**, i.e. 555 h of `default` or 1,111 h
  of `small` per month.

## Breakeven — active hours of a 4 vCPU / 8 GB box to reach boat's $20

| Provider | $/h | Hours to $20 | Verdict |
|---|---|---|---|
| Agent37 (gVisor) | $0.0121 | 1,660 | never reaches it in a month |
| Agent37 (VM) | $0.0301 | 664 | barely reaches it at 24/7 |
| Upstash Box (50% CPU) | $0.1000 | 200 | cheap until it is not |
| Fly Machines `performance-4x` | $0.1833 | 109 | 2.7 working weeks |
| Fly Sprites (60% CPU) | $0.2674 | 75 | 1.9 working weeks |
| Daytona | $0.3312 | 60 | 1.5 working weeks |
| Modal (after $30 credit) | $0.4759 | 105 | credit does the work |
| Namespace S devbox | $0.2400 | 83 | 2 working weeks |

## Picks

| If you want... | Pick | Why |
|---|---|---|
| boat's exact shape, zero floor | **Fly Sprites** | persistent ext4, console, checkpoints, sleeps to $0 |
| the smallest bill, shared CPU is fine | **Agent37** | $1.14 for a 40-hour month at 2 vCPU / 4 GB |
| a real sandbox API, SSH, $200 free | **Daytona** | per-second, persistent by default, VM class |
| memory-free idle boxes, already on Upstash | **Upstash Box** | $0 floor, $0.05/core-hour, SSH, freezes at $0 |
| your own dev box only | **Hetzner CX33** | €8.99/mo cap, €0.0144/h, no API (see below) |
| you really do use >555 h/mo | **stay on boat** | $0.036/h for 4 vCPU / 8 GB has no rival |

## Options with a floor (skip unless the floor is smaller)

| Provider | Floor | What it is | Verdict |
|---|---|---|---|
| boat | $20/mo | prepaid VM time, expires monthly | the one to escape |
| Vercel Sandbox | $20/mo Pro | usage charged against the $20 credit | same floor, worse rate |
| E2B Pro | $150/mo | 24 h sessions, 100 concurrent | 7.5x boat's floor |
| exe.dev | $15/mo | pooled 2 vCPU / 4 GiB, 50 VMs | smallest floor, still a floor |
| Cloudflare Sandboxes | $5/mo Workers Paid | containers, memory billed on provisioned size | fine if already on Workers |
| Hetzner Cloud | none | plain VM, hourly, monthly cap | cheapest of all, DIY |

The Hetzner numbers, since it is the real "pay as I use" answer for a single
dev box: CX33 (4 vCPU / 8 GB / 80 GB) is **€8.99/month capped, €0.0144/hour**,
and the bill never exceeds the cap
([pricing](https://www.hetzner.com/cloud/cost-optimized/)). CX23 (2 vCPU / 4 GB)
is €5.99 capped but listed as currently unavailable on that page. What you give
up is everything boat sells: no API, no snapshots, no fork, no per-agent
isolation. It is one VM you administer.

## Gotchas

- **boat's plan credit expires monthly.** Overages are paid from a wallet that
  never expires; the plan itself does not roll over. Running out mid-month
  leaves you paying list rates out of the wallet, which is still $0.036/h.
- **Sprites bills memory while awake.** An agent that keeps 8 GB resident and
  never idles costs $16/GB-month in RAM alone. The $0 story depends on the
  idle detector: an open TCP connection, stdout output, or a running task resets
  it ([Sprites](https://fly.io/sprites)).
- **Sprites' plan story is inconsistent.** The pricing page says "no plans and
  no tiers", while an older Fly post lists concurrency tiers starting at $20/mo
  (Adventurer) ([pricing](https://sprites.dev/pricing),
  [plans post](https://community.fly.io/t/more-sprites-plans/26857)). Confirm on
  the dashboard before assuming the $0 floor.
- **Agent37 bills an awake instance even when the CPU is idle.** Compute
  stops when the sandbox sleeps, so auto-sleep has to be on, and the disk is
  billed for as long as you keep it.
- **Agent37's cheap tier shares host CPU.** Its own docs say sustained heavy CPU
  can be limited on busy hosts, and a full VM costs 2.5x the compute rate
  ([vs exe.dev](https://www.agent37.com/solutions/agent37-vs-exe-dev)). The
  vendor also publishes the comparison that ranks itself first; treat its
  benchmark rows as marketing.
- **Daytona bills disk while stopped** and defaults to containers. VM sandboxes
  give you the kernel; the rate card publishes vCPU/GiB rates plus a Windows
  surcharge ([billing](https://www.daytona.io/docs/en/billing/)).
- **Upstash is one region** (AWS us-east-1) and has no custom Docker images yet
  ([pricing](https://upstash.com/pricing/box)).
- **E2B's $100 is one-time, not monthly**, and Hobby sessions cap at one hour.
  It is a code-execution API, not a dev box.
- **Modal's $30 is recurring**, which makes light use genuinely free, but the
  sandbox rate is 3x list and there is no shell.
- **Namespace Devboxes are dev environments.** One per user on the free plan,
  auto-shutdown after 15 minutes, storage billed on used bytes
  ([pricing](https://namespace.so/pricing)).
- **Free tiers move.** Every number here was read from the vendor page on
  2026-10-29; re-check before committing.

## Open Questions

- Whether Sprites' pay-as-you-go tier has an unpublished monthly minimum in
  practice; the pricing page says no, and the plan table starts at $20 for
  concurrency, but the dashboard is the only place to confirm.
- Agent37's real throughput under sustained load. No independent benchmark of
  the gVisor tier was found, and the VM tier is new.
- Daytona's Linux VM rate relative to its container rate. The pricing page shows
  one rate card, so VM pricing is inferred, not confirmed.

## Changelog

- 2026-10-29: created. All pricing read from vendor pages via TinyFish on the
  same day. Cost model derived from those rates; no vendor calculator used.

## See also

- [Upstash Box vs Cloudflare Sandboxes](./upstash-box-vs-cloudflare-sandbox.md) — the two-container comparison with the full Cloudflare per-shape cost model this file reuses.
- [Pi Sandbox Integration — Fork Pi or Build Extensions?](../technology/pi-sandbox-integration-fork-vs-extension.md) — where a remote sandbox handle plugs into pi.
- [Agent 37 vs Upstash Box](./ai-agent-sandbox-comparison.md) — the two zero-floor columns here, now in a four-way table with boat itself, with the shared-vCPU caveat priced.
- [Open-Source Grok Bot Alternatives](../technology/open-source-grok-bot-alternatives.md) — sandbox provider interfaces worth copying.
