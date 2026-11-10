---
title: UI Options for a Programmatic pi Session — TUI, Custom Surface, or RPC
category: reference
tags: [pi, pi-coding-agent, sdk, ui, tui, interactivemode, rpclient, extension-ui, renderers, reference]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/index.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/interactive/interactive-mode.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/modes/rpc/rpc-client.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/agent-session.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/src/core/extensions/types.ts
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/rpc.md
  - https://github.com/earendil-works/pi/blob/f9a26365568127461c47a07a37dcb42c140a3ac5/packages/coding-agent/docs/sdk.md
confidence: high
---

# UI Options for a Programmatic pi Session — TUI, Custom Surface, or RPC

## Summary

Yes, three ways, and the first one is the surprise: **pi's own terminal UI is importable**. The package
entry exports `InteractiveMode`, `runPrintMode`, `runRpcMode`, and `RpcClient` from `./modes` —
`docs/sdk.md` never mentions them, but they are public exports of the same entry you import
`createAgentSession` from.

| Approach | What you get | Runs where | Best for |
|---|---|---|---|
| `new InteractiveMode(runtime, opts)` → `init()` / `run()` | pi's full TUI: editor, transcript, footer, widgets, extension dialogs | in-process, on the process terminal (or an injected `Terminal`) | a desktop/CLI app that wants pi's UI with your own bootstrap |
| `session.subscribe()` + `bindExtensions({ uiContext, mode })` | your surface, extensions render through it | in-process, your framework | a web UI, a GUI, a custom renderer |
| `pi --mode rpc` or `new RpcClient({ cliPath, cwd })` | JSONL events and commands, extension UI as records | child process | non-Node hosts, sandboxing, an IDE plugin |
| `runPrintMode(runtime, { mode: "text" \| "json" })` | no UI, one answer or an event stream | in-process | headless jobs |

The SDK itself ships no HTML or web UI. The three surfaces above are terminal TUI, your own, and JSON.

Evidence: pi-coding-agent 1.5.0 declarations and source, plus probes run on 2026-11-06 (Node 26.13.0).

## Details

### 1. pi's own TUI, in-process

```typescript
import { InteractiveMode } from "@earendil-works/pi-coding-agent";

const mode = new InteractiveMode(runtime, {        // runtime: AgentSessionRuntime
  tuiMode: "inline",                               // or "fullscreen"
  initialMessage: "Hello",
  terminal,                                        // optional: your Terminal implementation
  initialThemeSetting: "dark",
});
await mode.init();   // renders the startup screen
await mode.run();    // takes over input until quit; stop() exits
```

`InteractiveModeOptions` covers `initialMessage`, `initialImages`, `initialMessages`, `tuiMode`,
`initialThemeSetting`, `terminal`, `verbose`, `startupDiagnostics`, and `modelFallbackMessage`.
The runtime is the same `createAgentSessionRuntime(...)` object from the runtime reference, so every `/new`,
`/resume`, and `/fork` is already wired.

Measured: constructing an `InteractiveMode` over a runtime built with `SessionManager.create()` and calling
`init()` **rendered the real TUI into a piped (non-TTY) process** — the box-drawn header, the cwd, the
context gauge (`0.0%/339k`), the model line (`(bandar) tags/deepseek • medium`), plus the startup sections
for prompts, extensions, and skill-collision warnings — and `init()` resolved. `run()` then owns stdin, so a
headless probe stops at `init()` and calls `stop()`.

Practical caveats: it writes ANSI escape sequences unconditionally (a pipe does not disable them), it
needs `@earendil-works/pi-tui` installed (a transitive dependency of the package), and the `terminal` option
expects a full `Terminal` implementation, not a stream shim.

### 2. Your own UI, with extensions rendering through it

The session hands extensions a UI context at bind time. `ExtensionBindings` is:

```typescript
interface ExtensionBindings {
  uiContext?: ExtensionUIContext;                       // what ctx.ui becomes
  mode?: ExtensionMode;                                 // "interactive" | "print"
  commandContextActions?: ExtensionCommandContextActions;
  abortHandler?: () => void;
  shutdownHandler?: ShutdownHandler;
  onError?: ExtensionErrorListener;
}
```

`ExtensionUIContext` is the whole surface an extension can draw with: `select`, `confirm`, `input`,
`notify`, `setStatus`, `setWorkingMessage`, `setWorkingIndicator`, `setHiddenThinkingLabel`, `setWidget`,
`setFooter`, `setHeader`, `setTitle`, `custom`, `editor`, `pasteToEditor`, `setEditorText`,
`getEditorText`, `addAutocompleteProvider`, `onTerminalInput`, and more — all promises or fire-and-forget
setters, so a web host can implement them against its own components.

Measured with a five-method stub:

| Binding | `ctx.mode` | `ctx.hasUI` | `ctx.ui.select("Pick one", ["a","b"])` | `ctx.ui.notify` | `getEditorText()` |
|---|---|---|---|---|---|
| none | `"print"` | `false` | resolves `undefined`, no throw | no-op | `""` |
| `{ uiContext, mode: "interactive" }` | `"interactive"` | `true` | host called with `("Pick one", ["a","b"])`, returned `"b"` | host called | host's value |
| `{ uiContext, mode: "print" }` | `"print"` | `true` | same | same | same |

Two things to plan around:

- **`mode` does not gate the UI.** `hasUI` is true whenever a `uiContext` exists, even with `mode: "print"`.
  Branch on `ctx.hasUI` and keep `mode` for extension logic.
- **The session itself calls into the context.** On bind it emitted `setStatus("precompute", undefined)`
  before any extension ran, so a partial stub must tolerate unknown keys.

The rest of your UI reads the event stream: `session.subscribe((e) => …)` delivers `agent_start`,
`turn_start`, `message_start`/`message_update`/`message_end`, `tool_execution_start`/`…_update`/`…_end`,
`queue_update`, `agent_settled`, and the rest. Renderers are *types*, not components: the entry exports
`EntryRenderer`, `MessageRenderer`, `ToolRendererResolver`, `ToolRenderers`, `ToolRenderResultOptions`,
`MarkdownTransformer` — declarations to implement, with no built-in React/DOM renderer to inherit.

### 3. Out of process: RPC

```typescript
import { RpcClient } from "@earendil-works/pi-coding-agent";

const client = new RpcClient({
  cliPath: "/abs/path/node_modules/@earendil-works/pi-coding-agent/dist/cli.js",
  cwd: "/my/project",
  args: ["--no-session"],
});
await client.start();
const state = await client.getState();     // model, thinkingLevel, isStreaming, sessionId, messageCount, …
await client.bash("echo hi");
client.onEvent((event) => { /* JsonAgentSessionEvent */ });
await client.stop();
```

Measured: `getState()` returned `{ model, thinkingLevel, isStreaming, isCompacting, steeringMode, followUpMode,
sessionId, autoCompactionEnabled, messageCount, pendingMessageCount }`, `bash("echo rpc-works")` answered
`"rpc-works\n"`, and `getAvailableModels()` listed 6. The client's method surface mirrors the CLI:
`prompt`, `steer`, `followUp`, `abort`, `newSession`, `switchSession`, `fork`, `compact`,
`setModel`, `cycleModel`, `setThinkingLevel`, `exportHtml`, and more.

Extension UI crosses the process boundary as records: `docs/rpc-extension-ui.md` defines the request and
response shapes, so an RPC client can render `select`/`confirm`/`input` dialogs that an extension asked for. The
same process can be driven from any language by spawning `pi --mode rpc` and writing JSONL commands.

### 4. No UI at all

`runPrintMode(runtime, { mode: "text" })` prints the final answer; `{ mode: "json" }` prints the event stream.
Both take the same runtime, so a CLI wrapper and an IDE plugin can share one factory.

## Gotchas

- **`RpcClient`'s default `cliPath` is the literal string `"dist/cli.js"`.** It is spawned relative to the
  **host's** cwd, so outside the package directory it fails with
  `Cannot find module '/tmp/pi-ui-probe/dist/cli.js'` — measured. Always pass an absolute `cliPath`
  (`<packageDir>/dist/cli.js`) when embedding.
- **`InteractiveMode` is not documented in `docs/sdk.md`, but it is exported.** It is the same class the `pi`
  binary runs; treating it as private API is a judgment call, since it ships in the public entry.
- **It renders escape sequences into non-TTY output.** There is no "quiet" mode; a piped run still
  emitted the full ANSI screen (measured).
- **A missing `uiContext` fails silently, not loudly.** `select` resolves `undefined`, `notify` does nothing, and
  an extension that awaits a dialog gets `undefined` rather than an error — so an extension can look
  broken in a headless host with no diagnosis.
- **`mode: "print"` does not turn the UI off.** Gate your own behavior on `ctx.hasUI`.
- **`ExtensionUIContext` is wide.** Roughly thirty methods; `custom`, `setWidget`, `setFooter`, and `setHeader` take
  `(tui: TUI, theme: Theme) => Component` factories, which only make sense if you adopt `@earendil-works/pi-tui`.
  Implement the dialogs and status setters first; leave the component factories undefined.
- **Subscriptions are per session.** After a runtime replacement the old listener is dead; re-subscribe
  in `setRebindSession` (see the runtime reference).
- **No web UI ships with the package.** Any browser surface is yours: events plus `uiContext`, or RPC records.

## Related

- [createAgentSessionRuntime — the Session-Owning Runtime in the pi SDK](./pi-agent-session-runtime.md) — the
  object `InteractiveMode` wraps, and the rebind hook a custom UI needs.
- [What an Embedded pi Session Reads From Disk](./pi-sdk-default-discovery.md) — the startup screen lists the
  extensions, prompts, and skill collisions this discovery produced.
- [Create a Pi Agent Session — SDK How-To](../howto/pi-agent-session-sdk.md) — the minimal path this UI sits on
  top of.

## Changelog

- 2026-11-06 — created from pi-coding-agent 1.5.0 (tag `v1.5.0`, commit
  `f9a26365568127461c47a07a37dcb42c140a3ac5`): `modes/index.ts`, `interactive-mode.ts`,
  `print-mode.ts`, `rpc-client.ts`, `rpc-mode.ts`, `core/agent-session.ts` (`ExtensionBindings`),
  `core/extensions/types.ts` (`ExtensionUIContext`), plus probes covering a stubbed `uiContext` under two
  modes, an unbound session, an in-process `InteractiveMode.init()` render, and a live `RpcClient`.
