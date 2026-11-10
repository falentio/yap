---
title: Open-Source Memory for Agents — What to Pick
category: technology
tags: [agent-memory, mem0, hindsight, graphiti, letta, cognee, basic-memory, locomo, benchmarks]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/mem0ai/mem0
  - https://github.com/vectorize-io/hindsight
  - https://github.com/getzep/graphiti
  - https://github.com/topoteretes/cognee
  - https://github.com/letta-ai/letta
  - https://github.com/supermemoryai/supermemory
  - https://github.com/MemTensor/MemOS
  - https://github.com/EverMind-AI/EverOS
  - https://github.com/basicmachines-co/basic-memory
  - https://github.com/NevaMind-AI/memU
  - https://github.com/thedotmack/claude-mem
  - https://github.com/Mirix-AI/MIRIX
  - https://github.com/MemoriLabs/Memori
  - https://github.com/doobidoo/mcp-memory-service
  - https://github.com/langchain-ai/langmem
  - https://github.com/getzep/zep
  - https://www.getzep.com/blog/announcing-a-new-direction-for-zeps-open-source-strategy/
  - https://github.com/getzep/zep-papers/issues/5
  - https://www.getzep.com/blog/sycophancy-is-a-design-choice/
  - https://arxiv.org/abs/2510.27246
  - https://arxiv.org/abs/2607.21962
  - https://arxiv.org/abs/2507.03724
  - https://arxiv.org/abs/2507.07957
  - https://github.com/mem0ai/memory-benchmarks
  - https://benchmarks.hindsight.vectorize.io/
  - https://www.reddit.com/r/AIMemory/comments/1s1jlnd/serious_flaws_in_two_popular_ai_memory_benchmarks/
confidence: medium
---

# Open-Source Memory for Agents — What to Pick

## TL;DR

- **No single winner. The decision is about where the memory physically lives.** For an agent that already works on a filesystem — a coding agent, a personal assistant over your own notes — plain Markdown under git plus a thin indexer (**basic-memory**, **memU**) beats every vector or graph service on auditability, portability, and cost.
- **For a service you self-host behind a product, three are credible at 2026-10-29:** [Hindsight](https://github.com/vectorize-io/hindsight) (MIT, one container with embedded Postgres, the strongest published long-horizon numbers), [Mem0](https://github.com/mem0ai/mem0) (Apache-2.0, by far the largest integration surface, but its headline scores come from the paid platform, not the OSS SDK), and [Graphiti](https://github.com/getzep/graphiti) (Apache-2.0, the only mature open temporal knowledge graph — and all that is left of Zep's open source).
- **"Best on LoCoMo" is not a buying signal.** The same system scored 84%, then 75.14%, then 94.7% across eighteen months of re-runs and rebuttals, and an independent evaluation shows memory-backend rankings *invert* as conversation history grows ([Spencer 2026](https://arxiv.org/abs/2607.21962)).
- **Check the self-host story before falling in love:** Zep Community Edition was discontinued on 2025-04-02; claude-mem installs into a hosted, paid observer by default; several "open source" quickstarts ask for a vendor API key on line one.

## Context

Asked in this repo on 2026-10-29: *which open-source memory system should an agent use?* The question is ambiguous by design — "memory for agent" spans at least four products (persist a chat, remember a user across sessions, remember a codebase, learn from experience), and the 2026 market prices all four with the same word.

Scope: projects that ship their own memory mechanism under an OSI license and can run without a vendor account. Out of scope: vector databases (Qdrant, Chroma, Milvus), RAG frameworks, and prompt compaction inside a single context window (covered in [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md)).

Method: repository metadata read from the GitHub REST API on 2026-10-29 (stars, license, last release, commits in the trailing 90 days); architecture and benchmark claims read from each project's own docs via TinyFish; benchmark disputes read from the primary filings; one independent evaluation paper read for the horizon effect. No benchmark was re-run locally, so every accuracy number below is someone else's.

## Findings

### Two questions decide the shortlist

1. **Must the memory survive changing the agent, model, or vendor?** If yes, the store has to be human-readable and rebuildable from files. Every service below stores memory in a database you cannot read at a glance, and several store it in *their* database.
2. **Does the agent need to know what was true on a date?** "Alice lives in Berlin" that later becomes "Alice lives in Lisbon" is a temporal problem. Only the graph family (Graphiti, Cognee, Zep) models invalidation explicitly; the rest overwrite or accumulate, and the accumulation variant quietly feeds both facts back into the prompt.

### Wide comparison — self-hostable memory services (2026-10-29)

| Dimension | Mem0 | Hindsight | Graphiti | Cognee | Letta | Supermemory | MemOS |
|---|---|---|---|---|---|---|---|
| License | Apache-2.0 | MIT | Apache-2.0 | Apache-2.0 | Apache-2.0 | MIT | Apache-2.0 |
| Stars | 68.0k | 56.0k | 32.3k | 32.9k | 25.3k | 31.5k | 12.2k |
| Last release | ts-v3.3.1, 2026-09-25 | untagged, pushed 2026-10-29 | v0.31.2, 2026-10-20 | v1.6.6rc1, 2026-10-23 | 0.16.8, 2026-05-14 | server-v0.0.9, 2026-10-12 | v2.0.34, 2026-09-23 |
| Commits / 90 d | 100+ | daily | 100+ | 100+ | 9 | 100+ | 100+ |
| Store | Qdrant or pgvector + history | embedded Postgres | Neo4j, FalkorDB, Kuzu | Postgres + pgvector or Kuzu | Postgres + pgvector | embedded graph engine | Neo4j + Qdrant |
| Memory model | facts extracted at write | world fact / experience / observation / mental model | bi-temporal entity graph | graph + vector + ontology | agent-edited memory blocks | facts + user profile + graph | L1 trace / L2 policy / L3 world |
| Retrieval | semantic + keyword + graph, single pass | 4 strategies in parallel, RRF + rerank | hybrid + graph traversal | graph completion | agent chooses via tools | hybrid search + profile | scheduler-driven, mixed |
| Self-host cost | server + Qdrant + LLM key | one container + LLM key | graph DB + LLM key | graph DB + Postgres | Postgres + LLM key | one container | Neo4j + Qdrant + Redis |
| MCP | yes | yes | yes | yes | no first-party server | yes | yes |
| Headline claim | 92.5 LoCoMo, 94.4 LongMemEval | SOTA on LongMemEval, "most accurate ever tested" | temporal correctness | "open-source AI memory platform" | memory-first agent runtime | entire context stack in one API | +43.7% vs OpenAI memory |
| Main risk | OSS is not the build that scored | young, vendor-reported benchmarks | you operate a graph DB | release-candidate API churn | development moved to letta-code | engine internals thinly documented | heavy infra, cloud-first framing |

### Wide comparison — file-first and smaller runtimes (2026-10-29)

| Dimension | basic-memory | memU | claude-mem | EverOS | MIRIX | Memori | mcp-memory-service |
|---|---|---|---|---|---|---|---|
| License | AGPL-3.0 | Apache-2.0 (badge; LICENSE.txt unclassified) | Apache-2.0 | Apache-2.0 | Apache-2.0 | Apache-2.0 (GitHub reports "Other") | Apache-2.0 |
| Stars | 4.4k | 14.6k | 104.3k | 13.7k | 3.5k | 17.2k | 2.1k |
| Last release | v0.24.1, 2026-10-23 | v1.5.1, 2026-03-23 | v15.5.0, 2026-10-29 | v1.5.1, 2026-10-22 | none | v3.3.6, 2026-05-28 | v12.4.0, 2026-10-26 |
| Commits / 90 d | 100+ | 54 | 100+ | 82 | 7 | 3 | 100+ |
| Store | Markdown files + SQLite index | SQLite or Postgres | SQLite + Chroma | SQLite | Postgres | your own SQL | SQLite |
| Shape | notes graph, Obsidian-compatible | personal wiki | tool-call observations | memory fabric + plugin ecosystem | six typed memories, screen capture | SQL-native memory over existing tables | MCP server with a dashboard |
| Fit | agent over your own vault | per-user wiki | automatic capture in coding agents | integration-heavy products | personal assistant | SQL-first apps | quick MCP memory |

### Architecture families — the five shapes

**Extract-then-store (Mem0, Memori, Supermemory).** An LLM reads the turn, extracts facts, and writes them into a vector (optionally graph) store; retrieval is a ranked query. Cheap at read time, lossy at write time — whatever the extractor dropped is gone. Mem0's 2026 algorithm is ADD-only: one LLM call, no UPDATE or DELETE, memories accumulate ([README](https://github.com/mem0ai/mem0)). That trades contradiction handling for write simplicity.

**Temporal knowledge graph (Graphiti, Cognee, Zep).** Edges carry validity intervals and a superseded fact is invalidated rather than deleted, so "what was true in June" is answerable ([Graphiti paper, arXiv 2501.13956](https://github.com/getzep/graphiti)). The price is operational: you run Neo4j, FalkorDB, or Kuzu, and pay for entity extraction and resolution on every ingest.

**Memory as agent state (Letta, MIRIX).** Descended from MemGPT: the agent owns editable memory blocks and calls tools to rewrite its own context, so memory *is* the runtime rather than a library beside it ([Letta](https://github.com/letta-ai/letta)). MIRIX extends the idea to six typed memories plus continuous screen capture, and credits Letta's framework as the foundation of its memory system ([MIRIX](https://github.com/Mirix-AI/MIRIX), [arXiv 2507.07957](https://arxiv.org/abs/2507.07957)).

**Tiered memory OS (Hindsight, MemOS, EverOS).** Hindsight splits world facts from agent experiences, then consolidates both into evidence-backed observations and mental models, retrieved by running vector, BM25, graph, and temporal search in parallel and fusing with reciprocal rank ([README](https://github.com/vectorize-io/hindsight)). MemOS formalises the same instinct as L1 traces to L2 policies to an L3 world model ([arXiv 2507.03724](https://arxiv.org/abs/2507.03724)).

**File-first (basic-memory, memU, claude-mem, plain AGENTS.md).** The durable store is text a human reads and edits; any index is derived and rebuildable. basic-memory keeps a knowledge graph over Markdown files with wikilinks and frontmatter and rebuilds a SQLite index with hybrid full-text plus embeddings, so the notes stay usable in Obsidian ([README](https://github.com/basicmachines-co/basic-memory)). memU compresses the idea to a per-user LLM wiki whose core memory logic is, by its own count, 500 lines ([README](https://github.com/NevaMind-AI/memU)).

### Benchmarks: why "best score" is not an answer

**The LoCoMo saga is a documented fight.** Zep reported 84% on LoCoMo; Mem0's CTO then filed [getzep/zep-papers#5](https://github.com/getzep/zep-papers/issues/5) (2025-05-08) claiming the denominator wrongly included excluded adversarial questions, that the correct figure was **58.44%**, and that Zep had edited Mem0's system prompt to favour itself. Zep re-ran and published **75.14%** while arguing Mem0's harness misconfigured Zep's search settings. By 2026 Zep reports **94.7% LoCoMo at 155 ms p95** — while arguing LoCoMo is the wrong benchmark to optimise at all ([Zep, "Sycophancy is a design choice", 2026-06-11](https://www.getzep.com/blog/sycophancy-is-a-design-choice/)).

**Vendors measure builds you cannot download.** Mem0's README prints 92.5 LoCoMo, 94.4 LongMemEval, 64.1 BEAM-1M, 48.6 BEAM-10M and then states the quiet part: *"Scores reflect Mem0's managed platform, which includes proprietary optimizations not available in the open-source SDK; open-source users should expect directionally similar gains but not identical numbers"* ([README](https://github.com/mem0ai/mem0)). The evaluation harness is open ([mem0ai/memory-benchmarks](https://github.com/mem0ai/memory-benchmarks)); the algorithm that produced the number is not.

**The answer key is dirty.** One audit reports 99 score-corrupting errors in 1,540 LoCoMo questions (6.4%) and an LLM judge that accepted up to 63% of intentionally wrong answers ([r/AIMemory audit](https://www.reddit.com/r/AIMemory/comments/1s1jlnd/serious_flaws_in_two_popular_ai_memory_benchmarks/)); the 2026 longitudinal-evaluation paper opens by noting that standard benchmarks "generate conversations first and extract answer keys afterwards — with documented label-error and contamination problems" ([arXiv 2607.21962](https://arxiv.org/abs/2607.21962)).

**Rankings invert with history length.** That same paper benchmarks five architectures at two horizons and finds "the budgeted curated-map memory that leads at three weeks loses recall of evicted content by nine weeks (96% to 72%), while a provenance-typed graph rises to 90%". A winner at three weeks is a loser at nine; history length is the variable no vendor table controls.

**The current frontier is BEAM** — 100 conversations, 2,000 validated questions, 100K to 10M tokens ([arXiv 2510.27246](https://arxiv.org/abs/2510.27246), ICLR 2026). Hindsight, Mem0, and at least two commercial entrants all claim SOTA on it. Hindsight publishes a live scoreboard and says its numbers were reproduced by Virginia Tech's Sanghani Center and The Washington Post, with "other scores self-reported by software vendors" ([benchmarks.hindsight.vectorize.io](https://benchmarks.hindsight.vectorize.io/), [README](https://github.com/vectorize-io/hindsight)) — a claim, worth taking as a claim.

Practical consequence: build a 50-question eval out of *your* history, with the questions you actually ask, and re-run it when you switch. That costs an afternoon and beats reading another leaderboard.

### Licensing and open-core traps

- **Zep is not open source anymore.** [Zep Community Edition was discontinued 2025-04-02](https://www.getzep.com/blog/announcing-a-new-direction-for-zeps-open-source-strategy/); getzep/zep now self-describes as "Zep Cloud: Examples & Integrations" and its README states the repository "is **not** Zep's product or service". Self-hosting means running Graphiti yourself with your own graph database.
- **Mem0's license is genuinely Apache-2.0** for the SDK and server; the open-core line runs through the algorithm, not the license.
- **claude-mem is the most-starred project here (104.3k) and defaults to paid hosting.** Its installer signs you in for a 30-day trial of the hosted "CMEM Pro" observer, then memory "automatically falls back to your Anthropic plan unless you subscribe"; the local observer is opt-in with --provider host ([README](https://github.com/thedotmack/claude-mem)).
- **basic-memory is AGPL-3.0** — fine locally, a compliance question if you embed it in a network service. It also ships a paid hosted tier on the same engine.
- **Two projects read as "Other" in license scanners.** Memori's LICENSE is Apache-2.0 with the boilerplate brackets left unfilled ("Copyright [2025] [Memori Team]"), and memU's LICENSE.txt is unclassified by GitHub while the README badges Apache-2.0. Read the file before a legal review does.
- **EverMind-AI/EverMemOS now redirects to EverMind-AI/EverOS** — third-party write-ups and the archived pre-1.0 plugin still use the old name.
- **memodb-io/memobase is dormant:** zero commits in 90 days, last push 2026-01-11. It still appears in 2026 "best memory" lists.

### The comparison-post space is an ad market

Searching "best agent memory 2026" returns roughly a dozen domains — hydradb, mnemoverse, parametric-memory, weavai, omegamax, caura, vectorize, stork, contextium — each publishing the same table with itself ranked first. A few are credible projects writing marketing (Vectorize owns Hindsight); most are not. Rule adopted here: a claim counts only if it names a repo, a commit, and a harness, or comes from the project's own documentation. Stars are popularity, not quality — this category added three 30k-plus projects inside a year.

### Recommendation

| Situation | Pick | Why |
|---|---|---|
| Coding agent on a repo you own | Markdown + git; add [basic-memory](https://github.com/basicmachines-co/basic-memory) only when you need search | Store is diffable and reviewable, survives vendor death; AGPL is the trade |
| Personal assistant across sessions, self-hosted | [memU](https://github.com/NevaMind-AI/memU) or [claude-mem](https://github.com/thedotmack/claude-mem) with --provider host | Wiki-shaped memory you can read; claude-mem buys automatic capture at the cost of a hosted default |
| App you ship, self-hosted memory service | [Hindsight](https://github.com/vectorize-io/hindsight) first, [Mem0](https://github.com/mem0ai/mem0) if integration breadth matters | One-container install versus the largest SDK and MCP surface; MIT and Apache respectively |
| Facts that change over time | [Graphiti](https://github.com/getzep/graphiti) | Bi-temporal invalidation; nothing else open does it as maturely |
| Agent runtime where memory is the product | [Letta](https://github.com/letta-ai/letta) | Memory blocks the agent edits itself; watch the slowing main repo |
| Reproducing a paper's numbers | [MemOS](https://github.com/MemTensor/MemOS), [EverOS](https://github.com/EverMind-AI/EverOS) | Papers plus code, heavier infra, cloud-first framing |

**For this repository specifically:** it is already the file-first design — research/, notes/, sources/, front matter, category indexes, git history. Adding a memory service would duplicate that store behind a database the next agent cannot read. The gap worth closing is retrieval over the Markdown (grep plus the indexes), which a 200-line FTS5 indexer or basic-memory solves, and which no memory service solves better.

## Open Questions

- Hindsight's independent reproduction (Virginia Tech Sanghani Center, The Washington Post) is stated in its README but no public report is linked; unverified here.
- No head-to-head exists between Hindsight, Mem0, and Graphiti on one harness with one model — every published comparison has a vendor as an author.
- Letta's main repository dropped to 9 commits in 90 days, last release 2026-05-14, while letta-code is pushed daily; whether the server stays open-source-first is unclear.
- AGPL exposure for basic-memory inside a network product: not tested, as far as this research found.
- BEAM at 10M tokens: Mem0 reports 48.6, and the SOTA claims there are young enough to be noise.

## Related
- [Agent Memory — How Grok Bot, OpenMausBot, and OpenBot Store, Retrieve, and Forget](./agent-memory-grok-bot-openmausbot-openbot.md) — three media for one job: an opaque store, a Markdown notebook with a four-stage model pipeline, and SQLite rows split into an 8 KB essential block and tool-searched entries.

- [Grok Bot Memory — What Survives a Single Long-Lived Chat](./grok-bot-memory.md)
- [Context Compaction Across Coding Agents](./coding-agent-compaction-comparison.md)
- [Features Worth Porting to Pi as Extensions](./coding-agent-features-to-port-to-pi-extensions.md)
- [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md)
- [The Bot as a Primitive](./bot-primitive.md)

## Changelog

- 2026-10-29 — created. Repository metadata (stars, license, last release, 90-day commit counts) read from the GitHub REST API on 2026-10-29; content and benchmark claims read from project docs, the LoCoMo dispute filings, and two arXiv papers via TinyFish. No benchmark was re-run; confidence is medium because the vendor numbers are disputed, not because the metadata is.
