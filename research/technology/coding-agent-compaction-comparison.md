---
title: Context Compaction Across Coding Agents — Claude Code, Codex CLI, OpenCode, Pi, Gemini CLI, Cursor, Amp
category: technology
tags: [coding-agents, context-window, compaction, summarization, claude-code, codex-cli, opencode, pi, gemini-cli, cursor, amp]
status: complete
created: 2026-10-26
updated: 2026-10-31
sources:
  - https://code.claude.com/docs/en/context-window
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://code.claude.com/docs/en/model-config
  - https://code.claude.com/docs/en/env-vars
  - https://code.claude.com/docs/en/prompt-caching
  - https://code.claude.com/docs/en/hooks
  - https://pi.dev/docs/latest/compaction
  - https://opencode.ai/v2/docs/compaction/
  - https://learn.chatgpt.com/docs/config-file/config-reference
  - https://kangwooklee.com/blogs/codex_context_compaction.html
  - https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f
  - https://cursor.com/blog/self-summarization
  - https://iceberglakehouse.com/posts/2026-03-context-gemini-cli/
  - https://geminicli.com/docs/cli/settings/
  - https://dev.to/gabrielanhaia/compact-or-compress-9-agent-commands-in-claude-code-codex-gemini-cli-and-opencode-58hl
confidence: high
---

# Context Compaction Across Coding Agents

## TL;DR

- Every agent here runs the same three steps — pick a cut point, call an LLM to summarize the older part, keep the recent tail verbatim — and they differ almost entirely in *where the cut point comes from* and *who does the summarizing*.
- **Two trigger families.** Fraction-of-window (Gemini CLI `model.compressionThreshold` = 0.5, Claude Code's percent override) versus reserved-headroom in tokens (Pi: `contextWindow - reserveTokens`, Codex: `model_auto_compact_token_limit`, OpenCode: a 15% `buffer` with a 16k floor).
- **Two summarizer families.** Local summarization by the session model or a configured other model (Pi, OpenCode summary mode, Codex for non-Codex models, Claude Code) versus an **opaque server-side compaction endpoint returning an encrypted checkpoint** (Codex `codex` models via `responses.compact()`, OpenCode native mode on OpenAI Responses). The encrypted checkpoint is not portable: switch model and the session continues from the original conversation.
- **Failure recovery converges.** Pi, Codex, OpenCode and Claude Code each add exactly one compact-and-retry when the provider rejects a request as too long (OpenCode: a second rejection is an error; Claude Code: stops with a *thrashing* error instead of looping).
- **The direction of travel is summarizing before you need to.** OpenCode writes the summary in the background at 85% of its threshold and swaps it in later; Claude Code compacts idle conversations on the prompt-cache TTL; Cursor trains the model to self-summarize so the summary costs about one fifth of a tuned prompt baseline.

## Context

Question: how do coding agents manage context-window overflow — what triggers compaction, what the summary keeps, who writes it, what the user can control, and what happens to the transcript afterwards? Researched 2026-10-26 from each vendor's own documentation, plus one source-level reverse-engineering of Codex's encrypted endpoint. Chat answers on this topic are abundant and stale; anything taken from a third-party blog rather than the vendor is labelled in place.

## Findings

### 1. Wide comparison

One agent per column. The dimension rows are the ones that change behaviour.

| Dimension | Claude Code | Codex CLI | OpenCode (V2) | Pi | Gemini CLI | Cursor (Composer) | Amp |
|---|---|---|---|---|---|---|---|
| Command | `/compact [focus]` | `/compact` | `/compact` (API) | `/compact [instructions]` | `/compress` | `/summarize` [3rd-party] | Handoff, new thread |
| Auto on by default | Yes | Yes, above the model default | Yes (`compaction.auto`) | Yes (`compaction.enabled`) | Yes | Yes, trained behaviour | **No** — manual only |
| Trigger shape | Token window, defaults to the model limit; percent override | Tokens: `model_auto_compact_token_limit` | Tokens: limit minus `buffer` (15%, min 16k) | Tokens: `contextWindow - reserveTokens` | Fraction of window: `model.compressionThreshold`, default 0.5 | Fixed token-length trigger (80k and 40k in the published tests) | n/a |
| Recent tail kept verbatim | Yes, same pass as `/compact` | Yes, recent user messages (~20k tokens) [3rd-party] | Yes, `keep.tokens` default 15000 | Yes, `keepRecentTokens` default 20000 | Not stated on the page reviewed | Yes, summary plus conversation state | n/a |
| Who summarizes | Session model, inherits the thinking setting | Session model locally; server for `codex` models | Session model, or `agents.compaction.model` | Session model; extensions may replace it | Session model | The model itself, trained | Secondary model extracts into a new thread |
| Summary shape | Structured summary; invoked skill bodies re-injected | Free-form handoff plus a fixed prefix | Objective, Next Move, decisions, files | Goal, Constraints, Progress, Key Decisions, Next Steps, Critical Context, file lists | Structured summary [3rd-party] | ~1,000 tokens, unconstrained | Task-relevant extraction |
| Native provider path | None | Yes: `responses.compact()`, encrypted blob | Yes: OpenAI Responses, opaque encrypted item | None | [unverified] | n/a | n/a |
| Summary on disk | Replaces history in the session transcript | New history plus compaction items | Earlier messages **stay stored**, just unsent | `CompactionEntry` appended, parent chain intact | Replaces chat history | In the trajectory | n/a |
| Hooks | `PreCompact` (blockable), `PostCompact` | `PreCompact`, `PostCompact` | `session.compaction.*` events | `session_before_compact`, `session_compact_failed` | [unverified] | n/a | n/a |
| Prompt overridable | Compact Instructions in CLAUDE.md; `/compact` focus | `compact_prompt`, `experimental_compact_prompt_file` | Not documented | Extension returns a custom summary | [unverified] | Trained, not prompted | n/a |
| Disable auto | `DISABLE_AUTO_COMPACT=1`, `autoCompactEnabled` | [unverified] | `compaction.auto: false` | `compaction.enabled: false` | [unverified] | n/a | Already manual |
| Overflow retry | One attempt, then a thrashing error | Retry with backoff [3rd-party] | One retry, second rejection is an error | One compact-and-retry | [unverified] | n/a | n/a |
| Background / ahead of time | Idle compaction on the cache TTL | No | Yes: summary starts at 85% of the threshold | No | No | n/a | n/a |

### 2. Claude Code — compaction is a re-injection problem, not a summarization problem

The summary itself is the boring part. What Claude Code documents in detail is what happens to everything that was *not* conversation: the system prompt and output style still apply, project-root CLAUDE.md and unscoped rules are re-read from disk, auto memory is re-injected, skill descriptions are rebuilt, a plan-mode plan is re-read, and SessionStart hooks whose matcher is `compact` run again ([context-window](https://code.claude.com/docs/en/context-window)).

- **Files and skills come back under a budget.** Up to five recently read-or-edited files are re-read, most recently modified first; a file over 5,000 tokens comes back as a path reference rather than content. Invoked skill bodies are re-injected capped at 5,000 tokens per skill and 25,000 tokens total, oldest dropped first.
- **What does not survive is a decision, not a bug.** Rules with `paths:` frontmatter and nested subdirectory CLAUDE.md files load into message history, so compaction summarizes them away with everything else. The docs' advice is to drop the frontmatter or move the rule into the project-root CLAUDE.md.
- **Trigger.** The auto-compact window is how full the context gets before compaction; the default is the model's context limit, and it is settable five ways — `/autocompact 500k`, `autoCompactWindow` in settings, `--autocompact` per launch, `CLAUDE_CODE_AUTO_COMPACT_WINDOW` for scripts, and per subagent. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (1–100) lowers the trigger and cannot raise it: values above the default percentage are ignored ([model-config](https://code.claude.com/docs/en/model-config), [env-vars](https://code.claude.com/docs/en/env-vars)).
- **"Compact Instructions" in CLAUDE.md probably never reaches the compactor.** A fleet measurement (354 runs, CLI 2.1.186) reports the stock template used in 354 of 354 bare `/compact` runs, a CLAUDE.md "compact instructions" section applied 0 times, and an empty `custom_instructions` in the PreCompact hook on auto-trigger. The one working path was pasting a structured block inline after a manual `/compact`, which *supplements* rather than replaces the stock summary ([gist comment](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f)). Third-party, single-vendor, not independently reproduced — read it as medium confidence even though the vendor docs repeat the CLAUDE.md advice.
- **The cache cost is explicit.** Compaction sends a separate request that repeats the system prompt and tools and ends with a summarization instruction. While the cache is warm that request is cheap; after the cache expires, the summarization request reprocesses the whole history uncached, which is why `/compact` costs most on a resumed old session ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Idle compaction.** A conversation left idle past the one-hour cache TTL can be compacted. `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` defaults to 200,000 with a 100,000 floor, and `idleCompaction: false` turns it off (v2.1.290+) ([env-vars](https://code.claude.com/docs/en/env-vars), [prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Hooks can veto.** `PreCompact` exits 2 or returns `decision: block` to block. For a proactive compaction the conversation simply continues uncompacted; for a compaction recovering from a context-limit error, the original API error surfaces instead ([hooks](https://code.claude.com/docs/en/hooks)).
- **Thrashing guard.** If one file or tool output is so large that context refills immediately after each summary, Claude Code stops auto-compacting after a few attempts and shows an error rather than looping ([how-claude-code-works](https://code.claude.com/docs/en/how-claude-code-works)).
- **Manual alternatives to compaction:** `/rewind` then *Summarize from here* or *Summarize up to here*, `/clear` between unrelated tasks, and delegating large reads to a subagent so the content never enters the main window.

### 3. Codex CLI — two compaction paths behind one command

Codex has the widest configuration surface and the only documented local/remote split:

- `model_auto_compact_token_limit` sets the token threshold; unset means the model default. `model_auto_compact_token_limit_scope` chooses whether the threshold counts the whole active context (`total`, the default) or only growth past the carried compaction prefix (`body_after_prefix`). `model_providers.<id>.capabilities.remote_compaction` is `unsupported` for local compaction or `v2` to send compaction triggers through Responses ([config reference](https://learn.chatgpt.com/docs/config-file/config-reference)).
- `compact_prompt` overrides the compaction prompt inline, and `experimental_compact_prompt_file` loads the override from a file — the simplest prompt-override story of any agent here.
- **Local path.** For non-Codex models the CLI summarizes locally with the well-known prompt *"You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task…"*, and prepends a `summary_prefix` ("Another language model started to solve this problem…") when the summary is later replayed ([gist](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f)).
- **Remote path.** For Codex models the CLI calls `responses.compact()`, which returns an AES-encrypted blob with the key on OpenAI's servers. Kangwook Lee's prompt-injection extraction (2 API calls, 35 lines) recovered a server-side compaction prompt and handoff prompt nearly identical to the open-source pair, so at the prompt level the encryption hides nothing. Whether it also compacts tool state differently, or restores it on the way out, was not tested ([kangwooklee.com](https://kangwooklee.com/blogs/codex_context_compaction.html)).
- A third-party reading of `codex-rs/core/src/compact.rs` adds: recent user messages (~20k tokens) kept beside the summary, exponential-backoff retries, a 95% "effective context window" safety margin, and a user-facing warning that multiple compactions reduce accuracy ([gist](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f)). Those source locations were not re-verified against today's `main`.

### 4. OpenCode — the only agent that compacts ahead of time

OpenCode V2 has moved furthest from the summarize-at-the-wall model ([opencode.ai/v2/docs/compaction](https://opencode.ai/v2/docs/compaction/)):

- **Whole conversation in, prompt cache out.** It summarizes the entire current conversation rather than a prefix, so the summary request reuses the normal request's prompt cache where the provider supports it; later compactions update the existing summary with the conversation since that checkpoint.
- **Background compaction** is the distinctive feature. At 85% of the threshold, a summary of the conversation so far starts in the background while the session keeps running; at the threshold the held summary is swapped in and everything since it is kept as-is. Held summaries live in memory and are lost on restart, and the feature is skipped for native compaction, for sessions under about 64k tokens, right after a model switch, and after a provider too-long rejection.
- **Two engines.** `summary` writes the summary with the session model or with `agents.compaction.model`; `native` sends the conversation to the provider's compaction endpoint and gets back an opaque encrypted item. Native is set per provider or per model through `settings.compaction`, model overriding provider.
- **Native checkpoints are not portable.** "An encrypted checkpoint only works with the same provider and model. If you switch models, the session continues from the original conversation instead." That makes Codex's remote path and OpenCode's native mode the same architectural bet with the same failure mode.
- **Storage is not lossy.** Earlier messages remain stored even when they are no longer sent to the model — compaction changes the *request*, not the transcript. That is Pi's choice and the opposite of Claude Code's history replacement.
- **The limits are documented**, including the one everyone else leaves implicit: compaction cannot create room when a request is mostly fixed instructions and tool schemas (128k = 120k instructions + 8k conversation).

### 5. Pi — the most inspectable implementation

Pi documents the algorithm down to function names and data structures, which makes it the reference implementation to read first ([pi.dev/docs/latest/compaction](https://pi.dev/docs/latest/compaction)):

- **Trigger:** `contextTokens > contextWindow - reserveTokens`, with `reserveTokens` defaulting to 16,384 and `keepRecentTokens` to 20,000, both configurable globally or per project. `compaction.modelOverrides` keyed by exact `provider/modelId` lets a 1M-window model take a 400k reserve, so it compacts above 600k while other models keep the 16,384 default.
- **When it checks:** after tools finish and their results are appended, before the next assistant response, inside `prepareNextTurn`; again before a new user prompt; and once more as final-attempt overflow recovery after the run ends.
- **Cut point:** walk backwards through the finalized projection accumulating token estimates until `keepRecentTokens` is reached. The first kept entry id is recorded on a `CompactionEntry` — `{ summary, firstKeptEntryId, tokensBefore, usage, details }`. The parent chain is not rewritten: a compaction entry is appended to the session, so the full history stays on disk and inspectable.
- **Serialization matters.** Messages are flattened to `[User]:`, `[Assistant]:`, `[Assistant tool calls]:`, `[Tool result]:` text specifically so the model does not treat the summarization request as a conversation to continue. Thinking blocks are omitted and tool results are truncated to 2,000 characters, because `read` and `bash` output is the largest contributor to context size.
- **Cumulative file tracking.** Read and modified file lists are extracted from tool calls and carried across successive compactions, so the fifth compaction still knows what the first one touched. Summaries end with `<read-files>` and `<modified-files>` blocks.
- **Branch summarization** is a second mechanism, for `/tree` navigation: find the deepest common ancestor, summarize the abandoned branch, append a `BranchSummaryEntry` at the navigation point. It shares the summary format, minus Critical Context.
- **Extensions own the summary.** `session_before_compact` receives the preparation (messages to summarize, previous summary, file ops, tokensBefore, firstKeptEntryId, resolved settings), a `reason` of `manual` | `threshold` | `overflow`, and `willRetry` — and may cancel or return a summary produced by a different model. `session_compact_failed` pairs attempts with outcomes for telemetry. This is the only agent here where swapping the summarizer is a documented first-class extension point.

### 6. Gemini CLI — percentage-triggered compression under another name

Gemini CLI calls it `/compress` — "Replace the entire chat context with a summary" — and fires automatically at `model.compressionThreshold`, the fraction of context use at which compression triggers, defaulting to 0.5 ([geminicli.com settings](https://geminicli.com/docs/cli/settings/), [iceberglakehouse.com](https://iceberglakehouse.com/posts/2026-03-context-gemini-cli/)). The 0.5 default is an outlier in the compact-early direction: on a 1M window it compresses around 500k, where Pi with defaults compacts around 1M minus 16k and Claude Code compacts at the limit. One caveat worth carrying, because it bites cross-tool habits: for unpaid-tier and Google One users, Gemini CLI was replaced by Antigravity CLI on 2026-06-18 ([dev.to](https://dev.to/gabrielanhaia/compact-or-compress-9-agent-commands-in-claude-code-codex-gemini-cli-and-opencode-58hl)).

### 7. Cursor — compaction as a trained behaviour, not a prompted one

Cursor's own account is the sharpest argument that prompted summarization is the wrong frame ([cursor.com/blog/self-summarization](https://cursor.com/blog/self-summarization)): a harness that "transforms the context to a shorter length" loses critical information. Cursor instead trains Composer with compaction in the loop — a synthetic query asks the model to summarize its own context, the summary plus conversation state (plan state, remaining tasks, number of prior summarizations) becomes the new context, and the final reward covers the tokens in the summary too.

The numbers that matter: against a "highly tuned prompt-based compaction baseline" whose prompt is thousands of tokens and whose output averages over 5,000 tokens, Composer's summary uses a one-line prompt, averages around 1,000 tokens, and "consistently reduces the error from compaction by 50%", while reusing the KV cache.

### 8. Amp — the negative result

Amp's documented position is that there is no automatic compaction: everything in the context window influences output, conversations should stay short and focused, and the agent offers *Handoff* (analyze the current thread against a stated goal and extract into a fresh thread, via a secondary model), *Fork*, *Edit/Restore*, and thread references instead ([gist](https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f), citing ampcode.com/guides/context-management). It records as the control case: same context limit, no compaction, betting that a smaller curated context beats a large summarized one.

### 9. What the command names hide

Compaction is not called the same thing everywhere, and context inspection is not a command everywhere ([dev.to command comparison](https://dev.to/gabrielanhaia/compact-or-compress-9-agent-commands-in-claude-code-codex-gemini-cli-and-opencode-58hl)):

| Job | Claude Code | Codex CLI | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| Compaction command | `/compact` | `/compact` | `/compact` (`/summarize`) | `/compress` |
| See context usage | `/context` | `/status` | no command (`opencode stats` in the shell) | `/stats model` |
| Reset conversation | `/clear` | `/new` or `/clear` | `/new` | `/clear` |

### 10. The axes that actually separate these agents

1. **Where the threshold lives.** Tokens-below-limit (Pi, Codex, OpenCode) survives a model swap with the same budget; fraction-of-window (Gemini, Claude Code's percent override) does not. OpenCode's `buffer` is Pi's `reserveTokens` under another name: 15% of the limit with a 16k floor versus a flat 16,384.
2. **What rides beside the summary.** Everyone keeps a recent tail, clustered in 15k–20k tokens. Pi alone carries cumulative file lists across compactions, the cheapest partial answer to iterative summary drift.
3. **Who the summarizer is.** Same model (the default everywhere), a configurable other model (OpenCode `agents.compaction.model`, Pi via extension), or a server-side service (Codex `codex` models, OpenCode native). Only the server-side option loses both portability and inspectability.
4. **Whether compaction mutates the transcript.** Pi and OpenCode append and keep everything; Claude Code replaces the session history. The difference is invisible until you want to audit why the agent forgot something.
5. **Whether the summary is produced ahead of time.** OpenCode's background pass at 85% is the only never-block-on-summarization design in the field; Claude Code's idle compaction is a weaker version keyed on cache TTL rather than a threshold.
6. **How the request is framed to the model.** Pi flattens messages to text so the summarizer cannot continue the conversation. Codex re-frames the replayed summary with a handoff prefix telling the next model that a previous model did this work. Same problem, opposite mechanisms: one prevents continuation, the other manufactures it.

## Open Questions

- **Does Claude Code's Compact Instructions block in CLAUDE.md reach the compactor?** The vendor docs recommend it; a 354-run fleet measurement says it is applied 0 times. One of the two is wrong, or the measurement predates a fix. Needs a transcript-level check on a current CLI build.
- **What is inside Codex's encrypted compaction blob beyond the prompts?** The injection recovered the prompt text, not whether tool state is compacted or restored differently on the native path.
- **Gemini CLI's summary format and hook surface.** The threshold and the command are documented; the output shape is only reported second-hand.
- **Amp's current state.** The comparison rests on a December 2025 gist quoting Amp's guide; whether Amp has since shipped automatic compaction is unchecked.
- **Does anyone measure summary quality?** Only Cursor publishes a benchmark (50% error reduction against a tuned baseline). The rest ship the mechanism without an evaluation.

## Related

- [DeepSeek Harness vs Pi](./deepseek-harness-vs-pi-compaction.md) — the deep dive on one pair: dsh's output-reserved trigger, model-free pruner, ratio tail and bracketed transaction against pi's fixed reserve, typed cut points and tree entries.
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — the sibling problem: moving context between providers rather than shortening it within one.
- [Pi Coding Agent — Which AGENTS.md Files It Loads](./pi-agents-md-context-discovery.md) — what gets loaded into Pi's window before compaction has anything to do.
- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — the Pi fork whose compaction behaviour the Pi docs govern.
- [Mocking LLM Calls While Developing Pi Extensions](./pi-extension-mock-llm.md) — how to exercise that compaction path without paying a provider.
- [Open-Source Memory for Agents — What to Pick](./open-source-agent-memory.md) — what happens after the window fills: external memory stores versus summarising in place.

## Changelog

- 2026-10-26 — created. Claude Code, Codex CLI, OpenCode V2, Pi, Gemini CLI and Cursor read from vendor documentation; Amp and the Codex local-path internals come from a third-party source-level gist and are labelled as such.
- 2026-10-31 — linked the [DeepSeek Harness vs Pi](./deepseek-harness-vs-pi-compaction.md) deep dive; no findings changed.
