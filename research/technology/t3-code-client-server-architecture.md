---
title: T3 Code — Server, Desktop, Web, and Mobile Architecture
category: technology
tags: [t3-code, electron, effect-ts, event-sourcing, expo, react-native, websocket, architecture]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://github.com/pingdotgg/t3code
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/overview.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/connection-runtime.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/terminal-runtime.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/providers.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/mobile-navigation.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/mobile-development.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/t3-connect.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/user/remote-access.md
  - https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/operations/release.md
confidence: high
---

# T3 Code — Server, Desktop, Web, and Mobile Architecture

## TL;DR

- **There is one app, and it is the server.** `apps/server` owns conversation state, provider sessions, terminals, and SQLite. Every other surface is a view onto it ([overview.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/overview.md)).
- **The desktop app has no UI of its own.** Electron serves the compiled `apps/web` bundle from `apps/server/dist/client` over a custom `t3code://app/` protocol; only the capability bridge differs from a browser (`apps/desktop/src/app/DesktopApp.ts:176-179`, `apps/desktop/src/app/DesktopEnvironment.ts:219`).
- **Desktop runs the server as its own child process**, by re-entering the Electron binary as Node (`ELECTRON_RUN_AS_NODE=1`) with the bootstrap token handed over an inherited fd — not a separate Node install (`apps/desktop/src/backend/DesktopBackendConfiguration.ts:584-599`).
- **Web is a static SPA.** No server process on Vercel; in the browser the client talks to whatever origin served the page (`apps/web/src/environments/primary/target.ts:164`, `apps/web/vercel.ts:26-33`).
- **Mobile never runs a local server.** Its primary-environment auth resolves to `Option.none()` and SSH is an explicit `unsupported` error; every environment is remote, reached by bearer, relay, or a paired tunnel (`apps/mobile/src/connection/platform.ts:194,227`).
- **One wire contract, one state layer.** 185 `Rpc.make` methods in a single `WsRpcGroup` (`packages/contracts/src/rpc.ts:1811`), consumed through a React-free Effect-Atom state package (`packages/client-runtime/package.json:400-403`).
- **The terminal is the one place all four surfaces share an engine**: libghostty-vt, as WASM+Canvas 2D on web/desktop and through `GhosttyKit`/JNI natively on iOS/Android. No xterm.js anywhere (`apps/web/src/terminal/ghostty/README.md:3`, `apps/mobile/modules/t3-terminal/ios/T3TerminalView.swift:3`).

## Context

Question: how is T3 Code put together across its four surfaces — server, desktop, web, mobile — and what is shared versus per-shell? Researched 2026-10-29 against `github.com/pingdotgg/t3code` @ `main`, commit `33806e73555107b8ac8fb18fd15b9dfb87ec6557` (shallow clone at `~/.pi/source/github.com-pingdotgg-t3code@main`), by two delegated scouts crawling the source and the in-repo docs. Anchors below are paths in that commit; doc links are pinned to it.

## The shape

```text
                    packages/contracts      packages/client-runtime
                    WsRpcGroup + schemas    Effect Atom projections
                          ▲   ▲   ▲                ▲   ▲   ▲
        ┌─────────────────┘   │   └──────┐         │   │   │
   apps/desktop         apps/web      apps/mobile    │   │   │
   Electron 44          React 19 SPA  Expo / RN 0.88 │   │   │
   spawns the server    static Vercel remote only     │   │   │
   serves the web build       │             │         │   │   │
        └──────────┬──────────┴─────────────┴─────────┘   │   │
                   ▼  /ws  (JSON-RPC over WebSocket)      │   │
        ┌──────────────────────────────────────────────────┴───┐
        │ apps/server — one Effect layer graph on node:http     │
        │ orchestrator · SQLite event log · outbox · providers  │
        │ PTYs · MCP endpoint · relay/tunnel clients            │
        └───────────────────────────────────────────────────────┘
```

## The four surfaces, side by side

| Dimension | Server (`apps/server`) | Desktop (`apps/desktop`) | Web (`apps/web`) | Mobile (`apps/mobile`) |
|---|---|---|---|---|
| Runtime | Node (`node:http`) or Electron-as-Node | Electron 44 main + renderer | Browser | React Native 0.88 / Hermes |
| UI | none | none — serves the web build | React 19, TanStack Router, Tailwind 4 | React Native, React Navigation |
| Entry point | `src/bin.ts` → `runCli` → `runServer` | `dist-electron/boot.cjs` → `main.cjs` | `index.html` → `bootstrap.ts` → `main.tsx` | `index.ts` → `registerRootComponent` |
| Build | bundle incl. `node-pty` via `createRequire` | Vite+ `pack` → CJS main | Vite+ (Rolldown) → static SPA | Expo + EAS, OTA via `expo-updates` |
| Server it talks to | itself | the child it spawned | the origin that served it | a paired remote environment |
| Transport | `/ws` + HTTP groups + `/mcp` | same, in-process origin | same | same, over TLS/relay |
| Terminal | PTY + raw bytes (`node-pty`) | web Ghostty module in Electron | libghostty-vt WASM + Canvas 2D | `GhosttyKit` (iOS), JNI (Android) |
| Durable state | SQLite WAL `userdata/statev2.sqlite` | none of its own | none | none |
| Ships as | `curl \| sh` installer, bundled into desktop | AppImage/.deb/DMG/NSIS + `electron-updater` | static deploy at `app.t3.codes` | App Store / Play Store / EAS channels |

## Server: one layer graph, one event log

**Process model.** The server is not a class hierarchy with a bootstrap; `runServer = Layer.launch(layerMakeServer)` is the whole program (`apps/server/src/server.ts:1122`). Startup is a named, ordered phase list ending at `http.wait` + `auxiliary-roots.parked`; long-lived roots sit parked on one activation `Deferred` and only fork once `launcher.prepareTrial` resolves (`apps/server/src/serverRuntimeStartup.ts:608,637`, `apps/server/src/serverActivation.ts:12`). Commands arriving before readiness wait in a queue instead of racing the listener (`apps/server/src/ws.ts:1836`).

**Self-update is outside the runtime.** A Node-builtins-only launcher owns the process and the update trial (120 s report window, 5 s terminate grace, 2 s handoff) and the child asks for updates over `process.send`; a remote update is refused unless the process is `serviceManaged` (`apps/server/src/serviceLauncher.ts:35`, `apps/server/src/cloud/serviceLauncherClient.ts:107`, `apps/server/src/cloud/selfUpdate.ts:212`).

**Transport.** `NodeHttpServer` over `node:http` with permessage-deflate, bound to `127.0.0.1` by default, port 3773, with only two runtime modes: `web` and `desktop` (`apps/server/src/server.ts:277-280`, `apps/server/src/config.ts:25`). The RPC surface is a single `WsRpcGroup` of 185 methods, each carrying permission middleware; the handshake checks `ORCHESTRATION_PROTOCOL_VERSION = 2` and rejects a mismatch with HTTP 426 before upgrade, authenticates at upgrade (cookie, bearer, DPoP, or WS ticket), and constructs a fresh `RpcServer` per socket in JSON serialization (`packages/contracts/src/rpc.ts:1811,1997`, `apps/server/src/ws.ts:607,3142,3155,3171,3190`). Subscription is snapshot → cursor replay → live tail, with replay abandoned past 1 000 events or 8 MiB in favour of a fresh snapshot, and a `{kind:"synchronized"}` frame marking the handover (`apps/server/src/ws.ts:747,551,555,676`).

**Persistence.** SQLite through `node:sqlite`'s `DatabaseSync`, wrapped in a local port of `@effect/sql-sqlite-node` so it speaks Effect's `SqlClient`; WAL with a 32 MiB journal limit, `busy_timeout=5000` because the CLI and the server write from separate processes. No Drizzle in the server (`apps/server/src/persistence/Sqlite.ts:19,36`, `packages/shared/src/nodeSqliteClient.ts:2`). One append-only `orchestration_events` log backs everything: V2 thread events are folded into the same table and discriminated by `application_event_version` rather than living in their own table (`apps/server/src/persistence/Migrations/001_OrchestrationEvents.ts:8`, `apps/server/src/persistence/OrchestrationEventStore.ts:423`). Idempotency is a receipt table, side effects are a leased outbox, and read models are projection tables with a `last_sequence` fold cursor (`apps/server/src/persistence/Migrations/002_OrchestrationCommandReceipts.ts:8`, `apps/server/src/persistence/Migrations/OrchestrationV2/Foundation.ts:110,159`).

**The loop.** `Orchestrator.dispatch` is the single entrance, serialized per thread by a shared `KeyedLock`, and idempotent: an existing receipt returns the stored result and events instead of re-deciding (`apps/server/src/orchestration-v2/Orchestrator.ts:286,10627,10430`). `EventSink.commitCommand` then does receipt insert, event append, projection fold, and outbox enqueue in one transaction, publishing only after commit so subscribers never see uncommitted state (`apps/server/src/orchestration-v2/EventSink.ts:527,332,240`). `EffectWorker.runDaemon` claims outbox rows (4 concurrent, 30 s liveness poll) and executes them — 16 effect kinds such as `provider-turn.start`, `checkpoint.capture`, `provider-session.detach`, `terminal.cleanup` (`apps/server/src/orchestration-v2/EffectWorker.ts:795`, `apps/server/src/orchestration-v2/EffectOutbox.ts:32`). Provider output re-enters through `normalize` → `ingestNormalized` into the same sink, so assistant tokens are event-sourced exactly like user commands (`apps/server/src/orchestration-v2/ProviderSessionManager.ts:1918`, `apps/server/src/orchestration-v2/ProviderEventIngestor.ts:264`).

**Providers.** Seven built-in drivers (codex, claude, cursor, opencode, grok, pi, acp-registry) spawn the user's CLIs as children over stdio JSON-RPC; each ACP agent additionally gets a short-lived `t3 acp-mcp-bridge` process that proxies stdio to the server's own `/mcp` endpoint (`apps/server/src/orchestration-v2/builtInProviderAdapterDrivers.ts:33`, `apps/server/src/provider/CodexProvider.ts:407`, `apps/server/src/mcp/AcpMcpStdioBridge.ts:16`). The server owns protocol, account, permissions, and capability flags; the CLI owns its native session and store ([providers.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/providers.md)).

**Reach.** HTTP/TCP only — no stdio or unix-socket mode. Beyond loopback the server advertises LAN and tailnet URLs, can install `tailscale serve` to its own port as an acquire/release resource, and can open a managed tunnel through the Cloudflare Worker relay in `infra/relay` (Clerk identity + environment links; after bootstrap the relay forwards no app traffic) (`apps/server/src/environment/DirectEndpoints.ts:87`, `packages/tailscale/src/tailscale.ts:341`, `apps/server/src/server.ts:770,800`, `infra/relay/src/worker.ts:110`, [t3-connect.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/t3-connect.md)).

## Desktop: an Electron shell that is mostly a bridge

Three pieces: a window, a backend pool, and a typed `DesktopBridge`.

- The main bundle is Vite+`pack`-packed to CJS, with a compile cache enabled before `main.cjs` loads (`apps/desktop/package.json:6`, `apps/desktop/src/boot.ts:3`).
- The window loads `t3code://app/` (or `t3code-dev://`), a custom protocol with SPA fallback that either serves `environment.clientAssetsDir` = `apps/server/dist/client` or proxies the Vite dev server. The renderer runs with `contextIsolation`, no `nodeIntegration`, and `sandbox: true`; all OS capability arrives through `ipcRenderer.invoke` as the typed `DesktopBridge` (`apps/desktop/src/electron/ElectronProtocol.ts:27`, `apps/desktop/src/window/DesktopWindow.ts:378,416-426`, `apps/desktop/src/preload.ts:80`).
- `DesktopBackendPool` starts one server per environment — a Windows primary plus WSL instances, each with its own port, log, and environment id — by running `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, `mode: "desktop"`, `noBrowser: true`, a desktop bootstrap token, and `--bootstrap-fd 3`. The server seeds that token as a pairing grant, which is exactly what `PrimaryEnvironmentAuth` reads back (`apps/desktop/src/backend/DesktopBackendConfiguration.ts:563-599`, `apps/desktop/src/backend/DesktopBackendPool.ts:16`, `apps/server/src/auth/PairingGrantStore.ts:335`, `apps/web/src/connection/platform.ts:265`).
- Native capability lives in child processes or worker threads, never in the Electron main startup path: a Rust `sysinfo` sampler spawned by the server, KDE/Hyprland/GNOME capture helpers, a Linux `libsecret` helper for Chromium cookie import, macOS `osascript` capture ([overview.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/overview.md), `apps/server/src/resourceTelemetry/ResourceMonitorBinary.ts:157-176`, `apps/desktop/src/snapShot/HyprlandSnapShot.ts:17-19`, `apps/desktop/scripts/build-browser-secret.mjs:17-19`).
- Where the bridge is missing, the UI simply does not exist: the web client gets `undefined` for snapshot methods and hides that surface, and SSH provisioning fails with `unsupported` (`apps/web/src/lib/desktopSnapShot.ts:31`, `apps/web/src/connection/platform.ts:275`).

## Web: a static bundle that adopts its origin

React 19 + Vite+ (Rolldown) + TanStack Router + Tailwind 4, entry `src/bootstrap.ts` → `main.tsx`, hash history under Electron and browser history otherwise, mount deferred until the managed-auth chunk and initial route chunks resolve (`apps/web/vite.config.ts:1-10`, `apps/web/index.html:490`, `apps/web/src/main.tsx:21,62`). Deployed as a static SPA on Vercel; `app.t3.codes` routes to `latest.` or `nightly.` by cookie (`apps/web/vercel.ts:3-33`). The primary environment target has exactly three sources — `configured`, `window-origin`, `desktop-managed` — and the descriptor under `/.well-known` is validated before any RPC (`apps/web/src/environments/primary/target.ts:6-10,89,164`, `apps/web/src/environments/primary/context.ts:79`). That single rule is what makes "hosted web, self-hosted server, and desktop" one codebase.

## Mobile: a remote-only Expo client

Expo 58 / React Native 0.88 / React 19.3, `registerRootComponent`, React Navigation static API with `t3code://`, `t3code-dev://`, `t3code-preview://` prefixes (`apps/mobile/index.ts:1`, `apps/mobile/src/App.tsx:44`). One root native stack holds Home, Thread, terminal, device preview, browser preview, review, and files; iOS swaps in a `react-native-screens` `Split` for the iPad primary+inspector layout, Android keeps the plain stack (`apps/mobile/src/Stack.tsx:676`, `apps/mobile/src/features/layout/createWorkspaceStackNavigator.ios.tsx:24`, `apps/mobile/src/features/layout/createWorkspaceStackNavigator.tsx:1`). The patch to `react-native-screens` exists to keep header-in-title, the scroll-edge fade, per-item header title caching, and back-gesture priority ([mobile-navigation.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/mobile-navigation.md)).

Capability delta: cloud identity and Clerk token come from the managed relay session, primary auth is permanently `Option.none()`, SSH is rejected, there is no local server, and previews are Streamed WebViews rather than Electron webviews (`apps/mobile/src/connection/platform.ts:161,194,227`, `apps/mobile/src/features/browser/PreviewStreamWebView.tsx`). Eight local Expo modules supply the native edge: terminal, composer editor, markdown selection, native controls/keyboard, review diff, notifications, subscription widget, widget expiry.

## The shared layer

| Package | Provides | Framework-neutral? |
|---|---|---|
| `packages/contracts` | `WsRpcGroup`, HTTP shapes, desktop IPC types, `ExecutionEnvironmentDescriptor` capability negotiation | yes |
| `packages/client-runtime` | `effect/reactivity` atoms, connection targets and registry, retry supervisor, command inputs, preview/device/voice projections | yes — no React or React Native dependency |
| `apps/web` | the only DOM rendering of that state | n/a |

`packages/client-runtime` depends on `@t3tools/contracts`, `@t3tools/shared`, `effect`, and `three` — zero React strings — which is why mobile reuses the same connection, cache, and command layer with different platform ports (`packages/client-runtime/package.json:400-403`, `apps/mobile/src/connection/platform.ts`). Shell state is `empty | cached | synchronizing | live`, deliberately separating cache freshness from transport health (`packages/client-runtime/src/state/shell.ts:42`).

### Connection targets

| | Primary | Bearer | Relay | SSH |
|---|---|---|---|---|
| Meaning | the environment this shell belongs to | a remote environment added by token | T3 Connect managed tunnel | a server launched over SSH |
| Persisted | derived, not stored | yes | yes | yes |
| Used by | all four | web, desktop | web, mobile | desktop only |
| Auth material | desktop bootstrap grant / same-origin | pairing token | Clerk identity + device identity | remote-issued pairing token |

Source: `packages/client-runtime/src/connection/model.ts:9-46`, `packages/ssh/src/tunnel.ts:861,922`. Retry and route-walking live entirely on the client, in `connection/supervisor.ts`, with jittered backoff capped at five minutes ([connection-runtime.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/connection-runtime.md)).

## One terminal engine, four adapters

| Surface | Engine binding | Draw / input |
|---|---|---|
| Web | libghostty-vt compiled to WASM, one instance per tab | Canvas 2D batched runs, one `<canvas>` owns input, IME, selection, scroll |
| Desktop | same web adapter inside Electron | as web |
| iOS | `GhosttyKit`, drives `ghostty_surface_t` | native view |
| Android | JNI against `ghostty/vt.h` | native view |

The server only owns PTYs and bytes: `TerminalManager` retains 5 000 lines / 8 MiB per terminal, evicts whole code points, persists to `logs/terminals/*.log`, and gates the WS protocol with an 8-chunk / 64 KiB per-request output window (`apps/server/src/terminal/Manager.ts:97,853,1591`, `apps/server/src/terminal/OutputProtocol.ts:5`). Rendering is client-side, and Android and web share the same C ABI while platform adapters own drawing and input ([terminal-runtime.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/internals/terminal-runtime.md)).

## Distribution

Stable, nightly, and preview channels; stable promotes the latest verified nightly, six desktop artifacts build in parallel off one shared JS bundle ([release.md](https://github.com/pingdotgg/t3code/blob/33806e73555107b8ac8fb18fd15b9dfb87ec6557/docs/operations/release.md)). Desktop is one `electron-builder` run per platform — AppImage + `.deb` on Linux, DMG and NSIS elsewhere — with `electron-updater` channels `latest`/`nightly`; AUR repackages the x86_64 AppImage (`scripts/build-desktop-artifact.ts:2766`, `apps/desktop/src/updates/updateChannels.ts:15`, `packaging/aur/README.md:3-4`). Mobile ships through EAS channels `development | preview | v2-preview | production` with `expo-updates` on load and fingerprint-based runtime versions (`apps/mobile/eas.json:14`, `apps/mobile/app.config.ts:233,242`). `apps/marketing` is an Astro static site and not a fourth shell.

## Open Questions

- **Do web, desktop, and mobile share one release commit?** The desktop bundles `apps/server/dist/client` and hosted web deploys from Vercel; nothing read here proves they are built from the same SHA. Probe: diff assets of `latest.app.t3.codes` against a tagged desktop artifact.
- **Do iOS and Android terminals render identically?** Both bind Ghostty, but draw/input adapters differ and no parity test was found. Probe: run one escape-sequence corpus through both simulators and diff snapshots.
- **What authenticates a provider's credentials at rest?** `ProviderCredentialStore` and `apps/server/src/secrets/` were named as a gap by the scout; keyring vs file per driver is unconfirmed.
- **Does the relay store anything beyond environment links?** Only `infra/relay/src/worker.ts` was read; `relay/src/db.ts` and the environment connector handshake remain unread.
- **Is `provider_session_runtime` still live?** Grep found it only in migrations, suggesting the V2 projection replaced it, but the launcher side was not checked.

## Related

- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — the same commit, focused on orchestration state: detach/lazy-reopen, native resume vs. `ContextHandoff` summaries.
- [Effect v4 @effect/rpc — Deep Dive](./effect-v4-rpc.md) — the `Rpc`/`RpcGroup` machinery T3's 185-method socket is built on.
- [Effect-TS for CLI Projects](./effect-ts-cli.md) — the `effect/unstable/cli` command tree behind `t3 start`/`t3 serve`.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — a contrasting event-sourced agent server with commit-before-visible durability.

## Changelog

- 2026-10-29 — created. Source crawl by two delegated scouts against `github.com/pingdotgg/t3code` @ `33806e73555107b8ac8fb18fd15b9dfb87ec6557`; `node:sqlite`, xterm absence, port 3773, and the 185-method RPC count spot-checked by hand. In-repo docs read at the same SHA.
