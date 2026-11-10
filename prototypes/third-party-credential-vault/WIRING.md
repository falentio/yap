# Wiring this into your app

The deployment target is a master key in the environment, no KMS. That moves the
work: there is no service to call, so the boot guard and the leak surface become
the engineering.

## The boot guard, first

A missing or wrong master is a total outage — every stored credential is
ciphertext nobody can open. `loadMasters()` therefore runs **before** the
database opens and throws rather than defaulting:

| Bad input | Outcome |
|---|---|
| unset or blank | refuses to boot, names the variable and points here |
| no `vN:` prefix | refuses to boot |
| version not a positive integer | refuses to boot |
| key shorter than 32 bytes | refuses to boot, states the byte count |
| the same version twice | refuses to boot, the active master would be ambiguous |

Generate once, store in the platform's encrypted secret store, inject as an env
var:

```bash
node -e 'console.log("v1:" + require("crypto").randomBytes(32).toString("base64"))'
```

```bash
CREDENTIAL_MASTER_KEYS="v1:<that value>" node src/boot.ts
```

Keep the value in a password manager or KMS-free secret store too. Losing it is
losing every stored credential.

## The leak surface this adds

With no KMS the process holds the master, so what the env touches matters:

| Surface | Now | Watch for |
|---|---|---|
| Container inspect / `docker` API | env is visible to anyone who can inspect the container | read access to the orchestrator is equivalent to read access to every credential |
| `$TOP_PID/environ` | root on the box reads the master without touching the DB | the box's SSH access is now credential access |
| Child processes | every subprocess inherits it | a spawned `sh` or debug tool can dump it |
| Crash dumps and core files | a core dump contains the master | disable cores or treat them as secrets |
| Dirty `process.env` logs | a whole-env `console.log` at boot is the commonest leak | log only the version, never the value |
| Build and CI logs | a `set -x` around the export prints it | mask it, as CI platforms mask secrets |
| The value's origin | someone `cat`s the value while setting it up | shell history |

Backups of the database no longer equal readable credentials — the ciphertext is
useless without the env — so the master lives in a different blast radius from
the data. Keep it that way: do not write it to the app's own config store or a
second table in the same database.

## Rotation

`CREDENTIAL_MASTER_KEYS` takes an ordered list; the **first entry is the active
master**, the rest only open. Rotation is a lazy re-seal, not a migration:

1. Deploy `v2:<new>,v1:<old>` — writes use v2, reads still open v1.
2. Reads of v1 rows re-seal them under v2 on the spot, CAS-guarded, in the same
   transaction as the read. No batch job, no downtime.
3. Once `SELECT COUNT(*) FROM credentials WHERE master_version < 2` is 0, deploy
   `v2:<new>`.
4. Keep the old master in a vault for a while anyway: a stale replica or an
   unrestored backup may still hold v1 rows.

Reads against a master that is no longer loaded fail with
`master v1 is not loaded`, which names the missing version rather than a bare
tag mismatch — the recovery is to put the old value back.

## What to keep, and the order

1. `schema.sql` — the AAD columns, `master_version`, and `credential_access`.
2. `src/config.ts` — the guard as written; extend rather than relax it.
3. `src/crypto.ts` — unchanged.
4. `src/vault.ts` — unchanged, except `Db` becomes your driver's type.
5. `src/refresh.ts` and `src/revoke.ts` — unchanged; your provider and revoker
   adapters slot in.

## Two notes the prototype cannot show

- **`SELECT … FOR UPDATE` instead of the CAS.** Both the reseal and the refresh
  write use single-statement compares so sqlite can test the race. Postgres can
  hold a row lock for the duration of a network refresh; do that and re-read
  inside the lock.
- **The audit table is yours now.** `credential_access` exists because there is
  no CloudTrail logging decryptions for you. Write to it on every decrypt, and
  ship it to append-only storage rather than letting it grow beside the data it
  audits.

## What is deliberately missing

HTTP handlers, session auth, provider-specific OAuth adapters, and per-tenant
masters (add the latter when a customer asks: the `kek_id` and
`master_version` columns already carry the handles).

## If a KMS is ever bought

`src/kms.ts` is the whole boundary. `localKms()` is already the wrap shape a KMS
wants — `generateDataKey` / `decrypt` with the context as AAD — so the change is
that one file plus keeping the master out of the env. Everything above, including
the guard and the rotation rules, still holds.
