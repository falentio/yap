---
title: DeepSeek Harness vs Pi — How Each One Compacts a Full Context Window
category: technology
tags: [coding-agents, deepseek-harness, pi, compaction, context-window, summarization, plugin-architecture]
status: complete
created: 2026-10-31
updated: 2026-11-04
sources:
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/compaction.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-tool-result-pruner/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/config.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/region.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/summarizer.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/index.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/minimal.patch.yml
  - https://github.com/deepseek-ai/deepseek-harness/discussions/4306
  - https://api-docs.deepseek.com/quick_start/pricing
  - https://pi.dev/docs/latest/compaction
  - https://pi.dev/docs/latest/session-format
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts
confidence: high
---

# DeepSeek Harness vs Pi — Compaction

## TL;DR

- Both run the same three moves — pick an older span, have a model write a checkpoint, keep the recent tail verbatim. They diverge on **what runs before the summary**, **what the trigger reserves**, and **whether the replacement is a transaction**.
- **Trigger shape differs by design, not by constant.** DeepSeek Harness (dsh) derives its threshold from the routed model: `floor(min(W × 0.8, W − O − 65536))`, where `O` is the request's own output reservation. Pi uses a fixed reserve: `W − 16384`. On real windows that means dsh compacts at roughly 36–68% of the window while pi compacts at 87–98%.
- **dsh has a model-free stage before summarization.** The optional tool-result pruner rewrites oversized tool outputs (8,192-character threshold, 4,096 head + 1,024 tail kept), remeasures, and skips the LLM call entirely when the conversation now fits. Pi only truncates tool results to 2,000 characters *inside the summarization serialization*, never in the live context.
- **The kept tail is a ratio in dsh, an absolute number in pi.** 16% of `W − O` (≈27k on a 200k window, ≈119k on a 1M window) versus a flat 20,000 tokens on every model unless overridden.
- **dsh's replacement is bracketed.** `compaction/start`, the summary, the replacement message and `compaction/end` are four durable records; the open start is the lock; an orphan start is detectable after a crash; and a summary that does not *strictly shrink* its source span fails the transaction. Pi appends one `CompactionEntry` to the entry tree and rebuilds a projection, with no lock and no shrink check.
- **Their cache strategies are opposite.** dsh replays the system head, tools and shadowed messages byte-for-byte so the summarization call is a warm prefix of the conversation. Pi explicitly disables prompt-cache writes for summarization requests.
- **dsh has no branch summarization.** Pi does (`/tree` navigation, `BranchSummaryEntry`, cumulative file lists), and pi owns structured `context_edit` omissions that dsh splits into separate pruner and image-offload plugins.

## Context

Question: how does DeepSeek Harness compact a conversation, and how does that compare with pi?

Researched 2026-10-31. dsh is at `0.2.2-alpha.2`, commit [`ce7073d`](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447) (read from a shallow checkout through a scout; every `path:line` anchor below is at that SHA). Pi is at `1.4.0`; its behaviour comes from the shipping [compaction reference](https://pi.dev/docs/latest/compaction) and the source files that page names. The existing [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) puts pi beside seven other agents; this file goes deep on one pair.

dsh is the more interesting comparison of the two because compaction is not in its agent loop at all. It is a package you mount: `packages/compaction/{compaction,compaction-basic,compaction-tool-result-pruner,compaction-image-offload,command-compact}` ([packages/compaction/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/README.md)). The subsystem doc states the intent directly — compaction is "**one optional capability**, not part of the agent-loop spine" ([docs/subsystems/compaction.md](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/compaction.md)). The shipped `dsh` base mounts the backend, `/compact`, the pruner and image offload ([cordis.patch.yml](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml)); the web "minimal" preset mounts the backend and `/compact` without the pruner ([minimal.patch.yml](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/minimal.patch.yml)).

## Findings

### 1. Wide comparison

| Dimension | DeepSeek Harness 0.2.2-alpha.2 | Pi 1.4.0 |
|---|---|---|
| Where it lives | Plugin behind `ctx.compaction`; mount or omit per preset | Core of the coding agent; extensions can only intercept |
| Default backend | `CompactionEngine` seam plus `dsh-compaction-basic` as the only real implementation | One implementation, no seam |
| Command | `/compact`, no arguments | `/compact [instructions]` |
| Auto on by default | Yes (`auto: true`) | Yes (`compaction.enabled`) |
| Trigger formula | `floor(min(W × thresholdRatio, W − O − headroomTokens))`, with `O` the routed output reservation | `contextTokens > W − reserveTokens` |
| Defaults | `thresholdRatio 0.8`, `headroomTokens 65536`, `retainRatio 0.16` | `reserveTokens 16384`, `keepRecentTokens 20000` |
| Reserves the request's output | Yes, `O` is in the formula | Only through the fixed `reserveTokens` |
| Trigger position, 128k / 200k / 1M | 36% / 51% / 68% | 87% / 92% / 98% |
| Kept verbatim | 16% of `W − O` (≈27k at 200k, ≈119k at 1M) | 20k, flat, per-model override available |
| Model-free reduction first | Yes: pruner, then remeasure, may skip the summary | None; tool results are truncated only when serialized for the summarizer |
| Cut unit | "Oldest balanced span" — tool-call/result pairing only, whole turns not required | User-message span; a split span gets two merged summaries |
| Cut-point rule | First surface node that is not the `system/message`; walk the tail to the retention budget, then move earlier until pairing balances | Walk the projection backwards to `keepRecentTokens`; never cut at a tool result |
| Summarizer | Same route by default; `summarizationProvider` and `summarizationModel` optional | Session model; an extension can replace it wholesale |
| Cache strategy | Replays the warm prefix so only the instruction and output are uncached | Disables prompt-cache writes for summarization requests |
| Summarizer's input | The real messages of the shadowed span plus one appended instruction; the conversation system prompt and tool schemas are replayed | The conversation flattened to text inside `<conversation>` in a fresh one-message window with a summarizer-specific system prompt |
| Summary format | 8 fixed sections: Primary Request and Intent, Key Technical Concepts, Files and Code, Errors and Fixes, Pending Jobs, Current Work, Next Step, Critical Context | 6 sections plus `<read-files>` and `<modified-files>`: Goal, Constraints & Preferences, Progress (Done/In Progress/Blocked), Key Decisions, Next Steps, Critical Context |
| Iterative | Yes — a prior checkpoint inside the next span, merged via a `<compacted-summary>` block | Yes — previous summary passed as context; file lists accumulate |
| Shrink enforced | Yes — checkpoint must be strictly smaller than the span or the transaction fails | No check; `tokensBefore` is recorded only |
| What the model sees | Preamble, blank line, `<compacted-summary>` block, retained tail | Summary entry plus entries from `firstKeptEntryId` |
| Storage | Log-only `compaction/start`, `compaction/summary`, `compaction/end` plus a replacement `user/message` with `surfaceOp: replace` | `CompactionEntry` appended to the tree, `parentId` chain intact |
| Original history | Kept in the append-only log; shadowed, never deleted | Kept as entries; the projection omits them |
| Lock / concurrency | Durable lock: the unmatched `compaction/start`; orphan detected after a crash | No lock; the caller refuses `/compact` mid-turn |
| Model switch | Preflight: compacts against the destination model before the new header is committed, else `MODEL_SWITCH_COMPACTION_FAILED` | Per-model `compaction.modelOverrides`; no preflight, no failure |
| Overflow recovery | `CONTEXT_WINDOW_EXCEEDED` listener bypasses threshold and retention (`retainTokens = 0`); retry only after the surface generation advances | One compact-and-retry; the aborted attempt stays visible to `turn_end` and `agent_end` |
| Retry while still over | `compactionRetries: 1` extra summary attempt | None; overflow or length is the only retry path |
| Config shape | Ratios plus headroom plus `modelPolicies[]` | Absolute token budgets plus `modelOverrides` |
| Extension surface | Subclass `CompactionEngine`, override `summarize()`; schemastery `Config` | `session_before_compact` (cancel, custom summary, instructions), `session_compact_failed` |
| Before/after/failed hooks | No before or after events; only the `compaction/summary-error` waterfall | `session_before_compact`, `session_compact_failed`, `session_before_tree` |
| Branch / tree navigation | None; a fork copies the session, compacted view included | `/tree` with `BranchSummaryEntry` |
| Image handling | `compaction-image-offload` plugin with its own durable declaration | [unverified] |
| Disable | `auto: false` (manual only) | `compaction.enabled: false` |

### 2. The trigger is the biggest behavioural gap

Both formulas are one line; the numbers they produce are not close.

| Window `W` | Output cap `O` | dsh trigger | dsh keeps | pi trigger | pi keeps |
|---|---|---|---|---|---|
| 128k | 16k | 46,464 (36%) | 17,920 | 111,616 (87%) | 20,000 |
| 200k | 32k | 102,464 (51%) | 26,880 | 183,616 (92%) | 20,000 |
| 1M | 256k | 678,464 (68%) | 119,040 | 983,616 (98%) | 20,000 |

dsh prices pressure through the adapter that owns the durable route: `W` comes from `resolveModelInfo(provider, model).context.contextWindow` and `O` from the request header's `maxTokens`, falling back to the adapter default and then zero (`src/index.ts:327,337`, `src/config.ts:191-197`). Pi's `reserveTokens` is a constant 16,384 with optional per-model overrides, and the docs' own 1M-window example raises it to 400,000 to get a 600k trigger ([compaction reference](https://pi.dev/docs/latest/compaction)).

Two consequences worth naming:

- **The headroom term dominates until the window is large.** `0.8W` only wins once `W > 5 × (O + 65536)` — about 490k with a 32k output cap. Below that, dsh compacts on the headroom branch, which is why a 128k window triggers at 36%. The package README says so plainly: "The default 65,536-token headroom does not fit a window of that size or smaller" and tells small-window deployments to set `modelPolicies[].headroomTokens`.
- **Pi's 16k reserve is smaller than a typical output cap.** A 200k model with a 32k completion is committed at 98% of the window if `contextTokens` sits just under the reserve. dsh's formula makes that impossible by construction; pi relies on the overflow-recovery path instead.

Retention diverges the same way: dsh keeps a fraction (`floor((W − O) × 0.16)`), pi keeps an absolute 20,000. On a 1M window pi holds about 5% of the window verbatim, dsh about 16%.

### 3. dsh: prune, remeasure, select, summarize — inside a transaction

```text
pressure at agent/pre-step  ──┐
model switch at agent/request ─┼─→ measure ─→ prune tool results ─→ remeasure
provider overflow at request-error ─┘        (no model call)         │
                                                                     ├─ under threshold → stop, no summary
                                                                     ↓
                                              select oldest balanced span (retention walk)
                                                                     ↓
                     compaction/start → summarize → revalidate → compaction/summary
                                     → replacement user/message → compaction/end
```

- **Pressure points.** The `agent/pre-step` listener prices the latest durable routed request; `agent/request` re-checks when a *different* provider/model is about to be committed, with `requireBelowThreshold`; `agent/request-error` catches a provider-confirmed `CONTEXT_WINDOW_EXCEEDED` (`src/index.ts:157,183-190,213-224`). There is no message-count trigger — the only gate is `measurement.totalTokens < spec.thresholdTokens` (`src/index.ts:342-364`).
- **Prune first, decide second.** After pressure qualifies, `ctx.toolResultPruner.pruneSession` runs and history is remeasured *before* any LLM call; if trimming alone got under the threshold, no summary happens (`src/index.ts:346-351`). Manual `/compact` and overflow recovery skip the pruner today (gap G2 in the scout report).
- **Selection.** Walk the priced surface from the tail accumulating `node.tokens` until the retention budget, then move the cut earlier until `toolPairingBalancedBefore` holds; return `null` if nothing is left (`src/region.ts:133-154`). Surface node 0 is the system prompt and is never shadowed; a later in-history `system/message` is ordinary history (`src/region.ts:112-131`). Whole turns are deliberately *not* the unit: the subsystem doc says boundaries preserve tool pairing "but not whole turns, allowing early closed steps of one oversized turn to compact".
- **One summarization call** through `ctx.llm.stream` with `purpose: 'compaction'`, replaying the system head, the header's active tools and the shadowed messages, with the instruction appended as the final user message (`src/summarizer.ts:143-176`). Only returned text enters the checkpoint; reasoning and tool calls are excluded, and image output fails with `UNSUPPORTED_CONTENT`.
- **The prompt demands eight sections**, "(none)" for an empty one, terse bullets (`src/summarizer.ts:32-68`). The instruction tells the model to *merge* an existing `<compacted-summary>` block rather than copy it, which is how iteration stays lossless across repeated compactions (`src/summarizer.ts:66`).
- **The shrink check is a hard gate.** The framed checkpoint's estimated tokens must be strictly below the span's route-priced tokens, or the transaction fails (`src/region.ts:417-422`). Pi has no analogue: a summary larger than its input simply becomes the new context.
- **The bracket is the lock.** `compaction/start` is appended synchronously, then the summary, then the replacement `user/message` with `surfaceOp: { op: 'replace', startSeq, endSeq }` and `sourceEventSeqs` citing the shadowed nodes, then exactly one `compaction/end` (`docs/subsystems/compaction.md`, `src/region.ts:506-509`). A crash mid-operation leaves an orphan start, which is a detectable state rather than a false claim of completion; a failed close deliberately leaves a blocking orphan.
- **What lands on the wire** is one synthetic user message: preamble, blank line, `<compacted-summary>`, the summary, `</compacted-summary>`, then the retained tail. The preamble is the whole contract the next model gets:

  > This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.

### 4. Pi: cut at a span boundary, summarize, accumulate file lists

```text
contextTokens > W − reserveTokens   (checked after a tool batch, before a prompt, and on overflow)
        ↓
walk the projection backwards to keepRecentTokens      → never cut at a tool result
        ↓
messages up to the cut point (+ previous summary) → serializeConversation → LLM
        ↓
append CompactionEntry { summary, firstKeptEntryId, tokensBefore, usage, details }
        ↓
projection rebuilds: system + summary + entries from firstKeptEntryId
```

The parts that differ from dsh in kind, not degree:

- **Cut points are typed.** Valid cuts are user, assistant, BashExecution and custom messages; tool results are excluded because they must stay with their call. When one user-message span is itself bigger than the budget, pi produces a *split* span: a history summary plus a user-message-span prefix summary, merged. dsh has no turn notion to split.
- **Repeated compaction re-summarizes what survived.** The next summarized span starts at the previous compaction's `firstKeptEntryId`, so messages kept last time are candidates this time. dsh does the same thing implicitly (the prior checkpoint sits inside the next selected region) but frames it as merge-don't-copy in the prompt.
- **File tracking is structured, not prose.** `details` carries `readFiles` and `modifiedFiles`, extracted from tool calls in the summarized messages and carried forward across default compactions and nested branch summaries, then appended to the summary as `<read-files>` and `<modified-files>`. dsh asks the model to write a "Files and Code" section and trusts the text.
- **Serialization is lossy on purpose.** `serializeConversation` renders `[User]`, `[Assistant]`, `[Assistant tool calls]` and `[Tool result]` blocks, drops thinking, and truncates every tool result to 2,000 characters. The framing stops the summarizer from continuing the conversation; the truncation keeps the request within budget. dsh instead replays real messages for cache reuse and relies on the pruner for size.
- **Cache is the opposite bet.** dsh spends effort making the summarization call a genuine prefix of the conversation ("only the trailing instruction and the summary output are uncached"). Pi gives up the cache for these one-off prompts: "Summarization requests disable prompt-cache writes because these one-off prompts are unlikely to be reused." One optimizes the auxiliary call's cost; the other treats it as a one-shot.
- **Storage is a tree, not a log with locks.** `CompactionEntry` has `parentId`, so compaction is one more node. Policy omissions are a separate entry type: `context_edit` with `targetId` and `replacement: null` omits an entry from the projection, a replacement rewrites it, and the raw entries stay untouched ([session-format](https://pi.dev/docs/latest/session-format)). Overflow recovery appends those omissions *before* compaction, and `agent_before_settle` sees the repaired projection. dsh models the same idea as an explicit `image/offload` declaration and pruner replacements, each with its own shadow-price event.

### 5. The summarizer's window: replayed messages, not a text transcript

**No — dsh does not do what pi does.** They send the summarizer two structurally different requests.

Pi builds a fresh one-message window and flattens the conversation into it. The system prompt is replaced with a summarizer-specific one, the history becomes a string inside `<conversation>` tags, the previous summary goes in `<previous-summary>`, and the format prompt follows (`utils.ts`, `dist/core/compaction/utils.js:107`, `compaction.js:516-538`):

```text
system: You are a context summarization assistant. … Do NOT continue the conversation.
user:   <conversation>
        [User]: …
        [Assistant]: …
        [Assistant tool calls]: read(path="a.ts"); bash(command="…")
        [Tool result]: …            ← truncated to 2,000 chars
        </conversation>
        <previous-summary>…</previous-summary>
        <summary-format prompt>
```

The mapping is lossy by construction: tool calls become `name(k=JSON)` strings, tool results become text capped at 2,000 characters (`TOOL_RESULT_MAX_CHARS`), thinking is dropped, image blocks never survive `contentText`, and a summarizer that emits a tool call fails the attempt with "Summarization attempted to call a tool".

dsh sends the messages themselves. The request is `[...input.messages, { role: 'user', text: COMPACTION_INSTRUCTION }]`, where `input.messages` are the durable `Message` objects of the shadowed span, unchanged (`src/summarizer.ts:145-151`): tool calls stay `tool-call` blocks, tool results stay `tool` messages with their `toolCallId` and `isError`, and images stay `image` blocks. The conversation's own system message is derived and prepended as `messages[0]`; when the last routed header carried tools, the same declarations are re-declared for the summarizing route (`src/region.ts:550-561`, `src/summarizer.ts:155-158`). There is no summarizer-specific system prompt and `GenerateOptions.system` is never set — the only role framing is the instruction itself ("You are now acting as a compaction engine…") (`src/summarizer.ts:32-68`).

| Consequence | dsh | pi |
|---|---|---|
| Tool arguments at the summarizer | Structured argument objects | `name(k=JSON, …)` strings |
| Tool result size in the request | Unbounded; the pruner may have rewritten it earlier | Capped at 2,000 chars |
| Images | Preserved as blocks, route permitting | Dropped |
| Thinking | Provider adapters project it; compaction never strips it | Omitted |
| Prefix cache | Warm — the request is a genuine prefix of the conversation | Cold — cache writes disabled for these prompts |
| Continuation risk | Instruction plus the preamble's "without acknowledging this checkpoint" | System prompt's "Do NOT continue the conversation" |
| Request size control | Output cap `maxTokens` (default 65,536); input bounded by the threshold that triggered compaction | 2,000-char tool results over a flat transcript |

**The cache is a read, not a write, so the two strategies sit on different axes.** pi's "no cache writes" is a decision not to pay the write premium for a prompt nothing will reuse. dsh never writes a cache entry either: it rides the prefix the conversation already paid for. dsh is not buying more cache, only arranging its request so an existing entry can be read.

The discount is large enough to invert the cost ranking. DeepSeek bills a cache hit on `deepseek-flash` at $0.006/M input against $0.30/M on a miss at peak — a 30× gap on `deepseek-v4-pro` and 50× on Flash ([pricing](https://api-docs.deepseek.com/quick_start/pricing)). Taking an illustrative 300k-token span whose pi digest lands around 40k tokens after the 2,000-char caps:

| Option | Billed input | Price at Flash peak |
|---|---|---|
| dsh, warm prefix | ~300k hit + instruction | ≈$0.002 |
| pi, truncated digest | ~40k, all miss | ≈$0.012 |
| dsh, cold prefix | ~300k, all miss | ≈$0.09 |

So the hit path is roughly 6× cheaper than pi's digest, and the miss path roughly 7× more expensive. **The saving is conditional and the failure mode is worse than the alternative.** The replay must match the prefix byte-for-byte; any projection difference (thinking signatures, tool-call ids) or an evicted cache turns the cheapest option on the table into the most expensive one. pi's cost is bounded and cache-independent by construction — it paid for that with fidelity.

Two smaller points. A cache hit cuts price and latency but not the tokens the summarizer must attend to, so it does nothing for the pressure that triggered the call. And the hit depends on the routed provider doing implicit prefix caching, which in dsh is adapter territory (`llm-deepseek`), not compaction code — the compaction package assumes it, it does not arrange it.

This is why the trigger question above matters more than it looks. pi can afford to compact late because its summarization request is a cheap, lossy digest. dsh compacts early because its summarization request is a full replay whose input cost is roughly the span being replaced — and it demands the output be strictly smaller than that span.

### 6. Extension surface: hooks versus a subclass

Pi exposes three lifecycle events, and they are cooperative: `session_before_compact` can return `{ cancel: true }` or a complete `{ compaction: { summary, firstKeptEntryId, tokensBefore, usage, details } }`, with `customInstructions`, `reason` (`manual`, `threshold` or `overflow`) and `willRetry` in the payload; `session_compact_failed` pairs every attempt with an outcome; `session_before_tree` covers branch summarization. That is enough for a different summarization model, a template summarizer, or telemetry.

dsh is narrower at the seam and wider in composition: `CompactionEngine` is abstract with `compactIfNeeded`, `compactNow` and `compactRegion`; the single override point is `summarize()`, and a replacement engine is a whole package with a schemastery `Config`. There is no before, after or failed event — only a `compaction/summary-error` waterfall plus the agent lifecycle listeners (`agent/pre-step`, `agent/request`, `agent/request-error`, `session/event`). A third-party plugin can still hook the log: an ecosystem plugin already exists that runs before the basic backend and decides which tool results to drop ([wjw66/deepseek-harness-jev-pre-compaction](https://github.com/wjw66/deepseek-harness-jev-pre-compaction)).

The trade is legibility. Pi's hook surface is a documented API in one process; dsh's is "replace the engine and re-implement pressure, retention, pairing and accounting correctly", offset by `ctx.tokenMeter` owning the pricing so a subclass cannot get the token math wrong.

### 7. Failure modes, and one history lesson

dsh encodes failure in types rather than prose: `ManualCompactionErrorCode` is `busy`, `cancelled`, `changed`, `summary`, `commit` or `persistence`; `TargetPressureConfigError` warns once per target and lets the turn continue; a summary truncated at `maxTokens` (`MAX_TOKENS`) or an image in the output (`UNSUPPORTED_CONTENT`) fails the attempt; `MODEL_SWITCH_COMPACTION_FAILED` keeps the previous header and any completed reductions. If nothing can be condensed safely, nothing is written to the log at all. Pi reports the same class of failure through `session_compact_failed` with `reason`, `aborted`, `willRetry` and `fromExtension`, and keeps a failed attempt visible to `turn_end` and `agent_end`.

The bug history shows what the design is defending against. [Discussion #4306](https://github.com/deepseek-ai/deepseek-harness/discussions/4306) (2026-08-24, dsh `0.1.1-rc.2`) reported an unrecoverable `CONTEXT_WINDOW_EXCEEDED` from two defects: the minimal preset shipped without any compaction backend, and `measure()` priced only system, tools and messages, never the request's `max_tokens`, so a 794,624-token input passed the 0.8 × window check and then overflowed with a 256,000-token completion.

Both are addressed at `ce7073d`: the web minimal preset now mounts the backend and `/compact`, and the trigger formula subtracts the routed output reservation explicitly. It is the strongest argument for dsh's formula over pi's constant reserve — the failure this bug described is exactly what a fixed `reserveTokens` cannot prevent, and pi's answer to it is the overflow-recovery retry rather than an earlier trigger.

## What pi could take from dsh

1. **Put the output reservation in the trigger.** `W − max(reserveTokens, requestMaxTokens)` costs nothing and removes the 98%-of-window commit that only overflow recovery catches today.
2. **Make the kept tail a ratio.** 20,000 tokens is 10% of a 200k window and 2% of a 1M window. A `keepRecentRatio` with `keepRecentTokens` as the absolute override would scale with the model pi already knows about.
3. **Add a model-free pruner stage.** Trimming oversized tool results before summarizing is cheaper than any summary, and it is the only path where compaction costs zero tokens. Pi already knows the shape — it truncates at 2,000 characters when serializing — but applies the saving to the summarizer's input instead of the live context.
4. **Check the shrink.** A summary larger than the span it replaces is a silent regression; dsh fails the transaction instead.
5. **Preflight a model switch.** Pi has `modelOverrides` but no check that the destination window fits the current context, so a switch to a smaller model lands in overflow recovery. dsh compacts against the destination before committing the header.
6. **Surface what a compaction did.** dsh reports items condensed and tokens freed on every path; pi's `session_compact_failed` covers failure, but success is quiet.

## What dsh could take from pi

1. **Branch-level context transfer.** dsh has no `/tree` equivalent; a fork copies the session and inherits its compacted view, and recallable compaction is only a proposal in `.agents/notes/proposed/`.
2. **Structured file lists.** `readFiles` and `modifiedFiles` survive repeated compaction as data. dsh asks the summarizer to restate them in Markdown and re-merge them each pass.
3. **Before and after hooks.** `compaction/summary-error` is a failure channel; pi's `session_before_compact` lets an extension replace the summary while the engine keeps pricing and accounting.
4. **Instructions on the manual command.** `/compact` is argument-free in dsh (`command-compact/src/index.ts:101-103`); pi's `/compact [instructions]` is a cheap steering control.

## Gaps

- **Does dsh ever run two summaries for one oversized indivisible unit?** The README declares a single non-tool unit that exceeds the window unrecoverable; no second strategy exists in code (scout gap G4).
- **Manual `/compact` skips the pruner.** It calls `compactNow` without `pruneSession`. Whether that is deliberate (a manual command should always summarize) or an omission is unstated (gap G2).
- **How the pruner interacts with `compactionRetries`** when a retry follows a successful prune is not described in the docs reviewed.
- **Pi's image handling during compaction** is not documented on the reference page reviewed; dsh solves it with a separate offload plugin. Marked `[unverified]` in the table.
- **No quality benchmark from either project.** dsh enforces shrink (size), not fidelity; pi enforces nothing measurable. Neither publishes a summary-quality evaluation comparable to Cursor's.

## Related

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) — the seven-agent wide comparison this file extends.
- [Why DeepSeek Harness Spends More Turns on the Same Model](./deepseek-harness-turn-count.md) — the turn-count side of the same trigger: what the early compaction and the pruner cost in re-reads and extra model requests.
- [Pi Durable vs the Pi Coding Agent](./pi-durable-vs-pi-coding-agent.md) — background compaction as an owned conversation in the durable variant.
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — the same problem across a provider boundary, where dsh's model-switch preflight is the local analogue.
- [Pi Coding Agent — Which AGENTS.md Files It Loads](./pi-agents-md-context-discovery.md) — what pi puts in the window before compaction has anything to do.
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — a pi fork governed by the same compaction behaviour.

## Changelog

- 2026-10-31 — created. dsh read at `ce7073d` (0.2.2-alpha.2) from a scout checkout; pi read at 1.4.0 from its compaction reference and the source paths it names.
- 2026-10-31 — added §5 on the summarizer's request shape (dsh replays structured messages, pi flattens to a text transcript), verified against dsh `summarizer.ts` and pi's shipped `dist/core/compaction/utils.js`.
- 2026-10-31 — added the cache economics of §5 (hit vs write, and the cost inversion when the prefix misses) against DeepSeek's published pricing.
- 2026-11-04 — linked the turn-count deep dive; no findings changed.
