---
title: What an Embedded pi Session Reads From Disk — Default Discovery Paths
category: reference
tags: [pi, pi-coding-agent, sdk, discovery, skills, agents-md, mcp, settings, extensions, isolation, reference]
status: complete
created: 2026-11-06
updated: 2026-11-10
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/resource-loader.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/package-manager.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/sdk.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/extensions/mcp/index.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/extensions/index.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/mcp.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/security.md
confidence: high
---

# What an Embedded pi Session Reads From Disk — Default Discovery Paths

## Summary

Yes: `createAgentSession()` with no options reads the user's home directories exactly like the CLI does.
The two roots are **`<agentDir>`** (`~/.pi/agent` by default) and **`<cwd>/.pi`**, plus a parallel
**`~/.agents`** tree for skills, plus `AGENTS.md` files from every directory between the git root and the cwd.
Opting out is per resource type, not global — and one resource the CLI has is **missing entirely** in
the SDK: the built-in extensions, which is where MCP comes from.

| Resource | Read from (default) | SDK switch | Read by SDK constructors? |
|---|---|---|---|
| Skills | `~/.pi/agent/skills/*/SKILL.md`, `~/.agents/skills/*/SKILL.md`, `<cwd>/.pi/skills`, `<cwd>/.agents/skills` and every ancestor's `.agents/skills` up to the git root | `noSkills`, `additionalSkillPaths`, `skillsOverride` | yes |
| Agent rules | `~/.pi/agent/AGENTS.md`, then `AGENTS.override.md`/`AGENTS.md`/`AGENTS.MD`/`CLAUDE.md`/`CLAUDE.MD` from the git root down to cwd | `noContextFiles`, `agentsFilesOverride` | yes |
| Settings | `~/.pi/agent/settings.json` (global) merged with `<cwd>/.pi/settings.json` (project, wins) | pass `SettingsManager.inMemory()` | yes |
| Extensions | `~/.pi/agent/extensions/**`, `<cwd>/.pi/extensions/**` (trust-gated) | `noExtensions`, `additionalExtensionPaths` | yes |
| Prompts | `~/.pi/agent/prompts`, `<cwd>/.pi/prompts` (trust-gated) | `noPromptTemplates` | yes |
| Themes | `~/.pi/agent/themes`, `<cwd>/.pi/themes` (trust-gated) | `noThemes` | yes |
| System prompt file | `<cwd>/.pi/SYSTEM.md` when trusted, else `~/.pi/agent/SYSTEM.md`; `APPEND_SYSTEM.md` by the same rule | `systemPrompt`, overrides | yes |
| Credentials, model catalog | `~/.pi/agent/auth.json`, `models.json`, `models-store.json` | pass a `ModelRuntime` | yes |
| Session files | `~/.pi/agent/sessions/--<sanitized-cwd>--/*.jsonl` | pass a `SessionManager` | yes |
| **MCP servers** | `~/.pi/agent/mcp.json`, `<cwd>/.pi/mcp.json` (trust-gated) | — | **no** |

That last row is the surprise: MCP is a **built-in extension**, and the SDK constructors load no built-in
extensions. An embedded session reads no `mcp.json` and connects nothing until you add
`createMcpExtension()` yourself.

Evidence: pi-coding-agent 1.5.0 source plus probes run on 2026-11-06 against a fixture project
(`/tmp/pi-disc/ws`) holding one skill in each tree, a project extension, a prompt, a theme, an
`mcp.json`, and an ancestor `AGENTS.md`.

## Details

### The two roots, and the third tree

| Root | Path | Selected by |
|---|---|---|
| Global base dir | `<agentDir>` = `~/.pi/agent` (`getAgentDir()`, `CONFIG_DIR_NAME` from the package's `pi.configDir`) | `agentDir` option, `PI_*` env in the CLI |
| Project base dir | `<cwd>/.pi` | `cwd` option; only consulted when the project is trusted |
| `.agents` tree | `~/.agents/skills`, plus `<dir>/.agents/skills` for each ancestor of cwd up to the git root | `cwd` and `HOME` — **not** `agentDir` |

Discovery code lives in `DefaultPackageManager.collect` (`package-manager.ts`), which merges:
project `.pi/{extensions,skills,prompts,themes}` and ancestor `.agents/skills` when trusted, then
user `~/.pi/agent/{extensions,skills,prompts,themes}` and `~/.agents/skills` always.

### Measured: what defaults pull in

Fixture: 2 project skills (one in `.pi/skills`, one in `.agents/skills`), 1 project extension, 1 prompt,
1 theme, 1 project `mcp.json`, `AGENTS.md` at `/tmp/pi-disc` and `/tmp/pi-disc/ws`.

| Configuration | Skills | of which project | Agent files | Extensions | Prompts |
|---|---|---|---|---|---|
| defaults | **84** | 2 | **3** | **8** | 2 |
| `SettingsManager.create(cwd, agentDir, { projectTrusted: false })` | 82 | 0 | 3 | 7 | 1 |
| `agentDir: "/tmp/pi-disc/empty-agent"` | 32 | 2 | 2 | 1 | 1 |
| all `no*` switches on | 0 | 0 | 0 | 0 | 0 |

Readings:

- 84 skills = **55** in `~/.pi/agent/skills`, **27** in `~/.agents/skills`, 2 project. One
  prompt is the user's (`poteto-mode`), one is the project's.
- **Trust only gates the project `.pi` tree.** With `projectTrusted: false` the project skill,
  extension, and prompt disappeared (84→82, 8→7, 2→1) while all three `AGENTS.md` files stayed. Context
  files are not a trust-gated resource.
- **`agentDir` does not move `.agents`.** Pointing `agentDir` at an empty directory dropped 52
  skills (84 → 32), and **30 skills from `/home/kevin` still loaded** — `~/.agents/skills` is resolved from
  `HOME`, so it survives every `agentDir` override. The three extra entries are names that also exist in
  `~/.pi/agent/skills`: with both trees present the agent-dir copy wins the name dedupe and only 27 `.agents`
  skills survive; with `agentDir` empty all 30 surface. The three `AGENTS.md` files became two (the global one
  went with `agentDir`); extension count 8→1 left only the project extension.

### Switch matrix (measured, same fixture)

| Option | Kills | Leaves |
|---|---|---|
| `noSkills: true` | both user trees **and** project skills (84 → 0) | everything else |
| `noExtensions: true` | user and project extension files (8 → 0) | skills, prompts, AGENTS.md |
| `noContextFiles: true` | global + ancestor `AGENTS.md` (3 → 0) | everything else |
| `noPromptTemplates: true` | user and project prompts (2 → 0) | everything else |
| `disabledBuiltinExtensions: ["mcp"]` | only a built-in you passed in `extensionFactories` | file extensions |
| `additionalSkillPaths: [...]` | nothing | adds a path even when `noSkills: true` — measured 0 → 1 |

The switches are independent, so the isolation recipe is a list, not a flag:

```typescript
const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir: getAgentDir(),
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  systemPrompt: "You are a minimal assistant.",
});
await resourceLoader.reload();
const { session } = await createAgentSession({ cwd, resourceLoader, sessionManager: SessionManager.inMemory(), tools: [] });
```

### Built-in extensions: what the CLI has and the SDK does not

Built-ins arrive through `DefaultResourceLoaderOptions.extensionFactories` as `InlineExtension` values
carrying a name; the loader separates them (`isBuiltinExtension`) and exposes each as a
`builtin:<name>` path that settings or `-e` can enable. `dist/extensions/index.js` exports the bundle as
`builtInExtensions`, but the package's `exports` map exposes only `"."` and `"./rpc-entry"`, and the entry
does **not** re-export `builtInExtensions`.

`createAgentSession` and `createAgentSessionServices` pass no `extensionFactories` (only what you put in
`resourceLoaderOptions`), which is why a probe's extension list held 8 file extensions and **zero**
`builtin:*` entries. What the entry *does* export is the individual factories:

```typescript
import { createMcpExtension, createCodemodeExtension, createToolSearchExtension } from "@earendil-works/pi-coding-agent";

const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir: getAgentDir(), settingsManager,
  extensionFactories: [createMcpExtension()],   // reads ~/.pi/agent/mcp.json + <cwd>/.pi/mcp.json
});
```

Measured consequences for MCP in an embedded session:

| Setup | In the model's tool list |
|---|---|
| no MCP extension (SDK default) | nothing — no `mcp.json` is read at all |
| `createMcpExtension()`, `exposure` defaulted to `"codemode"` | still nothing: the extension loaded as `<inline:1>`, but its tools are callable only from codemode scripts |
| `createMcpExtension()` + `"exposure": "direct"` in `mcp.json` | `mcp__demo__ping` appeared (6 active tools instead of 5), after the background connect on `session_start` |

So MCP for an embedded app is a deliberate two-part decision: add the extension, and choose an exposure
policy per server.

### What still touches disk with every `no*` switch on

| Still read | Why |
|---|---|
| `~/.pi/agent/auth.json`, `models.json`, `models-store.json` | credentials and catalog come from `ModelRuntime`; pass your own runtime to change that |
| `~/.pi/agent/settings.json` + `<cwd>/.pi/settings.json` | unless you pass `SettingsManager.inMemory()` |
| `~/.agents/skills` | it is inside `noSkills` only; `agentDir` never moves it |
| `~/.pi/agent/sessions/--<sanitized-cwd>--/` | unless you pass a `SessionManager` |
| mcp auth + log (`mcp-auth.json`, `mcp.log`) | only when the MCP extension is loaded |

## Gotchas

- **MCP does not work out of the box in the SDK.** No built-in extensions are loaded, so `mcp.json` is
  never read. Add `createMcpExtension()` to `resourceLoaderOptions.extensionFactories`.
- **Even then, default exposure hides the tools.** `"exposure": "codemode"` is the default; the model sees
  no `mcp__*` tools unless the server sets `"direct"` or a tool_search/codemode path loads them.
- **`agentDir` is not a sandbox.** `~/.agents/skills` and every ancestor `.agents/skills` still load.
  `noSkills: true` is the only way to zero skills out.
- **`AGENTS.md` is not trust-gated.** `projectTrusted: false` removed the project skill, extension, and
  prompt but kept all `AGENTS.md` files — they are context, not code.
- **`noExtensions` kills extensions, not their side effects already on disk.** `mcp.json` may still exist
  and be read by other tooling; it is just not read by this session.
- **`additionalSkillPaths` wins over `noSkills`.** The switch suppresses discovery, not explicit paths —
  which is the documented way to expose exactly one skill.
- **The session dir name is derived from cwd.** `<agentDir>/sessions/--home-kevin-Repositories-yap--/`: a
  different cwd is a different directory, so embedded sessions do not collide with the CLI's.
- **`SYSTEM.md` silently changes the prompt.** `<cwd>/.pi/SYSTEM.md` (trusted) or
  `~/.pi/agent/SYSTEM.md` replaces the built-in prompt, and `APPEND_SYSTEM.md` is appended. A "clean"
  SDK session on a machine with a global `SYSTEM.md` is not clean.

## Related

- [Pi Per-Project Configuration — the .pi Directory and the Project-Trust Gate](./pi-project-configuration.md) — what `projectTrusted: false` actually removes, the trigger list that raises the gate, and the inherited trust store behind it.

- [UI Options for a Programmatic pi Session](./pi-sdk-ui-options.md) — the startup screen that
  prints this discovery, and how to host it in-process.
- [AgentSessionServices — the Cwd-Bound Service Bundle in the pi SDK](./pi-agent-session-services.md) — the
  bundle that performs this discovery and reports its diagnostics.
- [createAgentSession — pi SDK Entry Point Reference](./pi-createagentSession.md) — the `no*` switches in
  context, and the default prompt they leave behind.
- [Provide Skills to a pi Session](../howto/pi-skills.md) — the four skill sources, front matter rules, and
  the `<available_skills>` block.
- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the isolation recipe in the
  order you would write it.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`): `package-manager.ts`, `resource-loader.ts`,
  `sdk.ts`, `extensions/index.ts`, `extensions/mcp/*`, `session-manager.ts`, plus probes
  measuring skill/agent-file/extension counts under each `no*` switch, a `projectTrusted: false`
  settings manager, an empty `agentDir`, and a real stdio MCP server with both exposure modes.
