import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { CiphertextError } from "./crypto.ts";
import type { MasterKey } from "./config.ts";
import { active } from "./config.ts";

/**
 * The key boundary. Two implementations:
 *
 *   envKms(masters)   no service: HKDF per row from a master in the environment.
 *                     The deployment target unless a KMS is ever bought.
 *   localKms()        random DEK wrapped under a KEK, kept for contrast and for
 *                     the tests that exercise wrapped material.
 */
export interface Kms {
  readonly kekId: string;
  /** Version of the master new writes seal with. */
  readonly version: number;
  generateDataKey(context: Record<string, string>): Promise<{ plaintext: Buffer; wrapped: string; iv: string }>;
  /** `version` defaults to the active one; pass the row's to open an old row. */
  decrypt(wrapped: string, iv: string, context: Record<string, string>, version?: number): Promise<Buffer>;
}

const ALG = "aes-256-gcm";
const IV_BYTES = 12;
const LABEL = "credential-dek/v2";

/** Stable context encoding: sorted, so key order cannot change the output. */
const ctxBytes = (ctx: Record<string, string>) =>
  Buffer.from(JSON.stringify(Object.entries(ctx).sort()), "utf8");

/**
 * Static master(s) from the environment, one derived row key each.
 *
 * HKDF-Expand per row. Extract is folded into construction because the master is
 * already uniform key material; `info` carries the label, the master version, and
 * the row context, which is what keeps a moved row from opening.
 */
export function envKms(masters: MasterKey[]): Kms {
  const current = active(masters);
  const prkFor = (m: MasterKey) =>
    createHmac("sha256", m.key).update(Buffer.concat([Buffer.from(LABEL, "utf8"), Buffer.from([0])])).digest();
  const prks = new Map(masters.map((m) => [m.version, prkFor(m)]));
  // PRKs are derived eagerly so a bad master fails at boot, not at first read

  const derive = (version: number, context: Record<string, string>) => {
    const prk = prks.get(version);
    if (!prk) throw new CiphertextError(`master v${version} is not loaded: was it dropped from ${"CREDENTIAL_MASTER_KEYS"}?`);
    const info = Buffer.concat([
      Buffer.from(LABEL, "utf8"),
      Buffer.from([0]),
      Buffer.from(`v${version}`, "utf8"),
      Buffer.from([0]),
      ctxBytes(context),
    ]);
    // T(1) = HMAC(PRK, T(0) | info | 0x01); one block is all a 256-bit key needs
    return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest();
  };

  return {
    kekId: "env",
    version: current.version,
    async generateDataKey(context) {
      return { plaintext: derive(current.version, context), wrapped: "", iv: "" };
    },
    async decrypt(_wrapped, _iv, context, version = current.version) {
      return derive(version, context);
    },
  };
}

/**
 * Wrapped variant: random DEK per row sealed under a KEK. Kept because it is what
 * a KMS would want, and because the wrapped-material tests need it.
 */
export function localKms(opts: { kekId?: string; kek?: Buffer } = {}): Kms {
  const kek = opts.kek ?? randomBytes(32);
  const kekId = opts.kekId ?? "local-kek-1";
  return {
    kekId,
    version: 1,
    async generateDataKey(context) {
      const plaintext = randomBytes(32);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALG, kek, iv);
      cipher.setAAD(ctxBytes(context));
      const wrapped = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]).toString("base64");
      return { plaintext, wrapped, iv: iv.toString("base64") };
    },
    async decrypt(wrapped, iv, context) {
      const raw = Buffer.from(wrapped, "base64");
      const tag = raw.subarray(raw.length - 16);
      const body = raw.subarray(0, raw.length - 16);
      const decipher = createDecipheriv(ALG, kek, Buffer.from(iv, "base64"));
      decipher.setAAD(ctxBytes(context));
      decipher.setAuthTag(tag);
      try {
        return Buffer.concat([decipher.update(body), decipher.final()]);
      } catch {
        throw new CiphertextError("kek context mismatch: row moved or identity edited");
      }
    },
  };
}
