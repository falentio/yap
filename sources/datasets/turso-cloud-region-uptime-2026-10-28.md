---
title: Turso Cloud Region Uptime Snapshot — 2026-10-28
category: technology
tags: [turso, uptime, status-page, reliability, datos]
status: complete
created: 2026-10-28
updated: 2026-10-28
sources:
  - https://status.turso.tech/
confidence: medium
---

# Turso Cloud Region Uptime Snapshot — 2026-10-28

Verbatim capture of the rolling uptime figures published on
[status.turso.tech](https://status.turso.tech/) on **2026-10-28**. Status pages
overwrite rolling windows, so this snapshot is the only durable copy of the
numbers cited in
[turso-production-reliability.md](../../research/technology/turso-production-reliability.md).

## Method

- Source: `https://status.turso.tech/`, read 2026-10-28 16:33 UTC.
- Columns are the three rolling windows the page publishes, in page order:
  **30 days ago**, **60 days ago**, **90 days ago**.
- A longer window dilutes a single outage, so a 90-day figure can exceed the
  60-day figure. Read the 30-day column as the most recent signal.
- The page publishes a "Global" section (per-city probes) and a separate
  per-AWS-region section. They are not the same measurement; see the caveat.

## AWS region monitors

| AWS region | 30d | 60d | 90d |
|---|---|---|---|
| us-east-1 (N. Virginia) | 100% | 100% | 99.987% |
| us-east-2 (Ohio) | 100% | — | — |
| us-west-2 (Oregon) | 100% | 100% | 99.986% |
| ca-central-1 | 100% | — | — |
| sa-east-1 | 100% | — | — |
| eu-west-1 (Ireland) | 100% | — | — |
| eu-north-1 (Stockholm) | 100% | — | — |
| ap-northeast-1 (Tokyo) | 100% | 99.992% | 99.995% |
| ap-south-1 (Mumbai) | 100% | — | — |
| ap-southeast-2 (Sydney) | 100% | — | — |

A dash means the page rendered only one figure for that region.

## "Global" probes (per-city, database deployed in all regions)

| City | 30d | 60d | 90d | 30d downtime |
|---|---|---|---|---|
| Singapore | 99.701% | 99.851% | 99.901% | ~2h 09m |
| Johannesburg | 99.705% | 99.853% | 99.902% | ~2h 07m |
| Los Angeles | 99.811% | 99.906% | 99.937% | ~1h 22m |
| Stockholm | 99.817% | 99.909% | 99.939% | ~1h 19m |
| London | 99.873% | 99.936% | 99.957% | ~55m |
| Toronto | 99.877% | 99.939% | 99.959% | ~53m |
| Sydney | 99.914% | 99.957% | 99.971% | ~37m |
| Dallas | 99.938% | 99.969% | 99.979% | ~27m |
| Secaucus, NJ | 99.952% | 99.976% | 99.984% | ~21m |
| Amsterdam | 99.953% | 99.976% | 99.984% | ~20m |
| Tokyo | 99.964% | 99.982% | 99.957% | ~16m |
| Chicago | 99.972% | 99.986% | 99.991% | ~12m |
| Ashburn, VA | 99.974% | 99.987% | 99.991% | ~11m |
| Frankfurt | 99.978% | 99.989% | 99.992% | ~10m |
| Paris | 99.980% | 99.990% | 99.993% | ~9m |

Downtime column is computed: `(1 - uptime) x 720h`.

## Incidents visible on the page

| Date | Scope | Statement | Duration |
|---|---|---|---|
| 2026-10-26 | AWS us-east-1 | "A malfunctioning load balancer in us-east-1 caused intermittent timeouts." | 1h 40m |
| 2026-10-16 | Fly regions | Degraded; databases on Fly back to healthy 2026-10-17 09:31 UTC | ~1 day |
| 2026-08-04 | AWS us-east-1 | Elevated 502s on database queries | 48m |

## Caveat

The page states the Global figures are "obtained by querying a database deployed
in all regions" and that "other factors like individual host failures can affect
your databases further." Turso does not publish which footprint each probe
covers, so the split between the AWS region monitors (≈99.99% at 90 days) and
the Global city probes (99.70–99.98% at 30 days) is an inference, not a stated
fact. The 2026-10-16 "Degraded for Fly regions" incident is consistent with the
degraded probes sitting in the legacy multi-region footprint.

Do not treat these as an external, independent measurement. They are vendor
self-reported. No third-party monitor with a comparable history was found;
Pulsetic reported "0 incidents on record since Jul 2026" on 2026-10-28, which
contradicts the vendor page's own 2026-10-16 and 2026-10-26 entries and is
therefore not usable as corroboration.
