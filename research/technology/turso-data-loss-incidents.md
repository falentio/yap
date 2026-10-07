---
title: Turso Data Loss & Data Exposure Incidents — Deep Dive
category: technology
tags: [turso, libsql, database, incidents, data-loss, data-leak, reliability, postmortem]
status: complete
created: 2026-10-07
updated: 2026-10-07
sources:
  - https://blog.val.town/post-mortem-sqlite-data-sharing
  - https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7
  - https://news.ycombinator.com/item?id=42806343
  - https://x.com/tobias_petry/status/1882322750909661549
  - https://turso.tech/blog/prevent-accidental-deletes-with-database-and-group-delete-protection
  - https://turso.tech/blog/turso-aws-out-of-beta
  - https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap
  - https://status.turso.tech/incidents
  - https://turso.tech/blog/turso-is-joining-supabase
  - https://forum.atuin.sh/t/libsql-turso-as-the-backend-db/989
confidence: medium
---

# Turso Data Loss & Data Exposure Incidents — Deep Dive

Deep dive into the Atuin project's claim that *"Turso has had multiple publicly
acknowledged data loss incidents"* ([forum.atuin.sh](https://forum.atuin.sh/t/libsql-turso-as-the-backend-db/989)),
first surfaced in `turso-production-reliability.md`.

## TL;DR

- **The claim is directionally true, but "data loss" and "publicly acknowledged" are
  both slightly imprecise.** There are **three distinct incidents**, not one:
  - **2023-10-17 → 2023-11-20** — **data exposure** (not loss): a Turso multitenancy bug
    routed every Val Town user's queries to one shared database. Confirmed by Turso's CEO.
  - **2023-12-04** — **data leak + data loss**: a bad migration gave some free-tier DBs a
    shared/empty backup ID. Officially acknowledged with a full post-mortem.
  - **2025-01-22/23** — **data loss**, user-reported: a customer on Turso's **AWS beta
    region** lost ~30k messages / ~5k users. **No official Turso post-mortem was found.**
- **So the accurate statement is: at least one officially-acknowledged data *loss*
  incident (Dec 2023), one officially-acknowledged data *exposure* incident (Nov 2023), and
  one credible but un-post-mortemed data *loss* incident (Jan 2025).**
- **The recurring root cause is the same: a migration/configuration change broke a
  per-tenant isolation invariant.** Both the Nov 2023 and Dec 2023 incidents came from a
  deploy that silently invalidated an assumption baked into existing databases.
- **Turso's response pattern is transparent and remediation-oriented** — it publishes
  detailed post-mortems, shipped **Delete Protection** (Apr 2025), and took AWS out of beta
  (Mar 2025) — but the incidents themselves cluster in the **multitenancy/backup layer**,
  which is exactly the layer a production user depends on.
- **Material new development (2026-10-02): Supabase is acquiring Turso.** This adds
  vendor/roadmap risk on top of the incident history — see §5.

## Context

The parent file asserted "a 2023-12-04 data leak + data loss incident" and noted Atuin's
"multiple incidents" claim without verifying it. This file verifies it, catalogues **every**
publicly documented incident, identifies the shared root cause, and assesses what it means
for a production adopter.

## Findings

### 1. The three incidents

#### Incident A — Val Town data sharing (2023-10-17 → 2023-11-20)

**Type:** data **exposure** (cross-tenant), not data loss.
**Source:** [Val Town post-mortem](https://blog.val.town/post-mortem-sqlite-data-sharing).

Val Town launched a SQLite integration on a Turso **multitenancy private beta**. On
2023-10-17 a Turso update changed how it distinguished a *group* database from an
*individual* database, relying on a flag that was never set on Val Town's early-created
group. Result: **all users' queries hit the same SQLite database** — "all data was shared,
visible and mutable, to any customer" for ~5 weeks (Oct 17 – Nov 20). It went unnoticed until
Val Town built a schema explorer and saw tables they hadn't created.

Turso's CEO Glauber Costa is quoted directly in the post-mortem: *"even one of our users
having an issue like this is one too many, even if in private beta."* Turso assured Val Town
it affected no other customers (Val Town was the only one on the groups feature that early).

> **Relevance:** this is the earliest evidence of the failure class that recurs — **a
> deploy invalidating an isolation invariant on pre-existing databases.**

#### Incident B — Free-tier data leak and loss (2023-12-04)

**Type:** data **leak + loss**.
**Source:** [Turso post-mortem](https://turso.tech/blog/incident-2023-12-04-data-leak-and-loss-in-some-free-tier-databases-7cba5bc7).

**What happened:** A code change on 2023-11-20 allowed an **empty backup identifier** to be
used. A migration then caused some databases to be created with that empty ID, so they all
pointed at a shared backup location (`s3://bucket//` instead of `s3://bucket/<backup_id>/`).
On 2023-12-01, internal procedures recreated some databases from those backups. **0.07% of
databases under management** were affected.

**Impact:** two-fold — a **data leak** (databases sharing a backup bucket could see each
other's data) and **data loss** (the conservative fix restored affected DBs from the
December 1st backup, discarding any writes made after that point).

**Root cause:** a bug in the database-migration process that produced an invalid backup ID,
combined with free-tier scale-to-zero (after 1h idle) recreating machines from S3 backups.
When fly.io couldn't restore a process, the machine was recreated from the (wrong, shared)
backup.

**Remediation Turso committed to:** control-plane and data-plane checks that a backup belongs
to the correct database; improved data isolation in backups; stricter config validation with
self-healing/alerting; safer deployment methods; a security reporting channel
(`security@turso.tech`).

> **Relevance:** this is the **one clearly, officially acknowledged data loss incident** —
> the strongest support for the Atuin claim. Notably it hit **free tier**, which is why some
> adopters discounted it; but the *mechanism* (migration → bad backup ID → recreate) is
> plan-agnostic.

#### Incident C — AWS beta region data loss (2025-01-22/23)

**Type:** data **loss**, reported by a customer.
**Sources:** [HN submission](https://news.ycombinator.com/item?id=42806343) (title: *"Turso
Cloud experienced an incident that resulted in customers losing their data"*),
[@seatedro tweet](https://x.com/tobias_petry/status/1882322750909661549).

A user (@seatedro) reported: *"just lost all the data in my turso dbs lol — all archival data
is gone now. around ~30k messages, ~5k users all gone because i didn't know to not choose aws
while creating my account..."* A quote-tweet framed the sequence sarcastically: Turso
announced consolidation onto AWS, then two days later the user was told the database was
"declared as beta — you should have used fly."

**Corroborating context:** Turso's own [AWS out-of-beta post](https://turso.tech/blog/turso-aws-out-of-beta)
(2025-03-17) confirms AWS regions were **beta until March 2025** — consistent with the
"declared as beta" response and placing this incident in the beta window.

> **Confidence caveat:** this incident is **user-reported**. I found **no official Turso
> post-mortem** for it, and the status page archive does not list it. Treat the specifics
> (~30k messages, ~5k users, cause) as `confidence: low`; the *occurrence* of a
> reported data-loss event in Jan 2025 is `confidence: medium` (multiple independent
> secondary sources, including an HN submission).

### 2. Availability incidents (separate from data loss)

For completeness, the availability incidents are distinct from the data incidents:

| Date | Type | Impact | Source |
|------|------|--------|--------|
| 2026-05-08 | AWS US-EAST-1 outage | Some DBs affected | [status](https://status.turso.tech/incidents) |
| 2026-05-22 | Turso API unavailable | Resolved same day | status |
| 2026-08-04 | Elevated 502s; server down → retry cascade → routing overload | ~30 customers | status |

No incidents were reported Sep–Oct 2026.

### 3. The shared root cause — a pattern, not three accidents

| Incident | Trigger | Broken invariant | Blast radius |
|----------|---------|------------------|--------------|
| A (2023-10) | Deploy changed group/DB detection | "This DB is its own tenant" | All Val Town tenants |
| B (2023-12) | Migration wrote empty backup ID | "This backup belongs to this DB" | 0.07% of DBs |
| C (2025-01) | AWS region in beta | "This DB is durable" | ≥1 customer (reported) |

**Every incident is a control-plane / isolation-invariant failure, not an engine bug.**
The SQLite/libSQL engine itself was not the culprit in any of them. That is both reassuring
(the hard part — the database engine — is solid) and concerning (the *operational* layer
around it has a track record of silently breaking isolation assumptions on existing
databases during migrations and deploys).

> **Production implication:** the risk is concentrated in **database provisioning,
> migration, backup, and tenant-isolation**, which is precisely the layer you outsource when
> you adopt a managed service. Mitigate by (a) taking your own dumps, (b) enabling Delete
> Protection, (c) avoiding beta regions/features, and (d) testing tenant isolation yourself.

### 4. Turso's response pattern

Positives:

- **Publishes detailed, blame-free post-mortems** (Incident B is a model write-up with root
  cause, timeline, and concrete remediations).
- **Shipped Delete Protection** (Apr 2025) for databases and groups across dashboard, CLI,
  and Platform API — [announcement](https://turso.tech/blog/prevent-accidental-deletes-with-database-and-group-delete-protection).
  This directly targets accidental/mistaken deletion (though not the backup-ID class of bug).
- **Took AWS out of beta** (Mar 2025), which is the specific context of Incident C.
- **Runs deterministic simulation testing** (Antithesis) on the newer stack, per the
  [diskless post](https://turso.tech/blog/turso-cloud-goes-diskless).

Negatives:

- **Incident C has no published post-mortem** that I could find, despite an HN thread —
  a gap in the transparency record.
- **Incident A was found by the customer**, not by Turso, and had persisted for ~5 weeks.
- Incidents **cluster around migrations** — the same class twice within ~2 months in 2023.

### 5. Material update: Supabase is acquiring Turso (2026-10-02)

**Source:** [Turso announcement](https://turso.tech/blog/turso-is-joining-supabase).

Supabase announced on **2026-10-02** it is acquiring Turso, alongside a **$150M** raise led by
GIC. Glauber Costa joins Supabase as Head of Agentic Services. Stated commitments:

- *"Turso keeps running. Your databases, APIs, and workflows continue as they do today."*
- *"Turso Database remains open source and actively developed."*
- A "graduation path" from SQLite/Turso → Supabase Postgres as workloads grow.

**Caveats relevant to production** (per [Layerbase analysis](https://layerbase.com/blog/supabase-acquires-turso),
which is a competitor and should be weighed as such, but whose factual claims are sourced):

- **No price and no closing date disclosed**; the wording is "is acquiring."
- **No commitment about future pricing** — "nothing changes" is a statement about today.
- **libSQL is not mentioned** in the announcement and was reportedly already in maintenance
  mode, with new work going to the Rust rewrite. The acquisition doesn't reverse that.
- **Roadmap direction points toward Postgres** — SQLite positioned as a funnel entry point.

> **Net effect on the production decision:** adds **vendor/roadmap risk** on top of the
> incident history. Not a reason to panic-migrate, but a reason to keep data portable.

### 6. Verdict on the Atuin claim

| Claim component | Verdict |
|-----------------|---------|
| "Turso has had incidents" | **True.** Three documented (2023-10, 2023-12, 2025-01). |
| "...data loss incidents" | **Partly true.** One official loss (2023-12), one reported loss (2025-01). 2023-10 was exposure, not loss. |
| "...multiple" | **True** if you count loss + exposure together; **weakly true** for loss alone (1 official + 1 reported). |
| "...publicly acknowledged" | **True for 2023-12** (full post-mortem) and **2023-10** (CEO quoted). **Not verified for 2025-01** — no official post-mortem found. |

**Most defensible restatement:** *"Turso has had at least one publicly acknowledged data loss
incident (Dec 2023) and one publicly acknowledged cross-tenant data exposure incident (Nov
2023), both caused by control-plane migrations, plus a credible user-reported data loss event
in its AWS beta region (Jan 2025) for which no official post-mortem was published."*

## Open Questions

- Does an official Turso post-mortem exist for the **Jan 2025** incident? (Not found;
  may be on Discord/X only.) `[unverified]`
- How many customers were affected by Incident C? Only one is publicly identified.
- What did the **Antithesis deterministic simulation testing** migration actually change,
  and does it cover the migration/backup-ID class of bug? (Claimed for the *new* stack.)
- Will Delete Protection (Apr 2025) also cover programmatic/migration-induced loss, or only
  user-initiated deletes? `[unverified]`
- Post-acquisition: what happens to libSQL's maintenance and to Turso Cloud pricing?

## Related

- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md) — parent assessment.
- [Supabase](../product/README.md) — acquirer; a product-level note could live here if this becomes a stack decision.

## Changelog

- 2026-10-07 — created. Researched via TinyFish (`mcp__tinyfish__search` /
  `mcp__tinyfish__fetch_content`). Verified the "multiple data loss incidents" claim:
  found three incidents (2023-10 exposure, 2023-12 leak+loss, 2025-01 reported loss) and the
  2026-10-02 Supabase acquisition.
