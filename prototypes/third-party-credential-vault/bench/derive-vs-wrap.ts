import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { Vault } from "../src/vault.ts";
import { localKms, envKms } from "../src/kms.ts";
import { loadMasters } from "../src/config.ts";

const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const N = 5000;

const base = {
  tenant_id: "t_acme",
  user_id: "u_1",
  provider: "openai",
  secret_type: "api_key",
  secret: "sk-live-abcdefghijklmnop",
};

async function run(label: string, kms: ReturnType<typeof localKms>) {
  const db = new DatabaseSync(":memory:") as never;
  (db as any).exec(schema);
  const vault = new Vault(db as any, kms);

  const t0 = performance.now();
  const ids: string[] = [];
  for (let i = 0; i < N; i++) {
    ids.push(await vault.put({ ...base, account_ref: `acct-${i}@acme.test` }));
  }
  const write = performance.now() - t0;

  const t1 = performance.now();
  for (const id of ids) await vault.reveal("t_acme", id);
  const read = performance.now() - t1;

  const bytes = (db as any).prepare("SELECT SUM(LENGTH(ciphertext) + LENGTH(wrapped_dek)) b FROM credentials").get().b;
  console.log(
    `${label.padEnd(22)} write ${(write / N * 1000).toFixed(1).padStart(6)} us/row   read ${(read / N * 1000).toFixed(1).padStart(6)} us/row   stored ${(bytes / N).toFixed(0)} B/row`,
  );
}

await run("derive  (shared master)", envKms(loadMasters({ CREDENTIAL_MASTER_KEYS: "v1:" + Buffer.alloc(32, 3).toString("base64") })));
await run("wrap    (per-row DEK)", localKms({ kekId: "k" }));
await run("derive  (shared master)", envKms(loadMasters({ CREDENTIAL_MASTER_KEYS: "v1:" + Buffer.alloc(32, 3).toString("base64") })));
await run("wrap    (per-row DEK)", localKms({ kekId: "k" }));
