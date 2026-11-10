import type { Db } from "./vault.ts";

export interface Revoker {
  /** RFC 7009. A 200 does not prove the grant is gone: an unknown token also returns 200. */
  revoke(args: { token: string; accountRef: string }): Promise<{ ok: boolean; detail: string }>;
}

/**
 * Disconnect: revoke at the provider FIRST, then mark the row. If the revoke
 * call fails the row stays active so the user can retry instead of believing
 * a dead token is gone.
 */
export async function disconnect(
  db: Db,
  revoker: Revoker,
  id: string,
  unwrap: () => Promise<string>,
): Promise<{ status: "revoked" | "invalid" }> {
  const row = db.prepare("SELECT account_ref, status FROM credentials WHERE id = ?").get(id) as
    | { account_ref: string; status: string }
    | undefined;
  if (!row) throw new Error("credential not found");

  const token = await unwrap();
  const res = await revoker.revoke({ token, accountRef: row.account_ref });

  const status = res.ok ? "revoked" : "invalid";
  db.prepare(
    `UPDATE credentials
        SET status = ?, invalid_reason = ?, refresh_owner = NULL, refresh_lease_until = NULL
      WHERE id = ?`,
  ).run(status, res.ok ? null : res.detail, id);
  return { status };
}
