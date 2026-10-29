---
title: Vite CLI Dependencies — What Builds and Parses the `vite` Command
category: technology
tags: [vite, cli, cac, rolldown, rollup, esbuild, bundler]
status: complete
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://www.npmjs.com/package/vite
  - https://github.com/vitejs/vite/blob/main/packages/vite/package.json
  - https://github.com/vitejs/vite/blob/main/packages/vite/src/node/cli.ts
  - https://github.com/vitejs/vite/blob/main/packages/vite/bin/vite.js
  - https://www.npmjs.com/package/cac
confidence: high
---

# Vite CLI Dependencies

Which libraries "Vite's CLI" is built on splits into two questions: what parses the
command line (`vite build`, `vite dev`), and what actually performs the build.

## Answer

| Role | Library | Notes |
|------|---------|-------|
| CLI argument parsing | [`cac`](https://www.npmjs.com/package/cac) | "Simple yet powerful framework for building command-line apps" (v7.1.0); `const cli = cac('vite')` in `src/node/cli.ts` |
| Terminal colors | [`picocolors`](https://www.npmjs.com/package/picocolors) | Used for warnings/errors in the CLI layer |
| Module bundling (v8+) | [`rolldown`](https://www.npmjs.com/package/rolldown) | Direct runtime dependency of `vite@8.3.5` (`~1.2.14`) |
| Module bundling (v3–v7) | [`rollup`](https://www.npmjs.com/package/rollup) + [`esbuild`](https://www.npmjs.com/package/esbuild) | Rollup for prod builds, esbuild for the dev-time transform pipeline |
| CSS compilation | [`postcss`](https://www.npmjs.com/package/postcss), [`lightningcss`](https://www.npmjs.com/package/lightningcss) | `lightningcss` became a direct dependency in v8 |
| Glob matching | `picomatch`, `tinyglobby` | Direct dependencies; file scanning |

The short answer to "what library handles the CLI": **`cac`**. It is bundled
into Vite's published package rather than installed as a runtime dependency, so
`npm ls` on a project using Vite does not show it.

## Details

### `cac` — the CLI framework

Vite's entry point is `bin/vite.js`, declared in `package.json` as
`"bin": { "vite": "bin/vite.js" }`. The bin script only handles pre-flight work
— enabling source maps, `--debug`/`--filter`/`--profile` detection, and Node
version checks — then imports `src/node/cli.ts`, which opens with:

```ts
import { cac } from 'cac'
import colors from 'picocolors'
...
const cli = cac('vite')
```

Every command (`dev`, `build`, `preview`, `optimize`, `--version`, `--help`) is
registered through that `cli` object.

### Bundled, not installed

In `vite@8.3.5`, the runtime `dependencies` are only:

```json
{
  "postcss": "^8.5.30",
  "rolldown": "~1.2.14",
  "picomatch": "^4.0.7",
  "tinyglobby": "^0.2.17",
  "lightningcss": "^1.33.0"
}
```

`cac`, `picocolors`, `rollup`, and `esbuild` appear under `devDependencies`
(and most of them under `peerDependencies` for the optional ones), because Vite
bundles them into `dist/node/` at release time. That is why `cac` is invisible to
a consumer's `node_modules` tree.

### Bundler lineage: Rollup → Rolldown

| Version | Bundler deps (`dependencies`) |
|---------|-------------------------------|
| 3.2.0 | `rollup ^2.79.1`, `esbuild ^0.15.9` |
| 4.5.0 | `rollup ^3.27.1`, `esbuild ^0.18.10` |
| 5.4.15 | `rollup ^4.20.0`, `esbuild ^0.21.3` |
| 6.3.5 | `rollup ^4.34.9`, `esbuild ^0.25.0`, `fdir`, `tinyglobby` |
| 7.1.0 | `rollup ^4.43.0`, `esbuild ^0.25.0` |
| 8.3.5 | `rolldown ~1.2.14` (rollup/esbuild no longer direct deps) |

*v3.2.0 also listed `postcss ^8.4.18`, `resolve ^1.22.1`, `fsevents ~2.3.2`; the table
is abbreviated to the bundling-relevant entries.

So "the library Vite uses to build" changed at v8: Rollup (with esbuild for
dev-time transforms) through v7, Rolldown from v8. The CLI layer did not change —
`cac` still parses commands.

### Not the same as `create-vite`

`create-vite` (the scaffolder run by `npm create vite@latest`) is a separate
package. Its own runtime dependency list is small and unrelated to the build —
it mostly ships template files.

## Gotchas

- `cac` is not in `vite`'s `dependencies`. Searching a `node_modules` tree for it
  finds nothing; read `packages/vite/package.json` in the repo instead.
- `rollup` and `esbuild` remain in v8 `devDependencies`/peer lists for compatibility
  paths and plugin interop, so their presence in a lockfile does not mean v8
  builds with Rollup.
- Vite plugins are written against the Rollup plugin API; Rolldown implements it,
  which is why existing plugins keep working.
