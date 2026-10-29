---
title: Ritmo — The Agent-First, Type-Safe ECS Runtime for TypeScript
category: technology
tags: [ecs, typescript, game-engine, type-safety, determinism, rollback-netcode, ai-agents]
status: complete
created: 2026-10-27
updated: 2026-10-27
sources:
  - https://ritmo.typeonce.dev/
  - https://ritmo.typeonce.dev/llms.txt
  - https://ritmo.typeonce.dev/docs/
  - https://ritmo.typeonce.dev/docs/type-safety/
  - https://ritmo.typeonce.dev/docs/devtools/
  - https://ritmo.typeonce.dev/docs/with-an-agent/
  - https://github.com/typeonce-dev/ritmo
  - https://github.com/typeonce-dev/ritmo/blob/main/packages/core/SETUP.md
  - https://www.npmjs.com/package/@typeonce/ritmo
  - https://api.github.com/repos/typeonce-dev/ritmo
  - https://cdn.jsdelivr.net/npm/@typeonce/ritmo-netcode@0.17.0/README.md
  - https://cdn.jsdelivr.net/npm/@typeonce/ritmo@0.17.0/skills/ritmo/playbooks/netcode.md
  - https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
  - https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/oxlint-plugin/README.md
  - https://github.com/typeonce-dev/ritmo/tree/d13e98811bf374137389d86f3790613d66fb430d
  - https://en.wikipedia.org/wiki/Entity_component_system
confidence: high
---

# Ritmo — The Agent-First, Type-Safe ECS Runtime for TypeScript

## TL;DR

- **Ritmo is an ECS runtime for TypeScript games**, published by the `typeonce-dev` org as `@typeonce/ritmo` v0.17.0 under MIT ([npm](https://www.npmjs.com/package/@typeonce/ritmo), [repo](https://github.com/typeonce-dev/ritmo)).
- It is **simulation only, not an engine**: it runs the fixed-step world and hands you entities; drawing, audio, and the game loop stay in your own renderer ([README](https://github.com/typeonce-dev/ritmo)).
- Its differentiator is **compile-time closure plus declared access**: a closed schema, systems that receive exactly the access they declare, and no casts in normal use — so wrong code fails the build instead of the playtest ([type-safety](https://ritmo.typeonce.dev/docs/type-safety/)).
- Everything else serves **determinism and headless debugging**: fdlibm-ported `Ops` math, a seeded `Random` resource, invariant checks per frame, `why()` traces, and replays that become tests ([devtools](https://ritmo.typeonce.dev/docs/devtools/)).
- It is explicitly **built for coding agents**: a paste-in `SETUP.md`, skills shipped inside the npm package, compiler errors that name the fix, and an oxlint plugin ([with-an-agent](https://ritmo.typeonce.dev/docs/with-an-agent/), [SETUP.md](https://github.com/typeonce-dev/ritmo/blob/main/packages/core/SETUP.md)).
- **It can host a turn-based online match** through `Netcode.lockstep` over WebRTC data channels, but every peer holds the whole world: there is **no hidden-information support**, so a card game with secret hands needs a different netcode design.

## Context

Asked as "what is javascript ritmo ecs" on 2026-10-27. Ritmo is a young, fast-moving 0.x project (repo created 2026-03-28, 124 stars, 5 forks, 2 open issues at read time — [GitHub API](https://api.github.com/repos/typeonce-dev/ritmo)), so every fact below is pinned to **v0.17.0** and to the docs as fetched that day. The API does change between minor versions; the `llms.txt` says to read the JSDoc in `node_modules/@typeonce/*/src` for the installed version ([llms.txt](https://ritmo.typeonce.dev/llms.txt)).

## What "ECS" means here

Entity-Component-System is the data-oriented game architecture where an **entity** is an id, a **component** is plain data attached to an id, and a **system** is a function that iterates the entities matching a component query — the pattern is most associated with game engines and is described at [Wikipedia](https://en.wikipedia.org/wiki/Entity_component_system).

Ritmo keeps that vocabulary and adds two things most JS ECS libraries do not emphasize:

1. **A closed, typed schema** — components, resources, events, relations, and services are declared once, with names and value types, and bound into a `Game` surface. Every other API hangs off that `Game`, so two worlds cannot be mixed up ([docs](https://ritmo.typeonce.dev/docs/)).
2. **A declared access model** — a system lists the queries, resources, events, and services it may touch, and the `run` callback receives exactly that. Adding a logger to a system without providing it to the runtime is a compile error that names the service and where it goes ([type-safety](https://ritmo.typeonce.dev/docs/type-safety/)).

## The API shape: descriptor → fragment → bound Game

Five descriptor kinds, each constructed with a name and a value type ([README](https://github.com/typeonce-dev/ritmo), [npm](https://www.npmjs.com/package/@typeonce/ritmo)):

| Kind | Scope | Notes |
|---|---|---|
| `Descriptor.Component` | per entity | the only kind directly queryable (`read`/`write`/`optional`) |
| `Descriptor.Resource` | one value for the world | e.g. the clock, the RNG |
| `Descriptor.Event` | published, consumed | each system sees events since its own previous run, exactly once |
| `Descriptor.Relation` | between entities | reachable through `Game.System.relates(...)` |
| `Descriptor.Service` | host capability | dependency injection: render bridge, audio, logs, storage, network |

`any` and `never` do not compile as a descriptor value; a marker uses `Descriptor.Tag` ([docs](https://ritmo.typeonce.dev/docs/)). Schemas compose as **fragments** (one per subsystem, plus optional `requires` constraints such as `Schema.requires(Enemy, Health)`) and are bound into one root with a hidden brand, so systems, schedules, and runtimes from different bound schemas cannot be connected by accident ([README](https://github.com/typeonce-dev/ritmo)).

```ts
import { Clock, Descriptor, Schema } from "@typeonce/ritmo"

type Vec = { x: number; y: number }
const step = Clock.hz(60)                          // positive whole literal only
const Time = Clock.resource("Example/Time", step)
const Position = Descriptor.Component<Vec>()("Example/Position")
const Velocity = Descriptor.Component<Vec>()("Example/Velocity")

const Game = Schema.bind(
  Schema.fragment({ components: { Position, Velocity }, resources: { Time } })
)
```

From there, `Game.System`, `Game.Query`, `Game.Schedule`, and `Game.Runtime` are the whole surface. A tick is `runtime.tick(Game.Schedule(AdvanceTime, Move))`, and both `Runtime.make` and `tick` return a `Result` because starting and ticking can fail ([README](https://github.com/typeonce-dev/ritmo)).

## The guarantees the design buys

The README states these as contract, not aspiration ([README](https://github.com/typeonce-dev/ritmo)):

- A schema rejects **two descriptors of one kind with the same name at compile time**.
- Commands and state transitions wait for an explicit `applyDeferred()` or `applyStateTransitions(...)` in the schedule — no mid-system world mutation.
- **Each system sees what was published since its own previous run, exactly once.**
- A failing system **rolls back its writes**, and the tick returns the failure. Service side effects (a sound, a request) are explicitly *not* rolled back ([type-safety](https://ritmo.typeonce.dev/docs/type-safety/)).
- Queries visit only entities with their **rarest required component** and cache their matches; CI fails on runtime regressions over 25%.

The clock is itself a validated resource: `Clock.hz(60)` keeps the rate in the type, and restoring a save made at another step length fails with `InvalidResource` naming both rates ("saved at 60 Hz, this game runs at 120 Hz") ([docs](https://ritmo.typeonce.dev/docs/)). That is the concrete payoff of the type-level approach — a whole class of save/migration bug becomes a type or restore error.

## The clock: tick counter, buffered input, timed effects

Follow-up asked on 2026-10-27: what does clock speed actually execute? Read against the source pinned at [`d13e988`](https://github.com/typeonce-dev/ritmo/tree/d13e98811bf374137389d86f3790613d66fb430d).

**The clock is a step counter, not a wall clock.** `Clock.start` is `{ step: 0, hz, dt: 0 }`, and `Clock.system` advances `step + 1` with `dt = 1/hz` on a running tick, `dt = 0` on a held one ([Clock.ts:98](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L98), [Clock.ts:185-190](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L185-L190)). The clock schema accepts only `0` or `1/hz` for `dt`, so no tick ever carries a fractional delta ([Clock.ts:110](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L110)), and elapsed time is exactly `step / hz` ([Clock.ts:132](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L132)). Nothing in the core integrates wall time: `FixedLoop` is the only code that turns `deltaMS` into steps ([FixedLoop.ts:226-240](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/FixedLoop.ts#L226-L240)), and a schedule that omits `Clock.system` leaves the resource at step 0 with `every` permanently false ([Clock.ts:98](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L98), [Clock.ts:341-342](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L341-L342), inferred from source).

### Speed sets the cost of a tick, not when ticks run

At `hz(60)` a tick is 1/60 s of game time; at `hz(1)` it is one second. But a tick exists only when something runs it: `runtime.tick(...)` for a host-driven game, `session.advance(...)` for a netcode session. Clock rate never fires a tick on its own, so it cannot "execute buffered actions faster": it only changes how much simulation time each executed tick represents.

A buffered input belongs to a tick and is consumed when that tick runs. Lockstep records every seat's input under its tick, then `runUpTo(localNext)` loops one tick per iteration, gathering that tick's inputs and pruning the older ones afterwards ([session.ts:681-684](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L681-L684), [session.ts:362-370](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L362-L370), [session.ts:334-338](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L334-L338)). One `advance` can run several ticks — bounded by `inputDelay`, since recording stops at `next + delay` ([session.ts:615-617](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L615-L617)) — but each queued input still runs at its own tick, in order. Raising the clock rate multiplies the ticks a second of wall time would cover, and each of those ticks still waits for its input.

### Timed effects are steps, not seconds

This is the part that bites game logic. A buff or cooldown is not a float timer decremented by `dt`; the `no-float-timers` oxlint rule exists to reject `timer -= dt` and `cooldown - time.dt` ([oxlint README:192](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/oxlint-plugin/README.md#L192)). The idioms are:

- a stored `Clock.Deadline` (an absolute step) built with `Clock.durationOfSteps(step, n)`, set with `Clock.deadline`, checked with `Clock.reached` ([integration/netcode/game.ts:54](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/integration/netcode/game.ts#L54), [:122-133](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/integration/netcode/game.ts#L122-L133)); the docs even show `left: buff.left - time.dt` as the error the rule catches ([oxlint README:166-177](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/oxlint-plugin/README.md#L166-L177));
- a counted field: a shot carries `life: 50`, decremented once per tick, despawning at `life <= 1` ([integration/netcode/game.ts:141-166](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/integration/netcode/game.ts#L141-L166)); the controls demo counts a dash cooldown as `cooldown - 1` against 24 steps ([controls/sim.ts:24-25](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/website/src/demos/controls/sim.ts#L24-L25), [:156-160](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/website/src/demos/controls/sim.ts#L156-L160));
- `Clock.every` over a step duration for periodic work ([Clock.ts:341-342](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L341-L342)).

So a "5 second buff" is `5 * hz` ticks. Its wall-clock lifetime is however long those ticks take to run, which under lockstep stalls, a hidden tab, or a slow frame is longer than five seconds — and under a fast host, still exactly five seconds of game time because the tick count is fixed. Durations are simulation facts; wall time is the host's problem.

### What the loop does with slow frames

`FixedLoop` clamps each frame's wall time to `maxFrameSeconds`, runs at most `maxStepsPerFrame` updates, and discards the excess whole steps rather than deferring them; only the sub-step remainder survives, as the render `alpha` ([FixedLoop.ts:226-247](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/FixedLoop.ts#L226-L247), [FixedLoop.ts:239](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/FixedLoop.ts#L239)). A slow frame therefore makes game time fall behind instead of catching up in a burst, which is the behaviour you want for determinism and the reason a backgrounded tab does not fast-forward on return.

One system runs at most once per tick inside a schedule, and the same system twice in one schedule is a construction error ([Schedule.ts:896-905](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Schedule.ts#L896-L905)); nothing dedupes a system placed in two schedules passed to the same `runtime.tick(...)` call ([Runtime.ts:2541-2550](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Runtime.ts#L2541-L2550), inferred). A `when` that fails skips the system and discards its messages ([Runtime.ts:2017-2022](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Runtime.ts#L2017-L2022)).
## Determinism across devices

JavaScript engines may approximate `Math.sin`, `cos`, `tan`, `atan2`, `exp`, `log`, `pow`, `hypot`, and `a ** b`, and they do: Chrome, Safari, macOS, and Linux disagree in the last bit, and a simulation amplifies that bit into a divergent run. Ritmo ships `Ops`, pure-JavaScript ports of fdlibm built only from operations every engine rounds exactly, so they return the same bits everywhere (within one ulp) ([npm](https://www.npmjs.com/package/@typeonce/ritmo)).

Randomness is `Random`, a mulberry32 generator whose whole state is one integer, kept in a resource so it replays and saves with the world: `Random.seed(n)`, drawn with `Random.draw(resources.rng)` ([npm](https://www.npmjs.com/package/@typeonce/ritmo)). The `ritmo/use-ops-for-math` oxlint rule flags leftover `Math` calls in simulation code and `oxlint --fix` rewrites them and adds the import.

## Headless debugging: invariants, `why()`, replays

`@typeonce/ritmo-devtools` runs the real schedules frame by frame in Node with **no page open**. You write a rule as an **invariant**, the session checks it after every tick, and stops on the first frame that breaks it. `why()` then names the system that wrote the bad value and the input that caused it — the docs' example traces a ball entering a forbidden zone on frame 66 back to a dash on frame 62 ([devtools](https://ritmo.typeonce.dev/docs/devtools/)).

The same machinery powers scripted keyboard/gamepad/pointer input (`Keyboard.scripted`, `Pointer.scripted`), a host clock pinned to zero for reproducible timing, trace reports, fuzzing, and **replays that become tests** ([llms.txt](https://ritmo.typeonce.dev/llms.txt)). This is the part that is genuinely unusual for a JS ECS: the debugging surface is designed to be read by an agent, not clicked by a human.

## Packages

All released together at the same version ([README](https://github.com/typeonce-dev/ritmo)):

| Package | Contents |
|---|---|
| `@typeonce/ritmo` | ECS runtime, fixed-step loop, seeded random, same-bits trig (`Ops`) |
| `@typeonce/ritmo-math` | 2D helpers on plain data: vectors, angles, swept circle collision, flow field |
| `@typeonce/ritmo-browser` | animation-frame ticks; keyboard, gamepad, pointer, touch actions, merged or split per local player |
| `@typeonce/ritmo-render` | entity-to-node sync for any renderer |
| `@typeonce/ritmo-pixi` | Pixi adapter for the render-node registry |
| `@typeonce/ritmo-netcode` | rollback and lockstep sessions over WebSocket, WebRTC, or any transport, with resync and desync checks |
| `@typeonce/ritmo-devtools` | headless debug sessions, trace reports, replays, fuzzing, `ritmo-devtools lint` |
| `@typeonce/oxlint-plugin-ritmo` | lint rules for deterministic, headless simulation code |

## Agent-first packaging

The project's stated audience is a person directing a coding agent, not a person typing the systems ([with-an-agent](https://ritmo.typeonce.dev/docs/with-an-agent/)):

- `SETUP.md` is a paste-in prompt: it installs `@typeonce/ritmo` and `@typeonce/ritmo-devtools`, symlinks the `ritmo` and `ritmo-prototype` skills from `node_modules` into `.agents/skills`, and wires oxlint plus `ritmo-devtools lint` into one check script ([SETUP.md](https://github.com/typeonce-dev/ritmo/blob/main/packages/core/SETUP.md)).
- Because the skills live in the npm package and are symlinked, they update with every upgrade; the flip side is that a new oxlint rule is not active until `.oxlintrc.json` lists it, so upgrades need that comparison ([SETUP.md](https://github.com/typeonce-dev/ritmo/blob/main/packages/core/SETUP.md)).
- The docs present ten agent-made mistakes that are compile errors, each paired with the message the editor shows ([type-safety](https://ritmo.typeonce.dev/docs/type-safety/)).
- A lighter `ritmo-prototype` mode trades the full checks for a playable build each round while a mechanic is still being felt out ([README](https://github.com/typeonce-dev/ritmo)).

## Maturity and who is behind it

| Signal | Value (2026-10-27) |
|---|---|
| Publisher | `typeonce-dev` GitHub org; npm scope `@typeonce` ([API](https://api.github.com/repos/typeonce-dev/ritmo)) |
| License | MIT |
| Version | 0.17.0, published within hours of the read ([npm](https://www.npmjs.com/package/@typeonce/ritmo)) |
| Repo age | created 2026-03-28; last push 2026-10-27 |
| Stars / forks / open issues | 124 / 5 / 2 |
| Language / toolchain | TypeScript, requires TS 5.9+ with `strict` |
| Games in the README | Inkline Town (isometric, Three.js), Spirit Call (top-down mobile), GTA: Lunigiana (isometric pixel art), Bug Killer (top-down shooter, 4-player) |

The demo games matter for evaluating it: they are real, public repositories, and they cover 2D top-down, isometric, mobile input, and multiplayer — the shapes the library claims to support ([README](https://github.com/typeonce-dev/ritmo)).

## Netcode: peer-to-peer, turn-based, and card games

Follow-up asked on 2026-10-27: can Ritmo run a peer-to-peer turn-based or card game? Read against `@typeonce/ritmo-netcode` 0.17.0 and the source pinned at commit [`d13e988`](https://github.com/typeonce-dev/ritmo/tree/d13e98811bf374137389d86f3790613d66fb430d).

**Yes for a turn-based game with full information. No for a card game with secret hands** — the netcode replicates the whole world to every peer by design.

### P2P at the transport, host at the save

The package carries no server and opens no connection; a `NetworkLink` wraps one the game made ([netcode README](https://cdn.jsdelivr.net/npm/@typeonce/ritmo-netcode@0.17.0/README.md)). `WebRtcNetworkLink.make(channel)` consumes an already-open data channel, and its source states that signaling stays with the game ([WebRtcNetworkLink.ts:9-36](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/WebRtcNetworkLink.ts#L9-L36)). So peer-to-peer works, but you bring the signaling channel and the ICE setup: WebRTC's own flow needs a signaling server and STUN candidates, with TURN as the relay fallback ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)). No offer/ICE/STUN/TURN code exists in the package, and the wire format is text JSON ([wire.ts:161](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/wire.ts#L161)).

Seat 0 is a host, not an authority: it starts the match once it has heard from `count-1` peers ([session.ts:655](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L655)), broadcasts one whole-world save ([session.ts:409-421](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L409-L421)), and is the only seat whose `sync` message is applied ([session.ts:445](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L445)). It runs the same simulation as every other seat. Seat counts are at least 2 with no upper bound ([seats.ts:49](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/seats.ts#L49)); `links` is only validated non-empty ([session.ts:103](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L103)), so a missing link stalls rather than erroring.

### Turn-based: lockstep, no loop required

The project's own playbook picks the mode: "Rollback for real-time play, lockstep for turn-based or slow play" ([netcode playbook:7](https://cdn.jsdelivr.net/npm/@typeonce/ritmo@0.17.0/skills/ritmo/playbooks/netcode.md)).

- `session.advance(local)` is a public synchronous call returning `Result<Advanced, SessionError>`; nothing ties it to `FixedLoop`, and the tests drive it from plain per-frame loops ([Netcode.ts:355](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/Netcode.ts#L355), [Netcode.test.ts:98](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/test/Netcode.test.ts#L98)).
- Lockstep records the local input, then runs nothing when another seat's input is missing, returning `{ _tag: "Stalled", input }` ([session.ts:681-692](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L681-L692)). The run gate is every other seat's input for that tick, or that seat being played around ([session.ts:352-359](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L352-L359)).
- Every peer must call `advance` to progress its own world, but the calls need not be synchronized: a peer runs a tick as soon as every seat's input for it is buffered locally ([session.ts:536-548](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L536-L548), [session.ts:682-683](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L682-L683)). That is the shape a turn-based game wants: call `advance` when a move message arrives.

Two practical gotchas, both from source rather than docs:

- **Timeouts only tick inside `advance`.** `timeoutMS` defaults to 5000, must be finite and greater than zero, and cannot be disabled ([session.ts:116-117](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L116-L117)). A message-only loop that idles longer than that ends the session with `Disconnected` on its next `advance`, measured from the last received message ([session.ts:503-512](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L503-L512), [session.ts:435-436](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L435-L436)). Either pass a very large finite `timeoutMS`, or call `advance` periodically with idle input, which is also what sends the liveness pings ([session.ts:550-553](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L550-L553)).
- **Rates are free but untested at turn-based scale.** `Clock.hz(1)` is valid, since any positive whole literal is ([Clock.ts:65-73](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/Clock.ts#L65-L73)), but every session and `FixedLoop` test runs at 60 Hz, and `FixedLoop` admits at most `maxFrameSeconds` of wall time per host frame, so a huge step accumulates slowly ([FixedLoop.ts:226-232](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/core/src/FixedLoop.ts#L226-L232)).

### The blocker for card games: every peer holds the world

| What | Where it goes | Evidence |
|---|---|---|
| The sync message | one whole-world `save`, no per-seat variant | [wire.ts:36](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/wire.ts#L36) |
| Seat 0's save | broadcast to every link | [session.ts:409-421](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L409-L421) |
| Every seat's input | broadcast unfiltered to every link | [session.ts:220](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L220), [session.ts:536-548](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L536-L548) |
| Desync checks | whole-world checksums | [wire.ts:47-51](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/wire.ts#L47-L51) |

There is no redaction, fog-of-war, per-seat view, or hidden-information path in the protocol or the docs ([wire.ts:30-80](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/wire.ts#L30-L80)). Every client receives the deck order and every hand, so an opponent's cards sit in the client's memory and any client-side filtering is cosmetic. The "server as seat 0" arrangement the playbook mentions for client prediction does not change this: seat 0 also runs the full simulation and broadcasts it ([netcode playbook:7](https://cdn.jsdelivr.net/npm/@typeonce/ritmo@0.17.0/skills/ritmo/playbooks/netcode.md), [session.ts:409-421](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/packages/netcode/src/internal/session.ts#L409-L421)).

What is left:

- **Full-information games** — most abstracts, and board or deck-builders where the deck is public — fit lockstep directly.
- **Hidden-information games** need the secret state kept out of the shared world, with your own request/response protocol between an authority and each client. At that point Ritmo is a simulation library for the authority, and `ritmo-netcode` is not the transport.
- **Server-authoritative with filtered views** is not offered: the package has no authoritative model and no per-seat state.

### What is missing in practice

No turn-based, card, or board demo exists. The only netcode demos are a real-time rollback shooter ([website/src/demos/index.ts:42-44](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/website/src/demos/index.ts#L42-L44)), the only "server" is a relay that forwards each message verbatim ([integration/netcode/test/websocket.test.ts:10-18](https://github.com/typeonce-dev/ritmo/blob/d13e98811bf374137389d86f3790613d66fb430d/integration/netcode/test/websocket.test.ts#L10-L18)), and lockstep is tested only on a 60 Hz shooter. The turn-based path is a documented intent with no worked example, so budget for being the first to hit its edges.

If you build one: use `Netcode.lockstep`, assign a peer as seat 0 for the room, wire `advance` to your transport's message handler, raise `timeoutMS` or idle-tick, and test two peers over a seeded `MemoryNetworkLink` before trusting it.
## When it fits, when it does not

This section is analysis, not a claim from the project.

- **Fits** a TypeScript game where the simulation is the hard part, the renderer is swappable (Three.js, Pixi, canvas), and you want deterministic replays, rollback netcode, or an agent doing the systems work. The type-level schema and headless invariants pay for themselves exactly there.
- **Fits a turn-based online game** with full information: `Netcode.lockstep` over an open WebRTC data channel is the documented pattern, and a transport-driven `session.advance()` needs no animation-frame loop.
- **Does not fit** a quick jam prototype in JS without TypeScript 5.9 + strict, a project that needs a batteries-included engine (physics, asset pipeline, editor), or a project whose bottleneck is ECS throughput: Ritmo publishes no benchmark numbers, and its pitch is correctness and determinism rather than cache-friendly typed-array iteration. [unverified] on the throughput comparison — no independent benchmark was found.
- **Does not fit a card game with secret hands**, or any fog-of-war: the netcode broadcasts one whole-world save and every seat's input to every link, so the opponent's hand is in the client's memory, and there is no per-seat view or authoritative-server model.
- **Watch out for** 0.x churn and the version-pinned docs: the API changes between minor versions according to its own `llms.txt`, and the npm jump to 0.17.0 landed the same day as this read. Turn-based play has no worked example, and its most likely first bug is the 5 s `timeoutMS` on a message-driven loop.

## Open Questions

- No public benchmarks for query iteration, world size, or netcode bandwidth were found; the "CI fails on runtime regressions over 25%" claim refers to the project's own CI, not published numbers ([README](https://github.com/typeonce-dev/ritmo)).
- No independent review, conference talk, or third-party comparison of Ritmo against bitECS, miniplex, Thyseus, or ECSY surfaced in search on 2026-10-27.
- Hidden information is undocumented as a design direction: the wire protocol has no per-seat variant, no fog-of-war or two-view example exists in the repo, and whether a game-side split (secret state kept outside the world) is intended is unknown.
- No turn-based, card, or board demo exists; lockstep is tested only on a 60 Hz shooter, so the recommended turn-based path is untested end to end.

## Related

- No other ECS or game-engine file exists in this repo yet; the closest technology entry is [Modern JavaScript Video Player Libraries](./js-video-player-libraries.md), which is unrelated beyond both being JS library landscape surveys.

## Changelog

- 2026-10-27 — created from the v0.17.0 docs, npm page, repo README, `SETUP.md`, and the GitHub API; sources gathered through TinyFish.
- 2026-10-27 — netcode follow-up: read the `@typeonce/ritmo-netcode` 0.17.0 README and the netcode playbook, and scouted the source pinned at `d13e988`; added the peer-to-peer, turn-based, and hidden-information section.
- 2026-10-27 — clock follow-up: scouted `Clock`, `FixedLoop`, the schedule runner, the netcode tick loop, and the `no-float-timers` rule; added the tick-counter / buffered-input / timed-effects section.
