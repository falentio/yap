import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Thrown when the AEAD tag does not verify: wrong key, edited AAD, or truncation. */
export class CiphertextError extends Error {
  constructor(cause: string) {
    super(`ciphertext failed to open: ${cause}`);
    this.name = "CiphertextError";
  }
}

/**
 * Portable AEAD. AES-256-GCM is what every KMS and SDK here speaks, and the
 * 2^32-invocation ceiling is per DEK -- we mint one DEK per row, so it is
 * unreachable in practice.
 */
export function seal(key: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function open(key: Buffer, sealed: string, aad: string): string {
  const raw = Buffer.from(sealed, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new CiphertextError("too short");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new CiphertextError("tag mismatch: AAD or key changed");
  }
}

export const newDek = () => randomBytes(32);

/** The AAD tuple. Order is fixed; the string is what gets stored in aad_json. */
export function aadFor(c: {
  tenant_id: string;
  user_id: string;
  provider: string;
  account_ref: string;
  secret_type: string;
}): string {
  return JSON.stringify([c.tenant_id, c.user_id, c.provider, c.account_ref, c.secret_type]);
}
