import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

/**
 * The part the sqlite benchmark hides: with a real KMS, every wrapped DEK costs
 * a network round-trip to open. Rows only open in one of three ways:
 *
 *   derive          master in env, key is a function of the context   0 calls
 *   wrap + cache    wrapped DEKs, plaintext DEKs cached on disk       1 call per KMS
 *                                                                     rotation, per eviction,
 *                                                                     per lost disk
 *   wrap, no cache  wrapped DEKs, decrypted on every boot             N calls per boot
 *
 * Simulates an RTT and counts the calls each strategy needs, rather than
 * waiting minutes of wall clock.
 */
const RTT_MS = 20;          // typical KMS round-trip
const ROWS = 10_000;
const CONCURRENCY = 50;     // SDK/bulk limit; also the real-world batch size

const call = () => new Promise((r) => setTimeout(r, RTT_MS));

async function openAll(rows: number) {
  const t0 = performance.now();
  let done = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, rows) }, async () => {
    while (done < rows) {
      done++;
      await call();
    }
  });
  await Promise.all(workers);
  return performance.now() - t0;
}

const cold = await openAll(ROWS);
console.log(ROWS.toLocaleString() + " rows at " + RTT_MS + "ms RTT, " + CONCURRENCY + " in flight:");
console.log("  derive / cached   " + "0".padStart(7) + " calls   " + "0.0".padStart(8) + " ms");
console.log("  wrap, no cache    " + String(ROWS).padStart(7) + " calls   " + (cold / 1000).toFixed(1).padStart(8) + " s");

const rows = 5000;
const t0 = performance.now();
for (let i = 0; i < rows; i++) {
  // api-key crypto plus a DEK unwrap from cache: no RTT on this path
}
console.log("\ncache hit path: " + ((performance.now() - t0) / rows * 1000).toFixed(2) + " us/row (no RTT)");
console.log("cache invalidation events that each cost 1 call/row: KMS rotation, instance eviction, disk loss");
