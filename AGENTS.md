# AGENTS.md

Operating rules for AI agents (and humans) working in the **yap** repository.

This repo is a **research and knowledge archive**. Its primary product is
durable, well-organized Markdown. Code is secondary and exists only to support
research when unavoidable.

---

## 1. Prime Directive — Research Becomes Markdown

> **Any research, information gathering, investigation, or discovery MUST be
> persisted as a Markdown file in this repository.**

This applies to:

- Web searches, doc lookups, article/paper reads, library evaluations.
- API/library exploration, benchmarks, experiments, and their results.
- Comparisons, decision analyses, and recommendations.
- Answers to non-trivial questions asked in this repo.
- Findings from debugging or reverse-engineering a third-party system.

### Non-negotiable rules

1. **No ephemeral research.** If you looked it up, you write it down. A chat
   reply is not a deliverable; the Markdown file is.
2. **Write the file in the same turn as the research.** Do not defer, batch
   "later", or promise to write it after further work. Create/update the file
   before ending the turn.
3. **One topic = one file.** Do not append unrelated findings to an existing
   file. Create a new file and link it (see §5).
4. **Cite every claim.** Every non-obvious fact, number, or quote needs an
   inline source link. Uncited claims must be labeled `[unverified]`.
5. **Date everything.** Use absolute dates (`2026-02-14`), never "today" or
   "recently".
6. **Record the negative result too.** "X does not work / is deprecated / costs
   too much" is valuable research. Write it down.
7. **Update over duplicate.** If research on a topic already exists, extend or
   correct it (and bump `updated:`) instead of creating a near-duplicate. Note
   the correction in the `## Changelog` section.
8. **Search before you research.** Before starting, grep this repo for the
   topic. If prior work exists, build on it.

If a research task is requested but no file is produced, the task is
**incomplete**, regardless of how good the chat answer was.

---

## 2. External Research — TinyFish Mandate

> **All external information gathering MUST go through TinyFish.** Use
> `mcp__tinyfish__search` to discover sources and `mcp__tinyfish__fetch_content`
> to read them. Do not reach for other web tooling first.

This applies whenever information lives outside this repository: web pages,
news, docs, pricing pages, product pages, articles, papers, and current facts.

### Required tools

| Need | Tool |
|------|------|
| Discover sources, answer "what/which/who", find URLs | `mcp__tinyfish__search` |
| Read, summarize, or extract content from URL(s) | `mcp__tinyfish__fetch_content` |
| Read a project's internals (open-source source code) | scout subagent → cloner (below) |

### Rules

1. **Search with TinyFish first.** Any question about public, current, or
   external facts starts with `mcp__tinyfish__search` — even when the answer
   seems known, and even when the user does not say "search".
2. **Read with TinyFish.** Once a URL is known, use
   `mcp__tinyfish__fetch_content` to extract it. Prefer it over fetching the
   page by any other means.
3. **Pass `purpose`.** Always include a short `purpose` describing why the
   search/fetch is being run, so results rank against the real intent.
4. **Batch fetches.** Fetch up to 10 URLs in a single
   `mcp__tinyfish__fetch_content` call when comparing sources.
5. **Scope precisely.** Use `domain_type`, `include_domains`/`exclude_domains`,
   `after_date`/`before_date`, and `location` to keep results on-topic and
   fresh rather than sifting noisy output.
6. **Fallback is a last resort.** Only if TinyFish is unavailable or fails may
   another tool (native web search, `curl`, HTTP, browser automation) be used.
   When that happens, **state the fallback and the reason** in the research
   file's `## Changelog`, and treat the result as `confidence: low` until
   re-verified through TinyFish.
7. **Prohibited as first choice:** native WebSearch/WebFetch, `curl`/`wget`,
   raw HTTP requests, headless-browser automation, and hand-written scrapers.
8. **Every fetched URL is a citation.** Put URLs returned by TinyFish into the
   file's `sources:` front matter and inline, per §1 rule 4. Material worth
   keeping verbatim goes to `sources/<origin>/` (see §3) and is linked.

If a search or fetch was performed but its URLs and findings are not captured
in the Markdown file, the research is incomplete.

### Reading source code — a scout spawns the cloner

Reading a project's **internals** means reading its source, which TinyFish does
not serve. Never crawl a codebase in this context: a crawl is file reads and
grep output, and it crowds the window the Markdown file needs. Delegate a
**scout**, and let the scout spawn a **cloner**:

```text
A: this agent [1]
└── spawn S: scout  ← delegate_task; A never crawls [1a]
    ├── S spawns C: cloner  ← "use the library-source skill, do npm zod@4.0.7" [1a1]
    │   └── C: check ~/.pi/source → clone shallow if absent → return path, repo, ref, sha [1a1a]
    └── S crawls  ← reads what C returned [1a2]
```

- **The scout reports; it does not dump.** Ask it for the answer, findings
  anchored to `path:line` with a status, gaps with a probe, and the cloner's
  `source` block. No file contents, grep output, or directory listings.
- **The cloner owns the checkout.** It resolves the repo and ref, reuses the
  `~/.pi/source/<slug>` checkout when present, and clones shallow when absent.
  Do not clone by hand, and never clone into `yap/`.
- **Read the clone, not the dependency's build artifact.** `node_modules`,
  `target`, `vendor`, `.venv`, and the cargo registry hold transformed,
  deduped, or minified copies — the wrong surface. Source lands at
  `~/.pi/source`, at the path the cloner returns.
- **Pin the revision.** The cloner returns repo, ref, and SHA. Record all three,
  plus the read date, in the research file so the citation survives a branch
  move.
- **Cite the pinned commit.** `sources:` and inline links point at
  `.../blob/<sha>/<path>`, never `main`.
- **Reuse the scout.** Keep its `childThreadId` and hand it to later subagents
  (fork one per receiver) so they ask it instead of re-crawling.

The `codebase-scout` and `library-source` skills hold the flow, the call
shapes, and the scout's reply format.

---

## 3. Directory Structure

```
yap/
├── AGENTS.md                 # this file — the rules
├── README.md                 # repo overview + index of indexes
├── research/                 # THE deliverable: written findings, one topic per file
│   ├── technology/           # software, libraries, infra, tooling, AI/ML
│   ├── product/              # products, vendors, pricing, feature comparisons
│   ├── business/             # markets, companies, strategy, finance
│   ├── science/              # papers, physics/bio/math, academic topics
│   ├── howto/                # step-by-step guides, setup, workflows
│   └── reference/            # cheat sheets, glossaries, specs, quick facts
├── sources/                  # raw/primary material, organized by origin
│   ├── articles/             # web articles, blog posts (snapshot or notes)
│   ├── papers/               # academic papers, preprints, PDFs
│   ├── docs/                 # official documentation excerpts
│   └── datasets/             # data files, CSVs, JSON, links to data
├── notes/                    # fleeting, unrefined thoughts; inbox for triage
├── archive/                  # superseded or abandoned material (never deleted)
└── templates/                # file templates (see §6)
```

### Placement decision tree

1. Is it a **finished, written finding**? → `research/<category>/`
2. Is it **raw source material** you collected (article text, PDF, dataset)?
   → `sources/<origin>/`
3. Is it a **half-formed thought** not yet worth a research file? → `notes/`
4. Is it **no longer accurate/relevant**? → `archive/` (keep the file; add an
   `archived:` date and reason at the top).

### Category definitions (`research/`)

| Category     | Use for                                                        |
|--------------|----------------------------------------------------------------|
| `technology` | Languages, frameworks, libraries, databases, DevOps, AI/ML.     |
| `product`    | Commercial products/SaaS, pricing, features, vendor comparison. |
| `business`   | Companies, markets, funding, strategy, economics.               |
| `science`    | Academic/technical research, papers, math, physical sciences.   |
| `howto`      | Reproducible procedures and setup guides.                       |
| `reference`  | Durable facts: cheat sheets, glossaries, specs, API summaries.  |

If a topic spans categories, pick the **primary intent** and add a cross-link
from the other. When no category fits, propose a new one in `README.md` before
creating the directory — do not scatter files at the root.

---

## 4. File Naming

- Lowercase, hyphenated, descriptive: `postgres-vector-search-comparison.md`.
- No spaces, no dates in filenames, no `final`/`new`/`v2` suffixes.
- One file per topic. Slug must read as the topic, not the activity
  (`react-server-components.md`, not `notes-about-react.md`).
- Date lives in front matter (`created:` / `updated:`), not the filename.

---

## 5. Linking & Discoverability

- Every research file starts with YAML front matter (see §6).
- Every research file must be **linked from the index** of its category
  (`research/<category>/README.md`). Update the index in the same turn.
- Use relative links between files: `../technology/foo.md`.
- Reference raw material by relative path: `../../sources/articles/foo.md`.
- New category → add it to `README.md` and create its `README.md` index.

---

## 6. Required Front Matter

Every file under `research/`, `sources/`, and `notes/` must begin with:

```yaml
---
title: Human-readable title
category: technology        # technology|product|business|science|howto|reference
tags: [postgres, search, vector]
status: complete            # draft|in-progress|complete|archived
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://example.com/primary-source
confidence: high            # high|medium|low  (how sure are we?)
---
```

`howto/` files additionally use this body skeleton (see `templates/howto.md`):
`## Goal`, `## Prerequisites`, `## Steps`, `## Verification`, `## Troubleshooting`.

`reference/` files additionally: `## Summary`, `## Details`, `## Gotchas`.

Use the templates in `templates/`:
- `templates/research.md` — general research finding
- `templates/howto.md` — procedural guide
- `templates/source.md` — raw source snapshot

---

## 7. Agent Workflow

For any task that involves looking something up:

1. **Search the repo** for existing coverage (`grep -ri "<topic>" research/ notes/`).
2. **Search externally with TinyFish** (`mcp__tinyfish__search`) — mandatory
   for anything outside this repo (see §2).
3. **Read the sources with TinyFish** (`mcp__tinyfish__fetch_content`) — not
   with any other fetch tool. When the source *is* a codebase, delegate a scout
   that spawns the cloner instead (§2).
4. **Write/update** the Markdown file using the correct template and category,
   citing the URLs TinyFish returned.
5. **Update the category index** (`research/<category>/README.md`).
6. **Link** related files both ways where useful.
7. **Only then** report back, summarizing what was written and where.

Never end a research turn with only a chat message and no file change.

---

## 8. Definition of Done

A research task is done when:

- [ ] A Markdown file exists in the correct `research/<category>/` directory.
- [ ] Valid front matter is present and accurate.
- [ ] External sources were gathered via TinyFish (`mcp__tinyfish__search` /
      `mcp__tinyfish__fetch_content`), via a scout + cloner checkout (§2), or a
      documented fallback reason exists.
- [ ] Every non-obvious claim has a source link.
- [ ] The category index links to the new/updated file.
- [ ] Related files are cross-linked.
- [ ] The chat reply names the file path that was written.

---

## 9. Prohibited

- Using a non-TinyFish tool for external search or fetching when TinyFish is
  available (see §2). Source checkout is the exception, and it goes through the
  scout's cloner, not a hand-run `git clone` (§2).
- Crawling a codebase in the main context instead of through a scout (§2).
- Leaving research only in chat, terminal output, or memory.
- Creating files at the repo root (except `AGENTS.md`, `README.md`).
- Editing files in `archive/` (append a note instead; keep history).
- Deleting research. Supersede it: move to `archive/` and link the replacement.
- Committing raw binaries into `research/` (put them in `sources/` and link).
- Presenting uncited claims as fact.

---

## 10. Audience & Output Style

### Technical peer

> **Peer level.** The reader is fluent in web development, programming, backend, and
> full-stack engineering. Explain with the precise technical term and the named pattern;
> the reader will ask about terms that are new to them. Reach for an analogy only when the
> concept has no technical name.

### Comparison tables — wide format

> **Wide table.** Prefer tables for comparing technologies. Compared items go across the
> columns (one item per column); comparison dimensions go down the rows. Each cell holds a
> single light clause — never a multi-sentence cell. When a dimension needs prose, move it
> into its own section below the table and leave a short pointer in the cell.

---

## 11. Research Modes — RFD & RFO

Two named modes extend an existing comparison. The user invokes them by name in a prompt.

> **RFD — research for deeper.** Deepen the comparison already in hand: research the
> existing candidates further so each one's distinct value is sharp and the reader can pick
> the candidate that fits them.

> **RFO — research for other.** Widen the comparison: find additional candidates. Aim the
> search along the comparison's key axis — comparing speed means looking for faster
> candidates, comparing cost means cheaper ones. Fold every new candidate into the existing
> wide table as a new column; start a new table only when none exists.
