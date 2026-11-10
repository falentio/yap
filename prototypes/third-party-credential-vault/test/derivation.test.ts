import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Vault, type Db } from "../src/vault.ts";
import { envKms } from "../src/kms.ts";
import { loadMasters } from "../src/config.ts";
import { CiphertextError } from "../src/crypto.ts";

const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

const b64 = (b: Buffer) => b.toString("base64");
// NB: numeric keys sort ascending, so pass an order when the active master is
// not the lowest version. The first entry remains the active one.
const env = (pairs: Record<number, Buffer>, order?: number[]) =>
  ({
    CREDENTIAL_MASTER_KEYS: (order ?? Object.keys(pairs).map(Number))
      .map((v) => `v${v}:${pairs[v]!.toString("base64")}`)
      .join(","),
  }) as NodeJS.ProcessEnv;

function fresh(master: Buffer = Buffer.alloc(32, 9)) {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  db.exec(schema);
  return { db, vault: new Vault(db, envKms(loadMasters(env({ 1: master })))) };
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

test("derived mode round-trips and stores no wrapped DEK", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  const row = db.prepare("SELECT * FROM credentials WHERE id = ?").get(id);
  assert.equal(await vault.reveal("t_acme", id), "sk-live-abc123");
  assert.equal(row!.wrapped_dek, "", "no wrapped key is stored in derived mode");
  assert.equal(row!.alg, "AES-256-GCM");
});

test("the derived key is stable for one scope, so reads need no stored material", async () => {
  const { vault } = fresh();
  const id = await vault.put(input());
  assert.equal(await vault.reveal("t_acme", id), await vault.reveal("t_acme", id));
});

test("a row dragged to another tenant still fails (scope is in the derivation)", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET tenant_id = 't_evil' WHERE id = ?").run(id);
  // no wrapped_dek to save us here: the derived key itself is wrong for the new scope
  await assert.rejects(vault.reveal("t_evil", id), CiphertextError);
});

test("an edited user_id fails for the same reason", async () => {
  const { db, vault } = fresh();
  const id = await vault.put(input());
  db.prepare("UPDATE credentials SET user_id = 'u_2' WHERE id = ?").run(id);
  await assert.rejects(vault.reveal("t_acme", id), CiphertextError);
});

test("two rows with identical plaintext in one scope share a key and differ in ciphertext", async () => {
  const { db, vault } = fresh();
  const a = await vault.put(input());
  const b = await vault.put(input({ account_ref: "grace@acme.test" }));
  const rows = db.prepare("SELECT ciphertext FROM credentials").all();
  // same tenant/user/type: same derived key. the random IV still separates them.
  assert.notEqual(rows[0]!.ciphertext, rows[1]!.ciphertext);
  assert.equal(await vault.reveal("t_acme", a), await vault.reveal("t_acme", b));
});

test("one user's row does not open under another user's key", async () => {
  const { db, vault } = fresh();
  const a = await vault.put(input());
  const b = await vault.put(input({ user_id: "u_2", account_ref: "grace@acme.test" }));
  // swap the ciphertexts: same tenant, different user scope, so the keys differ
  const cb = db.prepare("SELECT ciphertext FROM credentials WHERE id = ?").get(b)!.ciphertext;
  db.prepare("UPDATE credentials SET ciphertext = ? WHERE id = ?").run(cb, a);
  await assert.rejects(vault.reveal("t_acme", a), CiphertextError);
});

test("a different master version derives a different key", async () => {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  db.exec(schema);
  const master = Buffer.alloc(32, 7);
  const one = new Vault(db, envKms(loadMasters(env({ 1: master }))));
  const id = await one.put(input());

  // same key material, new version: the version sits in the info, so it is a different key
  const two = new Vault(db, envKms(loadMasters(env({ 2: master }))));
  await assert.rejects(two.reveal("t_acme", id), CiphertextError);
});

test("a different master key opens nothing", async () => {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  db.exec(schema);
  const one = new Vault(db, envKms(loadMasters(env({ 1: Buffer.alloc(32, 1) }))));
  const id = await one.put(input());
  const two = new Vault(db, envKms(loadMasters(env({ 1: Buffer.alloc(32, 2) }))));
  await assert.rejects(two.reveal("t_acme", id), CiphertextError);
});

test("an unloaded version says which master is missing", async () => {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  db.exec(schema);
  const one = new Vault(db, envKms(loadMasters(env({ 3: Buffer.alloc(32, 5) }))));
  const id = await one.put(input());
  const two = new Vault(db, envKms(loadMasters(env({ 1: Buffer.alloc(32, 5) }))));
  await assert.rejects(two.reveal("t_acme", id), /master v3 is not loaded/);
});
