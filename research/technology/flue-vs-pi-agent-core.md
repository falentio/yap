---
title: Flue vs pi-agent-core — Framework or Loop?
category: technology
tags: [flue, pi, pi-agent-core, withastro, cloudflare, agents-sdk, framework, harness, sandbox, comparison]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/withastro/flue
  - https://raw.githubusercontent.com/withastro/flue/main/packages/runtime/package.json
  - https://www.npmjs.com/package/@flue/runtime
  - https://flueframework.com/docs/
  - https://flueframework.com/docs/concepts/agents/
  - https://blog.cloudflare.com/agents-platform-flue-sdk
  - https://www.paralect.com/stack/top-ai-agent-frameworks
  - https://github.com/earendil-works/pi/tree/babe30a7e6c1/packages/agent
  - https://developers.cloudflare.com/agents/harnesses/pi/
confidence: high
---

# Flue vs pi-agent-core — Framework or Loop?

## TL;DR

- **It is not either/or.** `@flue/runtime` 2.0.3 depends on `@earendil-works/pi-agent-core` **^0.83.0**
  and `@earendil-works/pi-ai` `^0.83.0`
  ([package.json](https://raw.githubusercontent.com/withastro/flue/main/packages/runtime/package.json)).
  Flue is a **framework built on the pi harness**, not a replacement engine — Cloudflare describes the
  stack as three layers: framework (Flue) → harness (Pi) → runtime/platform (Agents SDK)
  ([Cloudflare](https://blog.cloudflare.com/agents-platform-flue-sdk)).
- **So the real question is:** do you want a framework that owns the project structure, sandbox,
  sessions, deployment targets, channels, and build pipeline — at the cost of a pinned, older
  pi-agent-core and Flue's own experimental API? Or do you want the loop and nothing else?
- **Flue brings a lot you would otherwise write:** a default virtual bash sandbox, sessions with
  persistence, tools/skills/MCP, subagents, channels (Slack/GitHub/Discord/Linear), Durable Streams
  recovery, OpenTelemetry, a CLI with blueprint-driven `flue add`, and two first-class targets
  (Node/Hono, Cloudflare Durable Objects).
- **Flue costs you control and version currency:** `^0.83.0` cannot take pi 1.x (the pi family is at
  **1.4.0**), its own README says "Experimental… APIs may change", it assumes a Vite build and an
  `agents/` directory, and it does not give you the coding agent's tools, extensions, or TUI.
- **Rule of thumb:** if your product is "an agent product" and you have not already built storage,
  sandboxing, and deployment plumbing, Flue is the cheaper path. If your agent is one component
  inside a system you already own — a Durable Object with its own schema, a browser, an existing
  server — `pi-agent-core` is the smaller, more durable dependency.

## Context

Asked 2026-10-29: "what is consideration to use flueagent instead of pi agent core". Read: Flue's
repo README, its `@flue/runtime` package manifest (which settles the relationship), npm README,
docs (getting started, agents), Cloudflare's launch post, and a third-party framework comparison.
Pi's side is pinned at `earendil-works/pi` @ `babe30a7e6c1` (1.4.0), as in
[the package map](../reference/pi-package-map.md).

## Findings

### 1. The dependency that reframes the question

```json
"dependencies": {
  "@earendil-works/pi-agent-core": "^0.83.0",
  "@earendil-works/pi-ai": "^0.83.0",
  "@hono/node-server": "^2.0.3",
  "@modelcontextprotocol/client": "2.0.0",
  "hono": "^4.8.3",
  "js-yaml": "^5.2.1",
  "ulidx": "^2.4.1",
  "valibot": "^1.1.0"
}
```

Two consequences follow immediately:

1. **Flue's model access is pi-ai.** Its own getting-started page says to "use any LLM provider that
   Pi supports" and points at Pi's Providers documentation
   ([docs](https://flueframework.com/docs/)). Choosing Flue does not move you off pi.
2. **Flue pins an older harness.** `^0.83.0` means `>=0.83.0 <0.84.0`; the pi family is at
   **1.4.0**. Using Flue means using pi-agent-core as Flue built it, not the version you would pick.

### 2. What each layer is responsible for

| Layer | Flue | `pi-agent-core` |
| --- | --- | --- |
| Agent definition | `createAgent()` + `'use agent'` module, discovered from `agents/` | you construct `new Agent({...})` |
| The loop | delegated to pi-agent-core | **is** the package |
| Tools | `useTool()`, typed with valibot, plus built-in `grep`/`glob`/`read` in the sandbox | none — you supply every tool |
| Sandbox | default virtual bash (`just-bash`), container opt-in (`local()` and remote) | none |
| Sessions / continuity | built in, persisted to the target's store | none; host persists |
| Durability | Durable Streams + platform recovery (Cloudflare `runFiber`/`stash`/`onFiberRecovered`) | none; `pi-durable` is the sibling answer |
| Skills / instructions | `useSkill()`, Markdown skills, `AGENTS.md` | none |
| MCP | `@modelcontextprotocol/client` integration | none |
| Deployment | `flue init --target node|cloudflare`, Vite plugin, CLI | you host it |
| Channels / UI | Slack/GitHub/Discord/Teams/Linear; `@flue/react` hooks | none |
| Observability | `@flue/opentelemetry`, Braintrust + Sentry examples | none (events only) |

### 3. Considerations in Flue's favour

| Consideration | Why it matters |
| --- | --- |
| **Speed to a working agent** | ~25 lines of declarative code for a triage agent that reproduces a bug in a sandbox ([Cloudflare](https://blog.cloudflare.com/agents-platform-flue-sdk)) |
| **Sandbox by default** | every agent gets a filesystem and a shell without you building one; the virtual sandbox is "dramatically faster, cheaper, and more scalable than running a full container for every agent" ([npm README](https://www.npmjs.com/package/@flue/runtime)) |
| **Two supported targets** | Node/Hono and Cloudflare Durable Objects, with one agent per DO and platform-backed durability |
| **Durability without designing it** | append-only Durable Streams: "if a process dies, another simply picks up the log" ([Cloudflare](https://blog.cloudflare.com/agents-platform-flue-sdk)) |
| **Integrations you would otherwise write** | verified Slack/GitHub/Discord events, `flue add channel slack` generating a blueprint a coding agent can apply |
| **Frontend story** | `@flue/react` streams state, tool execution, and messages into an app |
| **Operational surface** | OpenTelemetry adapter, Braintrust and Sentry examples, typed `result` schemas for structured output |
| **Backing** | Apache-2.0, ~8.5k stars, from the Astro team, and Cloudflare's first framework on the Agents SDK |
| **A vocabulary your team may already have** | "harness", "skills", "sandbox", "channels" map to how Claude Code and friends are described |

### 4. Considerations against Flue (and for the raw loop)

| Consideration | Why it matters |
| --- | --- |
| **Not a substitute, a wrapper** | you still ship pi-agent-core and pi-ai, now indirectly |
| **Stale harness pin** | `^0.83.0` vs pi 1.4.0; you wait for Flue to move, and its moves are its own |
| **Experimental API on both sides** | Flue's npm README opens with "Experimental — Flue is under active development. APIs may change", and so does pi-durable; two moving parts instead of one |
| **Opinionated shape** | `agents/` discovery, `'use agent'`, Vite plugin, `flue.config.ts`, CLI verbs — you adopt the project model, not just a library |
| **Abstraction tax when debugging** | when a turn misbehaves you debug Flue's session layer, pi's loop, and the platform's durability, in that order |
| **Owns the entrypoint** | embedding an agent inside an existing Durable Object, worker, or server means fighting the build target |
| **Not the coding agent** | no `read`/`edit`/`bash` coding tools, no extensions, no TUI, no `.pi` resources — Flue has its own tool/skill model |
| **Its durability is its own** | Flue does not use `pi-durable`; if you standardise on the pi stack, you now run two durability designs |
| **Two release treadmills** | Flue's cadence plus pi's; pinning both is mandatory |
| **Extras are real dependencies** | Hono, valibot, MCP client, ulidx, js-yaml — a heavier tree than a loop with one runtime import |

### 5. Version and compatibility risk

| Artifact | Version | Risk |
| --- | --- | --- |
| `@flue/runtime` | 2.0.3, engines Node `>=22.19.0` | self-declared experimental |
| `pi-agent-core` via Flue | `^0.83.0` | cannot take pi 1.x; features and fixes in 1.x are unavailable through Flue |
| `pi-agent-core` today | 1.4.0 | six minors ahead of Flue's floor |
| Cloudflare target | Agents SDK + `@cloudflare/codemode`/`shell` | each `agents` release supports one pi minor — a third pin once Flue moves ([Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/)) |

### 6. The seven questions that decide it

1. **Do you already have storage?** If yes (a schema, a DO, Postgres), Flue's session store is
   duplicated state; raw core plus `pi-durable` or your own store is cleaner.
2. **Do you need a sandbox?** If the agent runs generated code or needs a filesystem, Flue's default
   virtual sandbox is a large shortcut. If tools are just API calls, it is dead weight.
3. **Is your entrypoint yours?** If you must run inside an existing Worker, DO, or browser tab, the
   loop is the easier fit; Flue wants to own build and routing.
4. **How many agents?** Flue's per-DO-per-agent mapping is a gift at scale; at one agent, it is
   ceremony.
5. **Do you need channels and UI?** If yes, Flue deletes weeks of plumbing. If no, it is surface you
   will never touch.
6. **Can you tolerate pinning pi at 0.83?** If you need a fix from pi 1.x, check whether Flue has
   taken it — you cannot bump it yourself without forking.
7. **Who debugs it at 3 a.m.?** A framework is a second vendor in the incident path.

### 7. Decision guide

| Situation | Pick |
| --- | --- |
| Greenfield agent product, needs sandbox + deployment + channels | **Flue** |
| Agent as one component of an existing backend, storage already owned | **`pi-agent-core`** (plus `pi-durable` if turns must survive crashes) |
| Cloudflare-first, want one agent per Durable Object with durable execution | **Flue on Cloudflare**, or the pi harness directly if you want no framework |
| Need the coding agent's tools/extensions/TUI behaviour | **neither** — that is `pi-coding-agent` |
| Need approvals, session deletion, rollback guarantees today | **neither** — see [pi-durable production readiness](./pi-durable-production-readiness.md) |
| Prototype this week, production next quarter | **Flue now**, with the migration cost in §8 priced in |

### 8. Migration costs, both directions

**Flue → raw `pi-agent-core`:** you reimplement the session store, sandbox, tools/skills loading,
deployment routing, channels, and durability; you keep your agent definitions' prompt and tool list.
Cheap if your tool surface is small, expensive if you leaned on the virtual sandbox and channels.

**Raw core → Flue:** you delete your loop wiring, session store, and sandbox; you adopt `agents/`,
`createAgent`, the Vite plugin, and Flue's store. Cheap if you never customised storage, expensive if
your state model is product-specific.

## Gotchas

- **"Flue instead of pi-agent-core" is a category error** — Flue ships pi-agent-core inside.
- **Flue's docs point at Pi for providers**, so a "Flue migration" does not change your model layer,
  credentials, or cost profile.
- **The pin is the trap.** `^0.83.0` is invisible until you need a 1.x behaviour.
- **Two experimentals stack.** Flue says its API may change; pi-durable says the same. A product
  depending on both inherits both schedules.

## Open questions

- Has Flue moved past `^0.83.0` on main, or is 2.0.3 the current pin? Probe: watch the runtime
  manifest across releases.
- Does Flue's Cloudflare target work with the current `agents` release and pi 1.4 through its own
  adapter, or does the pin force an older `agents`? Probe: install Flue on Cloudflare and read the
  resolved peer graph.
- How do Flue's Durable Streams and `pi-durable` differ in crash semantics? Both claim resume; only
  one test suite is public in each.

## Related

- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md) — the layer Flue sits
  on top of.
- [Pi Durable — Production Readiness Assessment](./pi-durable-production-readiness.md) — the other
  answer to "my turns must survive a crash".
- [Pi Coding Agent on Cloudflare Workers with a Daytona Filesystem](./pi-coding-agent-cloudflare-workers-daytona-fs.md)
  — the hosting options when you do not want a framework.

## Changelog

- 2026-10-29 — created. Evidence: `@flue/runtime` 2.0.3 manifest (dependency pins), Flue repo and
  npm READMEs, Flue docs, Cloudflare's launch post, and a third-party comparison. The decisive fact
  (Flue depends on pi-agent-core ^0.83.0) is from the published package manifest.
