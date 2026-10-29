---
title: Hermes Agent vs Grok Bot — Does Hermes Already Do the Bot Primitive?
category: technology
tags: [hermes-agent, grok-bot, nous-research, ai-agents, bot-primitive, comparison, self-hosted, bot-roster]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/nousresearch/hermes-agent
  - https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode
  - https://hermes-agent.nousresearch.com/docs/user-guide/profiles
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
  - https://hermes-agent.nousresearch.com/docs/user-guide/configuration
  - https://hermes-agent.nousresearch.com/docs/user-guide/security
  - https://hermes-agent.nousresearch.com/docs/user-guide/desktop
  - https://docs.x.ai/grok-bot/overview.md
  - https://docs.x.ai/grok-bot/faq.md
  - https://x.ai/news/designing-grok-bot
  - https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333
confidence: high
---

## Summary

**Yes — Hermes Agent does all of it, and on the axes where Grok Bot is weakest it does more.** Hermes (Nous Research, MIT, 258.4k GitHub stars at 2026-10-29) has named persistent bots with avatars and a roster, per-bot memory and skills, per-bot routines beside the chat, bot-to-bot messages, group chats of 2–6 bots, a persistent computer per profile, subagent delegation, and approval gates ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode), [README](https://github.com/nousresearch/hermes-agent)).

So the honest form of "why is Grok Bot special" is narrower than the product design post implies. The *primitive* is not special — a durable named agent with its own runtime is implementable by anyone, and Hermes shipped it first and keeps it open. What Grok Bot still holds is **packaging and defaults**: a hosted computer you never install, an account-wide sharing model that makes handoff setup-free, native mobile clients, enterprise rails, and a subscription that hides the keys.

In one place Hermes is unambiguously better on the thing this repo already criticised Grok Bot for: **explicit compaction.** Grok Bot has no compact, no new-session-on-the-same-Bot, and reloads the whole transcript every turn ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)). Hermes reroutes `/new` inside a Bot chat to `/compact` on purpose — "fresh working context, same conversation" — and gives every group member a Compress history button ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).

## Context

Asked on 2026-10-29 as a challenge to the [Grok Bot](./grok-bot.md) writeup: "why so special, hermes can do that right?" The reference is Hermes Agent, the open-source harness by Nous Research — not the Hermes model family, and not a Slack bot. Most of Hermes' capability surface is documented first-party, so this file compares the two products on the axis that actually differs rather than on feature-count.

## Axis by axis

| Dimension | Grok Bot | Hermes Agent |
|---|---|---|
| Shape | Hosted product, closed source | Self-hosted harness, MIT, installable with one command |
| Unit of identity | A Bot (name, avatar, job, memory) | A profile; a Bot Mode bot is that profile plus roster metadata |
| Roster surface | Sidebar of Bots with avatars and state | Bots tab with avatars, sections, unread, activity filter |
| Memory | Per-Bot memory, a few facts shared across Bots | Per-profile MEMORY.md (2,200 chars) and USER.md (1,375 chars), agent-curated, plus session search |
| Skills | Saved from a demonstrated workflow; shareable library | Self-created from experience, self-improving, Skills Hub, agentskills.io standard |
| Computer | Always a cloud desktop per account, shared by every Bot | Backend you choose: local, Docker, SSH, Modal, Daytona, Vercel Sandbox, plus plugins |
| Isolation default | Between users, never between Bots | Between profiles for state; execution isolation only if you pick a container backend |
| Shared runtime | The default, and not configurable | The Docker default (one long-lived container, shared across sessions and subagents), switchable to one container per session |
| Delegation | Bot-to-bot handoff, primary Bot coordinating a roster | delegate_task subagents with their own conversation, plus bots messaging each other |
| Group chats | Up to 6 Bots per group | 2–6 Bots per room, with a shared room log and per-member history compress |
| Routines | Schedule or event bound to a skill; 50 per Bot, ≥5 min apart | Cron bound to a bot, namespaced and visible in hermes cron list |
| Context controls | None: no compact, no new session on the same Bot | /compress, /compact, /new rerouted to compact inside a Bot chat, per-member compress |
| Model choice | None documented; a reported single expensive model | Any provider per Bot, pinned at creation, min 300+ via Nous Portal |
| Surfaces | macOS, Windows, Linux, iOS, Android | CLI/TUI, native desktop (macOS, Windows, Linux), webapp, Telegram, Discord, Slack, WhatsApp, Signal, Email |
| Access | Bundled with paid Cursor plans or SuperGrok tiers; weekly usage pool | Free MIT; bring your own keys, or Nous Portal at $0/$20/$100/$200 per month |
| Enterprise | Cursor Teams/Enterprise admin, network policy, private networks | Self-hosted: you are the operator, with eight documented security layers |
| Setup cost | Download, sign in, name a Bot | Install script, then hermes setup; keys or Portal OAuth |

Sources: Grok Bot — [overview](https://docs.x.ai/grok-bot/overview.md), [FAQ](https://docs.x.ai/grok-bot/faq.md), [design](https://x.ai/news/designing-grok-bot), [forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333). Hermes — [Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode), [profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles), [memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration), [security](https://hermes-agent.nousresearch.com/docs/user-guide/security), [desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop).

## Where Hermes is genuinely ahead

- **Compaction.** The one control Grok Bot's users are still asking for is a first-class Hermes feature, and the design rationale is explicit: a Bot's canonical chat reroutes `/new` to `/compact` because forking "the relationship into a scratch session" is "the one thing Bot Mode promises never happens" ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
- **Model choice.** Any provider/model pair per Bot, pinned at creation, with the option to inherit; different Bots run on different models side by side ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)). Grok Bot documents no model picker, and users report exactly one model with no alternative ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).
- **Isolation as a setting.** Per-session containers, per-profile homes, and a `docker_shared_container_key` for profiles that should share one identity ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)). Grok Bot fixes the sharing model at "one computer per account" ([overview](https://docs.x.ai/grok-bot/overview.md)).
- **Fleet across machines.** The desktop can register several gateways and present a union roster, so one window drives a bot on a NAS and another on a VPS ([multi-connection](https://hermes-agent.nousresearch.com/docs/user-guide/multi-connection-desktop)). Grok Bot is one cloud account, one computer.
- **Ownership and exit.** MIT license, skills as files you can put in git, importers for OpenClaw, Claude Code, Codex, and Cursor settings, memories, and skills ([README](https://github.com/nousresearch/hermes-agent)). Grok Bot exports a Bot template — identity, description, skills, routines — and nothing else ([bots](https://docs.x.ai/grok-bot/bots.md)).
- **Cost transparency.** The model spend is your provider bill; the harness is free. Grok Bot meters a usage pool that resets weekly, inside a bundle ([overview](https://docs.x.ai/grok-bot/overview.md)).

## Where Grok Bot is genuinely ahead

- **Zero setup.** No install script, no Python environment, no provider keys, no container runtime. You download an app, sign in, and name a Bot ([overview](https://docs.x.ai/grok-bot/overview.md)). Hermes asks you to pick a backend, a provider, and a sandbox before the first useful turn ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)).
- **A computer that is the product, not a config.** Grok Bot's computer is always a cloud desktop with browser, filesystem, terminal, logins, and a preview/takeover UI ([overview](https://docs.x.ai/grok-bot/overview.md), [design](https://x.ai/news/designing-grok-bot)). On Hermes' default local backend, "the agent has the same filesystem access as your user account" — the computer is your laptop unless you change the backend ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)).
- **Handoff without setup, by default.** Because every Bot shares one machine, a second Bot inherits files, sessions, and logins for free ([overview](https://docs.x.ai/grok-bot/overview.md)). Hermes can express this — one long-lived shared container, or a shared container key across trusted profiles — but it is a deliberate configuration, not the out-of-box behaviour ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)).
- **Native mobile apps.** iOS and Android clients as first-class surfaces ([FAQ](https://docs.x.ai/grok-bot/faq.md)). Hermes reaches your phone through messaging platforms and a gateway-served webapp, not native apps ([desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)).
- **Enterprise rails.** Admin controls, network policy, private networks, and an approval/Auto Review model aimed at deploying other people's agents ([teams](https://docs.x.ai/grok-bot/teams-and-enterprises)). Hermes' equivalent is a self-hosted security posture you operate yourself ([security](https://hermes-agent.nousresearch.com/docs/user-guide/security)).

## The one design difference that is real: share or isolate the computer

The two products are not far apart on features; they are opposite on one default.

| Question | Grok Bot's answer | Hermes' answer |
|---|---|---|
| Is the computer shared across agents? | Always — one per account, files, sessions, and logins included | One long-lived container by default, shared across sessions and subagents; per-session if you set container_persistent: false |
| Is a Bot a security boundary? | No — "separate work surfaces, not separate security boundaries" | Only if you choose a container backend; the local backend is your account's filesystem |
| What carries a handoff? | The shared machine itself | Shared files, a shared container key, or delegation with its own conversation |
| What is isolated by design? | Users from each other | Profile state: config, memory, skills, credentials, cron |

Sources: [overview](https://docs.x.ai/grok-bot/overview.md) and [computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md) for Grok Bot; [profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles) and [configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) for Hermes.

Grok Bot made one bet: **friction beats isolation** for a team of coworkers. Hermes made the other: **state isolation beats convenience** by default, with the shared-container mode one config key away. Neither is a capability the other lacks — they are priority orderings of the same trade, and the operator decides which one they can live with.

## Convergence worth noting

Independent designs landed on the same numbers and the same object graph, which is the strongest evidence that the shape is not proprietary:

- **Six per group chat.** Grok Bot caps group chats at six Bots ([design](https://x.ai/news/designing-grok-bot)); Hermes' room editor enforces "still 2–6 Bots" ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
- **One canonical chat per bot.** Grok Bot gives each Bot its own conversation and memory ([bots](https://docs.x.ai/grok-bot/bots.md)); Hermes pins a "canonical, persistent Bot Chat" created the moment the Bot is born ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
- **Routines beside the chat.** Grok Bot moved routines into the Bot's main interface as they became load-bearing ([design](https://x.ai/news/designing-grok-bot)); Hermes docks a Routines pane next to the Bot chat and namespaces each job as [bot:name] ([Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
- **Skills from demonstration.** Both turn a demonstrated workflow into a reusable skill: Grok Bot by recording, Hermes by an autonomous learning loop after complex tasks ([skills](https://docs.x.ai/grok-bot/skills-routines-and-automations), [README](https://github.com/nousresearch/hermes-agent)).
- **The same layering.** Capability at the account level, context at the role level: Grok Bot states it as tools and skills account-wide versus memory and routines per Bot ([design](https://x.ai/news/designing-grok-bot)); Hermes stores per-profile state in ~/.hermes/profiles/<name>/ and keeps shared capability in plugins and the Portal ([profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)).

## What is left that is actually special

Three things, and none of them is the bot primitive:

1. **The hosted computer as an appliance.** A cloud desktop with a browser, a filesystem, app logins, and a takeover UI, provisioned for every user, with no container runtime to operate. Hermes matches the function only when you supply the backend and the machine ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)).
2. **The bundle.** Billing, identity, model access, and the computer arrive together through Cursor or SuperGrok accounts ([overview](https://docs.x.ai/grok-bot/overview.md)). That is a distribution advantage, not a technical one, and it is also the reason usage is metered.
3. **Enterprise deployment of someone else's agents.** Admin-gated connectors, network controls, and approval rules designed for a workforce that did not build the Bots ([teams](https://docs.x.ai/grok-bot/teams-and-enterprises)).

Inverting the question is the useful conclusion: Hermes proves the primitive is commodity — MIT-licensed, self-hostable, with better compaction and model choice. Grok Bot's defensible ground is the appliance and the bundle around it, which is why its weakness (one shared computer, no per-bot isolation, no compact) is a deliberate default rather than an oversight.

## Decision guide

- **Want persistent bots today, open source, with model choice and real compaction** → Hermes Agent, with the Docker backend and a profile per Bot.
- **Want zero setup and a hosted computer for a team that does not run infrastructure** → Grok Bot, accepting account-wide sharing and a metered usage pool.
- **Want per-Bot isolation on your own metal** → Hermes with container_persistent: false, or one profile per container ([configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)).
- **Want native mobile clients** → Grok Bot; Hermes reaches a phone through Telegram-style gateways or its served webapp.
- **Want the bot primitive only, to build your own product** → study both, then borrow the contract: [The Bot as a Primitive](./bot-primitive.md), and for self-built rosters see [Open-Source Grok Bot Alternatives](./open-source-grok-bot-alternatives.md).

## Open Questions

- Whether Grok Bot adds explicit compact or new-session controls; nothing in the docs commits to it ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).
- Whether Hermes' shared-container mode reaches parity with Grok Bot's single account-wide computer across *bots*, or stays a per-profile decision.
- Hermes' cron limits per profile are not documented on the pages read here [unverified]; Grok Bot's are explicit at 50 per Bot.
- Whether the token economics converge: Grok Bot meters a weekly pool, Hermes meters nothing itself but re-sends the transcript on every turn of a long chat, which its own memory docs call expensive ([memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)).

## Related

- [Grok Bot — What It Is, and How a Bot Works](./grok-bot.md) — the product side of this comparison in full.
- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — the concept both products implement, and the unbounded-thread failure Grok Bot still has and Hermes fixed.
- [Grok Bot Extensibility — Apps, Skills, Routines, and MCP Connectors](./grok-bot-extensibility.md) — Grok Bot's extension contracts, for contrast with Hermes plugins and skills.
- [Open-Source Grok Bot Alternatives with First-Class Sandbox VMs](./open-source-grok-bot-alternatives.md) — projects that rebuild the roster shape on your own VM.
- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — how other harnesses implement the working-set boundary Hermes exposes as /compact.
- [Grok Bot Memory — What Survives a Single Long-Lived Chat](./grok-bot-memory.md) — the memory side of the compaction gap compared here.

## Changelog

- 2026-10-29 — created in response to "why so special, hermes can do that right?". All Hermes and Grok Bot sources via TinyFish; verdict is that the primitive is commodity and the differentiators are packaging, defaults, and distribution.
