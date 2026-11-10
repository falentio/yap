---
title: Cua Driver vs Vercel agent-desktop — A Tree-and-Pixels Driver Against a Tree-Only CLI to the Same Three OSes
category: technology
tags: [cua, cua-driver, trycua, vercel, agent-desktop, vercel-labs, computer-use, accessibility-tree, ax, uia, at-spi, background-delivery, mcp, agent-browser, peekaboo, windows-mcp, orgo]
status: complete
created: 2026-11-07
updated: 2026-11-07
sources:
  - https://cua.ai/docs/cua-driver
  - https://cua.ai/docs/cua-driver/what-is-computer-use
  - https://cua.ai/docs/cua-driver/concepts/how-cua-driver-works
  - https://cua.ai/docs/cua-driver/concepts/platform-support
  - https://cua.ai/docs/cua-driver/reference/mcp-tools
  - https://cua.ai/docs/cua-driver/quickstart
  - https://cua.ai/docs/cua-bench
  - https://cua.ai/blog/cua-driver-bench
  - https://github.com/trycua/cua
  - https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/README.md
  - https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver-bench/README.md
  - https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver-bench/METHOD.md
  - https://github.com/vercel-labs/agent-desktop
  - https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/README.md
  - https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/docs/faq.md
  - https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/docs/install.md
  - https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/LICENSE
  - https://agent-browser.dev/desktop
  - https://agent-browser.dev/desktop/skills
  - https://agent-browser.dev/desktop/errors-and-recovery
  - https://agent-browser.dev/desktop/guides/headed-mode
  - https://agent-browser.dev/desktop/platforms/macos
  - https://agent-browser.dev/desktop/platforms/linux
  - https://agentconn.com/blog/vercel-agent-desktop-computer-use-land-grab/
  - https://dev.to/gabrielanhaia/vercels-agent-desktop-lets-coding-agents-click-native-apps-without-moving-your-mouse-38p1
  - https://explainx.ai/blog/vercel-agent-desktop-accessibility-tree-computer-use-cli-2026
  - https://aicoder.com/news/news-20261106-cua-driver-bench-scale-agentenv-macos-bg-58
  - https://x.com/trycua/status/2118754889329230241
  - https://github.com/openclaw/Peekaboo
  - https://github.com/CursorTouch/Windows-MCP
  - https://github.com/ifuryst/open-codex-computer-use
  - https://github.com/microsoft/playwright-mcp
  - https://github.com/bytebot-ai/bytebot
  - https://www.orgo.ai/
  - https://www.simular.ai/alternatives/best-computer-use-mcp-servers
confidence: high
---

# Cua Driver vs Vercel agent-desktop

## TL;DR

- **Same job, opposite bet on how the agent perceives the screen.** Both are local drivers over the same three OSes. Cua Driver returns an accessibility tree **and** a screenshot, then acts through a four-rung ladder that ends in pixels and foreground. agent-desktop returns a tree only, has no screenshot in the action path, and refuses when the tree cannot answer.
- **The design difference decides the failure mode, and it is measurable.** On Cua's own head-to-head, macOS background full-pass is 23/40 for Cua Driver against 8/40 for agent-desktop; and the disturbance rate is the sharper number — of the tasks it did complete, agent-desktop disturbed the user 13 times in 21, against 2 in 25 for Cua Driver ([Cua Driver Bench](https://cua.ai/blog/cua-driver-bench), agent-desktop arm run by Scale AI).
- **Read the foreground column before drawing a conclusion.** In the foreground agent-desktop reaches 35/50 (70%) against Cua Driver's 39/50 (78%), and those intervals overlap — the foreground gap is **within noise**. Set against that, Cua both builds the winner *and* wrote the tasks and the harness; a sealed held-out set exists and is unreleased.
- **agent-desktop's advantage is engineering discipline on a narrow contract, not raw capability.** It is Apache-2.0, one JSON envelope per command, 16 stable error codes with `disposition.retry`, refs scoped to a snapshot, and skills compiled into the binary so the guide matches the version. No model inside, no GUI, no prompt.
- **Both are by design not agents.** Neither embeds an LLM; the observe/act/verify loop stays in your harness. The real choice is a routing question: tree-only when the app publishes a good tree, tree-plus-pixels when it may not.
- **Cua Driver is the better default; agent-desktop is the better default when determinism beats coverage.** If your targets are native controls on all three platforms, agent-desktop's refusal is a feature. If they may be canvas, Electron, legacy or focus-polling apps, Cua's pixel and foreground rungs are why it finishes more.
- **Two pending risks are not symmetric.** agent-desktop's Windows route is unsigned and blocked by Smart App Control on a clean Windows 11 install; Cua's Windows support is labelled preview on its own homepage while its docs table says Supported.

## Context

Asked on 2026-11-07 to compare Cua Driver with Vercel's agent-desktop, then search for alternatives. The repo already carries Cua in depth — [what the project is](./cua-computer-use-stack.md), the [driver as OpenMausBot's contract](./openmausbot-computer-layer.md), and the [gVisor control-path constraints](./computer-use-stack-for-agents-on-gvisor.md) — so the Cua side here cites rather than re-derives. [agent-desktop](https://github.com/vercel-labs/agent-desktop) appeared in the previous [Bevel comparison](./bevel-agent-desktop.md) as the closest competitor; this file is the head-to-head that entry owed.

Both products became names in public within nine days of each other — agent-desktop 1.0.0 on 2026-10-27, Cua's head-to-head benchmark on 2026-11-06 — which is part of why the comparison is contested rather than settled ([land-grab coverage](https://agentconn.com/blog/vercel-agent-desktop-computer-use-land-grab/)).

## What each one actually is

| | Cua Driver | agent-desktop |
|---|---|---|
| Owner | trycua / Cua | Vercel Labs |
| Licence | MIT | Apache-2.0 |
| Surface | [MCP over stdio](https://cua.ai/docs/cua-driver/reference/mcp-tools), `cua-driver call` CLI, Python and TypeScript [SDK](https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/README.md) | [CLI, 60 commands](https://agent-browser.dev/desktop), C library via FFI, MCP over stdio |
| Model inside | None | None |
| Observation | `get_window_state` returns AX tree **and** screenshot in one call ([design](https://cua.ai/docs/cua-driver/concepts/how-cua-driver-works)) | `snapshot` returns the AX tree as JSON with a ref per actionable element |
| Action model | Four-rung ladder; every input names one exact target | Ref actions; snapshot-scoped refs; headless by default |
| Verification | `effect` enum, `verified` only on AX read-back, `escalation` hint | `disposition.retry`, `recovery.strategy`, `delivered_verified` on clipboard only |
| Platforms | macOS 14+, Windows 10/11/Server, Linux x86_64 ([support table](https://cua.ai/docs/cua-driver/concepts/platform-support)) | macOS 13+, Windows 10 1809+, Ubuntu 24.04+ ([platform pages](https://agent-browser.dev/desktop/platforms/macos)) |
| Permissions | Fixed permission mode at daemon launch: standard, bounded, unrestricted | macOS AX grant to the launching app; `POLICY_DENIED` when a path needs `--headed` |
| Isolation story | `session` label, idle TTL, stale tokens refused by name | `session` flag, `AGENT_DESKTOP_SESSION`, per-window pins |
| Docs for the agent | Bundled skill pack, `cua-driver skills install` ([quickstart](https://cua.ai/docs/cua-driver/quickstart)) | [Skills compiled into the binary](https://agent-browser.dev/desktop/skills) and version-matched |
| Stars | 30.3k across the monorepo | ~18.5k |

Both are library-grade rather than product-grade by design, and the licence text is either plain MIT ([Cua](https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/README.md)) or plain Apache-2.0 ([agent-desktop](https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/LICENSE)). Cua's own framing: "the harness runs the model and the loop". agent-desktop's: "It is not an agent. The observe, act, and verify loop lives in the calling agent" ([README](https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/README.md)).

## The core divergence, stated honestly on both sides

Cua opens its computer-use explainer with the two perception channels side by side: the tree "tells the agent what can be acted on, and it is compact text"; a screenshot "shows what the tree leaves out or gets wrong: a canvas, a video, an app that labels nothing" ([what is computer use](https://cua.ai/docs/cua-driver/what-is-computer-use)). One call returns both, and the recommended route prefers the named element and falls back to pixels only where the tree cannot reach.

agent-desktop answers the opposite question — "Does agent-desktop require screenshots or pixel matching?" — with "No" ([FAQ](https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/docs/faq.md)). `screenshot` is a separate command outside the action loop, and "an app that publishes no accessibility tree is not visible to agent-desktop".

Neither is naivety on the other's part — the [driver README](https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/README.md) numbers the rungs and the [agent-desktop introduction](https://agent-browser.dev/desktop) states the boundary. agent-desktop documents its blindness as a boundary; Cua documents its pixel rung as a fallback that can only be trusted after ascent. But the practical consequences are asymmetric and worth naming:

| Situation | Cua Driver | agent-desktop |
|---|---|---|
| Native button with a label | Element rung, verified by read-back | Ref click, then snapshot |
| Canvas, game, Blender, GIMP | Pixel rung, then foreground | Invisible or coordinate-only (`--xy`) |
| Electron field that echoes a write it never applied | Reported `unverifiable` with an escalation hint | Command succeeds; the echo is yours to catch |
| Hover-only toolbar, tooltip | Needs the real pointer; moves it | Same, and needs `--headed` |
| Drag | Background on Windows; foreground on macOS | `--headed` on every platform |
| App behind yours, partly covered | Background rungs first | AT-SPI/AX action, if the element exposes one |

## The benchmark, and how much to trust it

The bench lives in the [trycua/cua monorepo](https://github.com/trycua/cua) beside the driver. Cua Driver Bench v2 pre-registered its protocol in dated commits before the first trial and swaps only the driver — same harness, model (Claude Sonnet 5.5), prompts, 360-second and 45-turn limits. Ten tasks, eight scored in the background, a full pass requiring task done **and** GUI-only **and** none of eight disturbance criteria. Scale AI ran Cua Driver, agent-desktop and browser-use on macOS and Cua Driver on Linux; Cua ran everything else and labels those rows "run by Cua" ([method](https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver-bench/METHOD.md), [report](https://cua.ai/blog/cua-driver-bench); the repo layout is in the [bench README](https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver-bench/README.md), and `cb` itself is [MIT](https://cua.ai/docs/cua-bench)).

| macOS, full pass | k / n | Rate | 95% Wilson |
|---|---|---|---|
| Cua Driver, background (Scale) | 23 / 40 | 58% | 42–71% |
| Codex Computer Use, background (Cua) | 13 / 40 | 33% | 20–48% |
| agent-desktop, background (Scale) | 8 / 40 | 20% | 10–35% |
| browser-use, background (Scale) | 1 / 40 | 3% | 0–13% |
| Cua Driver, foreground (Scale) | 39 / 50 | 78% | 65–87% |
| agent-desktop, foreground (Scale) | 35 / 50 | 70% | 56–81% |
| browser-use, foreground (Scale) | 32 / 50 | 64% | 50–76% |

**The background gap is the finding; the foreground gap is not.** Cua's own text says the foreground intervals overlap and "the foreground gaps are within noise". The background split survives because both drivers finish between 21 and 32 of 40 tasks and diverge on disturbance, not completion.

**Where the two are indistinguishable, and where agent-desktop holds up better than the headline suggests.** IR-03 (a save prompt behind the user's window) was 5/5 for both. On Linux with XFCE both scored the identical 5/40 in the background, and agent-desktop's 68% foreground sits below Cua's 84% only because Cua refuses background delivery 37 times out of 40 there. Background drag on macOS was 0/5 for both. agent-desktop's real weakness in the run is disturbance on macOS, not capability: 13 of its 21 completed tasks disturbed the user, against 2 of 25 for Cua Driver.

**Threats to validity, stated by Cua and visible in the data** (the [news summary](https://aicoder.com/news/news-20261106-cua-driver-bench-scale-agentenv-macos-bg-58) and the [launch thread](https://x.com/trycua/status/2118754889329230241) restate the same split). Cua builds the winner, wrote the tasks, the test app and the harness, and found its own fixes by running them. Each driver that ships agent guidance got it shipped, and only agent-desktop and Cua Driver do. Ten tasks with 5 trials each gives wide intervals. The measurement desktop is a VM, never a working laptop. The Codex comparisons run one tool layer under a foreign model. A sealed held-out set exists and is unreleased.

**Independent corroboration of agent-desktop's own numbers is thin in a specific way.** Its headline efficiency claim — 273 tokens for a region against 3,811 for a full window, and 31K against 198K over 52 steps, an 84% cut — is the project's self-reported figure; Dev.to repeats it with the caveat that no third party verified it, and CellCog notes there is no shared yardstick ([Dev.to](https://dev.to/gabrielanhaia/vercels-agent-desktop-lets-coding-agents-click-native-apps-without-moving-your-mouse-38p1)). Stock star velocity (13k in days, 18.5k now) measures attention, not accuracy.

## Reliability engineering, which is agent-desktop's real strength

Whatever the benchmark says, agent-desktop is the more disciplined contract, and the parts worth copying are concrete:

- **Snapshots are the namespace.** A ref carries its snapshot id (`@s8f3k2p9:e8`) and a bare ref fails `INVALID_ARGS`. A stale one fails `STALE_REF`; two matching windows fail `AMBIGUOUS_TARGET` with candidate ids in `error.details`.
- **Errors are a typed interface.** [16 codes](https://agent-browser.dev/desktop/errors-and-recovery) with `disposition.retry` of `safe` or not, and a `recovery.strategy` only when retry is safe. The docs tell the agent to branch on the code and never on the message text.
- **Partial observation is modelled.** A snapshot that runs out of budget returns what it saw and reports completeness per cut node; a tri-state of Known, Absent and Unknown stops a failed read reading as a negative answer ([explainx](https://explainx.ai/blog/vercel-agent-desktop-accessibility-tree-computer-use-cli-2026)).
- **Silence is not a policy switch.** A headless action that the AX API cannot satisfy fails closed with `ACTION_NOT_SUPPORTED` or `POLICY_DENIED`; "It never silently switches to physical input" ([headed mode](https://agent-browser.dev/desktop/guides/headed-mode)).
- **The docs travel with the binary.** Skills are compiled in and version-matched; `skills get` needs no permission and no desktop session.

Cua answers the same problems with a different shape: `effect` plus `escalation` instead of `disposition.retry`, an explicit `delivery_mode` argument instead of a global flag, and `invalidated_snapshot_ids` listed on every re-read so a stale token names its replacement. Both refuse to guess. Cua's ladder attempts more rungs before refusing, which is the same trait that gets it more completions and more chances to disturb someone.

## Where each one hurts

| Risk | Cua Driver | agent-desktop |
|---|---|---|
| Licence for redistribution | MIT driver, but the optional perception extension is **AGPL-3.0-only** via OmniParser | Apache-2.0 throughout |
| Windows install | Installer script, no admin ([quickstart](https://cua.ai/docs/cua-driver/quickstart)) | Binary is [unsigned](https://raw.githubusercontent.com/vercel-labs/agent-desktop/main/docs/install.md): SmartScreen warns, antivirus may quarantine, **Smart App Control blocks it on a clean Windows 11 install**; the npm path avoids SmartScreen |
| Windows maturity | Homepage says "preview" while the docs table says Supported | Supported from 10 1809; both Windows routes are UIA |
| Linux support | X11 and Wayland with [per-compositor limits](https://cua.ai/docs/cua-driver/concepts/platform-support), KWin read-only, niri uncapturable when tiled | [Ubuntu 24.04 on GNOME 46](https://agent-browser.dev/desktop/platforms/linux) as the only target; 22.04's ATK bridge aborts on `Action.GetActions` |
| Wayland input | Compositor-specific; raw background input refuses | Keys need GNOME Mutter RemoteDesktop; pointer input on Wayland refuses outright |
| Headless granularity | Per-call `delivery_mode`; background is the default rung | Coarse `--headed` flag with a per-command support table that differs by OS |
| Managed OS floors | macOS 14+ | macOS 13+ |
| Bus/session setup | Bundled daemon, permission onboarding UI | Needs a live AT-SPI bus inside the graphical session; `~/.agent-desktop` must be mode 0700 |

The Windows row is the sharpest asymmetry: agent-desktop's binary being unsigned and Smart-App-Control-blocked is a first-run wall, while Cua's installer runs without admin and asks for TCC grants through its own window. On the other side, Cua's AGPL perception extension is the sharpest licensing asymmetry, and it only bites if you install it.

## Routing guide

| If | Use |
|---|---|
| Targets may be canvas, legacy, focus-polling or badly-labelled apps | **Cua Driver** |
| You need the driver to share the machine with a person | **Cua Driver**, and budget for its gaps (no background drag on macOS) |
| Native controls only, determinism over coverage | **agent-desktop** |
| You want to embed the driver in-process from a non-Python, non-TypeScript language | **agent-desktop**'s C library; both offer in-process SDKs, but Cua's are Python and TypeScript only |
| Redistribution must stay Apache-2.0 or permissive end to end | **agent-desktop**, or Cua Driver without `cua-perception` |
| Any of the target apps is a web page | neither alone — **agent-browser** or [**Playwright MCP**](https://github.com/microsoft/playwright-mcp) |
| macOS-only and you want capture plus visual QA | [**Peekaboo**](https://github.com/openclaw/Peekaboo) |
| The whole job belongs to an agent that also owns the credentials | [**Aside**](./aside-ai-browser.md) — it drives the desktop too, but only on Max and only locally |
| The agent should get its own machine instead | [**Orgo**](https://www.orgo.ai/), [**Simular Box**](https://www.simular.ai/alternatives/best-computer-use-mcp-servers), **Cua Spaces** |

## Gotchas

- **Neither one's success signal is proof of change.** Cua marks Electron echoes `unverifiable`; agent-desktop reports delivery and expects a fresh snapshot. Both docs say to observe again; both are ignored in practice.
- **Cua Driver's perception extension changes your licence posture.** MIT applies to the driver; installing `cua-perception` pulls AGPL-3.0 into the runtime and a network service may owe corresponding source.
- **agent-desktop's 60 commands are not 60 working commands.** Four (`key-down`, `key-up`, `mouse-down`, `mouse-up`) fail closed on every platform, and `open-system-surface` is `PLATFORM_NOT_SUPPORTED` on macOS.
- **Hover is unfixable at driver level on all three OSes.** No platform delivers hover to a background window without the real pointer; both projects say so.
- **The benchmark's Linux result is a property of xfwm4, not of the drivers.** xfwm4 hands every new modal the keyboard, so three interruption tasks cannot pass there for anyone.

## Negative results

- **agent-desktop does not support Windows Server** in its documented floors (10 1809+ and 11); Cua's driver lists Windows 10, 11 and Server.
- **agent-desktop cannot see a UI that publishes no accessibility tree** — no pixel fallback exists to substitute.
- **Neither driver can hover a background window**, and no OS-level fix exists.
- **agent-desktop drag needs `--headed`** on every platform and therefore always moves the user's pointer.
- **Cua Driver fails macOS background drag** 0 of 5 times, by its own report, which also concedes it cannot yet drag in the background there.
- **The field beyond these two is thin.** [Windows-MCP](https://github.com/CursorTouch/Windows-MCP) is Windows-only, [open-computer-use](https://github.com/ifuryst/open-codex-computer-use) mirrors Codex's design, and Bytebot — the reference self-hosted desktop agent — has been [archived since 2026-03-07](https://github.com/bytebot-ai/bytebot).
- **Scale has no Windows run** for any driver; every Windows number in the benchmark is vendor-run.

## Related

- [Cua — what the project is, what "Cua sandbox" means, and which part OpenMausBot takes](./cua-computer-use-stack.md)
- [OpenMausBot's bot computer — the Cua Driver seam](./openmausbot-computer-layer.md)
- [Computer-use stacks for agents under gVisor](./computer-use-stack-for-agents-on-gvisor.md)
- ["Bevel agent desktop" — the three name collisions, and the shell-class alternatives](./bevel-agent-desktop.md)
- [Open-source Grok Bot alternatives with first-class sandbox VMs](./open-source-grok-bot-alternatives.md)
- [Aside — the browser-agent layer, and the login problem neither driver solves](./aside-ai-browser.md)
- [The Functional Source License](./functional-source-license.md)

## Changelog

- 2026-11-07 — linked the Aside browser-agent entry after the ask to consider it as an alternative; it is a different layer, so it is a routing row rather than a column.
- 2026-11-07 — created. All external sources via TinyFish search and fetch. Benchmark section relies on the pre-registration, the report and a news summary; the agent-desktop efficiency figures are the vendor's own and labelled as such.
