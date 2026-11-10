# third-party-credential-vault

A reference implementation of [Storing Third-Party Credentials](../../research/technology/third-party-credential-storage.md):
per-row envelope encryption against a real database, with the concurrency and
revocation paths that make the storage safe to operate.

Built because the decision was to envelope in our own database rather than hand
custody to a token vault. Everything the research file calls a MUST or a
must-not is a test here.

## Run

```bash
node --test test/     # 37 tests, no dependencies, no network
tsc --noEmit          # types
CREDENTIAL_MASTER_KEYS="v1:$(openssl rand -base64 32)" node demo.ts   # watch it store and fail
```

Node 26 is required (built-in `node:sqlite` and TypeScript execution).

## What each test pins down

| Test | The rule |
|---|---|
| round-trip leaves no plaintext in the row | the value is ciphertext before the driver sees it |
| each row gets its own DEK and IV | one compromise costs one credential |
| moving a row to another tenant fails | AAD binding, the mixed-row case |
| editing `user_id` fails | same, for an in-place edit |
| a foreign wrapped DEK will not unwrap | the KEK layer binds the context too |
| revoked rows refuse to reveal | status gates use, not just listing |
| the unique index stops duplicates | one credential per user/provider/account |
| boot refuses a missing, short, or versionless master | fail closed, never a default |
| a v1 row re-seals to v2 on read | rotation without a migration |
| dropping a master names the version it needs | recoverable failure, not a tag mismatch |
| every reveal is logged, ok or failed | the audit a KMS would have given us |
| boot refuses a missing, short, or versionless master | fail closed, never a default |
| a v1 row re-seals to v2 on read | rotation without a migration |
| a dropped master names the version it needs | recoverable failure, not a tag mismatch |
| every reveal is logged, ok or failed | the audit a KMS would have given us |
| `claimRefresh` picks one winner | single-flight refresh |
| an expired lease can be stolen | a crash cannot wedge a row |
| not-yet-due means no claim | refresh ahead, not on demand |
| concurrent refresh = one provider call | the race that strands tokens |
| a provider throw clears the lease | failure leaves the row reusable |
| disconnect revokes first, then marks | RFC 7009 before the row delete |
| a failed revoke stays retryable | 200-vs-error is not conflated |

## Two modes: wrap, or derive

`localKms()` wraps a random DEK per row. `derivedKms()` drops the DEK and
derives the row key from one master with the row's context as input.

```bash
node bench/derive-vs-wrap.ts   # write/read cost and stored bytes, both modes
node bench/cold-start.ts       # what a real KMS round-trip does to each mode
```

Local measurements (5,000 rows, sqlite, warm): 72 vs 136 stored bytes per row,
and within noise of each other on time. The number that decides it is not in
the datastore at all — see [derive-vs-wrap-bench.txt](./derive-vs-wrap-bench.txt) and
[WIRING.md](./WIRING.md#derived-mode-the-trade-in-writing).

## No KMS: the master is an env var

Target deployment is `CREDENTIAL_MASTER_KEYS`, an ordered `vN:base64` list, no
service. `src/config.ts` guards it and boot fails closed on every malformed
shape — an empty or short master is a total outage, not a degraded mode.

That choice moves cost rather than removing it: the process holds the master, so
the container's env is as sensitive as the database. [WIRING.md](./WIRING.md)
names the leak surfaces (inspect, `/proc`, child processes, cores, env logging)
and the rotation runbook, which is a lazy re-seal across two live versions.

`localKms()` stays in the tree: it is the wrapped shape a KMS would want, and a
single-file swap if one is ever bought.

## Layout

| File | Role |
|---|---|
| `schema.sql` | the table, the AAD columns, the owner index |
| `src/crypto.ts` | AES-256-GCM, nonce and tag handling, the AAD tuple |
| `src/boot.ts` | guard, then open: the order is the point |
| `src/config.ts` | env master loading and the fail-closed guard |
| `src/kms.ts` | key boundary: `envKms` (default), `localKms` (wrapped) |
| `src/vault.ts` | `put` / `reveal` |
| `src/refresh.ts` | lease, pre-expiry margin, compare-and-swap write-back |
| `src/revoke.ts` | revoke-then-mark disconnect |
