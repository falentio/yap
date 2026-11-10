---
title: Storing Third-Party Credentials — OAuth Tokens and User-Supplied API Keys
category: technology
tags: [secrets, oauth, refresh-tokens, api-keys, encryption, kms, token-vault, rotation, revocation]
status: complete
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://www.rfc-editor.org/rfc/rfc6749.txt
  - https://www.rfc-editor.org/rfc/rfc9700.txt
  - https://www.rfc-editor.org/rfc/rfc5869.txt
  - https://www.rfc-editor.org/rfc/rfc7009.txt
  - https://www.rfc-editor.org/rfc/rfc9449/
  - https://apikeys.guide/docs/security/hashing-and-storage
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/api-keys-security-sensitive.html
  - https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html
  - https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
  - https://docs.aws.amazon.com/kms/latest/APIReference/API_DeriveSharedSecret.html
  - https://developer.hashicorp.com/vault/docs/secrets/transit
  - https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/
  - https://workos.com/blog/how-vault-local-encryption-works
  - https://workos.com/docs/vault
  - https://workos.com/blog/mtls-dpop-token-binding-sender-constrained-oauth
  - https://nango.dev/blog/concurrency-with-oauth-token-refreshes/
  - https://nango.dev/blog/best-token-vaults-and-credential-management-tools-for-ai-agents/
  - https://developers.apideck.com/guides/refresh-token-race-condition
  - https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation
  - https://www.ory.com/blog/oauth-token-lifecycle-management
  - https://www.scalekit.com/blog/OAuth-token-security-concerns
  - https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/
  - https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices
  - https://curity.io/resources/learn/scope-best-practices/
  - https://curity.io/resources/learn/oauth-refresh/
  - https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift
  - https://www.threatlocker.com/blog/klue-saas-supply-chain-compromise-through-long-lived-oauth-tokens
  - https://www.valencesecurity.com/resources/blogs/salesforce-oauth-token-breach-what-every-security-team-must-know
  - https://www.netsecurity.com/a-full-recap-of-salesforce-supply-chain-nightmare-how-one-breach-impacted-700-organizations/
  - https://circleci.com/blog/jan-4-2023-incident-report/
  - https://kb.torq.io/en/articles/10627995-testing-integration-instances-validate-your-connections
confidence: medium
---

# Storing Third-Party Credentials — OAuth Tokens and User-Supplied API Keys

Companion to [Storing User-Supplied Secrets](./secret-storage-for-user-api-keys.md), which carries the full classification. This file is only the branch where the secret comes **from a third party and must be replayed to that third party**: the user's OAuth grant, their pasted provider API key, their SMTP password, their webhook signing secret.

## TL;DR

- **This is the class you cannot hash.** RFC 6749 says refresh tokens "MUST be kept confidential in transit and storage", and the only way to do that against a database reader is encryption with a key held elsewhere ([RFC 6749 `10.4](https://www.rfc-editor.org/rfc/rfc6749.txt), [apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)).
- **A refresh token is a password with a longer life and no MFA.** "Refresh tokens are an attractive target for attackers because they represent the full scope of access granted to a certain client" ([RFC 9700 `4.14.1](https://www.rfc-editor.org/rfc/rfc9700.txt)).
- **One credential per user per provider, one DEK per row, KEK in a KMS, tenant and user IDs in the AAD** ([Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns), [AWS](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)).
- **Refresh through one owner per credential.** Concurrent refreshes are the top way integrations lose a working token for good ([Nango](https://nango.dev/blog/concurrency-with-oauth-token-refreshes/), [Apideck](https://developers.apideck.com/guides/refresh-token-race-condition/)).
- **The value is a standing grant, not data.** In August 2025 stolen OAuth tokens from one integration let an actor read hundreds of Salesforce orgs without a password or an MFA prompt ([GTIG](https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift)).

## Context

Storing a third-party credential means holding a capability on somebody else's account. Three properties define the design space, and all three point the same way:

| Property | Why it forces the design |
|----------|--------------------------|
| Must be replayed | Hashing is out; plaintext is needed on every call |
| The user cannot rotate it from your side | Rotation is a provider action, via the user or via the provider API using the credential itself |
| It outlives the session | Revoking your session cookie does nothing; only provider-side revocation does |

The credential types in scope, and where each comes from:

| Type | How it arrives | Replay identity |
|------|----------------|-----------------|
| OAuth 2.0 refresh token | Connect flow (consent screen) | Provider token endpoint |
| OAuth access token | Same | Provider resource server, ≤ 1 h |
| Provider API key | Paste field | Provider API, bearer or custom header |
| Basic-auth pair (SMTP, legacy REST) | Two paste fields | Provider API, Authorization Basic |
| Signing secret (webhook HMAC) | Provider dashboard, pasted | Inbound verification only, never sent |
| Service account JSON / client credentials | Upload or paste | Provider token endpoint |

## Findings

### 1. The normative requirement, quoted

OAuth 2.0 is explicit: "Refresh tokens MUST be kept confidential in transit and storage, and shared only among the authorization server and the client to whom the refresh tokens were issued," and the server "MUST maintain the binding between a refresh token and the client" ([RFC 6749 `10.4](https://www.rfc-editor.org/rfc/rfc6749.txt)). The same section names rotation as the compensating control where client authentication is impossible, and states the detection property exactly: if a stolen token is used beside the legitimate one, "one of them will present an invalidated refresh token, which will inform the authorization server of the breach" ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.txt)).

RFC 9700 (BCP 240, January 2025) tightens it: refresh tokens "MUST be bound to the scope and resource servers as consented by the resource owner", and for public clients the server "MUST utilize one of these methods to detect refresh token replay" — sender-constrained tokens ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449/)) or rotation ([RFC 9700 `4.14.2](https://www.rfc-editor.org/rfc/rfc9700.txt)).

"Confidential in storage" is where the schema comes in. Neither RFC names encryption, but the only way to satisfy it against a database reader is to make what is stored useless without a key held elsewhere. Hashing is unavailable: a token must be reproduced byte for byte, and a machine-generated token is high-entropy enough that hash comparison buys nothing the AEAD tag does not already give ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)).

### 2. The row shape

| Column | Contents |
|--------|----------|
| `id` | Random UUID; the only value ever exposed to a browser |
| `tenant_id`, `user_id`, `provider`, `account_ref` | Ownership; the whole tuple is the AAD |
| `secret_type` | `oauth_refresh`, `oauth_access`, `api_key`, `basic`, `signing_secret` |
| `ciphertext` | AEAD output, one DEK per row |
| `wrapped_dek`, `kek_id`, `dek_version` | The DEK sealed by the KEK in the KMS ([AWS](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)) |
| `scope`, `resource`, `expires_at` | What the token may do, and until when |
| `refresh_owner`, `last_refreshed_at`, `next_refresh_at` | Concurrency control (`4) |
| `status` | `active`, `invalid`, `revoked`, plus `invalid_reason` |
| `last_used_at`, `last_used_ip` | Anomaly detection and rotation candidates |

Access tokens live minutes, so the rule is: keep them in memory or a cache with a TTL below `expires_at`, encrypt only the refresh token, and re-derive the access token on demand. Persisting the access token buys one saved HTTP call and doubles the ciphertext you have to protect.

### 3. Per-row DEK, KEK in the KMS, AAD over the row

Envelope encryption per row means one compromised DEK costs one credential. AWS Secrets Manager does exactly this for third-party credentials: it "does not use the KMS key to encrypt the secret value directly. Instead, it uses the KMS key to generate and encrypt a 256-bit AES symmetric data key" ([AWS](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)). WorkOS Vault mints a single-use DEK per operation ([WorkOS](https://workos.com/blog/how-vault-local-encryption-works)).

Bind the ciphertext to its owner with AAD, so a row dragged between tenants fails to open — encryption context "is cryptographically bound to the ciphertext so that the same encryption context is required to decrypt the data" ([AWS](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)). WorkOS reaches the same place structurally: data encrypted under one organization's context "can't be decrypted using another organization's key" ([WorkOS](https://workos.com/blog/how-vault-local-encryption-works)).

Do not stop at one KEK for the whole table. AWS's per-tenant key pattern exists so one customer's key cannot unwrap another's data, and it doubles as the BYOK story enterprise buyers ask for ([AWS blog](https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/)). Three boundary tiers, in order of preference:

| Boundary | Key granularity | Use when |
|----------|-----------------|----------|
| Compliance scope | One KEK per region or regime | Always |
| Tenant | One KEK per organization | Enterprise or regulated buyers |
| Credential | One DEK per row | Always |

Then restrict the runtime role: `Decrypt` on specific key ARNs, conditioned on the encryption context, so a compromised worker cannot walk the table ([AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/api-keys-security-sensitive.html)).

### 3b. Per-tenant keys by derivation instead of wrapping

The instinct -- one master, a per-organization key derived from it with HMAC --
is sound at the shape level and wrong in two places as usually written. What it
gets right: context in the derivation keeps every AAD property, and nothing
wrapped has to be stored. What it gets wrong: it is not cheaper per row, and
the master ends up in the environment.

HKDF is the primitive, and the extract/expand split is the part people skip.
RFC 5869 section 3.1: "the use of salt adds significantly to the strength of
HKDF, ensuring independence between different uses of the hash function."
Section 3.2 on `info`: it "bind[s] the derived key material to application- and
context-specific information... it may prevent the derivation of the same keying
material for different contexts" ([RFC 5869](https://www.rfc-editor.org/rfc/rfc5869.txt)).
Separate the two roles: **scope goes in `info`** (RFC 5869 salt is
application-wide and reusable, section 3.1), **a fixed label is domain
separation**, and use a `hkdf()` helper rather than a hand-rolled HMAC on the info
block.

Why it is not per-row cheaper: measured on sqlite at 5,000 rows, derivation
stores 72 bytes/row against 136 and takes the same time within noise. Derivation
wins only where a wrapped DEK would need a KMS round-trip and nothing caches --
because 10,000 decrypted-on-boot rows cost 10,000 calls, 4.1 s at 20 ms RTT. The
saving is a boot-path saving, and it costs the master being in the process:
without the HSM, a leaked environment reads every tenant's rows, which is the
shared-KEK blast radius back again.

Rotation is the other correction. Rotating a KEK leaves stored `wrapped_dek` values
openable -- "when you use the rotated KMS key to decrypt ciphertext, AWS KMS uses
the key material that was used to encrypt it" -- but "key rotation has no effect
on the data that the KMS key protects" ([AWS](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)).
With pure derivation the key *is* the data protection, so a master rotation
re-encrypts every row.

### 3c. Env-var master, no KMS: what changes

Chosen for this deployment. It is not a smaller KMS, it is a different trust
boundary, and two of the corrections above invert.

**The master is now asset #1.** With a KMS the process holds no key material and
a leaked environment reads nothing offline. With the master in the environment,
whoever reaches the process reaches every tenant's rows. Concretely the env is
readable through container inspection, through /proc on the box, by every child
process, and out of a core dump; the commonest leak is a whole-env log line at
boot ([GTIG](https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift)
is the same shape at provider scale: reach a process, take what it can reach).
What still holds: the database and its backups alone are useless.

**Rotation stops being lazy under derivation.** With a KEK, rotation leaves
stored wrapped values openable, so it can be lazy. Here the key *is* the
protection, so either every row is re-encrypted or two live versions are kept.
The prototype keeps two: the version goes in the HKDF `info`, reads re-seal
older rows on the spot under a compare-and-swap, and dropping a version early
fails with the version name rather than a tag mismatch. An ordered env list makes
the active master explicit instead of implied.

**The audit trail is yours.** No CloudTrail logs decryption, so a
`credential_access` table is not optional bookkeeping: it is the only record of who
read which credential.

**Fail closed at boot.** An unset, short, or versionless master is a total
outage, so validation runs before the database opens and a fixed error names the
variable and the fix.

### 4. Refresh is a distributed-systems problem before it is a security one

The pattern that breaks production: several workers each notice expiry, each refreshes, the provider invalidates the previous token, and the slowest worker writes a dead one back. "In the worst case, you might lose your valid refresh token, making it impossible to refresh the access token in the future and forcing users to re-authenticate" ([Nango](https://nango.dev/blog/concurrency-with-oauth-token-refreshes/)).

The rules, in order:

1. **Single-flight per credential.** A row lock (`SELECT … FOR UPDATE`, or an advisory lock on the credential id); the loser waits and re-reads. Nango and Apideck both frame it as refresh once, then fan out the batch ([Nango](https://nango.dev/blog/concurrency-with-oauth-token-refreshes/), [Apideck](https://developers.apideck.com/guides/refresh-token-race-condition/)).
2. **Refresh ahead of the call, at a margin, not on the 401.** Apideck checks a 30-second pre-expiry window before processing ([Apideck](https://developers.apideck.com/guides/refresh-token-race-condition/)). Reacting only to a 401 makes every caller responsible for the retry.
3. **Where rotation applies, treat a race as a race, not a reuse.** Re-read the row before declaring the token stolen.
4. **Expect provider variation.** GitHub returns the same access token per client per refresh, which hides races; others rotate hard and will strand a careless writer ([Nango](https://nango.dev/blog/concurrency-with-oauth-token-refreshes/)).
5. **Never refresh inside a request handler that holds a transaction open** — the provider can take seconds.

Write back with a compare-and-swap on `last_refreshed_at` so a late worker cannot clobber a newer token.

### 5. Rotation, reuse detection, and the lifetimes to pick

"Access tokens should live 5 to 60 minutes. Refresh tokens should rotate on every use so that theft is detectable and automatically invalidates the entire token family" ([Ory](https://www.ory.com/blog/oauth-token-lifecycle-management)). Rotation kills the old token on exchange; presenting a dead one is the theft signal, and the correct response is to kill the family and force re-consent: "As soon as reuse is detected, all subsequent requests will be denied until the user re-authenticates" ([Auth0](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)).

Two caveats decide whether this is yours to implement. Rotation applies to tokens **you issue**; if you only store another provider's tokens you inherit their behaviour, so read their docs instead of assuming. And detection has a cost — a client that loses a race can trip it, which makes `4's single-flight a prerequisite rather than a nicety.

### 6. Revocation is a provider call, and deleting the row is not it

RFC 7009 defines the endpoint: the client notifies the authorization server "that a previously obtained refresh or access token is no longer needed", which "invalidate[s] the actual token and, if applicable, other tokens based on the same authorization grant" ([RFC 7009 `1](https://www.rfc-editor.org/rfc/rfc7009.txt)). Note the contract is deliberately forgiving — an invalid token still returns success, so a 200 does not prove the grant is gone ([RFC 7009](https://www.rfc-editor.org/rfc/rfc7009.txt)).

Which events require it:

| Event | Must call revoke? |
|-------|-------------------|
| User clicks Disconnect | Yes, before the row delete |
| User account deleted | Yes, for every credential |
| Suspected compromise | Yes, plus scope re-consent on reconnect |
| Provider says invalid (401, `invalid_grant`) | No, mark `invalid` and prompt a reconnect |
| User logs out of your app | No, unless you also revoke your own sessions |

Not every provider implements RFC 7009; some expose a vendor revoke, some only a "manage connected apps" page. Record per provider whether revoke exists, and where it does not, say so in the UI — the user's remaining lever is the provider dashboard.

### 7. Re-verify the credential instead of trusting the paste

A key that is wrong, truncated, or scoped to nothing produces support tickets and, worse, an `active` row that fails every call. Validate at connect time with one cheap authenticated request — a `/me`, a one-row list — and store the outcome ([Torq](https://kb.torq.io/en/articles/10627995-testing-integration-instances-validate-your-connections)). Torq's caveat is the honest one: the test "confirms the connection is working but does not verify that integration permissions are correctly configured" ([Torq](https://kb.torq.io/en/articles/10627995-testing-integration-instances-validate-your-connections)).

For OAuth the equivalent is a scope inventory after consent: read the granted scope set back from the token response, compare it to what the feature needs, and warn on a partial grant instead of discovering it at the first call.

### 8. Display rules for a stored third-party secret

Never re-display by default. Show type, account reference, granted scope, connected date, last used, and status; decrypt and reveal only behind a button. This also settles the retrievable-versus-irretrievable argument — retrievable wins where the user would otherwise paste the key into a text file, which is "far less secure than your dashboard" ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)) — but retrievable means the operator can reveal it, not that the list view does.

`account_ref` is not a secret and belongs in the clear: a login or email, so the user can tell two connections apart. Nylas's `grant_id` is the same idea at the provider's end — "just a 36-character UUID reference... can't authorize anything on its own" ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/)).

### 9. Scope minimization and honest consent

Granted scope is the ceiling on a stolen token's damage, so the consent screen is a security control: ask for narrow scopes per feature and for more only when the user reaches that feature ([Curity](https://curity.io/resources/learn/scope-best-practices/)). RFC 9700 adds that a refresh token must stay bound to the consented scope and resource ([RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.txt)), so widening later means fresh consent, not a silent refresh. For API keys you cannot narrow, push the lever to the provider: tell the user to mint a scoped, expiring key and link their docs.

### 10. Sender-constrained tokens, where a provider offers them

Bearer tokens are cash — "whoever holds the token can spend it" ([WorkOS](https://workos.com/blog/mtls-dpop-token-binding-sender-constrained-oauth)). DPoP ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449/)) binds a token to a client-held key pair, so a stolen token also needs the private key. The catch is architectural: the client proves possession per request, so a backend storing tokens on the user's behalf becomes the DPoP client itself or keeps the key pair beside the ciphertext. For most integrations DPoP is simply unavailable provider-side — treat it as a differentiator when choosing providers, not a knob you can turn.

### 11. Expect the credential to be used against you

The August 2025 Salesloft Drift campaign is the case study for this exact class: attackers took OAuth tokens from one integration and read Salesforce orgs "without triggering MFA", across roughly 700 organizations ([Valence](https://www.valencesecurity.com/resources/blogs/salesforce-oauth-token-breach-what-every-security-team-must-know), [NetSecurity](https://www.netsecurity.com/a-full-recap-of-salesforce-supply-chain-nightmare-how-one-breach-impacted-700-organizations/)). The tokens were valid, so nothing looked wrong. Google's remediation is blunt: "revoke the specific OAuth tokens", "revoke and rotate API keys, credentials, and authentication tokens associated with third-party application integrations" ([GTIG](https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift)). The primary intent, Google assesses, was credential harvesting ([GTIG](https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift)).

Three consequences for a storage design:

- **Rotation must be a query and a loop**, not a runbook written mid-incident. CircleCI's customers faced "rotate all secrets, including OAuth tokens, Project API Tokens, SSH keys" after a session compromise at the vendor ([CircleCI](https://circleci.com/blog/jan-4-2023-incident-report/)).
- **Long-lived is the amplifier.** The Klue compromise turned on precisely that: a long-lived OAuth token used to reach customer instances ([ThreatLocker](https://www.threatlocker.com/blog/klue-saas-supply-chain-compromise-through-long-lived-oauth-tokens)).
- **Egress is visible where MFA is not.** Last-used time and IP, alerted on, is the detection you actually have ([Obsidian](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices)).

### 12. Build it, or buy it

| Option | You own | The catch |
|--------|--------|-----------|
| Postgres columns + KMS envelope (`2–`5) | schema, crypto, refresh, revoke, audit | Days of work; every failure mode above is yours |
| Vault Transit | a Vault deployment | Crypto only; storage, refresh, and UI still yours ([Vault](https://developer.hashicorp.com/vault/docs/secrets/transit)) |
| Token vault (Nango, WorkOS Vault, Scalekit, Nylas) | an API integration | The vendor holds a capability on your users' accounts |

A token vault exists for exactly this job — it "stores each token, refreshes and revokes it, and injects it only when a call is made" ([Nango](https://nango.dev/blog/best-token-vaults-and-credential-management-tools-for-ai-agents/)). Nango is open source, which matters if custody cannot leave. WorkOS Vault and Nylas keep the plaintext out of your database and hand back a reference, at the price of their outage, their pricing, and a bypass as a failure mode. The hinge is whether your value sits in auth plumbing or above it: past a handful of providers, or once refresh reliability reaches the support queue, buy.

### 13. Where this class leaks

| Surface | Control |
|---------|---------|
| Post-decrypt memory and cache | Short TTL, one shared path, no logging of the object ([Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns)) |
| Logs and APM | Redact headers and body fields at the logger |
| Browser | Session only, in an httpOnly cookie; the credential never leaves the server |
| Backups and read replicas | Application-layer ciphertext is the only thing that helps (`3) |
| Support tooling and admin impersonation | Decide explicitly who may decrypt, and log every decrypt |

## Open Questions

- **Detection thresholds.** No source gives a rate or IP-velocity number for "unexpected use" of a third-party credential; any figure here will be local.
- **Which providers implement RFC 7009 at all.** Not compiled here, and needed before a Disconnect button can honestly promise anything. [unverified]
- **Whether revoke can be confirmed.** RFC 7009's invalid-token success response means a 200 proves little; whether a follow-up validation call is generally available is unknown. [unverified]
- **Vault exit.** No source covers migrating off a token vault when the plaintext was never in your database. [unverified]
- **Does AWS KMS support derivation itself?** Not as a symmetric API: `GenerateDataKey` is random, and `DeriveSharedSecret` needs an asymmetric ECC key pair plus a client-side ECDH, so server-side per-request derivation is not available there today ([AWS](https://docs.aws.amazon.com/kms/latest/APIReference/API_DeriveSharedSecret.html)).
- **Which scope unit actually helps?** Context already carries `tenant_id` and ships in the clear, so per-organization derivation changes nothing compared with per-row; deriving per organization only helps once the *master differs* per organization, i.e. with a per-tenant KEK. [unverified]

## Related

- Prototype: [`prototypes/third-party-credential-vault/`](../../prototypes/third-party-credential-vault/README.md) — this file's §2–§6 as running code against `node:sqlite`: 13 tests covering AAD binding, the refresh race, and revoke ordering. `WIRING.md` there swaps the local KEK for a real KMS.
- [Storing User-Supplied Secrets](./secret-storage-for-user-api-keys.md) — full classification, including passwords and self-issued keys.
- [Turso Data Loss & Data Exposure Incidents](./turso-data-loss-incidents.md) — response-side view of an exposure.
- [Durable pi State on an Ephemeral VM](./durable-pi-state-on-ephemeral-vm.md) — redaction rules for token-bearing logs.

## Changelog

- 2026-02-14 — created, split from the broader secret-storage research after scope narrowed to third-party credentials. Sources via TinyFish Search and Fetch Content; RFCs read from the plaintext renderings at rfc-editor.org.
- 2026-02-14 — Envelope encryption in our own database chosen over a token vault (§12’s first row), so §2–§6 is the operating path and §12’s vendor rows are the fallback. Implemented in `prototypes/third-party-credential-vault/`.
- 2026-02-14 -- added section 3b after the derivation question: HKDF over plain HMAC, the scope-in-info rule, and the measured refutation of deriving being cheaper per row. Both modes implemented in the prototype (21 tests), benchmarks in derive-vs-wrap-bench.txt.
- 2026-02-14 -- deployment narrowed to an env-var master with no KMS: added section 3c on the inverted trust boundary, a fail-closed boot guard, versioned masters with lazy re-seal, and an access log standing in for CloudTrail. Prototype now 37 tests.
