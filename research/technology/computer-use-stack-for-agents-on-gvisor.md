---
title: Computer-Use Stacks for Agents Under gVisor — Guest OS × Control Path, and What Each Is For
category: technology
tags: [gvisor, computer-use, agents, sandbox, desktop, x11, wayland, vnc, rdp, playwright, chromium, xvfb, cua, at-spi, accessibility, qemu]
status: complete
created: 2026-11-01
updated: 2026-11-02
sources:
  - https://gvisor.dev/docs/user_guide/compatibility/
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/desktop_mcp.py
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/AGENTS.md
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/entrypoint.sh
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/Dockerfile
  - https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/
  - https://gvisor.dev/blog/2026/04/15/magi-multi-agent-gvisor-isolation/
  - https://github.com/trycua/cua/blob/main/libs/images/README.md
  - https://cua.ai/docs/cua-sdk/reference/os-image-catalog
  - https://cua.ai/blog/ubuntu-docker-support
  - https://kasm.com/kasmvnc
  - https://github.com/cushycush/wdotool
  - https://manpages.ubuntu.com/manpages/jammy/man1/wtype.1.html
  - https://www.semicomplete.com/blog/xdotool-and-exploring-wayland-fragmentation/
confidence: high
---

# Computer-Use Stacks for Agents Under gVisor — Guest OS × Control Path, and What Each Is For

## TL;DR

- **Two stacks work; the rest are dead ends for a gVisor guest, and the dead
  ends are all dead for the same reason: they open a kernel device.** gVisor has
  no generic character-device support, so every path that needs
  `/dev/uinput`, `/dev/dri/*` or a KMS display fails
  ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).
- **Working stack A — X11 control plane, guest X server, no remote protocol.**
  Xvfb + `xdotool` + `scrot`, all pure X11 clients, so nothing touches a kernel
  device. This is what Google's own `gnome-mcp` image does
  ([`desktop_mcp.py`](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/desktop_mcp.py)).
- **Working stack B — real Wayland GNOME with an RDP client in a sidecar.**
  Two containers: the desktop (systemd, headless GNOME, `gnome-remote-desktop`)
  and a driver that speaks RDP and injects through X11 on the near side
  ([`entrypoint.sh`](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/entrypoint.sh)).
  This is where anything driven by GNOME-internal state lives.
- **Do not bother with `ydotool`/uinput, KasmVNC, or an Xorg session on a DRM
  card.** KasmVNC wants `/dev/dri/renderD128`; `ydotool` wants
  `/dev/uinput`; Xorg wants `/dev/dri/card0` and DRM master. None of those
  nodes exist in the sandbox.
- **If the agent only needs a web browser, skip the desktop entirely** — headless
  Chromium over CDP is the cheapest viable option, and Google runs Playwright in
  gVisor in its own multi-agent example
  ([MAGI](https://gvisor.dev/blog/2026/04/15/magi-multi-agent-gvisor-isolation/)).

## Context

The request is narrow: a computer-use stack an agent can actually drive, on
Linux, under gVisor. The guest OS choice is a free variable — every option is
legal to boot — so the real decision is the *control path*, and the OS has to be
picked to fit it.

That inverts the usual order. Normally you pick an OS and then an automation
tool. Under gVisor the tool decides the OS, because the tool's transport must be
one gVisor implements: pipes, sockets, ptys, files, and `/proc`/`/sys`. Two
paths satisfy that. Everything else needs a device node.

## Decision table

Legs run across the columns; the axes an agent cares about run down the rows.
Each cell is one clause.

| Leg | A — X11 control plane | B — Wayland GNOME + RDP sidecar | C — Headless browser | D — Xorg on DRM (fails) | E — uinput injection (fails) | F — KasmVNC (fails) |
|---|---|---|---|---|---|---|
| Verdict | Works | Works | Works | Works, degraded | Works | Fails |
| Guest OS | Debian/Ubuntu + systemd, Xvfb | Debian + systemd + GNOME | Debian/Ubuntu, no desktop | Any + Xorg server | Any + ydotool | Any + KasmVNC |
| Input transport | `xdotool` → X protocol | RDP → X11 bridge | CDP | Xorg → DRM ioctl | uinput write | VNC → DRM |
| Screenshot | `scrot` from the X server | RDP framebuffer | CDP capture | DRM page flip | uinput only, no readback | DRM framebuffer |
| Device nodes needed | none | none | none | `/dev/dri/card0` | `/dev/uinput` | `/dev/dri/renderD128` |
| Session isolation | one X server per container | one RDP session per container | one browser per container | one Xorg + one card | one daemon per container | one server per container |
| How Google does it | `gnome-mcp` image | `gnome-mcp` + `systemd-*gnome` | MAGI for browsing | not shipped | not shipped | not shipped |
| Latency | lowest (in-guest) | one network hop | lowest | n/a | n/a | n/a |

Why the failing three fail, in gVisor's own terms: custom device files are
unsupported "with the notable exceptions of NVIDIA GPUs and TPU devices"
([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)), and gVisor
ships no DRM and no uinput driver — its device drivers are `memdev`, `nvproxy`,
`rdmaproxy`, `tpuproxy`, `ttydev` and `tundev`. KasmVNC documents DRI3 and a
GPU as the accelerated path ([KasmVNC](https://kasm.com/kasmvnc)); `ydotool`
writes `/dev/uinput` by design and needs root
([wdotool README](https://github.com/cushycush/wdotool)).

## Stack A — X11 control plane, full stop

The guest runs an X server (Xvfb) on `:1` and the agent drives it with X11
clients. No display connector, no compositor protocol negotiation, no kernel
device anywhere in the path.

The tool surface Google's `gnome-mcp` server exposes — copy it rather than
invent one ([`desktop_mcp.py`](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/desktop_mcp.py)):

| Tool | Behaviour worth copying |
|---|---|
| `screenshot` | Grid overlay labelled in normalised units, plus a per-line text inventory |
| `find_text` | Regex over the OCR'd line list, returns clickable coordinates |
| `click` / `double_click` / `move_mouse` / `drag` / `scroll` | Each returns the resulting screen and a changed/unchanged fingerprint |
| `type_text` / `press_key` | `xdotool` keystroke and text paths |
| `wait` | Explicit, because software rendering makes a large app take five to fifteen seconds to first paint |
| `cursor_position` | Readback for verifying an aim before committing a click |
| `save_screenshot` | Writes into a shared volume so the image reaches the agent's own workspace |

Three design rules carry most of the reliability, and all three are stated in
the shipped prompt
([`AGENTS.md`](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/AGENTS.md)):

- **Coordinates are normalised 0–1000, never pixels.** Resolution independence
  costs nothing and removes a whole class of off-by-scale misses.
- **An action returns its own screenshot, and the action path reports whether
  the screen changed.** `SCREEN UNCHANGED` is what stops a model repeating a
  missed click.
- **One action at a time.** Queueing clicks aims later actions at a screen that
  no longer exists.

The X-server choice is the guest OS's only real decision, and it is settled by
what the *applications* link against: GTK4 stopped shipping an X11 backend, so a
GTK4 app under bare Xvfb runs through XWayland, which wants a Wayland compositor
underneath. Debian 12/13 + Xfce keeps the whole stack X11; if you need a GNOME
app, go to stack B. Do not bother adding `x11vnc` — with no human watching, the
PNG the tool already returns is the display.

## Stack B — real Wayland GNOME, driven over RDP

When the task needs GNOME itself, the desktop container is
`images/systemd-user/systemd-debian-gnome` (systemd, `gnome-shell --wayland
--headless`, `gnome-remote-desktop` on 3389) and the driver container runs
Xvfb, an `xfreerdp3` client pointed at it, and the same `desktop_mcp.py` tool
surface
([`entrypoint.sh`](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/entrypoint.sh)).

The separation is not incidental. Letting the agent into the desktop container
would put its shell, filesystem and the app's own window state in the same
sandbox the app can compromise; the RDP hop keeps the driver at arm's length and
gives one fixed, normalised framebuffer to aim at. Run costs from the
[desktop file](./linux-desktop-in-gvisor.md): no GPU, `--shm-size=1g`,
`--in-sandbox-cgroup=v2 --allow-suid`, and the cgroup `mount()` shim.

## Stack C — headless browser, no desktop

For browsing, navigating a web app, or reading a page, Playwright or CDP against
headless Chromium is smaller and far faster than a compositor plus a remote
protocol. Google runs exactly this in gVisor in the MAGI multi-agent post
([MAGI](https://gvisor.dev/blog/2026/04/15/magi-multi-agent-gvisor-isolation/)).
You lose real window chrome, real app menus and any native dialog, so it does
not cover a task that has to click a title bar.

## E and F — why the popular desktop images do not drop in

- **KasmVNC.** Attractive because it serves a desktop over one HTTP port with no
  client, and it is what Cua's Ubuntu image ships ([Cua
  post](https://cua.ai/blog/ubuntu-docker-support)). It is built for DRI3, so in
  a gVisor sandbox it degrades to the software path or refuses the device
  ([KasmVNC](https://kasm.com/kasmvnc)). Treat a gVisor conversion of it as work,
  not as a configuration flag.
- **`ydotool`.** The standard Wayland input injector, and the wrong one here:
  it writes `/dev/uinput` and wants root
  ([wdotool](https://github.com/cushycush/wdotool)). Default a gVisor guest to
  `xdotool` over X11 and keep `wtype` (virtual-keyboard protocol, no device) as
  the Wayland-side fallback only when the compositor advertises the protocol —
  `wtype` fails outright on compositors that do not
  ([wtype(1)](https://manpages.ubuntu.com/manpages/jammy/man1/wtype.1.html)).
- **An Xorg session.** It opens `/dev/dri/card0` and wants DRM master; with no
  DRM support it falls back to `fbdev`/`dummy` drivers or refuses to start.
- **Cua itself.** Its sandbox CLI does accept `--runtime gvisor`
  ([`cua sandbox create`](https://cua.ai/docs/cua-cli/reference/cli/sandboxes)),
  but its Linux image is Xfce **on Xvfb** with an HTML5 viewer — the same X11
  control plane as stack A, wrapped in a much larger toolchain
  ([image catalog](https://cua.ai/docs/cua-sdk/reference/os-image-catalog),
  [libs/images](https://github.com/trycua/cua/blob/main/libs/images/README.md)).
  Taking Cua buys a driver, SDK and viewer; it does not buy a faster display.

Do **not** reach for QEMU inside the sandbox: gVisor cannot run KVM from within
([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)), so an
in-sandbox VM is emulation-only.

## Can you run Cua itself there?

Yes on paper, conditionally in practice, and not through OpenMausBot.

The runtime is a flag, not a fork: `cua sandbox create IMAGE [--kind auto|container|vm] [--runtime auto|gvisor|runc|qemu|lume]` ([CLI reference](https://cua.ai/docs/cua-cli/reference/cli/sandboxes), read 2026-11-02). So Cua treats gVisor as a first-class sandbox runtime rather than something you assemble.

What decides whether it works is the image's display stack, not Cua. Under gVisor the only control plane that survives is pure X11 clients against a guest X server, which is stack A above. Cua's Linux images are Xfce on Xvfb, so the driver's click, type and capture path has somewhere to land ([image catalog](https://cua.ai/docs/cua-sdk/reference/os-image-catalog), [`libs/images`](https://github.com/trycua/cua/blob/main/libs/images/README.md)).

Four things still bite:

| Concern | What happens under gVisor |
| --- | --- |
| Viewer | Cua's Ubuntu image ships KasmVNC, which wants `/dev/dri/renderD128`. Pair the driver with noVNC or x11vnc instead ([Cua post](https://cua.ai/blog/ubuntu-docker-support), [KasmVNC](https://kasm.com/kasmvnc)) |
| Background input | No `/dev/uinput`, so no background key delivery. Every key, type, scroll and pixel click is foreground |
| Screen capture | Pure X11 read should hold. If the driver takes the X shared-memory path, SysV shm under gVisor is the first thing to test [unverified] |
| Accessibility | AT-SPI runs over D-Bus with no device dependency, so it should survive, untested here [unverified] |

The background-input limit is not unique to gVisor. OpenMausBot's hardened container has the same gap for the same reason, and its system prompt requires `delivery_mode: "foreground"` for keys, typing, scroll, and pixel clicks ([computer layer](./openmausbot-computer-layer.md)).

**OpenMausBot cannot do this today.** Its Local VM accepts three runtimes, `["docker", "podman", "container"]`, and its `BoxKind` type declares a `"gvisor"` variant with nothing implementing it. Running Cua under gVisor is a Cua-CLI deployment, not an OpenMausBot one.

**And it would not contain the agent.** gVisor wraps the desktop only. The provider CLI stays outside, on the host, as it does today, so a bot's own shell would still reach the machine. Containing the agent is `bot-box` or a separate sandbox around the CLI, which is a different design.

## Purpose per combination

Stated as the job each stack is actually for, so the choice does not have to be
argued from feature lists.

| Purpose | Stack | Guest OS | Why this one |
|---|---|---|---|
| Agent operates an office suite, IDE, file manager | A | Debian 12/13 + Xfce + Xvfb | GTK3/X11 apps need no compositor; lowest latency |
| Agent signs into a site and drives it as a person | B | Debian + GNOME | Chrome under real GNOME is the profile Google demos and documents |
| Agent needs GNOME Settings, shell, or a GNOME-only app | B | Debian + GNOME | Those surfaces live inside GNOME, not in any app window |
| Screenshot-driven visual regression of a GUI build | A | Debian + Xvfb, app installed | Fixed framebuffer, deterministic coordinates, no human |
| Agent browses or scrapes only | C | Debian, no desktop | Cheapest by far; no compositor to boot |
| Long-lived developer workstation an agent and a human share over RDP | B | Debian + GNOME + Chrome + VS Code | Google's own demo is this, and RDP lets a person watch |
| Multi-agent, one desktop each, same host | A or B | one container per agent | One sandbox per desktop; no shared compositor |

## Open Questions

- Whether `gnome-remote-desktop`'s headless backend needs an EGL/GBM path gVisor
  lacks is still unverified; the shipped image plus sidecar is evidence it works,
  but not evidence of which backend it settles on [unverified].
- XTest versus `xdotool`'s synthetic-event path under gVisor is untested here;
  both are X protocol, so both should hold [unverified].
- AT-SPI, which Cua's image relies on for structured accessibility trees, needs
  a D-Bus session and has no device dependency, so it should survive — but it
  has not been tried in this repo [unverified].
- arm64: no gVisor desktop image here exists for it, and the scaffold above is
  x86_64 only [unverified].

## Related

- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — the
  display stack itself: CPU rendering, the GPU wall, and what the desktop image
  costs to boot.
- [gVisor vs a Hypervisor](./gvisor-vs-hypervisor.md) — why device files are the
  recurring wall, and what that says about the boundary.
- [AI Agent Sandboxes Compared](../product/ai-agent-sandbox-comparison.md) — the
  same tiers priced as products.
- [Cua — What It Is and What "Cua Sandbox" Means](./cua-computer-use-stack.md) — the component list, the licence split, and the one wheel OpenMausBot pins.
- [Open-Source Grok Bot Alternatives](./open-source-grok-bot-alternatives.md) —
  Cua and the other agent-desktop SDKs in context.

## Changelog

- 2026-11-02 — added whether Cua itself runs there: the `--runtime gvisor` flag, what the driver keeps and loses, and why OpenMausBot's Local VM cannot be pointed at it.
- 2026-11-01 — created from the pinned `gnome-mcp` image
  (`desktop_mcp.py`, `entrypoint.sh`, `AGENTS.md`, `Dockerfile`) and
  `systemd-debian-gnome` image at SHA `aa767e4c43d0` (read 2026-11-01), the
  gVisor compatibility guide, the systemd-in-gVisor and MAGI posts, the Cua
  sandbox docs and image catalog, and the KasmVNC, wdotool and wtype pages.
