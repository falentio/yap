# MATI LAMPU — Blackout Bar Brawl (prototype)

Playable digital prototype of the board game specified in
[`../../research/reference/indonesian-blackout-bar-brawl.md`](../../research/reference/indonesian-blackout-bar-brawl.md).

A 2–6 player fog-of-war brawl in one Indonesian bar during a blackout. The lights
change every round and set everyone's vision radius at once. You win on money and KOs,
not survival, and a knockout drops the victim's cash on the floor.

## Play it

Open **`index.html`** in a browser. No server, no build, no dependencies — the
engine and AI are plain UMD scripts loaded from the same folder, so `file://` works.

- **1 orang** — you take one seat, the rest are CPU.
- **2 orang (hot-seat)** — two human seats, the board rotates to whoever is active.
- **CPU semua** — watch a full game play itself.
- The **seed** box makes a game reproducible: same seed, same map, same light rolls,
  same CPU decisions.

Mouse: click an adjacent tile to move; pick *Serang* / *Lempar* / *Peluit* then click a
target. Keyboard: `e` end turn, `s` search, `h` hide.

## Files

| File | Role |
|---|---|
| `engine.js` | Pure, DOM-free, deterministic game engine. UMD (Node `require` or browser global `BlackoutBrawl`). No `Math.random` — all randomness comes from a seeded RNG in the state. |
| `ai.js` | Heuristic policy shared by the simulator and the browser's "Lawan CPU". Only sees what the acting player can see. |
| `index.html` | Single-file playable UI (canvas board, hot-seat, CPU opponents). |
| `sim.js` | Headless CPU-vs-CPU simulator with invariant assertions. |
| `ui-contract.js` | Asserts every action shape the UI can emit is accepted by the engine. |
| `browser-smoke.sh` | Headless-Chrome test that the page loads, runs a game, and never throws. |

## Verify

```sh
node sim.js 600          # 600 games; asserts invariants I1–I9; exits non-zero on violation
node sim.js 200 --json   # machine-readable summary
node ui-contract.js      # UI <-> engine contract
./browser-smoke.sh       # real browser, real game, zero JS errors
```

### What the simulator asserts on every single step

- **I1** HP is an integer in `[0, maxHp]`
- **I2** money is a non-negative integer
- **I3** AP is an integer in `[0, maxAp]`, and a turn never advances with AP left
- **I4** at most one player occupies a tile
- **I5** nobody stands on a blocking tile; a knocked-down player has no position
- **I6** every game terminates within the round limit
- **I7** every game produces exactly one winner
- **I8** no action is ever applied out of turn
- **I9** no exception is swallowed silently

## Design notes worth knowing before you edit

- **The map topology is a balance parameter.** The first map was a maze; line-of-sight
  through corridors capped visible tiles at ~18 regardless of light level, so the light
  die did nothing and combat almost never happened (0.27 KOs/game, 0 satpam catches).
  Flattening it to a real bar floor took enemy visibility from 3.3% to 35% and satpam
  catches from 0 to 7.9/game. If you add walls, re-run `sim.js` and watch those numbers.
- **All randomness is seeded and lives in `state.rngSeed`.** Never add `Math.random` to
  the engine; it would break reproducibility and the tests.
- **The AI must only use what the acting player can see.** `visibleSet(state, player)` is
  the honesty boundary. If the AI reads enemy positions directly, the game stops being a
  fog-of-war game.
- **Actions are validated, not trusted.** Every action returns `{ok, error}`; a rejected
  action costs nothing and does not advance the turn. The UI surfaces the error as a toast.
