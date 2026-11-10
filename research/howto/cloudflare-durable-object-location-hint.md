---
title: Provide a locationHint for a Cloudflare Durable Object
category: howto
tags: [cloudflare, durable-objects, location-hint, latency, placement, jurisdiction, apac]
status: complete
created: 2026-10-30
updated: 2026-10-30
sources:
  - https://developers.cloudflare.com/durable-objects/reference/data-location/
  - https://developers.cloudflare.com/durable-objects/api/namespace/
  - https://developers.cloudflare.com/durable-objects/api/stub/
  - https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/
  - https://where.durableobjects.live/api/v3/data.json
confidence: high
---

# Provide a locationHint for a Cloudflare Durable Object

## Goal

Choose where a Durable Object lives, so its stored state sits near the users who hit it. A
hint is passed on the **first** `get()` for an object and is permanent for that object's life
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).

## Prerequisites

- A Worker with a Durable Object binding in `wrangler.jsonc`, and **SQLite-backed** storage
  (the only backend available to new namespaces — see
  [SOL](./cloudflare-durable-objects-production-review.md) for the backend split).
- The object must not exist yet. **A hint on an already-created object is silently ignored.**
- A clear idea of your audience's geography, because this decision is one-way.

## Steps

### 1. Pick the region, not the colo

Hints are coarse regions. You cannot ask for `SIN`, `FRA` or `SYD` directly.

| Hint | Region | Note |
| --- | --- | --- |
| `wnam` | Western North America | |
| `enam` | Eastern North America | Also where `sam` resolves |
| `weur` | Western Europe | |
| `eeur` | Eastern Europe | |
| `apac` | Asia-Pacific | Broadest APAC hint; safest default |
| `apac-ne` | Northeast Asia-Pacific | Sub-region of `apac` |
| `apac-se` | Southeast Asia-Pacific | Sub-region of `apac` |
| `oc` | Oceania | Australia + NZ |
| `sam` | South America | **Does not spawn there** — lands in Eastern North America |
| `afr` | Africa | **Does not spawn there** — lands in a nearby supported region |
| `me` | Middle East | **Does not spawn there** — lands in a nearby supported region |

Do **not** use `sam`, `afr` or `me` expecting local placement: the docs state Durable Objects
"currently do not spawn in this location" and instantiate nearby instead
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).

Prefer `apac` over `apac-ne`/`apac-se` unless your users really are concentrated in one
sub-region — the docs recommend the broad hint for general placement.

### 2. Pass the hint on the first `get()`

Both `get()` and `getByName()` accept `locationHint` as a second argument
([namespace API](https://developers.cloudflare.com/durable-objects/api/namespace/)).

```ts
export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const room = url.searchParams.get("room")!;

    // Hint is honoured only while the object does not yet exist.
    const stub = env.ROOMS.getByName(room, { locationHint: "apac-se" });
    return stub.fetch(request);
  },
};
```

The `id`-based form is identical:

```ts
const id = env.ROOMS.idFromName(room);
const stub = env.ROOMS.get(id, { locationHint: "apac-se" });
```

### 3. Create the object from a real user request

This is the step teams skip, and it is the one that decides the outcome. If a cron job, queue
consumer or admin backend calls `get()` first, **every object it creates lands near that
backend**, and it stays there forever
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/):
"It can negatively impact latency to pre-create Durable Objects prior to the first client
request"). Either let the hint carry the decision, or create lazily from the user's own
request.

### 4. Consider jurisdiction instead, if regulation is the driver

A hint is **best-effort**. A jurisdiction is **enforced**. If the goal is legal residency
rather than latency, use a jurisdiction subnamespace — available for `eu`, `us` and
`fedramp` only, and there is **no APAC jurisdiction**
([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).

```ts
const euNamespace = env.ROOMS.jurisdiction("eu");
const id = euNamespace.newUniqueId();
const stub = env.ROOMS.get(id);
```

`newUniqueId()` also accepts `{ jurisdiction }` directly. Note that a jurisdiction restricts
where the object *runs and stores data*; Workers worldwide can still reach it, and the
`DurableObjectId` is logged outside the jurisdiction for billing and debugging.

## Verification

There is no API that reports an object's colo. Verify by these routes, strongest first:

1. **Look up the actual host set** for the region you hinted, from
   [where.durableobjects.live](https://where.durableobjects.live/) or its dataset
   (`/api/v3/data.json`). This tells you which colos serve `apac-se`, not which one your
   object took.
2. **Read the hint back inside the object** to confirm what you asked for:

   ```ts
   // Durable Object method
   where() {
     return { id: this.ctx.id.toString(), location: this.ctx.id.locationHint };
   }
   ```

   This returns the **hint**, not the resolved colo — a returned `apac-se` does not prove the
   object is in Singapore.
3. **Measure.** Time a round trip from the client geography you care about. A Singapore
   audience should see roughly 30 ms; if you see 400 ms+, the hint missed.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Hint appears to do nothing | Object already existed — only the **first** `get()` honours it | Delete the object and recreate, or accept the placement |
| Object landed near your backend, not users | A cron/queue/admin path called `get()` first | Create from the user request, or pass the hint explicitly |
| `sam`/`afr`/`me` hint ignored | Those regions do not host Durable Objects | Use the region it actually resolves to |
| Asked for `apac-se`, got a different colo | Hints are best-effort, not a guarantee | Use a jurisdiction if enforcement is required |
| Latency high despite a "correct" hint | Region label mismatch — `apac` vs `oc` differ hugely | Check the [cross-region table](./cloudflare-durable-objects-production-review.md#the-region-label-trap) |
| Need data in India/Indonesia/etc. | No APAC jurisdiction exists | Only a best-effort hint is available |

## Related

- [Cloudflare Durable Objects and SQLite in Production — Reliability Review, With an APAC Focus](./cloudflare-durable-objects-production-review.md)
  — why this decision is permanent, the measured per-market RTTs, and the region-label trap.
- [Architectural Decisions for a Pusher-Compatible Server on Cloudflare Durable Objects](../technology/pusher-server-durable-objects-architecture.md)
  — how placement interacts with WebSocket fan-in.

## Changelog

- 2026-10-30 — created from a follow-up question about an object created in Singapore. Read the
  `data-location`, `namespace`, `stub` and `what-are-durable-objects` doc pages via
  Cloudflare's markdown endpoints. TinyFish was unavailable in the session (see the Changelog of
  the production review for the declared fallback); all facts here are first-party Cloudflare
  documentation, so confidence is `high`. Two things deliberately *not* claimed: no dependency
  on a specific compatibility date for `getByName` is asserted, since the namespace reference
  does not state one, and no API is named that reports an object's resolved colo, because none
  is documented to exist.
