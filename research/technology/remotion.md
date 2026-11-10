---
title: Remotion — What It Is, What It Costs, and Where It Breaks
category: technology
tags: [remotion, video, react, programmatic-video, motion-graphics, ffmpeg, headless-chrome, licensing]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://www.remotion.dev/
  - https://github.com/remotion-dev/remotion
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md
  - https://www.remotion.dev/docs/license/pricing
  - https://www.remotion.dev/docs/license/faq
  - https://www.remotion.dev/docs/the-fundamentals
  - https://www.remotion.dev/docs/render
  - https://www.remotion.dev/docs/ssr
  - https://www.remotion.dev/docs/compare-ssr
  - https://www.remotion.dev/docs/lambda
  - https://www.remotion.dev/docs/client-side-rendering
  - https://www.remotion.dev/docs/web-renderer
  - https://www.remotion.dev/docs/player/player
  - https://www.remotion.dev/docs/editor-starter
  - https://www.remotion.dev/docs/ai/skills
  - https://www.remotion.dev/docs/studio
  - https://www.remotion.dev/docs/terminology
  - https://www.remotion.dev/docs/three
  - https://www.remotion.dev/docs/media
  - https://www.remotion.dev/docs/troubleshooting/stuck-render
  - https://www.remotion.dev/docs/
  - https://www.remotion.dev/about
  - https://www.remotion.dev/blog/seed-funding
  - https://github.com/remotion-dev/remotion/releases
  - https://registry.npmjs.org/remotion
  - https://metavert.io/compare/remotion-vs-motion-canvas
  - https://rendercomp.com/blog/remotion-performance-optimization-guide/
  - https://www.getmasset.com/resources/blog/hyperframes-vs-remotion-review
  - https://socket.dev/npm/package/remotion
confidence: high
---

# Remotion — What It Is, What It Costs, and Where It Breaks

## TL;DR

- **Remotion is a React framework for making video.** A composition is a React component; Remotion hands it a frame number and renders whatever it returns, then captures that frame from a headless Chromium and stitches the result with FFmpeg ([remotion.dev](https://www.remotion.dev/), [the-fundamentals](https://www.remotion.dev/docs/the-fundamentals), [rendercomp](https://rendercomp.com/blog/remotion-performance-optimization-guide/)). Everything HTML, CSS, SVG, canvas, Three.js or a data fetch can draw is legal video content.
- **It is source-available, not open source.** The code is on GitHub under a bespoke *Remotion License*: free for individuals, teams of 3 or fewer, and non-profits, and a paid Company License above that — 25 USD/month per seat or 0.01 USD per render with a 100 USD/month floor ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md), [pricing](https://www.remotion.dev/docs/license/pricing)). Selling your own fork or derivative is excluded ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)).
- **The real product is the rendering pipeline and the deployment story, not the React part.** Remotion Studio for authoring, a Node/Bun SSR API, distributed chunk rendering on AWS Lambda, Vercel Sandbox, and since v4.0.491 a WebCodecs browser renderer that is stable but limited to a subset of HTML ([render docs](https://www.remotion.dev/docs/render), [compare-ssr](https://www.remotion.dev/docs/compare-ssr), [client-side rendering](https://www.remotion.dev/docs/client-side-rendering)).
- **Cost of the headless-browser model is the thing to price in.** Every frame is a browser screenshot; GPUs mostly do not help, Lambda is CPU-only and capped around 5 GB of output, and a single unresolved `delayRender()` hangs the render with no error ([compare-ssr](https://www.remotion.dev/docs/compare-ssr), [stuck render](https://www.remotion.dev/docs/troubleshooting/stuck-render)). It is the right tool for templated, data-driven, mass-produced video; the wrong one for a hand-cut narrative edit or an offline GPU workflow.

## Context

Question asked: *"what is remotion"*. Nothing in the repo covered it (`grep -ril remotion research notes sources templates` returned nothing); the nearest neighbour is the player-side survey in [./js-video-player-libraries.md](./js-video-player-libraries.md), which is about *playing* video, while Remotion is about *producing* it.

This file answers four things: the model, the surface area, the licence, and the operational bill. It is written from Remotion's own documentation plus independent comparisons, all read 2026-11-10 against v4.0.542 published 2026-11-09 ([releases](https://github.com/remotion-dev/remotion/releases), [npm registry](https://registry.npmjs.org/remotion)).

## Findings

### 1. The model: a video is a function of the frame number

Remotion's own framing, verbatim: *"The idea of Remotion is to give you a frame number and a blank canvas, to which you can render anything you want using React."* ([the-fundamentals](https://www.remotion.dev/docs/the-fundamentals)). `useCurrentFrame()` returns the integer frame; `useVideoConfig()` returns `width`, `height`, `durationInFrames` and `fps`; frame 0 is the first frame and `durationInFrames - 1` the last.

A **composition** marries a component to that metadata and is registered in a root file, which is what makes it selectable in Studio and callable by a renderer:

```tsx
<Composition id="MyComposition" durationInFrames={150} fps={30}
             width={1920} height={1080} component={MyComposition} />
```

Because any frame is independently renderable from its number alone, a render parallelises trivially — the same property that lets Lambda split one video across hundreds of functions ([Lambda](https://www.remotion.dev/docs/lambda)). The corollary is that state lives in the frame number, not in a running clock: there is no timeline to scrub, no imperative "play for 2 seconds" — you interpolate from frame arithmetic.

The vocabulary is fixed and worth knowing before reading any doc: composition, sequence, composition ID, bundle, serve URL, concurrency, input props ([terminology](https://www.remotion.dev/docs/terminology)).

### 2. What ships in the box

Remotion is not one package. The scope split matters, because it decides which licence tier you land in and how much of a product you are buying rather than building.

| Package | Job | Notes |
|---|---|---|
| `remotion` | Core components, hooks, `AbsoluteFill`, `Sequence`, `interpolate` | v4.0.542 latest ([npm](https://registry.npmjs.org/remotion)) |
| `@remotion/renderer` | Node/Bun frame capture + FFmpeg encode | Chromium flags via `chromiumOptions` |
| `@remotion/lambda` | Distributed render on AWS Lambda + S3 | Needs a Chromium layer Remotion hosts ([Lambda](https://www.remotion.dev/docs/lambda)) |
| `@remotion/web-renderer` | In-browser render via WebCodecs + Mediabunny | Stable from v4.0.491, subset of HTML only ([web-renderer](https://www.remotion.dev/docs/web-renderer)) |
| `@remotion/player` | Embed a composition in any React app, props at runtime | The basis of most prompt-to-video products ([player](https://www.remotion.dev/docs/player/player)) |
| `@remotion/studio` | Preview, scrub, inspect, render | Dev server on port 3000 ([studio](https://www.remotion.dev/docs/studio)) |
| `@remotion/three` | React Three Fiber canvas with `useCurrentFrame()` inside | Needs `--gl=angle` headless ([three](https://www.remotion.dev/docs/three)) |
| `@remotion/media` | `<Video>`/`<Audio>` with off-thread decoding | ProRes off by default ([media](https://www.remotion.dev/docs/media)) |
| Editor Starter | Sold template: timeline, canvas, asset upload, undo, captions | One-time purchase, separate licence ([editor-starter](https://www.remotion.dev/docs/editor-starter)) |
| Lambda SDKs | `renderMediaOnLambda()` from PHP, Go, Python, Ruby | Part of the Lambda product |

Every `@remotion/*` package must sit at the **exact** same version as `remotion`, with `^` removed — Remotion's own install snippet says a caret "can lead to a version conflict" ([web-renderer](https://www.remotion.dev/docs/web-renderer)). With releases landing several times a day, pinning is not hygiene, it is the difference between a working render and a resolver puzzle.

### 3. Where you can render, and what each surface costs

Every path below starts from the same bundle and ends in the same encoded file; the difference is who owns the machine and what limits apply.

| Surface | Distribution | Hard limits | Licence tier |
|---|---|---|---|
| Studio "Render" button | Local machine | Interactive only | Free |
| `npx remotion render` | Local machine | One box, one concurrency budget | Creators seat above 3 people |
| Node/Bun `renderMedia()` | Your server | You build queueing, retries, storage, logging | Automators |
| AWS Lambda | Chunked across many functions | ~5 GB output cap, ~80 min Full HD, no AV1, CPU-only | Automators |
| Vercel Sandbox | Single VM | 800 s function window, detached + poll beyond it | Automators |
| Cloud Run (alpha) | Single instance | Alpha, "not actively being developed" | Automators |
| WebCodecs in browser | The user's tab | Subset of HTML/CSS; Chrome 94+, Firefox 130+, Safari 26+ | Automators |
| GitHub Actions | One runner | Runner timeouts, artifact upload | Automators |

Lambda is Remotion's own recommendation on speed, maturity and cost *shape* ([SSR](https://www.remotion.dev/docs/ssr)) — but note the honesty in their comparison: Lambda compute "is more expensive than other options", Vercel Sandbox is the easiest to set up, and a long-running server is "by far the cheapest compute cost" once volume is high ([compare-ssr](https://www.remotion.dev/docs/compare-ssr)). Their stated cleanup for Cloud Run is to port the Lambda runtime rather than maintain a second implementation, so treat Cloud Run as frozen.

Two constraints cut across all server surfaces: **GPUs mostly do not make a render faster**, and Lambda and Vercel Sandbox have none ([compare-ssr](https://www.remotion.dev/docs/compare-ssr)); and a `delayRender()` that never resolves hangs the render silently, which on Lambda is masked further because the function timeout fires first ([stuck render](https://www.remotion.dev/docs/troubleshooting/stuck-render)). Always bound `delayRender()` and pair it with `cancelRender()`.

### 4. The licence: free most places, restricted in one place that matters

Eligibility for the Free License is explicit: an individual (personal **or commercial**), an organisation of up to 3 people, a non-profit, or evaluation before commercial use ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)). There is no feature gate between tiers — "There is no difference in functionality between the Free License and Company License" ([license FAQ](https://www.remotion.dev/docs/license/faq)). Government bodies, universities and trade associations need written permission even if non-commercial ([FAQ](https://www.remotion.dev/docs/license/faq)).

Above 3 people the Company License is defined by *activity*, not seats, which is the unusual part:

| Activity | Plan | Price |
|---|---|---|
| People writing Remotion code or building motion systems by hand | Remotion for Creators | 25 USD/month per seat |
| Code calling `renderMedia()`, `renderMediaOnLambda()`, `<Player>` or `npx remotion render` | Remotion for Automators | 0.01 USD/render, 100 USD/month minimum |
| Compliance forms, private Slack, consulting, Editor Starter | Enterprise | from 500 USD/month |

A "render" is one successful video, audio, GIF, still or sequence — Studio and Player previews are free, and each render carries a usage counter. Automators is triggered by shipping an *automation*, which reaches further than it sounds: embedding a `<Player>` in a product counts ([FAQ](https://www.remotion.dev/docs/license/faq)).

The clause to read twice is the disallowed use: you may not "copy or modify Remotion code for the purpose of selling, renting, licensing, relicensing, or sublicensing your own derivate of Remotion" ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)). Building products *with* Remotion is fine at any size once licensed; building a competing framework *from* Remotion's code is not. Remotion describes itself as "source-available", never "open source" ([about](https://www.remotion.dev/about)).

### 5. Who is behind it, and how healthy is it

Remotion is a Zurich company, not a hobby repo: started 2021 as a side project, now a three-person team led by creator Jonny Burger, seed-funded with CHF 180k from users and customers in 2022, and stating it is profitable and needs no outside investment ([about](https://www.remotion.dev/about), [seed funding post](https://www.remotion.dev/blog/seed-funding)). They publish a succession plan — the project falls to William Candillon if the founders disappear ([about](https://www.remotion.dev/about)).

Signals of real scale: 2M+ renders/month, 400+ customers on the about page against "over 800 customers" on the homepage, 72.2k GitHub stars, 6.0k forks, 2.2M weekly npm downloads, and v4.0.542 published 2026-11-09 ([about](https://www.remotion.dev/about), [repo](https://github.com/remotion-dev/remotion), [socket.dev](https://socket.dev/npm/package/remotion)). Burger himself authors most commit entries in a given release ([releases](https://github.com/remotion-dev/remotion/releases)).

That concentration is the risk: three people, one of whom largely is the project, with a bus factor papered over by a named successor rather than a foundation or a maintainer bench.

### 6. The agent story is now a first-class surface

Remotion ships a dozen Agent Skills (`/remotion-best-practices`, `/remotion-create`, `/remotion-markup`, `/remotion-maps`, `/remotion-captions`, `/remotion-saas`, `/remotion-license`, `/remotion-upgrade`), installable with `npx skills add remotion-dev/skills`, plus a ChatGPT plugin and prompt-to-video templates ([ai/skills](https://www.remotion.dev/docs/ai/skills), [docs home](https://www.remotion.dev/docs/)). The model suits an agent unusually well: a frame is a pure function of a number, so a wrong render is a wrong component, not a mistimed scrub.

The licence FAQ now writes "or using agentic coding tools" into the Creators seat definition, so agent-assisted authoring sits inside the paid tier ([FAQ](https://www.remotion.dev/docs/license/faq)).

### 7. Where it is the right tool, and where it is not

| Situation | Verdict | Why |
|---|---|---|
| 10k personalised videos from a template plus data | Strong fit | Parameterisation and Lambda chunking are the product ([docs](https://www.remotion.dev/docs/)) |
| Data-driven chart or dashboard explainers | Strong fit | Charts are already React; a frame maps to rows of data |
| Animated asset library for a design system | Strong fit | Components and props, versioned in git |
| Prompt-to-video SaaS with in-app preview | Strong fit | `<Player>` plus web renderer plus Lambda ([player](https://www.remotion.dev/docs/player/player)) |
| One hand-cut narrative video | Weak fit | Keyframes beat React for footage assembly |
| Offline GPU or heavy 4K grade | Weak fit | Lambda CPU-only, no AV1, ~5 GB cap ([compare-ssr](https://www.remotion.dev/docs/compare-ssr)) |
| A 2-hour render at Full HD | Weak fit | The Lambda storage cap puts it near the ceiling ([Lambda](https://www.remotion.dev/docs/lambda)) |
| Skipping the licence at 20 people | Not free | Headcount, not seat count, decides ([FAQ](https://www.remotion.dev/docs/license/faq)) |
| Shipping a competing framework built on their code | Not permitted | Derivative sale excluded ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)) |

Platform support is narrower than the React ecosystem it borrows from: Node 16+ or Bun 1.0.3+, macOS 15+, glibc 2.35+, **Alpine and nixOS unsupported** ([docs home](https://www.remotion.dev/docs/)), and renders must use the Chrome Headless Shell Remotion downloads — distro Chrome removed headless mode and stalls renders, so pointing `--chrome-executable` at a package-manager Chrome is a trap ([stuck render](https://www.remotion.dev/docs/troubleshooting/stuck-render)).

### 8. Alternatives, by what you actually want

| Tool | Model | Licence | Status |
|---|---|---|---|
| Remotion | React component per frame, headless Chrome + FFmpeg | Remotion License, paid above 3 people | v4.0.542, releases daily |
| Motion Canvas | TypeScript generators plus timeline editor | MIT | Core stalled: last release 3.17.2, 2024-12-14 |
| Canvas Commons | Motion Canvas fork | MIT | 0.4.0, 2026-09-24 |
| Revideo | Motion Canvas fork with renderer and React player | MIT | 0.11.0, 2026-07 |
| HyperFrames | HTML composition to headless Chrome | — | Same capture pipeline as Remotion ([getmasset](https://www.getmasset.com/resources/blog/hyperframes-vs-remotion-review)) |

The Motion Canvas comparison states the fork plainly: Remotion's declarative per-frame model "makes any frame independently renderable, which is what allows Remotion to split a render across many machines", where Motion Canvas's procedural generator model suits explainer animation choreographed to a voice-over ([metavert](https://metavert.io/compare/remotion-vs-motion-canvas)). If neither distribution nor licence changes your answer, Motion Canvas's MIT terms are the cheaper choice — with the caveat that its core repo has not shipped since December 2024 and the work has moved to forks.

## Open Questions

- **v5 licence.** LICENSE.md opens with "In Remotion 5.0, the license will slightly change" and links a PR; the delta is unread here ([LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)). Pricing after the change is unknown.
- **Rendering throughput.** No first-party frames-per-second-per-slot benchmark exists; the third-party optimisation guide is the only source and cites no methodology ([rendercomp](https://rendercomp.com/blog/remotion-performance-optimization-guide/)).
- **Web renderer ceiling.** The limitations list for `@remotion/web-renderer` was not read in full; how much of a real composition it covers is unmeasured ([web-renderer](https://www.remotion.dev/docs/web-renderer)).
- **Customer-count drift.** 400+ on the about page against 800+ on the homepage, same day — one is stale, which is unknown.
- **Metering.** How render counts are enforced for Automators (client-side counter, licence key, `getUsage()`) is not established here.

## Related

- [Modern JavaScript Video Player Libraries — 2026 Landscape](./js-video-player-libraries.md) — the playback half of the same domain: Video.js v10, hls.js, Shaka.
- [Bun's AOT Compiler — `bun build --compile`](./bun-aot-compiler.md) — Bun as a supported Remotion runtime, and where compiled binaries fit.

## Changelog

- 2026-11-10 — created. Read against v4.0.542 (published 2026-11-09). All sources gathered through TinyFish search and fetch; no fallback tooling used.
