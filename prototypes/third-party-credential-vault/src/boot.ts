import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { loadMasters } from "./config.ts";
import { envKms } from "./kms.ts";
import { Vault, type Db } from "./vault.ts";

/**
 * Boot sequence. The order is the point: the master is validated before the
 * database is opened, so a deployment with a broken env fails here instead of
 * serving reads that all throw.
 */
export function boot(opts: { dbPath?: string; schemaPath?: URL; env?: NodeJS.ProcessEnv } = {}) {
  const masters = loadMasters(opts.env ?? process.env); // throws, fail closed
  const db = new DatabaseSync(opts.dbPath ?? ":memory:") as unknown as Db;
  db.exec(readFileSync(opts.schemaPath ?? new URL("../schema.sql", import.meta.url), "utf8"));
  return { vault: new Vault(db, envKms(masters)), db };
}
