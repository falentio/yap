---
title: Architectural Decisions for a Pusher-Compatible Server on Cloudflare Durable Objects
category: technology
tags: [pusher, cloudflare, durable-objects, websocket, hibernation, realtime, architecture, decision-record]
status: complete
created: 2026-10-15
updated: 2026-10-15
sources:
  - https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
  - https://developers.cloudflare.com/durable-objects/best-practices/websockets/
  - https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
  - https://developers.cloudflare.com/durable-objects/api/state/
  - https://developers.cloudflare.com/durable-objects/api/alarms/
  - https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
  - https://developers.cloudflare.com/durable-objects/platform/limits/
  - https://developers.cloudflare.com/durable-objects/platform/pricing/
  - https://github.com/pusher/pusher-js/tree/v8.6.0
  - https://github.com/soketi/soketi/tree/1.6.1
confidence: medium
---

# Architectural Decisions for a Pusher-Compatible Server on Cloudflare Durable Objects

## Summary

Five decisions that shape a Pusher Channels v7 compatible server built on Cloudflare
Durable Objects with the WebSocket Hibernation API. Each decision was explored by five
independent design candidates, cross-judged, and synthesized into one choice per
decision. The wire contract is fixed by
[the protocol reference](../reference/pusher-websocket-protocol.md); this document
decides how to satisfy it on this platform.

| # | Decision | Choice |
|---|---|---|
| D1 | Object topology and sharding | Four DO classes with disjoint key prefixes; connection shard encoded in `socket_id`; channel state single-homed |
| D2 | Per-connection state and hibernation recovery | Constant-size attachment for connection state; the socket-to-channel relation in SQLite; indexes derived on wake |
| D3 | Publish fan-out | A fixed-breadth lane fan-out with a durable journal and a relay tree for scale-out |
| D4 | Liveness under hibernation | No per-connection timer; runtime auto-response for pongs; suspicion-armed alarm for 4201 |
| D5 | Presence membership | Presence is a projection over live sockets, never a stored member set |

Confidence is medium, not high: the protocol contract is verified, but several
platform behaviors this design leans on (auto-response interaction with the 10 s
hibernation timer, whether DO RPC counts against the 6-connection cap) are
[open questions](#system-level-open-questions) that need a live spike before
implementation commits.

## Context

### The contract

The server must speak the Pusher Channels protocol v7
([reference](../reference/pusher-websocket-protocol.md)). The load-bearing obligations
for the design are:

- The first frame is `pusher:connection_established` with a JSON-string `data` carrying
  `socket_id` and `activity_timeout` seconds.
- The client sends `{"event":"pusher:ping","data":{}}` after inactivity; the server
  answers `{"event":"pusher:pong","data":{}}`. An unanswered server ping closes with 4201.
- A subscription is `{"event":"pusher:subscribe","data":{channel,auth,channel_data}}`,
  answered with `pusher_internal:subscription_succeeded`.
- Channel type is a name prefix (`presence-`, `private-encrypted-`, `private-`, else
  public), with cache as an extra prefix segment.
- Presence carries a member set (`ids`/`hash`/`count`) and fans out
  `member_added`/`member_removed` with multi-tab dedupe.
- `#server-to-user-<id>` is the internal channel for direct-to-user delivery.
- Publishing is a separate signed HTTP API.

### The platform

A Durable Object is a single-threaded, globally unique actor with co-located SQLite
([rules](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)).
The facts that bind this design:

| Fact | Value | Source |
|---|---|---|
| Sockets per DO | 32,768 | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Attachment size | 16,384 bytes, structured clone, lost on close | [state](https://developers.cloudflare.com/durable-objects/api/state/) |
| Auto-response strings | exact match, 2,048 chars each | [state](https://developers.cloudflare.com/durable-objects/api/state/) |
| Socket tags | 10 per socket, 256 chars each | [state](https://developers.cloudflare.com/durable-objects/api/state/) |
| SQLite storage | 10 GB, 2 MB per row/string | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| CPU per invocation | 30 s default, 5 min max | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Alarm handler wall time | 15 min | [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| Throughput | ~1,000 req/s soft per DO | [rules](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) |
| Hibernation | after ~10 s idle; constructor re-runs on the next event | [lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) |
| Eviction when non-hibernatable | 70 to 140 s idle | [lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) |
| Events that prevent hibernation | a running alarm, requests, `setTimeout`/`setInterval`, pending I/O | [websockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) |

Two of these decide most of the design. First, hibernation discards in-memory state, so
every fact a handler needs must be recoverable from the attachment, from SQLite, or from
`ctx.getWebSockets()`. Second, anything that keeps a timer pending keeps the DO resident
and billable, so liveness cannot be a per-connection timer.

### The non-obvious constraint

A WebSocket is owned by exactly one DO for its lifetime: only the DO that called
`acceptWebSocket` can `send` to it. But a connection subscribes to many channels and a
channel spans many sockets. The socket owner and the channel owner are different actors,
and the cut between them is decision D1. Every other decision is downstream of it.

## D1: Object topology and sharding key

### Decision

Four DO classes with disjoint key prefixes. A connection's shard is chosen at the edge
and encoded in its `socket_id`, so any holder of a `socket_id` reaches the owning DO by
parsing, with no directory. Channel state is single-homed by channel name. Presence
channels are never sharded.

### Usage (caller's view)

```ts
// edge Worker, WebSocket upgrade: GET /app/<key>?protocol=7...
const cfg = await appConfig(env, key);          // KV-cached config, not a directory
const socketId = mintSocketId(cfg.connShards);  // "s7.9f": shard 7, random suffix
return env.CONN.getByName(connDoName(cfg.appKey, shardOf(socketId)))
  .fetch(upgrade(req, { socketId, appId: cfg.appId }));

// edge Worker, publish: POST /apps/<id>/events
const cfg = await appConfig(env, appIdFromPath);  // app_id -> app_key
verifyHttpSignature(req, cfg.secret);             // HMAC + 600s window, at the boundary
const r = await fanout(env, cfg, parsedPublish);
return r.ok ? json({}, 200) : json({ undelivered: r.undelivered }, 502);

// anywhere holding a socket_id (exclusion, terminate): owner is parseable
const owner = connDoName(cfg.appKey, shardOf(excludedSocketId));
```

### Shape

```ts
type AppKey      = string & { readonly __appKey: true };
type AppId       = string & { readonly __appId: true };
type SocketId    = string & { readonly __socketId: true };   // "<shard36>.<nonce>"
type ChannelName = string & { readonly __channel: true };
type UserId      = string & { readonly __userId: true };
type ConnShard   = number;

type ChannelKind  = "public" | "private" | "encrypted" | "presence";
type ChannelClass = { kind: ChannelKind; cache: boolean };

// The routing table is a function, not state.
function shardOf(socketId: SocketId): ConnShard;            // total: parses the prefix
function connDoName(appKey: AppKey, s: ConnShard): string;   // "conn/<key>/<s>"
function channelDoName(appKey: AppKey, c: ChannelName): string; // "chan/<key>/<c>"
function userDoName(appKey: AppKey, u: UserId): string;      // "user/<key>/<u>"
function parseChannel(name: string): ChannelClass | ParseError;
```

| Class | Sharding key | Owns |
|---|---|---|
| `AppDO` | `app/<app_id>` | app key, secret, disabled flag, quota, webhook targets. Read-mostly config, plus a best-effort occupancy ledger for `GET /channels`. Never on a hot path. |
| `ConnDO` | `conn/<app_key>/<shard>` | accepted WebSockets and their attachments. Sole writer of socket-to-channel membership. |
| `ChanDO` | `chan/<app_key>/<channel>` | channel state: presence member projection, cache last-event and TTL, occupancy refcount, and the coarse socket index for fan-out. |
| `UserDO` | `user/<app_key>/<user_id>` | signin bookkeeping, online flag, watchlist edges, and delivery to `#server-to-user-<id>`. |

Routing:

| Entry point | Compute | DOs touched |
|---|---|---|
| `GET /app/<key>` (WS upgrade) | `shardOf(newSocketId)` | 1 |
| `pusher:subscribe C` | `ConnDO` to `ChanDO(channelDoName(C))` | 2 |
| `POST /events` (1 to 100 channels) | one fan-out per distinct channel home | 1 + targets (D3) |
| `GET /channels` | read the `AppDO` occupancy ledger | 1 |
| `GET /channels/<c>` and `/users` | `ChanDO(c)` | 1 |
| terminate user | `UserDO(u)`, which tells its `ConnDO`s to close | 1 + its conns |
| `sendToUser(u)` | `ChanDO("#server-to-user-"+u)` | 1 |

Data flow. A socket is accepted by a `ConnDO` chosen by hashing its own `socket_id`; the
`ConnDO` never changes. Subscribing calls the channel's `ChanDO`, which is the single
writer for that channel's presence, cache, and socket index. Publishing reaches the
`ChanDO`s of the named channels, which fan out to the `ConnDO`s holding subscribers.

Invariants in types. `AppKey` and `AppId` are separate brands so an app key cannot be
routed as an app id. `shardOf` is total: it parses the shard from the id, so a socket is
always routable and old ids stay valid forever. `ChannelClass` is produced once at the
boundary, so channel-type branching never reappears inside the DOs.

Hot channels. A channel is one `ChanDO`, capped at ~1,000 publish/s and 32,768 sockets
(only reachable if the channel is the app's only one, since `ConnDO` holds the sockets).
The escape hatch is a pinned partition set: config marks a channel `partitions: P`, its
homes become `chan/<key>/<channel>#0..P-1`, and each partition owns a disjoint slice of
connection shards (`shardOf(sid) % P`). A publish to a pinned channel touches `P` DOs and
the ceiling multiplies by `P`. Presence channels are never pinned, because D5 needs them
single-homed.

### Tradeoffs accepted

- We accept a `ConnDO` to `ChanDO` to `ConnDO` hop for client events, in exchange for a
  single writer per channel and one rate-limit authority.
- We accept that `socket_id` leaks its connection shard, in exchange for table-free
  routing from any holder of an id.
- We accept a best-effort occupancy ledger in `AppDO`, in exchange for `GET /channels`
  without scanning every `ChanDO`.
- We accept that raising `connShards` requires a drain and reconnect, in exchange for a
  shard count that never needs to change per channel.

### Alternatives rejected

- **One DO per app.** Trivial routing and one publish target, but the whole app caps at
  32,768 sockets and ~1,000 req/s, and one hot channel starves the rest.
- **One DO per channel, sockets homed in the channel DO.** A socket in five channels
  would need five owners; impossible, since a socket has one owner.
- **One DO per socket.** Perfect isolation, but the DO count equals the socket count and
  every publish is a per-socket RPC.
- **A fixed all-channels shard ring (16 shards, no per-channel DO).** Publish cost is a
  constant 16 fetches regardless of subscriber count, and a hot channel shares a shard's
  budget with unrelated channels.

### Open questions

- Does a DO stub RPC count against the 6-simultaneous-outgoing-connections limit, or only
  `fetch()`? This bounds D3's fan-out breadth. Needs a spike.
- `connShards` sizing against noisy neighbors: a hot channel can starve its `ConnDO`
  shard-mates unless its publishers are spread.

## D2: Per-connection state and hibernation recovery

### Decision

The attachment holds only connection-scoped state and is constant size, so it can never
approach the 16,384-byte limit. The socket-to-channel relation lives in SQLite, because
the dominant read is channel to sockets, not socket to channels. In-memory indexes are
derived on wake and never persisted.

### Usage (caller's view)

```ts
async webSocketMessage(ws, raw) {
  const att = ws.deserializeAttachment() as Attachment;   // O(1), constant size
  const msg = parseFrame(raw);                            // boundary parse
  switch (msg.kind) {
    case "subscribe":   return this.subscribe(ws, att, msg);
    case "unsubscribe": return this.unsubscribe(ws, att, msg);
    case "ping":        return ws.send(PONG_FRAME);
    case "client":      return this.clientEvent(ws, att, msg);
  }
}

async fanOut(channelId, frame, exclude?: SocketId) {   // the dominant read
  for (const row of subs.ofChannel(channelId))          // one indexed query
    if (row.socketId !== exclude) this.socketOf(row.socketId)?.send(frame);
}
```

### Shape

```ts
type Attachment = {
  v: 1;
  sid: SocketId;
  app: AppId;
  signin: { userId: UserId; dataRef: number | null } | null; // dataRef -> signin_data
  live: { lastInboundMs: number; pingSentAtMs: number | null }; // D4 reads this
};
// ~220 bytes, no collection, never overflows.
```

SQLite (the authoritative relations):

```sql
channels(channel_id INTEGER PRIMARY KEY, name TEXT UNIQUE, kind TEXT, created_ms INTEGER);
subs(channel_id INTEGER, socket_id TEXT,
     presence_user_id TEXT NULL, presence_info TEXT NULL,
     joined_ms INTEGER, PRIMARY KEY (channel_id, socket_id)) WITHOUT ROWID;
CREATE INDEX subs_by_socket ON subs(socket_id);
signin_data(socket_id TEXT PRIMARY KEY, user_data TEXT);  -- only when user_data is large
cache(channel_id INTEGER PRIMARY KEY, name TEXT, data TEXT, expires_ms INTEGER, seq INTEGER);
```

Derived, never stored: the encrypted channel's `shared_secret` is
`SHA256(channel_name || master_key)` recomputed per auth, so no key material sits per
connection. Liveness is read from the attachment plus the runtime's auto-response
timestamp (D4). Occupancy and presence counts are projections of `subs`.

Recovery on wake (in `blockConcurrencyWhile`, so no request interleaves):

```ts
for (const ws of ctx.getWebSockets()) {           // O(sockets)
  const a = ws.deserializeAttachment() as Attachment | null;
  if (!a || a.v !== 1) { ws.close(4200, "state lost"); continue; }  // poison
  socketBySid.set(a.sid, ws);
}
// reconcile: drop subs rows for sockets no longer live (deploy orphans)
const live = new Set(socketBySid.keys());
for (const sid of subs.allSocketIds()) if (!live.has(sid)) subs.deleteBySocket(sid);
```

The wake cost is O(sockets) plus one reconciliation pass, never O(all channels). The
socket-to-channel index is built lazily per channel on first fan-out, not eagerly.

Stale or missing attachment. A socket in `getWebSockets()` whose attachment is absent or
of unknown version cannot be trusted: it is closed with 4200, which the client treats as
reconnect-immediately, and its `subs` rows are reconciled away. This is terminal on
purpose; there is exactly one source of truth per fact, and a socket with no source of
truth is dropped rather than guessed.

### Tradeoffs accepted

- We accept one SQLite write per subscribe and unsubscribe, in exchange for a
  constant-size attachment that cannot overflow and needs no spill path.
- We accept one indexed read per channel per fan-out, in exchange for matching the
  dominant access pattern (channel to sockets) instead of scanning attachments.
- We accept a reconciliation pass on wake, in exchange for surviving a deploy that drops
  every socket without a close handler.
- We accept closing a socket with an unreadable attachment, in exchange for never
  duplicating identity into a second store.

### Alternatives rejected

- **The whole connection inlined in the attachment.** Simplest on the hot path, but a
  connection with many channels or large presence identities crosses 16 KB and needs a
  spill path anyway; the limit is a cliff, not a slope.
- **A pointer attachment with everything in SQLite.** Every handler pays a storage read
  and identity is no longer O(1); loses on interface depth.
- **Membership in socket tags.** Tags are fixed at `acceptWebSocket` and capped at 10,
  before any subscribe; a mutable subscription set cannot live there.
- **An in-memory index rebuilt in the constructor.** Correct only until the next
  hibernation; the rebuild is the derivation, so drop the persisted copy.

### Open questions

- Is `deserializeAttachment()` readable inside `webSocketClose`? If not, a clean close
  must reconstruct identity from `subs` before the row is deleted.
- Wake cost of the O(sockets) loop at 32,768 sockets against the 30 s CPU budget. Mitigate
  by capping practical occupancy well below the ceiling.

## D3: Publish fan-out

### Decision

A fixed-breadth fan-out: the handler validates, then calls each channel's `ChanDO` in
waves of at most 6 concurrent RPCs, with a durable journal for retry and a bounded-degree
relay tree for publishes that touch more than 6 channel homes.

### Usage (caller's view)

```ts
// edge Worker: the only public surface
const p = validatePublish(req, cfg);              // HMAC, 10KB (413), 1..100 channels
const r = await deliver(env, p);
return r.ok ? json({}, 200) : json({ undelivered: r.undelivered }, 502);

// every other producer, including signin and terminate, uses the same entry
await deliver(env, { appKey, name: "pusher:signin_success", data,
                     channels: [asChannel("#server-to-user-" + userId)] });
```

### Shape

```ts
const FANOUT_BREADTH = 6;                          // == the outbound-connection budget
type Publish = {
  appKey: AppKey; publishId: string; seq: number;
  name: string; data: string;                      // serialized once at the edge
  channels: readonly ChannelName[];
  exclude?: SocketId;
};
type PublishResult = { ok: true } | { ok: false; undelivered: readonly ChannelName[] };

interface ChanDO {
  deliver(env: PublishEnvelope): Promise<ChanResult>;  // idempotent on publishId
  cache(env: CacheEnvelope): Promise<void>;            // idempotent on seq
}
```

Data flow. The handler groups channels by home `ChanDO`, dispatches at most 6 RPCs at a
time, and each `ChanDO` reads its channel-to-socket index and sends to the local sockets
of its `ConnDO`s, skipping `exclude`. For a publish whose channel homes exceed 6, a relay
DO re-partitions: `relay(publishId, path).dispatch(targets)` splits into 6 and recurses,
so depth is `ceil(log6 N)` (3 for 100 channels) instead of 17 sequential rounds.

- Exclusion is payload, not addressing. `socket_id` is globally unique, so exactly the
  owning `ConnDO` matches it and every other compares miss. No lookup of the excluded
  socket's DO is needed.
- Cache is written by the same `ChanDO` that fans out, guarded by `seq`, so a replayed
  publish cannot regress the cache and cache cannot diverge from delivery.
- Idempotency is `(publishId, channel)`: a repeated RPC is a no-op.
- Failure is a durable journal. `allSettled` over the wave; a failed home is recorded and
  retried by alarm with platform backoff. The caller gets 502 naming the undelivered
  channels. Successful channels are already delivered.

### Tradeoffs accepted

- We accept at-least-once delivery under retry, in exchange for never losing a publish to
  an unavailable DO.
- We accept a 502 on partial failure where Pusher returns 200, in exchange for telling the
  caller which channels did not deliver.
- We accept a relay tree only above 6 channel homes, in exchange for one wave in the
  common case.

### Alternatives rejected

- **A flat `Promise.all` over all channel DOs.** Breaks the 6-concurrent-call budget at
  wide publishes; sequential rounds cost up to 17 round trips.
- **Cloudflare Queues ahead of fan-out.** Adds seconds of latency, at-least-once
  duplicates to clients, and cannot return a per-channel error synchronously.
- **One central all-sockets fan-out DO.** One RPC, but O(all sockets) per publish and a
  single ~1,000 req/s chokepoint for every publish.

### Open questions

- Whether DO RPC counts against the 6-connection cap decides whether the breadth is a hard
  limit or a soft target.
- The failure ledger's write amplification on hot channels: consider failure-only writes.

## D4: Liveness and ping/pong under hibernation

### Decision

No per-connection timer and no scheduled server ping. The runtime auto-answers the
client's ping without waking the DO. A suspicion-armed alarm produces the 4201 close, and
it exists only while a server ping is outstanding, so a healthy fleet never wakes.

### Usage (caller's view)

```ts
// constructor (re-runs on every wake)
ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME));

// handshake
ws.send(JSON.stringify({
  event: "pusher:connection_established",
  data: JSON.stringify({ socket_id: att.sid, activity_timeout: ACTIVITY_TIMEOUT_S }),
}));

// webSocketMessage: any frame is proof of life
att.live.lastInboundMs = Date.now(); att.live.pingSentAtMs = null;
ws.serializeAttachment(att);

// alarm(): the reaper, armed only while a suspect exists
const next = reap(ctx, Date.now());
next === null ? ctx.storage.deleteAlarm() : ctx.storage.setAlarm(next);
```

### Shape

```ts
const ACTIVITY_TIMEOUT_S = 120;                              // == pusher-js default
const PING_FRAME = '{"event":"pusher:ping","data":{}}';      // byte-exact, 33 chars
const PONG_FRAME = '{"event":"pusher:pong","data":{}}';
const SUSPECT_AFTER_MS   = ACTIVITY_TIMEOUT_S * 1000 + 30_000;  // 150_000, exactly tight
const PONG_DEADLINE_MS   = 30_000;                             // == pusher-js pongTimeout

type Liveness =
  | { k: "live" }                                 // proof within SUSPECT_AFTER_MS
  | { k: "suspect"; sinceMs: number }             // a ping is outstanding
  | { k: "dead" };                                // a ping went unanswered
```

The load-bearing decisions:

- The runtime is the responder, the client is the clock. pusher-js's WebSocket transport
  has `supportsPing: false`, so it sends the application-level `pusher:ping` frame, not a
  protocol ping (verified against pusher-js 8.6.0 source). The auto-response matches that
  exact string and replies without waking the DO, so the DO stays hibernated while idle.
- The auto-response is an optimization; `webSocketMessage` is the contract. If a client
  sends a non-exact ping, the frame wakes the DO and the handler replies `pusher:pong`. A
  byte mismatch costs a wake, never a dropped pong.
- Advertise 120. The client computes `min(120000, server * 1000, Infinity)`, so 120 makes
  both terms equal and leaves the client's cadence unchanged. We advertise what we enforce.
- 4201 is reachable only from `suspect`. The type makes it impossible to close with 4201
  without having sent a ping first, which is the protocol's own condition.
- The alarm is armed only while a suspect exists and deleted when none remain. A scheduled
  alarm is durable storage, not a JS timer, so it does not block hibernation; only the
  running handler is an event. A healthy DO with no suspects holds no alarm and hibernates
  forever.

Cost. Client pings are answered by the runtime and never bill. The DO bills only on real
events plus, for a genuinely dead client, one probe wake and one 30 s follow-up. An idle
fleet of many sockets costs storage, not duration.

### Tradeoffs accepted

- We accept that a half-open socket in a DO that never wakes is reaped only on the next
  organic event, in exchange for zero scheduled wakes; the leak is bounded by the
  32,768-socket cap and runtime TCP timeouts.
- We accept a byte-exact auto-response string that can silently miss after a client
  upgrade, in exchange for zero-wake heartbeats; a miss degrades to a wake.
- We accept a server-initiated 4201, in exchange for using the documented code for its
  documented meaning.

### Alternatives rejected

- **A per-connection `setInterval` ping.** The canonical Pusher shape; a pending timer
  blocks hibernation, so the DO bills continuously, and the timer dies on hibernation
  anyway.
- **A DO-wide alarm pinging all sockets every 120 s.** It survives hibernation (120 s is
  over the 10 s threshold) but is a permanent recurring wake plus an O(sockets) sweep that
  sends pings nobody asked for.
- **Pure auto-response with no reaper.** Free, but a dead client is never closed with 4201
  and presence rots; the suspicion-armed alarm is cheap enough to keep.
- **A permanent 15-minute backstop alarm.** Keeps a recurring wake on every DO even with
  zero suspects, which the suspicion-armed alarm eliminates.

### Open questions

- Does an auto-response reset the ~10 s hibernation timer? The pricing docs say
  auto-responses do not incur wall-clock time, which implies no, but this is the single
  assumption the whole decision rests on and needs a live idle test.
- Exact `getWebSocketAutoResponseTimestamp` semantics per socket.
- Whether the byte-exact ping holds across pusher-js versions; count unmatched pings to
  detect drift.

## D5: Presence membership and consistency

### Decision

Presence membership is a projection over the live sockets of a single-homed channel, never
a stored member set. The per-socket identity lives in the socket-to-channel row; the
deduped member set is computed on demand.

### Usage (caller's view)

```ts
// subscribe on a presence channel, inside the channel DO (single-threaded)
const before = this.members(channel);                       // projection
const admit = this.admit(channel, identity, limits);        // 100 / 1KB / 128 checks
if (!admit.ok) return reject(ws, admit.reason);
this.attach(ws, channel, identity);                         // write the subs row
const after = this.members(channel);
ws.send(subscriptionSucceeded(channel, after));             // ids, hash, count
for (const e of transitions(before, after)) this.fanout(channel, e, { except: ws });

// GET /apps/{id}/channels/{name}/users
return { users: this.members(channel).ids.map(id => ({ id })) };
```

### Shape

```ts
type MemberSet = { ids: readonly string[]; hash: Record<string, unknown>; count: number };

// pure; the whole presence surface
function projectMembers(rows: readonly SubRow[]): MemberSet;
function transitions(before: MemberSet, after: MemberSet):
  { kind: "added" | "removed"; userId: string }[];
```

Data flow. The member set is `projectMembers` over the live sockets on the channel,
grouped by `presence_user_id`, sorted so the payload is byte-stable. Join computes
`before` and `after` around the write; a user added iff absent before, removed iff absent
after. Multi-tab dedupe is grouping, not a refcount: a second socket for the same user
changes nothing, and the last socket leaving is the removal. Because the projection is
pure and recomputed, a deploy that drops every socket converges to the empty set on the
next fold, and reconnecting sockets re-derive it; there is no reconciliation job.

- Single home by construction. Presence channels are never sharded (D1) and cap at 100
  members, so all their sockets fit one `ChanDO`; the same-user-different-DO case is
  unrepresentable.
- Limits at the subscribe boundary: user id at most 128 chars, `user_info` at most 1 KB
  (measured on the canonical JSON bytes), and the 100-member cap checked before the write,
  so a rejected subscribe leaves no trace.
- Identity comes from the signed presence `channel_data`, or from a prior signin when
  `channel_data` is absent.
- The closing socket may still appear in `getWebSockets()`; the projection filters by
  `socket_id`, not list membership, so a mid-close socket is not counted.
- The member webhook is deferred about 3 s by alarm and cancelled if the user rejoins,
  matching the protocol's suppression window.

### Tradeoffs accepted

- We accept an O(members) fold per join and leave, in exchange for a member set that
  cannot drift from the sockets that justify it.
- We accept presence channels that cannot span DOs, in exchange for ruling out cross-DO
  dedupe instead of handling it.
- We accept no `member_removed` for sockets lost to a deploy without a close handler, in
  exchange for never emitting phantom removals; the next fold is correct.
- We accept a deferred webhook needing durable pending state, in exchange for the
  protocol's 3 s suppression.

### Alternatives rejected

- **A SQLite member table with per-user refcounts.** A second source of truth that drifts
  on a missed close and is stale by construction after a deploy.
- **A per-channel presence registry DO fed by socket DOs.** A DO hop and cross-DO ordering
  for a scale a 100-member channel does not need.
- **An event-sourced membership log.** Churn-proportional growth and snapshot logic to
  compute a fold the socket set gives free.
- **Membership in socket tags.** Tags are fixed at accept time, before subscribe.

### Open questions

- Is `deserializeAttachment()` readable inside `webSocketClose`? If not, a cold close
  reconstructs identity from the `subs` row before deleting it, and a missed
  `member_removed` self-heals on the next fold but arrives late.
- Attachment budget if identity is also cached inline; this design keeps it out of the
  attachment, so the budget is not at risk.

## System-level open questions

These cut across decisions and need a live spike before implementation commits. Each has
a probe.

| Question | Why it matters | Probe |
|---|---|---|
| Does an auto-response reset the ~10 s hibernation timer? | The whole D4 decision assumes it does not. | Open a socket, install the auto-response, idle 10+ minutes, assert the DO reports no duration and a ping still gets a pong. |
| Does DO stub RPC count against the 6-simultaneous-outgoing-connections limit? | Bounds D3's fan-out breadth and D1's cross-DO calls. | Fan out to 10 DOs at once from one invocation and observe whether it serializes. |
| Is `deserializeAttachment()` readable inside `webSocketClose`? | D2 recovery and D5 `member_removed` on clean close. | Close a socket and read the attachment in the close handler. |
| Does a pending (not running) alarm block hibernation? | D4 arms an alarm only while a suspect exists; a permanent block would defeat it. | Arm an alarm 5 minutes out, idle, and check whether the DO hibernates in the meantime. |
| Wake cost of an O(sockets) sweep at 32,768 sockets | D2 recovery and D4 reaper against the 30 s CPU budget. | Load 32k sockets, force a wake, measure CPU. |

## How these decisions were made

Each decision ran as an independent five-candidate exploration: five designs on the same
brief, a cross-judge scoring each against a fixed rubric, then a pick and graft. The
synthesis below names the base and what was ported.

| Decision | Base | Grafted in | Rejected |
|---|---|---|---|
| D1 | Four classes, disjoint prefixes, `socket_id`-encoded shard | Pinned-partition hot-channel escape from a competing candidate; `UserDO` for signin, watchlist, and terminate | One DO per app; one DO per channel; one DO per socket; a fixed all-channels ring |
| D2 | Constant-size attachment, membership as a SQLite relation | Tag the socket at accept so `socket_id` survives attachment loss; reconcile orphans by set difference on wake | Everything inline; pointer attachment; tags-as-index; in-memory index only |
| D3 | Fixed-breadth lanes with a durable journal | Bounded-degree relay tree for wide publishes; failure-only ledger writes | Flat parallel fan-out; Cloudflare Queues; one central fan-out DO |
| D4 | Suspicion-armed alarm, runtime auto-response, no server ping timer | The typed `Liveness` ADT where 4201 is reachable only from `suspect`; `deleteAlarm` when no suspects remain | Per-connection timer; DO-wide 120 s ping alarm; auto-response with no reaper; permanent 15-min backstop |
| D5 | Presence as a pure projection over live sockets | Filter the fold by `socket_id` so a mid-close socket is not counted; deferred 3 s member webhook | SQLite member table with refcounts; presence registry DO; event-sourced log; tags-as-membership |

Convergence signal: independent candidates agreed that (a) socket ownership and channel
ownership must be different actors, (b) hibernation forces every fact into the attachment,
SQLite, or `getWebSockets()`, and (c) presence must be derived, not stored. Where they
diverged (D4's reaper, D3's breadth), the cross-judge picked on which shape survives the
platform's actual cost model.

## Consequences for implementation order

1. **Pure routing and parsing first.** `shardOf`, the four DO-name builders, and
   `parseChannel` are pure functions with tests; the whole key space is fixed before any
   state work.
2. **One public channel end to end.** A `ConnDO` accepts, a `ChanDO` accepts a subscribe,
   a publish fans out to one socket. This proves D1 and D2 against the real runtime.
3. **Liveness.** Install the auto-response, verify the idle-cost assumption, then the
   suspicion-armed reaper.
4. **Presence.** The projection and transitions, with multi-tab add/remove tests.
5. **Fan-out scale.** The relay tree and the failure journal, once the connection-budget
   question is answered.

## Related

- [Pusher Channels WebSocket Protocol: Server Implementation Reference](../reference/pusher-websocket-protocol.md) — the wire contract these decisions satisfy.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — another DO-backed system; shows the same hibernation and SQLite constraints from the agent-harness side.

## Changelog

- 2026-10-15 — created. Five decisions, each explored by five independent design candidates (25 total) with a cross-judge per decision; synthesized and checked against the Pusher protocol reference and the Cloudflare Durable Objects documentation. Sources: protocol and DO docs listed in front matter, plus pinned pusher-js 8.6.0 and soketi 1.6.1 for wire-behavior cross-checks. The D4 auto-response byte match and the alarm-versus-hibernation interaction were verified against the pinned pusher-js source and the platform docs.
