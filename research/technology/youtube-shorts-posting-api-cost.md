---
title: YouTube Data API — Is Posting (Including Shorts) Free?
category: technology
tags: [youtube, api, shorts, videos-insert, quota, pricing, publishing]
status: complete
created: 2026-10-21
updated: 2026-10-21
sources:
  - https://developers.google.com/youtube/data/determine_quota_cost
  - https://developers.google.com/youtube/data/revision_history
  - https://developers.google.com/youtube/v3/docs/videos/insert
  - https://developers.google.com/youtube/data/guides/uploading_a_video
  - https://bundle.social/blog/youtube-shorts-api-secrets
  - https://www.blotato.com/blog/youtube-api-pricing
  - https://bundle.social/blog/youtube-api-quota-exceeded-limits-fixes
confidence: high
---

# YouTube Data API — Is Posting (Including Shorts) Free?

**Short answer: yes.** There is no per-call fee, no paid tier, and no separate Shorts endpoint. You upload through `videos.insert` on the YouTube Data API v3, and the wall you hit is a **hard call cap**, not a bill: **100 uploads per project per day**, from a dedicated quota bucket.

## No Shorts API exists

Google publishes no `shorts.insert`, no Shorts-specific metadata field, and no Shorts section in the reference docs. A Short is the same `videos.insert` call with vertical content; YouTube classifies it server-side, after the fact, based on:

- **Aspect ratio** — vertical or square (9:16 ideal)
- **Duration** — under 3 minutes (180 s)

(Source: [bundle.social — YouTube Shorts API](https://bundle.social/blog/youtube-shorts-api-secrets). Not stated in Google's own reference, which never mentions Shorts.)

Practical consequence: any working long-form upload code posts Shorts unmodified. Same OAuth scope, same request body, same response.

## The quota model (post-2026)

| Date | Change |
|---|---|
| 2025-04-30 → before | Every upload cost ~1,600 units of the shared 10,000/day pool |
| **2025-12-04** | Upload cost cut from **~1,600 → ~100 units** ([revision history](https://developers.google.com/youtube/data/revision_history)) |
| **2026-06-01** | Granular quota: `videos.insert` and `search.list` move to **their own buckets**, off the shared pool ([revision history](https://developers.google.com/youtube/data/revision_history)) |

Current allocation, per [Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost):

> Projects that enable the YouTube Data API have a default quota allocation of **100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day** combined for all other endpoints.

Each `videos.insert` costs **1 unit** against its own bucket. Daily quotas reset at **midnight Pacific Time**.

### Why most published numbers are wrong

Almost every "YouTube API" guide still says an upload costs 1,600 units and that your ceiling is six uploads a day. That figure **died on 2025-12-04**. Even Google's own auto-generated page summary lagged the authored table. Treat any 1,600-unit advice as two revisions stale ([Blotato](https://www.blotato.com/blog/youtube-api-pricing)).

### What actually costs money-shaped quota

The bucket split moved the expensive operation from upload to everything else — all still free, but drawn from the shared 10,000-unit pool:

| Operation | Cost | Bucket |
|---|---|---|
| `videos.insert` (upload / post a Short) | 1 | own, 100/day |
| `search.list` | 1 | own, 100/day |
| `videos.list`, `channels.list`, `playlistItems.list` | 1 | shared |
| `thumbnails.set` (custom thumbnail) | 50 | shared |
| `videos.update` / `videos.delete` | 50 | shared |
| `captions.insert` | 400 | shared |
| `captions.update` | 450 | shared |

A custom thumbnail costs **50×** the upload it decorates. Adding captions costs 400–450 units. Budgeting a Shorts pipeline around uploads is now the wrong instinct: six thumbnail uploads drain more shared quota than 300 video uploads.

## The real friction for a Shorts pipeline

Ranked by how often they bite:

1. **100 uploads/day, per project — not per channel.** Connecting more channels does not buy more uploads; a multi-tenant scheduler hits this ceiling first ([bundle.social](https://bundle.social/blog/youtube-shorts-api-secrets)).
2. **Quota increase is application-gated, not purchasable.** There is no self-serve upgrade. The Audit and Quota Extension Form asks for project ID, use case, expected volume, business justification, privacy policy, and terms; review runs from a few weeks to multiple months at Google's discretion ([Blotato](https://www.blotato.com/blog/youtube-api-pricing)). Since the 2026-06-01 granular split, extensions are requested per method, which Google frames as simpler to verify.
3. **Upload success ≠ playable.** YouTube transcodes after the insert returns. A 30-second Short takes roughly **1–3 minutes** to become watchable. Poll `videos.list?part=processingDetails,status` — and handle the field being **absent** right after upload rather than assuming a state ([bundle.social](https://bundle.social/blog/youtube-shorts-api-secrets)).
4. **OAuth per channel.** Posting requires a `https://www.googleapis.com/auth/youtube.upload` token for the target channel ([Upload guide](https://developers.google.com/youtube/data/guides/uploading_a_video)).
5. **Over-quota is a bare `403 quotaExceeded`** with no reset timestamp and no remaining-quota figure ([bundle.social](https://bundle.social/blog/youtube-shorts-api-secrets)). Track usage yourself against the two buckets.

### The "unverified project = private only" myth

Older guidance (and Google's own revision history entry for projects created after 2020-07-28) says uploads from unverified API projects are locked to private. The current `videos.insert` reference says the opposite:

> Videos uploaded from unverified API projects are **not** restricted to private viewing mode.

([videos.insert reference](https://developers.google.com/youtube/v3/docs/videos/insert), read 2026-10-21.)

This is a documented contradiction inside Google's own docs. Plan for the possibility of a private-only result and verify with a test upload on a real project before shipping, rather than trusting either page.

## Decision

Use the Data API directly if you post **≤100 videos/day per Google Cloud project** and can tolerate the once-per-project OAuth flow. That covers a single creator or a small scheduler indefinitely, at zero cost.

Reach for a paid wrapper (Blotato, Ayrshare, Post Bridge, etc.) only when you need **unified posting across many platforms**, not because YouTube itself charges. Those wrappers exist to rent you their approved quota and multi-platform plumbing — typically $29–$499/month — and you inherit their ceilings and their data handling.

## Gotchas

- **`status.publishAt`** schedules a future publish; it costs nothing extra, and it is the only way to queue without holding a token at post time.
- **`#Shorts` in the title/description is not a switch.** Classification is aspect ratio + duration. Community advice recommending the hashtag as "required" is wrong.
- **`containsSyntheticMedia`** exists as a `videos.insert` field; set it for AI-generated Shorts rather than leaving disclosure to a post-hoc edit ([revision history 2024-10-30](https://developers.google.com/youtube/data/revision_history)).
- **Failed requests still cost at least 1 unit** ([Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost)).
- **Quota is shared across the whole Cloud project**, so one runaway `captions.update` loop starves your uploads' neighbouring calls (uploads themselves are safe — own bucket).

## Changelog

- 2026-10-21 — Created. Verified the 2025-12-04 quota cut and 2026-06-01 bucket split against Google's revision history; verified the unverified-project privacy contradiction directly against the `videos.insert` reference.
