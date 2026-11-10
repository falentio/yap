---
title: Why DeepSeek Harness Spends More Turns Than Other Harnesses on the Same Model
category: technology
tags: [coding-agents, deepseek-harness, dsh, agent-loop, turn-count, tool-design, context-management, deepseek-v4-1]
status: complete
created: 2026-11-04
updated: 2026-11-04
sources:
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/src/agent.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/constants.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/tool-executor-native/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/read.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/grep.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/edit.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/write.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/fs-observation-policy/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs-search/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/shell/tool-bash/src/index.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/spill/spill-policy/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/config.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/index.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-image-offload/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/llm/llm-retry/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/guard/repeat-tool-reminder/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/goal/goal-round-driver/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/lsp/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/todo/tool-todo/src/index.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/standard.patch.yml
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-chat/src/client/presentation-policy.ts
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/apps/cli/README.md
  - https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/apps/cli/package.json
  - https://www.deepseek.com/en/news/deepseek-v4-1-flash/
  - https://api-docs.deepseek.com/news/news261017/
  - https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash
  - https://www.datacamp.com/blog/what-is-deepseek-harness
  - https://composio.dev/content/deepseek-harness-vs-claude-code
  - https://winder.ai/deepseek-harness-vs-opencode/
  - https://arxiv.org/html/2610.00917v1
  - https://www.reddit.com/r/LocalLLaMA/comments/1v7d8px/harness_showdown_claude_code_vs_opencode_vs_pi/
  - https://www.reddit.com/r/DeepSeek/comments/1vnpt5n/my_first_impressions_of_deepseek_harness/
  - https://github.com/deepseek-ai/deepseek-harness/discussions/4259
  - https://dsh-plugin.org/tutorials/fix-runaway-tool-call-args
  - https://www.developersdigest.tech/blog/deepseek-harness-dsh-first-look
confidence: high
---

# Why DeepSeek Harness Spends More Turns Than Other Harnesses on the Same Model

## TL;DR

- **"Turn" is not the same unit on both sides.** dsh defines a turn as a durable slice that opens before its first input is claimed and closes when nothing is owed; a **step** is one model request plus its tool calls, and a turn is zero or more steps ([datacamp](https://www.datacamp.com/blog/what-is-deepseek-harness)). The web transcript renders one row per step (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-chat/src/client/presentation-policy.ts:29). Part of "more turns" is counting rows in a harness that reports steps.
- **Normalize to tool calls and the gap is real but modest.** One same-model run measured **14.2 tool calls for dsh against 11.7 for Claude Code** (+21%), on 30 hard tasks with DeepSeek V4 Pro 0813 ([Composio](https://composio.dev/content/deepseek-harness-vs-claude-code)).
- **The harness serves information in slices, so each slice costs a request.** `read` caps at 2,000 lines, 2,000 chars per line and 51,200 bytes, and its footer says "Use offset=<next> to continue" (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/README.md:48,67-69,207). `grep` returns `Line N: <preview>` groups capped at 250 matches and 2,000-byte previews, with no file bodies (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs-search/README.md:54-58).
- **Read is a precondition of edit, and observations are not persisted.** `edit` without a prior read fails `FS_NOT_OBSERVED`; a file changed since the read fails `FS_STALE_VERSION` with "re-read the file, then retry" (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/fs-observation-policy/README.md:44,128). Resume and fork start with no observations, so the first edit after a resume pays a read again.
- **Context is evicted earlier and more aggressively than in peers.** Compaction triggers at `min(W × 0.8, W − O − 65536)` and keeps a 16% tail (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/config.ts:20,23,191-197); the pruner rewrites any tool result above 8,192 chars to 4,096 head + 1,024 tail (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:426-429). Anything evicted is recoverable only by re-reading. The arithmetic is in [DeepSeek Harness vs Pi — Compaction](./deepseek-harness-vs-pi-compaction.md).
- **Nothing bounds the loop and nothing checks the work.** There is no built-in turn budget — "tool calls or steering continue the current turn" — and no lint, typecheck or diagnostics pass exists to close it out (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/README.md:220, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/lsp/README.md:32). In the harness-by-harness table of a 66-configuration study, dsh's turn limit is **none**, against OpenHands' 500 steps plus a stuck detector ([arXiv 2610.00917, Table 5](https://arxiv.org/html/2610.00917v1)).
- **The shipped default stacks multipliers on top of that work.** `goal-round-driver` "automatically continues an active goal … each round gives the model another turn"; `repeat-tool-reminder` fires at 3, 5 and 8 repetitions; a request retries up to five times on empty/ratelimit/server/timeout/transport; `subagent` and `workflow` are on in the standard preset (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/goal/goal-round-driver/README.md:12, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/guard/repeat-tool-reminder/README.md:12, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/llm/llm-retry/README.md:50,54, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/standard.patch.yml:96-113).
- **More turns is not more money.** The same run measured **88,562 tokens per task for dsh against 649,900 for Claude Code**, and practitioners report ~99% cache hit rates ([Composio](https://composio.dev/content/deepseek-harness-vs-claude-code), [r/DeepSeek](https://www.reddit.com/r/DeepSeek/comments/1vnpt5n/my_first_impressions_of_deepseek_harness/)).
- **"Same model" is route-sensitive.** dsh's base route is `deepseek-official/deepseek-flash` for every fresh agent, and `agent/request` cannot change provider or model after step preparation, so the harness cannot escalate mid-turn when the cheap route flails (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:93-94, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/src/agent.ts:648-650).

## Context

Question: the same DeepSeek V4.1 model, a different harness, and DeepSeek Harness (dsh) consistently burns more turns to finish. Why?

DeepSeek V4.1 is real and current: `DeepSeek-V4.1-Flash` was announced 2026-09-10 with multimodal input and the `deepseek-flash` route, and `DeepSeek-V4.1-Flash-1017` followed on 2026-10-17 ([DeepSeek news](https://www.deepseek.com/en/news/deepseek-v4-1-flash/), [API news](https://api-docs.deepseek.com/news/news261017/), [model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash)). "Same model, different harness" is therefore a live comparison, and it is the one the [Model–Harness Interactions](https://arxiv.org/html/2610.00917v1) paper formalizes: the harness decides how tools are presented, what stays in context, how errors come back, and when the agent retries or stops.

Source read: dsh `0.2.2-alpha.2` at [`ce7073d`](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447) (2026-10-30), from the shallow checkout at `~/.pi/source/github.com-deepseek-ai-deepseek-harness@main`. Every `path:line` below is at that SHA. Published measurements are labelled with the model they actually ran, which in most cases is V4 Pro or V4 Flash, not V4.1.

## Findings

### 1. The unit question comes first

| Dimension | dsh | Claude Code | OpenHands |
|---|---|---|---|
| Unit the loop counts | turn (durable) containing steps (one request each) | [unverified] turn per user exchange | step |
| Unit the transcript shows | one row per step, grouped, `stepGrouping: 'collapsed'` | [unverified] | [unverified] |
| Turn limit | none | none ([arXiv Table 5](https://arxiv.org/html/2610.00917v1)) | 500 steps + stuck detector |
| Native tools | 26 standard tools | 21 native tools | 5 |
| Context management | native compaction at 80% of the window | native auto-compaction, 1M window | 1M window, no condensation |

The turn/step split is stated in the agent loop itself: `turn/start` opens at https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/src/agent.ts:336 and closes exactly once in `finally` at `:422`, while `const step = phase.step + 1` at `:346` opens a `step/start` at `:361` and a `step/end` at `:388`. So a side-by-side "how many turns did it take" is not apples to apples unless both sides count model requests or tool calls. When the impression comes from the dsh transcript, the number being seen is steps.

### 2. Measured gap, when the units are normalized

| Source, date | Model | Metric | dsh | Peer |
|---|---|---|---|---|
| [Composio](https://composio.dev/content/deepseek-harness-vs-claude-code), 2026-08-31, 30 hard tasks | DeepSeek V4 Pro 0813 | tool calls per task | 14.2 | Claude Code 11.7 |
| same run | same | tokens per task | 88,562 | Claude Code 649,900 |
| [AtlasCloud via Winder](https://winder.ai/deepseek-harness-vs-opencode/) | DeepSeek V4 Pro | tool calls | 8 | Hermes 35 |
| [r/LocalLLaMA showdown](https://www.reddit.com/r/LocalLLaMA/comments/1v7d8px/harness_showdown_claude_code_vs_opencode_vs_pi/) | DeepSeek V4 Flash, local | tool calls per task | — | Claude Code ~70, OpenCode ~22 |

Three readings follow. dsh took **more** calls than Claude Code in the only head-to-head run that counted both; it took **far fewer** than Hermes in another; and the direction flips again across the r/LocalLLaMA trio, where Claude Code is the call hog and pi "re-reads the same files the most" by the author's own measurement. So dsh's step inflation is real against some peers and absent against others, and no published benchmark isolates it for V4.1 [unverified].

### 3. Mechanism: information is served in slices

Every row is one logical need split into two or more requests:

| Behaviour | Anchor | Requests it adds |
|---|---|---|
| `read` is windowed: 2,000 lines, 2,000 chars per line, 51,200 bytes, with a "use offset" footer | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/README.md:48,67-69,207 | +1 per window past the first |
| Prompt guidance pushes paging: "Use offset and limit to continue reading large files" | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/read.ts:74 | same |
| `grep` returns previews only, capped at 250 matches and 2,000-byte previews | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs-search/README.md:54-58 | +1 read per matched file worth opening |
| Grep guidance says so: "Use read on a matched file when you need surrounding context" | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/grep.ts:283 | same |
| Results above `maxInlineTokens: 12500` spill to head/tail plus a path; full content needs a later `read` | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/spill/spill-policy/README.md:12,57, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:415-416 | +1 to recover the body |
| Tool results over 8,192 chars are middle-pruned to 4,096 + 1,024 | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:426-429 | +1 to recover the middle |
| `bash` background returns a job id collected by a later `job_output` | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/shell/tool-bash/src/index.ts:370-388 | +1 per background run |
| `write` is steered to `edit`, and `edit` needs a fresh read | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/write.ts:67-70, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/tool-fs/src/edit.ts:80 | +1 before the first edit |
| LSP navigation "deliberately excludes … formatting, diagnostics, and symbol lists" | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/lsp/README.md:32,128 | +1 shell call to learn what a compile would say |

None of these is a bug. Each is a defensive default that keeps one step cheap. The bill arrives as steps: a 3,000-line file plus a grep hit costs roughly three requests where a whole-file read plus full grep bodies costs one.

### 4. Mechanism: read-before-edit, and stale means read again

`fs-observation-policy` makes editing a file contingent on having observed it in the same session: `cannot modify "<path>": file has not been read — read the file, then retry` (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/fs/fs-observation-policy/README.md:44). A changed file fails `FS_STALE_VERSION` and must be re-read at `:128`, and observations are not persisted, so a resumed or forked session re-reads before its first edit. Even a windowed read authorizes a whole-file overwrite (`:131`), so the policy buys ordering, not safety on partial content.

Consequence for turn counts: every "someone else touched the file" event costs a step. In a worktree where the agent also runs a formatter, or a dev server writes generated files, that is most edits after the first.

### 5. Mechanism: early eviction turns into re-reading

Compaction at 36–68% of the window (128k–1M) and the 16% retained tail mean the summarizer replaces content the agent was still using while the window is a third empty. [DeepSeek Harness vs Pi — Compaction](./deepseek-harness-vs-pi-compaction.md) has the trigger arithmetic; the turn-count consequence is the part it does not cover: a summary is a lossy substitute, and the model's recovery move is `read` again. Image offload makes it explicit by replacing older images with path placeholders that `read_image` must recover (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-image-offload/README.md:20-22).

The overflow path adds a request too: on `CONTEXT_WINDOW_EXCEEDED` the listener bypasses the threshold, compacts with `retainTokens = 0`, and retries (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/index.ts:213-240). That is a compaction plus a fresh request where a peer with a later trigger would have kept going.

### 6. Mechanism: no verification machinery, so verification is a step

There is no post-edit lint, typecheck or test hook, and no diagnostics channel: LSP is navigation only (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/lsp/README.md:32,128). Prompt guidance asks for a todo per step up front (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/todo/tool-todo/src/index.ts:46-48) and a plan only in plan mode (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/standard.patch.yml:41-55), but nothing runs when the model stops. So the closing check is a `bash` call the model chooses, then often a second one after the first fails, then a third to confirm the fix. A harness that pipes diagnostics back after every edit folds those into the edit's own step.

The paper's trajectory coding names the same asymmetry from the other side: repairs succeed when the harness returns a usable signal, and "almost all responses were model-initiated (180 of 192)" ([arXiv 2610.00917](https://arxiv.org/html/2610.00917v1)). dsh hands the initiative to the model, which means the model pays a step for each signal it has to go get.

### 7. Mechanism: multipliers in the shipped default

| Multiplier | Anchor | Effect |
|---|---|---|
| `goal-round-driver` | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/goal/goal-round-driver/README.md:12, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:329-330 | Each round of an active goal is another turn; a goal left open inflates turn counts by design |
| `repeat-tool-reminder` | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/guard/repeat-tool-reminder/README.md:12, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:447-451 | Advisory message at 3, 5, 8 repetitions, each a new step |
| Request retries | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/llm/llm-retry/README.md:50,54 | Up to 5 extra provider requests in the same turn on empty/ratelimit/server/timeout/transport |
| `subagent`, `subagent_fork`, `workflow` on by default | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/web-app/presets/standard.patch.yml:96-113 | Each delegated run spends its own requests; counting a whole session then counts the children |
| Session title via a model | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/session/session-title-first-prompt-llm/README.md:32 | One auxiliary request per fresh session |
| Permission denial as a same-turn retry | [developersdigest read of the source](https://www.developersdigest.tech/blog/deepseek-harness-dsh-first-look) | A denied `bash` teaches "one same-turn retry with a wider scope": +1 step per denial |
| Ralph / agent-team bundles (opt-in) | https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/apps/cli/package.json:104,130, https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/experimental/tool-ralph/src/index.ts:35 | `maxRounds` 256 by default when mounted |

The retry count matters more than it looks on a metered or flaky route: five retries on `EMPTY_RESPONSE` is five requests for one step, and the user sees one slow turn.

### 8. Mechanism: no turn budget, and the guards watch the wrong thing

The loop only breaks when `turnEnds` is non-null and the inbox is empty, and `step()` returns one of two end reasons. Both are quoted from the source in a community write-up of two recorded runaways: a reasoning-only spin (no tool calls, no text, thousands of thinking deltas) and an argument runaway (`job_output` arguments repeated for 4,074 fragments over ~115 seconds) ([dsh-plugin.org](https://dsh-plugin.org/tutorials/fix-runaway-tool-call-args)). Neither default guard fires: `guard/timeout-policy` arms only when a tool declares `timeoutMs`, and `repeat-tool-reminder` hangs off `tools/post-execute`, so a step that produces zero tool calls is invisible to both.

That is the "always more turns" failure shape with no benchmark attached: a degenerate step is not an error, it is a step. The ecosystem's answer is a supervision plugin — `dsh-governor` "watches a running agent for three failure shapes" (runaway agents, retry storms, reasoning-budget burn), with observation as the default and enforcement opt-in ([discussion #4259](https://github.com/deepseek-ai/deepseek-harness/discussions/4259)). Needing a bolt-on for runaways is itself the finding: the shipped defaults have no supervisor.

### 9. Mechanism: the route is part of "the same model"

dsh's base mounts `deepseek-official/deepseek-flash` as the default route for every fresh agent (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:93-94), and the route is captured before prompt assembly and cannot change after step preparation: "agent/request proposed … use agent.model.select() before step preparation" (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-loop/src/agent.ts:648-650). There is no automatic flash→pro escalation when a step keeps failing (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/agent-default-model/README.md:26-30).

So two agents can both be configured for "DeepSeek V4.1" and run different tiers of it, with different `maxTokens` — which also moves the compaction trigger, since `O` is subtracted in the formula. A weaker or shorter-output route finishes the same work in more steps, and the harness has no self-correction for that.

## What this does and does not show

- It does **not** show dsh is the turn hog among all harnesses. In the r/LocalLLaMA run Claude Code took ~70 calls against OpenCode's ~22, and pi re-read the same files most ([link](https://www.reddit.com/r/LocalLLaMA/comments/1v7d8px/harness_showdown_claude_code_vs_opencode_vs_pi/)). Against Hermes, dsh took 8 calls where Hermes took 35 ([AtlasCloud via Winder](https://winder.ai/deepseek-harness-vs-opencode/)).
- The one head-to-head is dsh 14.2 against Claude Code 11.7 tool calls, at 7.3× fewer tokens: 21% more actions, not a doubling.
- No public source isolates turn count for **V4.1** specifically. Composio ran V4 Pro 0813; the r/LocalLLaMA showdown ran V4 Flash locally; the arXiv study pinned `deepseek-v4-pro-0813`. Treat any V4.1-specific claim as [unverified].
- Tokens and turns move in opposite directions on dsh. ~99% cache hit ([r/DeepSeek](https://www.reddit.com/r/DeepSeek/comments/1vnpt5n/my_first_impressions_of_deepseek_harness/)) and a 10,898-token system prompt with 88.8% cached history ([AtlasCloud via Winder](https://winder.ai/deepseek-harness-vs-opencode/)) mean an extra step is cheap. If the complaint is wall-clock or cost, turns are the wrong metric; if it is "it keeps going after I can see the answer", turns are the right one.

## Knobs that change the count

| Goal | Setting |
|---|---|
| Fewer re-reads after compaction | Raise `headroomTokens` or lower `thresholdRatio`, or raise `retainRatio` (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/compaction/compaction-basic/src/config.ts:20,23) |
| Fewer sliced reads | Raise `readLimit` / `readMaxBytes`, or use the **code** preset, which exposes tools as a TypeScript SDK so one program does what several calls did |
| Fewer pruned tool results | Raise the pruner threshold above 8,192 chars, or unmount `compaction-tool-result-pruner` from the profile |
| Fewer spill round-trips | Raise `maxInlineTokens` above 12,500 (https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml:415-416) |
| Stop the unrequested continuation | `auto: false` on `goal-round-driver`, or unmount it |
| Stop counting child work | Unmount `subagent` / `workflow` in the standard preset |
| Stabilise the route | Pin `agent.model.select()` to the tier being compared, and compare `maxTokens` too |
| Cap a runaway | Mount a supervisor (`dsh-governor`) or a step budget as an `agent/turn-stopping` policy |

## Changelog

- 2026-11-04 — created. Read dsh `0.2.2-alpha.2` at `ce7073d` through a scout; measured comparisons taken from Composio (V4 Pro), AtlasCloud via Winder, the r/LocalLLaMA harness showdown (V4 Flash) and the arXiv model–harness study. Linked [DeepSeek Harness vs Pi — Compaction](./deepseek-harness-vs-pi-compaction.md) for the trigger arithmetic and [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md) for the peer set.
