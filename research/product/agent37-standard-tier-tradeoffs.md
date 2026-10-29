---
title: Agent 37's Standard Tier — Why It Is So Cheap and What You Trade Away
category: product
tags: [agent37, sandbox, pricing, gvisor, oversubscription, unit-economics]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://www.agent37.com/pricing
  - https://www.agent37.com/compare/upstash-box
  - https://www.agent37.com/blog/claude-agent-sdk-sandbox
  - https://www.ycombinator.com/companies/agent-37
  - https://www.techtickertimes.com/news/launch-hn-agent37-yc-f26-low-cost-agent-sandboxes-for-running-agents
  - https://gvisor.dev/docs/architecture_guide/performance/
  - https://www.hetzner.com/cloud/cost-optimized/
  - https://aws.amazon.com/ec2/pricing/on-demand/
  - https://krova.cloud/blog/agent-sandbox-comparison-krova-e2b-modal-fly
confidence: medium
---

# Agent 37's Standard Tier — Why It Is So Cheap and What You Trade Away

Asked 2026-10-29, after the five-way comparison
([AI Agent Sandboxes Compared](./ai-agent-sandbox-comparison.md)) put Agent 37's
standard tier below every other vendor on every workload it costed. This
file is the mechanism and the bill of goods.

## TL;DR

- **The price is $0.80 per vCPU-month and $0.70 per GB-month of *uptime*, not of
  CPU.** Nothing in the meter counts CPU seconds, so an agent that spends 94% of
  its wall clock waiting on a model — the normal shape — costs the same as one
  that pins a core.
- **That price is below the list cost of the cheapest shared vCPU on the
  market.** A Hetzner CX33 (4 vCPU / 8 GB, itself oversubscribed) is €8.99/month
  ≈ $9.80, or $2.45 per vCPU-month; Agent 37 charges $0.80. EC2 `c6a.xlarge` is
  $27.92/vCPU-month, 35× the price. **The vCPU you buy cannot be a reserved
  core.**
- **So the tier is a burst entitlement on a densely packed host.** Agent 37 says
  it outright: standard sandboxes "share host resources" and "sustained heavy
  CPU use may be limited on busy hosts"
  ([comparison page](https://www.agent37.com/compare/upstash-box),
  [blog](https://www.agent37.com/blog/claude-agent-sdk-sandbox)). A third-party
  write-up says the density comes from bare-metal hosts at Hetzner and OVH
  rather than hyperscalers ([TechTicker](https://www.techtickertimes.com/news/launch-hn-agent37-yc-f26-low-cost-agent-sandboxes-for-running-agents)) —
  reported, not confirmed by the vendor.
- **The trade is: money for predictability.** You give up a throughput floor, an
  owned kernel, Docker on the standard tier, and vendor maturity. The ladder
  prices the contention explicitly — 2.5× for a full VM, 4× for reserved cores —
  and even the 4× tier is a ninth of EC2.

## The price, decomposed

Per-minute uptime, billed from a prepaid wallet, disk billed while retained
([pricing](https://www.agent37.com/pricing)):

| Shape | vCPU line | RAM line | Disk (10 GB) | Month at 730 h | Effective rate |
|---|---|---|---|---|---|
| 2 vCPU / 4 GB | $1.60 | $2.80 | $0.90 | **$5.30** | $0.0060/h |
| 4 vCPU / 8 GB | $3.20 | $5.60 | $0.90 | **$9.70** | $0.0121/h |
| 8 vCPU / 16 GB | $6.40 | $11.20 | $0.90 | **$18.50** | $0.0241/h |

Two things to notice. RAM is **58% of the 4/8 bill** (64% of compute) — this is not a CPU-only
product, and the shape doubles the price exactly. And the month price only
applies to a box left running; a 100-hour month on the 2/4 shape is **$0.60 of
compute plus $0.90 of disk**, which is where the "94% cheaper" headlines come
from.

## Why it can be that cheap

### 1. Uptime is the meter, and agent uptime is mostly idle

An agent loop that thinks for 30 seconds between two-second commands is idle
about 94% of the time. On an uptime meter that idle time is billed but not
consumed, so the provider can sell the same core to many tenants and still meet
every tenant's demand — as long as their busy moments do not collide. This is
the same observation Upstash makes to justify its CPU meter
([vs E2B](https://upstash.com/blog/upstash-box-vs-e2b)), read from the other
side: Upstash meters CPU so it can charge for the 6% that matters; Agent 37
meters uptime so it can *oversubscribe* the 94% that does not.

### 2. Containers on shared hosts, not VMs

The standard tier is a gVisor sandbox on a shared host, not a machine. There is
no per-tenant kernel to schedule, no boot, no hypervisor memory tax — create is
1.29 s and wake is 176 ms in the vendor's own telemetry
([comparison](https://www.agent37.com/compare/upstash-box)) — so density is
limited by CPU and RAM budgets rather than by hypervisor overhead. That is what
makes a $0.80 vCPU-month arithmetically possible; a VM at that price would be
selling hardware below cost.

### 3. Capacity bought where compute is cheapest

Agent 37 documents no regions, which is itself informative
([docs](https://www.agent37.com/docs)). A third-party summary states they run on
bare-metal providers such as Hetzner and OVH "to eliminate margin bloat"
([TechTicker, 2026-10-12](https://www.techtickertimes.com/news/launch-hn-agent37-yc-f26-low-cost-agent-sandboxes-for-running-agents)).
If true, the host cost per vCPU is roughly $2.45 (Hetzner list) instead of
$27.92 (EC2 list) — a full order of magnitude of margin to give away before
touching density.

### 4. The tier ladder prices the contention away

Same vendor, three prices for the same core:

| Tier | Compute multiplier | 4 vCPU / 8 GB, compute | What it buys |
|---|---|---|---|
| Standard | 1× | $8.80 | Shared host, burstable |
| VM (`agent37-ubuntu`) | 2.5× | $13.60 | Own kernel, Docker, no systemd |
| Performance | 4× | $18.40 | Reserved cores |

Disk is $0.90 on top of every row. The ladder is the honest part of the pricing: it tells you what escaping the
contention costs. The footnote that is easy to miss is that the 4× reserved
tier is still **$3.20/vCPU-month**, one ninth of EC2 — so even "reserved" is a
commitment on shared infrastructure, not a dedicated machine.

### 5. The sandbox may not be the whole business

The wallet pays for managed models, search, Composio integrations and Perflo
tool calls as well as compute, with a per-sandbox spend cap and BYOK to opt out
([home](https://www.agent37.com/)). The company is a Y Combinator Fall 2026
startup offering $1,000 plus a dollar-for-dollar match up to $10,000 in credits,
and a standing "find a cheaper sandbox and we'll refund the difference" promise
([YC](https://www.ycombinator.com/companies/agent-37),
[pricing](https://www.agent37.com/pricing)). Cheap compute with an attached
metered toolbelt and a land-grab credit program is a coherent strategy — that
reading is mine, not the vendor's.

## The arithmetic that forces the conclusion

| Capacity source | List price | Per vCPU-month | vs Agent 37's $0.80 |
|---|---|---|---|
| Hetzner CX23, 2 vCPU / 4 GB | €5.99 ≈ $6.53 | $3.26 | **4.1×** |
| Hetzner CX33, 4 vCPU / 8 GB | €8.99 ≈ $9.80 | $2.45 | **3.1×** |
| DigitalOcean Basic, 4 vCPU / 8 GB | $48.00 | $12.00 | 15× |
| AWS `c6a.xlarge`, 4 vCPU / 8 GB | $111.69 | $27.92 | 35× |

EUR converted at €1 ≈ $1.09; all prices are list, monthly, and include the
whole box rather than compute alone.

The bottom row is the one that matters: **Agent 37's revenue for a fully loaded
4 vCPU / 8 GB tenant ($8.80) is 90% of a Hetzner CX33's list price for the
equivalent box.** Before gVisor's overhead, egress, control plane, support and
margin, one tenant per box loses money. Therefore one of two things is true per
tenant: agents use far less than their allocation (they do), or the provider is
buying capacity well below list (likely). Either way, **the 4 vCPU is a burst
ceiling, not a reservation.**

## What you give up

| Trade-off | Evidence | How bad | Mitigation |
|---|---|---|---|
| **No throughput floor** | "Sustained heavy CPU use may be limited on busy hosts" — vendor copy | The one that bites; a CI job or build at 2 a.m. is fine, a fleet pegging cores at 9 a.m. is a lottery | Benchmark p95 on your own workload; use Performance or VM for CPU-dense work; keep a second vendor |
| **gVisor syscall cost** | gVisor's own guide lists "structural costs" (Sentry syscall path, extra memory) and "implementation costs" (less CPU-efficient network stack, not every syscall optimised) | Fork/exec-heavy builds, many-small-file reads and high packet rates cost more CPU — on a shared host that is what triggers contention | Test the image's real workload; avoid it for packet-heavy or syscall-heavy services |
| **No Docker or own kernel on standard** | VM tier only; `agent37-ubuntu` has Docker, no systemd | Blocks Docker-in-Docker, eBPF, kernel modules, some build systems | VM tier at 2.5× — still cheaper than most rivals |
| **Uptime bills while awake** | Auto-sleep is a toggle, not a default | Debugging an idle box for a weekend costs a month's price | Enable auto-sleep; stop boxes in CI teardown |
| **Young vendor** | YC Fall 2026, founded 2026, SOC 2 **Type I**, no regions, no published concurrency ceiling, no SLA I could find | Exit risk and procurement friction; Type I is a snapshot, not a period audit | Snapshot/export disk; plain HTTPS/JSON API keeps the client portable |
| **Benchmarks are self-published** | Every latency number sits on a page that ranks Agent 37 first against a named rival | Directionally plausible, not neutrally measured | Treat as marketing; measure your own create/exec |
| **Small-model dependence** | Managed models inside the wallet, spend caps per box | Single-vendor bill for compute and tokens | BYOK for models |
| **Price promise is marketing** | "Find a cheaper sandbox, we'll refund the difference" | Not a contractual performance guarantee | Read the terms before relying on it [unverified] |

## Who it fits

- **Fits:** always-on per-customer agents that mostly wait on a model; preview
  boxes; prototypes and demos; batched agent runs with generous deadlines;
  anything where a 2–5× latency spike is survivable and the bill is not.
- **Does not fit:** CI runners with hard time budgets, CPU-dense builds,
  packet-heavy services, Docker-in-Docker without the VM tier, regulated buyers
  who need Type II plus a named region, or anyone who cannot tolerate a 2026
  startup as a dependency.

## How to de-risk

1. Measure, don't assume: run a week of real traffic and record p95 latency and
   CPU-time per job, not just the bill.
2. Turn on auto-sleep before the first bill; stop boxes in teardown.
3. Move anything that pegs a core to the Performance or VM tier — the 4×
   multiplier is still 1/9 of EC2.
4. Keep a second provider behind a thin adapter; the API is plain HTTPS/JSON,
   so the client is not the lock-in, the disk image is.
5. Snapshot the workspace before you depend on it; disk is the only thing you
   cannot rebuild from source.

## Open Questions

- What is the actual guaranteed CPU share per standard sandbox? Not published.
- What density do they run per host, and what is the p99 CPU-steal under load?
  No independent benchmark found.
- Do the credits ($5, $1,000 + match, price-match refund) survive past the
  growth phase? [unverified]
- Is the Hetzner/OVH sourcing claim accurate? Only a secondary source states it.
  [unverified]

## Related

- [AI Agent Sandboxes Compared — Agent 37, Upstash Box, boat.dev, Cloudflare](./ai-agent-sandbox-comparison.md) — the four-way pricing, including the 4 vCPU / 8 GB shape table these numbers come from.
- [boat.dev Alternatives — Pay-As-You-Go Sandboxes With No Monthly Minimum](./boat-dev-pay-as-you-go-alternatives.md) — the same shared-tier caveat placed against eight other meters.
- [Upstash Box vs Cloudflare Sandboxes — Price Comparison](./upstash-box-vs-cloudflare-sandbox.md) — why a consumed-CPU meter behaves the opposite way.

## Changelog

- 2026-10-29 — created. Hardware cost per vCPU derived from Hetzner, DigitalOcean
  and EC2 list prices at €1 ≈ $1.09. The Hetzner/OVH sourcing claim and the
  "guaranteed share" question are flagged as unverified; everything else is
  vendor-published or arithmetic from it.
