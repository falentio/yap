---
title: T3 Code — Context Handoff When Switching CLI Providers
category: technology
tags: [t3-code, coding-agents, orchestration, context-transfer, provider-abstraction]
status: complete
created: 2026-10-09
updated: 2026-10-09
sources:
  - https://github.com/pingdotgg/t3code
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/provider-switching-and-context.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/context-handoffs.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/orchestrator-mcp-server.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/composer.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/providers-codex.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/providers-claude.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/overview.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/providers.md
confidence: high
---

# T3 Code — Context Handoff When Switching CLI Providers

## TL;DR

- A T3 Code **thread** is not a provider session. The thread's canonical history lives in T3's event-sourced store; each CLI (Codex, Claude, Cursor, Grok, OpenCode, Antigravity, Pi) owns its own native "provider thread" per run. Switching CLI provider = detaching one provider session and re-attaching or creating another ([provider-switching-and-context.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/provider-switching-and-context.md)).
- Context carry is a **hybrid**, decided by `continuationIdentity = {driverKind, continuationKey}`: same driver + same home dir → **native resume** (the CLI resumes its own session, e.g. Codex `thread/resume`, Claude `--resume`); anything else → **portable handoff**, a budgeted text summary injected into the new provider session.
- The portable path is explicit, auditable graph data: a `ContextHandoff` artifact with strategies `delta_since_target_last_seen` / `full_thread_summary` / `manual_context`, capped at 16k tokens / 64k bytes, delivered either natively (Codex `thread/inject_items`) or as a preamble in the user message.
- Delegated subagent tasks carry **no parent context at all** — the child thread's first message is the task prompt verbatim, and cross-provider children are first-class (`canRunCrossProviderChildTask`). Only the *event stream* is normalized across providers, not conversation state.

## Context

Question: how does T3 Code delegate/hand off conversation context when the user changes the CLI provider behind an agent thread? Researched 2026-10-09 against `github.com/pingdotgg/t3code` @ `main`, commit `33806e73555107b8ac8fb18fd15b9dfb87ec6557` (shallow clone under `~/.pi/source`), by crawling the source via a delegated scout and reading the in-repo docs. Note the repo's public docs index omits the `docs/orchestration-v2/` subtree, which is where the authoritative switching spec lives.

## Findings

### 1. The data model: app thread vs. provider thread

- The app owns a **thread** whose runs may span providers. Each run executes against a **provider thread** — the native conversation handle inside the CLI. The app thread is the source of truth for full history; provider threads have *native coverage* (runs the CLI itself saw) and *handoff coverage* (summaries for runs it missed). Example from the spec: runs 1–5 on Codex thread C1, switch to Claude for run 6 creates Claude thread L1 with handoff H1; switching back for run 9 resumes C1 with handoff H2 covering runs 6–8 (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/provider-switching-and-context.md).
- A **ContextHandoff** is typed graph data, not hidden prompt text: `{ transferId, threadId, targetRunId, fromProviderThreadIds, toProviderThreadId, coveredRunOrdinals, strategy, summaryText, status: pending|ready|failed|superseded, createdByProvider }` (same doc). Regeneration supersedes the old handoff rather than mutating it.

### 2. What the switch command actually does

- Two client commands: `thread.model-selection.set` (same instance, new model/options) and `provider.switch` (different instance); the client picks between them by comparing `instanceId` (`packages/shared/src/model.ts:18-25`, contract at `packages/contracts/src/orchestrationV2.ts:2825,3049`).
- Dispatch only rewrites the thread row's `providerInstanceId`/`modelSelection` and emits `thread.provider-switched` plus a `provider-session.detach` effect — reason "Provider or model selection changed." (`apps/server/src/orchestration-v2/Orchestrator.ts:3172-3228,3319-3396`).
- The old session is **detached, not deleted**: `detach` removes the thread from `attachedThreadIds` while keeping credentials and native history (`apps/server/src/orchestration-v2/ProviderSessionManager.ts:2269-2350`, comment at `:2333`). The new session opens lazily at the next `provider-turn.start` via `providerSessions.open({ resumeFromSession: existingSessionProjection, initialNativeThreadId })` (`apps/server/src/orchestration-v2/ProviderTurnStartService.ts:524-546`).

### 3. The hybrid: native reuse vs. portable handoff

The transition policy (`apps/server/src/orchestration-v2/ProviderSessionTransitionPolicy.ts:13-92`) returns one of `reuse | switch_model_in_session | restart_and_resume | create_with_handoff | reject`.

| Dimension | Native resume (`restart_and_resume`) | Delta handoff (`delta_since_target_last_seen`) | Full handoff (`full_thread_summary`) |
|---|---|---|---|
| When | Same driver + same `continuationKey`, prior provider thread usable | Provider returns after other providers ran; only a run range missed | Target thread new, resume failed, settings incompatible, or context stale |
| Native state | Fully kept (CLI's own session, hidden reasoning, tool state) | Kept for that provider's own runs | None — fresh provider thread |
| What the new session sees | Native history + delta summary of the gap | Its native history + delta summary | The whole app-thread summary as context |
| Cost per switch | Lowest — no summarization | One small summary | One full-thread summary |
| Failure mode | Resume failure falls back to full summary (`ProviderTurnStartService.ts:690-735`) | Delta chain too complex → escalate to full | Every switch depends on summary quality |

- Delivery: if the adapter supports `injectHistory` (Codex `thread/inject_items`, `Adapters/CodexAdapterV2.ts:6579-6606`) the summary is injected as native items; otherwise it is rendered into the user prompt as `${context}\n\nUser message:\n${userText}` (`apps/server/src/orchestration-v2/ContextHandoffDelivery.ts:117-150`, `ProviderTurnStartService.ts:1169-1179`). (Literal template from source; escaped for Markdown.)
- Budget and content: `ContextHandoffServiceV2` selects user/assistant messages, command executions, file changes, checkpoints, and prior handoffs under `DEFAULT_HANDOFF_TOKEN_CAP = 16_000` / `HANDOFF_BYTE_CAP = 64_000` (env override `T3CODE_CONTEXT_HANDOFF_TOKEN_CAP`), `compactText` truncating text to 240 chars; omitted history gets a "recover via `t3_thread_read`" pointer (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/context-handoffs.md, `packages/provider-core/src/server/handoffBudget.ts:14-19,227-281`). It explicitly does **not** reconstruct native session state, tool state, or approvals.
- Recommended default per the spec: resume the previous provider thread + delta summary; full summary only on resume failure/incompatibility/staleness. Staleness signals include too many off-provider runs, chained handoffs, incompatible model/mode changes, and rollback conflicts.

### 4. The gate: what counts as "the same provider" for continuation

- `continuationCompatible` requires equal `driverKind` **and** equal `continuationKey`; otherwise `create_with_handoff` (`ProviderSessionTransitionPolicy.ts:48-53`; identity type at `packages/provider-core/src/server/driver.ts:132-145`, default key `${driverKind}:instance:${instanceId}`).
- Codex derives the key from the **shared** home: `codex:home:${sharedHomePath}` (`apps/server/src/provider/Drivers/CodexHomeLayout.ts:44-66,417-422`). This is exactly the user-visible rule in the Codex guide: two accounts sharing one `CODEX_HOME` (second via `Shadow home path` for auth) are switch-compatible mid-thread; a separate `CODEX_HOME` is a different workspace and is not offered (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/providers-codex.md).
- Claude derives the key from the resolved config dir: `claude:home:${resolvedHomePath}` (homePath → inherited `CLAUDE_CONFIG_DIR` → `~/.claude`; `apps/server/src/provider/Drivers/ClaudeHome.ts:56-64`). Hence the Claude guide's "Can I switch Claude accounts in an existing thread? Usually, no" — separate config dirs are separate continuation identities (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/providers-claude.md).
- Server-side, the portable path is gated on adapter capabilities `canConsumeHandoffSummaries` + `acceptsSyntheticUserContext` (`apps/server/src/orchestration-v2/CommandPolicy.ts:327-363`); the client hides the picker for threads lacking `supportsProviderSwitchingViaHandoff` (`packages/client-runtime/src/state/threadWorkflows.ts:90-108`).

### 5. Rewind and "Edit from here"

- Rewind is a **native provider rollback**, not an app replay: `checkpoint.rollback` validates the active provider thread is unchanged, calls `session.rollbackThread`, and marks later runs `rolled_back` (`apps/server/src/orchestration-v2/CheckpointRollbackService.ts:110-353`). Codex uses `thread/revert` (`Adapters/CodexAdapterV2.ts:7181-7247`); Claude resets the native thread id or resumes at a session point (`Adapters/ClaudeAdapterV2.ts:8012-8086`). Gated on `threads.canRollbackThread` + `checkpointing.providerCanRollbackConversation` (`CommandPolicy.ts:306-325`).
- User-visible semantics: removes the message and later conversation from thread *and* provider history; undone only when the provider supports rewind (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/composer.md).
- Gap: the spec says rollback should mark handoffs covering rolled-back runs `superseded` (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/provider-switching-and-context.md "Rollback Interaction"), but no such supersede exists in `CheckpointRollbackService.ts` — only transfers/attempts use `superseded` (`Orchestrator.ts:6299-6308`). Doc/code mismatch, flagged by the scout, not independently re-verified.

### 6. Delegated tasks: subagents carry a prompt, not a context

- `delegate_task` (MCP, server key `t3-code`) dispatches the command `delegated_task.request` with `{ parentThreadId, parentRunId, parentNodeId, task, modelSelection, runtimeMode, interactionMode }` (`apps/server/src/mcp/OrchestratorMcpService.ts:1815-1880`; contract at `packages/contracts/src/orchestrationV2.ts:3002-3017`).
- The child thread is created with **no history**: `historyOrigin: undefined`, lineage `relationshipToParent: "subagent"`, and a single user message whose text is the task prompt (`packages/provider-core/src/server/subagentProjection.ts:42-85`; `Orchestrator.ts:6676-6689`). The `subagent_spawn` ContextTransfer is a lineage pointer with `resolution: null` — a source point, not content (`Orchestrator.ts:6700-6735`). The docs state it plainly: "Parent conversation history is not copied into the child" (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/orchestrator-mcp-server.md).
- Capabilities advertised per provider: `canRunChildTask` / `canRunCrossProviderChildTask` (both = "no constraints"), plus `parentThreadId`, `inheritedProviderInstanceId`, `inheritedModel`, `features.appOwnedSubagents: true` (`OrchestratorMcpService.ts:1770-1814`). A provider can run children when its live instance exposes a V2 `orchestrationAdapter` (same doc, "Provider Support").
- Cross-provider children work through `resolveTarget`: a driver-only target inherits the parent instance if healthy, else the first available candidate; a different provider without an explicit model uses `provider.models[0].slug` (`OrchestratorMcpService.ts:1089-1165`). Because the child gets only the prompt, there is no cross-provider *conversation* normalization to do; what is normalized is the **event stream** every adapter emits — the `ProviderAdapterV2Event` union (`app_thread.created`, `provider_session.updated`, `message.updated`, `turn.terminal`, …) ingested by `ProviderEventIngestor.ts:520-670` (`packages/provider-core/src/server/ProviderAdapter.ts:78-162`). The V1 `ProviderRuntimeIngestion` path named in older docs is retired (`apps/server/src/orchestration-v2/V1ImportBoundary.test.ts:27-33`).
- Results return via `finalizeAppOwnedSubagent` → a `subagent_result` ContextTransfer plus a parent wake; the parent reads them with `task_status`. Grok, which has no native ACP subagents, and registry agents without `session/fork` degrade to orchestrator-owned child threads and portable context — orchestrator policy, not provider tools (https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/orchestration-v2/orchestrator-mcp-server.md).

### 7. Comparison: the three ways context reaches a new provider session

| Dimension | Native resume | Delta handoff | Full-thread handoff |
|---|---|---|---|
| Trigger | Same driver + home, prior thread resumable | Provider returns after a gap of off-provider runs | New provider thread, resume failed, or stale |
| Context source | CLI's own session store + summary of the gap | Own native runs + summary of missed runs | Whole app-thread summary |
| Fidelity | Provider-native continuity (hidden state, tool state) | Native for own runs, lossy summary for the rest | Lossy everywhere by construction |
| Per-switch cost | None (resume only) | One bounded summary | One full bounded summary |
| Delivery vehicle | `initialNativeThreadId` resume | `injectHistory` or prompt preamble | `injectHistory` or prompt preamble |
| Artifact | None needed | `ContextHandoff` (strategy `delta_since_target_last_seen`) | `ContextHandoff` (strategy `full_thread_summary`) |
| Subagent delegation | — | — | Not used: children receive only the task prompt |

## Open Questions

- Does rollback actually supersede handoffs covering rolled-back runs? The spec says yes; the code path was not found. Probe: search `CheckpointRollbackService.ts` for handoff supersede writes at this SHA.
- Two Codex instances with different `Shadow home path` but the same shared home share a `continuationKey` — is that intended for continuation, or only for session visibility? The code keys on the shared home; the guide's dual-account recipe relies on it.
- `canRunCrossProviderChildTask` is computed identically to `canRunChildTask` and appears unconsumed outside tests — is any consumer planned?
- `ProviderEventIngestor.ts:442-518` (`rollBackRewoundRuns`) ingests provider-native rewinds that happen outside T3; how a T3-side handoff interacts with an externally rewound provider thread is undocumented.
- The summarizer that produces handoffs can be the departed provider, the entered provider, or a configured one (`createdByProvider` records provenance); which is configured in practice, and its cost profile, is not covered by the docs read here.

## Related

- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — the Pi driver inside T3's provider list; T3 injects its orchestration MCP into Pi via an RPC extension.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — another event-sourced agent harness in this archive, useful contrast for the command/event/projection model.

## Changelog

- 2026-10-09 — created. Source crawl via delegated scout (clone at `~/.pi/source/github.com-pingdotgg-t3code@main`, SHA `33806e73555107b8ac8fb18fd15b9dfb87ec6557`); docs read via TinyFish fetch.
