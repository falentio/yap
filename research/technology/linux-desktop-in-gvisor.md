---
title: Running a Linux Desktop Inside gVisor — What Works, What Software Rendering Costs, and Where the Wall Is
category: technology
tags: [gvisor, desktop, gnome, rdp, x11, wayland, software-rendering, llvmpipe, gpu, drm, sandbox, containers, systemd]
status: complete
created: 2026-11-01
updated: 2026-11-06
sources:
  - https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/
  - https://gvisor.dev/docs/user_guide/compatibility/
  - https://gvisor.dev/docs/user_guide/gpu/
  - https://gvisor.dev/docs/architecture_guide/platforms/
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64
  - https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/Dockerfile
  - https://github.com/google/gvisor/blob/aa767e4c43d0/runsc/specutils/nvidia.go
  - https://api.github.com/repos/google/gvisor/releases?per_page=100
confidence: high
---

# Running a Linux Desktop Inside gVisor — What Works, What Software Rendering Costs, and Where the Wall Is

## TL;DR

- **Yes — since gVisor 2026-09 it boots a full desktop, as long as everything
  renders on the CPU.** The project ships a Debian + GNOME image that runs
  systemd as PID 1, GNOME Shell as a headless Wayland compositor and
  gnome-remote-desktop over RDP, and the blog walks through an agent
  installing LibreOffice and building a spreadsheet inside it
  ([blog](https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/)).
- **The display path is entirely software.** Wayland compositor, Mesa
  llvmpipe, LIBGL_ALWAYS_SOFTWARE=1, remote framebuffer over RDP — no
  /dev/dri, no DRM, no EGL/GBM against a GPU
  ([Dockerfile:88-97,25](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64)).
- **The wall is the GPU, and it is concrete.** Custom device files are
  unsupported except NVIDIA GPUs and TPUs
  ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)), NVIDIA
  passthrough is CUDA/Vulkan/NVENC only through nvproxy
  ([gpu](https://gvisor.dev/docs/user_guide/gpu/)), and gVisor has no DRM
  device — so a client that insists on /dev/dri/card0 or a KMS session does
  not get one.
- **Skip gVisor if the workload needs a GPU-backed desktop:** gaming, video
  playback, browser WebGL/WebGPU at speed, or anything expecting a hardware
  display connector. Keep a VM (or a bare container) for those.

## Context

"Can gVisor run a Linux desktop environment?" used to be a flat no, because
gVisor had no service manager, no full-system containers and no display
stack. That changed in 2026 with systemd, cgroups v2, pidfds, the new mount
API, POSIX ACLs for tmpfs/overlayfs and openat2(2) landing to make
full-system containers possible
([blog](https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/)), and release
20260831.0 is the first changelog that carries the systemd e2e work
("Expand systemd e2e tests", "Test RHEL UBI10, which runs systemd, on gVisor")
([releases](https://api.github.com/repos/google/gvisor/releases?per_page=100)).

The accurate answer is now narrower and more useful: a desktop *does* run, but
only along the one path gVisor implements — software rendering into a remote
framebuffer. Everything below separates what works from the cost of it.

## What actually runs

The reference image is
[images/systemd-user/systemd-debian-gnome](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64)
(base debian:trixie, ENV container=docker). It is not an Xorg box:

| Layer | Choice in the image | Anchor |
|---|---|---|
| Init | systemd as PID 1 (/sbin/init, STOPSIGNAL SIGRTMIN+3) | Dockerfile:187-190 |
| Display server | Wayland — gnome-shell --wayland --headless, XDG_SESSION_TYPE=wayland | Dockerfile:88,97 |
| Session manager | gnome-session --session=gnome as a user unit under default.target, started at boot by systemd linger | Dockerfile:100-112,152-153 |
| Login manager | GDM masked out entirely | Dockerfile:64-65 |
| Remote protocol | RDP, GNOME's own gnome-remote-desktop headless backend on 3389 | Dockerfile:24,114-115 |
| Transport | TLS with a self-signed 4096-bit cert, credentials baked in | Dockerfile:157-164,146-152 |
| Rendering | LIBGL_ALWAYS_SOFTWARE=1 plus libgl1-mesa-dri (llvmpipe) | Dockerfile:91,25 |
| Audio | PipeWire plus WirePlumber | Dockerfile:25,74-83 |

There is **no Xorg, no Xwayland, no xrdp and no VNC** in the image
(Dockerfile:22-25). X11 only appears in the separate gnome-mcp sidecar, which
runs Xvfb plus an xfreerdp3 client to view the RDP session
([gnome-mcp/Dockerfile:5-8](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/gnome-mcp/Dockerfile)).

The published run command is short and says what the sandbox needs:

```bash
docker run -d --name gnome --runtime=runsc --shm-size=1g --privileged \
  -p 127.0.0.1:3389:3389 systemd-debian-gnome
```

plus --in-sandbox-cgroup=v2 --allow-suid on the runsc runtime
([blog](https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/)). --privileged
here grants no host privilege; gVisor simulates the capabilities the sandboxed
system sees.

## Why it works at all — and what it costs

A Wayland compositor does not need a display connector. It needs an EGL/GBM
surface, an input path and a way out of the process. gVisor supplies none of
the first two from hardware, so everything collapses onto CPU work plus a
socket:

- **Rasterisation is CPU-only.** GNOME Shell, every toolkit and every canvas
  draw runs through llvmpipe. LIBGL_ALWAYS_SOFTWARE=1 is not a fallback the
  image tolerates; it is the design
  ([Dockerfile:91](https://github.com/google/gvisor/blob/aa767e4c43d0/images/systemd-user/systemd-debian-gnome/Dockerfile.x86_64)).
- **The frame goes over RDP, not a scanout.** GNOME Shell's headless backend
  composites and gnome-remote-desktop ships the result. Chrome and VS Code are
  baked in for demo purposes (Dockerfile:36-59), which is the load profile this
  suits: text-heavy application windows, not motion.
- **Idle, lock and sleep are disabled** (idle-delay=0, lock-enabled=false, all
  sleep states 'nothing') so the RDP session survives (Dockerfile:132-141).
- **A cgroup remount shim is required.** The entrypoint /usr/local/sbin/oci-init
  remounts /sys/fs/cgroup read-write, warns it needs CAP_SYS_ADMIN, and needs
  an AppArmor profile that does not block mount() (Dockerfile:173-183).
- **In-sandbox resource limits still do not bind.** Cgroups v2 exist in the
  sandbox for CPU and memory *accounting*, but limits between processes inside
  one sandbox are not enforced; the host cgroup is what caps the sandbox
  ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)). A
  desktop with several heavyweight apps saturates one sandbox's share before
  anything throttles it from inside.

## The GPU wall

This is the part that decides the answer for real workloads.

1. **Custom device files are unsupported, with exactly two exceptions —
   NVIDIA GPUs and TPUs**
   ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).
   There is no generic DRM/KMS device support, so /dev/dri/card0,
   /dev/dri/renderD128, /dev/fb0 and the /sys/class/drm surface a display stack
   expects are absent. Any client whose startup path is "open card0, become DRM
   master" fails; one with a software fallback degrades.
2. **NVIDIA is CUDA-shaped, not display-shaped.** nvproxy is a passthrough
   driver that forwards ioctl(2) calls to the host NVIDIA driver, gated on
   /dev/nvidia* devices and the --nvproxy flag; it also supports Vulkan and
   NVENC/NVDEC
   ([gpu](https://gvisor.dev/docs/user_guide/gpu/),
   [nvidia.go:45-61](https://github.com/google/gvisor/blob/aa767e4c43d0/runsc/specutils/nvidia.go)).
   It is a versioned ABI proxy that must know each supported driver's ioctl
   struct layouts, so it tracks a whitelist rather than every driver.
3. **The GNOME image itself never asks for a GPU.** No --device, no --gpus=all;
   the blog's --gpus=all belongs to the separate Ollama container in the
   agentic demo, not the desktop
   ([blog](https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/)).
4. **KVM inside the sandbox is not available either**, unrelated to which
   platform gVisor itself uses
   ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)) — so a
   desktop is not a route to nested virtualisation.

## Where the boundary lands

- **Gaming:** no. Proton, Vulkan and shader compilation want a real GPU and a
  KMS/DRM path; nvproxy exposes CUDA/Vulkan compute through a proxy, not the
  present path a full-screen game assumes.
- **Video playback:** software decode only. 1080p is plausible, sustained 4K
  and high-bitrate HEVC are not; the closest field report is the container
  desktop thread describing exactly that failure on a GPU-capable host
  ([linuxcontainers](https://discuss.linuxcontainers.org/t/a-detail-step-to-run-desktop-environment-in-container/21723)).
- **Browser work, office suites, terminals, IDE:** what this is for. The blog
  ships a working Chrome plus VS Code session and an agent driving GNOME with a
  virtual mouse and keyboard to install LibreOffice
  ([blog](https://gvisor.dev/blog/2026/09/17/systemd-in-gvisor/)).
- **Full-system services with a UI on top:** supported — systemd itself is
  tested against Ubuntu, Debian and Red Hat UBI images, and Apache,
  PostgreSQL, MariaDB, Redis and Docker are in the integration suite.
- **Agentic computer-use:** the intended showcase. A sandboxed desktop behind
  MCP gives an agent a real GUI to click, with no kernel shared with the host.

## Open Questions

- Which gVisor release first *shipped* systemd support cannot be pinned from
  the release metadata read here: pages 1-2 of the releases API (2026-08-31
  back to 2026-07) carry only e2e-test entries, and the feature is a long tail
  of commits rather than one gate [unverified].
- Whether the Mesa driver resolves to llvmpipe specifically, rather than
  another software fallback, is unstated; settle with eglinfo or glxinfo inside
  a built container and read GL_RENDERER [unverified].
- gnome-remote-desktop's headless backend needs no /dev/uinput: the
  gnome-mcp sidecar drives the session as an RDP client, and gVisor ships no
  uinput driver at all (its device drivers are memdev, nvproxy, rdmaproxy,
  tpuproxy, ttydev, tundev). What is still unverified is whether the headless
  backend wants an EGL/GBM path gVisor lacks; settle with
  journalctl --user -u gnome-remote-desktop-headless under runsc.
- No arm64 Dockerfile exists under the image path despite the .x86_64 suffix;
  arm64 desktop support is unstated [unverified].

## Related

- [Browser-Viewable VNC on gVisor](./vnc-server-on-gvisor-with-browser-client.md) — which VNC server survives with no /dev/dri and how noVNC + websockify put it in a browser tab.
- [Computer-Use Stacks for Agents Under gVisor](./computer-use-stack-for-agents-on-gvisor.md) — which control paths an agent can actually drive in a gVisor guest, and what each is for.
- [Debian-Derived Distros With KDE Plasma](./debian-based-kde-distributions.md) — where Plasma comes from on Debian and which Debian branch each derivative pins.
- [Windows-Like Linux Desktops](./windows-like-linux-desktops.md) — which desktops reproduce the Windows shell in native code, and what the clone distros cost (a person arriving from Windows)
- [gVisor vs a Hypervisor](./gvisor-vs-hypervisor.md) — the isolation model and
  the compatibility gaps (io_uring, ext4 mounts, in-sandbox cgroup limits,
  KVM-inside) that bound what a sandbox like this can host.
- [AI Agent Sandboxes Compared](../product/ai-agent-sandbox-comparison.md) —
  the same boundaries priced as products.
- [Open-Source Grok Bot Alternatives](./open-source-grok-bot-alternatives.md) —
  gVisor, Kata and Firecracker as selectable sandbox backends.

## Changelog

- 2026-11-06 — cross-linked the Windows-like desktop research from Related.
- 2026-11-01 — cross-linked the computer-use stack file.

- 2026-11-01 — created from the gVisor systemd-in-gvisor post, the
  compatibility and GPU guides, the platform guide, the pinned
  systemd-debian-gnome and gnome-mcp images, runsc/specutils/nvidia.go at SHA
  aa767e4c43d0 (read 2026-11-01), and the releases API.
- 2026-11-28 — cross-linked the browser-viewable VNC file.
