import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../src/boot.ts";

const k = (fill: number) => Buffer.alloc(32, fill).toString("base64");
const env = (raw?: string) => ({ CREDENTIAL_MASTER_KEYS: raw }) as NodeJS.ProcessEnv;

test("boot succeeds with a well-formed master", () => {
  const { vault } = boot({ env: env(`v1:${k(1)}`) });
  assert.ok(vault);
});

test("boot fails closed on a missing master, naming the variable and the fix", () => {
  assert.throws(
    () => boot({ env: env() }),
    (e: Error) => /CREDENTIAL_MASTER_KEYS is empty/.test(e.message) && /WIRING.md/.test(e.message),
  );
});

test("boot fails closed on a key that is too short", () => {
  assert.throws(() => boot({ env: env(`v1:${Buffer.alloc(16, 1).toString("base64")}`) }), /need 32/);
});
