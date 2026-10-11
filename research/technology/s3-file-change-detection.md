---
title: Watching File Changes on S3 Object Storage — Most Effective Mechanisms
category: technology
tags: [s3, event-notifications, eventbridge, sqs, lambda, change-data-capture]
status: complete
created: 2026-10-09
updated: 2026-10-09
sources:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html
  - https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/
  - https://aws.amazon.com/blogs/storage/manage-event-ordering-and-duplicate-events-with-amazon-s3-event-notifications/
  - https://docs.quilt.bio/quilt-platform-administration/advanced/eventbridge
  - https://aws.amazon.com/s3/pricing/
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-inventory.html
confidence: high
---

# Watching File Changes on S3 Object Storage — Most Effective Mechanisms

## TL;DR

- **Push, don't poll.** S3 Event Notifications (create/remove/restore/tag/ACL/retention/lifecycle events) delivered to SQS, Lambda, SNS, or EventBridge is the effective watch mechanism ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)).
- **Default: S3 → SQS standard queue.** Lowest latency and cheapest durable buffer for a single consumer; long-poll or attach a Lambda event source mapping.
- **Scale-out: S3 → EventBridge.** Adds content filtering (size, key prefix, time), fan-out to 18+ targets, and archive/replay — at ~1–5 s extra latency ([Quilt docs, 2026-09-04](https://docs.quilt.bio/quilt-platform-administration/advanced/eventbridge)) and $1 per million matched events ([2021 launch blog](https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/)).
- **Design for at-least-once.** Delivery is at-least-once, typically seconds but sometimes a minute or longer ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)); order is not guaranteed and retries can duplicate. Deduplicate on the event **sequencer** (hex-compare; duplicates share key + versionId + operation + sequencer) with an idempotency store ([ordering blog](https://aws.amazon.com/blogs/storage/manage-event-ordering-and-duplicate-events-with-amazon-s3-event-notifications/)).
- **Polling is the fallback only** — for backfill, reconciliation, or stores without notification support. ListObjectsV2 pages 1,000 keys per call ([SO](https://stackoverflow.com/questions/72203481/how-to-track-inventory-large-number-of-files-in-s3)) and LIST spend scales with scan frequency; S3 Inventory avoids the List API path ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-inventory.html)) and suits daily full-bucket diffs.

## Context

Question asked 2026-10-09: what is the most effective way to watch file changes on S3 object storage. Scope is AWS S3 (the dominant S3 API). Repo grep on 2026-10-09 found no prior S3 coverage, so this is a new file.

## Findings

### 1. The mechanism: S3 Event Notifications

Add a notification configuration to the bucket identifying events plus destinations; S3 publishes on each match ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)). Covered event families include object created/removed, restore initiated/completed/expired, replication, lifecycle expiration and transition, Intelligent-Tiering archival, tagging, ACL PUT, retention, and annotation events ([destinations/types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)). Four destination types exist: SNS topic, SQS queue, Lambda function, EventBridge — one destination type per notification entry ([same doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)).

### 2. Comparison — pick the column that fits

|  | A: Direct → SQS | B: Direct → Lambda | C: Direct → SNS | D: Via EventBridge | E: Poll ListObjectsV2 | F: S3 Inventory |
| --- | --- | --- | --- | --- | --- | --- |
| Latency | Seconds, fastest push path | Seconds, direct invoke | Seconds, fast fan-out | Seconds + ~1–5 s extra | Poll interval (minutes+) | Hours–daily |
| Delivery | At-least-once, durable buffer | At-least-once, needs retry/DLQ design | At-least-once, fan-out | At-least-once + archive/replay | Exact scan, you own the cursor | Scheduled manifest |
| Ordering | Unordered; sequencer-compare | Unordered; concurrency worsens it | Unordered per endpoint | Unordered; rules don't sort | Lexicographic listing, not event order | Snapshot, not a stream |
| Filtering | Prefix/suffix only | Prefix/suffix only | Prefix/suffix only | Content filters (size, key, time) — see §3 | Client-side after LIST | Prefix + manifest post-filter |
| Fan-out | One queue per entry | One function per entry | Many subscribers per topic | 18+ targets per rule — see §3 | N/A (pull model) | N/A (batch files) |
| Cost driver | SQS ops + LIST you avoid | Invokes + duration | Deliveries per subscriber | $1/M matched events (2021 rate) | LIST per 1k + GETs | Per-M objects listed per run |
| Same-region lock | Queue must share bucket region | Function must share region | Topic must share region | Cross-region bus targets exist | Anywhere with creds | Anywhere manifest lands |
| Best for | Default single-consumer feed | Transform-on-arrival | Multi-subscriber broadcast | Multi-team routing + replay | Backfill + reconcile loop | Daily full-bucket diff |

Latency row: base "seconds, sometimes a minute or longer" per [docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html); EventBridge delta per [Quilt](https://docs.quilt.bio/quilt-platform-administration/advanced/eventbridge); SNS-vs-EventBridge speed anecdote is operator-reported, not benchmarked ([Reddit, 2023](https://www.reddit.com/r/aws/comments/16ho9ba/pros_and_cons_of_s3_sqs_vs_s3_eventbridge_sqs/)). Cost row: EventBridge rate from the [2021 launch blog](https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/) — re-check current pricing before budgeting ([pricing](https://aws.amazon.com/s3/pricing/)); LIST-vs-Inventory gap discussed with 2021 figures ($0.005/1k LIST vs $0.0025/1M listed) in a [2021 thread](https://news.ycombinator.com/item?id=28917705) [unverified at current rates].

### 3. Destination guidance

- **SQS (default).** Durable buffer decouples burst writes from consumers; set the queue's MaximumMessageSize to at least 64 KB or SQS rejects oversize notifications ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)). FIFO queues are *not* supported as a direct destination — route via EventBridge for FIFO ([same doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)).
- **Lambda (direct).** Good for transform-on-arrival. Never write output back to the triggering prefix — self-trigger loops are a documented hazard; use two buckets or a narrow input prefix ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)). Durable Lambda functions are not supported as a direct destination ([same](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)).
- **SNS.** One publish, many subscribers (push endpoints, SMS/mobile, secondary queues). Standard topics only; SNS FIFO is not an allowed direct destination ([types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)).
- **EventBridge.** Enable per bucket and *all* events flow to the bus; rules match and route ([launch blog](https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/)). Gains: numeric/prefix/content filtering (e.g. objects ≤ 1 MB, key prefix `uploads/`), many targets (Step Functions, Kinesis streams, Firehose, HTTP API Destinations), cross-account/cross-region routing, and archive/replay for error recovery or new-consumer backfill ([same blog](https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/)). Cost for that: rule-match charges plus target charges.

### 4. Correctness: duplicates, order, and the sequencer recipe

Notifications are at-least-once and unordered; rare retries duplicate ([types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)). The blog's recipe ([ordering post](https://aws.amazon.com/blogs/storage/manage-event-ordering-and-duplicate-events-with-amazon-s3-event-notifications/)):

1. Key the idempotency record on object key; store the newest **sequencer** hex string (plus versionId and operation).
2. Drop events whose sequencer ≤ stored sequencer (duplicate or stale); process only strictly-greater ones. Duplicates carry identical key + versionId + operation + sequencer.
3. Hold the record in a conditional-write store (the reference uses DynamoDB) so concurrent Lambda invocations can't both win.
4. Never compare sequencers across different keys — copies to two keys are different objects.

Same-post warning: a slow handler on an old version can overwrite a newer result — gate the *write*, not just the read, on the sequencer check.

### 5. Limits and gotchas

- **Config propagation:** after creating/changing notification configuration, allow about five minutes before it takes effect ([docs search summary](https://docs.aws.amazon.com/AmazonS3/latest/userguide/how-to-enable-disable-notification-intro.html)).
- **Region pinning:** SNS/SQS/Lambda destinations must live in the bucket's region ([types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)); EventBridge adds cross-region bus targets ([launch blog](https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/)).
- **Permissions:** S3 needs explicit rights to post to the topic/queue or invoke the function ([types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)); enabling a config sends a test notification to verify topic existence and permission ([same](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)).
- **No event for no-op ACL PUTs** and lifecycle auto-deletes don't emit delete alerts ([types doc](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html)) — don't rely on the feed for those.
- **System-generated tags** now ride along in events to all destinations ([2026-07 announcement](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-s3-event-notifications-system-generated-tags/)) — useful extra filter context.

### 6. When polling or Inventory still earn a place

- **Reconciliation loop:** events are at-least-once and unordered, so pair the push feed with a periodic ListObjectsV2 cursor (sorted by key, checkpoint the last key + ETag/LastModified) or a daily Inventory manifest diff to catch anything the stream missed.
- **Backfill:** new consumer or replay window expired → list-and-catch-up from a timestamp, then resume the stream; dedupe on sequencer/ETag at the seam.
- **Non-AWS S3-compatible stores** without notification support → polling is the only portable option [unverified for specific vendors — out of scope, see Open Questions].

## Open Questions

- Current EventBridge matched-event and target pricing vs the 2021 $1/M figure — verify on the live pricing page before budgeting.
- Benchmarked latency distributions (p50/p99) for direct-SQS vs EventBridge-routed delivery — only anecdotal deltas found.
- MinIO / Cloudflare R2 / Backblaze B2 notification equivalents (webhooks, queue bindings) — not researched here.

## Related

- No prior S3 coverage in this repo (verified 2026-10-09 via repo grep) — no cross-links yet.

## Changelog

- 2026-10-09 — created.
