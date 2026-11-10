---
title: Claude Duet vs Grok Bot — One Assistant or a Roster?
category: technology
tags: [claude-duet, anthropic, grok-bot, ai-agents, proactive-agents, comparison, bot-primitive]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://support.claude.com/en/articles/17631495-get-started-with-claude-duet
  - https://claude.com/product/claude-duet
  - https://www.anthropic.com/news/claude-duet
  - https://www.datacamp.com/blog/claude-duet
  - https://docs.x.ai/grok-bot/overview.md
  - https://docs.x.ai/grok-bot/bots.md
  - https://docs.x.ai/grok-bot/faq.md
  - https://x.ai/news/designing-grok-bot
confidence: high
---

## Summary

**Same category, opposite primitive.** Claude Duet is Anthropic's proactive personal agent, launched 2026-10-21 as a research preview: a standalone app on iOS, Android, and the web that messages you first, works on its own computer in the cloud, and asks before it sends, pays, signs, or deletes ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)). In capability terms it is the closest thing to Grok Bot yet from Anthropic — and it is not a bot platform.

The organizing object is what differs. Grok Bot is a **roster**: many named Bots, each with its own memory, routines, and job, sharing one computer ([bots](https://docs.x.ai/grok-bot/bots.md)). Duet is **one assistant in one thread**, with optional topic channels that all share the same memory — "Your history is in one thread" ([product page](https://claude.com/product/claude-duet), [help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).

| Question | Grok Bot | Claude Duet |
|---|---|---|
| How many agents | Many Bots, ~50 per account | One assistant |
| Identity | Per-Bot name, avatar, role | A single persona with your Claude account's memory and skills |
| Separation | Per-Bot memory and routines; a few facts shared account-wide | Topic channels that all share one memory |
| Who starts work | You, a routine's schedule, an event, or another Bot | Duet does — morning brief, check-ins, follow-ups |
| Computer | One cloud desktop per account, shared by every Bot, with preview and takeover | Its own cloud computer and browser, with no user view or takeover |
| Model | Fixed | Fixed — Opus 5.5, no model choice |
| Approvals | Drafts by default, Auto Review rules | Asks before send, pay, sign, delete |
| Delegation | Bot-to-bot handoff and group chats | None; one assistant organizes the work |
| Files | Files on the shared machine | Artifacts in a Make tab; cannot read your computer's files |
| Surfaces | macOS, Windows, Linux, iOS, Android, X Chat | iOS, Android, claude.ai |
| Access | Paid Cursor plans or SuperGrok tiers | Pro and Max, US waitlist, no extra cost, shares plan limits |

Sources: Grok Bot — [overview](https://docs.x.ai/grok-bot/overview.md), [bots](https://docs.x.ai/grok-bot/bots.md), [FAQ](https://docs.x.ai/grok-bot/faq.md). Duet — [help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet), [product page](https://claude.com/product/claude-duet).

## Context

Asked 2026-10-29: "does Claude Duet are similar product?" — following the Grok Bot and Hermes comparisons. Duet is genuinely new (a week old at the time of writing), so this file records what Anthropic documents about it, then tests the same axis that separated Grok Bot from Hermes: what is the primitive, and who owns the context.

## What Duet actually is

Three first-party facts set it apart from both Claude chat and Claude Cowork:

- **It starts the conversation.** "The Claude app waits for you to open a chat, and you work on something alongside Claude. Claude Duet comes to you" ([product page](https://claude.com/product/claude-duet)). Each morning it reads email and calendar, picks what needs attention, and can draft the first steps ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **It inherits your account.** "The memory, skills, and connectors you've set up in Claude are there from your first message" — including search across past Duet chats and Claude chats outside projects ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **It runs on a cloud computer with a browser,** so work continues after the app closes, and sites without a connector are reached by driving the browser ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).

Work is organized into three surfaces: the main thread, a **Tasks** tab showing what is running and what needs you, and a **Make** tab holding finished artifacts — briefs, models, decks, dashboards ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)). Only you can mark a task complete; Duet can only suggest it.

## The primitive difference, in one table

| Dimension | Roster-of-bots (Grok Bot) | Single assistant (Claude Duet) |
|---|---|---|
| What you name | Each Bot | Nothing; there is one |
| Where memory divides | Per Bot | Nowhere — channels share one memory |
| How you route work | Address the right Bot, or a primary Bot routes it | Tell the one assistant; it decides |
| What coordination costs | Roster management, handoffs, group chats | The assistant sorting its own work |
| Failure mode | Too many Bots, split memory, no compaction | One thread's context carries everything; you cannot isolate a topic's memory |

Sources: [design](https://x.ai/news/designing-grok-bot) and [bots](https://docs.x.ai/grok-bot/bots.md) for Grok Bot; [help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet) for Duet. A third-party comparison states the split cleanly: "Grok Bot gives you a list of separate bots, while Duet uses one thread and sorts work into channels" ([DataCamp](https://www.datacamp.com/blog/claude-duet)).

This is the same axis that separated Grok Bot from Hermes, one level up. Hermes disagreed with xAI about defaults but agreed on the object: a roster of named bots. Duet rejects the object. Its channels are a UI convenience over one memory, not a boundary — so the [bot primitive](./bot-primitive.md) is deliberately absent rather than half-built.

## Where Duet is ahead

- **Proactivity is the default, not a feature.** Grok Bot needs a routine configured; Duet opens with a morning brief and periodic check-ins ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)). The product thesis is that noticing the work is the hard part ([DataCamp](https://www.datacamp.com/blog/claude-duet)).
- **It inherits context instead of asking for setup.** Memory, skills, and 6,000+ marketplace connectors arrive from the Claude account on the first message ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **Nothing to organize.** No roster to name, prune, or keep in sync — the cost Grok Bot pays for its shape ([design](https://x.ai/news/designing-grok-bot)).
- **Payment design.** One-time cards scoped to a single purchase through Link or Shop Pay, approved per transaction ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).

## Where Duet is behind

- **No view or takeover of its browser.** Explicitly listed as a limitation ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)). Grok Bot has status, preview, and takeover levels on the Bot's computer ([design](https://x.ai/news/designing-grok-bot)), and OpenAI's equivalent lets you take over.
- **No model choice.** Opus 5.5 only, and it decides how much effort a job needs ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **No documented user-defined routines.** It checks on a fixed cadence you can adjust, not on a schedule or event you author; Grok Bot ships 50 routines per Bot from schedules and events ([FAQ](https://docs.x.ai/grok-bot/faq.md)). Marked `[unverified]` for Duet because the help center never rules routines out, it just never describes them.
- **No delegation or multi-agent handoff.** One assistant, no subagents, no group chats ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **No access to your local files.** It reads your Claude work but cannot change it, and cannot see files on your computer ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **US-only, Pro and Max, waitlisted, no Team or Enterprise** ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).
- **Background work spends your limits.** Morning brief and check-ins count against the same five-hour and weekly limits as chat ([help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)).

## Duet, Cowork, and Grok Bot are three different bets

| Dimension | Claude Cowork | Claude Duet | Grok Bot |
|---|---|---|---|
| Who starts | You, or a schedule you set | The assistant, proactively | You, a routine, or another Bot |
| Surface | Main Claude app: desktop, web, mobile | Separate app: iOS, Android, claude.ai | Desktop and mobile apps, X Chat |
| Local files | Connected folders through the desktop app | No | Files on the shared cloud computer |
| Browser | Built-in browser, or Claude in Chrome | Separate cloud browser, no view or takeover | Cloud desktop with preview and takeover |
| Unit | A task | One assistant | A roster of Bots |
| Plans | Pro, Max, Team, Enterprise | US Pro and Max, waitlist | Paid Cursor plans, SuperGrok tiers |

Sources: [DataCamp](https://www.datacamp.com/blog/claude-duet) for the Cowork column and the plan split, [help center](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet), [overview](https://docs.x.ai/grok-bot/overview.md).

## Verdict

Similar product, different primitive. If the question is "does Duet work the way Grok Bot works" — persistent cloud computer, work while you are away, messages you, asks for approval — the answer is yes, and it is the nearest Anthropic analogue. If the question is "is it the same design" — no. Duet answers "one trusted assistant that organizes everything" where Grok Bot answers "many specialists I address by name", and every downstream difference follows from that: no roster, no per-bot memory, no handoff, no takeover, no model choice.

For the [bot-primitive](./bot-primitive.md) question, Duet is the useful counter-example: a capable proactive agent with no bot object at all. It shows the roster is a product choice, not a requirement for the capability.

## Decision guide

- **Want to hand work off and be interrupted only when needed, inside the Claude ecosystem** → Duet, if you are in the US on Pro or Max and get an invitation.
- **Want several named roles with separate memories and routines** → Grok Bot, or Hermes Bot Mode on your own hardware.
- **Want an agent to drive your own machine and files** → Cowork, not Duet ([DataCamp](https://www.datacamp.com/blog/claude-duet)).
- **Want to watch or rescue the agent mid-task** → Grok Bot today; Duet rules it out for now.

## Open Questions

- Whether Duet gains browser view and takeover, closing the biggest control gap.
- Whether user-authored routines ship, or proactivity stays on a fixed cadence.
- Whether Team and Enterprise access arrives with per-person isolation or a shared assistant.
- Whether Anthropic merges Duet into the main Claude app the way it is merging chat and Cowork ([DataCamp](https://www.datacamp.com/blog/claude-duet)).
- How a single thread holds up over months without per-topic memory isolation, given Duet has no roster to split it across.

## Related

- [Grok Bot — What It Is, and How a Bot Works](./grok-bot.md) — the roster-shaped product this file compares against.
- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — the concept Duet deliberately does without.
- [Hermes Agent vs Grok Bot — Does Hermes Already Do the Bot Primitive?](./hermes-agent-vs-grok-bot.md) — a third shape: roster, open source, self-hosted.
- [Grok Bot Memory — What Survives a Single Long-Lived Chat](./grok-bot-memory.md) — what a single main thread costs, which applies to Duet too.

## Changelog

- 2026-10-29 — created in response to "does Claude Duet are similar product". Sources via TinyFish; Duet is a week-old research preview, so its routine and takeover behaviour is recorded as documented limitations rather than settled design.
