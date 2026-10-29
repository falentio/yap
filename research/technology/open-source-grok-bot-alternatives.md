---
title: Open-Source Grok Bot Alternatives with First-Class Sandbox VMs
category: technology
tags: [grok-bot, ai-agents, sandbox, microvm, firecracker, virtualization, open-source, rakazo, openmausbot, kortix, cua, celesto, e2b]
status: complete
created: 2026-10-26
updated: 2026-10-26
sources:
  - https://docs.x.ai/grok-bot/overview.md
  - https://github.com/elie222/rakazo
  - https://github.com/elie222/rakazo/blob/HEAD/LICENSE
  - https://github.com/milind-soni/OpenMausBot
  - https://github.com/kortix-ai/suna
  - https://github.com/kortix-ai/suna/blob/HEAD/LICENSE
  - https://github.com/OpenHands/OpenHands
  - https://github.com/coder/coder
  - https://coder.com/docs/ai-coder.md
  - https://github.com/trycua/cua
  - https://cua.ai/docs/cua-sdk/guides/local-runtimes
  - https://github.com/CelestoAI/celesto
  - https://github.com/opensandbox-group/OpenSandbox
  - https://github.com/e2b-dev/E2B
  - https://github.com/e2b-dev/infra
  - https://docs.e2b.dev/sandbox
  - https://docs.e2b.dev/sandbox/persistence.md
  - https://github.com/superradcompany/microsandbox
  - https://github.com/abshkbh/arrakis
  - https://github.com/daytonaio/daytona
  - https://github.com/bytebot-ai/bytebot
confidence: medium
---

## Summary

**Yes, but the full-shape alternatives are new and one of them keeps its VM support behind a provider key.** Two Apache-2.0 projects shipped explicitly as Grok Bot alternatives in August 2026:

- **[Rakazo](https://github.com/elie222/rakazo)** is the closest match: persistent bots with memory, routines, delegation, Team and Private computers, connectors, and a real [`SandboxProvider`](https://github.com/elie222/rakazo/blob/c010878b1824/packages/adapters/src/sandbox-factory.ts#L56-L121) interface with Docker, E2B, Daytona, CreateOS, Boat, Railway, and Kubernetes backends. E2B is a Firecracker microVM, Kubernetes can use Kata/gVisor, so VM-class isolation is a first-class option — but the zero-config local default is a Docker container.
- **[OpenMausBot](https://github.com/milind-soni/OpenMausBot)** has the same roster shape and is desktop-first, but its "isolated Local VM" is a Docker/Podman container in the code; only Apple's `container` CLI on macOS is VM-backed ([`server/container-computer.ts:47`](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/container-computer.ts#L47), [`:877`](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/container-computer.ts#L877)).

When the VM itself is the requirement rather than a bot roster, the two VM-native projects are **[Celesto](https://github.com/CelestoAI/celesto)** (a persistent VM "computer" per agent, snapshots, Firecracker or QEMU, Apache-2.0) and **[Cua](https://github.com/trycua/cua)** (MIT; Lume macOS VMs, QEMU Linux/Windows VMs, Firecracker microVMs, gVisor containers). Neither ships routines, connectors, or a bot roster.

The mature platforms split on isolation: **[Coder](https://github.com/coder/coder)** provisions real VMs through Terraform workspaces and runs [Coder Agents](https://coder.com/docs/ai-coder.md) inside them (AGPL-3.0), while **[OpenHands](https://github.com/OpenHands/OpenHands)** can isolate each conversation in a Docker container and uses a VM only as the backend host (MIT). **[Kortix](https://github.com/kortix-ai/suna)** (ex-Suna) is the closest product but is Elastic License 2.0, and its per-session microVM exists only on the hosted Platinum path.

Dead ends worth naming: **Daytona** archived its repository in June 2026 and moved core development private, and **Bytebot** — the earlier "containerized Linux desktop agent" — has been archived since 2025-09.

## Context

Asked on 2026-10-26 whether an open-source Grok Bot alternative exists that has **first-class sandbox VM support**. The Grok Bot baseline comes from [the earlier extensibility research](./grok-bot-extensibility.md): named persistent Bots, one shared cloud computer per account (browser, filesystem, terminal), skills, routines, connectors, bot-to-bot handoff, and templates ([overview](https://docs.x.ai/grok-bot/overview.md)).

"First-class" here means the architecture treats an isolated machine per bot or session as a supported primitive, not an add-on. "VM" is used strictly: a separate kernel under a hypervisor (Firecracker, QEMU, Apple Virtualization), not a container sharing the host kernel. That distinction matters because several READMEs call a container a VM; [OpenMausBot's own docs](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/apps/docs/content/docs/computers/local-vm.mdx#L39) do it, and so does much of the "sandbox VM" marketing in this space.

## What Grok Bot actually requires

| Requirement | What it means concretely |
|---|---|
| Bot identity | A named agent with its own conversation, memory, and history |
| A computer | Desktop, browser, terminal, and files, persistent across turns |
| Shared vs private | One computer shared by all bots on an account, or per-bot isolation |
| Routines | Cron schedules and event triggers with run history |
| Connectors | OAuth apps plus custom MCP servers |
| Delegation | Bot-to-bot handoff and short-lived subagents |
| Publishing | Shareable bot templates and a marketplace |

Grok Bot's computer is **per user, not per bot**: "The screens are separate work surfaces, not separate security boundaries" ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md)). Rakazo reproduces that split exactly, which is why it lands closest.

## Findings

### Rakazo — the closest full match, and the best sandbox design

Rakazo is Apache-2.0, created 2026-08-13, ~5.9k GitHub stars at 2026-10-26, and self-describes as "an open source, self-hosted alternative to Grok Bot" ([README](https://github.com/elie222/rakazo/blob/c010878b1824/README.md)). The feature list maps almost one-to-one onto the baseline: persistent bots with their own conversations, memory, routines and history; voice mode; shared **Team Computers** and isolated **Private computers**; browser, terminal, file and graphical desktop access; bot-to-bot delegation and subagents; Composio, Pipedream Connect, remote MCP, and OpenAPI tool sources.

The sandbox layer is the part worth copying. One [`SandboxProvider`](https://github.com/elie222/rakazo/blob/c010878b1824/packages/adapters/src/interfaces.ts#L96) contract — provision, execute, observe, act, files, export/import workspace, snapshot, stop, destroy — is implemented for `docker`, `e2b`, `daytona`, `createos`, `boat`, `railway`, `kubernetes`, plus `desktop` and test fakes ([factory](https://github.com/elie222/rakazo/blob/c010878b1824/packages/adapters/src/sandbox-factory.ts#L56-L121), [ids](https://github.com/elie222/rakazo/blob/c010878b1824/packages/contracts/src/ids.ts#L43-L53)).

Isolation class per provider:

- **Docker** — a sibling container per computer on its own bridge network, driven by a supervisor HTTP API ([computer-spec](https://github.com/elie222/rakazo/blob/c010878b1824/infra/sandboxes/supervisor/src/computer-spec.ts#L264-L279)).
- **Kubernetes** — one pod per computer, with `KUBERNETES_SANDBOX_RUNTIME_CLASS_NAME` set to `kata` or `gvisor` for a VM or user-space kernel boundary ([docs](https://github.com/elie222/rakazo/blob/c010878b1824/docs/self-host-sandbox-providers.md#L63)).
- **E2B** — wraps `@e2b/desktop`, which is a Firecracker microVM ([adapter](https://github.com/elie222/rakazo/blob/c010878b1824/packages/adapters/src/e2b-sandbox.ts#L1)).
- **Daytona, CreateOS, Boat, Railway** — remote sandboxes the repo does not classify as container or VM; each is an SDK or REST call with its own snapshot semantics.

Scope is per **computer**, never per conversation: `team:<spaceId>:<userId>` for a shared Team Computer, `bot:<botId>` for a dedicated one, with each bot confined to `bots/<bot-id>/` ([computers](https://github.com/elie222/rakazo/blob/c010878b1824/packages/db/src/computers.ts#L23-L45), [runtime docs](https://github.com/elie222/rakazo/blob/c010878b1824/docs/computer-runtime.md#L17)). The README's self-host path is Docker Compose with local Docker computers on by default; set `SANDBOX_PROVIDER=e2b|daytona|createos|boat|railway` with the matching key to move computers off the host.

Caveats: it is in beta, two and a half months old, and a VM needs either an external provider key or a Kubernetes cluster with a Kata runtime class. Nothing in the repo runs a hypervisor itself.

### OpenMausBot — the desktop-first twin, with a "Local VM" that is mostly a container

OpenMausBot is Apache-2.0, created 2026-08-11, ~5.65k stars, and also positions itself explicitly as "the open-source Grok Bot alternative" ([README](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/README.md)). It is an Electron app plus a loopback harness server: bots run the `claude`, `codex`, or `grok` CLI already installed on your machine, with transcripts and keys in `~/.openmausbot`, and each bot gets its own model, computer, apps, and thread.

Its README promises "an isolated Local VM" per bot. The code tells a narrower story: the Local VM is a container lifecycle wrapper over Docker, Podman, or Apple's `container` CLI, using the `trycua/xfce-cua` XFCE image with a bind-mounted workspace and a loopback-only VNC viewer ([`container-computer.ts:25`](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/container-computer.ts#L25), [`:47`](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/container-computer.ts#L47)). The default is one **shared** container for the whole app; per-bot containers are an opt-in mode (default 2, maximum 8) ([config](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/config.ts#L47-L53)). Only the Apple `container` path is VM-backed, and it cannot do per-bot mode because it needs a fixed host port ([`:854`](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/server/container-computer.ts#L854-L856)). The repo never names QEMU, Lima, Firecracker, or Virtualization.framework.

So: the best local-first bot UX of the group, with approval cards and host control, but not a true VM per bot. Cloud computers come from Boat, its sponsor ([README](https://github.com/milind-soni/OpenMausBot/blob/e98173acd4bd/README.md#L262)).

### Kortix (ex-Suna) — product match, license trap, hosted-only microVM

Kortix describes itself as "the open-source AI Operating System" and the leading alternative to Claude Cowork and ChatGPT Work: agents in the web app, Slack, and Teams; one isolated Linux sandbox on its own branch per session; cron and signed-webhook triggers; change requests instead of direct merges; self-host as a single Docker Compose stack ([README](https://github.com/kortix-ai/suna/blob/HEAD/README.md)). Product-wise it is the closest thing to Grok Bot's "one computer, many bots" story, at ~20.3k stars.

Two catches:

1. **The license is [Elastic License 2.0](https://github.com/kortix-ai/suna/blob/HEAD/LICENSE), not an OSI license.** It forbids providing the software to third parties as a hosted or managed service. The README says "Kortix stays open source", but that is source-available, not open source.
2. **The microVM only exists on the hosted path.** "Sessions run on Platinum, the reference sandbox provider, where each session is its own microVM. Daytona remains only as a legacy fallback, and its removal is scheduled" ([README](https://github.com/kortix-ai/suna/blob/HEAD/README.md)). Self-hosting builds a local sandbox image and runs it on Docker Compose.

### OpenHands and Coder — mature, but the VM sits in a different place

**OpenHands** is MIT, ~91.9k stars, and the largest by GitHub stars of the open coding-agent platforms. Its per-conversation runtime is exactly two options: `local` (agent on the Agent Server host) or `docker` (one container per conversation via `OH_CONVERSATION_RUNTIME=docker`) — [agent-server contract](https://github.com/OpenHands/OpenHands/blob/44d8f8f756c7/src/api/agent-server-compatibility.ts#L38), [README](https://github.com/OpenHands/OpenHands/blob/44d8f8f756c7/README.md#L116). The README's "VMs" are Agent Server backends you connect to, not per-conversation isolation units. A scout pass over the pinned checkout found no per-conversation VM or Kubernetes runtime.

**Coder** is AGPL-3.0, ~17.2k stars, and provisions workspaces from Terraform templates onto EC2 VMs, Kubernetes pods, or Docker containers ([README](https://github.com/coder/coder/blob/HEAD/README.md)). Coder Agents runs the agent loop in the control plane while the workspace stays network-isolated, so the isolation unit really can be a VM ([docs](https://coder.com/docs/ai-coder.md)). It is enterprise infrastructure with no bot memory, routines, or connectors.

### VM-native runtimes — when the VM is the requirement

These are the projects where a VM is the primitive, not a provider option.

- **Celesto** — Apache-2.0, ~1.1k stars. "Each computer is a lightweight virtual machine, starts in about 500 ms, and can keep files and state between sessions" ([README](https://github.com/CelestoAI/celesto/blob/HEAD/README.md)). Snapshots pause and restore memory, disk, and active processes; Linux uses Firecracker, macOS uses QEMU; Linux, Windows 11, and macOS preview images; shared folders, network policy, CDP browser access, and a Linux desktop with a viewer URL. It ships **OpenMuse**, an open-source computer coworker, as the reference agent.
- **Cua** — MIT, ~31k stars. One sandbox API over four isolation classes: gVisor or runc containers, QEMU VMs (KVM/HVF/WHPX), Lume macOS VMs on Apple silicon, and Firecracker microVMs (Apple `vz` or `containerization` on macOS) ([local runtimes](https://cua.ai/docs/cua-sdk/guides/local-runtimes)). Sandboxes run locally, in your own AWS/GCP/Hetzner/Modal account, or on E2B/Daytona/Modal. It is a sandbox and computer-use SDK with `cua-agent`, not a bot platform.
- **OpenSandbox** — Apache-2.0, ~16.2k stars, now an Agentic AI Foundation project. Docker locally, Kubernetes in production, with a Firecracker "Fast Sandbox" at 64 ms P50 creation, pause/resume preserving memory and disk, a credential vault, and per-sandbox ingress/egress policy ([README](https://github.com/opensandbox-group/OpenSandbox/blob/HEAD/README.md)).
- **E2B** — Apache-2.0, ~14.6k stars. Every sandbox is a Firecracker microVM with its own kernel; pause saves filesystem and memory and paused sandboxes persist indefinitely ([persistence docs](https://docs.e2b.dev/sandbox/persistence.md)). The self-hosted [E2B Embed](https://github.com/e2b-dev/infra) runs the whole stack, real Firecracker included, on one Linux host with KVM.
- **microsandbox** — Apache-2.0, ~8.8k stars. Local microVMs with hardware isolation, fork and snapshot, OCI images, long-running detached sandboxes, and an MCP server agents can call to create their own sandboxes ([README](https://github.com/superradcompany/microsandbox/blob/HEAD/README.md)).
- **Arrakis** — AGPL-3.0, ~890 stars. MicroVM sandboxes with snapshot-and-restore for backtracking, REST API and Python SDK, MCP integration ([README](https://github.com/abshkbh/arrakis/blob/HEAD/README.md)).

### Comparison — Grok Bot-shaped platforms

| Dimension | Rakazo | OpenMausBot | Kortix | OpenHands | Coder |
|---|---|---|---|---|---|
| Shape | Self-hosted bot roster | Desktop bot roster | AI OS with sessions | Coding-agent platform | Workspace platform + agents |
| License | Apache-2.0 | Apache-2.0 | Elastic 2.0 | MIT | AGPL-3.0 |
| Bot identity + memory | Yes, per-bot memory and routines | Yes, per-bot thread and model | Agents and projects, no named roster | Conversations, no bot identity | None |
| Default isolation | Docker container per computer | Shared Docker container | Self-host Docker, hosted microVM | Host process by default; Docker per conversation (opt-in) | Terraform workspace |
| First-class VM path | E2B microVM, K8s + Kata, Daytona, CreateOS, Boat, Railway | Apple `container` only | Platinum microVM on hosted only | None per conversation | EC2 VM or K8s pod |
| Desktop / browser | Browser, terminal, files, graphical desktop | Cloud Linux desktop, VNC | Browser, terminal, files | Browser image in sandbox | IDE and terminal |
| Routines / triggers | Cron, signed webhook, events | Per-bot schedules | Cron, signed webhook | Automation service `[unverified]` | None native |
| Connectors | Composio, Pipedream, MCP, OpenAPI | Composio (500+ apps) | Pipedream, GitHub, 3,000+ apps | MCP and integrations | None native |
| Self-host | Docker Compose | Electron + local harness | Docker Compose | Docker | Server + Terraform |
| Main gap vs Grok Bot | Beta; VM needs a provider key | "Local VM" is a container | License; microVM hosted only | Coding-only; Docker per conversation | Enterprise-shaped; no bot memory |

### Comparison — VM sandbox runtimes to build on

| Dimension | Cua | Celesto | OpenSandbox | E2B | microsandbox |
|---|---|---|---|---|---|
| Layer | Sandbox + computer-use SDK | Persistent VM computer | Sandbox platform | Sandbox cloud + runtime | Local microVM runtime |
| License | MIT | Apache-2.0 | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| Isolation | gVisor/runc, QEMU, Lume, Firecracker | Firecracker (Linux), QEMU (macOS) | Firecracker, K8s | Firecracker microVM | microVM (KVM) |
| Startup | Per-runtime; snapshots | ~500 ms | 64 ms P50 Firecracker | Resume from snapshot | Fast, local |
| Persistence | VM disk and snapshots | Memory, disk, processes | Pause/resume | FS + memory, indefinite | Fork and snapshot |
| Desktop / browser | Full desktops, CDP | Linux desktop, CDP | Browser and desktop examples | Desktop sandbox | No desktop layer |
| Self-host | Local or own cloud | Local or Celesto Cloud | Docker → K8s | E2B Embed on one KVM host | No server or daemon |
| Caveat | No bot platform | ~1.1k stars, preview | K8s for production | Firecracker needs KVM | No bot platform |

### Dead ends and near misses

- **Daytona** — ~71.5k stars, still recommended in "sandbox VM" lists, but the repository is archived: "As of June 2026, Daytona's core development has moved to a private codebase. This repository will receive no further updates" ([README](https://github.com/daytonaio/daytona/blob/HEAD/README.md)). Rakazo still ships a Daytona adapter, so it survives as a legacy provider, not a foundation.
- **Bytebot** — Apache-2.0, ~11.1k stars, archived 2025-09-12. It was the closest earlier shape: a self-hosted AI desktop agent inside a containerized Linux desktop. Archived, not maintained.
- **Rivet AgentOS** — Apache-2.0, ~4.8k stars; Linux-compatible sandboxes on WebAssembly. Fast, but not a VM boundary.
- **Containarium** — Apache-2.0, ~310 stars; LXC and Kubernetes backends with SSH-native isolation and eBPF egress policy. Containers, not VMs.
- **agent-vm** — MIT, ~120 stars; one disposable Lima VM per project with Claude Code, Codex, OpenCode, and Chromium inside. A personal safety wrapper, not a bot platform.
- **agentic-sandbox** — AGPL-3.0, ~12 stars; KVM-isolated VMs for persistent coding agents. Very early.

## Decision guide

- **Want the Grok Bot shape today, Apache-2.0, and a VM-backed computer** → Rakazo with the E2B provider (or Kubernetes + Kata). Accept beta status and an external provider key.
- **Want the VM itself to be the product** → Celesto for a persistent computer with snapshots, or Cua if you need macOS or Windows guests. Build the bot layer yourself.
- **Want a local desktop app with bot UX** → OpenMausBot, knowing the "Local VM" is a container unless you run Apple's `container`.
- **Want a mature platform and can accept container isolation** → OpenHands with `OH_CONVERSATION_RUNTIME=docker`.
- **Want real VM workspaces with enterprise controls** → Coder, AGPL-3.0.
- **Want the product but not strict OSI licensing** → Kortix, with the microVM only on its hosted Platinum path.
- **Building your own** → copy Rakazo's `SandboxProvider` contract, then plug in E2B, OpenSandbox, microsandbox, or Firecracker directly.

## Open Questions

- Whether Rakazo's beta holds up under sustained multi-bot load, and whether every remote provider passes the same conformance suite.
- The virtualization class of CreateOS, Boat, and Railway; the repo treats them as opaque remote sandboxes.
- Whether Kortix self-host can point at Platinum, or whether microVM isolation is permanently hosted-only.
- Whether OpenMausBot will ship a hypervisor-backed Local VM instead of the container wrapper.
- E2B Embed's minimum host size and operational burden for a single-team deployment.
- How closely Rakazo's Team Computer semantics match Grok Bot's account-wide computer in practice; the schema looks equivalent, the UX may not be.

## Related

- [Grok Bot Extensibility — Apps, Skills, Routines, and MCP Connectors](./grok-bot-extensibility.md) — the baseline product this file compares against.
- [Upstash Box vs Cloudflare Sandboxes — Price Comparison](../product/upstash-box-vs-cloudflare-sandbox.md) — hosted sandbox pricing, for the managed alternative.
- [Features Worth Porting to Pi as Extensions](./coding-agent-features-to-port-to-pi-extensions.md) — what a bot platform needs from its agent runtime.
- [Grok Bot — What It Is, and How a Bot Works](./grok-bot.md) — the product baseline in more detail: Bot anatomy, shared computer, access, limits.
- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — the architectural claim these projects reproduce, and the context failure it inherits.

## Changelog

- 2026-10-26 — created. **Fallback recorded:** TinyFish was unavailable from this session. The `tinyfish` MCP server is exposure-hidden behind a `codemode` tool that was not declared, the stored OAuth access token was rejected with `token-invalid`, and the refresh grant returned `invalid_grant`. Discovery therefore used the Exa Search API, and every claim was verified against the project's own repository or documentation through the GitHub API and raw `README`/`LICENSE` fetches. Confidence stays `medium`: all facts are first-party, but a TinyFish re-verification pass is owed per `AGENTS.md` §2.6.
