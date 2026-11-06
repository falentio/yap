---
title: >-
  Browser-Viewable VNC into a gVisor Sandbox — Which Server Survives With No
  /dev/dri, and the noVNC Client Stack That Replaces Itself
category: technology
tags: [gvisor, vnc, novnc, x11vnc, kasmvnc, xvfb, websockify, xwayland, wayland, wlroots, headless, containers, remote-desktop]
status: complete
created: 2026-11-28
updated: 2026-11-28
sources:
  - https://gvisor.dev/docs/user_guide/compatibility/
  - https://gvisor.dev/docs/user_guide/compatibility/linux/amd64/
  - https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/entrypoint.sh
  - https://manpages.debian.org/trixie/x11vnc/x11vnc.1.en.html
  - https://github.com/novnc/noVNC/blob/master/README.md
  - https://novnc.com/noVNC/cli.html
  - https://github.com/kasmtech/KasmVNC
  - https://kasmweb.com/kasmvnc/docs/latest/gpu_acceleration.html
  - https://github.com/any1/wayvnc
  - https://gitlab.gnome.org/GNOME/gnome-connections/-/issues/165
  - https://docs.linuxserver.io/selkies/user-guide/configuration/
confidence: high
---

# Browser-Viewable VNC into a gVisor Sandbox — Which Server Survives With No /dev/dri, and the noVNC Client Stack That Replaces Itself

## TL;DR

- **No mainstream VNC server runs *in the browser-safe way you want* out of the
  box under gVisor, because they all want a DRM render node.** The one that
  works unchanged is **x11vnc attached to an Xvfb server** — pure X11 client
  code, no device node, and it speaks WebSockets itself
  ([x11vnc(1)](https://manpages.debian.org/trixie/x11vnc/x11vnc.1.en.html),
  [noVNC README](https://github.com/novnc/noVNC/blob/master/README.md)).
- **The browser side is the easy half and it is not a VNC server feature you
  need to choose around.** noVNC is a browser client; any server is reachable
  from it through noVNC's own `utils/novnc_proxy` + `websockify` bridge, so a
  server that supports WebSockets natively (x11vnc, libvncserver) and one that
  does not (TigerVNC, KasmVNC's RFB port) land in the same place
  ([noVNC](https://github.com/novnc/noVNC/blob/master/README.md)).
- **KasmVNC is the best *client experience* and the worst *fit*.** It is a
  browser-native server with no client install, but the accelerated path is
  DRI3 on `/dev/dri/renderD128`, a node gVisor does not create
  ([KasmVNC GPU docs](https://kasmweb.com/kasmvnc/docs/latest/gpu_acceleration.html),
  [gVisor compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).
  Its own Xorg server, however, is documented to run on a headless Linux box,
  so treating it as "software fallback only" is a config flag plus a test, not
  a rewrite [unverified].
- **Do not pair Wayland GNOME with VNC.** gnome-remote-desktop's VNC backend is
  disabled by default at build time
  ([gnome-connections#165](https://gitlab.gnome.org/GNOME/gnome-connections/-/issues/165))
  and wayvnc refuses GNOME outright
  ([wayvnc](https://github.com/any1/wayvnc)). A VNC-facing desktop is an X11
  desktop: Xvfb + Xfce, not GNOME.
- **The shapes that do work, ranked:** x11vnc + noVNC (one process chain, no
  proxy needed), TigerVNC + noVNC (RFB only, proxy required, better auth), and
  Xwayland-server / cage + wayvnc + noVNC proxy when the apps are GTK4. Skip
  KasmVNC until the software path is confirmed.

## Context

Two requirements pull in opposite directions under gVisor: a **VNC server that
opens no kernel device** (because gVisor has no generic device-file support,
with NVIDIA GPUs and TPUs the only exceptions
([compatibility](https://gvisor.dev/docs/user_guide/compatibility/))), and a
**browser as the only client**. The second is free — the browser side is
noVNC, and noVNC works with any server once something speaks WebSockets at it.
The first is where every candidate has to be checked one by one.

gVisor's own shipped desktop is proof of the shape that fits: Debian + GNOME
under systemd, headless, software rendering, remote access on 3389 over
**RDP** with `gnome-remote-desktop`, and **no Xorg, no Xwayland, no VNC** in
the image
([Dockerfile:22-25](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64)).
Google's companion `gnome-mcp` container then runs Xvfb, an `xfreerdp3`
client against that session, and X11 tooling to drive it
([entrypoint.sh](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/entrypoint.sh)).
So "a screen in the sandbox" works; it is "a screen a person can open in a
browser tab" that needs a deliberate choice.

One gVisor-adjacent check that could have sunk the whole X11 route is fine:
System V shared memory is only *partially* unsupported — `shmget` rejects
`SHM_HUGETLB`, `shmat` rejects `SHM_RND`, `shmctl` rejects `SHM_LOCK`/
`SHM_UNLOCK`, and `shmdt` is full support
([Linux/amd64 syscall table](https://gvisor.dev/docs/user_guide/compatibility/linux/amd64/)).
Deprecated `SHM_RND` is the one to keep `x11vnc` away from: with the
**`-noshm`** flag it never takes the MIT-SHM path at all. `memfd_create` is
fully supported, which is what WebKitGTK and Chrome's WSI want.

## Candidacy table

Requirements across the columns, one clause per cell.

| Dimension | x11vnc + Xvfb | TigerVNC (Xvnc) | KasmVNC | wayvnc + wlroots/pixman | gnome-remote-desktop VNC |
|---|---|---|---|---|---|
| Runs under gVisor | Yes | Yes, degraded | Broken by default; unverified if forced off | Yes | Backend not built by default |
| Kernel device opened | None | None | `/dev/dri/renderD128` when `hw3d` | None | PipeWire only |
| Websocket transport | Built in (`-ssl`, Websocket support) | No, needs `websockify` | Native HTTP/WebSocket page | No, needs `websockify` | No |
| Works with noVNC | Directly, no proxy | Via `novnc_proxy` | Not the point; own UI | Via `novnc_proxy` | Via proxy |
| Desktop it can forward | Any X11 (Xvfb, Xvfb+Xfce) | Its own framebuffer | Its own Xorg server | wlroots compositors only | GNOME only |
| Wayland native | No | No | No | Yes | Yes |
| Active upstream | Slow, still shipped | Active | Active | Active | Active, RDP-first |
| Fit under gVisor | **Best** | Good | Poor | Medium | Poor |

## Client side: noVNC is the whole answer, and it needs almost nothing

noVNC is a JavaScript VNC client and application that runs in any modern
browser, mobile included; it supports `none`, classical VNC, RSA-AES, Tight,
VeNCrypt plain and XVP authentication and the raw/copyrect/hextile/tight/ZRLE/
JPEG/H.264 encodings
([README](https://github.com/novnc/noVNC/blob/master/README.md)). It has a
command-line proxy wrapper that starts `websockify` — a WebSockets-to-TCP
bridge — plus a mini web server in one command:

```bash
./utils/novnc_proxy --vnc localhost:5901 --listen 0.0.0.0:6080
```

Point a browser at `http://<host>:6080/vnc.html` and connect. The bare library
binds the same way:

```js
import RFB from './core/rfb.js';
const rfb = new RFB(document.getElementById('screen'), 'wss://' + location.host + '/websockify');
```

Consequences worth designing around rather than discovering:

- **WebSockets is the only transport noVNC speaks**; a server without native
  WebSocket support needs `websockify` in front of it
  ([README](https://github.com/novnc/noVNC/blob/master/README.md)). That is
  already a working preview inside the sandbox — the port is plain TCP to
  loopback and the browser talks TLS-terminated WebSocket to `websockify`.
- **Put TLS in front of the WebSocket, and never expose the RFB port.** noVNC
  serves `vnc.html` over HTTP while the VNC password crosses a `wss://`
  socket; the 5900-range port stays bound to `127.0.0.1`.
- **Clipboard paste is a browser gesture.** noVNC's clipboard panel needs a
  click; scripted typing into the desktop should go through the guest, not
  through the browser clipboard.

## Server A — x11vnc on Xvfb (recommended)

x11vnc attaches to an existing X server and serves it as VNC; it establishes a
connection to `-display` and prints `PORT=XXXX` on start
([x11vnc(1)](https://manpages.debian.org/trixie/x11vnc/x11vnc.1.en.html)). Every
byte of that is X protocol over a socket, so nothing in the path is a device
node. It also carries its own HTTP/SSL class server and, through
libvncserver, native WebSocket support — which is exactly why noVNC's README
lists it among the servers that need no proxy.

```bash
# inside the sandbox
Xvfb :1 -screen 0 1600x900x24 +extension RANDR &
export DISPLAY=:1
xfce4-session &                      # or a window manager + the app
x11vnc -display :1 -noshm -forever -shared -rfbauth ~/.vnc/passwd -rfbport 5900 &
```

Flag notes that matter here: `-noshm` keeps it off MIT-SHM, `-forever -shared`
stops the default "exit when the viewer disconnects, one viewer only"
behaviour, `-rfbauth` sets a password file
([x11vnc(1)](https://manpages.debian.org/trixie/x11vnc/x11vnc.1.en.html)).

Two caveats:

- **GTK4 does not ship an X11 backend.** A GTK4 app under bare Xvfb goes
  through XWayland, which needs a Wayland compositor underneath — so if the
  desktop is a modern GNOME or GTK4 app set, pick server B or C instead of
  fighting it. Debian 12/13 + Xfce keeps everything on X11.
- **Do not add `x11vnc` for an agent only.** In the agent path the PNG the
  tool already returns is the display
  ([computer-use stacks](./computer-use-stack-for-agents-on-gvisor.md)); x11vnc
  is for a human who wants to *watch* or *take over*.

## Server B — TigerVNC Xvnc, proxied

`Xvnc` is a TigerVNC server that *is* its own X server: no existing display, no
attached session, its own framebuffer. It needs no device node, so it runs under
gVisor the same way Xvfb does. It does not speak WebSockets, so it always sits
behind `websockify`:

```bash
Xvnc :1 -geometry 1600x900 -depth 24 -SecurityTypes VncAuth -localhost &
./utils/novnc_proxy --vnc localhost:5901 --listen 0.0.0.0:6080
```

Choose it over A when you want modern TLS/auth (`-SecurityTypes` with
VeNCrypt or X.509), per-session isolation without a separate Xvfb, and no
X11-attach semantics. Choose A when you want no proxy hop and a view onto a
session something else already drives.

## Server C — Xwayland-server or cage + wayvnc, proxied

For GTK4/GNOME-app content without GNOME's remote stack:

- `Xwayland`-in-server mode (`Xwayland -decorate` under `cage`) gives an
  X11 socket with a compositor underneath, so GTK4 apps find what they link
  against.
- `wayvnc` attaches to a running **wlroots** session (GNOME, KDE and Weston
  are explicitly not supported), and it is fine with a headless session — "the
  Wayland session may be a headless one, so it is also possible to run wayvnc
  without a physical display attached"
  ([wayvnc](https://github.com/any1/wayvnc)). It needs `pixman` and
  `wl_shm`-capable buffers, both CPU-side.
- `cage`, `labwc`, `sway` and `sway-headless` are the compositors that fit;
  force `WLR_RENDERER=pixman`. Whether the **headless** backend can allocate
  pixman buffers on this exact gVisor release is the open item — see below.
- Still proxied through `websockify`; wayvnc has no WebSocket transport.

Do not point wayvnc at GNOME: GNOME's own remote stack is RDP, and its VNC
backend has been off by default at build time "for a couple years now as it's
obsoleted by RDP"
([gnome-connections#165](https://gitlab.gnome.org/GNOME/gnome-connections/-/issues/165)).
If the target desktop *has* to be GNOME, the browser-client path is
`gnome-remote-desktop` RDP behind `websockify`'s RDP-capable sibling
(`wstunnel`) and a browser RDP client, not VNC at all.

## Server D — KasmVNC: right answer, wrong default

KasmVNC is the server you would pick with no gVisor in the picture: browser
access with no client, YAML config, DLP, H.264 streaming, and an Xorg server
with a virtual framebuffer "running in Linux userspace" that "can be run on a
headless Linux server" ([GPU docs](https://kasmweb.com/kasmvnc/docs/latest/gpu_acceleration.html),
[README](https://github.com/kasmtech/KasmVNC)).

Under gVisor it starts from the wrong end:

- The accelerated path is DRI3 against `/dev/dri/renderD128` by default, set
  with `hw3d: true` and `drinode:`
  ([GPU docs](https://kasmweb.com/kasmvnc/docs/latest/gpu_acceleration.html)).
  gVisor creates no `/dev/dri` at all.
- Turn `hw3d` off and the picture relies entirely on its Xorg drivers' software
  path. The documentation says a session is "not identical to a standard
  desktop X session" and that GNOME is "forced to consume more CPU leveraging
  LLVMpipe", but it never states plainly that KasmVNC runs with DRI3 off, only
  that the flags are optional for compute workloads [unverified].

So: keep KasmVNC as the goal for client experience, run `hw3d: false` (or just
its `vncserver` defaults) and prove it before committing. If it survives, it
replaces servers A-C and the whole noVNC stack with one package. If it does
not, the same desktop still works through A-C on the same X11 guest.

## The noVNC container pattern people actually deploy

The image family worth copying is `Xvfb + window manager + x11vnc + noVNC`
in one container — `solarkennedy/wine-x11-novnc-docker` and
`silentz/vnc-containers` are the shape
([README](https://github.com/solarkennedy/wine-x11-novnc-docker/blob/master/README.md),
[repo](https://github.com/silentz/vnc-containers)). It maps to A directly, so
gVisor needs no conversion: host network on the published port, `--shm-size`
above the 64 MB default, and `novnc_proxy` as the entrypoint.

Do not lift a stack that pulls in KasmVNC by default — Cua's Ubuntu image is
Xfce on Xvfb but ships KasmVNC as the viewer
([Cua image catalog](https://cua.ai/docs/cua-sdk/reference/os-image-catalog)).
Pair its driver with noVNC or x11vnc instead.

## Latency and resource expectations

Software rendering means CPU work for every pixel: server encode, WebSocket
proxy, and browser decode. Two consequences to plan for, both measured in the
gVisor desktop work already here: a large app takes five to fifteen seconds to
first paint, and `--shm-size=1g` plus `--in-sandbox-cgroup=v2 --allow-suid`
are the run requirements
([desktop file](./linux-desktop-in-gvisor.md)). Keep resolutions modest
(1600x900, not 4K), keep the codec on Tight/hextile rather than raw, and set
`max_frame_rate` low when the server exposes it.

## Run-shape checklist

| Concern | Choice |
|---|---|
| Container runtime | `--runtime=runsc`; nothing here needs `--privileged` beyond the desktop case |
| Shared memory | `--shm-size=1g`; `-noshm` on x11vnc for the MIT-SHM descents |
| Display server | Xvfb on `:1`; Xorg only via KasmVNC's own server |
| Desktop | Xfce on Debian 12/13 — keeps X11, no compositor |
| VNC bind | `127.0.0.1:5900` inside the sandbox |
| Browser port | `websockify`/`novnc_proxy` on `0.0.0.0:6080`, TLS terminated in front |
| Auth | `-rfbauth` password; a reverse proxy adds its own auth layer |
| Rendering | `LIBGL_ALWAYS_SOFTWARE=1`, llvmpipe |
| What breaks it | `hw3d: true`, Xorg on DRM, `ydotool`, GNOME's VNC backend |

## Open Questions

- Whether KasmVNC starts and composites with `hw3d: false` under `runsc` is
  untested here; the "userspace framebuffer, runs on a headless server" wording
  is the reason to expect yes [unverified].
- Whether wlroots' headless backend allocates pixman buffers without DRM dumb
  buffers on current wlroots. The pixman renderer exists and the headless
  backend is separate, so this is a run-and-look, not a design wall
  [unverified].
- Xvfb itself was not started under `runsc` in this pass. The syscall table
  says the SHM subset it would use is supported; the deprecated `SHM_RND`
  flag is the first thing to watch in the log [unverified].
- Whether KasmVNC's H.264 encoder path has a software fallback under gVisor or
  silently demands a VAAPI device [unverified].

## Related

- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — the
  display stack, CPU rendering, and why the GPU is the wall.
- [Computer-Use Stacks for Agents Under gVisor](./computer-use-stack-for-agents-on-gvisor.md)
  — the same candidates judged as an agent control plane instead of a human
  viewer.
- [gVisor vs a Hypervisor](./gvisor-vs-hypervisor.md) — the device-node
  boundary in full.

## Changelog

- 2026-11-28 — created from the gVisor compatibility guide and amd64 syscall
  table, the pinned `systemd-debian-gnome` and `gnome-mcp` images at SHA
  `aa767e4c43d0` (read 2026-11-28), the x11vnc, noVNC, KasmVNC, wayvnc and
  Selkies documentation, and the gnome-connections VNC-backend issue.
