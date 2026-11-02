---
title: OpenMausBot's Bot Computer — Container Isolation, the Cua Driver Seam, and Shared Screen Control
category: technology
tags: [openmausbot, computer-use, container-isolation, cua-driver, novnc, mcp, agent-sandbox, grok-bot]
status: complete
created: 2026-11-01
updated: 2026-11-02
sources:
  - https://github.com/milind-soni/OpenMausBot
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-computer.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-mcp.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-limits.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-workspace.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/local-vm-seat-pool.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/computer-control.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/control-client.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/mcp-bridge.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/routes/desktop-viewer.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/cloud-computer-tools.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/vps-computer.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/contracts.ts
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/computer-use-integration.md
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/linux-desktop.md
  - https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/self-hosting.md
confidence: high
---

# OpenMausBot's bot computer, layer by layer

Read across three commits while `main` moved under the read: `cdbf1495d3f1` ([the architecture file](./openmausbot-architecture.md)), `ac08cf72a70f` (the body below), and `b1e0ba941e5c` (the agent-placement section, 2026-11-02). `server/index.ts` measured 15,793 lines at all three.

## TL;DR

- The "Local VM" is a container, not a virtual machine. Apple's `container` runtime is the one exception, and it is a lightweight VM underneath.
- The agent never talks to the desktop. It talks to `cua-driver` over stdio MCP, and a Node proxy in the harness turns that into `docker exec -i -u cua ... cua-driver mcp --socket /run/user/1000/openmausbot-cua.sock`.
- Isolation is a flag set, not a runtime: `--cap-drop ALL` plus three caps, no privileged mode, no host namespaces, default seccomp, one bind mount, one loopback port.
- Exactly one host folder is mounted, so a rebuild keeps files, browser sign-ins, and user-installed desktop apps, but not system packages.
- A person can take the screen at any time. The bot's next action is refused rather than queued, because an action that lands late could double a click the engine already retried.
- The agent does not run in the VM. The provider CLI is a child of the harness on the host, so a bot has two shells in two places: its engine's own Bash on the host, and `vm_exec` inside the container.

## Context

[The architecture file](./openmausbot-architecture.md) said the computer is one Cua Driver contract behind four backends. That sentence hides the part that matters when you are building one of these: how the container is created, what stops it escaping, how the agent's clicks actually arrive, and what happens when a human and a bot want the same screen. This file answers those four.

## The lifecycle

```mermaid
stateDiagram-v2
    [*] --> Probing: server starts or a turn needs a desktop
    Probing --> NoRuntime: no podman, docker, or container
    Probing --> RuntimeChosen: first healthy daemon wins
    RuntimeChosen --> ImageBuild: pull pinned base, build layer
    ImageBuild --> Stopped: image ID and labels match
    RuntimeChosen --> Running: run, only if no container exists
    Stopped --> Running: start, resumable container
    Running --> Stopped: idle shutdown
    Running --> Rebuild: image layer version bumped
    Rebuild --> Running: stop, remove, run
    Stopped --> Removed: remove, ownership labels required
    Removed --> Running: run
```

Runtime detection is ordered and honest about failure. Candidates are `podman`, `docker`, and Apple's `container` on macOS only; Windows prefers Podman. Each candidate is probed with `which` or `where.exe` and then a daemon check (`podman info`, `docker info`, `container system status`), and the first healthy one wins ([`server/container-computer.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-computer.ts)). On macOS, Apple `container` can only run the shared desktop, not a per-bot one.

The commands are guarded rather than blindly re-run. `run` is rejected when a container already exists, `start` only resumes a stopped one, and `remove` refuses a container that lacks the OpenMausBot ownership labels, so a name collision with someone else's container cannot destroy their work. A turn wakes the desktop through `localVmWakeAction` (`server/index.ts:11809`) into `containerComputerAction("run" | "start")` (`:11820`). Idle shutdown calls `stop`, which keeps the writable layer.

## The flag set is the security model

`containerRunArgs` ([`server/container-computer.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-computer.ts), around line 849) assembles a defensive posture that a container engine would not give you by default:

| Flag | Value | Why it is there |
| --- | --- | --- |
| `--cap-drop ALL` | then `--cap-add SETUID`, `SETGID` | the supervisor must drop to user `cua`; nothing else |
| `--cap-add SYS_CHROOT` | Podman only | Firefox's chroot sandbox needs it |
| `--userns keep-id:uid=1000,gid=1000` | Podman only, with `--user 0:0` | rootless mapping so the mounted workspace owner matches guest `cua` |
| `--memory 4g`, `--memory-swap 4g` | 4 GB | hard ceiling, no swap escape |
| `--cpus 2` | 2 | a runaway render cannot eat the host |
| `--pids-limit 4096` | 4,096 | a fork bomb is bounded |
| `--shm-size 512m` | 512 MB | Chrome and Electron need shared memory |
| `--ipc private`, `--cgroupns private` | on | no host IPC or cgroup view |
| `-p 127.0.0.1:<port>:6901` | loopback only | the screen is never on a LAN interface |
| `type=bind,source=<workspace>,target=/home/cua/workspace` | one mount | the only host path inside |

No `--privileged`, no device passthrough, no host PID/IPC/UTS namespaces, and no `--security-opt` at all, so seccomp stays the engine's default profile and never becomes `unconfined`. Container reuse re-validates this: a candidate is only reused when `Privileged === false`, ports are loopback-only, and hardening passes. `AutoRemove` and restart policies are rejected outright, because a container that deletes itself breaks the stop/start persistence story.

The `pids-limit` number carries its own archaeology. [`server/container-limits.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-limits.ts) records that the old 512 cap killed desktops: "Firefox alone runs about 430 threads with seven tabs open (Debian 12, Oct 2026): under a 512 cap its next tab, and every `docker exec` into the desktop, fail to fork." The module raises existing containers in place with `docker update --pids-limit`, which works on running containers, so nobody has to recreate a desktop to get the fix.

One gap worth naming. Apple's `container` path only checks 4 GB and 2 CPUs on reuse, not the capability set, and the code comments that the runtime already places each Linux container in a lightweight VM. That is a defensible trade, but it means the isolation story on macOS is Apple's, not OpenMausBot's.

## The tool seam

```mermaid
flowchart LR
    Turn["Turn mounts integrations.localComputer<br/>command, args, env"] --> Proxy["node container-mcp.ts<br/>validates runtime, name, socket prefix"]
    Proxy --> Gate{"control gate<br/>per tools/call"}
    Gate -->|"a person holds the screen"| Wait["wait up to 45 s, then refuse"]
    Gate -->|"free"| Exec["docker or podman exec -i -u cua"]
    Exec --> Driver["cua-driver mcp --socket<br/>/run/user/1000/openmausbot-cua.sock"]
    Driver --> Serve["cua-driver serve<br/>permission-mode standard"]
    Serve --> Desk["Xfce on display :1"]
```

The container installs Cua Driver 0.37.0 from a SHA-256-pinned manylinux wheel, puts the binary at `/usr/local/libexec/openmausbot/cua-driver`, and asserts its `--version` at build time. The image supervisor runs `start-openmausbot-cua-driver.sh` as user `cua` with `autorestart=true` and `startsecs=2`; that script waits for X display `:1` and then runs:

```sh
cua-driver serve --socket /run/user/1000/openmausbot-cua.sock \
  --permission-mode standard --cursor-reduced-motion on
```

[`server/container-mcp.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-mcp.ts) is the whole client side, and its opening comment states the design: "It defines no tools; the shared bridge only answers ping, makes tool schemas provider-safe and keeps error results text-only." The proxy validates its three argv values (runtime must be one of the three engines, the container name must match `^[a-zA-Z0-9_.-]+$`, the socket must start with `/run/user/1000/`) and then forwards MCP over `exec`. Two details are deliberate:

1. The who-is-driving pair travels in `OMB_CONTROL_URL` and `OMB_CONTROL_TOKEN` env vars, not argv, because argv is visible to every process in `ps`.
2. There is no liveness watchdog. The runtime CLI talks to a local daemon and fails fast on its own.

Because the proxy is generic, the agent sees Cua Driver's own catalog: `click`, `double_click`, `right_click`, `drag`, `scroll`, `type_text`, `press_key`, `hotkey`, `move_cursor`, `get_window_state`, `get_desktop_state`, `get_accessibility_tree`, `list_windows`, `list_apps`, `launch_app`, `bring_to_front`, `check_permissions`, `get_screen_size`, `zoom`, `screenshot`, `start_session` ([`docs/computer-use-integration.md`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/computer-use-integration.md)). The harness declares none of them. They surface to the model under the `computer` MCP namespace as `mcp__computer__click` and friends.

A read and a write take the same path. `get_desktop_state` and `screenshot` are ordinary `tools/call` frames, and so is `click`. The harness does implement one separate read path, and only for itself: preview and readiness probe `get_desktop_state` with `--screenshot-out-file`, read the file back as base64, and reject a PNG or JPEG that arrives short or truncated.

## Four backends, one descriptor

| | Local VM | Cloud (Boat) | This computer | BYO VPS |
| --- | --- | --- | --- | --- |
| Runtime | container via podman, docker, or Apple container | provider sandbox | your own desktop | container on your server |
| Isolation | cap-drop ALL plus three caps, default seccomp, one mount | provider's, off-machine | none, it is the real seat | same flags as Local VM, remote |
| Tool surface | Cua Driver, 21 tools, passthrough | fixed 10-tool xdotool set, ajv-validated | Cua Driver, host-only rules | Cua Driver |
| Screen transport | noVNC on 6901, RFB proxied to loopback | frame polling, plus provider join URL | Cua, local | SSH forwards one loopback port to noVNC |
| Persistence | one bind mount | per-turn box | the machine | server-side volume |
| Works headless | yes | yes | no, needs the desktop app | yes |

Every backend returns the same `integrations.localComputer` descriptor ([`server/contracts.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/contracts.ts)), which each adapter mounts as the `computer` MCP server. That is the seam. The differences are deployment facts, and two of them leak:

- The cloud surface is smaller and stricter. `CLOUD_COMPUTER_TOOLS` in [`server/cloud-computer-tools.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/cloud-computer-tools.ts) is a hand-written list of ten tools (`screenshot`, `get_screen_size`, `click`, `move`, `drag`, `type_text`, `key_press`, `scroll`, `open_url`, `exec`) with ajv schemas, coordinates bounded to 32767, and a Reddit refusal because a data-centre address is not a person. It is served at `POST /api/internal/computer/mcp` behind a turn-scoped capability so the Boat credential never leaves the server.
- The host desktop is the only backend that can move a person's real focus, so it is the only one where `integrations.localComputer.scope` is set to `"local-computer"`, and the only one where host-only approval rules exist. Consent gates first use.

The BYO VPS path is the Local VM flags run against a remote engine: `docker` with `-H ssh://<alias>`, where Docker's SSH transport uses the app's own `ssh` shim and never publishes the port. [`server/vps-computer.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/vps-computer.ts) states the rule: "SSH forwards one loopback port to noVNC, and every caller-controlled part is validated before argv."

## Sharing one screen

```mermaid
flowchart TD
    Need["A turn needs this computer"] --> Mode{"localVm.mode"}
    Mode -->|"shared"| Shared["one container, vm-home, fixed port 6080"]
    Mode -->|"per-bot"| Bot["bot-sha256 container, vm-homes/hash, default max 2"]
    Mode -->|"pool"| Pool["seats pool-N, maxInstances seats"]
    Pool --> Aff{"affinity under 30 min?"}
    Aff -->|"yes"| Same["same seat as last turn"]
    Aff -->|"no"| Free{"free non-held seat?"}
    Free -->|"yes"| Claim["claim it, then renew affinity"]
    Free -->|"no"| Soonest["the seat expiring soonest"]
```

Three modes, one container contract. `shared` is a singleton with workspace `DATA_DIR/vm-home` and a fixed host port 6080, so every bot in shared mode resolves to the same desktop and shares files and browser state. `per-bot` keys by `bot:<sha256>` with workspace `vm-homes/<first-16-hex>` and a default ceiling of two containers. `pool` runs `maxInstances` seats named `openmausbot-computer-pN`, each with its own workspace.

The seat pool is the interesting one, because a seat is not assigned to a bot. A thread asks `LocalVmSeatPool.assign`: it keeps its previous seat while that affinity is under 30 minutes, otherwise it prefers a free seat that is not soft-held, and failing that takes the seat expiring soonest. Affinity is renewed only after the turn wins the seat, so a losing turn does not extend its claim.

The control gate is not a lock. [`server/computer-control.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/computer-control.ts) is an in-memory per-computer flag. Only the person's routes call `take` or `acquireLease`; a bot has no control verb at all. `control-client.ts` is the bridge-side reader: each `tools/call` is checked once, serialized in arrival order, through a cached GET of the harness control endpoint with a turn-scoped bearer, cached 750 ms and failing closed as "unconfirmed" on timeout or malformed state.

```mermaid
sequenceDiagram
    autonumber
    participant Bot as Agent tool call
    participant Bridge as mcp-bridge gate
    participant Ctl as control-client
    participant Person as Person in the Computer panel

    Bot->>Bridge: mcp__computer__click
    Bridge->>Ctl: is this computer free?
    Ctl-->>Bridge: held by a person
    Person-->>Ctl: hands control back
    Ctl-->>Bridge: free at last
    alt waited under 5 s
        Bridge->>Bot: forwarded, action runs
    else waited longer
        Bridge-->>Bot: "not performed, take a fresh screenshot"
    end
```

Two numbers make that work. A call may wait up to 45 seconds for the computer to free up, including a lazy start. But the action window is 5 seconds measured from frame arrival: if the computer only frees after that, the call is refused instead of performed, because a stale click could land after the engine already retried it and double the action. Nothing is queued or replayed, and a turn waits at most 30 minutes for a person before the wait ends (`COMPUTER_WAIT_MAX_MS`).

The refusal strings are written for the model, not for a person. [\`server/control-client.ts\`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/control-client.ts) carries four of them, each ending in the next action: \"A person has taken control of this computer, so this call was NOT performed ... To wait for them, take a screenshot ... Meanwhile you may work on anything that does not need this computer.\" The handed-back text adds the reason a retry is unsafe: a click composed before the person's hands moved must not land on whatever is under it now.

The live screen is a thin proxy. `/api/desktop-viewer/local/{shared|bot-<sha256>|pool-N}[/websockify]` returns only the VNC password on a plain GET and upgrades to a fixed `127.0.0.1:<managed port>/websockify` on a WebSocket request, never a browser-supplied URL. Auth is three layers: admin scope and same-origin at the HTTP boundary, a live session, and an RFB password generated per container run and carried in `VNC_PW`. The upstream handshake forwards no cookie, bearer token, query, or forwarded header, only that password. The phone join route is stricter still: it demands per-bot mode and a valid `controlLeaseId`, refuses shared and pool desktops with 409, and rechecks the lease every five seconds.

## Where the agent actually runs

It does not run in the VM. The container holds a desktop; the model process is a child of the harness, on the host, as the user who started the server.

```mermaid
flowchart TB
    subgraph Host["Host machine, as the harness user"]
        H["harness server 127.0.0.1:8799"]
        CLI["claude, codex, or grok CLI<br/>cwd = task-workspaces/bot/thread"]
        Native["the engine's own Bash tool<br/>no OS sandbox on a desktop install"]
        Bridge["MCP bridge, docker exec"]
    end
    subgraph Box["Local VM container"]
        Driver["cua-driver"] --> Desk["Xfce desktop"]
        VExec["vm_exec<br/>as user cua, /home/cua/workspace"]
    end
    H --> CLI
    CLI --> Native
    H --> Bridge
    Bridge --> Driver
    CLI -->|"vm_exec, through the agents proxy"| VExec
    Native -.->|"a different host folder, not mounted"| Box
```

The spawn is ordinary. [`server/drivers/claude.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/drivers/claude.ts) calls `spawnCli` with the turn's `cwd`, and [`server/procs.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/procs.ts) reaches Node's `spawn` unless the bot box wraps the command. Codex starts its own app-server the same way. The container is not in that path at all; the only way into it is the MCP bridge from the previous section.

| | The engine's own shell | `vm_exec` |
| --- | --- | --- |
| Runs on | the host, as the harness user | the container, as user `cua` |
| Working directory | `DATA_DIR/task-workspaces/<bot>/<thread>` | `/home/cua/workspace` |
| Confinement | none on a desktop install; bot box on a Cloud home | cap-drop ALL, one mount, 4 GB, 2 CPU, 4096 pids |
| Files it can reach | the whole host filesystem | the one bind mount |
| Timeout | the engine's own | 60 s default, 300 max |

The two folders are siblings, not the same folder. [`server/workspace.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/workspace.ts) creates `DATA_DIR/task-workspaces/<bot>/<thread>` for the turn and comments, plainly: "Directory organization, not a shell sandbox." The container mounts `DATA_DIR/vm-home` or `vm-homes/<hash>`. Nothing mounts the task workspace, so a file the agent writes with its own tools is invisible to the desktop until something moves it, and `attach_file` is what moves it.

`vm_exec` is a tool, not a transport. It is declared in [`server/drivers/agents-catalog.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/drivers/agents-catalog.ts) with a description that reads like advice from someone who has watched bots work badly: "Run a shell command inside your own Local VM (as the desktop user, starting in /home/cua/workspace) ... Do not type commands into a terminal window and read screenshots: that is slow and unreliable." It is advertised only when a Local VM desktop exists, and a Cloud home removes it from the catalog outright, because a local desktop is not a place on a cloud install.

The confinement question is where this design gets uncomfortable. On a normal desktop or Local VM install, the engine's shell has no OS sandbox: no `seatbelt`/`sandbox-exec`, no bubblewrap, no Landlock, no seccomp around the spawn. So the Local VM limits the GUI, not the agent. A bot that runs `rm -rf ~` through its own Bash tool hits the host, not a disposable container.

The repo does have a real sandbox for exactly this, [`server/bot-box/`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/bot-box/box.ts), and it is conditional by design:

| Aspect | Behavior |
| --- | --- |
| Mechanism | bubblewrap with user, PID, network, IPC, and UTS namespaces, plus a seccomp filter |
| Kinds | `bwrap`, `gvisor`, `user`, or `off` |
| Default | on for `OMB_CLOUD_ROLE=home` or `team`, off everywhere else |
| Never | on a non-Linux host, or without a working unprivileged bubblewrap |
| Override | `OMB_BOT_BOX=1` forces it, `0` disables it |
| Off reasons | `switched-off`, `not-linux`, `no-bwrap`, `userns-refused`, `not-cloud`, shown in Admin rather than run quietly |
| What stays visible | the turn folder, the bot folder, SOUL.md, selected sockets; `DATA_DIR` becomes an empty private folder |
| Extra | an egress gate and a harness gate for `/api/internal/` routes, plus a credential broker and filtered env |

The comment in [`server/bot-box/detect.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/bot-box/detect.ts) states the intent: a machine that refuses user namespaces "reports off with its reason rather than running turns unboxed by surprise".

### Five surfaces, and only four of them are tools

The tempting model is "one shell on the host, one shell in the VM". It is wrong in two ways. The host side is not a tool the harness provides, it is the engine itself, and there are five places a conversation can do computer work, not two.

`select_computer` in [`server/drivers/agents-catalog.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/drivers/agents-catalog.ts) takes `surface: auto | cloud | vm | local | browser`. The description is explicit about what happens next: "A pending result means end this turn immediately: OpenMausBot updates the conversation selector and resumes the original request with that computer's real tools. Do not use the old tools after requesting a switch."

| Surface | Tools the bot holds there | Runs on |
| --- | --- | --- |
| `local` | Cua Driver under `mcp__computer__*`, host rules | your real desktop, no isolation |
| `vm` | Cua Driver under `mcp__computer__*` plus `vm_exec` | the container |
| `cloud` | the fixed ten-tool set, including `exec` | Boat sandbox or your own VPS |
| `browser` | the built-in browser's read and click tools | Electron's Chromium, per-bot partition |
| `auto` | whichever configured place fits | decided at switch time |

Two asymmetries matter.

**The host shell never goes away.** Whatever surface is selected, the provider CLI is a child of the harness, so its own Bash, Read, Write, and Grep stay on the host. Selecting `vm` adds a GUI catalog and an exec tool inside the container; it does not remove the unconfined shell outside it. Only a tool-scope deny list in the bot's Access settings can remove a tool, and that is a separate mechanism from the surface.

The system prompt says both halves out loud. [`server/system-prompt.ts`](https://github.com/milind-soni/OpenMausBot/blob/b1e0ba941e5c0aa5ef4c7543edbab04b98253e80/server/system-prompt.ts) tells a bot on a Local VM desktop:

> You have your own isolated Cua sandbox: a Linux desktop in a container reserved for this bot. Only /home/cua/workspace is durable; save downloads, repositories, working files, and browser profiles there because everything else inside the VM is disposable. No other host folder is mounted. Run every command with vm_exec, which returns the exit code and the output as text; do not type commands into a terminal window and read screenshots. Create files there with vm_exec too (a shell heredoc or a script it runs); **your host file tools cannot reach the VM**.

That last clause is the app admitting the shape: there are host file tools, there are VM tools, and they are different machines. The bot is told to use both.

**`vm_exec` is not a computer tool.** It ships in the harness's own `agents` MCP server, the same catalog of 40 tools that holds `coordinate_bots`, `create_bot`, `start_thread`, and `attach_file`. The computer's GUI tools come from a different server, `mcp__computer__*`, which is Cua Driver's own catalog passed through. So the VM is reachable through two unrelated doors: one owned by the harness (a shell), one owned by the desktop driver (a screen).

## What survives a rebuild

```mermaid
flowchart LR
    WS["workspace bind mount<br/>.browser-profiles, .desktop-apps"] -->|"kept by stop, remove, rebuild"| Keep["files, sign-ins, user apps"]
    Layer["container writable layer<br/>installed packages, home files"] -->|"kept by stop and start"| Stop["resumes as it was"]
    Layer -->|"destroyed by remove + run"| Gone["gone"]
```

Exactly one host directory is mounted, at `/home/cua/workspace`, created 0700. Its path is `vm-home` for the shared desktop, `vm-homes/<hash>` per bot, or `vm-homes/pool-<n>` per seat. `stop` and `start` keep the container's writable layer, so installed packages and home files come back. `remove` plus `run` destroys that layer, and only the mount survives.

The mount is arranged so that wipe still hurts less than it sounds. [`server/container-workspace.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/container-workspace.ts) migrates the Chrome, Chromium, and Firefox profiles into `<workspace>/.browser-profiles` and symlinks them back, and symlinks `~/.local` to `<workspace>/.desktop-apps/local`. A rebuild therefore keeps browser sign-ins and any AppImage or desktop tool the person installed under the workspace, while losing `apt install` packages. Legacy desktops get their profiles rescued before removal.

The image itself is built, not pulled from a registry you do not control. `prepareManagedImage` pulls the pinned base `docker.io/trycua/xfce-cua@sha256:274eb6…be9b`, writes a generated Dockerfile into a temp directory, and runs `build -t localhost/openmausbot/cua-local-vm:driver-0.37.0-v6`. Reuse requires the image ID and four labels to match. `IMAGE_LAYER_VERSION` is the revision of that Dockerfile layer, and bumping it is what makes old containers fail `imageMatches` so the updater recreates them.

## Gotchas

- **The driver refuses unsafe input before any approval card exists.** Inside the container there is no `/dev/uinput`, so background X11 key injection is unavailable and the system prompt requires `delivery_mode: "foreground"` for keys, typing, scroll, and pixel clicks. Pixel clicks are also refused on a window this session has not read, so `get_window_state` has to come first. Accessibility targets are preferred over coordinates.
- **The Local VM is not a security boundary for the agent.** It contains the desktop and the `cua` user's files. The engine's shell runs on the host unless the bot box is on, and the bot box is off by default outside a Cloud home.
- **A bot can be in two places at once.** A file it writes in its task workspace never appears on the desktop; a file it writes with `vm_exec` needs `attach_file` to reach the chat.
- **The mount is the only durable thing.** Anything a user installs outside `/home/cua/workspace` disappears at the next rebuild, which happens on every layer bump.
- **Host control cannot work headless.** Electron passes a live Cua connection to its server child and nothing on disk or in the environment supplies one, so a Docker or systemd deployment silently has no host desktop.
- **The TCC grant follows the spawning process, not the binary.** [`docs/computer-use-integration.md`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/computer-use-integration.md) is explicit: spawn `cua-driver` from the Electron main process, never from the server or a gateway daemon, or macOS attributes the permission to the gateway and `check_permissions` cannot detect the misattribution.
- **Ubuntu Wayland host control is disabled on purpose**, fail-closed, while the real-seat input-safety gate in issue #345 is open ([`docs/linux-desktop.md`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/docs/linux-desktop.md)). Local VM and cloud computers are unaffected, because they do not touch the real seat.
- **Waiting costs a screenshot, not a poll.** The gateway gives the bot no wait verb; it waits by calling a read tool such as `screenshot`, because each computer call itself blocks up to 45 seconds. A turn that ends instead of calling again loses its place in line.
- **The viewer has no connection cap.** Every WebSocket opens its own upstream and closing one does not close the others. Only the UI limits panes, and only the control gate limits who can act.

## Open questions

- Apple `container` reuse validates 4 GB and 2 CPUs only. Whether the capability set is enforced at create time the way Docker and Podman are was not traced, and the code comment says the runtime's own lightweight VM carries the isolation argument.
- The cloud sandbox's underlying microVM technology is still not named anywhere in the repo. [`server/boat.ts`](https://github.com/milind-soni/OpenMausBot/blob/ac08cf72a70f4d334ea39e9044ecc514c0c1056c/server/boat.ts) mints a desktop URL over VNC with WebRTC fallback and the repo calls it a disposable VM.
- `maxInstances` bounds per-bot desktops and pool seats, but the default of two for every deployment is a product choice, not a measured limit. No benchmark of simultaneous desktops on one host appears in the repo.

## Related
- [Grok Bot, OpenMausBot, and OpenBot — Three Answers to the Same Primitive](./grok-bot-openmausbot-openbot-compared.md) — the three-way comparison: shared account computer vs your machine and engine choice vs a per-bot container behind a CEL gateway.

- [OpenMausBot Architecture](./openmausbot-architecture.md) — the whole-system map this file drills into.
- [Open-Source Grok Bot Alternatives with First-Class Sandbox VMs](./open-source-grok-bot-alternatives.md) — the comparison that first established the Local VM is a container.
- [Linux Desktop in gVisor](./linux-desktop-in-gvisor.md) and [The Computer-Use Stack for Agents on gVisor](./computer-use-stack-for-agents-on-gvisor.md) — the alternative isolation story this design did not take.
- [Grok Bot Extensibility](./grok-bot-extensibility.md) — what the closed product exposes on the same seam.

## Changelog

- 2026-11-01 — created from a read of `main` at `ac08cf72a70f`, plus the project's `docs/computer-use-integration.md` and `docs/linux-desktop.md`.
- 2026-11-02 — added the system-prompt text that tells a bot it has host file tools and a separate VM, which settles whether both machines are reachable at once.
- 2026-11-02 — added the five computer surfaces and why `vm_exec` lives in the agents catalog, after the two-tools framing came up.
- 2026-11-02 — added where the agent process actually runs, after the question came up: the CLI is on the host, `vm_exec` is the only path into the container's shell, and `bot-box` is the sandbox that is off by default.
