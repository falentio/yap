---
title: Mocking LLM Calls While Developing Pi Extensions
category: technology
tags: [pi, extensions, testing, mock, llm, compaction]
status: complete
created: 2026-10-27
updated: 2026-10-29
sources:
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/src/providers/faux.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/src/compat.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/src/api/openai-completions.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/test/fetch-option.test.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/test/pi-messages.test.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/coding-agent/src/core/compaction/compaction.ts
  - https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/coding-agent/test/suite/harness.ts
  - https://www.npmjs.com/package/mock-openai-api
  - https://www.npmjs.com/package/msw
  - https://www.npmjs.com/package/nock
confidence: high
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/ai/src/providers/faux.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/ai/src/compat.ts
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/ai/package.json
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/ai/README.md
---

# Mocking LLM Calls While Developing Pi Extensions

## TL;DR

- Pi ships the fake you want: `fauxProvider` / `registerFauxProvider` in `@earendil-works/pi-ai` return scripted assistant messages in-process, with no HTTP and no server. Pi's own end-to-end tests use it ([harness.ts](https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/coding-agent/test/suite/harness.ts)).
- If you need the real wire path — SSE parsing, tool-call deltas, aborts, retries — point a provider's `baseUrl` at a local OpenAI-compatible fake. Pi's own tests do exactly this with a `node:http` server on an ephemeral loopback port ([pi-messages.test.ts](https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/test/pi-messages.test.ts)).
- Both routes drive the real code: compaction is not one model call, and a fake answers it. [`./prototypes/pi-mock-llm`](../../prototypes/pi-mock-llm/README.md) reproduces a full `pi` session plus `/compact` at $0: 834 → 241 estimated tokens over HTTP, 587 → 132 in-process.
- Use llama.cpp or Ollama when you need a real summary to judge quality; use a fake when you need to assert behavior.

## Context

Developing a pi extension that calls a model — custom compaction, a summarizer, an advisor tool — otherwise means paying for tokens on every iteration, and getting a different answer each run. The question: is there an HTTP mock that removes the model from the loop?

Yes, at three different seams, and the choice depends on which layer you need to exercise.

## How an extension reaches a model

Every extension path funnels through pi's provider registry, so one fake provider covers all of them:

| Path | Who calls the model | Seen in |
|------|---------------------|---------|
| `complete()` / `stream()` from `@earendil-works/pi-ai/compat` | the extension | `examples/extensions/custom-compaction.ts` |
| `ctx.compact()` | pi core | `examples/extensions/trigger-compact.ts` |
| `pi.registerProvider(...)` | the provider you define | `docs/custom-provider.md` |

An extension resolves a model with `ctx.modelRegistry.find(provider, id)`, gets auth with `ctx.modelRegistry.getApiKeyAndHeaders(model)`, then hands both to pi-ai. The model record carries `provider`, `baseUrl`, `api`, and `compat`; the adapter chosen by `api` (`openai-completions`, `anthropic-messages`, …) does the HTTP. Overriding `baseUrl` therefore redirects every extension call to your fake, with no extension code changed.

## Path A — in-process faux provider (start here)

### Where it lives (pi-ai 1.4.0)

| What | Path |
| --- | --- |
| implementation — one file, nothing else | `packages/ai/src/providers/faux.ts` |
| `fauxProvider()` | `faux.ts:709`, returns a `FauxProviderHandle` (`faux.ts:147`) |
| `fauxText` / `fauxThinking` / `fauxToolCall` | `faux.ts:55,59,63` |
| `fauxAssistantMessage()` | `faux.ts:79` |
| shared core behind both entry points | `createFauxCore()` `faux.ts:459` |
| `registerFauxProvider()` | **`packages/ai/src/compat.ts:162`** — not in `faux.ts` |

Three import paths, and they are not interchangeable:

```ts
import { fauxProvider, fauxAssistantMessage } from "@earendil-works/pi-ai";                  // root barrel
import { fauxProvider, fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";  // wildcard subpath
import { registerFauxProvider } from "@earendil-works/pi-ai/compat";                       // legacy registry
```

The details that bite: `./providers/faux` resolves only through the `"./providers/*"` wildcard
(`packages/ai/package.json:26-29`); the root barrel re-exports the module wholesale
(`src/index.ts:35`); and `registerFauxProvider` is deliberately kept *out* of the root
(`src/index.ts:5-7`), so `/compat` is a strict superset of `.` for faux. The README publishes the
migration mapping `registerFauxProvider()` → `fauxProvider()` + `models.setProvider()`
(`README.md:1903`).

Nothing else in the monorepo uses it — zero references in `packages/coding-agent` and
`packages/agent` — so it is a testing surface, not a runtime dependency. Path and API are unchanged
since 0.83; the changes since are additive (deferred responses in 0.84.0, partial tool-call argument
streaming in Unreleased). The links at the top of this file point at the pre-rename `pi-mono` repo;
the current one is `earendil-works/pi`.

`@earendil-works/pi-ai` exposes the faux builder from the package root and from the `./providers/faux` wildcard; `registerFauxProvider` comes only from `compat`. The surface:

| Export | Role |
|--------|------|
| `fauxProvider(options)` | standalone `Provider` + models, for explicit `Models` collections |
| `registerFauxProvider(options)` | registers the stream in the global API-provider registry, returns `setResponses`/`unregister` |
| `fauxAssistantMessage(content, options)` | builds a scripted message with `stopReason`/`errorMessage` |
| `fauxText` / `fauxThinking` / `fauxToolCall` | content blocks: text, thinking, tool call |
| `setResponses` / `appendResponses` | a **queue**; one entry is popped per model call |

Registering it inside an extension is four lines:

```typescript
const faux = fauxProvider({ provider: "faux", models: [{ id: "faux-1", name: "Faux 1" }] });
faux.setResponses(Array.from({ length: 64 }, () => respond)); // one per model call
pi.registerProvider(faux.provider);
```

The queue is the main trap: the 65th call fails with `No more faux responses queued`. Either queue enough entries or re-append on a lifecycle hook. `setResponses` also accepts a factory `(context, options, state, model) => AssistantMessage`, which is how you make replies depend on the prompt without writing a server.

What the faux provider does not exercise: SSE chunk parsing, HTTP headers and auth, retry/backoff, or the OpenAI SDK's error shapes. Those live below it.

## Path B — local HTTP mock (the wire path)

Pi's adapters call the official SDKs, so a mock must speak the real chunk format. For `openai-completions` the adapter consumes `client.chat.completions.create({ stream: true })` and reads `chunk.id`, `chunk.usage`, `choices[0].delta.{content,reasoning_content,tool_calls}`, and `choices[0].finish_reason` ([openai-completions.ts](https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/src/api/openai-completions.ts)). In practice that means:

| Requirement | Detail |
|-------------|--------|
| Route | `POST /v1/chat/completions`; add `GET /v1/models` for async model discovery |
| Framing | `data: <json>\n\n` per event, terminated by `data: [DONE]\n\n` |
| Role chunk first | `choices[0].delta: { role: "assistant" }` |
| Text | `delta.content` string fragments |
| Tool calls | `delta.tool_calls[{ index, id, function: { name, arguments } }]`, arguments streamed as JSON fragments, `finish_reason: "tool_calls"` |
| Usage | a final chunk with `choices: []` and `usage.prompt_tokens` / `completion_tokens` / `prompt_tokens_details.cached_tokens` |
| Errors | HTTP status + `{ error: { message } }`; pi's overflow recovery matches known `errorMessage` phrases |

Two lighter seams exist if a socket is unwanted:

| Seam | What stays real | What is faked |
|------|-----------------|---------------|
| `options.fetch` | the whole adapter, including SSE parsing | the `Response` object ([fetch-option.test.ts](https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/test/fetch-option.test.ts)) |
| `streamSimple` override | nothing | the entire provider (`docs/custom-provider.md`) |

The Anthropic path is different: the adapter builds an Anthropic SDK client from `model.baseUrl` and the tests stub the SDK `client` object instead ([anthropic-messages](https://github.com/earendil-works/pi-mono/blob/db14038bd847/packages/ai/src/api/anthropic-messages.ts)). A single mock server would need a second route set to cover it.

## Verified: real compaction against a fake

[`./prototypes/pi-mock-llm`](../../prototypes/pi-mock-llm/README.md) is a 150-line, zero-dependency server plus a provider extension and an RPC driver. `./run.sh` output on 2026-10-27, pi 0.83.0:

```text
== HTTP mock ==
turn ok: Tell me a story about a lighthouse keeper.
turn ok: Continue the story, add a storm.
turn ok: Continue again, describe the morning.
compact ok: true
summary: ## Summary - Goal: develop a pi compaction extension against a fake model. ...
tokensBefore: 834 -> estimatedTokensAfter: 241
== in-process faux provider ==
compact ok: true
summary: ... Fake model wrote this summary in-process.
tokensBefore: 587 -> estimatedTokensAfter: 132
== model requests captured: 5 ==
```

The captured log shows why a mock earns its place: compaction produced **two** requests — the main summarization prompt wrapped in `<conversation>…</conversation>`, then a turn-prefix summary for the split turn. That second request is invisible from the extension API and easy to miss when testing against a real model, where it just costs money.

## Ready-made servers

There is no pi-specific HTTP mock published. General-purpose options exist; all are verified to exist in their registry on 2026-10-27:

| Package | Version | Description (registry) |
|---------|---------|------------------------|
| [`mock-openai-api`](https://www.npmjs.com/package/mock-openai-api) | 1.0.3 | "A mock OpenAI Compatible Provider API server" (TypeScript, zerob13) |
| [`msw`](https://www.npmjs.com/package/msw) | 3.0.3 | request interception for Node and the browser |
| [`nock`](https://www.npmjs.com/package/nock) | 15.0.5 | HTTP interception and expectations for Node |
| `@pollyjs/adapter-node-http` | 6.0.6 | record/replay for Node HTTP |

Caveats, all `[unverified]` without reading each package's source:

- `mock-openai-api` advertises the right API shape, but whether it emits tool-call deltas, a usage chunk, and `[DONE]` exactly as the OpenAI SDK expects is untested here.
- `msw` and `nock` intercept transport, not LLM semantics: you still hand-write the chunk sequence. They are useful for asserting *what pi sent*, less so for replaying a scenario.
- None of them know pi's provider quirks (`compat` flags, thinking formats, cache-control markers), so a recorded fixture can pass while the real provider fails.

For a pi extension the in-repo fake wins on setup and on control: no dependency, no fixture format, and the reply logic sits next to the test.

## Path C — a real model for free

When the summary's *quality* is the thing under test, a fake cannot help. Pi ships first-class support for the llama.cpp router (`docs/llama-cpp.md`):

```bash
llama-server --models-dir ~/models --no-models-autoload --jinja --host 127.0.0.1 --port 8080 -ngl 999 -c 32768
/login llama.cpp     # or LLAMA_BASE_URL=http://127.0.0.1:8080
```

Cost is compute, not tokens; output is still nondeterministic, so use it for judging summaries, not for assertions.

## Comparison

| Dimension | Faux provider | Loopback HTTP mock | `mock-openai-api` | `msw` / `nock` | llama.cpp / Ollama |
|-----------|---------------|--------------------|-------------------|----------------|--------------------|
| Seam | `streamSimple` | HTTP + SDK | HTTP | transport | real server |
| Wire fidelity | none | full for one API | API-shaped `[unverified]` | whatever you write | full |
| Determinism | exact | exact | scripted | scripted | model-dependent |
| Tool calls | `fauxToolCall` | JSON deltas | `[unverified]` | fixture-defined | real |
| Setup | one import | ~150 lines | npm package | npm package | GPU + GGUF |
| Cost | $0 | $0 | $0 | $0 | $0 + compute |
| Catches adapter bugs | no | yes | likely | yes | yes |
| Best for | extension logic, compaction | provider/stream work | quick manual poking | request assertions | summary quality |

## Gotchas found while building

1. **`keepRecentTokens` gates compaction before the model is called.** Default is 20 000, so a three-turn session reports `Nothing to compact (session too small)` (`agent-session.js`, `compaction.js:537` in the 0.83.0 build). Set `{"compaction":{"keepRecentTokens":100,"reserveTokens":100}}` in the project's `.pi/settings.json`.
2. **Project settings load from pi's working directory.** Spawning pi from the extension's folder silently ignores the fixture project's settings; the driver must set `cwd`.
3. **Print mode aborts compaction.** `pi -p "/compact"` starts compaction and then tears the session down — the probe logged `Compaction cancelled` 57 ms later. RPC mode keeps the session alive and exposes a native `{"type":"compact"}` command (`docs/rpc.md`).
4. **Compaction is a separate request shape.** The summarizer receives a fresh prompt with `<conversation>` markup, not the live message list, so matching a mock rule against "the conversation" must scan the wrapped text.
5. **One faux response per call.** The queue, not the model, decides when a session dies; the failure is `No more faux responses queued`, not a network error.
6. **The mock script loads once.** Editing `script.json` under a running server changes nothing; restart it.

## Open Questions

- Whether `pi.registerProvider(faux.provider)` behaves identically for `anthropic-messages` and `google-generative-ai` models. Only the OpenAI-compatible stream path was exercised here.
- Whether `mock-openai-api` emits a spec-complete usage chunk and tool-call deltas. Its README was not read; the registry description was.
- Whether `options.fetch` is honored by every adapter. Pi's own test file enumerates Anthropic, OpenAI Completions/Responses, Azure, Mistral, and Codex, and notes Google rejects it.

## Related

- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md)
- [Features Worth Porting to Pi as Extensions](./coding-agent-features-to-port-to-pi-extensions.md)
- [Pi Coding Agent — Which AGENTS.md Files It Loads](./pi-agents-md-context-discovery.md)

## Changelog

- 2026-10-29 — added §"Where it lives (pi-ai 1.4.0)": exact paths (`providers/faux.ts`, `compat.ts:162` for `registerFauxProvider`), the three import paths and why they differ, and the confirmation that nothing outside pi-ai uses it. Corrected the stale `dist/index.d.ts:23` pointer.

- 2026-10-27 — created. TinyFish was unavailable (stored OAuth access token expired; the refresh token was rejected with `invalid_grant`), so third-party versions come from `npm view` against the npm registry, and every pi claim was read from the local 0.83.0 install or the pi-mono checkout pinned at `db14038bd847`. The registry-sourced feature cells are marked `[unverified]` and should be re-checked through TinyFish once re-authenticated.
