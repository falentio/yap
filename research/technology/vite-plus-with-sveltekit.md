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
  - https://viteplus.dev/guide/fmt
  - https://viteplus.dev/guide/lint
  - https://oxc.rs/compatibility.html
  - https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html
  - https://oxc.rs/docs/guide/usage/formatter/language-support.html
  - https://oxc.rs/docs/guide/usage/linter
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

## Linting and formatting `.svelte` files

Vite+ splits the work three ways, and only one of the three understands Svelte markup.

| Layer | Command | What it touches in a `.svelte` file | Engine |
|---|---|---|---|
| Formatting | `vp fmt`, `vp check` | Whole SFC: `<script>`, markup, attributes, `<style>` CSS | Oxfmt via `prettier-plugin-svelte`, gated by `fmt.svelte` |
| Linting | `vp lint`, `vp check` | `<script>` blocks only | Oxlint, "no template linting yet" |
| Type checking | `vp check` | `.ts` / `.tsx` files only, not `<script lang="ts">` | tsgolint on TypeScript 7 |
| SFC types and a11y | `svelte-check` | Template expressions, a11y, compiler warnings | Svelte's own checker, still yours to run |

Oxlint documents the boundary itself: it handles "framework files (`.vue`, `.svelte`,
`.astro`) by linting only their `<script>` blocks"
([linter docs](https://oxc.rs/docs/guide/usage/linter)), and the compatibility matrix
marks Svelte and SvelteKit "No template linting yet"
([compatibility](https://oxc.rs/compatibility.html)).

### Formatting is opt-in, and silent when off

Oxfmt's `svelte` option defaults to **disabled**: "Pass `true` or an object to enable
`.svelte` file formatting, `false` to disable … Default: Disabled"
([config reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html)).
Vite+ carries that through its `fmt` block, so `fmt: { svelte: true }` in
`vite.config.ts` is the switch ([fmt docs](https://viteplus.dev/guide/fmt)).

Off is quiet, which is the trap. On the same project, `vp fmt --check` covered 12 files
without the flag and 17 with it, reporting "All matched files use the correct format" in
the first case while never opening a component. A deliberately mangled component came
through untouched:

```svelte
<!-- before -->
<script lang="ts">
let count:number=0
</script>

<div    class="wrap">
  {count}
</div>

<style>
  .wrap{color:red;padding:0  4px}
</style>

<!-- after `fmt: { svelte: true }` -->
<script lang="ts">
  let count: number = 0;
</script>

<div class="wrap">
  {count}
</div>

<style>
  .wrap {
    color: red;
    padding: 0 4px;
  }
</style>
```

That covers script blocks (`<script module>` included), markup attribute spacing and
self-closing tags (`<img src="logo.png" />`), block indentation, and the `<style>` block,
which is reformatted as CSS. `.svelte.ts` rune modules are ordinary TypeScript and were
formatted without any Svelte flag.

`.svelte` is one of Oxfmt's Prettier-backed formats, not a native one
([language support](https://oxc.rs/docs/guide/usage/formatter/language-support.html)),
which has three consequences:

- Oxfmt does **not** bundle `svelte/compiler`; the project must have `svelte` installed
  or formatting fails ([config reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html)).
  A SvelteKit app always does.
- It needs Node.js, so the standalone `oxfmt` binary from GitHub Releases skips these
  files; the npm package (what Vite+ uses) does not
  ([language support](https://oxc.rs/docs/guide/usage/formatter/language-support.html)).
- `embeddedLanguageFormatting: "off"` fails on Svelte, "a limitation of
  `prettier-plugin-svelte`" ([config reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html)).

Options beyond the flag:

| Option | Default | Effect |
|---|---|---|
| `svelte` | Disabled | `true`, an object, or `false` per override |
| `svelte.allowShorthand` | `true` | `{name}` shorthand allowed when name and expression match |
| `svelte.indentScriptAndStyle` | `true` | Indent content inside `<script>` and `<style>` |
| `svelte.sortOrder` | `"options-scripts-markup-styles"` | Print order of the component's sections, or `none` |
| `singleAttributePerLine` | `false` | One attribute per line, Svelte included |
| `bracketSameLine` | `false` | Closing `>` stays on the last attribute line |
| `htmlWhitespaceSensitivity` | `"css"` | How whitespace is treated in markup |
| `singleQuote` | `false` | Applies to markup attributes and scripts |

All from the [config reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html).

### Linting stops at the script tag

Inside a component, Oxlint sees the `<script>` block and nothing else — no markup, no
`{#each}` / `{#if}` blocks, no attribute expressions, and no `eslint-plugin-svelte`
equivalents such as `svelte/a11y-*` or `svelte/no-at-html-tags`, since those rules parse
the template.

Verified on a fixture set:

| Probe | Result |
|---|---|
| `debugger` in a component script block | `warning eslint(no-debugger)` — fired |
| Unused `const` in a component script block | Not reported |
| Same unused `const` in a `.ts` file | `warning eslint(no-unused-vars)` — fired |
| `{missingVar}` in markup | Not reported by `vp lint` |
| `<img src="logo.png">` with no `alt` | Not reported by `vp lint` |

So rule coverage inside an SFC is uneven in practice: the parse-level rules fire, the
scope-analysis ones do not, and the mapper that extracts the script block is what stands
between them. Treat `vp lint` on `.svelte` as a partial pass, not as the linter you had.

### Type checking of `<script lang="ts">` is `svelte-check`'s

tsgolint type-checks TypeScript files, so a type error that lives in a component script
is invisible to `vp check` while the identical error in a `.ts` file is fatal:

```text
# same wrong assignment, two homes
src/lib/badtype.ts                → x typescript(TS2322): Type 'string' is not assignable to type 'number'.
src/routes/probe-type.svelte      → nothing from vp check
```

`svelte-check` caught both that error and the a11y warning the linter skipped:

```text
src/routes/probe-a11y.svelte:6:1   Warn: `<img>` element should have an alt attribute (svelte a11y_missing_attribute)
src/routes/probe-a11y.svelte:10:5  Error: Cannot find name 'missingVar'. (ts)
src/routes/probe-type.svelte:2:9   Error: Type 'string' is not assignable to type 'number'. (ts)
```

### `vp check` gates on formatting

`vp check` runs the layers in order and stops at the first one that fails: with a
formatting violation plus a lint warning present, the run reported only
`error: Formatting issues found`, and the lint section appeared on the next run after
`vp check --fix`. CI therefore sees one class of failure per run, and the `--fix` pass
belongs ahead of the report pass.

### A configuration that covers all four layers

```ts
// vite.config.ts
export default defineConfig({
  fmt: { svelte: true, singleQuote: true },
  lint: { options: { typeAware: true, typeCheck: true } },
  staged: { "*": "vp check --fix" },
  plugins: lazyPlugins(() => [sveltekit({ adapter: adapter() })]),
});
```

```json
{
  "scripts": {
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:all": "svelte-kit sync && vp check && svelte-check --tsconfig ./tsconfig.json"
  }
}
```

`svelte-kit sync` first: it generates `.svelte-kit/tsconfig.json`, which `svelte-check`
needs and which the Oxc tooling does not produce.

### What the switch costs

| You had | Under Vite+ | Replacement |
|---|---|---|
| Prettier + `prettier-plugin-svelte` | Oxfmt with `fmt.svelte` | Same class of formatting, fewer plugin-specific options |
| ESLint + `eslint-plugin-svelte` (script rules) | Oxlint, script blocks only | Mostly covered; scope-based rules are not |
| `eslint-plugin-svelte` template and a11y rules | Nothing | `svelte-check` compiler warnings |
| `svelte-check` in CI | Unchanged | Still required |
| Type-aware ESLint rules on `.svelte` | Not available | `svelte-check` |

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

- 2026-10-30: Added the lint and format deep dive: the Oxfmt svelte option is disabled by default,
  the three-layer split (Oxfmt on the whole SFC, Oxlint on script blocks only, tsgolint on .ts only),
  measured rule gaps inside SFCs, and the vp check formatting gate.
- 2026-10-30: First pass. Docs, issue tracker and a production write-up, plus a live
  `sv create` to `vp migrate` to `vp dev` / `vp build` run on vp 1.3.0.
