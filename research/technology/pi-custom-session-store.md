---
title: pi Custom Session Store — The Directory Knob, the Extension Takeover, and What Breaks
category: technology
tags: [pi, pi-coding-agent, session-dir, sessionDir, session-storage, extensions, session-manager, sqlite, postgres, t3code]
status: complete
created: 2026-11-03
updated: 2026-11-03
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sessions.md#L60
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/settings.md#L66
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/cli.md#L96
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/environment-variables.md#L82
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/session-format.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/extensions.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/configuration.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L590
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/types.ts#L355
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L5812
  - https://pi.dev/docs/latest/sessions
  - https://pi.dev/docs/latest/settings
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/packages/provider-pi/src/server/usage.ts#L134
confidence: high
---

# pi Custom Session Store — The Directory Knob, the Extension Takeover, and What Breaks

## TL;DR

- **Yes, three ways, and only one of them is documented as a contract.** Move the directory
  (`--session-dir` > `PI_CODING_AGENT_SESSION_DIR` > `sessionDir` setting), override the write
  call from an extension, or hydrate `SessionManager.inMemory()` from your own table.
- **A custom directory is flat.** The per-cwd `--path--` grouping exists only under the default
  `~/.pi/agent/sessions`
  ([session-manager.ts:590](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L590)).
  Every project's sessions land as siblings in one directory, distinguished only by the `cwd`
  in each file's header.
- **`/resume` then looks only there.** With a custom directory, the picker's "All" tab scopes to
  that directory instead of walking `~/.pi/agent/sessions`
  ([interactive-mode.ts:5812](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L5812))
  — a session written to the default store by a run without the variable is invisible.
- **No lock, so concurrent writers fork silently.** Two processes on one session file append
  cleanly (0 unparseable lines, no duplicate ids) but both new user turns take the *same*
  `parentId`; the next resume follows one branch and drops the other from context.

## Context

Question asked 2026-11-03: *can I create a custom store for pi session data?* It has three
different answers because "store" means three different things — a different directory, a
different filesystem, or a different database. This file covers the first two and the extension
hook between them; the database answer lives in
[pi-coding-agent Sessions in Your Own Store — The In-Memory Seam](./pi-session-persistence-external-store.md).

Everything below was run against `@earendil-works/pi-coding-agent` **1.5.0** (tag `v1.5.0` =
`f9a26365`) on Node 26.13.0, in throwaway `PI_CODING_AGENT_DIR` sandboxes, against a local
OpenAI-compatible endpoint (`9Router/deepseek`).

## Findings

### 1. The directory is a first-class knob with a three-deep precedence

`sessionDir` is the one setting pi reads *before* it resolves project trust, because it needs it
to find sessions at all
([configuration.md](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/configuration.md),
[security.md:31](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/security.md#L31)).

| Dimension | `--session-dir <dir>` | `PI_CODING_AGENT_SESSION_DIR` | agent `sessionDir` | project `.pi/settings.json` `sessionDir` | `sessions/` symlink |
|---|---|---|---|---|---|
| Precedence | 1, highest | 2 | 3 | 3 | replaces the default path |
| Scope | one invocation | whole process tree | every session on this agent dir | one project | everything, all tools |
| Needs project trust | no | no | no | **no** | no |
| Relative path resolves from | cwd (verified) | cwd [unverified] | cwd (verified) | cwd (verified) | — |
| Layout inside | flat | flat | flat | flat | default per-cwd subdirs |
| Picker "All" scope | that dir | that dir | that dir | that dir | unchanged |
| Probe result | 1 file, default store 0 | 1 file | 1 file | 1 file | 1 file under the target |

The precedence claims are the docs' own
([cli.md:96](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/cli.md#L96),
[settings.md:66](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/settings.md#L66))
and each was confirmed by writing through the override and checking which directory gained a file.

**The trust exception is worth naming.** Pi resolves `sessionDir` before it decides whether to
trust the project, so an untrusted `.pi/settings.json` still redirects where your transcripts
land — verified with `-na` (decline trust): the session appeared in the project-declared store,
and not in the agent store. Trust gates extensions, skills and context files, not this path.

### 2. What a custom directory changes

- **Grouping disappears.** Default is `~/.pi/agent/sessions/--<cwd with / and : as ->--/`. Point
  `sessionDir` anywhere and files go straight into it, named
  `<ISO timestamp, : and . as ->_<session-id>.jsonl`
  ([session-manager.ts:1080](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1080)).
  The `cwd` field in the header is the only remaining project key.
- **Lookup filters by cwd from the header.** `SessionManager.list(cwd, customDir)` returns the
  subset whose header `cwd` matches; `SessionManager.listAll(customDir)` returns everything
  ([session-manager.ts:1916](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1916)).
  Probe: 2 files in one store, both `/tmp/psD/work` → `list` 2, `listAll` 2; a store holding a
  different cwd's session → `list` 0.
- **Resume still works by id, path, and from another cwd.** Partial-UUID resume appended to the
  same file; `--session /tmp/.../restored.jsonl` resumed a copy outside any session directory;
  a resume from a *different* cwd prints `Session found in different project: <cwd>` and offers to
  fork into the current directory.
- **`/new` stays inside it.** In the TUI with the variable set, `/new` created a fresh UUID file
  in the same custom directory — it does not reuse a `--session-id` you started with.
- **The resume hint carries the flag.** Pi's "resume this session" command line includes
  `--session-dir <dir>` whenever the manager is not on the default directory
  ([interactive-mode.ts:344](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/interactive/interactive-mode.ts#L344)).

### 3. Symlinks work, dangling symlinks do not

Verified both directions, because "make `sessions` a symlink" is the zero-config way to relocate
the store:

| Setup | Result |
|---|---|
| `~/.pi/agent/sessions` → existing directory | works; files appear under the target, still per-cwd (`--tmp-psY-work--/`) |
| `~/.pi/agent/sessions` → missing path | **pi does not start**: `ENOENT: no such file or directory, mkdir '<agent>/sessions/--tmp-pa--'` |
| `--session-dir` → existing path | works, including resume and `list` |
| `--session-dir` → path with missing parents | parents are created (`mkdirSync recursive`) |
| `--session-dir` → a *file* | `ENOTDIR: not a directory, open '<file>/<timestamp>_<id>.jsonl'` |
| `--session-dir '~/x'` | `~` expands to `$HOME` |

The dangling case is the one to avoid shipping: Node's `mkdirSync(recursive)` refuses to create
through a broken link, so the failure is at startup, before any UI
([session-manager.ts:1013](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1013)).
Create the target first, or use the setting instead of the link.

### 4. A network mount is the wrong target, even though the knob accepts it

The store is written with `appendFileSync` per entry, plus an `openSync(path, "w")` rewrite when a
legacy session is migrated
([session-manager.ts:1173](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1173)).
Append-and-rename semantics are exactly what S3-API mounts do not provide, so keep the directory
local and ship the files — the runbook is
[Durable pi State on an Ephemeral VM](../howto/durable-pi-state-on-ephemeral-vm.md).

### 5. There is no store interface — but the write call is overridable

`SessionManager` is a final class with a private constructor
([session-manager.ts:1001](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L1001)),
so there is nothing to implement. What you can do instead:

| Layer | Mechanism | Granularity | Contract |
|---|---|---|---|
| Directory | `sessionDir` / env / flag | whole store | **documented** |
| Extension | reassign `ctx.sessionManager._persist` | one entry | underscore API, not a contract |
| SDK | `SessionManager.inMemory(cwd, opts, entries)` | one session | documented constructor argument |

The extension trick works because `_appendEntry` calls `this._persist(entry)`, so an instance
property shadows the prototype method; every append path then funnels through you. Two typing
facts, both checked with `tsc --strict` against the shipped declarations:

- `ctx.sessionManager` is typed `ReadonlySessionManager` — a `Pick<>` of the getters
  ([types.ts:355](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/types.ts#L355),
  [session-manager.ts:245](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/session-manager.ts#L245)).
  `appendMessage` and `_persist` are both compile errors on it, so an extension has to cast.
- `entry_appended` is an `AgentSession` event, **not** in the `ExtensionEvent` union
  ([types.ts:1425](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/types.ts#L1425)).
  `pi.on("entry_appended", ...)` registers without error and never fires; `message_end` fires per
  message role, and `_persist` sees every entry type.

Probed capture: `thinking_level_change, message, custom, compaction` arrived through the override
on a single turn-plus-compaction run. The 1.4.0 sweep that also covered `model_change`, `usage`
and `label` (7 of 7 append paths) is in
[the sibling file](./pi-session-persistence-external-store.md) — the mechanism is unchanged, and
the `this._persist` call site is still there at `session-manager.ts:1198`.

### 6. Taking over the write call means owning the header too

If you replace `_persist` and do not call the original, pi writes nothing, and your store is the
only copy. Two consequences, both hit during probing:

- **You must write the header yourself.** A mirror of bare entries reopens as
  `Error: Session file is not a valid pi session: <path>` — the loader needs the
  `{"type":"session","version":3,...}` first line
  ([session-format.md](https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/session-format.md)).
  With `sm.getHeader()` written on first `session_start`, `--session <your file>` resumes normally
  and keeps appending: history recalled, 4 lines → 7 lines across two runs.
- **A throwing store fails the turn, not the process.** Throwing from `_persist` on a
  `toolResult` ended the run with an assistant message `stopReason: "error"`,
  `errorMessage: "store down"`, the entry dropped from memory (pi pops it so memory cannot point
  at an unwritten parent), and exit code 0. Silence is the risk: the transcript says the *model*
  errored.

### 7. Concurrency: no corruption, silent divergence

Pi assumes one writer per session; the leaf pointer is local state. Measured, not inferred:

| Writer arrangement | Files | Result |
|---|---|---|
| Two processes, same `--session-id`, started together | 2 | two files, same id suffix; neither sees the other |
| Same id, run sequentially | 1 | resumed and appended: 3 user turns, 10 lines |
| Two processes resuming the same file at once | 1 | 18 lines, 0 unparseable, 0 duplicate ids — but both new user turns took `parentId be27d17f` |
| Next resume of that file | — | context = `["first turn", "concurrent one"]`; the other branch is off the active path |

The append survived line integrity in every run — one `appendFileSync` call per entry, 18 lines, nothing
unparseable — and the tree is what breaks: two siblings instead of a
chain, with the loser invisible to the next resume. Give each session exactly one writer — a lease,
or a partition by session id — as the sibling file also concludes.

### 8. The ecosystem already reads the variable

T3 Code's pi provider scans session transcripts for usage metering and honors
`PI_CODING_AGENT_SESSION_DIR`, falling back to `<agentDir>/sessions`
([usage.ts:134](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/packages/provider-pi/src/server/usage.ts#L134));
its docs warn that sessions saved through `--session-dir` or the `sessionDir` *setting* are
invisible unless you also set the environment variable. If a custom store is meant to stay
observable by neighbouring tools, the env var — not the flag — is the durable choice.

## Verdict

| You want | Do this |
|---|---|
| Sessions somewhere else on this machine | `sessionDir` in the agent `settings.json` (or the env var for anything outside a shell that sets it) |
| One project's sessions kept apart | `sessionDir` in `.pi/settings.json`, relative to the cwd |
| Sessions in object storage | local directory + ship the files, never a live mount |
| Sessions in Postgres/SQLite | `SessionManager.inMemory` + `_persist` override, i.e. [the SDK seam](./pi-session-persistence-external-store.md) |
| Every entry mirrored while pi keeps writing | extension that overrides `_persist` and calls the original |

The directory knob is documented, cheap, and reversible; reach for the extension hook only when
you need the *entries*, not the files.

## Gotchas

- **The picker's "All" tab is not global once you relocate.** It scopes to the custom directory,
  so a mixed setup (some sessions default, some custom) hides half of them.
- **Flat storage grows without grouping.** A shared `sessionDir` becomes one directory with every
  project's transcripts; `list()` filters by header `cwd`, but `ls` does not.
- **Untrusted project settings can redirect your transcripts.** `sessionDir` is resolved before
  the trust prompt.
- **`_persist` is underscore-prefixed.** Present in the `.d.ts`, called dynamically, not a
  contract — pin the version and smoke-test on upgrade.
- **A store that throws reads as a model error** in the transcript, with `stopReason: "error"`.
  Fail loudly in your own logs.
- **`--session-id` does not join an existing file across concurrent processes**; it creates a
  second file with the same id. Sequential runs do resume the first.
- **Compaction does not shrink the file.** It appends a summary entry; every message it replaced
  stays in the JSONL, so a long session only grows.

## Evidence

Probe run 2026-11-03, `@earendil-works/pi-coding-agent` 1.5.0, Node 26.13.0, isolated
`PI_CODING_AGENT_DIR` per case:

```text
--- redirect ---
settings sessionDir=/tmp/psA/store      → store 1 file, agent/sessions 0
PI_CODING_AGENT_SESSION_DIR=...         → store 1 file, agent/sessions 0
project .pi/settings.json "../store"    → /tmp/psC/store 1 file
same project setting, run with -na      → /tmp/psC2/store 1 file      (trust is not a gate)
agent setting "./mysessions"            → <cwd>/mysessions 1 file
setting=/tmp/psP/fromSetting + env      → env 1, setting 0
env + --session-dir /tmp/psP/fromFlag   → flag 1, env unchanged
--no-session                            → 0 files
--session-dir ./relstore                → <cwd>/relstore 1 file
--session-dir '~/pisess-probe'          → ~/pisess-probe 1 file
--session-dir /tmp/psW/deep/nested/store → created, 1 file
--session-dir /tmp/psW/afile (a file)   → ENOTDIR: not a directory, open '/tmp/psW/afile/<ts>_<id>.jsonl'
sessions/ -> /tmp/psY/realstore         → realstore/--tmp-psY-work--/<file>
sessions/ -> /mnt/nonexistent/sessions  → ENOENT: no such file or directory,
                                          mkdir '/tmp/pa/agent/sessions/--tmp-pa--'   (pi exits)

--- file layout ---
{"type":"session","version":3,"id":"01a1a061-...","timestamp":"2026-11-03T07:48:42.541Z","cwd":"/tmp/psA/work"}

--- concurrency ---
same --session-id alpha, 2 processes together → 2 files (…_alpha.jsonl twice)
same id, sequential                           → 1 file, 10 lines, 3 user turns
2 processes resuming one file                 → 18 lines, unparseable 0, duplicate ids []
                                                both user turns parentId=be27d17f
                                                next context users ["first turn","concurrent one"]
                                                children of be27d17f: 2

--- extension seam ---
tsc: Property 'appendMessage' does not exist on type 'ReadonlySessionManager'
tsc: Property '_persist' does not exist on type 'ReadonlySessionManager'
_persist override captured: thinking_level_change,message,custom,compaction
pi.on("entry_appended")  → registers, never fires
pi.on("message_end")     → system,user,assistant,toolResult,assistant
mirror as sole store + --session <path> -> resumes it; file grows 4 -> 7 lines
headerless mirror        → Error: Session file is not a valid pi session: <path>
throw on toolResult      → assistant stopReason "error", errorMessage "store down", exit 0
                           pi's own file: session,model_change,thinking_level_change,
                           message(system),message(user),message(assistant toolUse),
                           message(assistant error)

--- SDK seam (1.5.0 re-check) ---
SessionManager.inMemory("/tmp",{id:"s1"},entries) → 2 messages restored, isPersisted false,
                                                     sessionFile null, getSessionDir ""
_persist override captured: thinking_level_change,message,custom,compaction
headerless entries + options.id → header synthesized: {"type":"session","version":3,"id":"h1",...}

--- picker (TUI, env var set) ---
/resume, Current Folder → both custom-dir sessions
Tab to All              → still only custom-dir sessions; a session written to
                          ~/.pi/agent/sessions without the env var did not appear
```

## Related

- [pi-coding-agent Sessions in Your Own Store — The In-Memory Seam](./pi-session-persistence-external-store.md)
  — the database answer: hydrate `SessionManager.inMemory`, override `_persist`, lose the
  path-shaped APIs.
- [Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore](../howto/durable-pi-state-on-ephemeral-vm.md)
  — why the directory must stay local and how to ship it.
- [Hermes-like App on a pi Backend — pi-coding-agent or pi-agent-core?](./hermes-like-app-on-pi-backend.md)
  — the layer choice this knob belongs to.
- [pi-agent-core vs pi-coding-agent — The Loop and the Product](./pi-agent-core-vs-pi-coding-agent.md)
  — why sessions exist only in the coding agent.
- [Pi Package Map — What "Pi Core" Refers To](../reference/pi-package-map.md)

## Changelog

- 2026-11-03 — created, answering "can I create custom store for pi session data". Evidence:
  reads of the 1.5.0 docs (`sessions`, `settings`, `cli`, `environment-variables`,
  `session-format`, `extensions`, `configuration`) plus the pinned tag source
  (`session-manager.ts`, `extensions/types.ts`, `modes/interactive/interactive-mode.ts`), and
  ~30 executed probes in `/tmp` (redirect precedence, trust bypass, symlinks, relative and tilde
  paths, picker scope in a live tmux TUI, concurrent writers, extension `_persist` takeover on a
  real turn, `SessionManager.inMemory` hydration). All probe output quoted verbatim above.
