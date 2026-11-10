---
title: Nakama vs Hermes Agent: A Team Platform Against a One-Operator Harness
category: technology
tags: [nakama, hermes-agent, ai-agents, comparison, multi-tenant, self-hosted, teams, agent-platform]
status: complete
created: 2026-10-29
updated: 2026-11-02
sources:
  - https://github.com/ahmadrosid/nakama
  - https://ahmadrosid.github.io/nakama/
  - https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/README.md
  - https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/ARCHITECTURE.md
  - https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/THREAT_MODEL.md
  - https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/package.json
  - https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/agent/src/chat.ts
  - https://github.com/NousResearch/hermes-agent
  - https://raw.githubusercontent.com/nousresearch/hermes-agent/main/README.md
  - https://hermes-agent.nousresearch.com/docs/user-guide/profiles
  - https://github.com/NousResearch/hermes-agent/issues/27182
  - https://getnakama.cloud/
confidence: high
---

## Summary

Nakama is Hermes Agent's model, rebuilt as a multi-tenant server. Its docs page says "Inspired by Hermes Agent and OpenClaw", and the README answers the switcher's question head on: "Same class of capability, without the setup maze, and not limited to one operator on one machine" ([README](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/README.md), [docs home](https://ahmadrosid.github.io/nakama/)).

That claim holds on the narrow point. Nakama has what Hermes lacks at the foundation: accounts, orgs, invitations, `admin` and `member` roles, passkeys and TOTP, audit events, and an `org_id` on every tenant row. Hermes has one operator per home directory, and its own issue tracker documents the cost ([#27182](https://github.com/NousResearch/hermes-agent/issues/27182)).

It is not a clean win. Nakama is five months old, pre-1.0 at 0.4.61, 721 stars, and its tenant boundary is a row filter inside one SQLite file, enforced by service code rather than by the database. Hermes is fifteen months old with 258k stars, six sandbox backends, a plugin catalog, and a skills standard other tools adopt.

Pick by who else uses it. One person gets Hermes. Several people who need separate data get Nakama's model, and should carry the risk that a five-month-old project's isolation is one missing `WHERE` clause away from a cross-org leak.

## Context

Asked on 2026-10-29 as "compare github.com/ahmadrosid/nakama with hermes". Hermes means [Hermes Agent by Nous Research](https://github.com/NousResearch/hermes-agent), the same reference as [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md), not the Hermes model family.

Nakama here is ahmadrosid's AI workspace, "an AI agent platform for your team". It shares a name with the Heroic Labs game server and has nothing to do with it. Both projects are MIT. The license and the closed hosting business are covered in [Nakama — How Much Is Actually Open Source](./nakama-open-source-scope.md).

Both also put a named agent, not a chat, at the center, which is the pattern [The Bot as a Primitive](./bot-primitive.md) describes.

## Wide comparison

| Dimension | Hermes Agent | Nakama |
|---|---|---|
| Shape | Self-hosted harness for one operator | Self-hosted or managed server for many orgs |
| Maintainer | Nous Research | ahmadrosid |
| First release | 2025-07-22 | 2026-05-23 |
| Version on 2026-10-29 | v0.22.5, tagged 2026-10-23 | v0.4.61 |
| Stars, forks, open issues | 258,432, 56,747, 51,825 | 721, 121, 48 |
| Language | Python | TypeScript on Bun |
| Install | `curl -fsSL .../install.sh \| bash` | one Docker container, or a cloud wizard |
| Idle footprint | runs on a $5 VPS | about 200 MB, 1 vCPU and 1 GB for the server alone |
| Who can log in | nobody, one operator owns the home directory | invited users with `admin` or `member` roles, passkeys, TOTP |
| Tenant boundary | one profile is one home directory, and two processes on one profile corrupt it | an `org_id` column in one SQLite file, checked by service code |
| Unit of identity | a profile, and a Bot Mode bot is a profile plus roster metadata | an agent profile, scoped to an org |
| Agent loop | its own harness | 100 rounds per turn, 200,000 output tokens, parallel only when every tool is `parallelSafe` |
| Compaction | `/compress`, `/compact`, and `/new` rerouted to compact | automatic before every provider call, prune then summarize, also forced on demand |
| Memory | `MEMORY.md` 2,200 chars and one `USER.md` of 1,375 chars per profile | `MEMORY.md` per org, a soul per profile, memory providers through plugins |
| Skills | `agentskills.io` directories, self-created and self-improving | `SKILL.md` directories indexed per org, with a curator that archives and merges |
| Models | any provider per bot, 300+ through Nous Portal | 31 provider types per profile, no cross-provider fallback |
| Channels | Telegram, Discord, Slack, WhatsApp, Signal, Email | Telegram, WhatsApp, Discord, Slack, plus a Teams package |
| Clients | CLI and TUI, desktop, web, gateways | web dashboard, CLI TUI, Electron desktop, gateways |
| Automations | cron per bot, listed with `hermes cron list` | cron per automation, run state in four tables, resumable steps |
| Extensibility | plugins, MCP, Python tool scripts over RPC | `nakama.plugin.json` with actions, a UI module, SQL migrations, and per-org workers; MCP; Composio for 1,000+ apps |
| Sandbox | local, Docker, SSH, Modal, Daytona, Vercel Sandbox, Singularity | none per session, whatever container you launched |
| Cost | MIT free with your own keys, or Nous Portal at $0, $20, $100, $200 a month | MIT free, or Nakama Cloud with no published price |
| Best fit | one person with one persistent agent | a team behind a login |
| Maturity | fifteen months of releases, large plugin and skills catalog, large backlog | five months, small, moving fast |

Hermes figures come from the GitHub API and the [profiles doc](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) on 2026-10-29; portal tiers are from [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md), which cites the same pages a day earlier. Nakama figures come from its [package.json](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/package.json), [README](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/README.md), and [ARCHITECTURE.md](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/ARCHITECTURE.md) at commit `956b875`, plus source reads recorded below.

## The one thing that separates them

Hermes models one human. Its profiles doc defines a profile as "a separate Hermes home directory" and then warns: "Never point two agent processes at the same profile (the same Hermes home). Both write memory automatically, and each loads the other's writes into its system prompt at session start" ([profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)). Profiles multiply agents for one owner. They do not partition users.

The gap has a concrete form in issue #27182, open since 2026-05-17. `MemoryStore.USER.md` is "a single global file at `<HERMES_HOME>/memories/USER.md`", injected into every conversation "regardless of which platform user (Slack, Discord, etc.) is messaging the agent". The reporter runs a Slack bot for a seven-person sales team and names the symptom: one user's "always round dollar amounts to thousands" and another's "show exact amounts down to the cent" both land in one file and then apply to both people. A patch exists in #27183 and was still unmerged at the 2026-07-28 triage ([#27182](https://github.com/NousResearch/hermes-agent/issues/27182)).

Nakama puts the org at the boundary from the first table. `ARCHITECTURE.md` states it in its second sentence: "The org is the isolation boundary. Profiles, sessions, tools, MCP, skills, automations, attachments, and usage are org-scoped unless they are platform-level" ([ARCHITECTURE.md](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/ARCHITECTURE.md)). Requests carry `X-Org-Id`, org middleware resolves membership, and a user in more than one org who sends no header gets a 400 rather than a guess.

That is a difference of foundation, not a feature bolted on later. It is also why the risk sits where it does, in the section on gotchas.

## How a turn runs in Nakama

```text
POST /v1/sessions/:id/messages [1]
├── Hono app [1a] ← static assets, then auth and CSRF
├── org middleware [1b]
│   ├── resolve the org from X-Org-Id, plugin UI path, or session [1b1]
│   ├── if membership is missing: reject [1b2]
│   └── if memberships are several and no header: 400 [1b3]
├── AgentService assembles the runtime [1c]
│   ├── profile, soul, provider, model [1c1]
│   ├── tools: builtin, custom JS, custom Python, MCP, Composio, plugin [1c2]
│   ├── org MEMORY.md from ~/.nakama/orgs/{orgId} [1c3]
│   └── attachments and the knowledge catalog [1c4]
├── AgentChatSession.run() [1d] ← live history in memory
│   └── tool loop, up to 100 rounds [1d1]
│       ├── if the estimate exceeds the budget: compact [1d1a]
│       │   ├── prune older tool output to a marker [1d1a1]
│       │   └── summarize the head, keep the last 2 user turns [1d1a2]
│       ├── call the provider [1d1b]
│       ├── if every tool call is parallelSafe: run in parallel [1d1c]
│       └── otherwise: run sequentially [1d1d]
└── wrapPersistedSession [1e]
    ├── write history on the user message and at turn end [1e1]
    └── on compaction, archive originals as jsonl [1e2]
```

| Marker | Context |
|---|---|
| [1b] | [`org-middleware.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/apps/server/src/http/org-middleware.ts) line 82. |
| [1d] | [`chat.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/agent/src/chat.ts) line 214. History, `discoveredTools`, `historyRevision`, and `lastContextUsage` all live in memory. |
| [1d1] | [`chat.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/agent/src/chat.ts) line 78 caps a turn at 100 rounds and 200,000 produced output tokens. |
| [1d1a] | [`history-compaction.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/agent/src/history-compaction.ts) line 13 sets the trigger at `contextWindow - min(20k, maxOutputTokens)`; line 192 runs it before the provider call. |
| [1d1a1] | Line 276 replaces older tool output above a 10% floor once past 50% of usable context. |
| [1d1a2] | Lines 23 and 254 keep the prior summary plus the last two user turns. |
| [1d1c] | [`tool-loop.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/agent/src/tool-loop.ts) line 23 runs calls together only when every target is `parallelSafe`. |
| [1e] | [`session-persistence.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/apps/server/src/services/session-persistence.ts) line 276. |
| [1e2] | Line 35 writes originals to `orgs/{org}/session-history/{session}.jsonl`. |

The shape of that tree is the whole architectural difference. Nakama's loop is a server service with a database under it, and every step is reachable over HTTP with an org header. Hermes's equivalent runs inside a process whose state is a directory under `~/.hermes`, which is why it can offer six backends and cannot offer a login.

## Where Hermes is ahead

- Fifteen months of plugins, skills, memory providers, and third-party integrations, against five months of Nakama.
- Model breadth, with any provider per bot and 300+ through Nous Portal, against 31 provider types with no cross-provider fallback.
- Six execution backends, including Modal and Daytona with serverless hibernation, against "the container you launched".
- Self-created and self-improving skills, with FTS5 session search for recall across sessions.
- Delegation as a first-class tool, including kanban routing by profile description.
- Android, native Windows, and a signed installer path that Nakama does not have.

## Where Nakama is ahead

- Several humans on one instance, with invitations, roles, passkeys, TOTP, audit events, and member management.
- A shared skill library: skills carry versions, get assigned through `profile_skills`, and can be published across orgs through `org_shared_resources`.
- A curator that archives skills idle past 30 or 90 days, skips bundled skills and profiles with live automations, then merges near-duplicates.
- Compaction with receipts: automatic, also forced through `POST /v1/sessions/:id/compact`, with originals archived to jsonl and a revision check that aborts a concurrent write.
- Automations whose run steps are rows, so an interrupted run resumes instead of restarting.
- A plugin contract that lets a bundled plugin ship a UI module and its own per-org worker, not just a tool.
- One container at 200 MB with no Python toolchain on the host.

## Gotchas

The name collides. Search "nakama" and the first pages are Heroic Labs' game server. Every link in this file points at ahmadrosid's repo.

Tenancy is row-level. One SQLite file per install, never one per org ([`config.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/packages/core/src/config.ts) line 57). Tenant tables carry `org_id` and bind it as a query parameter. But the adapter's `listSessions` has no org predicate, and the org check for a session read sits in the service layer ([`agent-service.ts`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/apps/server/src/services/agent-service.ts) line 3125). The invariant "the org is the isolation boundary" is real in the design and must be kept by hand in the code. Test it before you put two customers on one instance.

Nakama says the same thing about itself. [`THREAT_MODEL.md`](https://github.com/ahmadrosid/nakama/blob/956b8756d4e62bf6617685b35a8099f54c1a5769/THREAT_MODEL.md) calls itself "a review framework, not a certification or a claim that every residual risk is closed", and it puts DPA and subprocessor commitments out of scope, pointing at open issue #1118.

Anything you add runs outside Nakama's control flow. The same threat model excludes "arbitrary code run through host `bash`, custom tools, stdio MCP, plugins, or coding agents after it leaves Nakama's own control flow". Custom JS and Python tools are code you then have to secure yourself.

Hermes's 51,825 open issues are not 51,825 defects. The tracker carries machine-generated triage volume, including comments marked "generated by AI during triage". Read it as "the tracker is not a signal", not as a quality score.

Nakama is pre-1.0 and thin on evidence. 0.4.61, five months old, 721 stars, 121 forks, and a TinyFish search on 2026-10-29 found no third-party review or comparison. The managed cloud has no readable price page (the site returned empty content to a fetch).

Windows is half-there on Nakama. The README ships macOS downloads and says unsigned MSIX files in older releases are Partner Center uploads, "not installable downloads".

## Decision guide

- One person who wants a persistent agent with the widest tooling: Hermes, unchanged from [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md).
- A team that needs a login, separate data per team, and a shared skill library: Nakama, after writing the cross-org test the scout could not find.
- A team that needs it working this quarter: one Hermes profile per person, separate homes, and accept that everyone shares one operator's credentials and one process tree.
- Nakama as the backend for a customer-facing product, which its docs list as a first use case: not yet. Row-level tenancy in a pre-1.0 single SQLite file is not a tenancy story to sell.

## What would change this verdict

A per-org database or schema in Nakama, plus a test proving a foreign org ID cannot read a session, would make its isolation claim structural instead of procedural. A published cloud price and a second maintainer would make it safe to bet a team on.

On the Hermes side, merging #27182 makes per-user preferences possible while leaving the deeper problem: one process tree, one credential set, no roles. A documented multi-tenant deployment would change the answer, and no such page exists today.

## Changelog

- 2026-10-29: created from Nakama's README, docs site, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `package.json`, and a source read at `956b875`, plus Hermes's README, profiles doc, issue #27182, and the GitHub API for both repos.
- 2026-11-02: linked [Nakama — How Much Is Actually Open Source](./nakama-open-source-scope.md); no claim here changed.
