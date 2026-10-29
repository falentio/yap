---
title: Grok Bot Memory — What Survives a Single Long-Lived Chat
category: technology
tags: [grok-bot, memory, context-management, compaction, ai-agents, xai]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://docs.x.ai/grok-bot/bots.md
  - https://docs.x.ai/grok-bot/overview.md
  - https://docs.x.ai/grok-bot/faq.md
  - https://docs.x.ai/grok-bot/vault.md
  - https://docs.x.ai/grok-bot/chat-and-collaboration.md
  - https://x.ai/news/designing-grok-bot
  - https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333
confidence: high
---

## Summary

**The Bot has one canonical conversation, but memory is not that conversation.** Grok Bot keeps two separate stores: a durable per-Bot state — profile, memory, routines, skills, connectors, Vault — and the transcript, which is the model's context. A conversation reset proves the split: "The conversation history starts over, and the Bot's memory, files, routines, and settings are kept" ([bots](https://docs.x.ai/grok-bot/bots.md)).

So there *is* a new-session operation. It is called **reset**, it keeps memory, and its cost is that the log is discarded with no archive. Long-lived threads that are not reset are handled by **auto-summarization near the context limit**, which compresses the transcript; it does not make the transcript free.

The three tiers, and what each one is for:

| Tier | Holds | Written by | Survives reset |
|---|---|---|---|
| Account-level facts | A few facts about you, such as name and time zone | The Bot, when it learns one | Yes, across every Bot |
| Per-Bot memory | Preferences, lasting rules, facts about you, a dated log of work | The Bot, on its own judgment | Yes |
| Transcript | Every message, tool call, screenshot, approval, and voice memo | The conversation | **No** |

Sources: [bots](https://docs.x.ai/grok-bot/bots.md), [FAQ](https://docs.x.ai/grok-bot/faq.md).

## Context

Asked 2026-10-29, following the single-thread finding: if a Bot is one conversation with no new session, where does memory live? The answer matters because it separates two things that are easy to conflate — *remembering you* and *not re-reading everything*. Grok Bot solves the first well and the second only by summarization.

## What a Bot remembers

The docs are specific about the contents: "stable preferences, important facts, and summaries from its work, which lets it keep a role over time without replaying every prior message" ([bots](https://docs.x.ai/grok-bot/bots.md)). The saved categories:

- How you like to work, and your preferences
- Rules you ask it to keep, such as "Always ask before you send an email"
- Facts about you, like your name and time zone
- A dated log of what it has worked on with you

Note the fourth item: the log is a memory *about* the work, not the work itself. The messages stay in the transcript.

### How writes happen, and how you inspect them

"A Bot decides on its own when something is worth keeping. It doesn't ask first. It often mentions a save in its reply, but not every save shows up in the chat" ([bots](https://docs.x.ai/grok-bot/bots.md)). There is deliberately no memory screen for a personal Bot — you inspect and edit memory conversationally:

| Intent | What you say | Documented behaviour |
|---|---|---|
| Read | "What do you remember about me?" | The Bot recites its memory |
| Correct | "That's out of date. I moved to Denver." | Memory entry is replaced |
| Remove | "Forget that I'm on the launch team." | The entry is dropped |
| Force a save | "Remember that I'm out every Friday." | The line is added |

Source: [bots](https://docs.x.ai/grok-bot/bots.md). A shared fact — your name, your time zone — is corrected by telling any Bot, but only the Bot that saved it can remove it entirely.

### Memory is per Bot; cloning does not copy it

This is the part that decides what happens when a thread gets fat and the documented workaround is "spawn another Bot":

| Action | Effect on memory |
|---|---|
| Reset a conversation | Kept — transcript starts over |
| Duplicate a Bot | Profile, settings, skills, routines, avatar copied; **conversation history, learned memory, and attachments are not** |
| Hide from sidebar | Kept, routines keep running |
| Delete a Bot | That Bot's memory is deleted, including facts it had saved for your other Bots |
| Delete your account | All memory is deleted |

Source: [bots](https://docs.x.ai/grok-bot/bots.md). So duplicating to escape a long thread starts the new Bot cold on everything the old one learned — which is exactly why the forum thread calls that workaround one that "explodes the roster, splits memory, and does not fix the product" ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).

## What happens to a long thread that is never reset

Memory does not bound the context. The transcript does, until it hits the window and gets summarized. Both halves of that are confirmed by Cursor staff in the same thread ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)):

- "The full transcript gets sent back to the model, and there aren't any explicit primitives yet to cut older messages from what the model sees."
- "Long conversations are automatically summarized as we get close to the model's context limit."
- And explicitly: "summarization at the context window boundary isn't the same as explicit compact or new session controls."

Read together, the token curve for an unreset Bot is: **replay everything until the limit, then collapse the older part into a summary, then replay again from there.** Cost grows with thread length up to the boundary and resets lower after each summarization pass — but the user has no control over when it happens, no way to see it, and no archive of what was dropped. Reported cost on a long-lived chief-of-staff Bot: "~200–250k input tokens per reply even when work is delegated" ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).

### Confirmed vs inferred

| Claim | Status |
|---|---|
| Durable state is stored separately from the transcript and survives reset | Confirmed by docs and staff |
| Full transcript is replayed each turn | Confirmed by staff |
| Long conversations are auto-summarized near the limit | Confirmed by staff |
| Whether the summary replaces the earlier transcript in context, or is appended alongside it | `[unverified]` |
| Whether summarization output is written back into the persistent memory store | `[unverified]` — the docs' phrasing "role context, and summaries of prior work" suggests at least some summarization lands in memory ([FAQ](https://docs.x.ai/grok-bot/faq.md)) |
| Whether memory has a size cap, and how entries are consolidated | `[unverified]` — no documented limit, unlike Hermes' explicit 2,200/1,375-char caps ([Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)) |

## Why memory does not substitute for compaction

Three structural reasons, all visible in the docs:

1. **Scale.** Memory holds curated facts and a dated log — sentences. The transcript holds tool dumps, screenshots, agent messages, and pings — megabytes. Replacing one with the other is not a trade you can make.
2. **Fidelity.** "Memory is not a substitute for an authoritative source" and the Bot is told to reopen current data for consequential decisions ([bots](https://docs.x.ai/grok-bot/bots.md)). A memory system that is not trusted for facts cannot be trusted as the sole context.
3. **Visibility.** Memory is model-curated and has no screen. A summarizer that silently drops messages is the same property with worse guarantees — which is why the forum request asks for an *archive the user can read*, not just better summaries ([forum](https://forum.cursor.com/t/grok-bot-prune-compact-an-agent-s-context-without-creating-a-new-bot/168333)).

The design writeup itself puts memory and routines on the Bot and tools and skills at the account level, with no mention of a working-set object at all ([design](https://x.ai/news/designing-grok-bot)). That absence is the gap: [the bot primitive](./bot-primitive.md) is present, the working-set primitive is not.

## Two places memory leaks across boundaries

- **Shared facts travel.** A few facts about you — name, time zone — are shared by all your Bots; learn one in one place and the others know it ([bots](https://docs.x.ai/grok-bot/bots.md)). Convenient, and the one path by which a per-Bot memory store becomes account-wide.
- **Group chats expose what a Bot says.** Each Bot keeps its own memory in a group, and "your Bot's memory isn't shared with the other Bots there, but everyone in the group can read what your Bot says" ([bots](https://docs.x.ai/grok-bot/bots.md)). The memory stays private; whatever it writes into the room does not.

Vault is deliberately outside this system: passwords, cards, and contact info live there, a Bot never sees the secret values, and Vault is account-wide with no per-Bot scoping ([vault](https://docs.x.ai/grok-bot/vault.md)).

## Design lessons

- **Separate identity from transcript, then bound the working set.** Grok Bot did the first half. Reset is the proof the split exists; summarization is the proof the second half was skipped.
- **A destructive operation wearing a neutral name.** "Reset conversation" reads like a refresh; it is actually the only new-session control, and it deletes the log with no archive ([bots](https://docs.x.ai/grok-bot/bots.md)).
- **On-by-default summarization is not a feature you can audit.** No trigger, no meter, no record of what was folded — contrast Hermes' explicit `/compact` and per-group-member Compress history button ([Hermes Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)).
- **Memory that cannot be cloned is memory that cannot be moved.** Duplicate drops it, delete destroys it, and templates never include it ([bots](https://docs.x.ai/grok-bot/bots.md)) — so a roster cannot be handed to a teammate with its accumulated knowledge.

## Open Questions

- Whether Grok Bot ships an explicit compact or new-session control on the same Bot with an archive.
- The actual memory size cap and consolidation policy, if any.
- Whether the auto-summary that fires at the context boundary is written into persistent memory, and whether it survives a reset.
- How `Reset`, `Recover`, and computer updates interact with files on the shared computer — the Vault page warns that reset removes installed apps and packages, which is a different kind of forgetting ([vault](https://docs.x.ai/grok-bot/vault.md)).

## Related

- [Grok Bot — What It Is, and How a Bot Works](./grok-bot.md) — the product context for this memory model.
- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — why durable state and transcript must be separate objects, and what the missing working set costs.
- [Hermes Agent vs Grok Bot — Does Hermes Already Do the Bot Primitive?](./hermes-agent-vs-grok-bot.md) — a harness with explicit `/compact` and bounded memory files, for comparison.
- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — how clients implement the trigger, kept tail, and summarizer identity Grok Bot hides.
- [Open-Source Memory for Agents — What to Pick](./open-source-agent-memory.md) — the same split (durable store vs transcript) across the open-source memory services, and why their benchmark numbers do not settle which to pick.

## Changelog

- 2026-10-29 — created in response to "how does grok bot handle memory if only 1 chat session?". Sources via TinyFish; the summarization mechanism is staff-confirmed, its internals are not documented and are marked unverified.
