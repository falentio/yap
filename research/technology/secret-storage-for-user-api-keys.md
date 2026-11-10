---
title: Storing User-Supplied Secrets — API Keys, Tokens, and Auth Material in Your App
category: technology
tags: [secrets, encryption, kms, api-keys, oauth, key-management, envelope-encryption, security]
status: complete
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
  - https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final
  - https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf
  - https://apikeys.guide/docs/security/hashing-and-storage
  - https://zuplo.com/learning-center/how-to-implement-api-key-authentication
  - https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
  - https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html
  - https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/
  - https://developer.hashicorp.com/vault/docs/secrets/transit
  - https://workos.com/blog/application-level-data-encryption
  - https://baffle.io/blog/transparent-data-encryption-is-not-enough/
  - https://workos.com/blog/envelope-encryption-explained
  - https://www.scalekit.com/blog/OAuth-token-security-concerns
  - https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/
  - https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/
  - https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices
  - https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-14.html
  - https://curity.io/resources/learn/scope-best-practices/
  - https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/aes-256-gcm
  - https://www.electronjs.org/docs/latest/api/safe-storage
  - https://circleci.com/blog/jan-4-2023-incident-report/
  - https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/
  - https://aembit.io/blog/workloadiam-vs-secrets-managers/
  - https://www.doppler.com/blog/workload-identity-vs-secrets
  - https://www.thesoc2.com/post/audit-logging-requirements-for-soc-2-what-events-to-capture-and-how-long-to-keep-them
confidence: high
---

# Storing User-Supplied Secrets — API Keys, Tokens, and Auth Material in Your App

## TL;DR

- **Which direction the secret flows decides the design.** A key a user pastes in (their OpenAI key, their SMTP password, their OAuth refresh token) is a **password**: one-way hash it if you only need to compare it, encrypt it if you must decrypt it. A key *you* issue is also a password — store a SHA-256 hash plus a display prefix, never the value ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- **Encrypt at rest at the application layer, not with the database's TDE.** Under TDE, anyone with a DB session — an injectable query, a backup, a read-replica, a DBA — reads plaintext ([baffle.io](https://baffle.io/blog/transparent-data-encryption-is-not-enough/), [workos](https://workos.com/blog/application-level-data-encryption)).
- **The key that decrypts ciphertext must not live in the database or the app's environment.** Envelope encryption: a KMS-held key-encryption key wraps a per-user data key; the ciphertext row is useless without a KMS round-trip ([AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html), [Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns)).
- **Encryption at rest is table stakes, not the finish line.** Tokens must be decrypted to be used, so the real question is the runtime layer, the blast radius of a stolen session, and whether you can revoke ([Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns), [Obsidian](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices)).
- **Design for the breach you have already had.** Show-once, rotation, revocation, and an audit trail are what turn a database dump into a nuisance instead of an incident.

## Context

The prompt was "I want to store secrets from my user — API keys, auth, etc." That is four different problems wearing one word:

| What | Direction | You need it back? | The design |
|------|-----------|-------------------|------------|
| User's password | User → you | No, compare only | Slow hash (Argon2id/bcrypt) |
| Key **you** issued (own API tokens) | You → user | No, compare only | SHA-256 of the key + lookup prefix |
| Key **the user** supplies (OpenAI key, SMTP password, webhook signing secret) | User → you → third party | Yes, must send upstream | Encrypt at rest, envelope, KMS |
| OAuth refresh/access token | Provider → you → provider | Yes | Encrypt at rest + rotation + revocation |

Confusing classes 1–2 with class 3 is the commonest mistake in both directions: encrypting what should be hashed (secrets you only ever compare), or hashing what must be decrypted (the app can no longer call OpenAI). The rest of this file covers the storage and lifecycle controls; `7 covers the surfaces that leak the secret before storage even matters.

## Findings

### 1. Classify first: "do you need it back?" decides hash or encrypt

Authentication material has two storage families, and the split is cryptographic, not stylistic.

**Hash (irreversible) when you only ever compare.** Passwords: "Passwords should never be stored in plain text. Instead, they must be protected using strong, slow hashing algorithms such as Argon2id, bcrypt, or PBKDF2" and "Fast hashing algorithms such as SHA-256 are not suitable" for them ([OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). OWASP's floor is Argon2id at 19 MiB memory, 2 iterations, parallelism 1; scrypt at N=2^17, r=8, p=1 as fallback; bcrypt work factor ≥ 10 for legacy ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).

**SHA-256 — not Argon2 — is correct for machine-generated keys, yours or a user's**, because entropy inverts the tradeoff: "a properly generated key has 128+ bits of entropy. No attacker is brute-forcing a random 32-byte string, regardless of how fast the hash function is." Slow hashing buys nothing there, and the deterministic digest makes lookup O(1) ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)). Store an identifier prefix — `zpka_`, `sk_live_`, `sk_test_` — separately so a human, a log line, and GitHub's scanner can tell what a string is and which row it belongs to, while the secret half stays hashed ([zuplo](https://zuplo.com/learning-center/how-to-implement-api-key-authentication)). Show the key once at creation and treat it as gone: "Irretrievable keys are shown once at creation and never stored in a reversible form... This is the approach used by Stripe, AWS, and GitHub for sensitive credentials" ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)).

**Encrypt (reversible) when the app must present the secret to a third party.** You cannot hash a user's OpenAI key, SMTP password, or refresh token; they must come back out. This is where classification ends and the encryption design starts.

Hashing does not survive without a keyed component. A bare `sha256(key)` of a *user-supplied* key is crackable against a dictionary of known key formats; add a server-side pepper, the same way OWASP recommends peppering password hashes to survive a DB-only compromise ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). For keys you issue the pepper matters less (full 256-bit entropy), but it is free defense in depth.

### 2. Encrypt at the application layer, because TDE does not answer the threat

Transparent Data Encryption is the default mental model and it protects the wrong thing:

- "But anybody with access to the database can still retrieve the data and view it in clear text" — TDE defends against a stolen disk, not a login ([baffle.io](https://baffle.io/blog/transparent-data-encryption-is-not-enough/)).
- "TDE doesn't protect against insider threats, like employees or trusted users who have legitimate access to the encrypted database... It also doesn't safeguard data in the event of... SQL injection attacks" ([workos](https://workos.com/blog/application-level-data-encryption)).
- Least privilege is the same argument from the other side: "even the DBA should not be able to access the data unless necessary to do their job" ([baffle.io](https://baffle.io/blog/transparent-data-encryption-is-not-enough/)).
- Open-source Postgres has no TDE at all; managed versions give you full-disk encryption, which is the same shared-key model ([baffle.io](https://baffle.io/blog/transparent-data-encryption-is-not-enough/)).

Application-level encryption means the value is ciphertext before it reaches the driver, so a `SELECT *` in psql, a nightly dump, a read replica, or an analytics pipeline all yield nothing usable. That is the control that makes the rest of this file worth anything.

### 3. Envelope encryption: the KEK never lives with the data

Two layers, one held by a KMS, one per record:

| Layer | Lives | Rotates | Compromise impact |
|-------|-------|---------|-------------------|
| Key-encryption key (KEK) / master key | KMS / HSM | Yearly at most, transparently | Catastrophic, and the reason it lives in an HSM |
| Data key (DEK), one per user or row | Wrapped, stored beside the ciphertext | Re-wrap only | Limited to that record |

AWS Secrets Manager documents the shipped pattern: it "does not use the KMS key to encrypt the secret value directly. Instead, it uses the KMS key to generate and encrypt a 256-bit AES symmetric data key, and uses the data key to encrypt the secret value" ([AWS](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)). Rotating the KEK is then cheap, because "when you use the rotated KMS key to decrypt ciphertext, AWS KMS uses the key material that was used to encrypt it" — old ciphertext keeps working, no bulk re-encryption ([AWS KMS rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)). Two limits stated plainly: "Key rotation has no effect on the data that the KMS key protects. It does not rotate the data keys... Key rotation will not mitigate the effect of a compromised data key" ([AWS](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)), and changing a secret's encryption key leaves old versions under the previous key so you are not locked out ([AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)).

The naive single-key version is exactly as bad as it sounds: one AES key in an env var, and "to rotate, you need to decrypt every encrypted field with the old key and re-encrypt it with the new one... So most teams skip it. The key sits there for years, accumulating risk" ([workos](https://workos.com/blog/envelope-encryption-explained)).

**Per-tenant DEKs are the multi-tenant form.** Scalekit runs one DEK per customer environment with the master key in GCP KMS, "architecturally separated from both the database and the application layer," so "a database breach yields nothing actionable" and tenant isolation is structural rather than a `WHERE tenant_id = ?` convention ([Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns)). AWS's version is one KMS customer-managed key per tenant behind an alias, which also buys BYOK and provable separation for enterprise buyers ([AWS blog](https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/)).

Three ways to run the crypto, ordered by how much you own:

| Backend | The app does | Fits when |
|---------|--------------|-----------|
| Vendor API (Vault Transit, KMS Encrypt/Decrypt) | HTTP call, no key material | Small volume, you want zero key custody ([Vault Transit](https://developer.hashicorp.com/vault/docs/secrets/transit)) |
| KMS GenerateDataKey + local AEAD (envelope) | AAD, nonce, wrap storage | Normal production; the standard pattern ([AWS](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)) |
| Full service (Vault KV, Secrets Manager) | Store and fetch by name | The vendor's API is your runtime, or you want rotation built in ([Vault](https://developer.hashicorp.com/vault/docs/secrets/transit)) |

### 4. Bind the ciphertext to its row (AAD), and get the AEAD right

Ciphertext that can move between rows is a live hazard: swap two users' `openai_key` blobs and nothing fails until the wrong account is billed. AWS's encryption context is this, and it is not optional — it is "cryptographically bound to the ciphertext so that the same encryption context is required to decrypt the data," and it can be a constraint in grants and IAM conditions ([AWS encryption context](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)). Pass `{tenant_id, user_id, secret_name, key_version}` as AAD on every call.

Nonce discipline is the other half. Libsodium's own AES-256-GCM page is a warning label: "safely using AES-GCM in a different context is tricky... nonces are short and repeated nonces would totally destroy the security of this scheme. Nonces should thus come from atomic counters," and it recommends AEGIS-256 instead unless AES-GCM is required ([libsodium](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/aes-256-gcm)). The counting limit is real — Vault says "For AES-GCM keys, rotation should occur before approximately 2^32 encryptions have been performed by a key version, following... NIST publication 800-38D" ([Vault Transit](https://developer.hashicorp.com/vault/docs/secrets/transit); the limit is in [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf)). Use a library's seal/open (libsodium `crypto_aead_*`, `age`, `@noble/ciphers`) rather than assembling `createCipheriv` by hand, and store the nonce beside the ciphertext.

**Never put a secret in an encryption-context value**: encryption context "is not secret and not encrypted. It appears in plaintext in AWS CloudTrail Logs" ([AWS](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)).

### 5. Secret zero: the app gets into the KMS without a stored secret

The bootstrap credential is the hole in every vault design: "the workload still needs an initial credential to authenticate to the vault itself. That bootstrap secret has to live somewhere, whether in an environment variable, a config file or a deployment script" ([Aembit](https://aembit.io/blog/workloadiam-vs-secrets-managers/)). Fix it with platform identity — IRSA on EKS, GKE Workload Identity, Azure federated credentials, an EC2 instance profile — where "the workload authenticates through its platform identity rather than a stored bootstrap credential" ([Aembit](https://aembit.io/blog/workloadiam-vs-secrets-managers/)).

The dependency chain is worth stating, because it decides how much the rest buys you:

```
KMS key → decrypts DEKs → decrypt secrets
```

Whoever reaches the app *process* gets the plaintext, the DEKs, and the KMS role. So scope the KMS role to `Decrypt` on one key ARN, add an encryption-context condition, and keep the runtime identity narrower than the deploy identity. Where a long-lived cloud key genuinely cannot be removed, that is the one secret to keep in the platform's secret manager and inject at runtime — "secrets managers govern credentials that cannot be eliminated" ([Doppler](https://www.doppler.com/blog/workload-identity-vs-secrets)).

### 6. OAuth tokens: the hardest case, and why they get their own controls

A refresh token is a standing key that mints access tokens and "doesn't expire on its own, and a provider has no way to know that the request came from an attacker who pulled it out of your database" ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/)). Two consequences:

- **Refresh tokens bypass MFA and SSO on every use after the first**, "creating an invisible attack path that traditional controls cannot stop," and they persist for weeks or months while access tokens last an hour ([Obsidian](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices)).
- **The token outlives your session model.** A stolen refresh token keeps working after the user logs out of your app, so revocation must be a first-class flow against the provider, not a row delete.

Required, not optional: request the narrowest scope set at consent, since granted scopes are what the token can do ([Curity](https://curity.io/resources/learn/scope-best-practices/)); implement refresh-token rotation if you issue tokens, because it "guarantees that every time an application exchanges a refresh token... a new refresh token is also returned," with reuse detection ([Auth0](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)); treat the provider's own revocation (password change, consent withdrawn) as a status transition with a webhook or poll, and surface an actionable task instead of an unexplained 401 ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/)).

Where a provider offers indirection, prefer it: Nylas issues a `grant_id` — "just a 36-character UUID reference... A `grant_id` column doesn't need encryption the way a refresh token does, because it can't authorize anything on its own" — and holds the real secret in its vault ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/)). Token vaults (Scalekit, WorkOS Vault, Nango) sell that custody, so this section has two valid answers: build it or buy it.

If you also authenticate *users* with OAuth, keep the two token sets apart: your session token authenticates the user to you; the stored third-party refresh token authenticates you to the provider as them. Mixing them is how provider tokens end up in an identity cookie.

### 7. Where the secret actually leaks (front channel, disk, logs, git)

Encryption at rest protects the store. It does nothing for these:

| Surface | Failure | Control |
|---------|---------|---------|
| Browser JS | `localStorage` is readable by any XSS on the origin ([openreplay](https://blog.openreplay.com/cookies-vs-localstorage-jwt-auth/)) | httpOnly + `Secure` + `SameSite` cookie, or a BFF proxy ([IETF BCP](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-14.html)) |
| Token in a URL | Leaks via browser history, `Referer`, logs ([Obsidian](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices)) | Authorization code flow; never tokens in query strings ([IETF](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-14.html)) |
| Logs and error trackers | Authorization headers and bodies captured by APM | Redact at the logger, not at each call site ([Obsidian](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices)) |
| Desktop app | OS keychain via `safeStorage` on macOS/Windows — but on Linux "if no secret store is available, items... will be unprotected as they are encrypted via hardcoded plaintext password" ([Electron](https://www.electronjs.org/docs/latest/api/safe-storage)) | Check `safeStorage.getSelectedStorageBackend()` and warn ([Electron](https://www.electronjs.org/docs/latest/api/safe-storage)) |
| Source control | 28.65M new hardcoded secrets in public GitHub commits in 2025, +34% YoY ([GitGuardian](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/)) | gitleaks/TruffleHog pre-commit hook plus a CI gate |
| MCP and tool configs | 24,008 unique secrets in public config files, 2,117 still valid ([GitGuardian](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/)) | Treat config files as a secret surface |

GitGuardian's data shapes the review: internal repos are 6× more likely to contain hardcoded secrets than public ones, and the docs teach the bad habit — "popular MCP setup guides often recommend putting API keys directly into configuration files, command-line arguments, or embedded connection strings" ([GitGuardian](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/)).

Server-side runtime is the real blast radius: "encryption at rest protects your database. It does not protect tokens that have been decrypted and loaded into runtime, application memory, caches" ([Scalekit](https://www.scalekit.com/blog/OAuth-token-security-concerns)). A short-TTL in-memory cache of a decrypted value is fine; a shared Redis is a second copy of the plaintext and needs its own access control.

### 8. Lifecycle: show once, rotate, revoke, audit

A stored secret is only as safe as your ability to invalidate it.

- **Show once, never re-show.** Display the key at creation with its prefix; afterwards show prefix, created date, and last-used only ([apikeys.guide](https://apikeys.guide/docs/security/hashing-and-storage)).
- **Rotation must be cheap or it will not happen.** For your own keys, allow N concurrent active keys with an overlap window and a last-used timestamp. For stored third-party secrets, re-wrap the DEK instead of re-encrypting everything ([AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)).
- **Revocation is a button.** Deleting the row only helps if the provider is told too. Store the provider identifier and scope needed to call its revoke endpoint ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/)).
- **Audit reads, not just writes.** Who decrypted which credential, when, for which tenant. Encryption context is designed to be the query key for exactly this ([AWS](https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html)); SOC 2 expects the trail ([SOC 2 logging requirements](https://www.thesoc2.com/post/audit-logging-requirements-for-soc-2-what-events-to-capture-and-how-long-to-keep-them)).
- **Write the mass-rotation runbook before you need it.** CircleCI's January 2023 incident forced this: the report recommends "that all customers rotate their secrets, including OAuth tokens, Project API Tokens, SSH keys, and more," and CircleCI shipped a secret-finding script plus audit-log access so customers could see what was touched ([CircleCI incident report](https://circleci.com/blog/jan-4-2023-incident-report/)). The entry point was a stolen, 2FA-backed SSO session from malware on an engineer's laptop — not a database break, and every stored secret was still in scope ([CircleCI](https://circleci.com/blog/jan-4-2023-incident-report/)).

### 9. The shape, end to end

```
users ──paste key──▶ POST /secrets
                       │ 1. classify: hash-only? encrypt?
                       │ 2. AAD = {tenant, user, name, version}
                       ▼
                     KMS ──GenerateDataKey──▶ plaintext DEK + wrapped DEK
                       │
                       ▼ 3. AEAD seal with DEK and AAD
        secrets(user_id, name, prefix, ciphertext, wrapped_dek, key_version, aad_json)
                       │
                       ▼ 4. use: KMS Decrypt(wrapped_dek, same AAD) → DEK → open
                  third-party call ──▶ 5. audit row {who, which, when, result}
```

Deliberate choices in that sketch: ciphertext and its wrapped DEK sit in the same row so they cannot drift; `key_version` names the KEK so rotation is a re-wrap, not a migration; the AAD is stored verbatim so decryption fails loudly if a row is moved or a field is edited; the plaintext DEK is never persisted.

### 10. Build it or buy it

| Option | You own | Time to first secret | When it wins |
|--------|--------|----------------------|--------------|
| Postgres columns + app envelope via KMS | schema, crypto, rotation, audit | days | One cloud, modest volume, one datasource |
| Vault Transit / KV | operational Vault | hours, plus a Vault runner | You already run Vault and want crypto-as-a-service ([Vault](https://developer.hashicorp.com/vault/docs/secrets/transit)) |
| Token vault (Scalekit, WorkOS Vault, Nango, Nylas) | an integration | hours | OAuth-heavy product where refresh and revoke are their job ([Nylas](https://developer.nylas.com/docs/cookbook/use-cases/build/store-oauth-credentials/), [WorkOS](https://workos.com/blog/envelope-encryption-explained)) |

Do not reach for these: a shared environment variable as the *store* for user secrets (it is a deploy artifact — one global copy, no per-user scope, first thing in a container dump); a column type that claims encryption but keys on a hardcoded value (pgcrypto with an inlined key is the shared-key problem, slower); the database's own TDE as the only control (`2).

### Comparison table — control coverage by class

| Control | Password class | Issued-key class | Third-party-key / OAuth class |
|---------|---------------|------------------|-------------------------------|
| Storage primitive | Argon2id / bcrypt | SHA-256 + pepper | AEAD ciphertext + wrapped DEK |
| Recoverable by you | No | No | Yes, via KMS |
| Show once | n/a | Yes, mandatory | Yes, at paste time |
| Rotation | user-driven | overlap window + last-used | re-wrap DEK, provider re-consent |
| Revocation | session invalidation | row delete + audit | provider revoke endpoint |
| Leak blast radius | one account, after cracking | one integration | one tenant's third-party access |
| Audit read | login events | request log | decrypt log keyed by AAD |
| Front-channel storage | httpOnly cookie | same | httpOnly cookie or vault reference |

## Open Questions

- **Threshold where key-per-tenant stops paying.** AWS's post argues cost against key count but names no break-even; the trade against alias sharding needs a measurement, not a blog ([AWS blog](https://aws.amazon.com/blogs/architecture/simplify-multi-tenant-encryption-with-a-cost-conscious-aws-kms-key-strategy/)).
- **DEK caching policy.** Everyone caches decrypted values in memory; no source here gives a TTL or eviction rule. Measure KMS latency against a TTL of your own.
- **Crypto-shredding as erasure.** Dropping a per-user DEK makes the ciphertext unreadable in one operation — the natural pairing with per-user DEKs — but no source found here states a retention rule for the wrapped DEK itself. [unverified] against regulator guidance.
- **The 63% figure.** AWS-workos cites a 2023 IBM study that 63% of breaches involving encrypted databases came from application vulnerabilities ([workos](https://workos.com/blog/application-level-data-encryption)); the primary report was not read here.
- **Provider scope drift.** Whether revoked scopes take effect on refresh differs by provider; per-provider test required. [unverified]

## Related

- [Storing Third-Party Credentials — OAuth Tokens and User-Supplied API Keys](./third-party-credential-storage.md) — the deep dive for the class that must be decrypted and replayed: RFC 6749/9700 requirements, row shape, single-flight refresh, revocation, and token-vault build-vs-buy.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) — covers org-internal, infrastructure-side secrets; this file covers the user-supplied half and the leak surfaces around it.
- [Durable pi State on an Ephemeral VM](./durable-pi-state-on-ephemeral-vm.md) — a session log on ephemeral disk is a secret-adjacent artifact; the same redaction rules apply.
- [Turso Data Loss & Data Exposure Incidents](./turso-data-loss-incidents.md) — what an exposure incident looks like from the operator's side.

## Changelog

- 2026-02-14 — created. Every external source gathered with TinyFish Search and read with Fetch Content; no fallback fetches.
