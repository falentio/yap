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
// NB: numeric keys sort ascending, so pass an explicit order when the active
// master is not the lowest version. The first entry remains the active one.
const env = (pairs: Record<number, Buffer>, order?: number[]) =>
  ({
    CREDENTIAL_MASTER_KEYS: (order ?? Object.keys(pairs).map(Number))
      .map((v) => `v${v}:${pairs[v]!.toString("base64")}`)
      .join(","),
  }) as NodeJS.ProcessEnv;

const oldMaster = Buffer.alloc(32, 1);
const newMaster = Buffer.alloc(32, 2);

const input = (over: Record<string, unknown> = {}) => ({
  tenant_id: "t_acme",
  user_id: "u_1",
  provider: "openai",
  account_ref: "ada@acme.test",
  secret_type: "api_key",
  secret: "sk-live-abc123",
  ...over,
});

function db(): Db {
  const d = new DatabaseSync(":memory:") as unknown as Db;
  d.exec(schema);
  return d;
}

test("a row written under v1 re-seals to v2 on read, value intact", async () => {
  const d = db();
  const before = new Vault(d, envKms(loadMasters(env({ 1: oldMaster }))));
  const id = await before.put(input());
  assert.equal(d.prepare("SELECT master_version FROM credentials WHERE id = ?").get(id)!.master_version, 1);

  // v2 becomes active, v1 is retained only to open
  const after = new Vault(d, envKms(loadMasters(env({ 1: oldMaster, 2: newMaster }, [2, 1]))));
  assert.equal(await after.reveal("t_acme", id), "sk-live-abc123");

  const row = d.prepare("SELECT master_version, ciphertext FROM credentials WHERE id = ?").get(id)!;
  assert.equal(row.master_version, 2, "the row moved to the active master");
  assert.equal(await after.reveal("t_acme", id), "sk-live-abc123", "and still opens");
});

test("a second read does not re-seal again", async () => {
  const d = db();
  const before = new Vault(d, envKms(loadMasters(env({ 1: oldMaster }))));
  const id = await before.put(input());
  const after = new Vault(d, envKms(loadMasters(env({ 1: oldMaster, 2: newMaster }, [2, 1]))));
  await after.reveal("t_acme", id);

  const seals = () => d.prepare("SELECT COUNT(*) c FROM credential_access WHERE action = 'reseal'").get()!.c;
  const first = seals();
  await after.reveal("t_acme", id);
  assert.equal(seals(), first, "no further reseal once on the active version");
});

test("dropping the old master too early makes old rows unreadable, and says so", async () => {
  const d = db();
  const before = new Vault(d, envKms(loadMasters(env({ 1: oldMaster }))));
  const id = await before.put(input());

  const tooSoon = new Vault(d, envKms(loadMasters(env({ 2: newMaster }))));
  await assert.rejects(tooSoon.reveal("t_acme", id), /master v1 is not loaded/);
  // still recoverable: put v1 back
  const recovered = new Vault(d, envKms(loadMasters(env({ 1: oldMaster, 2: newMaster }, [2, 1]))));
  assert.equal(await recovered.reveal("t_acme", id), "sk-live-abc123");
});

test("the binding survives a reseal: AAD is unchanged", async () => {
  const d = db();
  const before = new Vault(d, envKms(loadMasters(env({ 1: oldMaster }))));
  const id = await before.put(input());
  const aadBefore = d.prepare("SELECT aad_json FROM credentials WHERE id = ?").get(id)!.aad_json;

  const after = new Vault(d, envKms(loadMasters(env({ 1: oldMaster, 2: newMaster }, [2, 1]))));
  await after.reveal("t_acme", id);
  assert.equal(d.prepare("SELECT aad_json FROM credentials WHERE id = ?").get(id)!.aad_json, aadBefore);

  // and a moved row still fails after resealing
  d.prepare("UPDATE credentials SET tenant_id = 't_evil' WHERE id = ?").run(id);
  await assert.rejects(after.reveal("t_evil", id), CiphertextError);
});

test("every reveal is logged, ok or not, with the master version", async () => {
  const d = db();
  const before = new Vault(d, envKms(loadMasters(env({ 1: oldMaster }))));
  const id = await before.put(input());
  await before.reveal("t_acme", id);

  d.prepare("UPDATE credentials SET user_id = 'u_2' WHERE id = ?").run(id);
  await assert.rejects(before.reveal("t_acme", id), CiphertextError);

  const rows = d.prepare("SELECT action, outcome, master_version FROM credential_access WHERE action = 'reveal'").all();
  assert.deepEqual(rows.map((r: any) => [r.action, r.outcome]), [["reveal", "ok"], ["reveal", "failed"]]);
  assert.equal(rows[0].master_version, 1);
});
