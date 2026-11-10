---
title: gVisor vs a Hypervisor — Application Kernel, VMM, and Where the Boundary Sits
category: technology
tags: [gvisor, hypervisor, vmm, kvm, firecracker, kata, containers, isolation, sandbox, syscalls, security]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://gvisor.dev/docs/
  - https://gvisor.dev/docs/architecture_guide/intro/
  - https://gvisor.dev/docs/architecture_guide/security/
  - https://gvisor.dev/docs/architecture_guide/platforms/
  - https://gvisor.dev/docs/architecture_guide/performance/
  - https://gvisor.dev/docs/user_guide/compatibility/
  - https://gvisor.dev/blog/2024/09/23/safe-ride-into-the-dangerzone/
  - https://cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods
  - https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
  - https://katacontainers.io/
  - https://en.wikipedia.org/wiki/Hypervisor
confidence: high
---

# gVisor vs a Hypervisor — Application Kernel, VMM, and Where the Boundary Sits

## TL;DR

- **A hypervisor runs a whole guest OS on virtualized hardware; gVisor runs a
  second kernel as a userspace process.** A guest leaves a VM only through a VM
  exit handled by the hypervisor
  ([gVisor](https://gvisor.dev/docs/architecture_guide/intro/)); in gVisor the
  sandboxed syscall is intercepted and serviced by Go code in the host's
  userspace, with no syscall passed through to the host kernel
  ([docs](https://gvisor.dev/docs/)).
- **Both are two-kernel designs; the difference is what enforces the second
  boundary.** VMs pay hardware virtualization, a device model, a booted guest
  kernel and pre-allocated machine resources. gVisor pays per-syscall
  interception, memory for the Sentry, and an incomplete Linux ABI.
- **gVisor is not a weaker VM; it is a different trade.** It deletes the device
  emulation surface and puts the sandbox kernel in a memory-safe language, and in
  exchange gives up native syscall throughput and some kernel features
  ([security](https://gvisor.dev/docs/architecture_guide/security/),
  [compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).
- **Pick gVisor for untrusted multi-tenant containers on a shared host; pick a
  VM or microVM for arbitrary OS images, tenants needing a hardware boundary,
  or workloads needing real devices.** Stacking both (gVisor inside a microVM)
  is the strongest arrangement, and it is close to how GKE Sandbox is deployed
  ([GKE](https://cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods)).

## Context

"gVisor is a sandbox like a VM" is said often and loosely. Two separate claims
hide in it: whether gVisor *is* a hypervisor, and whether it gives VM-grade
isolation. The answers are no, and "a boundary of comparable strength, shaped
differently" — and the second answer is only useful if the costs on each side
are named.

## What a hypervisor is

A hypervisor, or virtual machine monitor, is software, firmware, or hardware
that creates and runs virtual machines. It presents a virtual platform to a
guest OS and manages that guest's execution, while the guest executes most
instructions natively rather than under emulation. The 1973 Goldberg
classification splits type-1 (bare metal: Xen, ESXi, Hyper-V) from type-2
(hosted: VirtualBox, VMware Workstation), a line that blurs for KVM and bhyve,
which are kernel modules that turn the host OS into a type-1 hypervisor
([Wikipedia](https://en.wikipedia.org/wiki/Hypervisor)).

The isolation mechanism is hardware privilege plus a trap: the CPU runs the
guest's kernel where it cannot reach host resources, and control leaves the
guest only on a VM exit, which the hypervisor handles. That is the gold-standard
boundary — at the price of pre-allocating machine resources per VM and booting
a full, separate kernel
([gVisor intro](https://gvisor.dev/docs/architecture_guide/intro/)).

Terminology worth keeping straight: KVM is the hypervisor; QEMU, Cloud
Hypervisor and Firecracker are VMMs built on it
([Wikipedia](https://en.wikipedia.org/wiki/Hypervisor)). Firecracker is explicit
about the shape — one process per microVM, vCPU threads created through KVM
running the `KVM_RUN` loop, a minimal device model (VirtIO net/block/vsock,
serial, partial i8042), I/O rate limiting, no network filtering
([design.md](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)).

## What gVisor is

gVisor is an *application kernel* that implements a Linux-like interface, is
written in memory-safe Go, and runs in userspace. Its own docs draw the line
explicitly: it is not a hypervisor and not a system call filter
([intro](https://gvisor.dev/docs/architecture_guide/intro/)). It ships `runsc`,
an OCI runtime that drops into Docker and Kubernetes, so sandboxed containers run
with ordinary container tooling ([docs](https://gvisor.dev/docs/)).

A sandbox is several processes:

| Piece | Role |
|---|---|
| `runsc` | OCI runtime entrypoint: create, start, stop, query |
| Sentry | Application kernel — syscalls, signals, memory management and page faults, threads |
| Gofer | Host-side process mediating filesystem access over 9P, on a socket or shared-memory channel |
| Application | An ordinary Linux binary from an OCI bundle, unmodified where compatible |

The Sentry reimplements the Linux syscall interface, memory management,
filesystems, a network stack, process management, signal handling and
namespaces. It never passes a syscall through: a `getpid(2)` from the sandbox
is answered from gVisor's own PID table, and `top(1)` on the host shows no such
process. The Sentry cannot open host files itself — anything past the sandbox
goes to the Gofer — and it runs in a seccomp-confined, namespaced container with
minimal capabilities, so an escape needs the Sentry exploited *and* the host
kernel exploited
([intro](https://gvisor.dev/docs/architecture_guide/intro/),
[docs](https://gvisor.dev/docs/)).

Interception happens through a "platform". `systrap` has been the default since
mid-2023 and uses `SECCOMP_RET_TRAP` so the kernel delivers `SIGSYS` and hands
control to gVisor. The KVM platform uses virtualization extensions so the Sentry
acts as both guest OS and VMM, with no virtualized hardware layer and no device
emulation. `ptrace` still exists but is unsupported and slated for removal
([platform guide](https://gvisor.dev/docs/architecture_guide/platforms/)).

`sudo` at setup is normal, not a hole: privileges are needed to build the
userspace network stack, then gVisor re-executes itself and drops them before
untrusted code runs. Rootless works with `--network=none`
([intro](https://gvisor.dev/docs/architecture_guide/intro/)).

## gVisor against the other three boundaries

Compared systems across the columns, dimensions down the rows.

| | Plain container (`runc`) | gVisor | VM (KVM + QEMU) | microVM (Firecracker, Kata) |
|---|---|---|---|---|
| **Second kernel** | None | Sentry, in host userspace | Guest Linux, on virtual hardware | Guest Linux, on virtual hardware |
| **Boundary enforced by** | Namespaces, cgroups, seccomp, LSMs | Syscall interception + the Sentry's own sandbox | CPU privilege levels, VM exits | Same, through a minimal VMM |
| **Hardware virtualization** | No | Optional (KVM platform) | Required | Required |
| **Resource model** | Process: dynamic | Process: dynamic | Pre-allocated vCPU and RAM | Pre-allocated, small |
| **Start-up** | Milliseconds | Container-class | Boot a kernel | Container-class boot |
| **Per-syscall cost** | Native | Higher, platform-dependent | Near-native inside the guest | Near-native inside the guest |
| **Fixed memory** | None | Small, mostly fixed Sentry cost | Guest kernel plus guest RAM | Minimal guest, tiny VMM |
| **Linux ABI** | Full | Large subset, incomplete | Full for the kernel you boot | Full for the kernel you boot |
| **Device emulation surface** | Host kernel itself | None | Large unless minimized | Deliberately small |
| **An escape needs** | One host-kernel bug | Sentry bug *and* host-kernel bug | Hypervisor or device-model bug | Hypervisor or device-model bug |
| **Snapshot / migration** | None at VM level | Not a VM primitive | Mature | Supported by Firecracker |

Cells draw on the architecture and platform guides
([intro](https://gvisor.dev/docs/architecture_guide/intro/),
[platforms](https://gvisor.dev/docs/architecture_guide/platforms/),
[performance](https://gvisor.dev/docs/architecture_guide/performance/)), the
Firecracker design document
([design.md](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)),
and Kata's "lightweight VMs that feel and perform like containers"
([katacontainers.io](https://katacontainers.io/)).

### Where the boundary actually differs

**The interception point.** A VM's guest kernel runs on the CPU; the hypervisor
sees it only at VM exits. gVisor's Sentry is ordinary host userspace; the
sandboxed workload's `syscall` instruction is caught by seccomp or `ptrace` (or,
on the KVM platform, by a virtualization-assisted context switch) and then
*interpreted* in Go. The gVisor docs call this "a merged guest kernel and VMM,
or seccomp on steroids", and note the resemblance to User-Mode Linux — with the
difference that UML still virtualizes hardware internally, and therefore keeps a
fixed resource footprint ([docs](https://gvisor.dev/docs/)).

**What the attacker must cross.** gVisor's security model has two principles:
the Sentry implements the System API instead of the host, and the Sentry's own
access to the host System API is restricted to a few high-level operations
([security](https://gvisor.dev/docs/architecture_guide/security/)). The first
principle is the one a VM also uses — an application talks to a guest OS, not
the host — but the second half differs. A VM's strength depends on what it
exposes: device emulation in the host kernel (APIC, vhost) and userspace support
code that is frequently unsandboxed can be more complex, and more exploitable,
than a system call. gVisor runs no device emulation and uses the sandboxed host
System API instead.

**Virtualization hardware is not the security property.** gVisor's KVM platform
uses the same CPU extensions a hypervisor does, so "it uses VT-x" cannot be a
security claim on its own. The security docs make this point with a car analogy
about unibody construction
([security](https://gvisor.dev/docs/architecture_guide/security/)).

**They compose.** gVisor runs inside a VM — the compatibility guide says so
directly — and GKE Sandbox gives each sandbox its own userspace kernel on the
node ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/),
[GKE](https://cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods)).
That leaves two boundaries with no shared code on the escape path.

### The costs, stated plainly

gVisor imposes no cost on raw CPU execution, and none on memory access once
mappings are installed: the application's instructions run natively. Costs are
**structural** (Sentry memory, extra software layers per syscall) and
**implementation** (subsystems gVisor has not optimized, with the network stack
named as the example). Syscall-bound workloads suffer most — the performance
guide uses Redis as the hard case, where small operations pay a large relative
overhead and larger operations amortize it
([performance](https://gvisor.dev/docs/architecture_guide/performance/)).

Two cautions about that guide. Its published numbers were generated on the
`ptrace` platform, which it calls the highest structural cost by far and
explicitly not an ideal scenario. And its start-up measurements are dominated by
Docker itself rather than by `runsc`.

A VM's costs are the inverse: fixed guest RAM and vCPUs, a kernel boot, and a
density ceiling. Firecracker's design is the deliberate minimization of that — a
1 vCPU / 128 MiB microVM at 5 microVMs per host core per second, up to 32 vCPUs,
with CPU and memory oversubscription left to the operator
([design.md](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)).

### Compatibility is the real tax

gVisor implements a subset of the Linux syscall ABI, and argues the gap is
mostly *alternatives* to calls it does support: `io_uring` is the example,
since runtimes probe and fall back. Releases are regression-tested against
Python, Java, Node.js, PHP and Go
([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).

The gaps that bite, in its own words:

- `io_uring` disabled by default; limited when enabled.
- Block-device filesystems (`fat32`, `ext3`, `ext4`) cannot be mounted inside.
- In-sandbox cgroup limits are not enforced between processes; a host cgroup on
  the whole sandbox is the workaround.
- `iptables` partial, `nftables` partial.
- Custom device files unsupported except NVIDIA GPUs and TPUs.
- Using KVM from inside the sandbox is unsupported (unrelated to the KVM
  platform).

Real deployments absorb that: Cloud Run and DigitalOcean App Platform run
arbitrary user workloads on it, and GKE Sandbox targets untrusted code,
web front-ends, CPU/ML workloads and GPU/TPU jobs
([compatibility](https://gvisor.dev/docs/user_guide/compatibility/),
[GKE](https://cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods)).
Dangerzone's document converter moved to gVisor to open hostile documents
without a VM's packaging cost
([gVisor blog](https://gvisor.dev/blog/2024/09/23/safe-ride-into-the-dangerzone/)).

## Decision guide

| If the requirement is | Pick |
|---|---|
| Untrusted tenant code, container ergonomics, high density | gVisor |
| CPU-bound work: data processing, CPU inference, web front-ends | gVisor |
| Arbitrary distro or kernel version, kernel modules, device access | VM |
| A hardware boundary as the primary control | VM or microVM |
| Container workflow plus hardware isolation | Kata-style microVM |
| Maximum assurance, cost secondary | gVisor inside a microVM |
| Protection from hardware side channels | Neither — host firmware, scheduling, mitigations |

## Gotchas

- **"gVisor uses KVM" does not make it a VM.** The KVM platform provides context
  switching and address spaces; there is no guest hardware and no device model
  ([platforms](https://gvisor.dev/docs/architecture_guide/platforms/)).
- **`runsc do` is not a security test.** It gives the sandbox read-only access
  to the entire host filesystem by default; test through the Docker or
  Kubernetes runtime instead
  ([intro](https://gvisor.dev/docs/architecture_guide/intro/)).
- **The Sentry's `sudo` is setup-time only.** It re-execs and drops privileges
  before untrusted code runs.
- **A sandbox is not a secure architecture.** gVisor is explicit that an
  exploitable network service, a missing network policy or an over-broad cgroup
  is outside what it fixes
  ([security](https://gvisor.dev/docs/architecture_guide/security/)).
- **Benchmarking gVisor on `ptrace` flatters the alternative.** It is
  unsupported and the slowest platform; `systrap` or KVM is the realistic
  comparison.
- **Container is not one boundary.** `runc`, gVisor and Kata are three
  different isolation mechanisms that all accept OCI images.

## Open Questions

- Snapshot, restore and live-migration parity between gVisor and Firecracker is
  not covered by the pages read here [unverified].
- Whether a specific workload runs is, in gVisor's own words, only answerable by
  trying it [unverified for any given image].

## Related

- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — the compatibility gaps in practice: a desktop runs, but only on a CPU-rendering path, with no DRM device.
- [AI Agent Sandboxes Compared](../product/ai-agent-sandbox-comparison.md) — the same boundaries priced as products: gVisor, container and microVM tiers.
- [Agent 37's Standard Tier](../product/agent37-standard-tier-tradeoffs.md) — what gVisor's syscall cost does to a shared-host business model.
- [Open-Source Grok Bot Alternatives](./open-source-grok-bot-alternatives.md) — gVisor, Kata and Firecracker as selectable sandbox backends.
- [OpenVZ Trade-offs — Sharing One Kernel, and What It Costs a PostgreSQL Host](./openvz-virtualization-tradeoffs.md) — the same shared-boundary argument one layer down: namespaces and beancounters instead of an application kernel, and why every database tuning knob ends up owned by the host.


## Changelog

- 2026-11-01 — cross-linked the desktop-in-gVisor companion file.

- 2026-10-29 — created from the gVisor architecture, security, platform,
  performance and compatibility guides, GKE Sandbox docs, the Firecracker design
  document, and Kata's project page.
