---
title: Provide and Invoke Skills in pi — Discovery, Frontmatter, and /skill:name
category: howto
tags: [pi, pi-coding-agent, skills, skill-md, agent-skills, resource-loader, skills-override, howto]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/skills.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/configuration.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/packages.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/cli.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/examples/sdk/04-skills.ts
  - https://agentskills.io/specification
  - https://pi.dev/docs/latest/sdk
confidence: high
---

# Provide and Invoke Skills in pi — Discovery, Frontmatter, and /skill:name

## Goal

Hand the agent a skill it will actually use: a `SKILL.md` whose description routes the model to
it, a location the loader scans, and an invocation path you can force. End state: the skill appears
in the system prompt's skill block, the model loads it on a matching task, `/skill:name` works when
the model misses, and every invalid variant you tried produced a warning you can read instead of a
silent no-op.

Measured on **pi-coding-agent 1.5.0, Node 26.13.0** on 2026-11-06, against throwaway skill trees
in a scratch project. Repo context and SDK setup live in
[Create a Pi Agent Session — SDK How-To](./pi-agent-session-sdk.md).

## Prerequisites

| Requirement | Value |
|---|---|
| Package | `@earendil-works/pi-coding-agent@1.5.0` (CLI or SDK) |
| A skill | A directory with `SKILL.md` (portable), or a standalone `.md` file |
| Frontmatter | `name` and `description` — a missing description is the one field that drops the skill |
| A loader that can read files | `read` or `bash` among the session's tools, or the skill block is omitted from the prompt |
| Project trust | Required for `.pi/skills/` and project `.agents/skills/`; user-scope locations load regardless |

The full contract is the [Agent Skills specification](https://agentskills.io/specification):
`name` ≤ 64 chars, lowercase letters/digits/hyphens, and `description` ≤ 1,024 chars.

## Steps

### 1. Write the SKILL.md

```markdown
---
name: pdf-tools
description: Extract text and tables from PDF files. Use when reading, converting, or inspecting PDFs.
---

# PDF tools

Read references/formats.md before converting.
```

```text
.pi/skills/pdf-tools/
├── SKILL.md
├── references/formats.md
└── scripts/extract.sh
```

The description is the router. Measured: with `description: Extract text and tables from PDF
files. Use when reading, converting, or inspecting PDFs.` a fresh session answered a natural
"I need to pull tables out of a PDF report" prompt by reading `SKILL.md` and then
`references/formats.md` — no `/skill:` needed. A description like "Helps with PDFs" gives the model
nothing to match on.

Frontmatter is validated, but validation is **advisory**. Measured against one directory:

| Variant | Loads? | Diagnostic |
|---|---|---|
| `name`, `description` present | yes | — |
| `name: Bad_Name` (uppercase, underscore) | **yes** | `warning … name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)` |
| `description` of 1,100 chars | **yes** | `warning … description exceeds 1024 characters (1100)` |
| `license`, `compatibility`, `metadata`, `allowed-tools` present | yes | — |
| unknown frontmatter key | yes | — |
| CRLF line endings | yes | — |
| empty body | yes | — |
| `name` differs from the directory name | yes | — (the spec requires a match; pi does not enforce it) |
| no `description` | **no** | `warning … description is required` |
| malformed YAML | **no** | `warning … Flow sequence in block collection must be sufficiently indented …` |
| no frontmatter at all | **no** | *no diagnostic at all* |
| `name` omitted | yes | — (falls back to the parent directory name: `noname-dir/` → `noname-dir`, `fm2/noname-standalone.md` → `fm2`) |

Two consequences: a typo'd name still loads and still enters the prompt, so nothing tells you the
skill is unusable until `/skill:` fails to expand it (step 5). And a frontmatter-less markdown file
silently disappears — check `getSkills().skills` rather than trusting the directory listing.

### 2. Put it where the loader looks

| Location | Scope | Trust gate | Evidence |
|---|---|---|---|
| `<agentDir>/skills/` (default `~/.pi/agent/skills/`) | user | none | loaded with a fresh `agentDir` |
| `<cwd>/.pi/skills/` | project | **yes** | `projectTrusted: false` dropped every project skill |
| `~/.agents/skills/` | user | none | 30 skills loaded from the host even with a fresh `agentDir` |
| `<cwd>/.agents/skills/` and each ancestor up to the git repo root | project | **yes** | dropped with `projectTrusted: false` |
| `settings.skills` entries | user or project | project entries only | see step 3 |
| `additionalSkillPaths` (SDK) / `--skill` (CLI) | either | none | loaded with `noSkills: true` |
| pi package `skills/` dir or `pi.skills` manifest | as the package is scoped | project packages only | [packages.md](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/packages.md) |

The `.agents/skills` walk is bounded by the git root, measured from a cwd two levels below it:
the repo root's `.agents/skills/parent-skill` was found, and a `.agents/skills` one level
**above** the git root was not.

Discovery walks down: a directory containing `SKILL.md` is a skill root and is **not** descended
into further — an `outer/` skill with `inner/` inside it loaded only `outer`. Directories without a
`SKILL.md` are recursed, so `.pi/skills/group/inner-skill/SKILL.md` is found.

A standalone `.md` file directly in a skills directory also loads (`.pi/skills/quick-note.md` →
`quick-note`), but its `baseDir` becomes the skills directory itself, so `references/` paths resolve
against the wrong root. Prefer the directory form.

Project trust is the switch that decides whether a teammate's committed skill can instruct the
model to run code. In the SDK it is `SettingsManager.create(cwd, agentDir, { projectTrusted: false })`;
measured effect on a tree with 6 local skills: total fell 36 → 31, and the only survivor of the
local set was the `agentDir` one.

### 3. Register paths outside those directories

Three ways, in order of permanence:

```bash
# one run, no config change
pi --skill ./vendor/skills
```

```json
// ~/.pi/agent/settings.json (user) or .pi/settings.json (project, needs trust)
{ "skills": ["/abs/path/to/skills", "./relative/to/settings/file"] }
```

```typescript
// SDK: DefaultResourceLoader
const resourceLoader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
  additionalSkillPaths: ["./vendor/skills"],
});
```

Read the setting's semantics carefully — an entry is a **path**, not a skill name:

| `skills` entry | Effect | Measured |
|---|---|---|
| `"/abs/path/skills"` | adds everything under it | `extra-skill` appeared, total 36 → 37 |
| `"./relative"` | resolved from the settings file that holds it | — |
| `"+path"` | force-include an exact path | no change when the path was already enabled |
| `"-path"` | force-exclude an exact path | `-<abs>/pdf-tools` removed it (36 → 35) |
| `"-name"` (bare skill name) | **nothing** | `skills: ["-pdf-tools"]` left it enabled |

Exclusion patterns match the **resolved resource path**, relative to that resource's own base
directory, not to `cwd`:

| Entry in project `.pi/settings.json` | Result |
|---|---|
| `"-/abs/ws/.pi/skills/pdf-tools"` | removed |
| `"-/abs/ws/.pi/skills/pdf-tools/SKILL.md"` | removed |
| `"-skills/pdf-tools"` | removed (base dir is `.pi`) |
| `"-.pi/skills/pdf-tools"` | **no effect** (double `.pi`) |
| `"-skills/agents-skill"` | removed the `.agents` skill (base dir `.agents`) |
| `"-/abs/ws/.agents/skills/agents-skill"` | removed |

A path that does not exist is a warning, not an error: `additionalSkillPaths: ["/tmp/nope"]`
produced `warning … skill path does not exist` and the other paths still loaded.

### 4. Shape what the model sees

Each visible skill costs one prompt block; hidden skills cost nothing and are reachable only by
command. Measured on one project tree:

| Configuration | Skills block | System prompt |
|---|---|---|
| 28 skills discovered | present | **13,923 chars** |
| `skillsOverride` returning `[]` | absent | **1,643 chars** |
| `noSkills: true` | absent | 1,643 chars |
| 1–2 skills | present | ~2,300 chars |

The rendered block, verbatim from a session with two skills:

```text
<skills>
The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
Resolve relative paths against the skill's directory (parent of SKILL.md). Use absolute paths in tool calls.

<available_skills>
  <skill>
    <name>pdf-tools</name>
    <description>Extract text and tables from PDF files. Use when reading, converting, or inspecting PDFs.</description>
    <location>/tmp/skillprobe/ws/.pi/skills/pdf-tools/SKILL.md</location>
  </skill>
</available_skills>
</skills>
```

Three levers:

| Lever | Mechanism | Measured |
|---|---|---|
| `disable-model-invocation: true` | skill skipped by the prompt formatter | omitted from `<available_skills>`, still ran via `/skill:hidden-tool` |
| `skillsOverride` (SDK) | filter or replace the loaded list | keeps only what you return; `sourceInfo` comes from `createSyntheticSourceInfo(path, { source: "sdk" })` |
| `noSkills: true` / `--no-skills` | skip discovery entirely; explicit paths still load | explicit `--skill`/`additionalSkillPaths` survived |

Two measured traps in this area:

- **The block needs a file-reading tool.** With `tools: ["read"]` or `["bash"]` the block is
  present; with `tools: []` or `tools: ["edit"]` it is dropped (prompt 1,572 / 1,927 chars). The
  header sentence even changes to `Use bash to load a skill's file…` when only `bash` is available,
  via `formatSkillsForPrompt(skills, "read" | "bash" | "indirect")`.
- **An inline `Skill` object still needs a real file.** A synthetic entry pointing at
  `/virtual/ghost/SKILL.md` was listed in the prompt, and the model then read a path that does not
  exist and reported `ENOENT`. Point `filePath`/`baseDir` at a real `SKILL.md`, or keep the
  instructions inside `systemPrompt`.

### 5. Invoke it

```text
/skill:pdf-tools extract report.pdf
```

The command inlines the body into the user message rather than asking the model to read the file.
Measured injected text, exactly:

```text
<skill name="pdf-tools" location="/tmp/skillprobe/ws/.pi/skills/pdf-tools/SKILL.md">
References are relative to /tmp/skillprobe/ws/.pi/skills/pdf-tools.

# PDF tools

Read references/formats.md before converting. The codeword is PDFCOOKIE.
</skill>

extract report.pdf
```

With no arguments after the name, the trailing user text is omitted entirely. Both forms worked
with a session whose only tool was `read`, and with a session with **no** tools at all — the body is
already in context, so no read is required.

| Situation | Behaviour | Measured |
|---|---|---|
| `/skill:name args` | body inlined + args appended | `PDFCOOKIE` answered without a `SKILL.md` read when the body was inline |
| `/skill:name` for a hidden skill | works | `/skill:hidden-tool` → read the file, answered `HIDDENCOOKIE` |
| `/skill:no-such-skill` | no throw, no expansion | the literal text reached the model as a user message; it improvised an answer listing the real skills |
| `/skill:spaced name` (name with a space) | **no expansion** | command splits on whitespace; the text arrived verbatim |
| `/skill:slash/name` (name with `/`) | expands | body injected as usual |
| `{ expandPromptTemplates: false }` | **still expands** | skill bodies are not prompt templates |
| `enableSkillCommands: false` setting | **still expands** in the SDK | only affects interactive command discovery |
| Skill added after the session started | invisible until reload | `session.reload()` → newly listed, then `/skill:dyn-skill` answered |
| Model finds the skill on its own | reads `SKILL.md` via `read`/`bash` | traced: `read(.pi/skills/pdf-tools/SKILL.md) → read(.../references/formats.md)` |

The name is the command: a malformed `name` with a space loads and is listed, but is unreachable
through `/skill:`. Names with `/` work but read as paths. Keep to the spec's charset.

### 6. Ship it as a package

```text
my-pi-package/
├── package.json          # { "keywords": ["pi-package"], "pi": { "skills": ["./resources/skills"] } }
└── resources/skills/pdf-tools/SKILL.md
```

```bash
pi install npm:@example/pi-tools@1.0.0
pi install git:github.com/example/pi-tools@v1
pi install ./local-package            # add --local to write .pi/settings.json
```

Without a `pi` manifest, a top-level `skills/` directory is discovered. Versioned npm specs and git
refs are pinned. Project-installed packages load only after project trust, because they can ship
skills that tell the model to run programs.

## Verification

```typescript
import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();
const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir: getAgentDir(), settingsManager,
  noExtensions: true, noPromptTemplates: true, noContextFiles: true,
  additionalSkillPaths: [cwd + "/.pi/skills"],
  skillsOverride: (base) => ({ skills: base.skills.filter((s) => s.filePath.startsWith(cwd)), diagnostics: base.diagnostics }),
});
await resourceLoader.reload();

const { skills, diagnostics } = resourceLoader.getSkills();
console.log("discovered:", skills.map((s) => s.name + (s.disableModelInvocation ? "(hidden)" : "")).join(","));
console.log("diagnostics:", diagnostics.map((d) => d.type + ": " + d.message).join(" | ") || "(none)");

const { session } = await createAgentSession({ cwd, settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(), tools: ["read"], thinkingLevel: "low" });
const listed = (n: string) => session.systemPrompt.includes("<name>" + n + "</name>");

const trace: string[] = [];
session.subscribe((e) => { if (e.type === "tool_execution_start") trace.push(e.toolName + "(" + String((e.args as any)?.path ?? "").replace(cwd, ".") + ")"); });

await session.prompt("/skill:pdf-tools what is the codeword? one word.");
console.log("explicit ->", JSON.stringify(session.getLastAssistantText()), "|", trace.join(" -> "));
session.dispose();
```

Probe output, pi 1.5.0 on 2026-11-06:

```text
discovered: inner-skill,hidden-tool(hidden),pdf-tools,quick-note,agents-skill
diagnostics: warning: description is required | warning: description is required
listed: pdf-tools=true quick-note=true inner-skill=true agents-skill=true | hidden-tool listed: false
explicit  -> "PDFCOOKIE" | read(./.pi/skills/pdf-tools/references/formats.md)
```

| Check | Expected |
|---|---|
| `getSkills().skills` | your skill by name; a missing description or bad YAML keeps it out of this list |
| `getSkills().diagnostics` | empty for a clean tree; every problem is one `type`/`path`/`message` record |
| `session.systemPrompt` contains `<name>your-skill</name>` | the model can see it — absent means hidden, filtered, or no `read`/`bash` tool |
| `/skill:your-skill …` | the answer uses the body, and depends on no file read |
| Natural prompt | the model reads `SKILL.md` (visible in `tool_execution_start`) before answering |

The two duplicate `description is required` warnings are real: that probe passed
`additionalSkillPaths: [cwd + "/.pi/skills"]` while `.pi/skills` was already auto-discovered, so the
same broken file was reported once per path. Point `additionalSkillPaths` only at directories that
discovery does not already cover.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Skill missing from `getSkills().skills`, no diagnostic | No frontmatter block at all | Add `---\nname: …\ndescription: …\n---` |
| Skill missing, `description is required` | Frontmatter has `name` but no `description` | Add a description — it is the only field pi refuses to load without |
| Skill presents but nothing happens on a related task | Description does not state *when* to use it | Rewrite to "does X. Use when Y." |
| `/skill:name` arrives as plain text | The name has a space, or the skill is unknown | Use the spec charset; unknown names do not throw, they reach the model verbatim |
| Command works locally, not on a colleague's clone | Project skills need project trust | Grant trust, or move the skill to `~/.agents/skills` |
| `settings.skills: ["-pdf-tools"]` has no effect | Patterns match resolved paths, not names | Use `"-skills/pdf-tools"` (relative to the resource base dir) or the absolute path |
| `skills: ["-.pi/skills/pdf-tools"]` has no effect | Relative to the base dir, which is already `.pi` | Drop the `.pi` prefix, or use an absolute path |
| New skill file ignored mid-session | Loaded at construction | `session.reload()` (SDK) or `/reload` (CLI) |
| Prompt grew by kilobytes after adding skills | Every visible skill adds name, description, location | `disable-model-invocation: true` for command-only skills, or `skillsOverride` to filter |
| Skill listed but the model claims it does not exist | No `read`/`bash` tool, or the `Skill` object points at a missing file | Add `read`, or fix `filePath`/`baseDir` |
| `warning … skill path does not exist` | `additionalSkillPaths`/`settings.skills` entry has no such path | Fix the path; other paths still load |

## Related

- [What an Embedded pi Session Reads From Disk](../reference/pi-sdk-default-discovery.md) — every skill source plus the `noSkills`/`additionalSkillPaths` matrix, and why `agentDir` cannot remove `~/.agents/skills`.
- [Create a Pi Agent Session — SDK How-To](./pi-agent-session-sdk.md) — where `DefaultResourceLoader`,
  `skillsOverride`, and `noSkills` sit among the other discovery loaders.
- [createAgentSession — pi SDK Entry Point Reference](../reference/pi-createagentSession.md) — the option list behind
  `additionalSkillPaths` and the loader contract.
- [Packaging pi Into Your App — SDK Dependency, Spawned CLI, or Single Binary](../technology/pi-packaging-into-your-app.md) —
  shipping skills to a host that has no `~/.pi`.
- [Coding Agent Features to Port to Pi Extensions](../technology/coding-agent-features-to-port-to-pi-extensions.md) — when a skill is
  not enough and the workflow needs an extension.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`) plus ~20 probe scripts run against scratch skill trees on
  Node 26.13.0: frontmatter validity matrix, discovery from all five locations, the project-trust
  gate, settings exclusion patterns, prompt-block sizing, hidden skills, `/skill:` injection format
  and its failure modes, and `session.reload()` pickup.
