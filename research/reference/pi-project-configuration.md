---
title: Pi Per-Project Configuration — the .pi Directory and the Project-Trust Gate
category: reference
tags: [pi, pi-coding-agent, project-config, settings, trust, resource-loading, reference]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/configuration.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/themes.md
  - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md
  - local install @earendil-works/pi-coding-agent@1.5.1: dist/core/settings-manager.js, dist/core/trust-manager.js, dist/core/project-trust.js, dist/package-manager-cli.js, dist/extensions/mcp/cli.js, dist/modes/interactive/components/config-selector.js, dist/core/settings-diagnostics.js
confidence: high
---

# Pi Per-Project Configuration — the .pi Directory and the Project-Trust Gate

## Summary

Pi has exactly one project-configuration mechanism: a `.pi` directory in the working
directory. Everything in it is per-project, everything except the `sessionDir` key is gated
behind **project trust**, and a refused prompt leaves an empty project layer: no settings
merged, no resources loaded.

Trust is decided per directory and **inherited by descendants**, so a single
`/home/kevin/Repositories → true` entry in `~/.pi/agent/trust.json` covers every repo beneath
it. The gate only fires when the folder holds something protected — a bare `.pi` is trusted
by default.

| Layer | Location | Trust-gated | Effect |
|---|---|---|---|
| User settings | `~/.pi/agent/settings.json` | no | always loaded |
| User MCP servers | `~/.pi/agent/mcp.json` | no | always loaded |
| Credentials, keybindings, model catalog | `~/.pi/agent/{auth,mcp-auth,keybindings,models}.json` | no | user-global, no project layer |
| Project settings | `<cwd>/.pi/settings.json` | yes | deep-merged over user settings |
| Project MCP servers | `<cwd>/.pi/mcp.json` | yes | project entry replaces the user entry of the same name |
| Project system prompt | `<cwd>/.pi/{SYSTEM,APPEND_SYSTEM}.md` | yes | replaces the user file of the same name |
| Project resources | `<cwd>/.pi/{extensions,skills,prompts,themes}/` | yes | added to the user resource set |
| Context files | `AGENTS.md` in cwd and its ancestors | no | loaded regardless of trust |

## Details

### Set it up

1. Create the file you need under `.pi` — `mkdir -p .pi` then `.pi/settings.json`,
   `.pi/mcp.json`, `.pi/skills/<name>/SKILL.md`, or an extension in `.pi/extensions/`.
2. Trust the folder. Interactively Pi prompts on start; in a script (print, JSON, RPC) pass
   `--approve` for that run, or store the decision once so later runs inherit it:

   ```bash
   pi --approve -p "ok"               # one run only
   # or a saved decision, from the TUI: /trust
   ```

3. Write project config with the `--local` flag of the command that owns it —
   `pi config --local`, `pi install <src> --local`, `pi mcp add --local` — or edit the file.
4. The interactive prompt applies to that start. A `/trust` decision does not — it waits for
   the next process, so restart Pi after saving one.

`pi config` starts global and switches scope with Tab; `--local` starts in the project. In the
project view each inherited resource cycles through inherit / `+` / `-`, and inherited globals
are dimmed.

### Resolution order, and what an absent decision means

`resolveProjectTrusted()` (`dist/core/project-trust.js`) answers in this order:

1. `--approve`/`-a` or `--no-approve`/`-na` for this process.
2. **No protected resource present** → the nearest saved decision, else `true`. An ungated
   folder is trusted, not asked about.
3. The `project_trust` extension event. The first user-level or command-line extension that
   returns yes or no owns the decision (`dist/core/extensions/runner.js`), and its
   `remember` flag persists the answer.
4. The nearest saved decision in `~/.pi/agent/trust.json`.
5. `defaultProjectTrust`: `"ask"` (default), `"always"`, `"never"` — **agent-directory
   settings only**, so a project cannot set the switch that decides whether projects load.
6. The interactive prompt; without a UI, `false`.

Print, JSON, and RPC modes cannot prompt, so an ask-tier folder falls to `false` and the
project layer is dropped silently. `--approve` is the explicit answer there.

### Trust is resolved per runtime, never mid-session

`main.js` builds each runtime with
`SettingsManager.create(cwd, agentDir, { projectTrusted })` and resolves `projectTrusted`
right before it, keyed by cwd in `projectTrustByCwd`. Trust is skipped only when a CLI
override exists, the cwd was already resolved, or the cwd has no protected resources.
`/trust` saves a decision and reports `Restart pi for this to take effect.` — the running
session keeps what startup decided. Selecting a session from another project builds a runtime
for that project's cwd and re-resolves trust there.

`/reload` auto-trusts, but only in the narrow case where the session is already trusted, the
cwd has protected resources, and no decision is saved yet (`autoTrustOnReloadCwd`), in which
case it writes `trustStore.set(cwd, true)`.

### Trust is inherited, and one folder decides for its subtree

`ProjectTrustStore.getEntry(cwd)` walks `cwd` upward to `/` and returns the first decision it
meets (`dist/core/trust-manager.js`, `findNearestTrustEntry`). A decision on a parent covers
every child; a child entry wins inside that child. The store is `~/.pi/agent/trust.json`:

```json
{
  "/home/kevin/.t3": true,
  "/home/kevin/Repositories": true
}
```

Keys are canonicalized absolute paths; values are `true`, `false`, or `null`, where `null`
records "inherit". `/trust` saves the decision for the current directory, and
`getProjectTrustOptions()` also offers **Trust parent folder** (parent `true`, cwd `null`) and
**Do not trust**.

### The gate needs a trigger to fire

`hasTrustRequiringProjectResources(cwd)` (`dist/core/trust-manager.js`) returns true on the
first match of:

- a file named `settings.json`, `mcp.json`, `SYSTEM.md`, or `APPEND_SYSTEM.md` under `<cwd>/.pi`;
- a `.pi` subdirectory named `extensions`, `skills`, `prompts`, or `themes`;
- `.agents/skills` in `cwd` or any ancestor, except the user-level `~/.agents/skills`, which is
  a trusted user resource.

Measured: a bare `.pi` with no matching child answers `true` with no decision and no UI, and
`false` only once a decision says so. Context files (`AGENTS.override.md`, `AGENTS.md`,
`AGENTS.MD`, `CLAUDE.md`, `CLAUDE.MD`) never raise the gate and load either way, because they
cannot execute anything.

### A refused project is an empty layer

`SettingsManager.loadFromStorage(storage, "project", projectTrusted)` returns `{}` when the
project is untrusted, and `setProjectTrusted(false)` clears project settings already loaded.
Measured against a temp project holding `{"defaultTools":["+codemode"]}`:

```text
untrusted project settings: {}
untrusted effective defaultTools: ["+codemode"]     <- the user value, unchanged
trusted project settings: {"defaultTools":["+codemode"]}
untrusted write: Project is not trusted; refusing to write project settings
```

`assertProjectTrustedForWrite()` throws from `updateProjectSettings()` and from every write
queued through `enqueueWrite("project", ...)`.

### Writes: two commands refuse, one warns

The guard reaches the CLI unevenly, and the difference decides whether a config survives:

```text
$ pi install ./local-ext -l          # exit 1, no file written
Project is not trusted. Use --approve to modify local package config.
$ pi config -l                       # exit 1
Project is not trusted. Use --approve to modify local resource config.
$ pi mcp add --local demo -- echo hi # exit 0, file written
Added project MCP server "demo" in <cwd>/.pi/mcp.json.
The project is not trusted, so <cwd>/.pi/mcp.json is ignored until you start pi in the
project and trust it.
```

`install`/`remove` with `-l` (`writesProjectPackageConfig`) and `config -l` exit non-zero before
writing. `pi mcp add --local` writes its own file directly and only prints the warning, so the
server lands but stays inactive. Both refusing commands accept `--approve` to settle trust for
the one run.

### Merge semantics

`deepMergeSettings(global, project)` merges plain objects recursively with the project side
winning. Arrays are replaced whole, with three exceptions handled in code:

- **`defaultTools`** — a project list of only `+name`/`-name` entries is appended to the
  inherited list, so it modifies the user selection; a list with plain names replaces it.
- **`extensions`/`skills`/`prompts`/`themes`** — user and project entries load together, and an
  exact project entry overrides the user entry for the same resource. A bare entry replaces the
  selection; `+`/`-` modify it. `-builtin:mcp`, `-builtin:codemode`, `-builtin:tool-search`, and
  `-builtin:llama.cpp` are the built-in names.
- **`packages`** — a project declaration replaces the personal one unless it carries
  `autoload: false`, in which case it filters the personal package instead.

Resource paths in project settings resolve from the project `.pi` directory, and from the
agent directory in user settings. `~` and absolute paths work in both.

A few things are deliberately not project-scoped: `keybindings.json` and `models.json`
resolve from the agent directory only (`KeybindingsManager.create(agentDir)`), and
`auth.json`/`mcp-auth.json` are per machine. The system prompt is scoped but replaces rather
than appends to the user file, so a project `SYSTEM.md` displaces the user one instead of
stacking.

### `sessionDir` is the one pre-trust read

`main.js` computes the session directory as `--session-dir`, then `PI_CODING_AGENT_SESSION_DIR`,
then `startupSettingsManager.getSessionDir()`. That startup manager is
`SettingsManager.create(cwd, agentDir)` with no `projectTrusted` option, which defaults to
`true` (`fromStorageWithPaths` → `options.projectTrusted ?? true`), so it reads
`<cwd>/.pi/settings.json` before any trust decision exists. A project `sessionDir` therefore
applies on a folder that is refused moments later — the documented hole in the boundary.

### Writes touch only the changed fields

`persistScopedSettings(scope, ...)` re-reads the target file, copies it, sets only the fields
recorded in `modifiedProjectFields`/`modifiedFields`, and writes it back. An in-app change never
flattens the merged result into the file, and unrelated keys survive:

```text
file after a theme change: { "defaultTools": [ "+codemode" ], "theme": "x" }
```

The setters show the asymmetry. Every user-side setter writes `this.globalSettings` and calls
`markModified` (`setShowImages` touches `globalSettings.terminal.showImages`), and
`updateProjectSettings` is the only path into the project file. Nothing in `/settings` reaches
the project layer; `pi config --local` does.

A project file that failed to parse sets `projectSettingsLoadError`, which suppresses the
project write rather than overwriting the file with a partial view. The error still surfaces:
`collectSettingsDiagnostics()` turns each drained error into an
`Invalid settings file <path>: <message>` warning.

## Gotchas

- **An empty `.pi` is silently trusted.** The gate is the presence of a protected child, not of
  the directory, and an ungated folder resolves `true` from the store's nearest entry.
- **An inherited `true` is invisible until it surprises you.** Every repo under a trusted parent
  loads its `.pi/settings.json` and `.pi/extensions/` with no prompt, so a freshly cloned repo
  can run extension code the first time it is opened.
- **`pi mcp add --local` succeeds in a folder Pi will not load.** The file lands, the exit code
  is 0, and nothing reads it until the project is trusted.
- **Print/JSON/RPC runs drop the project layer** under the default `ask`. Pass `--approve`, or
  set `defaultProjectTrust: "always"` in `~/.pi/agent/settings.json`.
- **A malformed `trust.json` kills CLI commands.** `readTrustFile()` rethrows
  `Failed to read trust store <path>: ...`; `pi install -l` exits 1 with an uncaught error and
  a stack trace, not a warning.
- **A malformed project `settings.json` is skipped, not fixed.** Pi records an
  `Invalid settings file` warning and ignores the file, and every project write is suppressed
  until it parses again.
- **One `.pi` per working directory.** Launching from `packages/api` ignores `<repo>/.pi`;
  `packages/api/AGENTS.md` loads only when that directory is the cwd or above it.
- **`/settings` cannot reach the project layer.** Only `pi config --local` and a hand edit can,
  and both stop at the same gate.
- **Trust is not a sandbox.** After startup, tools keep the OS permissions of the Pi process.
- **Project MCP servers can be downgraded, not just added.** An entry with no `command`, `url`,
  or `type` overrides only `enabled`, `exposure`, or `toolExposure` of the user server of the
  same name and keeps its credentials — the supported way to disable one server in one repo.

## Related

- [What an Embedded pi Session Reads From Disk — Default Discovery Paths](./pi-sdk-default-discovery.md) — the measured discovery matrix a `projectTrusted: false` settings manager produces.
- [Pi Coding Agent — Which AGENTS.md Files It Loads](../technology/pi-agents-md-context-discovery.md) — the context-file half of per-project instructions, which trust does not gate.

## Changelog

- 2026-11-10 — created. Paths, resolution order, trigger list, merge exceptions, and the write
  guard read from `@earendil-works/pi-coding-agent@1.5.1` dist; ungated/linked trust, refused
  writes, `mcp add --local`, and the malformed-store failure measured with `node` probes and
  the `pi` CLI against temp projects.
