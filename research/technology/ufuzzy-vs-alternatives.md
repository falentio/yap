---
title: uFuzzy Against the Field — Pre-filter Speed Versus Typo Accuracy in JavaScript Fuzzy Search
category: technology
tags: [fuzzy-search, typeahead, autocomplete, fuse.js, fuzzysort, match-sorter, benchmark, bundle-size]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://github.com/leeoniya/uFuzzy
  - https://github.com/leeoniya/uFuzzy/blob/master/src/uFuzzy.mjs
  - https://github.com/krisk/Fuse
  - https://github.com/farzher/fuzzysort
  - https://github.com/kentcdodds/match-sorter
  - https://github.com/fwextensions/quick-score
  - https://github.com/EthanRutherford/fast-fuzzy
  - https://github.com/ajitid/fzf-for-js
  - https://fzf.netlify.app/docs/latest
  - https://github.com/nextapps-de/flexsearch
  - https://github.com/nextapps-de/flexsearch/blob/master/doc/encoder.md
  - https://github.com/lucaong/minisearch
  - https://github.com/bevacqua/fuzzysearch
  - https://github.com/jhawthorn/fzy
  - https://github.com/jhawthorn/fzy.js
  - https://news.ycombinator.com/item?id=33035580
  - https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/
  - https://typesense.org/learn/fuzzy-search-javascript/
  - https://www.npmjs.com/package/fuzzysort
  - https://registry.npmjs.org/@leeoniya%2Fufuzzy/latest
  - https://api.github.com/repos/leeoniya/uFuzzy
  - https://api.npmjs.org/downloads/point/last-week/@leeoniya/ufuzzy
  - https://api.npmjs.org/downloads/point/last-week/fuse.js
  - https://api.npmjs.org/downloads/point/last-week/fuzzysort
confidence: high
---

# uFuzzy Against the Field — Pre-filter Speed Versus Typo Accuracy in JavaScript Fuzzy Search

## TL;DR

- **uFuzzy is not a string-distance matcher; it is a compiled-regex subsequence pre-filter with a stats pass.** Each needle term becomes a RegExp that keeps only haystack entries holding every alphanumeric char in sequence, then a second phase collects match stats for sorting ([README, "How It Works"](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)). Both the speed and the accuracy limits follow from that one design: the filter is fast exactly because it refuses anything missing a character, so every tolerance has to be compiled into the pattern as extra branches.
- **Its one clear win is speed without an index.** 162,000 phrases: 434 ms and 28.4 MB peak heap, against Fuse.js at 33,875 ms and 245 MB — 78x faster with a tenth of the memory, no build step, and 0.5 ms to start ([benchmark table](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)). The only faster entries pay seconds of init (FlexSearch, 83 ms per run after 3.2 s) or return unranked (fuzzysearch).
- **Its typo tolerance is one character per term, opt-in, and switched off entirely for short terms.** `SingleError` (`intraMode: 1`) allows one substitution, transposition, insertion, or deletion per term with the first character excluded by default, but the built-in `intraRules` still demands exact matches for one- and two-character terms ([uFuzzy.mjs](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/src/uFuzzy.mjs)). Fuse's Bitap and fast-fuzzy's Damerau distance accept a wrong character anywhere in the word; fuzzysort, fzy, QuickScore, match-sorter, and fuzzysearch accept only characters that are actually present, in order.
- **This is a filtering library for short phrases, not a search engine.** The author says so: no stopwords, no stemming, no TF-IDF, no relevance score — "if you want fulltext matching with stopwords, stemming, BM25 ranking, etc." use FlexSearch or MiniSearch ([author, Reddit](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)).

## Context

The prompt was to compare [leeoniya/uFuzzy](https://github.com/leeoniya/uFuzzy) with its competitors. Ten alternatives are below, chosen along the axis the library competes on — partial-term matching against short strings, client side: [Fuse.js](https://github.com/krisk/Fuse), [fuzzysort](https://github.com/farzher/fuzzysort), [match-sorter](https://github.com/kentcdodds/match-sorter), [QuickScore](https://github.com/fwextensions/quick-score), [fast-fuzzy](https://github.com/EthanRutherford/fast-fuzzy), [fzf-for-js](https://github.com/ajitid/fzf-for-js), [fuzzysearch](https://github.com/bevacqua/fuzzysearch), [fzy.js](https://github.com/jhawthorn/fzy.js), and the in-memory full-text engines [FlexSearch](https://github.com/nextapps-de/flexsearch) and [MiniSearch](https://github.com/lucaong/minisearch), which appear whenever someone asks uFuzzy for stemming or stopwords. Repo slugs are pinned to the head commit on their default branch as of 2026-11-10; download counts are last-week npm figures for 2026-11-02 to 2026-11-08.

Every performance number in the main table is uFuzzy's own, published 2023-10 against Chrome 117 on a Ryzen 7 PRO 5850U, with the corpus at 162,000 phrases and seven needles typed and backspaced one keypress at a time ([benchmark section](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)). The author's own caveats: "all benchmarks suck", quality varies by needle, and several libraries are tuned for whole-word rather than partial search. Read the table as an ordering, not a score.

## The comparison

| | uFuzzy | Fuse.js | fuzzysort | match-sorter | QuickScore | fast-fuzzy | fzf-for-js | fuzzysearch | fzy.js | FlexSearch | MiniSearch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Needle→haystack match** | all alphanumerics in sequence ([README](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)) | Bitap window over `location`±`distance` ([README](https://github.com/krisk/Fuse/blob/edf2fb608eca0461508d1d71317e6e58309ffada/README.md)) | in-sequence chars, scored by density | rank ladder, subsequence at rung 7 ([README](https://github.com/kentcdodds/match-sorter/blob/bd26108ad28306ebfdee4ff79950d39a8a18e1d9/README.md)) | Quicksilver, case-weighted ([README](https://github.com/fwextensions/quick-score/blob/1fd7fd28959ea055a317e06411ce0940ee4f5d20/README.md)) | Sellers + Damerau-Levenshtein over a trie ([README](https://github.com/EthanRutherford/fast-fuzzy/blob/f1558e0ff1bd21a05be734aa53c05daa56f28396/README.md)) | fzf port, consecutive/word-start scoring | subsequence, boolean only ([README](https://github.com/bevacqua/fuzzysearch/blob/9873ea0546a47f5d96e037ff02b78b871c809d62/README.md)) | consecutive + word-start scoring ([README](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/README.md)) | tokenized inverted index | tokenized inverted index |
| **Wrong char in the needle** | 1 per term, opt-in, char 0 and ≤2-char terms exact | yes, a substitution inside the `distance` window | no, gaps only (`allowTypo` removed in v3) | no | no, gaps only | yes, Damerau on every char | no | no, charCode equality | no, "only accepts insertions" ([ALGORITHM.md](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/ALGORITHM.md)) | no, phonetic encoder rules ([encoder docs](https://github.com/nextapps-de/flexsearch/blob/f7ed963096a0792da7b2fd63bb7114b3fbac55ed/doc/encoder.md)) | yes, `fuzzy:` as an edit-distance fraction of term length ([README](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/README.md)) |
| **Result object** | indices + per-match counters ([uFuzzy.d.ts](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/dist/uFuzzy.d.ts)) | score, indices, `refIndex` | score, indices, `highlight()` | ranked items, optional rank info | item, score, match ranges | item, score, match index | item, score, positions | boolean | match object per item | item, score, match ranges | item, score, match terms |
| **Multi-word needles** | all terms must hit; `outOfOrder` permutes | token search, BM25 IDF | space-split, AND | AND across terms | no term split | no term split | only with `extendedMatch` | no term split (spaces are chars) | no term split | AND, OR via resolver | `combineWith: 'AND'`/`'OR'` |
| **Exclusions / exact phrases** | `-excluded` and `"quoted"` ([README](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)) | `!term`, `=exact`, object query ([README](https://github.com/krisk/Fuse/blob/edf2fb608eca0461508d1d71317e6e58309ffada/README.md)) | no | no | no | no | `!term`, `'exact`, `^prefix` via `extendedMatch` ([docs](https://fzf.netlify.app/docs/latest#making-it-behave-like-fzf-cli)) | no | no | resolver boolean ops | `filter:` |
| **Stemming / stopwords / BM25** | none ([author](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)) | BM25 IDF with token search | none | none | none | none | none | none | none | stemmer, filter maps | BM25+ scoring ([docs](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html)); stemmer and stopwords via `processTerm` |
| **Index to build** | none | in-memory list | none | none | none | trie on construction | none | none | precomputed rows | full inverted index | full inverted index |
| **Init (162k rows)** | 0.5 ms | 31 ms | 50 ms | 0.1 ms | 10 ms | 790 ms | 50 ms | 0.1 ms | 0.1 ms | 3,210 ms | 504 ms |
| **Search, 7 needles × 86 keystrokes** | 434 ms | 33,875 ms | 1,321 ms | 6,245 ms | 6,915 ms | 19,266 ms | 6,290 ms | 529 ms | 3,932 ms | 83 ms | 1,453 ms |
| **Peak heap** | 28.4 MB | 245 MB | 175 MB | 71 MB | 133 MB | 550 MB | 153 MB | 26.2 MB | 34 MB | 670 MB | 438 MB |
| **Retained after GC** | 7.4 MB | 13.9 MB | 84 MB | 7.3 MB | 12.1 MB | 165 MB | 25 MB | 7.3 MB | 7.3 MB | 316 MB | 67 MB |
| **Size, min** | 7.6 KB | 24.2 KB | 6.2 KB | 7.3 KB | 9.5 KB | 18.2 KB | 15.4 KB | 0.2 KB | 1.5 KB | 6.2 KB | 29.1 KB |
| **Unicode beyond Latin** | `{alpha}` or `{unicode:true}`, 50-75% slower | native | native | native | via `latinize()` | native (graphemes) | `normalize: true` strips diacritics | native | native | CJK, Arabic, Hebrew charsets | `Intl.Segmenter` |
| **Case-sensitive search** | impossible ([README](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)) | `isCaseSensitive` option | case weighted in score only | yes, rung 1 outranks all | lowercased away (`transformString`) | `ignoreCase: false` | `smart-case` by default ([docs](https://fzf.netlify.app/docs/latest#case-sensitivity)) | **charCode compare — case-sensitive** ([index.js](https://github.com/bevacqua/fuzzysearch/blob/9873ea0546a47f5d96e037ff02b78b871c809d62/index.js)) | lowercased away ([index.js](https://github.com/jhawthorn/fzy.js/blob/327b2ae5dbd99623469c061d82a25fdc5201a465/index.js)) | via encoder split | via `tokenize` |
| **Stars** | 3,044 | 20,511 | 4,350 | 4,115 | 164 | 346 | 956 | 2,740 | 164 | 13,810 | 6,175 |
| **npm downloads / week** | 630,917 | 19,819,146 | 20,340,136 | 4,819,855 | 5,683 | 2,145,738 | 4,538,152 | 231,206 | 17,909 | 1,279,364 | 2,421,089 |
| **Last commit** | 2026-09-08 | 2026-08-09 | 2026-08-13 | 2026-11-07 | 2022-06-03 | 2022-11-05 | 2025-04-14 | 2023-05-31 | 2024-09-24 | 2026-05-28 | 2025-09-16 |
| **License** | MIT | Apache-2.0 | MIT | MIT | MIT | MIT | BSD-3-Clause | MIT | MIT | Apache-2.0 | MIT |

Init, search, heap, retained, and size come from [uFuzzy's benchmark table](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md). Stars, last commit, license, and open issues come from [the GitHub API](https://api.github.com/repos/krisk/Fuse) read on 2026-11-10 — the bench table carries a 2023 snapshot of the same count, which is three years stale (Fuse was 16.6k stars then, 20.5k now) — and downloads from [api.npmjs.org](https://api.npmjs.org/downloads/point/last-week/fuse.js) for 2026-11-02 to 2026-11-08. uFuzzy took 434 ms at its default settings and 545 ms with `outOfOrder` plus single-error tolerances; the fuzzier configuration is the honest figure for a typo-tolerant comparison, and both land in the same order of magnitude.

## Why the uFuzzy row looks the way it does

Three properties, each a consequence of the regexp pre-filter.

**No index, so nothing to build.** `filter()` compiles the needle into one RegExp and runs it over the raw array; there is no tokenization, no inverted index, no document store ([README, "How It Works"](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)). The 0.5 ms init is real, and so is the 7.4 MB retained heap, which is the array itself plus V8's regexp machinery.

**Ranking is counters, not a score.** The `info()` pass collects `interLft2`, `intraIns`, `terms`, `cases`, and similar per match, hands them to `Array.sort()`, and the caller sorts on whatever subset it wants ([uFuzzy.d.ts `Info`](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/dist/uFuzzy.d.ts)). There is no composite relevance number to calibrate, which is the library's central claim — "sorting you can reason about" rather than "an arbitrary relevance score cut-off" ([README, Features](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)).

**The zero-junk claim is the regexp's strictness.** A haystack row that lacks a needle character in order is gone after phase one. That is why 9,739 fuzzysort hits for `TMNT` reduce to 63 here ([author, Reddit](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)), and why `super meet boy` found nothing at launch, which pushed the author to add substitution, transposition, and deletion tolerance within a day ([HN thread](https://news.ycombinator.com/item?id=33035580)). The cost of that strictness shows up as badged spelling: `suiper bros` still does not find `Super Mario Bros` unless `intraMode: 1` is set, and then only by one character.

## Pick by requirement

| Requirement | uFuzzy | Fuse.js | fuzzysort | match-sorter | QuickScore | fast-fuzzy | fzf-for-js | fuzzysearch | fzy.js | FlexSearch | MiniSearch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command palette over 100k items | yes, 5 ms/term | no, 34 s | only with `limit`, 1.3 s | no, 6.2 s | no, 6.9 s | no, 19 s | no, 6.3 s | yes but unordered, 0.5 s | no, 3.9 s | yes after 3 s init, 0.08 s | no, 1.5 s |
| Typeahead where a wrong letter is common | 1 typo, char 0 and 2-letter terms exact | yes | no | no | no | yes | no | no | no | phonetic only | yes |
| Case sensitivity, and search operators | operators yes, case no | both | operators no, case no | case yes, operators no | neither | case yes, operators no | both, `extendedMatch` has the operators ([docs](https://fzf.netlify.app/docs/latest#case-sensitivity)) | case yes, operators no | neither | case via encoder split | case via `processTerm` |
| Multilingual / CJK | slow `unicode` path | yes | yes | yes | via latinize | yes | yes | yes | yes | best in class | yes |
| Object graphs as haystack | flatten yourself | `keys` + weights | `key`/`keys` | dotted + wildcard paths | key paths | `keySelector` | `keySelector` | flatten yourself | flatten yourself | document schema | `fields` |
| Highlighting ranges | `highlight()` from `info.ranges` | `includeMatches` | `highlight()` | rank info only | `matches` | `match.index` | `positions` | n/a | match object | `highlight` | `match` |
| Full-text traits (stemming, BM25) | no | token search | no | no | no | no | no | no | no | yes | partial: BM25 yes, stemmer DIY |

### The honest cases for each

**Fuse.js** is the default answer for a reason. Twenty million weekly downloads, a Bitap matcher that tolerates a typo in any position, weighted keys, token search with BM25 IDF, object queries, a worker adapter for 100K-document sets, and 21,000 stars ([README](https://github.com/krisk/Fuse/blob/edf2fb608eca0461508d1d71317e6e58309ffada/README.md)). Choose it when the haystack is a few thousand documents or fewer and correctness per keystroke matters more than the frame budget. The 2024 note in uFuzzy's README concedes the quality critique applies to Fuse's defaults, not the library: setting `ignoreFieldNorm: true` fixes most of it, though ordering "remains ungreat".

**fuzzysort** is the closest thing to a drop-in upgrade path on speed — a `threshold`, `keys`, `snapshot()`, a highlight API, and 1,321 ms where Fuse takes 33,875 ms ([README](https://github.com/farzher/fuzzysort/blob/ac4d42ec894a2125d78802ec9b5e74e43518d0fc/README.md)). It gives up needle-side typo tolerance to get there: `allowTypo` was deprecated in v1.9 and has been gone since v3.0.0, so a transposed letter no longer matches ([v3 README changelog](https://raw.githubusercontent.com/farzher/fuzzysort/v3.0.0/README.md)). It is the library every uFuzzy discussion ends up arguing about, and the disagreement is really about cutoffs: fuzzysort returns a bounded, sorted top-N with no way to say where relevance stops, which the uFuzzy author calls a cut-off problem ([Reddit](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)). A reader in the same thread argues the opposite, that sorting plus pagination beats any cutoff.

**match-sorter** is the only entry whose ladder is a UX spec: case-sensitive equals, equals, starts-with, word-starts-with, contains, acronym, subsequence ([README](https://github.com/kentcdodds/match-sorter/blob/bd26108ad28306ebfdee4ff79950d39a8a18e1d9/README.md)). Deterministic, and the only ladder that puts case-sensitive equality above a plain substring, so `France` outranks `france` without a setting to find. It also returns 1,384 results for `twili` with only the first 40 relevant, and takes 6,245 ms on 162k rows: fine for a settings list, wrong for a file picker.

**fast-fuzzy** is the accuracy maximalist — Damerau-Levenshtein with Sellers substring matching, grapheme-aware, tied to a trie so shared prefixes are not rescanned ([README](https://github.com/EthanRutherford/fast-fuzzy/blob/f1558e0ff1bd21a05be734aa53c05daa56f28396/README.md)). It is also the slowest small library at 19,266 ms and 550 MB peak, and its last commit is 2022-11-05.

**fzf-for-js** ports a terminal finder's scoring — consecutive runs and word starts win — and keeps fzf's `extendedMatch` operator set behind a non-default import, with `'exact`, `^prefix`, and `!` exclusion patterns ([docs](https://fzf.netlify.app/docs/latest#making-it-behave-like-fzf-cli)). If the UI is a command palette rather than a list filter, its ranking intent matches the task better than any edit-distance library, including uFuzzy's.

**QuickScore** is 2 KB of Quicksilver scoring that rewards case changes — the README's own example scores "GitHub" at 0.92 and "thought" at 0.41 for `gh` — and is explicit that diacritic stripping is out of scope for size reasons ([README](https://github.com/fwextensions/quick-score/blob/1fd7fd28959ea055a317e06411ce0940ee4f5d20/README.md)). Last commit 2022-06-03 and 5,683 downloads a week; pick it for a small static list and no ambition beyond that.

**fuzzysearch** is 0.2 KB that answers a boolean and nothing else — no score, no ranking, no ordering, and a plain `charCodeAt` compare, so it is case-sensitive and wants lowercased input ([index.js](https://github.com/bevacqua/fuzzysearch/blob/9873ea0546a47f5d96e037ff02b78b871c809d62/index.js)). At 529 ms it is the fastest small entry after uFuzzy itself, and its README pitches the scan over regexp compilation with a chart. Pair it with your own sort, or skip it.

**fzy.js** carries fzy's scoring — consecutive letters, word starts, shorter matches first — as a JS port of the terminal tool ([fzy README](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/README.md)), with the same insertions-only matching ([ALGORITHM.md](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/ALGORITHM.md)). 164 stars, 17,909 downloads, last commit 2024-09-24 on the port and 2025-07-29 on the original.

**FlexSearch and MiniSearch** are not fuzzy matchers so much as in-memory full-text engines that happen to accept partial tokens. FlexSearch's cost is up front: 3,210 ms to build 162k rows and 316 MB still retained after GC, in exchange for 83 ms searches, persistent indexes, CJK charsets, and its own claim of 50 million queries a second ([README](https://github.com/nextapps-de/flexsearch/blob/f7ed963096a0792da7b2fd63bb7114b3fbac55ed/README.md)). MiniSearch is the smaller, friendlier version of that trade: 504 ms init, `prefix`, `fuzzy: 0.2`, `boost`, `combineWith: 'AND' | 'OR'` ([API docs](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html)), and a `processTerm` hook for the stopword and stemmer lists the README says are not built in ([README](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/README.md)). Reach for either when the requirement contains the word "stemming".

## Practice: what each one makes easy or hard

**uFuzzy's leaky part is the two-phase API.** `info()` recompiles the needle into two more expensive RegExps, so the docs tell you to sort only under about 1,000 filtered items and otherwise render unordered ([README, "How It Works"](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)). The demo gates exactly there. Anything past that threshold is on you: external prefix caching takes the bench from 434 ms to 210 ms ([bench table](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)), and `filter()` accepts a previous match's indices for the typeahead case.

**`outOfOrder` is factorial.** The signature warns that a value of 5 "will result in up to 5! (120) search iterations" ([uFuzzy.d.ts](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/dist/uFuzzy.d.ts)). Three- and four-term needles are the practical ceiling.

**Objects get flattened, not schemas.** The README's own instruction is to build a parallel string array ("when held *just right*"), and readers on Reddit confirm the answer is `arr.map(e => e.title)` ([thread](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)). Fuse, match-sorter, QuickScore, and fast-fuzzy all take key paths natively; you pay for that in the numbers above.

**Multi-word AND is strict by default.** `i love superman` finds nothing because `i` and `love` must also be subsequences, and stopword removal is not a feature. The author's recommended path is your own stopword list plus your own OR combinator ([Reddit](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/)).

**Typo tolerance has to be switched on, per instance, and is narrower than the option list suggests.** The default `intraRules` builds a per-term rule set that is exact for terms of one or two characters, allows one transposition for three or four, and only then defers to your `intraMode`/`intraSub`/`intraTrn`/`intraDel` options; setting `intraTrn` or `intraSub` without `intraMode: 1` therefore does nothing ([uFuzzy.mjs, `intraRules`](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/src/uFuzzy.mjs)). Half the Reddit bug reports are this mistake. The first character is excluded by the default `intraSlice: [1, Infinity]`, whose in-source comment reads "requires first char" — a defensible typeahead choice and a real gap when a mobile keyboard emits the wrong first letter. `intraRules` is overridable, so a per-term policy is possible, but you write it.

**Fuse's leaky parts are the location window and two defaults.** With defaults `location: 0`, `distance: 100`, `threshold: 0.6`, a match must start within 60 characters of the string's start: a real hit at index 65 returns nothing until `ignoreLocation` is set ([Typesense guide](https://typesense.org/learn/fuzzy-search-javascript/)). `isCaseSensitive` and `ignoreFieldNorm` both default to `false` ([config defaults](https://github.com/krisk/Fuse/blob/master/src/core/options.ts)), so the first thing to try when results look wrong is flipping `ignoreFieldNorm`, which is exactly what the uFuzzy README's 2024 update says. Build a `keys` list and decide the threshold deliberately, or the library will look broken on long strings.

**Most of this field does not correct typos at all.** fuzzysort, fzy, QuickScore, match-sorter, and fuzzysearch all require the needle's characters to appear, in order; only Fuse, fast-fuzzy, MiniSearch, and uFuzzy-with-a-flag accept a wrong character. If the UI is on a phone keyboard, that narrows the list to four before any other consideration.

**Thresholds are the shared trap.** fuzzysort's `0.5`, fast-fuzzy's `0.6`, Fuse's `0.6`, MiniSearch's `fuzzy: 0.2` all become a junk-cutoff dial, and the honest answer for each is "measure against your corpus". uFuzzy replaces the dial with structure — must contain every character, in order — at the price of the typos described above.

## What to choose

- **Command palette, filename or symbol list, more than roughly 50k entries.** uFuzzy, with `interLft`/`interRgt` tightened and a custom `sort`. Nothing else here is at 5 ms a term with no index.
- **List filter over a few thousand rows where users mistype.** Fuse.js, fast-fuzzy, or MiniSearch — the three that accept a wrong character. fuzzysort is faster than all of them but wants users who spell; take it when the haystack is facts to match rather than words to spell.
- **Menus, settings, a `France`/`france` distinction.** match-sorter. Its deterministic rungs are the feature.
- **A command palette with `!exclude` and exact-prefix syntax.** fzf-for-js, opting into `extendedMatch` — uFuzzy's exclusions cover `-` and `""` but not `^` or `'`, and it has no smart case.
- **Documents, stemming, stopwords, BM25, multilingual.** MiniSearch or FlexSearch, and accept the init cost. uFuzzy is not this, and MiniSearch does not ship a stemmer either — you supply one through `processTerm`.
- **A static list under a megabyte on a 2 KB budget.** QuickScore or fuzzysearch. Neither is actively maintained; both are done.

uFuzzy's README ends with a candid disclaimer worth repeating, since the benchmark above is the author grading his own work: the appraisal is "extremely narrow and, of course, biased" toward his corpus and his use case, and "it is highly probable that I'm not taking full advantage of some feature in other libraries" ([README](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md)).

## Licensing, versions, and who is behind each

| | uFuzzy | Fuse.js | fuzzysort | match-sorter | QuickScore | fast-fuzzy | fzf-for-js | fuzzysearch | fzy.js | FlexSearch | MiniSearch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Maintainer | leeoniya (uPlot) | krisk | farzher | kentcdodds | fwextensions | EthanRutherford | ajitid | bevacqua | jhawthorn | nextapps-de | lucaong |
| Latest release | @leeoniya/ufuzzy 1.0.19 ([registry](https://registry.npmjs.org/@leeoniya%2Fufuzzy/latest)) | current, active | current, active | current, active | 2022 | 1.12.0, 4 years stale | 2025 | 2023 | port, 2024 | v0.8 line, active | 2025 |
| CI workflows | **none — no `.github` dir** | `nodejs.yml` | none | `validate.yml` | `codeql-analysis.yml`, `gh-pages.yml` | none | `main.yml` | none | `test.yml` | `node.js.yml` | `main.yml` |
| Open issues | 15 | 21 | 7 | 5 | 6 | 6 | 8 | 5 | 2 | 39 | 15 |

uFuzzy has no `.github` directory: `package.json` declares only `build` and `test`, and `test` is `echo "Error: no test specified" && exit 1` ([package.json at 9bcdc09](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/package.json)). The library is exercised by its demo page, which is why the demo carries two dozen comparison targets and a drag-and-drop corpus. fuzzysort and fast-fuzzy are the other two with no CI; QuickScore's two workflows are CodeQL and Pages rather than a test job, so its README coverage badge is not currently produced by CI. That matters if you lean on `info()` internals or on uFuzzy's edge behaviour rather than its happy path.

## Sources behind each column

- **uFuzzy** — [README at 9bcdc09](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/README.md) (design, options, benchmark table, self-critique), [uFuzzy.d.ts](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/dist/uFuzzy.d.ts) (API, `intraMode`, `intraSlice`, `outOfOrder` warning), [uFuzzy.mjs](https://github.com/leeoniya/uFuzzy/blob/9bcdc090f426cadaa2865b7f3dc548f2bb4a54f0/src/uFuzzy.mjs) (the default `intraRules` short-term policy), [HN 33035580](https://news.ycombinator.com/item?id=33035580) and the [r/javascript thread](https://www.reddit.com/r/javascript/comments/xtrszc/ufuzzyjs_a_tiny_efficient_fuzzy_search_that/) (substitution criticism, the day-one patch, stopword/OR answers, the 9,739-to-63 `TMNT` count).
- **Fuse.js** — [README at edf2fb6](https://github.com/krisk/Fuse/blob/edf2fb608eca0461508d1d71317e6e58309ffada/README.md) for Bitap, `useTokenSearch`, weighted keys, extended operators, the full/basic build split; [Typesense's guide](https://typesense.org/learn/fuzzy-search-javascript/) for the `location`/`distance`/`threshold` window and `ignoreLocation`; [the default config](https://github.com/krisk/Fuse/blob/master/src/core/options.ts) for `isCaseSensitive: false` and `ignoreFieldNorm: false`.
- **fuzzysort** — [README at ac4d42e](https://github.com/farzher/fuzzysort/blob/ac4d42ec894a2125d78802ec9b5e74e43518d0fc/README.md) and the [npm page](https://www.npmjs.com/package/fuzzysort) for `snapshot()`, remapping and the v4 changelog; [v3 README](https://raw.githubusercontent.com/farzher/fuzzysort/v3.0.0/README.md) for the `allowTypo` removal.
- **match-sorter** — [README at bd26108](https://github.com/kentcdodds/match-sorter/blob/bd26108ad28306ebfdee4ff79950d39a8a18e1d9/README.md) (the seven-rank ladder, key paths, thresholds).
- **QuickScore** — [README at 1fd7fd2](https://github.com/fwextensions/quick-score/blob/1fd7fd28959ea055a317e06411ce0940ee4f5d20/README.md) (Quicksilver scoring, case weighting, latinize pairing).
- **fast-fuzzy** — [README at f1558e0](https://github.com/EthanRutherford/fast-fuzzy/blob/f1558e0ff1bd21a05be734aa53c05daa56f28396/README.md) (Sellers, Damerau, trie, graphemes, `ignoreCase`).
- **fzf-for-js** — [README at cf39032](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/README.md) (fzf port, palette motivation) and [the docs](https://fzf.netlify.app/docs/latest) (`extendedMatch`, `smart-case`, `normalize`).
- **fuzzysearch** — [README at 9873ea0](https://github.com/bevacqua/fuzzysearch/blob/9873ea0546a47f5d96e037ff02b78b871c809d62/README.md) (boolean-only subsequence, "there's no approximation").
- **fzy.js / fzy** — [fzy README](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/README.md) and [ALGORITHM.md](https://github.com/jhawthorn/fzy/blob/34b88869d022e861da4846c4463aea3ddfb3ff30/ALGORITHM.md) (consecutive/word-start scoring, insertions-only matching).
- **FlexSearch** — [README at f7ed963](https://github.com/nextapps-de/flexsearch/blob/f7ed963096a0792da7b2fd63bb7114b3fbac55ed/README.md) and [encoder docs](https://github.com/nextapps-de/flexsearch/blob/f7ed963096a0792da7b2fd63bb7114b3fbac55ed/doc/encoder.md) (persistent indexes, charsets, stemmer/filter/mapper).
- **MiniSearch** — [README at 3d239d1](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/README.md) (`fuzzy` as a fraction of term length, `prefix`, `boost`, no built-in stemmer or stopword list) and the [SearchOptions reference](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html) (BM25+ parameters, `combineWith`).
- **Adoption and maintenance** — [api.npmjs.org](https://api.npmjs.org/downloads/point/last-week/@leeoniya/ufuzzy) last-week downloads for 2026-11-02 to 2026-11-08 and the [GitHub API](https://api.github.com/repos/leeoniya/uFuzzy) for stars, last push and licence, both read on 2026-11-10.

## Open Questions

- fuzzysort's "new behavior when your search contains spaces" has shipped since v2 but is never described in either README, and the 2026-11-10 v4 page does not mention it at all; the AND-across-terms cell rests on that changelog line plus the `keys` example, not on documented semantics.
- Do the 2023-10 numbers still hold on current Chrome and V8? The README has not re-run them, and regexp compilation, `Array.sort`, and GC have all changed since Chrome 117.
- How much does `{unicode: true}` really cost on a 2026 corpus? The README's 50-75% is unmeasured in the table.
- Does Fuse's `useTokenSearch` change its 33,875 ms figure in practice, given the bench predates the feature?
- Is anyone still patching QuickScore and fast-fuzzy, or are the 2022 commits final? Neither repo is archived as of 2026-11-10.
- fzy.js lags its C original badly (2024-09-24 against 2025-07-29), and neither carries the newer fzf-style operator set; how far the two scoring implementations have diverged is unmeasured here.

## Related

- [Technology index](./README.md) — index of `research/technology/` findings.
- [Modern JavaScript Video Player Libraries](./js-video-player-libraries.md) — same shape of library decision: pick on a size/latency axis, keep the maintenance record beside it.

## Changelog

- 2026-11-10 — created. Ten candidates, all documentation read through TinyFish; performance figures from uFuzzy's published 2023-10 benchmark, adoption and maintenance from the npm and GitHub APIs the same day. Second pass replaced the option-list reading of typo tolerance with the source's `intraRules` behaviour after reading `src/uFuzzy.mjs`. Corrected the typo-tolerance row mid-write: fuzzysort, fzy, QuickScore, match-sorter, and fuzzysearch all do gaps-only matching (`allowTypo` was removed in fuzzysort v3), and only Fuse, fast-fuzzy, MiniSearch, and uFuzzy-with-a-flag correct a wrong character.
