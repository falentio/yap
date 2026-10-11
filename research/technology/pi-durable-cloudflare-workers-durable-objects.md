---
title: Pi Durable on Cloudflare Workers & Durable Objects
category: technology
tags: [pi, pi-durable, cloudflare, durable-objects, workers, agents-sdk, earendil, agent-harness, durability]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://earendil.com/posts/pi-durable/
  - https://github.com/earendil-works/pi/tree/main/packages/durable
  - https://developers.cloudflare.com/agents/harnesses/pi/
  - https://developers.cloudflare.com/changelog/post/2026-10-02-pi-harness/
  - https://developers.cloudflare.com/agents/harnesses/pi/extensions/
  - https://developers.cloudflare.com/agents/models/pi-ai/
  - https://developers.cloudflare.com/durable-objects/platform/limits/
  - https://developers.cloudflare.com/durable-objects/platform/pricing/
  - https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
  - https://developers.cloudflare.com/workers/platform/limits/
  - https://news.ycombinator.com/item?id=49925969
  - https://github.com/funtuan/pi-agent-cf
confidence: high
---

# Pi Durable on Cloudflare Workers & Durable Objects

## TL;DR

- **Pi Durable** (`@earendil-works/pi-durable`) is Earendil's experimental **durable agent
  harness** — the storage + task machinery behind an agent loop — shipped 2026-10-01 alongside
  Pi 1.0. It commits every step (model turns, tool calls, your own state) to storage *before*
  anything is shown, so a dead process reopens storage and resumes from its last checkpoint
  ([Earendil](https://earendil.com/posts/pi-durable/)).
- **Cloudflare ships first-class hosting for it**: the Agents SDK exposes a `PiHarness`
  "Lifecycle capability" that runs Pi Durable **inside a Durable Object**, backed by the
  object's SQLite database, with a Lifecycle job that wakes the object after eviction
  ([changelog 2026-10-02](https://developers.cloudflare.com/changelog/post/2026-10-02-pi-harness/),
  [Pi harness docs](https://developers.cloudflare.com/agents/harnesses/pi/)).
- The fit is architectural, not incidental: Pi Durable's SQLite/JSONL storage "uses no Node
  APIs, so with a small adapter it runs on Bun or inside a Cloudflare Durable Object," and its
  "one process owns a storage at a time" model is exactly a DO's single-threaded, globally
  unique guarantee ([Earendil](https://earendil.com/posts/pi-durable/)).
- The binding constraints are **DO/Worker limits**: 128 MB memory per isolate, 30 s default CPU
  per invocation (5 min max), 15 min wall time for **alarm** invocations (the wake-up path), and
  10 GB SQLite per object. A model request that streams >15 min can be cut off
  ([DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
  [Pi limitations](https://developers.cloudflare.com/agents/harnesses/pi/)).

## Context

Researched 2026-10-08 to answer "how does Pi Durable run hosted on Cloudflare Workers /
Durable Objects?" Two things make this concrete rather than hypothetical:

1. **Earendil Works is the same org that publishes this environment's `pi` binary** — this
   repo's `AGENTS.md` and the installed `@earendil-works/pi-coding-agent` (v1.1.0) are the
   sibling package to the `durable` package studied here.
2. **Cloudflare and Earendil shipped the integration together** on 2026-10-02, four days
   before this read.

**Pinned revision.** Source read from a shallow sparse clone of
[`earendil-works/pi`](https://github.com/earendil-works/pi) at commit
`ce950d78f424dcaf9f5d6a03ce80ab141130eb1d`, package version **1.1.0** (`packages/durable/package.json`).
Clone kept in scratch (`/tmp`), per repo rules. Read 2026-10-08.

**Scope.** The durable harness's architecture, how it maps onto a Durable Object, the
constraints, and the practical tradeoffs. Not a code review, and not a comparison of every
durable-agent framework.

## Findings

### 1. What "Pi Durable" is, and what it is not

| Dimension | Value |
| --- | --- |
| Package | `@earendil-works/pi-durable` v1.1.0 |
| Status | **Experimental** — "The API changes without notice between releases" (`README.md`) |
| Shipped | 2026-10-01, with Pi 1.0 ([Earendil](https://earendil.com/posts/pi-durable/)) |
| Built on | `@earendil-works/pi-ai` (models), `@earendil-works/chord` (document state) |
| Size | ~15,000 lines excluding tests (~150k GPT tokens) |
| Runtime target | "anywhere there is a JavaScript runtime" |
| Relationship to Pi | Shares code + principles, **does not replace** the Pi coding agent |

Pi Durable is a **library/framework for building agentic applications**, not a product. Earendil
frames the split as: Pi the coding agent is for "your (remote) machine, inside a terminal, driven
by one person"; Pi Durable is for agents that "run anywhere, can be reached from different
surfaces, support infinitely long conversations, survive catastrophic internal and external
failures, and let multiple humans steer the same agents" ([Earendil](https://earendil.com/posts/pi-durable/)).

The harness is defined as **storage + the machinery to run one or more conversations in
parallel**, providing the tools those models call and the execution environments the tools run in.
"Everything the harness runs, from calling the model to executing a tool, is a task."

### 2. Core architecture — the durability model

The normative spec (`packages/durable/docs/spec.md`, codename **Pico5**, 4,747 lines) states the
core rule:

> A Session atomically commits immutable entries, full task records, and Chord-tracked documents.
> Only committed state is observable.

| Concept | Meaning | Durable role |
| --- | --- | --- |
| **Harness** | One open storage + the machinery running agents on it | The unit you open; one process owns a storage |
| **Conversation** | A transcript; forks another at an entry | Survives crash; handle is stateless, compared by `id` |
| **Entry** | Immutable transcript record (`pi.user`, `pi.assistant`, `pi.tool-result`, `pi.system`, `pi.reset`) | Append-only, never reused |
| **Commit** | Atomic write of entries + document edits + task creation | All-or-nothing; one SQL transaction = one commit |
| **Document** | Typed JSON state changed in commits (`pi.agent`, `pi.live`, `pi.inbox`, `pi.usage`, `pi.provider`) | State never disagrees with the transcript |
| **Task** | Durable state machine, checkpoint per step | Resumes from last checkpoint after a crash |
| **Submission** | Input handed to a conversation, waitable | `requestId` makes it exactly-once |

Three properties carry the durability guarantee:

1. **Atomicity** — "One Session commit is atomic across all record and document writes."
2. **Durability-before-visibility** — "All visible progress is durable. There is no volatile
   publication path." Nothing is shown before its commit is stored.
3. **Effects outside the transaction** — "External effects do not run inside the Session mutation
   transaction." A tool's side effect is never part of the DB commit.

The mechanism for #3 is the **effect sandwich** (spec §5.2):

```text
commit intent phase
perform external effect
commit outcome or next phase
```

Reopening in the *intent* phase means the effect **may** have happened. The handler must "retry
safely, poll an external handle, or record interruption" — this is exactly why tools carry a
`replay` declaration (below).

**Crash recovery semantics** ([Pi harness docs](https://developers.cloudflare.com/agents/harnesses/pi/)):

| What happened | Result |
| --- | --- |
| Object evicted / crashed / exceeded memory or CPU | Next alarm restarts the object; Pi continues from last checkpoint |
| Deploy mid-run | Same as crash; runtime gives in-flight work 30 s, then the alarm restarts |
| Model was streaming | Partial answer kept and stored; the model call is made again |
| A tool with `replay: "safe"` was running | Pi runs the tool again |
| Any other tool was running | **Not** rerun; the model gets an *interrupted* result and decides |

`replay: "safe"` is an explicit opt-in for idempotent tools (reads, searches, whole-file writes);
edits and charge-the-card style calls stay unsafe by default.

### 3. How it maps onto a Durable Object

The integration is the **`PiHarness`** class, a *Lifecycle capability* in the Cloudflare Agents
SDK. Pi Durable owns the agent loop; the Lifecycle "is responsible for keeping the agent running
in the Durable Object" ([changelog](https://developers.cloudflare.com/changelog/post/2026-10-02-pi-harness/)).

`PiHarness` uses the Lifecycle in exactly two ways
([docs](https://developers.cloudflare.com/agents/harnesses/pi/)):

| Use | Mechanism |
| --- | --- |
| **Storage** | Pi keeps transcripts, inbox, and tasks in its own tables in the object's SQLite DB; tables are prefixed `pi_` to avoid collisions |
| **Wake-up** | Pi's scheduler is in-memory (an evicted object has none), so `PiHarness` schedules a Lifecycle job that heartbeats while Pi works and completes when idle; the job's **alarm** restarts an evicted object mid-run |

The minimal wiring (from the docs):

```ts
import { Agent } from "agents";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { createAI } from "agents/models/pi-ai";

export class Assistant extends Agent<Env> {
  ai = createAI({ binding: this.env.AI });
  registry = createRegistry();

  harness = new PiHarness({
    harness: ({ storage, context }) => {
      const models = createModels();
      models.setProvider(this.ai.provider);
      return Harness.open(storage, { models, registry: this.registry }, context);
    },
    defaults: { model: this.ai("@cf/moonshotai/kimi-k2.7-code") },
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.lifecycle.use(this.harness);
  }

  async ask(prompt: string) {
    const { text } = await this.harness.prompt(prompt);
    return text;
  }
}
```

Key architectural decisions the docs make explicit:

- **`PiHarness` does not choose the transport.** "It gives you each session's event stream, and
  you send it over WebSockets, HTTP, or RPC." Transport is yours.
- **The harness factory runs once per isolate**, inside the object's startup, before any session
  is used. Every `PiHarness` operation waits for startup.
- **One DO per conversation.** "Session ids are Pi's conversation ids, so you cannot choose them.
  To give each user or chat its own agent, use one Durable Object per conversation and the root
  session in each."
- **`submit()` vs `prompt()`** — `submit()` returns once Pi has *durably stored* the input
  (before the model runs); `wait(operationId)` returns the result later, possibly from another
  request. `operationId` makes submission idempotent.

**Why the mapping is clean** (this is the interesting part): Pi Durable already assumed
"one process owns a storage at a time, and other clients attach to that process"
([Earendil](https://earendil.com/posts/pi-durable/)). A Durable Object *is* a single-threaded,
globally-unique, single-owner actor with co-located SQLite and an alarm scheduler. The harness
needs (a) an atomic single-writer store and (b) a way to be woken after eviction; the DO supplies
both natively.

### 4. Storage backends and the Cloudflare adapter

Pi Durable ships memory, SQLite, and JSONL backends, plus a conformance suite for your own.

| Backend | Import | Notes |
| --- | --- | --- |
| Memory | `/storage/memory` | Reference semantics; copies retained values |
| SQLite (Node) | `/storage/sqlite/node` | `openNodeSqliteStorage("./session.sqlite")` |
| SQLite (Cloudflare) | `/storage/sqlite/cloudflare` | Adapter over `ctx.storage.sql` |
| JSONL | `/storage/jsonl`, `/storage/jsonl/node` | Sidecar + main-marker publication protocol |

The Cloudflare adapter (`src/storage/sqlite/cloudflare.ts`, 139 lines) is deliberately tiny and
types `ctx.storage` **structurally** "so the package needs no Workers type dependency". Two
details worth noting from the source:

- A `SerialQueue` serializes operations so "a transaction excludes every other operation".
- DO SQL binds numbers as doubles, so a `bigint` outside the safe-integer range throws
  `RangeError` rather than silently losing precision.

The SQLite backend keeps only the **working set** in memory: active transcripts, live tasks, and
pending submissions. "Active transcripts are naturally bounded by the model's context window,
because compaction summarizes older messages before they overflow it" — so a 10,000-message
conversation still "fits snugly into memory" ([Earendil](https://earendil.com/posts/pi-durable/)).

### 5. Constraints and limits

Two limit sets apply, because a Durable Object is a special Worker.

| Limit | Value | Consequence for Pi Durable |
| --- | --- | --- |
| Memory / isolate | 128 MB | Working set must stay bounded (compaction is what makes this work) |
| CPU / DO request or alarm | 30 s default, **5 min** max (`limits.cpu_ms`) | Only counts *active* CPU; waiting on model I/O does not count |
| DO alarm wall time | **15 min** | The wake-up path; the harness hands off to a new alarm every 10 min |
| DO RPC/HTTP wall time | Unlimited (while caller connected) | Long turns are fine on the request path |
| Storage / SQLite DO | 10 GB (Paid) / 1 GB (Free) | `SQLITE_FULL` on write once full; reads + deletes still work |
| SQL row / string / BLOB | 2 MB | Transcript entries must stay under this |
| DO RPC sessions | 1 per method call | Each `stub.method()` is a billed request |
| Simultaneous outgoing connections | 6 per request | Bounds parallel model/tool fan-out at the *request* layer |
| WebSocket message size | 32 MiB (inbound) | Fine for event streaming |

Sources: [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

**Documented limitations of the harness itself** ([Pi harness docs](https://developers.cloudflare.com/agents/harnesses/pi/)):

| Limitation | Detail |
| --- | --- |
| Approvals | Pi Durable has **no approval/permission step** for tool calls yet |
| Event replay | Streams always start from a snapshot; **no cursor** to resume a stream |
| Abort vs tools | `abort()` waits until idle; a tool ignoring its abort signal keeps the session busy |
| Long model calls | A single request streaming >15 min can be cut off (alarm invocation cap) |
| Background tasks | Noticed up to 30 s late (checked on heartbeat) |
| Graceful eviction | A running session keeps work in flight, so the object does not drain while Pi runs |
| Session deletion | Pi Durable **cannot delete a conversation yet** |

**Cost shape.** A DO is billed for wall-clock duration while active *or* idle-but-not-hibernatable,
at 128 MB regardless of actual use. The Pi harness keeps a **30 s heartbeat alarm** while work is
in flight — that is duration you pay for. Idle-and-hibernatable objects are not billed
([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). This makes the
Pi design's "only the working set in memory" and "job completes when idle" choices directly
cost-relevant, not just memory hygiene.

### 6. Alternatives and prior art

| Approach | What it is | Fit |
| --- | --- | --- |
| **`PiHarness`** (official) | Agents SDK Lifecycle capability over Pi Durable | First-party, supported; beta; harness owns the loop |
| **`@funtuantw/pi-agent-cf`** | Community SDK: pi-mono `Agent` in a DO, WS Hibernation API, REST + WS protocol, alarm idle-cleanup | Wraps **pi-agent-core**, not Pi Durable; 18★; needs an AJV stub (below) |
| **`pi-agent-cf` caveat** | `pi-ai` depends on AJV, which uses `new Function()` — forbidden in Workers | Must alias `ajv` to a stub, disabling schema validation; also pin `undici@^6` |
| **Project Think** | Cloudflare's own opinionated harness on the Agents SDK | Alternative if you don't want Pi's loop |
| **Plain DO + own loop** | Build directly on `DurableObject` | Max control; you re-implement durability |

The community wrapper is instructive because it documents a **real portability wrinkle**: code
that runs fine on Node/Bun may not run in a Worker. Pi Durable sidesteps this for its *storage*
("uses no Node APIs"), but the **execution environment** is where the problem moves — file and
shell tools need a filesystem, and a DO has none. That is what the `env` hook and
`@cloudflare/computer` Workspace address (the Pi harness example ships "WebSockets, a browser UI,
and a `@cloudflare/computer` Workspace for the model's tools").

### 7. The design debate (HN, 2026-10-01)

The Hacker News thread surfaces the two criticisms worth carrying forward
([HN 49925969](https://news.ycombinator.com/item?id=49925969)):

- **Conversation trees were dropped.** Pi Durable has **forks with ancestry**, not per-entry
  parent pointers. Armin Ronacher's reply: "In Pi the coding agent, each transcript entry is
  parented to another entry. That was actually exceptionally dumb… In Pi Durable, we corrected
  this mistake. A conversation is a chronological, immutable list of entries." A fork points at an
  entry in another conversation instead of copying. Tradeoff: `/tree` and `/resume` become
  harder to implement — left to the implementor.
- **Environment state vs harness state.** A commenter asks how runner/sandbox state stays in sync
  when only the *agent* state is checkpointed. The accepted answer: the same way a workflow engine
  does it — make the environment interaction declarative/idempotent, or replay it. This is
  precisely what `replay: "safe"` encodes, and it is the sharpest open problem for Pi Durable on
  Cloudflare, where "the filesystem lives in SQLite and R2" for the `@cloudflare/computer` case.

The thread also frames the category: LangChain Deep Agents, Vercel Eve, OpenAI Agents API, and
Anthropic Managed Agents all occupy this durable-agent space, but Pi Durable is unusual in taking
a **library** posture rather than a batteries-included SDK.

## Open Questions

- **Does `PiHarness` survive a real deploy mid-turn in practice?** The docs describe 30 s of
  grace then alarm restart; no public incident writeup yet.
- **What is the actual cost of a busy agent?** Heartbeat alarms keep a DO non-hibernatable while
  work runs. No published Pi-specific cost model; the DO pricing examples are generic.
- **How well does compaction hold the 128 MB line** for a genuinely huge transcript with large
  tool outputs (each entry capped at 2 MB by SQL limits)?
- **`@cloudflare/computer` Workspace semantics** — how tool effects on that workspace interact
  with `replay` are not documented here; needs a dedicated read.
- Whether Earendil's "lessons flow back into Pi the coding agent" has produced anything concrete
  yet (as of 2026-10-08, no).

## Related

- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — the `omp` fork of Pi; shares
  the `pi-ai` lineage that Pi Durable builds on.
- [oh-my-pi — Native Rust Core](./oh-my-pi-native-rust-core.md) — the opposite design choice:
  heavy native runtime vs Pi Durable's "anywhere there is a JavaScript runtime".
- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md) — a different transport/serialization
  stack for agent-like services (pluggable protocols, typed middleware).

## Changelog

- 2026-10-08 — created. Source: sparse shallow clone of `earendil-works/pi` @
  `ce950d78f424dcaf9f5d6a03ce80ab141130eb1d` (pi-durable 1.1.0) + Cloudflare Agents/DO docs +
  Earendil announcement + HN thread.
