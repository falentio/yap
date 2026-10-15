---
title: Pusher Channels WebSocket Protocol: Server Implementation Reference
category: reference
tags: [pusher, websocket, realtime, protocol, channels, presence, encrypted-channels, webhooks, server-implementation]
status: complete
created: 2026-10-15
updated: 2026-10-15
sources:
  - https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
  - https://pusher.com/docs/channels/library_auth_reference/auth-signatures/
  - https://pusher.com/docs/channels/library_auth_reference/rest-api/
  - https://pusher.com/docs/channels/library_auth_reference/logging/
  - https://pusher.com/docs/channels/server_api/authenticating-users/
  - https://pusher.com/docs/channels/server_api/authorizing-users/
  - https://pusher.com/docs/channels/server_api/server-to-user-messages/
  - https://pusher.com/docs/channels/server_api/terminating-user-connections/
  - https://pusher.com/docs/channels/server_api/excluding-event-recipients/
  - https://pusher.com/docs/channels/server_api/webhooks/
  - https://pusher.com/docs/channels/using_channels/channels/
  - https://pusher.com/docs/channels/using_channels/cache-channels/
  - https://pusher.com/docs/channels/using_channels/connection/
  - https://pusher.com/docs/channels/using_channels/events/
  - https://pusher.com/docs/channels/using_channels/presence-channels/
  - https://pusher.com/docs/channels/using_channels/encrypted-channels/
  - https://pusher.com/docs/channels/using_channels/watchlist-events/
  - https://pusher.com/docs/channels/using_channels/authorized-connections/
  - https://pusher.com/docs/channels/using_channels/global-config/
  - https://pusher.com/docs/channels/miscellaneous/clusters/
  - https://github.com/pusher/pusher-js/tree/v8.6.0
  - https://github.com/pusher/pusher-http-node/tree/v5.3.4
  - https://github.com/pusher/pusher-http-python/tree/v3.3.2
  - https://github.com/soketi/soketi/tree/1.6.1
confidence: high
---

# Pusher Channels WebSocket Protocol: Server Implementation Reference

## Summary

Everything a server must send, must accept, and must reject to be a drop-in Pusher
Channels replacement, stated as wire behavior rather than prose. The protocol is
JSON-over-WebSocket, version 7, plus a signed HTTP API for publishing and a signed
webhook for server notifications. Every claim is anchored to either the official
protocol documentation or a pinned library checkout, and the protocol doc's version
numbers, error codes, and timeouts are matched exactly.

This is a reference, not a tutorial. Read it top to bottom once to build the model,
then use the section headings for lookup while implementing.

## Details

### 1. Transport and connection

One WebSocket per client, text frames only, UTF-8 JSON. Binary frames are not
supported and must be ignored or rejected
([protocol doc](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/)).

The client opens:

    [ws|wss]://ws-[cluster].pusher.com:[80|443]/app/[key]?protocol=7&client=js&version=8.6.0&flash=false

The path is `/app/` followed by the app key. The query string carries `protocol`
(integer version), `client` (a `platform-library` token such as `js`), `version`
(library version), and for pusher-js a literal `flash=false`. pusher-js builds the
query in a fixed order: `protocol`, `client`, `version`, then `flash`
([url_schemes.ts:14](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/transports/url_schemes.ts#L14)).
A compatible server may ignore all four query parameters; soketi reads only the path
key and parses no query parameters
([ws-handler.ts:278](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L278)).

The protocol version is 7
([defaults.ts:33](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/defaults.ts#L33)).
Protocols 1, 2, and 3 are no longer supported. When `protocol` is absent the server
historically inferred it from `version`, then fell back to protocol 1; the documented
replacement is close code 4008.

### 2. Handshake

The server sends `pusher:connection_established` as the first message on the socket.
The `data` field is a JSON-encoded string, not an object:

    { "event": "pusher:connection_established", "data": "{\"socket_id\":\"123.456\",\"activity_timeout\":120}" }

Two fields are required in `data`:

| Field | Type | Meaning |
|---|---|---|
| `socket_id` | String | Unique identifier for this connection. pusher-js exposes it as `connection.socket_id`. |
| `activity_timeout` | Number | Seconds of server inactivity after which the client should ping. Protocol 7 and above. |

pusher-js throws `Invalid handshake` for any other first event, and throws
`No activity timeout specified in handshake` when `activity_timeout` is falsy
([protocol.ts:73](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/protocol/protocol.ts#L73)).
A server that omits `activity_timeout` breaks every modern client, so treat it as
mandatory even though the field is documented only for protocol 7.

`socket_id` format is free-form for the server, but soketi emits two decimal integers
joined by a dot, `<random 0..1e10>.<random 0..1e10>`
([ws-handler.ts:785](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L785)),
matching the `1234.1234` shape used throughout the Pusher docs and the auth examples.

soketi advertises `activity_timeout` of 30 but enforces a 120 s inactivity timeout, a
known divergence worth not copying
([ws-handler.ts:138](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L138)).

### 3. Message framing

Every message is a single JSON object with an `event` name. Other keys depend on
direction:

| Key | Direction | Notes |
|---|---|---|
| `event` | both | Always present. |
| `data` | both | A string or an object. See double encoding below. |
| `channel` | both | Present on channel-scoped events. |
| `user_id` | server to client | Present only on client events delivered over a presence channel. |

**Double encoding.** The server should send `data` as a JSON string when the payload is
a hash, so that arbitrary publisher payloads (which may themselves be strings) survive
round-tripping. pusher-js decodes a message by `JSON.parse`-ing the frame, then, if
`data` is itself a string, `JSON.parse`-ing it a second time
([protocol.ts:25](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/protocol/protocol.ts#L25)).
Sending `data` as a nested object also works for non-string payloads, but the string
form is the one Pusher itself uses for all `pusher:` and `pusher_internal:` events.

The canonical example from the protocol doc:

    {"event":"pusher:connection_established","data":"{\"socket_id\":\"123.456\"}"}

Messages the server sends that carry no payload use `"data": "{}"` or omit `data`
entirely; pusher-js tolerates both.

### 4. Ping, pong, and liveness

Both sides treat any received message as proof of life. The check is symmetric: either
side may send a ping, and the other must answer with a pong.

Server side obligations:

- Answer a WebSocket protocol-level ping with a protocol-level pong, when the
  underlying transport supports it.
- Answer a `pusher:ping` event with `pusher:pong`, both with empty `data`.
- May send `pusher:ping` to the client at any time; the client answers with
  `pusher:pong`.
- May close with code 4201 if a sent ping goes unanswered.

Client side behavior to design around (pusher-js 8.6.0):

- Any inbound message resets the client's activity timer
  ([connection_manager.ts:270](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/connection_manager.ts#L270)).
- After inactivity the client sends `pusher:ping` with `{}`.
- The client's effective activity timeout is
  `min(client default 120000 ms, server activity_timeout * 1000, transport value || Infinity)`
  ([connection_manager.ts:297](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/connection_manager.ts#L297)).
  A server that advertises a large `activity_timeout` cannot make the client wait
  longer than 120 s, and a small value shortens the client's own ping interval.
- Defaults: activity timeout 120000 ms, pong timeout 30000 ms, unavailable timeout
  10000 ms
  ([defaults.ts:48](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/defaults.ts#L48)).
- If no pong arrives within the pong timeout the client immediately reconnects with
  zero delay.

The protocol doc's recommended client defaults are a 120 s activity timeout and a 30 s
pong wait, which is exactly what pusher-js uses.

### 5. Connection closure and error codes

The server closes the socket with a close code and reason. Clients must handle three
ranges: 4000-4099 do not reconnect unchanged, 4100-4199 reconnect after at least one
second, 4200-4299 reconnect immediately.

pusher-js maps the close code to an action as follows
([protocol.ts:104](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/protocol/protocol.ts#L104)):

| Code | Action | Client behavior |
|---|---|---|
| 1002-1004 | `backoff` | Retry after 1000 ms. |
| < 4000, other | none | Ignored, no reconnect scheduled by this path. |
| 4000 | `tls_only` | Switch to TLS and retry immediately. |
| 4001-4099 | `refused` | Disconnect. Do not reconnect. |
| 4100-4199 | `backoff` | Retry after 1000 ms. |
| 4200-4299 | `retry` | Retry immediately (0 ms). |
| >= 4300 | `refused` | Disconnect. |

There is no exponential backoff and no jitter: the two retry delays are exactly 0 ms
and 1000 ms
([connection_manager.ts:326](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/connection_manager.ts#L326)).
A server that wants a client to slow down must use a 4100-range code; a 4200-range code
produces an immediate reconnect loop.

The documented code list:

| Code | Meaning |
|---|---|
| 4000 | Application accepts SSL only, reconnect with `wss://`. |
| 4001 | Application does not exist. |
| 4003 | Application disabled. |
| 4004 | Application is over connection quota. |
| 4005 | Path not found. |
| 4006 | Invalid version string format. |
| 4007 | Unsupported protocol version. |
| 4008 | No protocol version supplied. |
| 4009 | Connection is unauthorized. |
| 4100 | Over capacity. |
| 4200 | Generic reconnect immediately. |
| 4201 | Pong reply not received. |
| 4202 | Closed after inactivity (client inactive for a long time, currently 24 hours, and does not support ping). |
| 4301 | Client event rejected due to rate limit. |
| 4302 | Watchlist limit exceeded, only the first 100 user IDs are accepted. |

For protocol 6 and above the server does not send `pusher:error` before closing; the
close code is the whole signal. Before closing on an older draft the server sends a
`pusher:error` event with the same code. pusher-js still reads a handshake-time
`pusher:error` `{code, message}` through the same close-code logic
([protocol.ts:82](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/connection/protocol/protocol.ts#L82)),
so sending `pusher:error` and then closing with a matching code is safe and is what
soketi does
([ws-handler.ts:86](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L86)).

### 6. Subscription

Client to server:

    { "event": "pusher:subscribe", "data": { "channel": "my-channel", "auth": "<key>:<sig>", "channel_data": "<json string>" } }

- `channel` is always present.
- `auth` is required for private, presence, and encrypted channels; for a public
  channel pusher-js sends `auth: ""`
  ([channel.ts:47](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/channel.ts#L47)).
- `channel_data` is present for presence channels and omitted when undefined
  ([channel.ts:136](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/channel.ts#L136)).

Unsubscribe:

    { "event": "pusher:unsubscribe", "data": { "channel": "my-channel" } }

pusher-js never expects an unsubscribe confirmation; soketi's is commented out.

**Server response.** On success the server must send
`pusher_internal:subscription_succeeded`, never `pusher:subscription_succeeded`.
The client intercepts the internal name and re-emits it locally as
`pusher:subscription_succeeded` with `data` passed through
([channel.ts:80](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/channel.ts#L80)).

For a public or private channel the success event may carry no `data`, or `{}`.
soketi sends no data
([ws-handler.ts:392](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L392)).

For a presence channel the success event carries the full member set:

    {
      "event": "pusher_internal:subscription_succeeded",
      "channel": "presence-example-channel",
      "data": "{\"presence\":{\"ids\":[\"user-1\",\"user-2\"],\"hash\":{\"user-1\":{\"name\":\"Phil\"},\"user-2\":{\"name\":\"Max\"}},\"count\":2}}"
    }

pusher-js reads only `presence.hash` and `presence.count`; it ignores
`presence.ids`
([members.ts:48](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/members.ts#L48)).
Send `ids` anyway, other client libraries use it.

**Client event rejection.** If authorization fails, the client fires
`pusher:subscription_error` locally; the server is not involved. The server itself
rejects a bad subscription over the socket by sending `pusher:error` or by sending
`pusher_internal:subscription_error`; soketi uses `pusher:subscription_error` with a
status code, which is a divergence from the documented event name. Prefer
`pusher:error` with a code, since that is the documented system error channel.

### 7. Channel types and naming

Type is decided by name prefix, and the check order matters because the prefixes nest:

| Order | Prefix | Type | Authorization |
|---|---|---|---|
| 1 | `presence-` | Presence | Required |
| 2 | `private-encrypted-` | Encrypted | Required, plus `shared_secret` |
| 3 | `private-` | Private | Required |
| 4 | anything else | Public | None |

pusher-js's own factory checks `private-encrypted-` first, then `private-`, then
`presence-`, and throws `BadChannelName` for a name starting with `#`
([channels.ts:66](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/channels.ts#L66)).
soketi checks presence first, then encrypted, then private
([ws-handler.ts:714](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L714)).
Either order is correct as long as `presence-` and `private-encrypted-` are tested
before the bare `private-` check that would otherwise swallow them.

Cache is an orthogonal modifier, applied as an extra prefix segment:

| Base type | Cache name |
|---|---|
| Public | `cache-<name>` |
| Private | `private-cache-<name>` |
| Encrypted | `private-encrypted-cache-<name>` |
| Presence | `presence-cache-<name>` |

Naming rules: maximum 164 characters including prefixes; allowed characters are
letters, digits, and `_ - = @ , . ;`; `#` is reserved for internal use and must be
rejected for client-supplied names
([channels doc](https://pusher.com/docs/channels/using_channels/channels/)). A server
may enforce a larger cap internally, but the public contract is 164.

### 8. Private, presence, and encrypted authorization

The server verifies the `auth` field of `pusher:subscribe` with HMAC-SHA256 over the
app secret. The auth string format is `<key>:<signature>`, signature lowercase hex
([auth signatures](https://pusher.com/docs/channels/library_auth_reference/auth-signatures/)).

| Channel type | String to sign |
|---|---|
| Private | `<socket_id>:<channel_name>` |
| Encrypted | `<socket_id>:<channel_name>` |
| Presence | `<socket_id>:<channel_name>:<channel_data>` |

`channel_data` is the exact JSON string the server's auth endpoint returned, signed
byte-for-byte; the presence server parses it to read `user_id` and `user_info`
([presence-channel-manager.ts:31](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/channels/presence-channel-manager.ts#L31)).

The two non-presence algorithms reproduce byte-for-byte against Pusher's worked examples
([auth signatures](https://pusher.com/docs/channels/library_auth_reference/auth-signatures/)),
checked with Node's crypto in this session:

| Case | String to sign | Signature |
|---|---|---|
| Private | `1234.1234:private-foobar` | `58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4` |
| User auth | `1234.1234::user::{"id":"12345"}` | `4708d583dada6a56435fb8bc611c77c359a31eebde13337c16ab43aa6de336ba` |

Both use key `278d425bdf160c739803` and secret `7ad3773142a6692b25b8`.

The presence worked example in the same doc is internally inconsistent: its Ruby
snippet builds `1234.1234:presence-foobar:{"user_id":10,"user_info":{"name":"Mr.
Channels"}}` but prints signature
`afaed3695da2ffd16931f457e338e6c9f2921fa133ce7dac49f529792be6304c`, which does not
reproduce from any spacing or escaping variant of that string under that secret. The
correct signature for the documented string is
`31935e7d86dba64c2a90aed31fdc61869f9b22ba9d8863bba239c03ca481bc80`. Treat the
three-part shape as the contract and the printed digest in that one example as wrong.
The soketi verifier and the presence channel manager confirm the shape.

Presence limits: 100 members per channel, 1 KB per user object, 128 characters per
user id. Exceeding the member count is a 4100-class close; an oversized user object is
a 4301 error
([presence doc](https://pusher.com/docs/channels/using_channels/presence-channels/),
[presence-channel-manager.ts:22](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/channels/presence-channel-manager.ts#L22)).

**Encrypted channels.** The client's auth endpoint returns an extra `shared_secret`,
base64, which is the per-channel decryption key. The client base64-decodes it and uses
it directly as the NaCl secretbox key; it does not derive anything from the channel
name
([encrypted_channel.ts:52](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/encrypted_channel.ts#L52)).
The publisher derives that key as `SHA256(channel_name_bytes || master_key_bytes)`,
raw 32 bytes, then base64-encodes it for the auth response. Node and Python agree on
the concatenation order, channel first
([pusher.js:289](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/pusher.js#L289),
[crypto.py:73](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/crypto.py#L73)).
The master key is either 32 raw bytes or base64 decoding to exactly 32 bytes
([config.js:29](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/config.js#L29)).
Because the server never sees the master key, the server is transparent to ciphertext:
it stores and forwards `{ciphertext, nonce}` verbatim. A compatible server must not
attempt to validate or re-derive the key.

### 9. Publishing: the HTTP API

Publishing is a separate HTTP surface, not the WebSocket. A Pusher-compatible server
exposes both. The API host is `api-[cluster].pusher.com` over HTTP or HTTPS; the
default host without a cluster is `api.pusherapp.com`
([clusters doc](https://pusher.com/docs/channels/miscellaneous/clusters/),
[pusher_config.js:6](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/pusher_config.js#L6)).
Cluster-to-host mapping is `api-` plus the cluster code; for the WebSocket it is `ws-`
plus the cluster code.

**Authentication.** Every request is signed with HMAC-SHA256 over the app secret. The
signed string is three newline-joined parts:

    <UPPERCASE METHOD>\n<request path>\n<sorted query string>

Rules that a verifier must reproduce exactly
([rest-api](https://pusher.com/docs/channels/library_auth_reference/rest-api/),
[requests.js:105](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/requests.js#L105),
[http.py:109](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/http.py#L109)):

- The method is uppercased before signing. The Node library uppercases; the Python
  library uses the caller's casing, which is uppercase in practice.
- The path is the request path including the `/apps/<app_id>` prefix, and excludes the
  query string.
- Query parameters are sorted ascending by key as plain string comparison.
- Each pair is `key=value`; pairs are joined with `&`.
- Values are **not** percent-encoded in the signed string
  ([util.js:3](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/util.js#L3),
  [http.py:47](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/http.py#L47)).
  A space or `&` in a value goes into the string raw. This is the one place a naive
  implementation diverges, because most HTTP clients would encode it.
- The `auth_signature` parameter itself is excluded from the signed set and appended
  after signing.

Required query parameters:

| Parameter | Value |
|---|---|
| `auth_key` | The app key. |
| `auth_timestamp` | Unix seconds. The server accepts a timestamp within 600 s of now. |
| `auth_version` | `1.0`. |
| `body_md5` | Hex MD5 of the request body, required for any request with a non-empty body. |
| `auth_signature` | HMAC-SHA256 hex digest. |

The Node library adds `body_md5` only when a body exists; the Python library adds it
even on GETs, hashing the empty string to `d41d8cd98f00b204e9800998ecf8427e`
([requests.js:88](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/requests.js#L88),
[http.py:102](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/http.py#L102)).
A compatible server must accept both forms, so treat `body_md5` as optional on a
request with no body and required when a body is present. The documented 600 s window
is real for Pusher; soketi enforces no window at all and only compares the signature
([http-handler.ts:657](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/http-handler.ts#L657)),
which is a replay hole, not a behavior to copy.

The protocol doc gives a complete worked example, including the exact string to sign and
the resulting signature `da454824c97ba181a32ccc17a72625ba02771f50b50e1e7430e47a1f3f457e6c`
for `POST /apps/3/events` with the documented credentials
([rest-api](https://pusher.com/docs/channels/library_auth_reference/rest-api/)).

This was checked end to end in this session: a mock HTTP server that verifies the
signature exactly as above accepted every request the official `pusher@5.3.4` library
sent, for `trigger`, `trigger` with `socket_id`, an encrypted publish, `sendToUser`,
`triggerBatch`, and `terminateUserConnections`. All six carried `auth_key`,
`auth_timestamp`, `auth_version`, and a `body_md5` that matched the body, at a
timestamp skew of 0 s. That is the strongest available proof that the algorithm in this
section is the one the ecosystem speaks.

**Endpoints.** Parameters go in the JSON body for POST and the query string for GET,
with `Content-Type: application/json` on POSTs that carry a body.

| Method | Path | Purpose |
|---|---|---|
| POST | `/apps/{app_id}/events` | Trigger one event on 1 to 100 channels. |
| POST | `/apps/{app_id}/batch_events` | Trigger up to 10 events, each on exactly one channel. |
| GET | `/apps/{app_id}/channels` | List occupied channels, optional `filter_by_prefix`, optional `info`. |
| GET | `/apps/{app_id}/channels/{name}` | One channel's info and, for cache channels, cached data and TTL. |
| GET | `/apps/{app_id}/channels/{name}/users` | User ids subscribed to a presence channel. |
| POST | `/apps/{app_id}/users/{user_id}/terminate_connections` | Terminate every connection authenticated as that user. |

The single-event body is `{name, data, channels}` or `{name, data, channel}`, plus
optional `socket_id` and `info`
([events.js:46](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L46)):

- `name`: event name, required. May contain letters, digits, `-`, `_`, and `:`.
- `data`: required. A string is passed through verbatim; any other value is
  `JSON.stringify`-ed by the library before sending
  ([events.js:65](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L65)).
  The server forwards `data` to subscribers unchanged.
- `channels`: array of 1 to 100 channel names, or `channel` for a single channel.
- `socket_id`: optional; the named connection is excluded from delivery.
- `info`: optional comma-separated list, `user_count` and `subscription_count`.

The batch body is `{batch: [{channel, name, data, socket_id?, info?}, ...]}`, each
entry on exactly one channel
([events.js:56](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L56)).
Publishing one event to multiple channels in a batch entry is an error.

**Response codes.** 200 success with a JSON body, 400 error with details in the body,
401 authentication error, 403 app disabled or over message quota, 413 body over the
10 KB data limit. The success body is an empty JSON hash, or, when `info` was
requested, `{"channels":{"presence-foobar":{"user_count":42,"subscription_count":51}}}`.
The `channels` route returns `{"channels":{"name":{"occupied":true,...}}}`; a single
channel returns `{"occupied":true,"user_count":42,"cache":{"data":"...","ttl":60}}`
([rest-api](https://pusher.com/docs/channels/library_auth_reference/rest-api/)).
soketi returns `subscription_count` and `occupied` but not `user_count` on the list
route, so match the documented fields rather than soketi's
([http-handler.ts:12](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/http-handler.ts#L12)).

**Sending to a user.** `sendToUser` is not a distinct endpoint. The library publishes
on the internal channel `#server-to-user-<user_id>` through the normal `/events`
path, which is why `#` is reserved
([pusher.js:160](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/pusher.js#L160)).
A compatible server must auto-subscribe every signed-in connection to that channel and
deliver there.

**Encrypted publishing.** A publish to a `private-encrypted-` channel encrypts `data`
before the HTTP call, using NaCl secretbox (XSalsa20-Poly1305) with the per-channel key
and a random 24-byte nonce. The value placed in `data` is
`JSON.stringify({nonce: <base64>, ciphertext: <base64>})`
([events.js:12](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L12),
[events.js:20](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L20)).
The ciphertext includes the 16-byte Poly1305 tag. Standard base64 with padding is used
by both libraries. Publishing to more than one channel when any is encrypted is
rejected client-side; the server should reject it too
([events.js:27](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/events.js#L27)).
The server never decrypts; it fans out `{ciphertext, nonce}` and each subscriber
decrypts with its `shared_secret`.

### 10. Client events

A client may publish directly over the socket. The rules the server enforces:

- The event name must start with `client-`. pusher-js refuses to send anything else
  ([channel.ts:53](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/channel.ts#L53)).
- The channel must be private or presence. soketi enforces membership rather than
  re-checking the prefix, but a strict server rejects client events on public channels.
- Encrypted channels reject client events; pusher-js throws `UnsupportedFeature`
  ([encrypted_channel.ts:59](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/encrypted_channel.ts#L59)).
- On a presence channel the server injects `user_id` into the delivered frame, taken
  from the subscribing connection's presence identity
  ([presence_channel.ts:68](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/channels/presence_channel.ts#L68),
  [ws-handler.ts:601](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L601)).
  The client surfaces it as callback metadata, not as event data.
- Rate limiting is the server's job. On breach, send `pusher:error` code 4301.
  soketi also uses 4301 for an oversized event payload or name
  ([ws-handler.ts:541](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L541)).

The delivered frame is a normal channel event:

    { "event": "client-something-updated", "channel": "presence-room", "data": "<payload>", "user_id": "user-1" }

The server must not echo a client event back to its sender.

### 11. User signin, server-to-user messages, termination, watchlist

**Signin.** After the connection is established the client may send:

    { "event": "pusher:signin", "data": { "auth": "<key>:<sig>", "user_data": "<json string>" } }

`auth` is signed over `<socket_id>::user::<user_data>`, where `user_data` is the exact
JSON string carried in the payload
([auth signatures](https://pusher.com/docs/channels/library_auth_reference/auth-signatures/),
[ws-handler.ts:762](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L762)).
`user_data` must contain `id` as a non-empty string; it may also carry `user_info`
and `watchlist`. Signin fails if the connection is already signed in as a different
user.

The server answers:

    { "event": "pusher:signin_success", "data": "{\"user_data\":\"<json string>\"}" }

pusher-js `JSON.parse`-es `data.user_data`, requires a non-empty string `id`, then
auto-subscribes the connection to `#server-to-user-<id>`
([user.ts:113](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/user.ts#L113),
[user.ts:146](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/user.ts#L146)).
On failure send `pusher:error`; a strict server may close with 4009. soketi closes
with 4009
([ws-handler.ts:629](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L629)).

A user counts as online while at least one connection is signed in as that id. Multiple
connections per user are allowed and each is subscribed to the server-to-user channel.

**Watchlist.** The `watchlist` in `user_data` is an array of user ids, capped at 100.
Over the cap the signin still succeeds with the first 100 and the server also sends
`pusher:error` code 4302. Online and offline transitions are delivered as
`pusher_internal:watchlist_events` whose `data.events` is an array of
`{name: "online"|"offline", user_ids: [...]}`
([watchlist.ts:17](https://github.com/pusher/pusher-js/blob/f53faf9f33dbab922a45a919607f4c87ad1b7f72/src/core/watchlist.ts#L17)).

**Termination.** `POST /apps/{app_id}/users/{user_id}/terminate_connections` closes
every connection signed in as that user. The user may reconnect unless the app also
rejects future signin. soketi sends `pusher:error` 4009 on each socket then closes and
responds `{"ok":true}`
([namespace.ts:172](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/namespace.ts#L172)).

**Authorized connections.** An optional app setting that requires every connection to
sign in or subscribe to a private or presence channel within a timeout, after which the
server closes it. soketi's default is 30 s and the close is 4009
([userauth doc](https://docs.soketi.app/advanced-usage/user-authentication.md),
[ws-handler.ts:822](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L822)).

### 12. Presence fan-out events

While subscribed, presence members receive membership changes as internal events that
the client re-emits locally:

| Wire event | Data | Client-visible event |
|---|---|---|
| `pusher_internal:member_added` | `{"user_id": "...", "user_info": {...}}` | `pusher:member_added` with `{id, info}` |
| `pusher_internal:member_removed` | `{"user_id": "..."}` | `pusher:member_removed` with `{id, info}` |

The server sends `member_added` to the existing members when a user subscribes, and
`member_removed` when the last connection for that user leaves
([ws-handler.ts:416](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L416),
[ws-handler.ts:482](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L482)).
The deduplication rule matters: a user with several tabs is added once, when the first
tab subscribes, and removed once, when the last closes. Do not send `member_added` to
the joining connection itself; it learns the full set from
`subscription_succeeded`.

### 13. Cache channels

A cache channel stores the last published event and delivers it to a new subscriber as
the first event on the channel. Cache is a name-prefix modifier on any base type
(section 7).

Server behavior:

- On publish to a cache channel, store `{event, data}` with a TTL.
- On subscribe, if a cached event exists, send it as the first channel event after
  `subscription_succeeded`; the frame is a normal `{event, channel, data}`.
- If the cache is empty or expired, send `pusher:cache_miss` to that subscriber and
  fire a `cache_miss` webhook, deduplicated across simultaneous subscribers so the
  server makes one call, not one per client.
- Client events are not cached.

soketi replays the cached event on subscribe and otherwise sends `pusher:cache_miss`
with no data
([ws-handler.ts:698](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/ws-handler.ts#L698)).
Its default TTL is 3600 s, while Pusher documents a TTL of up to 30 minutes
([cache doc](https://pusher.com/docs/channels/using_channels/cache-channels/),
[http-handler.ts:386](https://github.com/soketi/soketi/blob/5d188786beaf683aca2115a6247dcdc15c29ac77/src/http-handler.ts#L386)).
Pusher's 30 minutes is the number to match if compatibility is the goal.

The cached data and its remaining TTL are queryable through
`GET /apps/{app_id}/channels/{name}` as `cache: {data, ttl}`.

### 14. Webhooks

The server POSTs JSON to the app's configured URL. The body is:

    { "time_ms": 1327078148132, "events": [ { "name": "channel_occupied", "channel": "my-channel" } ] }

With batch webhooks disabled `events` holds exactly one entry; with it enabled it holds
several, so a receiver must iterate
([webhooks doc](https://pusher.com/docs/channels/server_api/webhooks/)). The receiver
answers 2XX; a non-2XX triggers a retry with exponential backoff for five minutes.

Authentication headers:

| Header | Value |
|---|---|
| `X-Pusher-Key` | The app key that signed the webhook. With multiple tokens, the oldest active one. |
| `X-Pusher-Signature` | HMAC-SHA256 hex digest of the raw request body, keyed with the app secret. |

The signature is over the exact bytes of the body, before any parsing
([webhook.js:54](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/webhook.js#L54),
[signature.py:35](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/signature.py#L35)).
Compare in constant time. The Node verifier also requires
`content-type: application/json`; the Python verifier additionally rejects a payload
whose `time_ms` is more than 300 s from now
([webhook.js:67](https://github.com/pusher/pusher-http-node/blob/076bc1ffa80e4b8ad969bc4505b314ebb70dcf9b/lib/webhook.js#L67),
[authentication_client.py:134](https://github.com/pusher/pusher-http-python/blob/239d67b7a047a18ee181922c0a1461ceaf7c565f/pusher/authentication_client.py#L134)).
A compatible server sets both a correct content type and a current `time_ms`.

Event types and payloads:

| `name` | Extra fields |
|---|---|
| `channel_occupied` | `channel` |
| `channel_vacated` | `channel` |
| `cache_miss` | `channel` |
| `member_added` | `channel`, `user_id` |
| `member_removed` | `channel`, `user_id` |
| `client_event` | `channel`, `event`, `data`, `socket_id`, `user_id` on presence |
| `subscription_count` | `channel`, `subscription_count` |

Two timing rules that affect ordering. Channel-occupancy and member events are delayed
by up to three seconds after a disconnect, and are suppressed entirely if the client
reconnects within that window, so momentary drops do not flap your server state.
`subscription_count` is emitted per change, and on channels over 100 connections it is
coalesced to at most one per five seconds.

### 15. Limits

| Limit | Value |
|---|---|
| Event data payload | 10 KB, else HTTP 413 |
| Channels per single publish | 1 to 100 |
| Events per batch | 10 |
| Channel name length | 164 characters including prefix |
| Channel name charset | `A-Za-z0-9` and `_ - = @ , . ;`; `#` reserved |
| Presence members per channel | 100 |
| Presence user object | 1 KB |
| User id length | 128 characters |
| Watchlist entries | 100 |
| Webhook retry window | 5 minutes, exponential backoff |
| Auth timestamp tolerance | 600 s |

### 16. Implementation checklist

The load-bearing obligations, in the order a connection meets them:

1. Accept `/app/<key>` with any query string, and reject an unknown key with close 4001.
2. Send `pusher:connection_established` first, with `socket_id` and `activity_timeout`
   as a JSON string in `data`. Nothing else is accepted as a handshake.
3. Answer `pusher:ping` with `pusher:pong`; reset the inactivity timer on any inbound
   message; close with 4201 on an unanswered ping.
4. Classify a subscription by prefix with `presence-` and `private-encrypted-` tested
   before `private-`, then verify `auth` with the HMAC string for that type.
5. Reply with `pusher_internal:subscription_succeeded`, carrying `presence.ids`,
   `presence.hash`, and `presence.count` for presence channels.
6. Fan out `pusher_internal:member_added` and `member_removed` with the multi-tab
   deduplication rule, and never to the joining connection.
7. Forward client events with the `client-` rule, private and presence only, injecting
   `user_id` on presence, rate-limited with code 4301, never echoed to the sender.
8. Implement the signed HTTP API, the `/events` and `/batch_events` bodies, the
   `/channels` and `/channels/{name}/users` reads, and terminate-connections.
9. Auto-subscribe signed-in connections to `#server-to-user-<id>`, and route
   `sendToUser` publishes there.
10. Store and replay cache events, emit `pusher:cache_miss` on an empty cache, and
    deduplicate the `cache_miss` webhook.
11. Sign webhooks over the raw body with the app secret and send
    `X-Pusher-Key` and `X-Pusher-Signature`.
12. Map every close to the documented 4000/4100/4200 band; the client's reconnect
    behavior is a direct function of the band, with no jitter to soften a wrong choice.

## Gotchas

- **`pusher_internal:` vs `pusher:`.** The server sends the `_internal` name; the client
  re-emits the plain name locally. Sending `pusher:subscription_succeeded` from the
  server makes pusher-js treat it as a user event and the subscription never completes.
- **`activity_timeout` is mandatory in practice.** The doc lists it for protocol 7, but
  pusher-js 8.x throws on its absence, so every real client depends on it.
- **The signed query string is not URL-encoded.** Reproduce the raw `key=value` join, or
  a value containing a space or `&` produces a signature mismatch that is painful to
  trace.
- **`body_md5` is inconsistent across official libraries.** Node omits it on bodyless
  requests, Python includes it. Accept both.
- **soketi skips the timestamp window.** Its HTTP handler compares the signature and
  nothing else, so a captured request replays forever. Do not copy that; enforce the
  600 s window.
- **soketi advertises `activity_timeout` 30 but enforces 120 s.** Advertise what you
  enforce.
- **Client reconnect is a step function, not a curve.** Only 0 ms and 1000 ms exist.
  A 4200-band close on a server that is actually overloaded produces a hot reconnect
  loop; use 4100 for "slow down".
- **`presence.ids` is ignored by pusher-js.** Send it for other SDKs, but never rely on
  a client reading it.
- **Client events must not echo to the sender.** The whole point of the feature is
  broadcasting to the others.
- **Encrypted channels are transparent to the server.** It cannot verify the
  `shared_secret` and must not try; it forwards `{ciphertext, nonce}` byte-for-byte.
- **`#` is reserved.** The internal server-to-user channel uses it, so client-supplied
  names must reject it.
- **Cache TTL is "up to" 30 minutes.** Pusher does not guarantee the full window, so
  treat the TTL as a ceiling, not a promise.

## Open Questions

- Whether Pusher's live server accepts a query string where the library leaves a value
  unencoded while the wire form is percent-encoded. The libraries sign the raw string;
  the server side is out of scope of every client repo, so this is verified only from
  the signing side.
- The exact server error JSON body shape on 4xx and 5xx. The official client libraries
  capture only the status and raw text.
- Whether `pusher:subscription_count` is emitted by the live server; soketi does not
  emit it and pusher-js only handles the inbound event.
- Whether the live server tolerates a missing `body_md5` on GET. The two official
  server libraries disagree, so the tolerance is inferred from the doc's "non-empty
  body" wording.

## Related

- [oh-my-pi (omp) — Complete Agent Tool Inventory](./oh-my-pi-tools.md) — an example of a
  surface-and-protocol inventory in this same reference category.
- [Effect v4 Primitives — A Reader's Map](./effect-v4-primitives.md) — reference style in
  this category, useful for the model-first framing if this doc is expanded.
- [Architectural Decisions for a Pusher-Compatible Server on Cloudflare Durable Objects](../technology/pusher-server-durable-objects-architecture.md)
  — the design that implements this contract on Cloudflare Durable Objects.

## Changelog

- 2026-10-15 — created. Protocol doc plus pinned checkouts of pusher-js 8.6.0
  (`f53faf9`), pusher-http-node 5.3.4 (`076bc1f`), pusher-http-python 3.3.2
  (`239d67b`), and soketi 1.6.1 (`5d18878`). Research gathered through curl, a
  documented fallback: the TinyFish MCP server was not available in this session, so
  results are cross-checked against pinned source to hold confidence high.
- 2026-10-15 — added runtime evidence: the private and user-auth worked examples
  reproduce byte-for-byte under Node crypto; the doc's printed presence signature does
  not and is recorded as a doc error; the encrypted-channel KDF matches
  `pusher@5.3.4` exactly; and a mock server verifying the documented signature
  accepted all six request shapes the real library sent.
