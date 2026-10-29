---
title: Instagram and Threads APIs — Are They Free for Publishing?
category: technology
tags: [instagram, threads, meta, graph-api, content-publishing, pricing, rate-limits]
status: complete
created: 2025-10-14
updated: 2025-10-14
sources:
  - https://developers.facebook.com/documentation/instagram-platform/overview
  - https://developers.facebook.com/documentation/instagram-platform/content-publishing
  - https://developers.facebook.com/documentation/threads/overview
  - https://developers.facebook.com/documentation/threads/posts
confidence: high
---

# Instagram and Threads APIs — Are They Free for Publishing?

## TL;DR

- **Yes, both are free.** Neither Meta's Instagram Platform docs nor the Threads API docs list a price, per-call fee, paid tier, or billing page. You pay nothing to publish.
- **Instagram:** posting requires an **Instagram professional account** (business or creator), not a personal one, and an app with `instagram_business_content_publish` (Instagram Login) or `instagram_content_publish` + `pages_read_engagement` (Facebook Login).
- **Threads:** posting requires `threads_basic` + `threads_content_publish`. Same free model.
- **The real cost is not money, it is scope:** App Review, Business Verification, and hard rate limits. Advanced Access (publishing on behalf of users you don't own) requires Meta App Review and business verification; Standard Access only lets you act on accounts you own or manage.
- **Rate limits:** Instagram — **100 API-published posts / 24h** rolling. Threads — **250 posts / 24h** and **1,000 replies / 24h**. Carousels count as one post in both.

## Context

Question asked: "does Instagram and threads api for posting are free?" This file captures the primary-source answer (Meta's own developer documentation) plus the constraints that actually gate a posting integration, so the pricing question is answered together with the "what do I have to do to use it" question.

## Findings

### Pricing posture

There is no pricing, fee, or billing language anywhere in Meta's Instagram Platform or Threads API documentation. Both are part of the Graph API family, which Meta does not meter by call price. Searches for "API pricing" surface only third-party aggregators (Phyllo, Blotato, Zernio, bundle.social), whose paid products are *unified posting APIs built on top of* Meta's free API — they charge for the abstraction, not for Meta's access ([developers.facebook.com Instagram overview](https://developers.facebook.com/documentation/instagram-platform/overview), [Threads overview](https://developers.facebook.com/documentation/threads/overview)).

Practical consequence: the free path is to integrate Meta directly. Paid SaaS social schedulers exist because direct integration is fiddly (app review, token management, media hosting), not because Meta charges.

### Instagram publishing — what it takes

| Dimension | Instagram API with Instagram Login | Instagram API with Facebook Login |
|---|---|---|
| Login | Instagram credentials (Business Login for Instagram) | Facebook credentials (Facebook Login for Business) |
| Host | `graph.instagram.com` | `graph.facebook.com` (+ `rupload.facebook.com` for resumable video) |
| Access token | Instagram User access token | Facebook Page access token |
| Facebook Page required | No | Yes |
| Publish permissions | `instagram_business_basic`, `instagram_business_content_publish` | `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` |
| Hashtag search / product tagging / partnership ads | Not supported | Supported |

([Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview), [Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing))

Requirements worth knowing before writing code:

- **Professional account only.** "To use the APIs, your app users must have an Instagram professional account" — business or creator ([overview](https://developers.facebook.com/documentation/instagram-platform/overview)).
- **Public media server.** Meta cURLs the media URL at publish time, so the image or video must be reachable from the public internet at that moment ([content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)).
- **JPEG only.** "JPEG is the only image format supported"; MPO/JPS extended JPEGs are rejected. No filters, no shopping tags.
- **Page Publishing Authorization (PPA).** An Instagram professional account linked to a Page that requires PPA cannot be published to until PPA is completed, and the API offers no way to detect whether PPA is required — so advise users to complete it preemptively.
- **Two-step publish.** `POST /<IG_ID>/media` creates a container (upload), then `POST /<IG_ID>/media_publish` publishes it. `GET /<IG_CONTAINER_ID>?fields=status_code` checks readiness.
- **Rate limit:** "Instagram accounts are limited to 100 API-published posts within a 24-hour moving period. Carousels count as a single post." Enforced on `media_publish`. Check usage with `GET /<IG_ID>/content_publishing_limit`.

### Threads publishing — what it takes

- **Permissions:** `threads_basic` for all calls, plus `threads_content_publish` for publishing ([Threads Posts](https://developers.facebook.com/documentation/threads/posts)).
- **Access gating:** without advanced access on `threads_content_publish`, you can only post on behalf of **Threads testers** listed on your app. Publishing to the general public requires the app to be published and the permission approved.
- **Two-step publish:** `POST /{threads-user-id}/threads` creates the container, `POST /{threads-user-id}/threads_publish` publishes it. Meta recommends waiting ~30 s between the two for media processing.
- **Media hosting:** same rule — the image/video URL must be on a public server for Threads to fetch.
- **Text limit:** 500 characters; emojis count as their UTF-8 byte length.
- **Carousels:** up to 20 images/videos, minimum 2 children, counted as a single post.
- **Rate limits:** 250 API-published posts per 24h rolling, 1,000 replies per 24h, plus a separate app-level call budget: `4800 × impressions` calls per 24h (impressions floored at 10), with CPU-time ceilings of `720000 × impressions` (total_cputime) and `2880000 × impressions` (total_time). Query usage via `GET /{threads-user-id}/threads_publishing_limit`.
- **Hosts:** `graph.threads.com` or `graph.threads.net`.

### Cost-adjacent caveats

- **App Review and Business Verification are the real gate.** Advanced Access — required to serve accounts you do not own — "requires App Review and Business Verification" ([overview](https://developers.facebook.com/documentation/instagram-platform/overview)). Those are free of charge but cost review latency and paperwork. Private/intranet apps can request approval only for `instagram_basic` and `instagram_manage_comments`, i.e. no publishing.
- **Impressions drive your quota.** Because Threads' call budget scales with impressions, a brand-new or low-traffic account runs on the minimum bucket (10 impressions), which is a tight allowance. This is the closest thing to a "cost" of a small account.
- **Not the same as WhatsApp.** WhatsApp Business Platform is the Meta product that does charge per message; it is a separate system with its own pricing and is often confused with the "Meta APIs are free" claim.

## Open Questions

- Whether Meta plans any paid tier for Threads or Instagram publishing. No announcement found in primary docs; treat as no.
- Exact behaviour when `content_publishing_limit` is exhausted mid-schedule (error code surface) — not verified here.

## Related

- Consumer-facing schedulers (Buffer, Later, etc.) are the paid abstraction over these free APIs; no research file yet.
- [Instagram Reels Posting Time — Is There a Hot Hour?](./instagram-reels-posting-time-engagement.md) — what timing can and cannot do to Reels reach, and why the best-time datasets disagree.

## Changelog

- 2025-10-14 — created from Meta for Developers primary docs (Instagram Platform overview, Content Publishing; Threads overview, Threads Posts).
