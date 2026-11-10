---
title: A 30 Mbps Link for PostgreSQL — Bandwidth Is Usually Not the Wall
category: technology
tags: [postgresql, networking, bandwidth, latency, capacity-planning, replication, wal]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://www.cybertec-postgresql.com/en/postgresql-network-latency-does-make-a-big-difference/
  - https://www.enterprisedb.com/blog/postgresql-based-application-performance-latency-and-hidden-delays
  - https://dev.to/mongodb/client-server-latency-in-postgresql-and-mongodb-81h
  - https://innerjoin.bit.io/the-distance-dilemma-measuring-and-mitigating-postgres-network-latency-76f6cd1a6c57
  - https://www.percona.com/blog/how-to-measure-the-network-impact-on-postgresql-performance/
  - https://pganalyze.com/blog/5mins-postgres-improve-query-network-latency-performance-pipeline-mode-copy-tc
  - https://www.postgresql.org/docs/current/runtime-config-wal.html
  - https://www.postgresql.org/docs/current/protocol-flow.html
  - https://www.postgresql.org/docs/current/populate.html
  - https://postgres.ai/docs/postgres-howtos/performance-optimization/monitoring/how-to-reduce-wal-generation-rates
  - https://www.pgedge.com/blog/understanding-and-reducing-postgresql-replication-lag
  - https://iperf.fr/
  - https://www.thousandeyes.com/blog/caveats-of-traditional-network-tools-iperf
  - https://research.cec.sc.edu/files/cyberinfra/files/Bandwidth-delay%20Product%20and%20TCP%20Buffer%20Size.pdf
  - https://aws.amazon.com/compare/the-difference-between-throughput-and-latency/
confidence: high
---

# A 30 Mbps Link for PostgreSQL — Bandwidth Is Usually Not the Wall

Short answer: for OLTP, 30 Mbps is almost never the limit, and 30 Mbps on its own tells you very little about whether the link is usable. Postgres spends round trips, not bytes. A 30 Mbps path at 0.5 ms RTT beats a gigabit path at 50 ms RTT on every interactive workload.

Generating 30 Mbps of real Postgres traffic takes either a fast link that is already close, or a workload with genuinely large payloads. In a measured run, adding 10 ms of latency dropped a 10-client read-only `pgbench` from 8,813 TPS to 462 TPS — a 19x loss on the same wire, with no bandwidth change at all ([`tcset` + pgbench, Cybertec, 2020-05-12](https://www.cybertec-postgresql.com/en/postgresql-network-latency-does-make-a-big-difference/)).

Bandwidth binds on a different list of jobs: replication, base backups, restores, `pg_dump`, bulk `COPY`, connection churn, and any unindexed scan that has to ship its result. Those are the cases where 30 Mbps decides the schedule.

This file is the sizing arithmetic for both lists.

## What the workload actually spends

| Dimension | Point `SELECT` | OLTP transaction | Analytics scan | Bulk `COPY` in | Physical replication | `pg_dump` / `pg_basebackup` |
|---|---|---|---|---|---|---|
| Cost driver | RTT, then bytes | RTT × statements | bytes out | bytes in, plus WAL | WAL bytes | bytes out |
| Round trips per unit | 1 | ~7 (TPC-B) | 1 + fetch | ~1 | streamed | streamed |
| Payload magnitude | 0.1–1 kB | ~300 B | MB–GB | MB–GB | = primary WAL rate | = database size |
| App controls it? | yes | yes | partly | yes | no | no |
| Is 30 Mbps the wall? | no | no | often | yes | yes | yes |

Each statement is one round trip, so a seven-statement TPC-B transaction costs seven of them. With 50 ms added to a container's path, `pgbench -r` reported ~50 ms on *every individual statement* and 353 ms per transaction ([`tc qdisc` + `pgbench -r`, dev.to, 2023](https://dev.to/mongodb/client-server-latency-in-postgresql-and-mongodb-81h)).

Typical path latencies for calibration ([EnterpriseDB, 2016-05-23](https://www.enterprisedb.com/blog/postgresql-based-application-performance-latency-and-hidden-delays)):

| Path | RTT |
|---|---|
| Localhost | 0.01 ms |
| Switched LAN | ~0.5 ms |
| WiFi | ~5 ms |
| ADSL | ~20 ms |
| Intercontinental | ~300 ms |

A trivial server-side `SELECT` runs in ~0.1 ms and a trivial `INSERT` in ~0.5 ms in that same source, so above LAN latency the wire dominates every statement. San Francisco to Denver is ~10 ms round trip by the speed of light alone ([bit.io, 2022-12-08](https://innerjoin.bit.io/the-distance-dilemma-measuring-and-mitigating-postgres-network-latency-76f6cd1a6c57)).

## The byte arithmetic

30 Mbps is 3.75 MB/s. TCP/IPv4 over a 1500-byte MTU carries at most 1,460 bytes of payload per 1,540-byte frame, so ~94.8% of that is achievable before congestion control takes anything back: about 3.55 MB/s of Postgres payload.

| Quantity | At 30 Mbps |
|---|---|
| Line rate | 3.75 MB/s |
| TCP payload ceiling | ~3.55 MB/s (≈ MTU/MSS efficiency) |
| Hourly ceiling | ~12.8 GB/h |
| 20 GB `pg_dump` | ~1.6 h |
| 200 GB `pg_basebackup` | ~15.7 h |
| 1 GB scan result to the app | ~4.8 min |
| Bidirectional OLTP it can carry | ~100k statements/s at 300 B |

Header overhead is the small term. The row count is the big one: 1,000 single-row `INSERT`s/s is 1,000 round trips and 1,000 header sets for a few hundred KB. `COPY` exists precisely to collapse those — it is optimized for loading large numbers of rows and "incurs significantly less overhead" ([PostgreSQL docs 14.4](https://www.postgresql.org/docs/current/populate.html)).

Frame the per-row messages, or multiplex them, and 30 Mbps carries a great deal. Refuse both, and per-message cost binds long before bitrate does.

## Three budgets, not one

A link is sized against three separate numbers. A bandwidth figure answers only the first.

1. **Bitrate** — bytes per second. The table above.
2. **Latency** — RTT. Punishes statement count, not size.
3. **Bandwidth-delay product** — bits in flight before an ACK returns. This is the one a 30 Mbps number quietly breaks, because a slow path needs a *bigger* window to stay full.

At 30 Mbps, a 100 ms RTT needs 375 KB in flight to reach line rate. A default 64 KB TCP window allows 655,350 B/s there — **5.2 Mbps of a 30 Mbps pipe**, under a fifth of it.

| RTT | Throughput with a 64 KB window | Share of a 30 Mbps pipe |
|---|---|---|
| 1 ms | 64 MB/s (wire-bound) | 100% |
| 20 ms | 3.2 MB/s | 85% |
| 50 ms | 1.3 MB/s | 35% |
| 100 ms | 0.66 MB/s | 18% |
| 200 ms | 0.33 MB/s | 9% |

Window scaling and large socket buffers lift that ceiling. A 30 Mbps WAN link needs window scaling enabled on both ends, or it silently behaves like 5 Mbps. Bandwidth-delay product is the classic framing of the limit ([course notes, PDF](https://research.cec.sc.edu/files/cyberinfra/files/Bandwidth-delay%20Product%20and%20TCP%20Buffer%20Size.pdf)); latency and throughput measure different things and are not interchangeable ([AWS](https://aws.amazon.com/compare/the-difference-between-throughput-and-latency/)).

## Where 30 Mbps genuinely is the wall

**Physical replication.** The floor is the primary's WAL generation rate, and the standby falls behind the moment the link is under it. Insufficient bandwidth for the WAL volume is a named cause of replication lag ([pgEdge, 2024-11-22](https://www.pgedge.com/blog/understanding-and-reducing-postgresql-replication-lag)). WAL carries full 8 KB page images on the first write to each page after each checkpoint while `full_page_writes` is on ([docs](https://www.postgresql.org/docs/current/runtime-config-wal.html)), so bulk writes can emit several times the row bytes; `wal_compression` compresses only those page images ([docs](https://www.postgresql.org/docs/current/runtime-config-wal.html)).

**Backups, restores, reseeds.** `pg_basebackup` is a full copy of the cluster. A replica kicked out of streaming by a link that could not keep up re-ships one from scratch, so a marginal link adds the recovery time to its own incident.

**Bulk load.** `COPY` streams one direction with no result set. Upload-heavy links — ADSL and many 4G/5G plans are asymmetric — sit far below 30 Mbps upstream, and the download figure will not show it.

**`pg_dump` and snapshot restores.** Both are whole-database reads from the primary.

**Connection churn.** A Postgres connection is a negotiated multi-message exchange: SSL negotiation, authentication, run-time parameters, then readiness, each one or several round trips depending on the method ([protocol flow](https://www.postgresql.org/docs/current/protocol-flow.html)). Median connect time from California to a hosted database was 250 ms against 70 ms from the same metro ([bit.io](https://innerjoin.bit.io/the-distance-dilemma-measuring-and-mitigating-postgres-network-latency-76f6cd1a6c57)). A pooler on the database side removes most of that; a per-request connect over a high-RTT link does not.

## A saturated 30 Mbps raises latency too

The cap hurts twice. Once a bulk job fills the pipe the bottleneck queue fills with it, and every interactive query now waits behind kilobytes of backup payload — bufferbloat with a database attached. `ClientWrite` and `ClientRead` wait events spike as the session stops doing work and starts waiting on the socket ([Percona, 2023-07-20](https://www.percona.com/blog/how-to-measure-the-network-impact-on-postgresql-performance/)).

Segment the link, shape the bulk flows, or schedule them off-peak. Congestion control will not sort out the priority for you.

## Cutting bytes, in order of leverage

1. **Fewer statements per request.** A batch of 100 rows in one `INSERT` is one round trip instead of 100. Pipelining sends successive queries without waiting for the previous reply ([protocol flow](https://www.postgresql.org/docs/current/protocol-flow.html)); some drivers expose it, most lazily-fetching ORMs do not.
2. **Fewer rows over the wire.** Column projection instead of `SELECT *`, `LIMIT`, server-side cursors for large results.
3. **`COPY` for bulk**, loading into a fresh table before building indexes ([docs](https://www.postgresql.org/docs/current/populate.html)).
4. **Compress the WAL that must ship.** `wal_compression = zstd` or `lz4` cuts page-image volume at a CPU cost ([docs](https://www.postgresql.org/docs/current/runtime-config-wal.html)). Longer checkpoint intervals mean fewer first-writes and fewer page images to compress.
5. **A pooler next to the database.** Amortizes the connect cost; bit.io reached the same conclusion for cross-region clients.
6. **Keep the two hosts on one segment.** Cloud regions are the mechanism; if the app must sit on another continent, no amount of Mbps fixes the RTT.

Terminal latency does not negotiate. The link is only as good as the RTT it enforces.

## Verdict

| Workload | 30 Mbps, 1 ms RTT | 30 Mbps, 50 ms RTT | 1 Gbps, LAN |
|---|---|---|---|
| App tier on the same L2 segment | fine | fine | fine |
| `SELECT`-heavy app over a WAN | fine | starved on RTT, not Mbps | fine |
| Nightly 20 GB `pg_dump` | 1.6 h | 1.6 h | 3 min |
| 200 GB replica reseed | 15.7 h | 15.7 h | 30 min |
| Replica at 3 MB/s WAL | fine | lags, then needs a reseed | fine |
| Replica at 30 MB/s WAL | falls behind | falls behind | fine |
| Bulk `COPY` upload, symmetric 30 Mbps | 3.5 MB/s | 3.5 MB/s | ~100× faster |
| Bulk `COPY` upload, 3 Mbps upstream | 0.35 MB/s | 0.35 MB/s | ~300× faster |

30 Mbps is enough when the app shares the database's segment, queries are batched, bulk work is off-peak, and replication volume stays under roughly 3 MB/s. It is not enough for a replica carrying the primary's WAL volume, or for restoring a cluster on a schedule a human would call reasonable.

## Measure, do not assume

Do not derive this from a spec sheet. Run the application's own workload from the application's own host:

```bash
iperf3 -c db.example -t 30                        # capacity; repeat with -R for the reverse path
ping -c 100 db.example                            # latency; mtr for lossy hops
pgbench -S -c 10 -j 2 -T 60 -h db.example -U app db   # -S read-only; drop -S for TPC-B
```

`iperf3` measures maximum achievable bandwidth on the path ([iperf.fr](https://iperf.fr/)). Read it as a path measurement, not an application number: it overstates what survives real cross-traffic ([ThousandEyes](https://www.thousandeyes.com/blog/caveats-of-traditional-network-tools-iperf)).

In the database, `psql`'s `\timing` reports client-side elapsed time including the fetch — the number the user feels — while `EXPLAIN ANALYZE` reports server execution time without it ([pganalyze, 2022-08-25](https://pganalyze.com/blog/5mins-postgres-improve-query-network-latency-performance-pipeline-mode-copy-tc)). A large gap between the two is the network. Watch `ClientWrite` in `pg_stat_activity` for a slow drain to the client ([Percona](https://www.percona.com/blog/how-to-measure-the-network-impact-on-postgresql-performance/)).

For replication sizing, sample `pg_current_wal_lsn()` twice and subtract as `pg_lsn` for real bytes/s, or read `pg_stat_wal` ([postgres.ai](https://postgres.ai/docs/postgres-howtos/performance-optimization/monitoring/how-to-reduce-wal-generation-rates)). Size against peak, not average.

## Related

- [NAT networks](./nat-network.md) — where a Postgres host sits behind translation, and what that does to connections
- [OpenVZ trade-offs](./openvz-virtualization-tradeoffs.md) — a container host as the database side of this link
- [Syncing file changes to a remote host](./live-file-sync-to-remote-host.md) — bulk transfer over a constrained WAN link

## Changelog

- 2026-11-10 — created. The byte tables, the BDP table, and the verdict cells are the author's arithmetic, derived from the cited latencies, throughputs, and MTU math; no vendor publishes a sizing document for a 30 Mbps Postgres link. All sources fetched 2026-11-10.
