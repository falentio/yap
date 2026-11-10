import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMasters, active } from "../src/config.ts";

const k = (fill: number) => Buffer.alloc(32, fill).toString("base64");
const env = (raw?: string) => ({ CREDENTIAL_MASTER_KEYS: raw }) as NodeJS.ProcessEnv;

test("an empty or missing env refuses to boot", () => {
  assert.throws(() => loadMasters(env()), /is empty/);
  assert.throws(() => loadMasters(env("  ")), /is empty/);
});

test("an entry without a version prefix refuses to boot", () => {
  assert.throws(() => loadMasters(env(k(1))), /missing the "vN:" prefix/);
});

test("a non-numeric version refuses to boot", () => {
  assert.throws(() => loadMasters(env(`vX:${k(1)}`)), /is not v1, v2/);
  assert.throws(() => loadMasters(env(`v0:${k(1)}`)), /is not v1, v2/);
});

test("a short key refuses to boot, and says how short", () => {
  const short = Buffer.alloc(16, 1).toString("base64");
  assert.throws(() => loadMasters(env(`v1:${short}`)), /16 bytes, need 32/);
});

test("a repeated version refuses to boot instead of guessing", () => {
  assert.throws(() => loadMasters(env(`v1:${k(1)},v1:${k(2)}`)), /repeats a version/);
});

test("the first entry is the active master, the rest only open", () => {
  const masters = loadMasters(env(`v2:${k(2)},v1:${k(1)}`));
  assert.equal(masters.length, 2);
  assert.equal(active(masters).version, 2);
  assert.deepEqual(masters.map((m) => m.version), [2, 1]);
});

test("a 32-byte base64 key loads", () => {
  assert.equal(loadMasters(env(`v1:${k(9)}`))[0]!.key.length, 32);
});
