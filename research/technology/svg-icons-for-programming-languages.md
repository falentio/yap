---
title: Open-Source SVG Icon Sources for Programming Languages, Frameworks, and Dev Tools
category: technology
tags: [svg, icons, brand-logos, simple-icons, devicon, iconify, skill-icons, svgl, licensing]
status: complete
created: 2026-10-22
updated: 2026-10-22
sources:
  - https://github.com/simple-icons/simple-icons
  - https://simpleicons.org/
  - https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
  - https://github.com/devicons/devicon
  - https://devicon.dev/
  - https://github.com/tandpfun/skill-icons
  - https://skillicons.dev/
  - https://github.com/pheralb/svgl
  - https://svgl.app/
  - https://github.com/iconify/icon-sets
  - https://icon-sets.iconify.design/simple-icons/
  - https://github.com/lobehub/lobe-icons
confidence: high
---

# Open-Source SVG Icon Sources for Programming Languages, Frameworks, and Dev Tools

Where to get brand marks for languages, frameworks, runtimes, clouds, and dev tooling —
restricted to **open-source / open-license** collections, with the licensing caveat that
makes brand-icon libraries different from ordinary icon sets.

## TL;DR

- **Default pick: [Simple Icons](https://simpleicons.org/)** — 3400+ brands, CC0 on the SVG
  paths, single-color, one icon per brand, npm package + CDN. Best for a compact, uniform
  tech-stack chip row.
- **Want original multi-color logos: [Devicon](https://devicon.dev/)** — dev-centric,
  original + plain + line variants, colored or monochrome, font or raw SVG, MIT.
- **Want color logos with no per-icon styling work: [SVGL](https://svgl.app/)** — MIT site
  code, pretty colored marks, JSON API.
- **Need a huge catalog behind one API: [Iconify](https://icon-sets.iconify.design/)** — 200+
  open-source sets, including Simple Icons, served in a uniform JSON format.
- **Not a library question but a legal one:** every one of these ships third-party
  trademarks. The license covers the file, not the right to use the mark.

## Wide comparison

| Dimension | Simple Icons | Devicon | Skill Icons | SVGL | Iconify | Lobe Icons |
|---|---|---|---|---|---|---|
| Repo | `simple-icons/simple-icons` | `devicons/devicon` | `tandpfun/skill-icons` | `pheralb/svgl` | `iconify/icon-sets` | `lobehub/lobe-icons` |
| Count | 3400+ brands | 150+ named on README; ~450–800 in practice | ~250 dev IDs | ~666 logos | 200+ sets aggregated | ~1700 AI/LLM marks |
| Source license | CC0 (per-icon data varies) | MIT | MIT | MIT | per-set, mixed | MIT |
| Color | Single color, recolorable | Original, plain, line; colored/uncolored | Fixed colorful tiles | Full color | Per-set | Full color + mono |
| Formats | SVG, npm, CDN, PHP/TS types | SVG, icon font, npm, CDN | Rendered PNG strip via URL | SVG, JSON API | JSON, SVG, many frameworks | SVG, PNG, WebP, React |
| Scope | Any brand incl. non-dev | Languages, frameworks, tools | Languages, frameworks, tools | Software + dev brands | Everything | AI/LLM only |
| Best fit | Uniform monochrome stacks | Faithful original logos | README/resume badges | Colored logos fast | One API for many sets | AI vendor logos |

## Simple Icons

- "Over 3400 SVG icons for popular brands" — [repo README](https://github.com/simple-icons/simple-icons).
- Install `npm install simple-icons`; icons are exported one-per-slug and tree-shakeable:
  `import {siSimpleicons} from 'simple-icons'`. Each object carries
  `{title, slug, hex, source, svg, path, guidelines, license}`.
- CDN, no build step: `https://cdn.simpleicons.org/[slug]`, with
  `/[color]` and `/[color]/[darkModeColor]` for theming, and `?viewbox=auto` for
  optically consistent sizing — [repo README](https://github.com/simple-icons/simple-icons).
- Every icon is a single path at `viewBox="0 0 24 24"` — that is the reason it looks
  uniform in a stack, and the reason it cannot reproduce a multicolor logo.
- Per-icon `license` and `guidelines` fields exist but are "an ongoing project"; absence of
  a license entry does not mean the icon is unencumbered —
  [DISCLAIMER.md](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md).

## Devicon

- "Each icon comes in several versions: font/SVG, original/plain/line, colored/not colored,
  wordmark/no wordmark" — [repo README](https://github.com/devicons/devicon). That matrix is
  its differentiator: you can match a design system that wants `original` color marks or
  `plain` monochrome ones.
- MIT licensed, copyright konpa (2015) — [LICENSE](https://github.com/devicons/devicon/blob/master/LICENSE).
- Three consumption paths: the `<i class="devicon-X-plain">` icon font, copy-paste SVG from
  the `icons/` folder, or jsDelivr raw SVG:
  `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/devicon/devicon-original.svg`.
- `master` holds releases with built fonts; `develop` holds unbuilt, unoptimized SVGs.
- Custom build needs Python 3.8 + Firefox (icon build pipeline runs a headless browser) —
  worth knowing before you assume it drops into a Node-only CI.

## SVGL

- Free logo library, ~666 logos on the site, SvelteKit + Tailwind, MIT —
  [repo](https://github.com/pheralb/svgl), [site](https://svgl.app/).
- Ships a JSON API, and the ecosystem has cooked wrappers: SVGL CLI, React, Vue, Svelte, VS
  Code, Raycast, Figma, PowerToys — listed in the repo README.
- Repo contribution guidance is explicit that submitter must "have the right to use it and
  that its license permits adding it to svgl" — MIT on the site does not clear the logos.

## Iconify

- Cross-set aggregator: "200+ open source icon sets. Icons are validated, cleaned up,
  optimised, ready to render as SVG. Updated automatically several times a week" —
  [iconify/icon-sets](https://github.com/iconify/icon-sets).
- Contains the Simple Icons set as one collection —
  [icon-sets.iconify.design/simple-icons](https://icon-sets.iconify.design/simple-icons/).
- The value is one uniform `IconifyJSON` format plus a renderer across frameworks, so the
  same call site can serve a tech logo today and a UI icon tomorrow. License is per
  collection; iconify's own repo says "some icon sets require attribution".
- Icon sanitation matters here: parsing strips scripts, event listeners, fonts, and raster
  images, and hardcodes `currentColor` so CSS `color` recolors the icon.

## Skill Icons

- `https://skillicons.dev/icons?i=js,ts,react,rust&theme=light&perline=3` renders a
  pre-styled multi-tile strip, MIT, ~13.3k stars — [repo](https://github.com/tandpfun/skill-icons).
- It is a **render service**, not an icon library: you get one composed image, not per-icon
  SVG handles. Perfect for a README badge row; wrong for an app that needs individual icons
  with its own hover states.
- No icon PRs accepted ("To keep icons consistent and to ensure browser support") — icon
  coverage depends on the maintainer's backfill.
- Roughly 250 IDs, heavily dev-oriented (`rust`, `tauri`, `bevy`, `svelte`, `workers`, …).

## Lobe Icons

- Narrow but deep at one axis: AI/LLM model and provider logos, ~1700 marks, MIT, with
  `@lobehub/icons-static-svg` on npm and a CDN at icons.lobehub.com —
  [repo](https://github.com/lobehub/lobe-icons).
- The right answer only when the stack you are labeling is AI vendors (OpenAI, Anthropic,
  Mistral, Ollama, …), which Simple Icons covers unevenly.

## Licensing — the part that bites

The repo license and the mark license are two different things:

1. **CC0 on Simple Icons covers the SVG paths**, not the logo. "Simple Icons is released
   under CC0 — though that doesn't mean to imply that all icons within the project are also
   CC0. Please see individual licenses where available" —
   [DISCLAIMER.md](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md).
2. **Trademarks survive any license.** Devicon's own README: "All product names, logos, and
   brands are property of their respective owners … Usage of these logos should be done
   according to the company/brand/service's brand policy" —
   [repo README](https://github.com/devicons/devicon).
3. **Brands can force removal.** Simple Icons removes brands on request by the brand owner,
   in twice-yearly major releases with exceptions for immediate removal — same DISCLAIMER.
4. **Practical rule.** Using a logo to *refer to* the technology (a stack chip row, a
   "built with" footer, docs) is what these sets are for. Using it as your own product mark,
   implying endorsement, or recoloring a mark against a brand's guidelines is where the
   license stops helping.

Check the per-icon `license`/`guidelines` fields (Simple Icons) or the collection license
(Iconify) before shipping anything in a commercial, prominent position.

## Decision guide

| Situation | Pick |
|---|---|
| Uniform monochrome tech chips in an app UI | Simple Icons + `cdn.simpleicons.org` |
| Faithful original-color logos, multiple variants | Devicon |
| README / resume skill strip | Skill Icons |
| Pretty colored logos, JSON API, fastest page | SVGL |
| One icon pipeline for UI icons *and* brand logos | Iconify |
| AI/LLM vendor marks | Lobe Icons |

## Recipes

Simple Icons CDN, theme-aware, in plain HTML:

```html
<img src="https://cdn.simpleicons.org/rust" width="24" height="24" alt="Rust" />
<img src="https://cdn.simpleicons.org/rust/000000/ffffff?viewbox=auto" alt="Rust" />
<!--                  slug   light    dark    -->
```

Simple Icons as a tree-shakeable React component:

```ts
import type {SimpleIcon} from 'simple-icons';
import {siRust, siTypescript} from 'simple-icons';

const Logo = ({icon, size = 24}: {icon: SimpleIcon; size?: number}) => (
  <svg role="img" viewBox="0 0 24 24" width={size} height={size} aria-label={icon.title}>
    <path d={icon.path} fill={`#${icon.hex}`} />
  </svg>
);
```

Devicon raw SVG via jsDelivr:

```html
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg" alt="Rust" />
```

## Gotchas

- **Simple Icons is monochrome only.** If a multi-color mark is non-negotiable (Google
  Cloud, Azure, Figma), you need Devicon, SVGL, or the vendor's own brand kit.
- **Pin the major version on CDNs.** Simple Icons' README warns `@latest` "will result in a
  404 error if the icon is removed"; pin `simple-icons@v16` and bump deliberately.
- **Icon slugs ≠ display names.** `nextdotjs` not `nextjs`, `postgresql` not `postgres`,
  `cplusplus`, `visualstudiocode`. Look the slug up; do not guess.
- **Devicon's icon font is the least flexible path.** Copy-paste or raw SVG handles color and
  a11y better than `<i class="devicon-…">` pseudo-content.
- **Do not scrape Logoipsum/SeekLogo/Flaticon-style aggregators.** Their per-asset licenses
  vary and attribution requirements are per-file; the six sources above are the
  redistributable ones.
- **Iconify SVG output is `currentColor` after processing** — brand hex colors are lost
  unless you read the set's metadata.

## Negative results

- **Iconify cannot vouch for trademark use.** It aggregates open-licensed *files*; the
  per-collection license says nothing about brand policy — the same caveat as Simple Icons.
- **Skill Icons gives no per-icon SVG URL contract.** The documented API is a composed strip;
  extracting single icons means reverse-engineering the worker, which is not a stable path.
- **Flaticon / SVGRepo are not clean redistributable sources** for brand marks — they index
  third-party uploads with per-asset licenses and attribution clauses.

## See also

- [Modern JavaScript Video Player Libraries](../technology/js-video-player-libraries.md) — the
  same wide-table format applied to a different library landscape.
