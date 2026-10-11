---
title: Modern JavaScript Video Player Libraries — 2026 Landscape
category: technology
tags: [video, media, player, hls, dash, react, web-components, videojs, vidstack, plyr]
status: complete
created: 2026-10-11
updated: 2026-10-11
sources:
  - https://videojs.org/blog/videojs-10
  - https://videojs.org/blog/videojs-v10-beta-hello-world-again
  - https://videojs.org/docs/framework/react/guides/v10-roadmap
  - https://github.com/vidstack/player/discussions/1747
  - https://plyr.io/
  - https://vidstack.io/docs/player/
  - https://vidstack.io/
  - https://github.com/shaka-project/shaka-player
  - https://github.com/video-dev/hls.js
  - https://github.com/Dash-Industry-Forum/dash.js
  - https://github.com/muxinc/media-chrome
  - https://github.com/videojs/video.js
  - https://www.mux.com/docs/guides/mux-player-web
  - https://elfsight.com/blog/video-player-libraries-compared/
confidence: high
---

# Modern JavaScript Video Player Libraries — 2026 Landscape

## TL;DR

- **The market consolidated in 2026.** Video.js v10 (GA 2026-10-01) is a ground-up rebuild that merges *five* projects — Video.js, Plyr, Vidstack, Media Chrome, and Mux Player — into one Apache-2.0 framework shipped as `@videojs/react` and `@videojs/html` ([videojs.org](https://videojs.org/blog/videojs-10)).
- **Plyr and Vidstack are now maintenance-only.** Plyr receives "security updates only"; Vidstack is "security-only maintenance" until January 2028. Both point new projects at Video.js 10 ([plyr.io](https://plyr.io/), [vidstack.io](https://vidstack.io/docs/player/)).
- **Two distinct layers.** "Player libraries" split into **player UI/framework** (Video.js, Mux Player, Media Chrome) and **streaming engines** (hls.js, dash.js, Shaka Player, VHS, SPF). Pick one of each when you need adaptive streaming.
- **For a new project in late 2026:** default to **Video.js v10** unless you need ads, true low-latency live, or you are locked into a specific host — then reach for **hls.js** (HLS engine), **Shaka Player** (DASH + DRM + ads), or **Mux Player** (Mux-hosted assets with analytics baked in).

## Context

Question asked: *"modern js video player library"*. The repo had no prior coverage (`grep -ri "video\|player\|hls\|dash"` matched only unrelated files). This file answers **which libraries are current, how they relate, and which to choose** as of 2026-10-11, with the bundle-size and maintenance facts cited from primary sources.

The single most important thing to know: 2026 is a **consolidation year**. Several long-standing independent players stopped independent development and converged on Video.js v10, so advice written before 2026 (and much of it still ranking on search) is outdated.

## Findings

### 1. The 2026 consolidation: five players, one framework

Video.js v10 is not a version bump — it is a rewrite of Video.js *and* Plyr *and* Vidstack *and* Media Chrome *and* Mux Player by a combined team, announced 2026-01-21 by the Vidstack maintainer and shipped GA on 2026-10-01 ([discussion #1747](https://github.com/vidstack/player/discussions/1747), [GA post](https://videojs.org/blog/videojs-10)).

Consequences for anyone evaluating options:

- **Plyr is deprecated.** The plyr.io homepage now reads: *"Plyr is now deprecated and receives security updates only. Use Video.js 10 for new projects."* ([plyr.io](https://plyr.io/)).
- **Vidstack is in security-only maintenance** until January 2028; its docs redirect new work to Video.js 10 ([vidstack.io](https://vidstack.io/docs/player/)).
- **Mux Player's maintainers are on the v10 team**, and v10 ships a Mux Player migration guide ([videojs.org](https://videojs.org/blog/videojs-10)).
- **The npm package `video.js` is still v8**; v10 is published as `@videojs/react` and `@videojs/html` ([videojs.org](https://videojs.org/blog/videojs-10)). Do not assume `npm i video.js` gives you v10.

### 2. Two layers: player UI vs streaming engine

A recurring source of confusion is that these libraries do not all do the same job ([elfsight](https://elfsight.com/blog/video-player-libraries-compared/)):

| Layer | What it provides | Examples |
|---|---|---|
| **Player framework / UI** | Controls, skins, state management, accessibility, framework bindings | Video.js v10, Mux Player, Media Chrome, Plyr (legacy), Vidstack (legacy) |
| **Streaming engine** | Manifest parsing, segment loading, ABR, MSE/EME, DRM, ads | hls.js, dash.js, Shaka Player, VHS, SPF |

A player framework often bundles or wires an engine. You only choose an engine separately when you build your own UI or need a capability (DASH, DRM, ads, low-latency) the default engine lacks. Video.js v10 keeps these separate by design: "The player and streaming engine are separate choices" ([GA post](https://videojs.org/blog/videojs-10)).

### 3. Player frameworks — wide comparison

One candidate per column; one dimension per row.

| Dimension | Video.js v10 | Video.js v8 (legacy) | Plyr | Vidstack | Media Chrome | Mux Player | Shaka Player |
|---|---|---|---|---|---|---|---|
| **What it is** | Full player framework (rebuild) | Full player framework (legacy) | Lightweight player UI | Headless UI component library | Web-component control set | Drop-in player for Mux assets | Engine **with** a UI build |
| **Layer** | UI + engine wiring | UI + engine (VHS) | UI only | UI only | UI controls only | UI + Mux engine | Engine (+ optional UI) |
| **Status (2026-10)** | Stable, recommended | Bug/security fixes only | Deprecated (security only) | Security-only until 2028-01 | Active (part of v10 effort) | Active | Active |
| **License** | Apache-2.0 | Apache-2.0 | MIT | Open source [unverified] | Open source [unverified] | MIT | Apache-2.0 |
| **Frameworks** | React + Web Components first-class; TS, Tailwind | Vanilla JS + wrappers | Vanilla + wrappers | React + Web Components | Any (native custom elements) | Web component + React | None official |
| **Adaptive streaming** | HLS (via HlsJsVideo/SPF), DASH | HLS + DASH (VHS) | Needs hls.js/dash.js | Needs hls.js/dash.js | Needs an engine | Mux-hosted (HLS) | HLS + DASH built in |
| **DRM** | Via engine | Via engine | Via engine | Via engine | Via engine | Mux-managed | Widevine/PlayReady/FairPlay/WisePlay/ClearKey |
| **GitHub stars** | — (new repo) | ~39.9k (video.js) | ~30k (archived) | — | ~2.7k | — (muxinc/elements) | ~8.2k |
| **Best for** | New projects, any framework | Existing v8 deployments | (migrate off) | (migrate off) | Custom controls over any player | Teams already on Mux | DASH, DRM, ads, VR |

Star counts and licenses above are from the projects' GitHub pages as fetched 2026-10-11 ([video.js](https://github.com/videojs/video.js), [media-chrome](https://github.com/muxinc/media-chrome), [Shaka](https://github.com/shaka-project/shaka-player), [plyr.io](https://plyr.io/)).

### 4. Streaming engines — wide comparison

| Dimension | hls.js | dash.js | Shaka Player | VHS (Video.js v8) | SPF (Video.js v10) |
|---|---|---|---|---|---|
| **Formats** | HLS only | DASH only | HLS + DASH | HLS + DASH | HLS (simple ABR) |
| **Role** | De-facto HLS engine | DASH reference client | Google's MSE/EME player | v8's bundled engine | Composable engine framework |
| **Minified / gzip** | 503.4 kB / 155.9 kB | 962.1 kB / 294.2 kB | 753.0 kB / 239.1 kB | 434.4 kB / 127.6 kB | **38.5 kB / 12.1 kB** |
| **Light build** | hls.js-light: 328.5 / 103.4 | — | Shaka custom: 350.0 / 115.0 | — | — |
| **DRM** | FairPlay, PlayReady, Widevine (fMP4) | Yes | Full matrix | Yes | Not yet |
| **Ads** | HLS interstitials | — | IMA/DAI, MediaTailor, VAST/VMAP | — | Not yet |
| **v10 compatible** | ✅ | ✅ | ✅ | ✅ | ✅ (native) |
| **License** | Apache-2.0 | BSD | Apache-2.0 | Apache-2.0 | Apache-2.0 |

Bundle figures are the measured sizes published by the Video.js v10 beta post; hls.js feature list and light-build exclusions are from its repo ([beta post](https://videojs.org/blog/videojs-v10-beta-hello-world-again), [hls.js](https://github.com/video-dev/hls.js), [dash.js](https://github.com/Dash-Industry-Forum/dash.js), [Shaka](https://github.com/shaka-project/shaka-player)).

Note the 38.5 kB SPF figure is **HLS-only, no DRM, no ads, no true low-latency**; the GA post is explicit that SPF "doesn't yet support ads or true low-latency live", and that HLS.js-backed `HlsJsVideo` remains the default for HLS ([GA post](https://videojs.org/blog/videojs-10)).

### 5. Bundle sizes — why v10 is the story

Legacy players shipped ~1 MB minified regardless of what you used. v10's composable architecture (import only what you use) and unbundled ABR drive large reductions ([beta post](https://videojs.org/blog/videojs-v10-beta-hello-world-again)):

Player, **without** adaptive streaming (min / gzip):

| Player | Minified (kB) | Gzip (kB) |
|---|---|---|
| Video.js v8 (core) | 260.5 | 75.2 |
| Vidstack | 237.4 | 74.1 |
| Media Chrome | 175.5 | 41.3 |
| Plyr | 109.8 | 32.6 |
| **Video.js v10** Video [HTML] | 97.4 | 25.1 |
| **Video.js v10** Video [React] | 62.0 | 18.0 |
| **Video.js v10** Background Video [HTML] | 22.2 | 6.9 |

Player, **with** adaptive streaming (min / gzip):

| Player | Minified (kB) | Gzip (kB) |
|---|---|---|
| Vidstack + HLS.js | 764.3 | 238.1 |
| Media Chrome + HLS.js | 701.2 | 202.9 |
| Video.js v8 + VHS | 697.0 | 202.7 |
| Plyr + HLS.js | 614.0 | 188.5 |
| Video.js v10 + HLS.js | 526.5 | 164.1 |
| **Video.js v10 + SPF [HTML]** | 144.6 | 38.7 |
| **Video.js v10 + SPF [React]** | 107.3 | 31.6 |

The beta headline was "88% smaller default bundle"; the GA post, comparing against v8 *with* adaptive streaming, reports a **60% reduction** ([beta](https://videojs.org/blog/videojs-v10-beta-hello-world-again), [GA](https://videojs.org/blog/videojs-10)). A minimal React video + play button is reported under 5 kB gzipped.

### 6. Decision guide

- **New project, no special constraints** → **Video.js v10** (`@videojs/react` or `@videojs/html`). Stable, framework-first, smallest bundles, active development.
- **HLS only, building your own UI** → **hls.js** on a raw `<video>`; pair with Media Chrome for controls if you want ready-made ones.
- **DASH, DRM, ads, VR, or live** → **Shaka Player** (broadest format + DRM + ad coverage) or **hls.js** for HLS-specific low-latency.
- **Already hosting on Mux** → **Mux Player** (zero-config Mux Data, thumbnails, live/DVR) unless you want to move to v10.
- **Existing Video.js v8 in production** → stay on v8 short-term; it is bug/security-fixed, with a documented v10 migration path ([roadmap](https://videojs.org/docs/framework/react/guides/v10-roadmap)).
- **On Plyr or Vidstack** → plan a migration; both are maintenance-only and ship migration guides into Video.js 10.

## Open Questions

- Exact v10 **GA bundle numbers** per preset (the published tables are from the March beta; GA cites only a 60% reduction figure).
- **Ads and analytics parity** in v10 are still pending ("ads integration", "analytics support" land in 10.x) — verify before migrating an ad-monetized player ([roadmap](https://videojs.org/docs/framework/react/guides/v10-roadmap)).
- **Media Chrome's long-term status** post-consolidation is not explicitly stated; it is described as part of the v10 effort but the repo still reads as active ([media-chrome](https://github.com/muxinc/media-chrome)).
- Licenses for Vidstack and Media Chrome were not captured from a primary license file and are marked `[unverified]`.

## Related

- [Technology index](./README.md) — index of `research/technology/` findings.

## Changelog

- 2026-10-11 — created. Sources gathered via TinyFish; Video.js v10 GA confirmed 2026-10-01.
