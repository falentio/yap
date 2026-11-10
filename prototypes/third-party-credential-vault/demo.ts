/**
 * A walking tour of the flow against a real file, to see the ciphertext and the
 * audit rows rather than trust the tests.
 *
 *   CREDENTIAL_MASTER_KEYS="v1:$(openssl rand -base64 32)" node demo.ts
 */
import { boot } from "./src/boot.ts";

const { vault, db } = boot({ dbPath: "/tmp/credential-demo.db" });
db.exec("DELETE FROM credentials; DELETE FROM credential_access;");

const id = await vault.put({
  tenant_id: "t_acme",
  user_id: "u_1",
  provider: "openai",
  account_ref: "ada@acme.test",
  secret_type: "api_key",
  secret: "sk-live-abc123",
});

const row = db.prepare("SELECT * FROM credentials WHERE id = ?").get(id)!;
console.log("stored row:");
for (const key of ["ciphertext", "wrapped_dek", "master_version", "aad_json"]) {
  console.log("  " + key.padEnd(15) + String(row[key]).slice(0, 46));
}

console.log("\nplaintext anywhere in the row: " + JSON.stringify(row).includes("sk-live-abc123"));

console.log("\nreveal: " + (await vault.reveal("t_acme", id)));

// the mixed-row case
db.prepare("UPDATE credentials SET tenant_id = 't_evil' WHERE id = ?").run(id);
try {
  await vault.reveal("t_evil", id);
} catch (e) {
  console.log("after moving the row: " + (e as Error).name);
}

console.log("\naudit rows:");
for (const r of db.prepare("SELECT action, outcome, master_version FROM credential_access").all()) {
  console.log("  " + JSON.stringify(r));
}
