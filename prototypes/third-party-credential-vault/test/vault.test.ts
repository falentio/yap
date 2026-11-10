import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Vault, type Db } from "../src/vault.ts";
import { localKms } from "../src/kms.ts";
import { CiphertextError } from "../src/crypto.ts";
import { claimRefresh, refreshWithLease, REFRESH_MARGIN_MS } from "../src/refresh.ts";
import { disconnect } from "../src/revoke.ts";

const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

function fresh() {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  db.exec(schema);
  return { db, vault: new Vault(db, localKms({ kekId: "kek-eu-1" })) };
}

const input = (over: Record<string, unknown> = {}) => ({
  tenant_id: "t_acme",
  user_id: "u_1",
  provider: "openai",
  account_ref: "ada@acme.test",
  secret_type: "api_key",
  secret: "sk-live-abc123",
  ...over,
});

test("put/reveal round-trips without the plaintext touching the row", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  const row = db.prepare("SELECT * FROM credentials WHERE id = ?").get(id);

  assert.equal(await vault.reveal("t_acme", id), "sk-live-abc123");
  assert.equal(JSON.stringify(row).includes("sk-live-abc123"), false, "plaintext leaked into the row");
  assert.equal(row!.kek_id, "kek-eu-1");
  assert.equal(row!.alg, "AES-256-GCM");
});

test("each row gets its own DEK and IV", async () => {
  const { db, vault } = fresh();
  await vault.put(input());
  await vault.put(input({ account_ref: "grace@acme.test" }));
  const rows = db.prepare("SELECT wrapped_dek, dek_iv, ciphertext FROM credentials").all();
  assert.notEqual(rows[0].wrapped_dek, rows[1].wrapped_dek);
  assert.notEqual(rows[0].dek_iv, rows[1].dek_iv);
  assert.notEqual(rows[0].ciphertext, rows[1].ciphertext, "same plaintext must not produce the same ciphertext");
});

test("moving a row to another tenant fails to open (AAD binding)", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET tenant_id = 't_evil' WHERE id = ?").run(id);
  // the id is found under the new tenant, but the stored AAD no longer matches the row
  await assert.rejects(vault.reveal("t_evil", id), CiphertextError);
});

test("editing the user_id breaks the credential", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET user_id = 'u_2' WHERE id = ?").run(id);
  await assert.rejects(vault.reveal("t_acme", id), CiphertextError);
});

test("a wrapped DEK from one row will not unwrap in another tenant's context", async () => {
  const { db, vault } = fresh();
  const a = await vault.put(input());
  const b = await vault.put(input({ account_ref: "grace@acme.test" }));
  const dekB = db.prepare("SELECT wrapped_dek, dek_iv FROM credentials WHERE id = ?").get(b);
  db.prepare("UPDATE credentials SET wrapped_dek = ?, dek_iv = ? WHERE id = ?").run(dekB!.wrapped_dek, dekB!.dek_iv, a);
  await assert.rejects(vault.reveal("t_acme", a), CiphertextError);
});

test("reveal refuses a revoked row", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET status = 'revoked' WHERE id = ?").run(id);
  await assert.rejects(vault.reveal("t_acme", id), /credential is revoked/);
});

test("the unique owner index stops duplicate connections", async () => {
  const { vault } = fresh();
  await vault.put(input());
  await assert.rejects(vault.put(input()), /UNIQUE/);
});

// ---------------------------------------------------------------- concurrency

test("claimRefresh: one winner, the loser waits", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET next_refresh_at = ? WHERE id = ?").run(Date.now() - 1, id);
  assert.equal(claimRefresh(db, id, "w1"), true);
  assert.equal(claimRefresh(db, id, "w2"), false, "second worker must not get the lease");
  // the lease expiring lets a waiter take over, so a crashed worker cannot wedge the row
  db.prepare("UPDATE credentials SET refresh_lease_until = ? WHERE id = ?").run(Date.now() - 1, id);
  assert.equal(claimRefresh(db, id, "w2"), true);
});

test("claimRefresh: not due yet means no claim", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET next_refresh_at = ? WHERE id = ?").run(Date.now() + 10 * REFRESH_MARGIN_MS, id);
  assert.equal(claimRefresh(db, id, "w1"), false);
});

test("refreshWithLease: concurrent refreshes produce exactly one provider call", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input({ secret_type: "oauth_refresh", secret: "rt_1" }));
  db.prepare("UPDATE credentials SET next_refresh_at = ? WHERE id = ?").run(Date.now() - 1, id);

  let calls = 0;
  const provider = {
    async refresh() {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { access_token: "at", refresh_token: `rt_${calls + 1}`, expires_in: 3600 };
    },
  };
  const harness = async (owner: string) =>
    refreshWithLease(db, provider, id, {
      owner,
      unwrap: () => vault.reveal("t_acme", id),
      rotate: async (next) => {
        await vault.put(input({ secret_type: "oauth_refresh", secret: next.secret, account_ref: "other@acme.test" }));
        db.prepare("UPDATE credentials SET next_refresh_at = ? WHERE id = ?").run(next.expiresAt, id);
      },
    });

  const results = await Promise.all([harness("w1"), harness("w2")]);
  assert.deepEqual(results.sort(), ["refreshed", "waited"]);
  assert.equal(calls, 1, "the second worker must not have called the provider");
});

test("refreshWithLease clears the lease when the provider throws", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input({ secret_type: "oauth_refresh", secret: "rt_1" }));
  db.prepare("UPDATE credentials SET next_refresh_at = ? WHERE id = ?").run(Date.now() - 1, id);
  const provider = { async refresh(): Promise<never> { throw new Error("provider 500"); } };
  await assert.rejects(
    refreshWithLease(db, provider, id, { unwrap: () => vault.reveal("t_acme", id), rotate: async () => {} }),
    /provider 500/,
  );
  const row = db.prepare("SELECT refresh_owner, refresh_lease_until FROM credentials WHERE id = ?").get(id);
  assert.equal(row!.refresh_owner, null);
  assert.equal(row!.refresh_lease_until, null);
});

// ---------------------------------------------------------------- revocation

test("disconnect revokes at the provider before marking the row", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input({ secret_type: "oauth_refresh", secret: "rt_1" }));
  const seen: string[] = [];
  const revoker = { async revoke({ token }: { token: string }) { seen.push(token); return { ok: true, detail: "200" }; } };

  assert.deepEqual(await disconnect(db, revoker, id, () => vault.reveal("t_acme", id)), { status: "revoked" });
  assert.deepEqual(seen, ["rt_1"]);
  assert.equal(db.prepare("SELECT status FROM credentials WHERE id = ?").get(id)!.status, "revoked");
});

test("a failed revoke leaves the row active so the user can retry", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input({ secret_type: "oauth_refresh", secret: "rt_1" }));
  const revoker = { async revoke() { return { ok: false, detail: "provider 503" }; } };

  const res = await disconnect(db, revoker, id, () => vault.reveal("t_acme", id));
  assert.deepEqual(res, { status: "invalid" });
  const row = db.prepare("SELECT status, invalid_reason FROM credentials WHERE id = ?").get(id);
  assert.equal(row!.status, "invalid");
  assert.equal(row!.invalid_reason, "provider 503");
});
