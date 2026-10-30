---
title: Vite+ with SvelteKit — What Works, What Needs a Config Line
category: technology
tags: [vite, vite-plus, sveltekit, svelte, toolchain, rolldown, oxlint, oxfmt, vitest, pnpm]
status: complete
created: 2026-10-30
updated: 2026-10-30
sources:
  - https://viteplus.dev/guide/why
  - https://viteplus.dev/guide/
  - https://viteplus.dev/guide/dev
  - https://viteplus.dev/guide/build
  - https://viteplus.dev/guide/migrate
  - https://viteplus.dev/guide/troubleshooting
  - https://github.com/voidzero-dev/vite-plus
  - https://github.com/voidzero-dev/vite-plus/issues/1756
  - https://github.com/voidzero-dev/vite-plus/issues/869
  - https://github.com/voidzero-dev/vite-plus/issues/857
  - https://svelteconsulting.dev/blog/upgrading-sveltekit-3-vite-plus-node-24
  - https://github.com/ErenayDev/viteplus-svelte
  - https://github.com/davis7dotsh/vite-plus-sv-example
confidence: high
---

# Vite+ with SvelteKit

## Answer

Yes — and there is no SvelteKit integration to install. SvelteKit is a Vite plugin
(`sveltekit()` from `@sveltejs/kit/vite`), and `vp dev` / `vp build` are "the standard
Vite development server" and "the standard Vite production build" behind a different
entry point ([dev](https://viteplus.dev/guide/dev), [build](https://viteplus.dev/guide/build)).
Vite+ says outright that it "integrates with the existing Vite ecosystem and the
frameworks built on top of it, including React, Vue, Svelte, and others"
([Why Vite+](https://viteplus.dev/guide/why)).

Verified end to end on 2026-10-30 with vp 1.3.0 and SvelteKit 3.0: a fresh
`sv create` project migrated, installed, built, and served SSR under `vp dev`
without touching SvelteKit code. See Verification below.

| Concern | Plain SvelteKit | Under Vite+ |
|---|---|---|
| Kit plugin | `sveltekit()` in `vite.config.ts` | Same plugin, wrapped in `lazyPlugins` |
| Config factory | `defineConfig` from `vite` | `defineConfig` from `vite-plus` |
| The `vite` package | `vite@8.x` from npm | aliased to `@voidzero-dev/vite-plus-core` via a pnpm catalog + override |
| dev / build / preview | `vite dev` / `vite build` / `vite preview` | `vp dev` / `vp build` / `vp preview` |
| Lint / format | ESLint + Prettier, usually | Oxlint + Oxfmt via `vp check` |
| `.svelte` formatting | Prettier with `prettier-plugin-svelte` | Needs `fmt: { svelte: true }` — silent skip otherwise |
| `.svelte` type checking | `svelte-check` | Still `svelte-check`; `vp check` does not replace it |
| Scaffolding | `npx sv create` | `sv create` then `vp migrate`, or a community template |

## Details

### What Vite+ actually is here

Vite+ is a meta-package that owns the toolchain: it depends on
`@voidzero-dev/vite-plus-core` (its own Vite core, bundling `vite`), plus Vitest,
Oxlint, Oxfmt and tsdown, and compiles Vite Task. `vp toolchain --global` on the
installed 1.3.0:

```text
vite-plus@1.3.0
├── @voidzero-dev/vite-plus-core@1.3.0
│   ├── bundles vite@8.3.4  (uses rolldown@1.2.14, compiles oxc@0.154.0)
│   └── bundles tsdown@0.23.1
├── vitest@5.0.5
├── oxlint@1.88.0  + oxlint-tsgolint@7.0.2004
├── oxfmt@0.73.0
└── compiles vite-task
```

The consequence for SvelteKit: the Kit plugin is loaded by `vite-plus-core`, not by
npm's `vite`. That is usually invisible, and it is where the two real friction
points live — the `vite` version identity (a lockfile concern) and eager plugin
evaluation (a config concern).

### What `vp migrate` rewrites

`vp migrate` "is the starting point for consolidating separate Vite, Vitest, Oxlint,
Oxfmt, ESLint, Prettier, tsdown, tsup, and tsx setups"
([migrate](https://viteplus.dev/guide/migrate)). On the `sv create` project it
reported `2 config updates applied, 1 file had imports rewritten` and
`Inline Vite plugins wrapped with lazyPlugins for check/lint/fmt`, then produced:

```ts
// vite.config.ts (after)
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  staged: { "*": "vp check --fix" },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [
    sveltekit({ adapter: adapter(), compilerOptions: { /* unchanged */ } }),
  ]),
});
```

```yaml
# pnpm-workspace.yaml (created)
catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.3.0
  vite-plus: 1.3.0
overrides:
  vite@*: "catalog:"
peerDependencyRules:
  allowAny:
    - vite
  allowedVersions:
    vite: "*"
```

`package.json` ends with `"vite": "catalog:"` and `"vite-plus": "catalog:"`, and the
scripts become `vp dev`, `vp build`, `vp preview`, with `prepare` gaining a
`vp config` prefix. SvelteKit's own `check` script is left alone.

Note the shape: Kit 3 keeps its config inside the `sveltekit()` call in
`vite.config.ts` (Kit 3 folded `svelte.config.js` into it), so the file Vite+ takes
over is now also the Kit config file
([svelteconsulting.dev](https://svelteconsulting.dev/blog/upgrading-sveltekit-3-vite-plus-node-24)).
On Kit 2 the adapter stays in `svelte.config.js` and only the plugin sits in
`vite.config.ts`.

### `.svelte` formatting is opt-in, and silent when off

Oxfmt does not touch `.svelte` files unless the config says so. With the migrated
default (`fmt: {}`), `vp check` reported "All 10 files are correctly formatted" while
a deliberately mangled component kept `let x=1` and a double-space attribute. Adding
`fmt: { svelte: true }` produced:

```svelte
<script lang="ts">
  let x = 1;
</script>

<h1 class="a">hi {x}</h1>
```

The same flag appears in a production migration write-up, together with
`sortTailwindcss` pointing at the app's stylesheet
([svelteconsulting.dev](https://svelteconsulting.dev/blog/upgrading-sveltekit-3-vite-plus-node-24)).
Linting is different: `vp lint` does read `.svelte` script blocks — a `debugger` in a
route produced `src/routes/bad.svelte:3:3: warning eslint(no-debugger)` (an unused
const in the same block was not flagged).

## Gotchas

- **Wrap `sveltekit()` in `lazyPlugins`.** `vp check`, `vp lint`, `vp fmt` and the
  Oxc LSP load `vite.config.ts` only to read the `lint` / `fmt` / `staged` blocks, but a
  top-level `sveltekit()` runs Kit's `config` and `configResolved` hooks and creates a
  `.svelte-kit` directory — in a monorepo, at the root as well as in the app. The
  maintainer's fix is `lazyPlugins(() => [sveltekit()])`, and `vp create` / `vp migrate`
  started applying it automatically after #1764
  ([issue #1756](https://github.com/voidzero-dev/vite-plus/issues/1756), closed 2026-06-04).
  vp 1.3.0's `vp migrate` did apply it.
- **`svelte-check` stays.** `vp check` is format plus lint plus type check, and its type
  check runs through `oxlint-tsgolint` (type-aware lint rules), which is not a
  substitute for `svelte-check` on `.svelte` templates. The production migration keeps
  `svelte-kit sync && vp check && svelte-check --tsconfig ./tsconfig.json --tsgo`.
  Verified: `svelte-check` still runs clean alongside `vp check` in a migrated project.
- **`vite` is no longer npm's `vite`.** Anything keyed on a `vite` peer range sees
  `@voidzero-dev/vite-plus-core`, which reports `1.3.0`, not `8.3.4`. That is what the
  catalog alias, the `overrides` entry and `peerDependencyRules.allowAny` absorb; a
  hand-rolled migration has to write them itself — the production write-up did exactly
  that on vp 0.3.x.
- **Vitest moves at Vite+'s pace.** Vitest is a dependency of `vite-plus`, so the
  project's Vitest cannot run ahead of the bundled one (4.1.11 at vp 0.3.3, which is why
  that writer held Vitest 5 back; vp 1.3.0 bundles 5.0.5).
- **`vp dev` and `vp build` ignore your scripts.** Built-in commands cannot be
  overridden: `vp build` always runs the Vite build, so a project whose `build` script
  does extra work must go through `vp run build` or `vpr build`
  ([troubleshooting](https://viteplus.dev/guide/troubleshooting)).
- **Migration floor is Vite 7 / Vitest 4**
  ([troubleshooting](https://viteplus.dev/guide/troubleshooting)). Kit 3 already requires
  Vite 8, which vite-plus-core satisfies; a Kit 2 project on Vite 7 sits at the floor,
  not below it.
- **No first-class Svelte template.** `vp create svelte` does not exist; the request is
  duplicated and open ([#857](https://github.com/voidzero-dev/vite-plus/issues/857),
  [#869](https://github.com/voidzero-dev/vite-plus/issues/869) closed as duplicate). The
  documented path is `vp create vite` then Svelte then SvelteKit, and community
  templates exist: `vp create github:ErenayDev/viteplus-svelte`
  ([template](https://github.com/ErenayDev/viteplus-svelte),
  [minimal example](https://github.com/davis7dotsh/vite-plus-sv-example)).
- **`adapter-auto` noise is Kit's, not Vite+'s.** `vp build` on a fresh project ends
  with "Could not detect a supported production environment"; that is `adapter-auto`
  doing its job, identical under plain `vite build`.

## Verification

Run on 2026-10-30, Linux x64, node 26.13.0, pnpm 12.16.1, in a throwaway directory:

```bash
npx sv@latest create . --template minimal --types ts --no-install   # SvelteKit 3.0, vite ^8.3, TS ^6.0
vp migrate --no-interactive    # migrated to Vite+ 1.3.0, rewrote config and package.json
vp install                     # ok
vp build                       # 173 modules transformed, built in 198 ms, output client + server
vp dev --port 5199             # VITE+ v1.3.0 ready in 1636 ms, 200 GET / with SSR markup
vp check                       # 10 files formatted, 0 errors, 1 warning (empty src/lib/index.ts)
svelte-check --tsconfig ./tsconfig.json   # 0 errors, 0 warnings
```

| Step | Result |
|---|---|
| `vp migrate` on a Kit 3 app | Clean, no manual edit needed; writes the catalog, override and peer rules itself |
| `vp build` | Client and server output built by the Rolldown pipeline |
| `vp dev` (SSR) | Served the rendered Kit page; 1.6 s cold start |
| `vp check` on `.svelte` | Skips formatting unless `fmt.svelte` is on; lints script blocks |
| `svelte-check` | Still required, still clean |

## Gaps

- Kit 2 (Vite 7) against vite-plus-core 8: only Kit 3 was tested here, so whether Kit 2's
  peer range plus the `allowAny` rule holds end to end is unverified.
- `vp preview` under Playwright: on vp 0.3.3 it ignored SIGTERM and hung teardown
  ([write-up](https://svelteconsulting.dev/blog/upgrading-sveltekit-3-vite-plus-node-24)).
  Not reproduced on 1.3.0 — no test run.
- Kit's Vite plugin with `vp test` browser mode (`vite-plus/test/browser-playwright`) is
  in production use per the same write-up, not reproduced here.
- Licensing: a 2025 Reddit thread discusses a paid tier for non-FOSS projects, while the
  docs say Vite+ is "fully open source". Current terms are
  [unverified](https://viteplus.dev/guide/why) until read from the repo's LICENSE and
  pricing page.

## See also

- [Vite CLI Dependencies](./vite-cli-dependencies.md) — what parses and what builds
  `vite`, and why Rolldown in v8 keeps Rollup-API plugins working.

## Changelog

- 2026-10-30: First pass. Docs, issue tracker and a production write-up, plus a live
  `sv create` to `vp migrate` to `vp dev` / `vp build` run on vp 1.3.0.
