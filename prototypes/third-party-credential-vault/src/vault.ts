import { randomUUID } from "node:crypto";
import { seal, open, aadFor, CiphertextError } from "./crypto.ts";
import type { Kms } from "./kms.ts";

export interface CredentialInput {
  tenant_id: string;
  user_id: string;
  provider: string;
  account_ref: string;
  secret_type: string;
  secret: string;
  scope?: string;
  resource?: string;
  expires_at?: number;
}

type Row = CredentialInput & {
  id: string;
  ciphertext: string;
  wrapped_dek: string;
  dek_iv: string;
  aad_json: string;
  kek_id: string;
  master_version: number;
  status: "active" | "invalid" | "revoked";
};

/** node:sqlite and better-sqlite3 share this surface for our calls. */
export interface Db {
  prepare(sql: string): { run(...a: unknown[]): unknown; get(...a: any[]): any; all(...a: any[]): any[] };
  exec(sql: string): void;
}

const kmsContext = (c: Pick<Row, "tenant_id" | "user_id" | "provider" | "secret_type">) => ({
  tenant_id: c.tenant_id,
  user_id: c.user_id,
  provider: c.provider,
  secret_type: c.secret_type,
});

export class Vault {
  #db: Db;
  #kms: Kms;
  constructor(db: Db, kms: Kms) {
    this.#db = db;
    this.#kms = kms;
  }

  #log(row: Pick<Row, "id" | "tenant_id" | "user_id">, action: string, outcome: string, reason?: string, version?: number) {
    this.#db
      .prepare(
        `INSERT INTO credential_access
           (credential_id, tenant_id, user_id, action, outcome, reason, master_version, at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(row.id, row.tenant_id, row.user_id, action, outcome, reason ?? null, version ?? null, Date.now());
  }

  async put(input: CredentialInput): Promise<string> {
    const aad = aadFor(input);
    const version = this.#kms.version;
    const { plaintext: dek, wrapped, iv } = await this.#kms.generateDataKey(kmsContext(input));
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO credentials
           (id, tenant_id, user_id, provider, account_ref, secret_type,
            ciphertext, wrapped_dek, dek_iv, kek_id, master_version, aad_json,
            scope, resource, expires_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id, input.tenant_id, input.user_id, input.provider, input.account_ref,
        input.secret_type, seal(dek, input.secret, aad), wrapped, iv,
        this.#kms.kekId, version, aad, input.scope ?? null, input.resource ?? null,
        input.expires_at ?? null, Date.now(),
      );
    return id;
  }

  /**
   * Decrypt one credential, re-sealing it if it was written under an older
   * master. The row's master_version is passed, so a rotation sweep is lazy
   * rather than a big-bang migration.
   */
  async reveal(tenantId: string, id: string): Promise<string> {
    const row = this.#db
      .prepare("SELECT * FROM credentials WHERE id = ? AND tenant_id = ?")
      .get(id, tenantId) as Row | undefined;
    if (!row) throw new Error("credential not found");
    if (row.status !== "active") throw new Error(`credential is ${row.status}`);

    let plaintext: string;
    try {
      const dek = await this.#kms.decrypt(row.wrapped_dek, row.dek_iv, kmsContext(row), row.master_version);
      plaintext = open(dek, row.ciphertext, row.aad_json);
    } catch (e) {
      this.#log(row, "reveal", "failed", (e as Error).message.slice(0, 120), row.master_version);
      throw e;
    }
    this.#log(row, "reveal", "ok", undefined, row.master_version);

    if (row.master_version !== this.#kms.version) await this.#reseal(row, plaintext);
    return plaintext;
  }

  /** Re-seal under the active master. Same AAD, so the binding is unchanged. */
  async #reseal(row: Row, plaintext: string): Promise<void> {
    const aad = row.aad_json;
    const version = this.#kms.version;
    const { plaintext: dek, wrapped, iv } = await this.#kms.generateDataKey(kmsContext(row));
    // CAS on the version we read, so two workers resealing at once cannot fight
    const r = this.#db
      .prepare(
        `UPDATE credentials
            SET ciphertext = ?, wrapped_dek = ?, dek_iv = ?, master_version = ?, kek_id = ?
          WHERE id = ? AND master_version = ?`,
      )
      .run(seal(dek, plaintext, aad), wrapped, iv, version, this.#kms.kekId, row.id, row.master_version) as {
      changes: number;
    };
    if (r.changes === 1) this.#log(row, "reseal", "ok", undefined, version);
  }
}
