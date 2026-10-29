---
title: Effect-TS for CLI Projects — Built-In Modules and the Surrounding Libraries
category: technology
tags: [effect, effect-ts, effect-v4, cli, typescript, terminal, prompts, tui]
status: complete
created: 2026-10-24
updated: 2026-10-24
sources:
  - https://www.npmjs.com/package/@effect/cli
  - https://www.effect.solutions/cli
  - https://registry.npmjs.org/@effect/cli/latest
  - https://unpkg.com/effect@4.0.5/package.json
  - https://github.com/Effect-TS/effect/tree/main/packages/effect/src/cli
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/index.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/Command.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/Flag.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/Argument.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/Prompt.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/GlobalFlag.ts
  - https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/cli/Completions.ts
  - https://www.infoq.com/news/2026/04/effect-v4-beta/
  - https://ratstack.sh/resources/effect-4-reference-projects
  - https://github.com/Marve10s/awesome-effect
  - https://github.com/PaulJPhilp/effect-cli-tui/blob/main/docs/ARCHITECTURE.md
  - https://github.com/kitlangton/ghui
  - https://www.thomasdeconinck.fr/blog/2026-06-29-effect-ts-termeeting
confidence: high
---

# Effect-TS for CLI Projects — Built-In Modules and the Surrounding Libraries

**Short answer: yes, and you mostly do not need a third-party CLI library.** Effect ships a
first-party CLI framework. On **Effect v4** it lives inside the core `effect` package as the
unstable module `effect/unstable/cli` (barrel file `packages/effect/src/cli/index.ts`).
On **Effect v3** it is the separate npm package `@effect/cli` (latest `0.77.2`), which
arguably counts as a library too — just an Effect-owned one.

The rest of this file is the "what exactly do I get, and what would I add" answer.

---

## 1. What ships in the box

### v4 — `effect/unstable/cli` (inside core)

`effect@4.0.5`'s `exports` map contains `"./cli": "./dist/cli/index.js"` alongside `ai`,
`http`, `rpc`, `sql`, `workflow` and the rest of the unstable modules — 17 of them at the
v4 beta announcement, all importable without a separate dependency. The module barrel exports
twelve submodules, each marked `@stability unstable` / `@since 4.0.0`:

| Submodule | What it gives you |
|---|---|
| `Argument` | Positional parameters: `String`, `Int`, `File`, `Directory`, `Finite`, `Date`, `Literals`, `Path`, `Redacted`, `FileText`, `FileParse`, `FileSchema`; combinators `optional`, `withDefault`, `variadic`, `withDescription`, `withFallbackConfig`, `withFallbackPrompt` |
| `Flag` | Named options: `String`, `Boolean`, `Int`, `Finite`, `Date`, `Literals`, `Path`, `File`, `Directory`, `Redacted`, `FileText`, `FileSchema`, `KeyValuePair`; `withAlias`, `withNegation`, `withMetavar`, `withHidden`, `atLeast`/`atMost`/`between`, `mapEffect`, `withSchema` |
| `Command` | `make`, `withHandler`, `withSubcommands`, `withSharedFlags`, `withGlobalFlags`, `withAlias`, `withDescription`, `withExamples`, `unlisted`, `provide`/`provideEffect`, `validate`, `wizard`, `run`, `runWith` |
| `Prompt` | A full interactive prompt TUI: `Confirm`, `Date`, `Int`, `Number`, `List`, `File`, `Select`, `AutoComplete`, `MultiSelect`, `Text`, `Toggle`, plus `Theme`/`makeTheme`, validation, and `All`/`Return` tuple-object combinators |
| `GlobalFlag` | Action flags (run and exit) vs setting flags (parsed value injected through `Context`); built-ins: `Help`, `Version`, `Wizard`, `Completions`, `LogLevel` |
| `Completions` | `generate` for `bash` / `zsh` / `fish` / `powershell` from a command descriptor tree |
| `CliConfig`, `CliError`, `CliOutput`, `HelpDoc`, `Param`, `Primitive` | Config fallbacks, typed CLI errors, styled output, help document model, shared primitive parsers |

Minimal shape, from the Effect Solutions CLI guide:

```ts
import { Argument, Command, Flag } from "effect/unstable/cli"
import { BunServices, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

const name = Argument.string("name").pipe(Argument.withDefault("World"))
const shout = Flag.boolean("shout").pipe(Flag.withAlias("s"))

const greet = Command.make("greet", { name, shout }, ({ name, shout }) =>
  Console.log(shout ? `Hello, ${name}!`.toUpperCase() : `Hello, ${name}!`)
)

Command.run(greet, { version: "1.0.0" }).pipe(
  Effect.provide(BunServices.layer),
  BunRuntime.runMain
)
```

`--help` and `--version` come for free; nothing is wired by hand.

### v3 — `@effect/cli` (separate package)

Same design, `Options` and `Args` instead of `Flag` and `Argument`. Subpath exports list the
module surface: `Args`, `Command`, `Options`, `Prompt`, `CliApp`, `CliConfig`, `ConfigFile`,
`HelpDoc`, `Usage`, `Primitive`, `AutoCorrect`. It needs a platform package for the runtime
services it touches (filesystem, terminal) — `@effect/platform-node` or
`@effect/platform-bun` — wired in through `NodeContext.layer` / `BunServices.layer`.
The docs list the same built-ins: `--help`, `--version`, `--log-level`, `--completions`, and
`--wizard` (an interactive walkthrough that builds the command for you).

### What the built-ins actually buy you

| Capability | Built-in? | Notes |
|---|---|---|
| Typed arg/flag parsing | Yes | `Schema`-backed; parser and types cannot drift |
| Subcommands, aliases, hidden commands | Yes | `withSubcommands`, `withAlias`, `unlisted` |
| Auto help `--help` | Yes | Generated from the command tree, with examples support |
| `--version` | Yes | Passed to `Command.run` |
| Shell completions | Yes | `--completions bash|zsh|fish|powershell` |
| Interactive prompts | Yes | `Prompt` module: select, multiselect, autocomplete, confirm, toggle, masked text |
| Prompt-as-fallback for missing args | Yes | `withFallbackPrompt` on args and flags |
| Wizard mode | Yes | `--wizard` / `Command.wizard` |
| Log level flag | Yes | `--log-level`, injected as a setting |
| Colored output / spinners | No | `CliOutput` covers styled output; spinners are yours or a dep |
| Full-screen TUI (alternate buffer, keybinds) | No | See §3 |

Source: the `GlobalFlag` and `Completions` module docs in the pinned v4 source, plus the
`@effect/cli` README.

---

## 2. Why it fits an Effect codebase

The point is not "a parser that happens to be written in Effect". It is that a command handler
is an ordinary `Effect`, so everything you already depend on composes with it:

- Services arrive through `Layer`. `Command.provide` / `provideEffect` attach the layer at the
  command, so `Command.runWith` plus `BunRuntime.runMain` is the whole entry point.
- Typed errors propagate up to one boundary instead of being thrown and caught per command.
- `@effect/cli`'s config file support parses through the same `Schema` as the flags, so CLI
  input and config-file input validate identically.
- Tests run through `@effect/vitest` like any other Effect code — no special harness for the CLI.

The reference projects agree. Rat Stack's Effect v4 survey (studied 2026-09-18) records the CLI
entry as `effect/unstable/cli` `Command.runWith` + `NodeRuntime.runMain` in lalph (a core
maintainer's CLI) and T3 Code, and calls lalph the "closest shape" to a modern Effect CLI.

---

## 3. Third-party libraries — where they still fit

Wide comparison; each column is one library.

| Dimension | `effect/unstable/cli` (v4) | `@effect/cli` (v3) | effect-cli-tui | ghui-style raw TUI | Commander / Yargs / oclif |
|---|---|---|---|---|---|
| Owner | Effect core | Effect core | community | community | third party |
| Install | none — in `effect` | `@effect/cli` + platform pkg | `effect-cli-tui` | `@opentui/core` etc. | own package |
| Arg/flag parsing | built in | built in | passes through | none — you render | its own |
| Prompts | `Prompt` module | `Prompt` module | wraps `@inquirer/prompts` | none | none / plugin |
| Full-screen TUI | no | no | no | yes | no |
| Effect integration | native | native | native wrapper | manual | none |
| Typed errors in prompts | yes | yes | yes (`TUIError`) | manual | no |
| Shell completions | yes | yes | no | no | partial |
| Maturity signal | `@stability unstable` | frozen for v3 | ~small community | app-specific | large, framework-agnostic |

Two caveats worth naming:

- **v4 is unstable by declaration, not accident.** Every file in `packages/effect/src/cli`
  carries `@stability unstable` and `@since 4.0.0`. InfoQ's v4 beta writeup frames these
  modules as deliberately outside semver until they graduate to `effect/*`. Pin a version and
  read the changelog on bumps.
- **v3 is in feature freeze.** An Effect issue thread on command aliases states plainly that
  "Effect v3 is now under a feature freeze". New CLI work belongs on v4.

### When a third-party library still earns its place

- **You need a real TUI** (alternate screen, panes, keybind multiplexing, mouse). No Effect CLI
  module covers this; ghui (a GitHub PR TUI on Bun) builds one directly on OpenTUI, and fold
  ships a "CLI and TUI" as separate surfaces.
- **You need a specific prompt visual** that `Prompt` does not theme to satisfaction.
  `effect-cli-tui` wraps `@inquirer/prompts` behind an Effect interface, which is the
  pragmatic move if your team already standardizes on Inquirer.
- **You are not on Effect at all.** Commander, Yargs, and oclif remain the smaller, dependency-free
  answer; adopting `effect/unstable/cli` pulls in Effect's runtime and `Layer` discipline.

---

## 4. Recommendation

| Situation | Pick |
|---|---|
| New CLI, already using Effect v4 | `effect/unstable/cli` — no extra dependency, `Command.runWith` + platform runtime |
| New CLI, Effect v3 codebase | `@effect/cli` `0.77.x` + `@effect/platform-node` |
| Existing Effect project adding one command | `effect/unstable/cli`, one `Command.make` |
| Need a full-screen TUI | `effect/unstable/cli` for parsing, a TUI renderer for the screen |
| Want Inquirer's exact prompt look | `effect/unstable/cli` for parsing, `effect-cli-tui` (or Inquirer directly wrapped in `Effect.tryPromise`) for prompts |
| No Effect anywhere | Commander or oclif — don't adopt the runtime for arg parsing alone |

## Gotchas

- `@effect/cli` versions drift fast; the widely reported "sample code cannot compile:
  unfulfilled requirement" Stack Overflow case resolved by moving from `0.49` to `0.64`. Match
  the CLI package to the `effect` version.
- v4 CLI needs a platform layer for `Console`/`Terminal`/`FileSystem`; without it, prompts and
  output die on a missing requirement.
- `Prompt`'s environment is `FileSystem | Path | Terminal` — a bare `Effect.runPromise` has none
  of them.

## Related

- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md)
- [Effect v4 Primitives — A Reader's Map](../reference/effect-v4-primitives.md)
- [Effect v4 Production Error Handling](../howto/effect-v4-production-error-handling.md)
- [Drizzle ORM with Effect-TS](./drizzle-effect-integration.md)

## Changelog

- 2026-10-24 — Created. Verified v4 CLI module surface from the pinned `main` barrel and
  `effect@4.0.5` `exports`; `@effect/cli` `0.77.2` from the npm registry.
