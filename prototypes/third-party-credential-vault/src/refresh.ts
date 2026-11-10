import { randomUUID } from "node:crypto";
import type { Db } from "./vault.ts";

export interface Provider {
  refresh(args: { refreshToken: string; accountRef: string }): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  }>;
}

/** How long a worker owns a credential's refresh before another may steal it. */
export const LEASE_MS = 30_000;
/** Refresh ahead of expiry, not on the 401. */
export const REFRESH_MARGIN_MS = 30_000;

/**
 * Claim the refresh for one row. Two workers can call this concurrently; only
 * the one whose UPDATE reports 1 succeeded. The other is a waiter and must
 * re-read the row.
 */
export function claimRefresh(db: Db, id: string, owner: string): boolean {
  const due = Date.now() + REFRESH_MARGIN_MS;
  const r = db
    .prepare(
      `UPDATE credentials
          SET refresh_owner = ?, refresh_lease_until = ?
        WHERE id = ?
          AND status = 'active'
          AND (next_refresh_at IS NULL OR next_refresh_at <= ?)
          AND (refresh_lease_until IS NULL OR refresh_lease_until < ?)`,
    )
    .run(owner, Date.now() + LEASE_MS, id, due, Date.now()) as { changes: number };
  return r.changes === 1;
}

/**
 * Refresh-and-persist. Writes back with a compare-and-swap on last_refreshed_at
 * so a late worker cannot clobber a token a faster one already stored.
 */
export async function refreshWithLease(
  db: Db,
  provider: Provider,
  id: string,
  opts: { unwrap: () => Promise<string>; rotate: (next: { secret: string; expiresAt: number }) => Promise<void>; owner?: string },
): Promise<"refreshed" | "waited" | "raced"> {
  const owner = opts.owner ?? randomUUID();
  if (!claimRefresh(db, id, owner)) return "waited";

  const before = db.prepare("SELECT last_refreshed_at, account_ref FROM credentials WHERE id = ?").get(id) as
    | { last_refreshed_at: number | null; account_ref: string }
    | undefined;
  if (!before) throw new Error("credential not found");

  const refreshToken = await opts.unwrap();
  let result;
  try {
    result = await provider.refresh({ refreshToken, accountRef: before.account_ref });
  } catch (e) {
    db.prepare("UPDATE credentials SET refresh_owner = NULL, refresh_lease_until = NULL WHERE id = ?").run(id);
    throw e;
  }

  const written = db
    .prepare(
      `UPDATE credentials
          SET last_refreshed_at = ?, refresh_owner = NULL, refresh_lease_until = NULL
        WHERE id = ? AND (last_refreshed_at IS NULL OR last_refreshed_at = ?)`,
    )
    .run(Date.now(), id, before.last_refreshed_at) as { changes: number };

  if (written.changes !== 1) return "raced";

  if (result.refresh_token) {
    await opts.rotate({
      secret: result.refresh_token,
      expiresAt: Date.now() + result.expires_in * 1000,
    });
  }
  return "refreshed";
}
