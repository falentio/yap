---
title: Linux Virtualizers Compared — KVM, Xen, Incus, Kata, gVisor and the Rest
category: technology
tags: [virtualization, kvm, xen, qemu, lxc, incus, lxd, kata, firecracker, gvisor, sysbox, containers, isolation, hypervisor, proxmox, wasm]
status: complete
created: 2026-11-11
updated: 2026-11-11
sources:
  - https://www.qemu.org/docs/master/system/introduction.html
  - https://github.com/qemu/qemu
  - https://docs.kernel.org/virt/kvm/index.html
  - https://en.wikipedia.org/wiki/Xen
  - https://en.wikipedia.org/wiki/Hypervisor
  - https://en.wikipedia.org/wiki/OS-level_virtualization
  - https://linuxcontainers.org/lxc/introduction/
  - https://linuxcontainers.org/incus/
  - https://github.com/lxc/incus
  - https://linuxcontainers.org/lxd/
  - https://documentation.ubuntu.com/lxd/en/latest/
  - https://stgraber.org/2023/12/12/lxd-now-re-licensed-and-under-a-cla/
  - https://katacontainers.io/
  - https://github.com/kata-containers/kata-containers
  - https://firecracker-microvm.github.io/
  - https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
  - https://cloudhypervisor.org/
  - https://github.com/cloud-hypervisor/cloud-hypervisor
  - https://gvisor.dev/docs/
  - https://gvisor.dev/docs/architecture_guide/intro/
  - https://gvisor.dev/docs/architecture_guide/platforms/
  - https://gvisor.dev/docs/architecture_guide/performance/
  - https://gvisor.dev/docs/user_guide/compatibility/
  - https://github.com/nestybox/sysbox
  - https://github.com/containers/bubblewrap
  - https://github.com/google/nsjail
  - https://www.proxmox.com/en/products/proxmox-virtual-environment/overview
  - https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing
  - https://www.proxmox.com/en/downloads/proxmox-virtual-environment
  - https://www.virtualbox.org/wiki/Downloads
  - https://blogs.vmware.com/cloud-foundation/2024/11/11/vmware-fusion-and-workstation-are-now-free-for-all-users/
  - https://github.com/bytecodealliance/wasmtime
  - https://www.pandastack.ai/blog/wasm-vs-gvisor-vs-microvm/
  - https://people.computing.clemson.edu/~jmarty/projects/lowLatencyNetworking/papers/NFVandContainers/AnupdatedPerfAnalysisofContainersandVMs.pdf
  - https://lass.cs.umass.edu/papers/pdf/middleware16-CVM.pdf
  - https://wiki.openvz.org/Comparison
confidence: high
---

# Linux Virtualizers Compared — KVM, Xen, Incus, Kata, gVisor and the Rest

## TL;DR

- **There is no dial from "weak" to "strong". There are five boundaries, and each defends a different surface.** Hardware virtualization (KVM, Xen) puts a whole guest kernel behind CPU privilege levels. A microVM (Firecracker, Cloud Hypervisor, Kata) is the same boundary with the device model amputated. An application kernel (gVisor) intercepts syscalls in userspace. OS-level virtualization (LXC, Incus, OpenVZ) shares the host kernel by namespace. And a capability sandbox (Wasm, bubblewrap) grants only what it named. ([OS-level virtualization](https://en.wikipedia.org/wiki/OS-level_virtualization), [gVisor intro](https://gvisor.dev/docs/architecture_guide/intro/), [Wasm vs gVisor vs microVM](https://www.pandastack.ai/blog/wasm-vs-gvisor-vs-microvm/))
- **CPU and memory cost is near zero everywhere; I/O and syscalls are where the bill lands.** IBM measured Docker at roughly native and KVM MySQL throughput **more than 40% below native** in *every* tested concurrency, because each I/O operation costs extra cycles ([Felter et al., 2015](https://people.computing.clemson.edu/~jmarty/projects/lowLatencyNetworking/papers/NFVandContainers/AnupdatedPerfAnalysisofContainersandVMs.pdf)). That is the number to plan against, not "VMs are slow".
- **The 2015 number is not today's number — tuning is the variable.** The same paper says good KVM CPU performance "requires careful configuration of large pages, CPU model, vCPU pinning, and cache topology". An untuned KVM guest and a tuned one are not the same product.
- **Density is a billing model, not a feature.** OS-level virtualization puts thousands of containers on one host precisely because nothing is reserved ([OpenVZ wiki](https://wiki.openvz.org/Comparison)) — which is also why a neighbour's burst is your latency.
- **Pick by the boundary the workload needs, not by the brand.** Untrusted multi-tenant code: microVM or gVisor. Your own databases: KVM with real tuning. A fleet of identical Linux services: Incus system containers. Plugins you control the language of: Wasm.

## Context

Asked 2026-11-11: compare the commonly used Linux virtualizers — OpenVZ, KVM, gVisor and the rest.

Two repo files already cover pieces of this: [gVisor vs a Hypervisor](./gvisor-vs-hypervisor.md) compares four container-boundary options in depth, and [OpenVZ Trade-offs](./openvz-virtualization-tradeoffs.md) works one shared-kernel platform through a PostgreSQL lens. Neither is a map of the whole field, and the field is what was asked for. This file is the map; those two remain the deep dives.

Terminology, because the words overlap badly:

- **Virtualizer / hypervisor** — gives a guest its own kernel on virtual hardware.
- **VMM** — the program that builds the virtual machine; QEMU, Firecracker and Cloud Hypervisor are VMMs, KVM is the hypervisor they drive ([QEMU docs](https://www.qemu.org/docs/master/system/introduction.html)).
- **MicroVM** — a VMM that deliberately omits most of the device model.
- **System container** — a full init and userland sharing the host kernel (LXC, Incus, OpenVZ).
- **Application container** — one process tree sharing the host kernel (Docker, Podman, via `runc`).
- **Application kernel / syscall sandbox** — gVisor: a second kernel in userspace.
- **Capability sandbox** — Wasm, or `bubblewrap` / `nsjail`: the workload can only name what it was handed.

## The wide comparison

Systems across the columns; the dimensions that decide an architecture down the rows.

| | KVM + QEMU | Xen | Firecracker | Cloud Hypervisor | Kata Containers | Incus / LXD (system container) | LXC | gVisor | Sysbox | Wasm (Wasmtime) | OpenVZ / Virtuozzo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Boundary** | CPU privilege + VM exits | CPU privilege, hypervisor owns hardware | Same as KVM, minimal device model | Same as KVM, Rust VMM | Same as KVM, inside OCI | Namespaces + cgroups on host kernel | Namespaces + cgroups | Userspace syscall interception (Sentry) | Namespaces + virtualized procfs/sysfs | Linear memory + imported capabilities | Namespaces + beancounters |
| **Guest kernel** | Its own | Its own, dom0 privileged | Its own | Its own | Its own | Host's | Host's | gVisor's Sentry (Linux-like) | Host's | None (Wasm bytecode) | Host's |
| **Licence** | QEMU GPLv2; KVM GPLv2 | GPLv2 | Apache-2.0 | Apache-2.0 / BSD-3-Clause | Apache-2.0 | Incus Apache-2.0; LXD AGPLv3 + CLA | LGPLv2.1+ | Apache-2.0 | Apache-2.0 | Apache-2.0 | Proprietary (Virtuozzo) |
| **Start-up** | Seconds (kernel boot) | Seconds | Container-class: 5 microVMs/core/s at 128 MiB | Container-class | Container-class | Sub-second to seconds | Sub-second | Container-class | Container-class | Sub-millisecond | Sub-second |
| **Memory floor per instance** | Guest RAM + kernel | Guest RAM + kernel + dom0 | 128 MiB microVM example | Low | Guest kernel | Shared page cache | Shared page cache | Sentry overhead | Shared page cache | Tiny linear memory | Shared page cache |
| **CPU / memory overhead** | Negligible **if tuned** | Negligible | Negligible | Negligible | Small | Negligible | Negligible | None on execution; per-syscall cost | Negligible | Near-zero | Negligible |
| **I/O overhead** | Highest — per-op QEMU cost | High | Lower than QEMU, virtio-only | Low, virtio + vhost-user | Low | Native | Native | Per-syscall tax, network worst | Native | Depends on host imports | Native |
| **Full Linux ABI** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Large subset, gaps | Nearly full | No | Yes |
| **Runs arbitrary OS** | Yes | Yes | Linux only | Linux + Windows | Linux/Windows guests | Linux only | Linux only | Linux binaries | Linux only | No | Linux only |
| **Device / GPU passthrough** | VFIO, vGPU | Yes | No | VFIO incl. migration | Yes via hypervisor | Yes | Limited | NVIDIA + TPU only | Yes | No | Host's |
| **Live migration** | Yes | Yes | Yes | Yes (n-2 guarantee) | Via hypervisor | Yes | No | Not a VM primitive | No | No | Vendor-dependent |
| **Snapshot / restore** | Yes | Yes | Yes | Yes | Via hypervisor | Yes | Yes | No | No | Wasmtime supports it | Yes |
| **Escape requires** | Hypervisor or device-model bug | Hypervisor bug | Hypervisor or tiny device model | Hypervisor or device model | Hypervisor or device model | **One host-kernel bug** | One host-kernel bug | Sentry bug **and** host bug | Two host-kernel bugs (user ns) | A Wasm runtime bug | One host-kernel bug |
| **Best for** | General server virt, databases | Legacy, driver isolation, big iron | Serverless, agent sandboxes | Modern cloud VMs, hotplug | K8s pods needing VM isolation | Homelab-to-rack private cloud | Minimal container plumbing | Untrusted container-shaped code | Docker/systemd **inside** a container | Plugins, deterministic compute | Sunsetting cheap VPS |

Licence and role facts for KVM+QEMU and Xen: ([QEMU README](https://github.com/qemu/qemu), [Xen](https://en.wikipedia.org/wiki/Xen), [hypervisor taxonomy](https://en.wikipedia.org/wiki/Hypervisor)). MicroVM figures: ([Firecracker design](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md), [Cloud Hypervisor](https://github.com/cloud-hypervisor/cloud-hypervisor)). Kata: ([katacontainers.io](https://katacontainers.io/)). Incus and LXD: ([Incus](https://github.com/lxc/incus), [LXD re-licensing](https://stgraber.org/2023/12/12/lxd-now-re-licensed-and-under-a-cla/)). gVisor: ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)). Sysbox: ([repo](https://github.com/nestybox/sysbox)). Wasm: ([Wasmtime](https://github.com/bytecodealliance/wasmtime)).
## The four families, and what each one actually buys

### 1. Full virtualization — KVM, Xen, and the desktop hypervisors

KVM is a Linux kernel module that turns the host kernel into a type-1 hypervisor; QEMU is the VMM that gives the guest a machine — CPU, memory, emulated devices, and a large VirtIO set tuned for virtualization ([QEMU docs](https://www.qemu.org/docs/master/system/introduction.html)). QEMU also drives Xen, MSHV, macOS's hvf and Windows' whpx, and falls back to TCG software emulation when no accelerator exists — which is how you run an ARM image on x86.

Xen predates KVM's mainline entry and is architecturally different in a way that still matters: the hypervisor itself owns memory management and CPU scheduling, and the **dom0** — the only domain with default direct hardware access — is where management happens ([Xen](https://en.wikipedia.org/wiki/Xen)). Xen 4.21 shipped 2025-11-19, GPLv2, on x86, ARM, RISC-V and PowerPC. The practical difference from KVM is that Xen's isolation does not depend on the host Linux kernel being correct, because the host Linux kernel is a guest too. That is why Qubes-style security designs and some clouds still pick it.

**What full virtualization costs.** Per the IBM measurement, KVM's MySQL throughput was "higher than 40% in all measured cases" below native, while Docker's approached within 2%. But the same paper's diagnosis is the useful part: the loss comes from extra cycles per I/O operation, so small I/Os suffer far more than large ones, and the fix is configuration — large pages, CPU model, vCPU pinning, cache topology ([Felter et al.](https://people.computing.clemson.edu/~jmarty/projects/lowLatencyNetworking/papers/NFVandContainers/AnupdatedPerfAnalysisofContainersandVMs.pdf)). A separate 2016 study is more precise about where: "Performance overhead of KVM is negligible for our CPU and memory intensive workloads, but high in case of I/O intensive applications", and it adds the finding that **co-located interference is worse for containers** than for VMs ([Sharma et al.](https://lass.cs.umass.edu/papers/pdf/middleware16-CVM.pdf)).

That interference result is the argument nobody repeats often enough: the container density advantage is real, and so is the noisy-neighbour penalty that comes with it.

**The desktop hypervisors are a different product category**, but the licence news earns a line: VMware Workstation and Fusion went **free for all users, commercial included, on 2024-11-11**, with the paid Pro editions withdrawn from sale and support ticketing ending at contract expiry ([Broadcom](https://blogs.vmware.com/cloud-foundation/2024/11/11/vmware-fusion-and-workstation-are-now-free-for-all-users/)). VirtualBox remains GPLv3 for the base package, with the Extension Pack under Oracle's PUEL for personal and educational use only ([VirtualBox downloads](https://www.virtualbox.org/wiki/Downloads)).

### 2. MicroVMs — Firecracker, Cloud Hypervisor, Kata

A microVM is the KVM boundary with the attack surface cut down. Firecracker runs one process per microVM, virtio-only devices (net, block, vsock, serial, partial i8042), I/O rate limiting, no network filtering, up to 32 vCPUs, and the headline density figure: **5 microVMs per host core per second** with a minimal kernel, 1 vCPU and 128 MiB ([design.md](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md)). Apache-2.0, and it is what runs Lambda.

Cloud Hypervisor is the same idea in Rust, on KVM or MSHV, 64-bit only, with CPU/memory/PCI hotplug, vhost-user device offload and machine-to-machine migration. As of v54.0 (2026-10-14) it guarantees **live migration from the two previous releases** ("n-2") and can live-migrate VMs with migratable VFIO devices ([cloudhypervisor.org](https://cloudhypervisor.org/)). Minimal emulation and low memory footprint are stated objectives, not side effects.

Kata Containers is the packaging that makes a microVM wear an OCI image: an OCI-compatible runtime booting a lightweight VM per pod, supporting QEMU, Cloud Hypervisor and Firecracker as the hypervisor underneath, on amd64, arm64, ppc64le and s390x ([katacontainers.io](https://katacontainers.io/), [repo](https://github.com/kata-containers/kata-containers)). Stewarded by the Open Infrastructure Foundation, Apache-2.0.

**Costs.** Every microVM still boots a kernel, so the memory floor and boot time are non-zero, and a guest kernel is another thing to patch. Firecracker enforces its own kernel support policy; Cloud Hypervisor supports 64-bit Linux and Windows 10/Server 2019 only.

### 3. OS-level virtualization — LXC, Incus, LXD, OpenVZ

LXC is the userspace interface to the kernel's containment features: namespaces, AppArmor/SELinux, seccomp, `pivot_root`, capabilities, cgroups. LXC's own framing is the honest one — "something in the middle between a chroot and a full fledged virtual machine", aiming for a standard Linux installation "without the need for a separate kernel" ([LXC intro](https://linuxcontainers.org/lxc/introduction/)). LGPLv2.1+.

**Incus is where most people should start.** It manages system containers, application containers *and* KVM virtual machines from one CLI and one REST API, with the same storage and network underneath, so an instance can change shape without changing tooling ([Incus](https://linuxcontainers.org/incus/)). Apache-2.0, no CLA, maintained by the people who built LXD.

**LXD is the fork's origin and a licence caution.** Canonical pulled LXD out of the Linux Containers project on 2023-07-04 ([linuxcontainers.org](https://linuxcontainers.org/lxd/)) and re-licensed it from Apache-2.0 to **AGPLv3** while adding a Canonical CLA, as of LXD 5.20 ([Stéphane Graber](https://stgraber.org/2023/12/12/lxd-now-re-licensed-and-under-a-cla/)). The resulting tree mixes AGPLv3 and Apache-2.0 contributions with no per-file metadata saying which — a real problem for licence review, and the reason Incus exists.

**OpenVZ** is the same family with beancounters instead of cgroups as the resource story, covered in depth in [its own file](./openvz-virtualization-tradeoffs.md). Proprietary (Virtuozzo), and its lifecycle is the reason not to build on it now.

**The one thing to remember about this family:** there is no second kernel, so an escape is one host-kernel bug away, and every host-global tunable belongs to the host. That is the trade density buys.

### 4. Syscall sandboxes and capability sandboxes — gVisor, Sysbox, Wasm, bubblewrap

gVisor runs a second kernel — the Sentry — as a userspace process, intercepting syscalls so the host kernel sees none of them, with a Gofer process mediating filesystem access ([intro](https://gvisor.dev/docs/architecture_guide/intro/)). Apache-2.0, ships `runsc` as an OCI runtime, and its costs are per-syscall overhead plus an incomplete Linux ABI; the compatibility page names `io_uring` (disabled by default), inability to mount ext4/fat32 inside, non-enforced in-sandbox cgroups, partial `iptables`/`nftables`, and GPU/TPU-only custom devices ([compatibility](https://gvisor.dev/docs/user_guide/compatibility/)).

**Sysbox is the middle position most people miss.** It is an OCI runtime that hardens a *container* enough to run systemd, Docker, Kubernetes or K3s inside it, using full user namespaces so container-root has zero host privileges, virtualized procfs/sysfs and locked initial mounts ([repo](https://github.com/nestybox/sysbox)). Its authors are explicit that it "does not use VMs" and "does not provide the level of isolation that VM-based runtimes do". Apache-2.0.

**Wasm is a different axis entirely.** A module's linear memory is bounds-checked and it can only name capabilities that were imported; there are no syscalls to intercept because there is no ambient authority ([Wasm vs gVisor vs microVM](https://www.pandastack.ai/blog/wasm-vs-gvisor-vs-microvm/)). Wasmtime is Apache-2.0 ([repo](https://github.com/bytecodealliance/wasmtime)). The cost mirrors the benefit: it cannot run what it was not compiled to run without a WASI shim, and host imports become the attack surface.

**bubblewrap and nsjail are not products, they are primitives.** bubblewrap builds user-namespace sandboxes for unprivileged users and explicitly warns it "is not a complete, ready-made sandbox with a specific security policy" ([bubblewrap](https://github.com/containers/bubblewrap)). nsjail adds Kafel seccomp-BPF policies, cgroup limits and an inetd-style listener mode ([nsjail](https://github.com/google/nsjail)). Reaching for either means writing the policy yourself.

## Management layers, not boundaries

The boundary and the console are separate decisions, and conflating them is the most common mistake in this space.

| Layer | What it manages | Licence / price |
|---|---|---|
| **Proxmox VE** | KVM VMs + LXC containers, one web UI, HA clustering, Ceph/ZFS | Free and open source; subscriptions €120 (Community), €370 (Basic), €550 (Standard), €1,100 (Premium) per **CPU socket** per year ([pricing](https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing)) |
| **libvirt + virt-manager** | KVM, Xen, QEMU, LXC behind one API | Free (LGPL) |
| **Incus** | System containers, application containers, KVM VMs | Free, Apache-2.0 |
| **Kubernetes + containerd** | OCI workloads, any runtime class | Free; the runtime is a plugin choice |
| **OpenStack** | VMs and bare metal at cloud scale | Free; costs are people |

Proxmox VE demonstrates the split cleanly: the software is free and the subscription buys the **Enterprise repository** plus a support entitlement, priced per occupied physical socket, not per core or per VM ([pricing](https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing)). Version 9.2 is current, with an ARM64 ISO published 2026-08-05 ([downloads](https://www.proxmox.com/en/downloads/proxmox-virtual-environment)).

## Measured overhead, with the caveats attached

| Workload | Container | KVM VM | Source |
|---|---|---|---|
| CPU-bound | Native | Negligible loss | [Felter](https://people.computing.clemson.edu/~jmarty/projects/lowLatencyNetworking/papers/NFVandContainers/AnupdatedPerfAnalysisofContainersandVMs.pdf), [Sharma](https://lass.cs.umass.edu/papers/pdf/middleware16-CVM.pdf) |
| Memory bandwidth | Native | Negligible loss | same |
| MySQL OLTP throughput | ~2% below native at high concurrency | **>40% below native, all cases** | [Felter](https://people.computing.clemson.edu/~jmarty/projects/lowLatencyNetworking/papers/NFVandContainers/AnupdatedPerfAnalysisofContainersandVMs.pdf) |
| I/O-intensive, co-located | Worse interference than VMs | Better isolation, higher per-op cost | [Sharma](https://lass.cs.umass.edu/papers/pdf/middleware16-CVM.pdf) |
| Syscall-bound (Redis-like) | Native | Near-native | gVisor is the one paying here — see [its performance guide](https://gvisor.dev/docs/architecture_guide/performance/) |

Three caveats that make those numbers usable instead of misleading:

1. **Both papers are old.** Felter is 2015 (kernel 3.11, QEMU 1.5); Sharma is 2016. Virtio, vhost, io_uring and multi-queue have all moved since. Use the *shape* — CPU free, I/O expensive, small I/Os worst — not the percentage.
2. **Untuned KVM is the default KVM.** The 40% figure is an untuned guest. Large pages, vCPU pinning and cache topology are the documented levers.
3. **The container number hides the interference.** Felter ran containers with no cgroup limits. Sharma measured co-location and found interference worse for containers. Both are true.

## Decision guide

| If the requirement is | Pick | Because |
|---|---|---|
| A database you tune yourself | KVM + QEMU, tuned | Only this gives you a kernel you own plus `shared_buffers` headroom, hugepages and swappiness |
| Untrusted code from users or agents | microVM (Firecracker/Cloud Hypervisor) | Hardware boundary, container-class start, tiny device model |
| Untrusted code, and a VM is too heavy | gVisor | Second kernel in userspace, no device model to exploit |
| Kubernetes pods needing a hardware boundary | Kata Containers | OCI image, VM isolation, no new workflow |
| A fleet of identical Linux services | Incus system containers | Native speed, one API for containers and VMs, Apache-2.0 |
| Docker or systemd inside a container | Sysbox | User namespaces, no privileged container, no VM |
| A homelab or small cluster with a UI | Proxmox VE | KVM + LXC behind one console, free until you want support |
| Plugins or deterministic compute | Wasmtime | A capability model with no syscall surface at all |
| Legacy, driver isolation, or Qubes-style trust | Xen | Hypervisor owns the hardware; the host Linux kernel is a guest |
| A cheap VPS running a static site | OpenVZ, if already paid for | Density pricing suits stateless work; see the [OpenVZ file](./openvz-virtualization-tradeoffs.md) for why not for a database |

## Gotchas

- **"Container" is four different isolation mechanisms.** `runc`, gVisor, Kata and Wasm all accept work labelled "container" and none share a boundary. Name the runtime, not the word.
- **"gVisor uses KVM" does not make it a VM.** The KVM platform swaps context switches and address spaces; there is no guest hardware and no device model ([platforms](https://gvisor.dev/docs/architecture_guide/platforms/)).
- **gVisor's `runsc do` is not a security test** — it grants read-only access to the whole host filesystem by default ([intro](https://gvisor.dev/docs/architecture_guide/intro/)).
- **LXD's licence is genuinely muddy.** AGPLv3 plus Apache-2.0 contributions with no per-file metadata, so a corporate AGPL ban hits LXD and not Incus ([Graber](https://stgraber.org/2023/12/12/lxd-now-re-licensed-and-under-a-cla/)).
- **Incus and LXD share a codebase lineage**, so tutorials cross-apply — until a command name differs. Check which one a guide was written for.
- **MicroVMs give up devices to shrink their surface.** Firecracker has no GPU passthrough and no arbitrary device model; that is the point, and it disqualifies some workloads.
- **Proxmox subscriptions are per socket.** A dual-socket node needs two, and the subscription gates the enterprise repository, not the feature set ([pricing](https://www.proxmox.com/en/products/proxmox-virtual-environment/pricing)).
- **VMware Workstation being free is a 2024 change, not a trial.** Support ticketing ends with your contract ([Broadcom](https://blogs.vmware.com/cloud-foundation/2024/11/11/vmware-fusion-and-workstation-are-now-free-for-all-users/)).
- **OpenVZ's vendor will not name an EOL**, which is itself the finding — see [the OpenVZ file](./openvz-virtualization-tradeoffs.md).
- **Co-located interference is worse in containers.** Density and predictability are opposites in this family ([Sharma et al.](https://lass.cs.umass.edu/papers/pdf/middleware16-CVM.pdf)).

## Open questions

- Cloud Hypervisor's licence is commonly reported as dual Apache-2.0 / BSD-3-Clause, matching the rust-vmm crates it is built from; its LICENSE file did not fetch, so the claim rests on secondary sources. [unverified]
- Current Kata Containers release version and its per-pod memory floor were not pinned down in this pass. [unverified]
- No 2024-or-later head-to-head benchmark of the same database workload across all four families was found; the numbers here are 2015–2016 vintage. [unverified]
- Whether gVisor's `io_uring` support has improved since its compatibility page was read was not checked. [unverified]
- Incus's licence position on code imported from LXD before the fork is not stated per-file either, though Incus claims a clean Apache-2.0. [unverified]

## Related

- [gVisor vs a Hypervisor — Application Kernel, VMM, and Where the Boundary Sits](./gvisor-vs-hypervisor.md) — the boundary argument in full, with the four-way table this file summarises.
- [OpenVZ Trade-offs — Sharing One Kernel, and What It Costs a PostgreSQL Host](./openvz-virtualization-tradeoffs.md) — one shared-kernel platform worked through a database, and the density-for-control trade named.
- [A 30 Mbps Link for PostgreSQL — Bandwidth Is Usually Not the Wall](./postgresql-30mbps-link-sizing.md) — the same round-trip-not-bytes frame that explains why per-I/O cost dominates virtualized I/O.
- [PostgreSQL GUI Clients on Linux](./postgresql-gui-clients-linux.md) — the client layer above all of this.
- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — what gVisor's ABI gaps look like when the workload is a whole desktop.

## Changelog

- 2026-11-11 — created. Licences, versions and prices checked against vendor pages and project repositories on 2026-11-11; performance figures traced to their 2015/2016 papers and flagged as to vintage.
