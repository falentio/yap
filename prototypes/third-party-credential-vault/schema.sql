-- Reference schema for third-party credential storage.
-- Postgres in production; node:sqlite in this prototype (TEXT/INTEGER map 1:1).
--
-- INVARIANT: every column in the aad_columns() tuple is populated on insert and
-- is covered by the AEAD tag. Moving a row or editing these columns makes the
-- ciphertext fail to open instead of opening as the wrong user's credential.

CREATE TABLE credentials (
  id               TEXT PRIMARY KEY,          -- random UUID; the only id a browser sees
  tenant_id        TEXT NOT NULL,             -- AAD
  user_id          TEXT NOT NULL,             -- AAD
  provider         TEXT NOT NULL,             -- AAD
  account_ref      TEXT NOT NULL,             -- in the clear: a login, not a secret
  secret_type      TEXT NOT NULL CHECK (secret_type IN
                     ('oauth_refresh','oauth_access','api_key','basic','signing_secret')),

  -- envelope encryption
  ciphertext       TEXT NOT NULL,             -- AEAD output, base64: iv || tag || bytes
  wrapped_dek      TEXT NOT NULL,             -- the per-row DEK, sealed by the KEK
  dek_iv           TEXT NOT NULL,             -- iv for the DEK wrap, base64
  kek_id           TEXT NOT NULL,             -- which master sealed this DEK (rotation handle)
  master_version   INTEGER NOT NULL,          -- version of the env master; part of the KDF info
  dek_version      INTEGER NOT NULL DEFAULT 1,
  aad_json         TEXT NOT NULL,             -- the exact AAD used, stored verbatim
  alg              TEXT NOT NULL DEFAULT 'AES-256-GCM',

  -- what the token may do
  scope            TEXT,
  resource         TEXT,
  expires_at       INTEGER,                   -- access-token expiry, epoch ms

  -- concurrency: refresh happens only while holding these
  refresh_owner    TEXT,
  refresh_lease_until INTEGER,                 -- column order matters. see claim_refresh()
  last_refreshed_at INTEGER,
  next_refresh_at  INTEGER,

  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','invalid','revoked')),
  invalid_reason   TEXT,

  created_at       INTEGER NOT NULL,
  last_used_at     INTEGER,
  last_used_ip     TEXT
);

-- one credential per user per provider account; reconnect replaces, never duplicates
CREATE UNIQUE INDEX credentials_owner_uq
  ON credentials (tenant_id, user_id, provider, account_ref);

-- refresh scheduling scan
CREATE INDEX credentials_due_idx ON credentials (status, next_refresh_at);

-- No KMS in this deployment, so nothing upstream logs decryption. The audit
-- trail that CloudTrail would have given us is ours to write.
CREATE TABLE credential_access (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_id TEXT NOT NULL,
  tenant_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('reveal','reseal','revoke')),
  outcome       TEXT NOT NULL CHECK (outcome IN ('ok','failed')),
  reason        TEXT,
  master_version INTEGER,
  at            INTEGER NOT NULL
);
CREATE INDEX credential_access_by_credential ON credential_access (credential_id, at);
