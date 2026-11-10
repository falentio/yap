import { Buffer } from "node:buffer";

/**
 * The master key, loaded from the environment. There is no KMS, so the boot
 * guard is the only thing standing between a typo and a database full of
 * ciphertext nobody can open.
 */
export interface MasterKey {
  version: number;
  key: Buffer;
}

const ENV = "CREDENTIAL_MASTER_KEYS";
const MIN_BYTES = 32;

/** "v1:base64" pairs, comma separated. v1 first is the active one. */
export function loadMasters(env: NodeJS.ProcessEnv = process.env): MasterKey[] {
  const raw = env[ENV];
  if (!raw || !raw.trim()) {
    throw new Error(
      `${ENV} is empty. Every stored credential is unreadable without it. \
Set CREDENTIAL_MASTER_KEYS=v1:<32-byte base64> (see WIRING.md, boot guard).`,
    );
  }

  const masters = raw.split(",").map((entry) => {
    const sep = entry.indexOf(":");
    if (sep < 0) throw new Error(`${ENV} entry "${entry.slice(0, 6)}..." is missing the "vN:" prefix`);
    const version = Number(entry.slice(0, sep).replace(/^v/, ""));
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`${ENV} version "${entry.slice(0, sep)}" is not v1, v2, ...`);
    }
    const key = Buffer.from(entry.slice(sep + 1), "base64");
    if (key.length < MIN_BYTES) {
      throw new Error(`${ENV} v${version} decodes to ${key.length} bytes, need ${MIN_BYTES}`);
    }
    return { version, key };
  });

  if (new Set(masters.map((m) => m.version)).size !== masters.length) {
    throw new Error(`${ENV} repeats a version; the active master would be ambiguous`);
  }
  return masters;
}

/** The active master is the first entry. The rest only open, never seal. */
export const active = (masters: MasterKey[]): MasterKey => {
  const first = masters[0];
  if (!first) throw new Error(`${ENV} resolved to no masters`);
  return first;
};
