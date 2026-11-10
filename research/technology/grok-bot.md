---
title: Grok Bot — What It Is, and How a Bot Works
category: technology
tags: [grok-bot, xai, ai-agents, computer-use, persistent-agents, cursor, memory, routines]
status: complete
created: 2026-10-29
updated: 2026-11-06
sources:
  - https://docs.x.ai/grok-bot/overview.md
  - https://docs.x.ai/grok-bot/bots.md
  - https://docs.x.ai/grok-bot/faq.md
  - https://docs.x.ai/grok-bot/security.md
  - https://x.ai/news/introducing-grok-bot
  - https://x.ai/news/designing-grok-bot
  - https://x.ai/bot
  - https://x.ai/bot/guides/grok-bot-101
  - https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333
  - https://cursor.com/docs/grok-bot/deployment
  - https://docs.x.ai/grok-bot/get-started.md
  - https://docs.x.ai/grok-bot/computer-and-apps.md
  - https://forum.cursor.com/t/local-computer-use-for-grok-bots/174043
  - https://www.spotdev.co.uk/blog/grok-bot-vs-cursor-cloud-agents
  - https://x.ai/news/grok-bot-more-plans
  - https://dev.classmethod.jp/articles/shuntaka-agent-cloud-vm-survey/
  - https://x.com/LundukeJournal/status/2090929777456922849
  - https://x.com/xdNiBoR/status/2087241709574820188
confidence: high
---

## Summary

**Grok Bot is xAI's product for persistent AI teammates, each called a Bot.** A Bot is "a durable AI teammate with a name, a job, its own conversation, and working context that develops over time" ([docs](https://docs.x.ai/grok-bot/bots.md)). You message it like a colleague; it does multi-step work inside your real apps and websites, comes back for approval, and keeps working while your laptop is closed.

Two things make it a distinct product shape rather than a chat wrapper:

1. **Each Bot has a computer** — a persistent cloud desktop with browser, filesystem, terminal, and app logins ([overview](https://docs.x.ai/grok-bot/overview.md)).
2. **All Bots on one account share that single computer**, so handoffs need no repeated setup. Isolation is between *users*, not between Bots ([overview](https://docs.x.ai/grok-bot/overview.md)).

The object you return to is the Bot, not a conversation. That is a deliberate primitive choice, and it has its own consequences — see [The Bot as a Primitive](./bot-primitive.md).

Grok Bot is **not** Grok Build (the coding agent with plugins, hooks, and marketplaces) and **not** the Grok API (model access). All three share the "Grok" name and have separate extension surfaces ([Grok Bot Extensibility](./grok-bot-extensibility.md)).

## Context

Asked on 2026-10-29, plainly: "what is Grok Bot?" Answered from xAI's own documentation and launch/design posts, plus the Cursor forum thread where the product's limits are acknowledged by staff. The question came with a second half — "what is bot primitive?" — which is its own file: [The Bot as a Primitive](./bot-primitive.md).

## What it is

Grok Bot launched **2026-08-11 in beta**: "AI teammates you can give real work to… They sign into the tools you already use and work across apps, inboxes, and more" ([launch](https://x.ai/news/introducing-grok-bot)). It started as an internal prototype used for sales outbound, marketing campaigns, office operations, and bug fixes before opening up ([launch](https://x.ai/news/introducing-grok-bot)).

The positioning that survives in the docs is narrower and more concrete: "Grok Bot gives you Bots you can keep around: AI teammates with names, jobs, and context that compounds over time" ([overview](https://docs.x.ai/grok-bot/overview.md)). A DevRel guide puts it in one line: "Grok Bot is an agent with a computer… a real, persistent desktop. It can do what you can: use apps, browse the web, write and run code" ([Grok Bot 101](https://x.ai/bot/guides/grok-bot-101)).

### A Bot's anatomy

| Part | What it is concretely | Source |
|---|---|---|
| Identity | Name, picture, label, sidebar section; the avatar also carries state — idle, thinking, working, waiting, blocked, done | [bots](https://docs.x.ai/grok-bot/bots.md), [design](https://x.ai/news/designing-grok-bot) |
| Job | An operational role described in chat, with sources, working style, and approval boundary; "Talent Scout" or "Expense Manager" beats "General Helper" | [bots](https://docs.x.ai/grok-bot/bots.md) |
| Memory | Stable preferences, rules it must keep, facts about you, a dated log of prior work; saved by the Bot's own judgment, not on request | [bots](https://docs.x.ai/grok-bot/bots.md) |
| Computer | Persistent cloud desktop: browser, filesystem, terminal, installed apps; shared by every Bot on the account | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Tools | Connectors where one exists, computer use for everything else; tools and skills are account-level, memory and routines are Bot-level | [overview](https://docs.x.ai/grok-bot/overview.md), [design](https://x.ai/news/designing-grok-bot) |
| Chat | Per-Bot transcript, typed, dictated, or voice; reachable from desktop and phone | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Routines | A skill bound to a Bot plus a schedule or event trigger — work that starts without a prompt | [design](https://x.ai/news/designing-grok-bot) |

A **primary Bot** is the main point of contact: it checks in on its own and coordinates the other Bots ([bots](https://docs.x.ai/grok-bot/bots.md)). Shared templates copy a Bot's identity, description, skills, and routines to a new account but never the computer, logins, or history ([bots](https://docs.x.ai/grok-bot/bots.md)).

### The shared computer is the unusual decision

"This computer belongs to your account, not to an individual Bot, so treat anything placed on it as available to every Bot you run; between users, isolation is strict" ([overview](https://docs.x.ai/grok-bot/overview.md)). The earlier extensibility pass recorded the sharper phrasing: "The screens are separate work surfaces, not separate security boundaries" ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md)).

Three consequences follow, and they are the ones that surprise people:

- **Handoffs are cheap.** Shared files, browser sessions, and logins mean a second Bot picks up mid-task without a setup replay ([overview](https://docs.x.ai/grok-bot/overview.md)).
- **Deleting a Bot does not clean the machine.** "Files and sign-ins on the shared computer aren't isolated per Bot and can remain there; clean them up separately" ([bots](https://docs.x.ai/grok-bot/bots.md)).
- **Parallelism is per screen.** Bots run concurrently, but "one Bot runs one computer-use task on its screen at a time" ([FAQ](https://docs.x.ai/grok-bot/faq.md)).

The desktop app can also act on your own machine — run commands, read files, move files between the cloud computer and local ([security](https://docs.x.ai/grok-bot/security.md)).

### Access, platforms, and cost

| Aspect | Detail | Source |
|---|---|---|
| Bundled access | Included with every paid individual Cursor plan and the Cursor Teams plan | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Alternative access | Link an individual SuperGrok, SuperGrok Plus, or SuperGrok Heavy subscription | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Metering | Its own usage pool, separate from Grok and Cursor plans; resets weekly | [launch](https://x.ai/news/introducing-grok-bot), [overview](https://docs.x.ai/grok-bot/overview.md) |
| Billing matrix | cursor.com/help/grok-bot/plans | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Desktop | macOS (Apple silicon and Intel), Windows (x64 and Arm64), Linux (x64 and Arm64) | [FAQ](https://docs.x.ai/grok-bot/faq.md) |
| Mobile | iPhone, iPad, Android | [FAQ](https://docs.x.ai/grok-bot/faq.md) |
| Hosting | Bots' computers run in Cursor's cloud | [FAQ](https://docs.x.ai/grok-bot/faq.md) |
| Hosted computer OS | **Linux**, maintained by Cursor; no image to pin or supply | [deployment](https://cursor.com/docs/grok-bot/deployment) |
| Desktop installers | macOS `.dmg`, Windows `.exe`, Linux `.deb` / `.rpm` / AppImage | [deployment](https://cursor.com/docs/grok-bot/deployment), [get started](https://docs.x.ai/grok-bot/get-started.md) |

At launch the beta shipped on desktop and iOS only, for SuperGrok tiers and Cursor Pro/Pro+/Ultra and Teams Standard/Premium ([launch](https://x.ai/news/introducing-grok-bot)); the docs have since added Windows, Linux, and Android.

**Brand note.** The docs at docs.x.ai render with the title "SpaceXSI Docs", describe computers running in "Cursor's cloud", and send billing to cursor.com — while the launch post sells it through SuperGrok tiers. The xAI–SpaceXSI–Cursor corporate arrangement behind that co-branding is [unverified]; the observable fact is two brands on one product. This is also why the earlier Grok Bot research records OAuth tokens "held on Cursor's connector backend" ([extensibility](./grok-bot-extensibility.md)).

### The split nobody should misread: your OS is not the Bot's OS

Two different questions, answered differently, and the answers are the tell.

**Your machine — every OS.** The client ships as a real native build for macOS (Apple silicon and Intel), Windows (x64 and Arm64), and Linux (x64 and Arm64; `.deb`, `.rpm`, AppImage). The deployment doc names each architecture and installer, and Cursor publishes per-platform release feeds (`darwin-arm64`, `win32-x64-user`, `linux-x64`, …) for scripted packaging ([deployment](https://cursor.com/docs/grok-bot/deployment), [get started](https://docs.x.ai/grok-bot/get-started.md)). At launch only macOS shipped — the launch page's button read "Download for macOS" ([launch](https://x.ai/news/grok-bot-more-plans)) — so Windows and Linux both arrived later, and the docs now list all three.

**The Bot's machine — Linux only, and an OS you cannot see from the client.** "The hosted computer runs Linux in Cursor's cloud and isn't enrolled in MDM" ([deployment](https://cursor.com/docs/grok-bot/deployment)). Cursor maintains the image and moves idle computers onto newer ones in the background, so there is nothing to pin ([deployment](https://cursor.com/docs/grok-bot/deployment)). There is no Windows or macOS option and no bring-your-own image ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md), [spotdev](https://www.spotdev.co.uk/blog/grok-bot-vs-cursor-cloud-agents)); the docs never offer a choice of hosted OS. The silent part is worse: a Bot's terminal reports user UID 1000 on the shell, but the account is shared with every Bot.

**Why the distinction bites.** A Bot's whole job is to click through software, and the software on its screen is Linux software. Windows and macOS apps are not there. The feature request says it plainly: one user drives Codex CLI from their Bot as a middle-man to reach "Windows-only 'Lutron Designer' software" and would rather drop the middle-man; another notes many apps "have no web installer, no Linux package, and sometimes no website at all" ([forum](https://forum.cursor.com/t/local-computer-use-for-grok-bots/174043)).

The escape hatch is your own machine: the Bot runs commands on your local computer when the capability is on and you approve it per command, default **Ask every time** ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md)). So a Windows desktop can host the client and hand over local steps — but the Bot's own computer stays Linux, and local use is a relay through an app that has to be open, not a Windows VM. What that Linux is, and what it looks like, is measured below.

### The distro and desktop, measured

Neither fact is in the docs; both were measured by users on the live machine.

| Fact | Value | Source |
|---|---|---|
| Distribution | `Debian GNU/Linux 13 (trixie)`, kernel `6.12.94+`, x86_64 | [classmethod survey](https://dev.classmethod.jp/articles/shuntaka-agent-cloud-vm-survey/) |
| Desktop environment | Slim XFCE, with Thunar as the file manager and a terminal on the desktop | [Lunduke](https://x.com/LundukeJournal/status/2090929777456922849), [Robin](https://x.com/xdNiBoR/status/2087241709574820188) |
| Browser | Google Chrome 156.0.8078.47 (not Chromium) | [classmethod survey](https://dev.classmethod.jp/articles/shuntaka-agent-cloud-vm-survey/) |
| Hardware | 8 vCPU Intel Xeon, ~15.6 GiB RAM, ~127 GiB storage, no GPU | [classmethod survey](https://dev.classmethod.jp/articles/shuntaka-agent-cloud-vm-survey/) |

Debian is the conservative pick for this job, and the desktop is the giveaway: XFCE, Thunar, Chrome, a bare terminal, nothing themed or branded. A thin desktop is what you want for an agent that must click through a browser unattended, because every other process competes for the memory the browser needs — the same survey found only ~3.2 GiB of the 15.6 GiB actually available on a running machine, with ~12.4 GiB already consumed. Nobody ships XFCE on Debian to win a screenshot contest; it is the cheapest reliable click target.

Two caveats on the sourcing. The launch-day measurement pairs `16 GB RAM / 128 GB` with Debian and Thunar ([Robin](https://x.com/xdNiBoR/status/2087241709574820188)), and the later survey reproduces the same shape from the inside at `~15.63 GiB` and `~127.39 GiB`, which is the same numbers before marketing rounding. Distro and desktop are also Cursor's to change: the image is maintained server-side with no pin available, so a future rebuild can move the base without a release note.

### Limits worth knowing

| Limit | Value | Source |
|---|---|---|
| Bots per account | ~50 | [design](https://x.ai/news/designing-grok-bot) |
| Bots per group chat | 6 | [design](https://x.ai/news/designing-grok-bot) |
| Computer-use tasks per Bot | 1 at a time, one screen each | [FAQ](https://docs.x.ai/grok-bot/faq.md) |
| Computers per account | 1, shared | [overview](https://docs.x.ai/grok-bot/overview.md) |
| Routines per Bot | 50, at least 5 minutes apart, 20 run records | [extensibility](./grok-bot-extensibility.md) |
| Context controls | No compact, no new-session-on-same-Bot; only "reset conversation" or duplicate | [forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333) |
| Site automation | A site can still block automation or demand a human step; the Bot hands those back | [FAQ](https://docs.x.ai/grok-bot/faq.md) |
| Hosted computer OS | Debian GNU/Linux 13 (trixie), measured; Linux only, no Windows or macOS image, no bring-your-own | [survey](https://dev.classmethod.jp/articles/shuntaka-agent-cloud-vm-survey/), [deployment](https://cursor.com/docs/grok-bot/deployment) |
| Hosted desktop session | Slim XFCE with Thunar, a terminal, and Chrome; one screen per Bot | [Lunduke](https://x.com/LundukeJournal/status/2090929777456922849), [Robin](https://x.com/xdNiBoR/status/2087241709574820188) |

## What Grok Bot is not

- **Not a workflow builder.** "Setup is a message, not a workflow builder" — you create the Bot, describe the job, and grant access as it asks ([overview](https://docs.x.ai/grok-bot/overview.md)).
- **Not Grok Build.** Grok Build is the coding agent with .grok/plugins, hooks, marketplaces, and subagents; Grok Bot has none of those extension points ([extensibility](./grok-bot-extensibility.md)).
- **Not per-Bot isolated.** Extension state and the computer are account-wide; a Bot is not a sandbox ([overview](https://docs.x.ai/grok-bot/overview.md)).
- **Not a source of truth for memory.** "Memory is not a substitute for an authoritative source" — keep changing facts in the system that owns them ([bots](https://docs.x.ai/grok-bot/bots.md)).

## Why it is shaped this way

xAI's own design writeup is explicit that the shape is a reaction to chat-first interfaces: most AI products organize around a session the user operates, while Grok Bot organizes around objects that persist. "So the main objects in Grok Bot are Bots, not conversations" ([design](https://x.ai/news/designing-grok-bot)).

That choice is a **primitive** choice, and it is analyzed on its own: [The Bot as a Primitive](./bot-primitive.md).

## Open Questions

- Whether the xAI / SpaceXSI / Cursor bundling settles into one account or stays two brands on one product.
- Whether Bots ever get per-Bot computers; every doc page currently says account-wide.
- Whether explicit compact and new-session controls ship, given the forum acknowledgment of the gap ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).
- Whether template sharing gains review, versioning, or monetisation; only public/team link scoping is documented ([extensibility](./grok-bot-extensibility.md)).

## Related
- [Why Grok Bot Is Popular — The User-Review Evidence](../product/grok-bot-popularity-user-reviews.md) — what its users actually praise (setup in minutes, a messaging surface, its own always-on computer) and punish (writing, memory, quota), and who it delights against who it bounces.
- [Grok Bot, OpenMausBot, and OpenBot — Three Answers to the Same Primitive](./grok-bot-openmausbot-openbot-compared.md) — the three-way comparison: shared account computer vs your machine and engine choice vs a per-bot container behind a CEL gateway.

- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — the concept behind Grok Bot's product shape, generalised.
- [Grok Bot Extensibility — Apps, Skills, Routines, and MCP Connectors](./grok-bot-extensibility.md) — how you extend it, and the three Grok surfaces that share the name.
- [Open-Source Grok Bot Alternatives with First-Class Sandbox VMs](./open-source-grok-bot-alternatives.md) — which projects rebuild this product shape and where each stops short.
- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — the machinery Grok Bot lacks when its Bot transcript grows.
- [Hermes Agent vs Grok Bot — Does Hermes Already Do the Bot Primitive?](./hermes-agent-vs-grok-bot.md) — the open-source harness that already ships this shape, and the one default that actually distinguishes Grok Bot.
- [Grok Bot Memory — What Survives a Single Long-Lived Chat](./grok-bot-memory.md) — how memory, reset, and auto-summarization actually relate when a Bot has one conversation.
- [Claude Duet vs Grok Bot — One Assistant or a Roster?](./claude-duet-vs-grok-bot.md) — Anthropic's proactive agent as the counter-example: same capability, no bot object at all.

## Changelog

- 2026-10-29 — created. All sources via TinyFish (mcp__tinyfish__search, mcp__tinyfish__fetch_content); no fallback tooling used.
- 2026-10-29 — split from the "bot primitive" question, which now has its own file.
- 2026-11-06 — added the measured distro and desktop (Debian 13 trixie, slim XFCE, Chrome, 8 vCPU / ~15.6 GiB / ~127 GiB / no GPU) after the follow-up asking for distro and DE; sourced to a shell survey run inside the VM and two users' screenshots, since neither fact is in the docs.
- 2026-11-06 — added the client-OS vs hosted-OS split on the prompt "does grok bot use windows or Linux": all three desktop OSes are supported for the client, the hosted computer is Linux only, and the Windows/macOS-software gap is recorded with the feature request that documents it.
