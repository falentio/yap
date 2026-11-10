---
title: OpenVZ Trade-offs — Sharing One Kernel, and What It Costs a PostgreSQL Host
category: technology
tags: [openvz, virtuozzo, virtualization, containers, shared-kernel, vps, postgresql, databases, kvm, vswap, beancounters]
status: complete
created: 2026-11-10
updated: 2026-11-10
sources:
  - https://en.wikipedia.org/wiki/OpenVZ
  - https://wiki.openvz.org/WP/Containers_density
  - https://wiki.openvz.org/WP/What_are_containers
  - https://wiki.openvz.org/Comparison
  - https://wiki.openvz.org/Releases
  - https://wiki.openvz.org/Man/vzctl.8
  - https://www.virtuozzo.com/server-docs/product-lifecycle-policy/
  - https://www.interserver.net/tips/reminder-virtuozzo-7-openvz-platform-shutdown-set-for-january-1-2027/
  - https://my.hosteons.com/announcements/319/OpenVZ-7-VPS-Range-End-of-Life.html
  - https://rafftechnologies.com/learn/guides/kvm-vps-vs-openvz-containers
  - https://massivegrid.com/blog/kvm-vs-openvz-virtualization-comparison/
  - https://buyvm.net/openvz-vs-kvm
  - https://ramnode.com/support/documentation/legacy-openvz/vswap-info
  - https://www.pandastack.ai/blog/firecracker-vs-openvz-virtuozzo/
  - https://forum.openvz.org/index.php?t=msg&goto=12026&
  - https://www.postgresql.org/message-id/533541D4.6080500%40b-one.net
  - https://betterstack.com/community/guides/databases/postgresql-asynchronous-io/
  - https://forum.proxmox.com/threads/swappiness-on-container.47888/
confidence: high
---

# OpenVZ Trade-offs — Sharing One Kernel, and What It Costs a PostgreSQL Host

OpenVZ is OS-level virtualization: one host kernel, carved into isolation domains by namespaces, with per-container accounting bolted on top ([Wikipedia](https://en.wikipedia.org/wiki/OpenVZ)). It is not a hypervisor, and it buys exactly one thing — density — by refusing to give any tenant a kernel of its own.

The hosting industry's own comparison tables already name the cost: OpenVZ's "high density, high performance" is filed beside "high dependencies from host OS" ([OpenVZ wiki, Comparison](https://wiki.openvz.org/Comparison)).

**Verdict for a database: rent KVM.** A single-tenant PostgreSQL on OpenVZ works — people run it — but every tuning knob a database actually needs is either a beancounter only the host can raise, a sysctl only the host owns, or a kernel feature the guest cannot load. Reserving OpenVZ for a database is paying das-density prices for shared-tenancy constraints you cannot manage.

## The trade in one table

| Dimension | What OpenVZ buys | What it costs |
|---|---|---|
| Kernel | None of its own — syscalls hit the host kernel ([Wikipedia](https://en.wikipedia.org/wiki/OpenVZ)) | Guest kernel pinned to the host's version, forever ([raff](https://rafftechnologies.com/learn/guides/kvm-vps-vs-openvz-containers)) |
| Density | RAM not reserved; an idle container holds 10–20 MB ([wiki](https://wiki.openvz.org/WP/Containers_density)) | Overcommit is the product, so neighbors hedge against you |
| Memory | Elastic, reclaimable, shared page cache ([wiki](https://wiki.openvz.org/WP/Containers_density)) | Soft, burstable, and borrowed memory gets taken back ([BuyVM](https://buyvm.net/openvz-vs-kvm)) |
| Isolation | Namespaces + beancounters, enforced by bookkeeping | Shared kernel is one escape away from every neighbor ([pandastack](https://www.pandastack.ai/blog/firecracker-vs-openvz-virtuozzo/)) |
| Startup | Template + copy-on-write, near-instant | Guest must match the host's OS family ([wiki](https://wiki.openvz.org/WP/What_are_containers)) |
| Modules | Usually pre-loaded by the host | Initializing one becomes a support ticket ([massivegrid](https://massivegrid.com/blog/kvm-vs-openvz-virtualization-comparison/)) |
| Price | Cheap — density is passed through | Cheap because the box is shared, not because it is idle |

Density here is measured in containers per host: the OpenVZ wiki puts "a few hundreds of typical containers" on a conventional laptop ([wiki](https://wiki.openvz.org/WP/What_are_containers)) and "thousands" per physical server in its own leaflet. That number is precisely why the tenancy is shared.

## For PostgreSQL specifically

Five concrete gates, in the order a database hits them.

### 1. `shared_buffers` is capped by a beancounter you cannot raise

PostgreSQL's shared memory is accounted by the container's `shmpages` beancounter — "Maximum IPC SHM segment size" on the `vzctl set` contract ([vzctl(8)](https://wiki.openvz.org/Man/vzctl.8)). The sibling `privvmpages` documents the same shape: an upper boundary that "does not guarantee that container will be able to allocate that much memory" ([vzctl(8)](https://wiki.openvz.org/Man/vzctl.8)).

The failure is old and unchanged in character. A 2007 forum report: `shared_buffers` would not exceed ~30 MB, `shmpages` already raised to 128 MB, `privvmpages` at 1 GB, zero failcounters — and the answer was that `kernel.shmmax` inside the container still defaulted to 32 MB ([openvz forum](https://forum.openvz.org/index.php?t=msg&goto=12026&)). A 2014 report: a streaming-replica hot standby crashing at a shared_buffers of 4 GB, working again only when tuned down ([pgsql-general](https://www.postgresql.org/message-id/533541D4.6080500%40b-one.net)).

Both fixes are the host's: raise `shmpages` on the container, and raise `kernel.shmmax` inside it. Neither is a ticket a tenant can open and expect.

### 2. The sysctls PostgreSQL wants are read-only

A container's `/proc/sys` is a virtualized subset; host-global VM tunables are not writable. `vm.swappiness` returns `Read-only file system` from inside ([Proxmox forum](https://forum.proxmox.com/threads/swappiness-on-container.47888/)), and `vm.nr_hugepages` is a host reservation. So the memory tuning a database guide gives you on line one — lower swappiness, reserve huge pages, tune the writeback — is host business.

### 3. Huge pages and io_uring are out of reach

PostgreSQL's large-page path needs `vm.nr_hugepages` reserved on the host, and io_uring (`io_method = io_uring`, the fast option in PG18) needs Linux ≥ 5.1 plus a kernel that allows the syscall ([betterstack](https://betterstack.com/community/guides/databases/postgresql-asynchronous-io/)). A container with no page reservation and a host kernel chosen by a stranger gets neither.

### 4. Memory is burstable, and bursting is revoked

The OpenVZ wiki states the model plainly: a container's memory "is not reserved", and overcommit is "as natural and easy as on a standalone Linux box" ([wiki](https://wiki.openvz.org/WP/Containers_density)). BuyVM's version from the provider side: burst resources are borrowed from peers and "have to be returned as soon as possible — should the other VPS want their dedicated resources back, your processes might become unstable or terminated" ([BuyVM](https://buyvm.net/openvz-vs-kvm)).

vSwap softened this by replacing the parameter soup with a RAM-plus-swap model ([RamNode](https://ramnode.com/support/documentation/legacy-openvz/vswap-info)), but vSwap swap is host disk, not guest memory. A page cache a database wants warm is exactly what the host reclaims first.

### 5. There is no guest kernel

`modprobe` depends on what the host pre-loaded ([massivegrid](https://massivegrid.com/blog/kvm-vs-openvz-virtualization-comparison/)). `uname -r` reports the host's kernel. Extensions, ZFS, a BPF-heavy agent, a kernel-specific build of the DB — each is either already there or a plan change.

## And the platform is sunsetting

Virtuozzo's own lifecycle table puts Virtuozzo Server 7 at end-of-maintenance July 2024 and end-of-life December 2027, with the EOL date tied to an upgrade path that does not ship yet ([Virtuozzo lifecycle policy](https://www.virtuozzo.com/server-docs/product-lifecycle-policy/)). The OpenVZ wiki still lists OpenVZ 7 as "Supported" with EOL "TBD" ([wiki/Releases](https://wiki.openvz.org/Releases)).

Providers have already voted. InterServer stopped taking new Virtuozzo 7 orders over three years ago, cites "a quiet upstream development cycle with no clear upgrade path to Virtuozzo 8 or 9" and a 3.x kernel, and locks the final shutdown at 2027-01-01 ([InterServer](https://www.interserver.net/tips/reminder-virtuozzo-7-openvz-platform-shutdown-set-for-january-1-2027/)). hostEONS dropped its OpenVZ 7 range in 2024 — plans for an 8 were dropped, focus moved to a 9 "with no release date" ([hostEONS](https://my.hosteons.com/announcements/319/OpenVZ-7-VPS-Range-End-of-Life.html)).

Pinning a database to a platform whose vendor will not name an EOL and whose successors have no date is a migration you are scheduling now, at migration prices.

## When OpenVZ is still the right answer

- A static site, a small LAMP/LEMP stack, a throwaway build box, a prototyping container — kernel-free work that ends when it ends.
- Density under an orchestrator that does its own resource control and treats instances as cattle.
- Any price tier where the KVM alternative is 3–5× — and the data is reproducible.

## When to pay for KVM instead

- **Any stateful database**, PostgreSQL especially: you need `shared_buffers` headroom, page reservation, swappiness, and a kernel you chose.
- A container host of your own (Docker inside the guest needs kernel capabilities the provider gates).
- Anything with a kernel module or a kernel-version floor.
- Anything whose uptime matters past 2027.

## The counter-argument, stated fairly

The virtualization label is not the benchmark. A well-run OpenVZ host beats a badly oversubscribed KVM host, and a standard Linux API server will not notice the difference on either ([raff](https://rafftechnologies.com/learn/guides/kvm-vps-vs-openvz-containers)). Both models still depend on host patching and provider discipline.

What KVM changes is not speed. It is who owns the knobs.

## See also

- [gVisor vs a Hypervisor — Application Kernel, VMM, and Where the Boundary Sits](./gvisor-vs-hypervisor.md) — the same shared-boundary argument at a different layer, and why a user-space application kernel is a third position.
- [Turso for Production Use — Reliability Assessment](./turso-production-reliability.md) — the managed-database route when the host's kernel stops being your problem at all.
