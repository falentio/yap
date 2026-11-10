---
title: Aside — An AI Browser Whose Two MCP Tools Are `exec` and `repl`, and What That Buys
category: technology
tags: [aside, asideai, ai-browser, browser-agent, computer-use, mcp, cua-driver, agent-desktop, credentials, native-apps, spare-laptop, online-mind2web]
status: complete
created: 2026-11-07
updated: 2026-11-07
sources:
  - https://aside.com/
  - https://aside.com/developers
  - https://aside.com/features/browser-agent
  - https://aside.com/features/password-manager
  - https://aside.com/features/memory
  - https://aside.com/pricing
  - https://aside.com/download
  - https://aside.com/manifesto
  - https://aside.com/blog/developers
  - https://aside.com/sota
  - https://docs.aside.com/help/developers
  - https://docs.aside.com/help/channels
  - https://docs.aside.com/help/troubleshooting
  - https://docs.aside.com/changelog/components
  - https://uxdev.org/blog/aside-browser-age
  - https://github.com/at-inc/aside-benchmarks
  - https://raw.githubusercontent.com/at-inc/aside-benchmarks/main/README.md
  - https://github.com/at-inc/aside-benchmarks/blob/main/LICENSE
  - https://github.com/modu-ai/moai-adk/tree/main/.claude/skills/moai-ref-aside-browser
  - https://www.typingmind.com/skills/modu-ai-moai-ref-aside-browser
  - https://www.eesel.ai/blog/aside-ai-browser-review
  - https://x.com/garrytan/status/2104221282095218731
  - https://x.com/AsideAI
  - https://www.producthunt.com/products/aside-6
  - https://www.ycombinator.com/companies/aside
confidence: medium
---

# Aside

## TL;DR

- **Aside is a browser first, but since 2026-10-23 it also drives the desktop.** Computer Use lets a task read and control apps on this machine on macOS and Windows, via screenshots and coordinates after the DOM cannot reach ([changelog](https://docs.aside.com/changelog/components), [troubleshooter](https://docs.aside.com/help/troubleshooting)). It is a rung, not the default: the browser is still the machine, and the page tree is native rather than scavenged.
- **Its answer to the login wall is a password manager, not a profile.** Aside Vault autofills into the site so the agent logs in without the credential ever entering the model context, with scoped access per task and an audit log ([vault](https://aside.com/features/password-manager)). No driver in the vault solves this; they inherit whatever cookies happen to be lying around.
- **The MCP surface is exactly two tools and that is the whole contract.** `exec` runs the internal agent on logged-in sites; `repl` runs Playwright-style JavaScript against open pages. You hand over a natural-language task or raw page script — there is no per-element tree, no refs, and no snapshot namespace for your agent to hold.
- **It solves the disturbance problem by relocation, not by cleverness.** Put it on a spare machine and nothing you are doing gets interrupted ([the pattern, from Garry Tan](https://x.com/garrytan/status/2104221282095218731)). That is the same answer as Orgo or Cua Spaces, with your own credentials instead of a fresh profile.
- **macOS 15+ and Windows 10 22H2+/11 only — no Linux.** For this vault's Linux-and-gVisor thread that is the sharpest limit, and it is a hard wall rather than a gap.
- **The benchmark numbers are striking and self-graded.** 297/300 (99.0%) on Online-Mind2Web and 75.5% perfect tasks on Odysseys, run by one model, graded by an LLM, published in Aside's own MIT repo. Impressive shape, no independent replay.
- **Treat it as an evidence-fetcher for coding agents and a personal web-automation surface.** The project's own developer page scopes it to CI logs, dashboards, staging screenshots and docs while you stay in the editor ([developers](https://aside.com/blog/developers)).

## Context

Asked on 2026-11-07 to consider Aside as an alternative in the [Cua Driver vs Vercel agent-desktop](./cua-driver-vs-vercel-agent-desktop.md) comparison. The vault had no coverage; a grep for "aside" across `research/` returned nothing.

Aside is worth its own file rather than a row in that table because it is a different kind of object. Both drivers there are *observation-and-input* layers under a harness. Aside is an *agent product* — it ships its own loop, its own model access, its own memory ([memory](https://aside.com/features/memory)), and its own credential store — with a driver underneath. It is a peer of the harness you would have put Cua Driver under, not of Cua Driver, and its desktop capability is one of its tools rather than its interface.

Aside is a Y Combinator Fall 2025 company (At Your Side Inc), San Francisco, launched publicly around 2026-06-23 ([Product Hunt](https://www.producthunt.com/products/aside-6), [review timeline](https://www.eesel.ai/blog/aside-ai-browser-review)).

## What Aside actually is

| Property | Value | Source |
|---|---|---|
| Owner | At Your Side Inc, YC F25 | [YC](https://www.ycombinator.com/companies/aside) |
| Base | Chromium, rebranded as a product browser | [independent review](https://www.eesel.ai/blog/aside-ai-browser-review) |
| Licence | Proprietary app; **MIT** on the benchmark repo only | [LICENSE](https://github.com/at-inc/aside-benchmarks/blob/main/LICENSE) |
| Platforms | macOS 15.0+; Windows 10 22H2+ and 11, x64 and ARM64. **No Linux** | [developers](https://aside.com/developers) |
| Model inside | Yes — bring your own subscription or API key, or use built-in models | [homepage](https://aside.com/), [developers](https://docs.aside.com/help/developers) |
| Agent loop inside | Yes; the caller delegates tasks, not keystrokes | [developers](https://aside.com/developers), [agent page](https://aside.com/features/browser-agent) |
| Price | Free 500 credits/mo; Pro $20/mo; Max $200/mo; Enterprise | [pricing](https://aside.com/pricing) |
| Data posture | Local-first, on-device memory, Secure Enclave, post-quantum at rest | [homepage](https://aside.com/) |
| Distribution | `.dmg` / Windows installer; unauthenticated download API | [download](https://aside.com/download) |

The positioning is explicit and adversarial toward integration-based agents: "Unlike other AI agents that rely on integrations, Aside just uses websites and accounts directly, just like you do" ([homepage](https://aside.com/)). The manifesto goes further — the browser is "the operating system for AI" and agents working "from the outside" through integrations are the thing being replaced ([manifesto](https://aside.com/manifesto)).

## The agent surface, exactly

| Interface | Shape | What it expresses | What it cannot |
|---|---|---|---|
| `aside "task"` | One natural-language task | Delegation to the internal agent | Any per-step control |
| `aside mcp` → `exec` | MCP over **stdio**, one tool | Same delegation, from your agent | Same |
| `aside mcp` → `repl` | Playwright-style JavaScript, 120 s timeout | Deterministic navigation, reading, screenshots, downloads | Nothing state-changing without care |
| `aside repl` | The REPL directly | The above, interactively | Same |
| Channels | Slack, Telegram, Discord via **your own bot** | Conversational entry, pairing-gated | Programmatic callbacks |
| HTTP API | Installer downloads only | Resolving a build | Sessions; there is no task REST API |

Two MCP tools. No hosted MCP URL, no outbound webhook contract, no documented rate-limit guarantee — the developer page says so plainly ([developers](https://aside.com/developers)). A third-party skill that wraps it describes the same two tools and warns that "flag and tool names here reflect one observed version; if a probe or a call fails, treat Aside as absent" ([skill page](https://www.typingmind.com/skills/modu-ai-moai-ref-aside-browser), [skill source](https://github.com/modu-ai/moai-adk/tree/main/.claude/skills/moai-ref-aside-browser)).

The consequence is worth stating flatly: **your agent does not get a tree.** It gets a text box and a JavaScript console. Everything Cua and agent-desktop spend their complexity on — refs, snapshot scoping, typed errors, partial observation — is internal to Aside and invisible to the caller.

There is one genuine compensation. The REPL hands back "the same page snapshots and stable element refs that the browser agent uses, so a click or assertion lines up with what Aside will actually act on" ([developers blog](https://aside.com/blog/developers)). Determinism, yes; a programmatic contract, no.

## Desktop control

Computer Use extends a task from tabs to applications. Announced 2026-10-23: "Ask the agent to work across desktop apps on Mac and Windows. Mention apps in chat, watch live previews, and take over when needed" ([changelog](https://docs.aside.com/changelog/components)).

| Property | Detail |
|---|---|
| Gate | **Max plan** ($200/mo) or experimental accounts; `Settings > Agents > Computer Use` ([changelog](https://docs.aside.com/changelog/components)) |
| OS | macOS and Windows only |
| Scope | Tasks running **on this computer**; cloud tasks and Remote Control cannot use it ([troubleshooter](https://docs.aside.com/help/troubleshooting)) |
| Permissions | macOS needs Accessibility and Screen Recording, granted once for both ([changelog](https://docs.aside.com/changelog/components)) |
| Method | Reduced accessibility tree first, screenshot-and-coordinate fallback when DOM control is insufficient ([analysis](https://uxdev.org/blog/aside-browser-age)) |
| Supervision | Live previews; the human takes over when needed |
| Remote | Usable from Channel agents, which can also approve actions in-channel ([changelog](https://docs.aside.com/changelog/components)) |

That escalation order is the same one [Cua Driver's ladder](./cua-driver-vs-vercel-agent-desktop.md) climbs, and the same one the benchmark measures — tree first, pixels after. Aside arrives at it from the opposite direction: a browser that grew an OS arm, not an OS driver that grew a browser.

Three things it still does not give you:

- **Not over MCP.** `exec` delegates to the internal agent, which may reach for apps; there is no `click(x, y)` for your own harness to call. The desktop is inside the agent, not on the interface.
- **Not in the cloud.** A task running remotely cannot touch the machine in front of you, and a task running locally is the only place the feature exists.
- **Not on Linux**, and not on any plan below Max — so it costs $200/mo and still cannot sit on the gVisor desktops this vault documents.

What it does buy is the spare-laptop pattern in full: one machine, plugged in, where the agent opens a native app and then a tab, with the same credentials and the same human gate. That is closer to the Grok Bot shape than anything a driver here offers.

## The credential model

This is the part no driver in the vault has, and it is the reason to consider Aside at all.

AI agents stall at login. Aside's answer is a password manager built for an agent: credentials autofill into the page and never enter the model context, access is scoped to what each task needs, every use is logged, and hardware-backed encryption holds the vault ([vault](https://aside.com/features/password-manager)). Sensitive actions — payments, posts, messages — wait for a human click before they land.

Two honest riders:

- **The human gate is product copy, not a documented contract.** The independent review's sharpest point is that the approval checkpoint is visible in the UI but not spelled out in the privacy policy, while Ultrabrowse is described as running on its own "until it's done" ([review](https://www.eesel.ai/blog/aside-ai-browser-review)). For work aimed at other people, that should be enforced, not implied.
- **Permission is a three-value flag and only one interface honours it.** `ask`, `guard` and `full-access`, where omitted means Guard. `repl` takes no permission flag at all, so its read-only posture is discipline rather than enforcement — which is why the wrapping skill tells its orchestrator to restrict REPL work to navigation, reading and screenshots ([skill](https://www.typingmind.com/skills/modu-ai-moai-ref-aside-browser)).

## The benchmark claims

| Benchmark | Result | Grader |
|---|---|---|
| Online-Mind2Web, 300 tasks | 297 passed, 2 failed, 1 impossible — **99.0%** (99.3% excluding impossible) | `gpt-5.4`, automated |
| Odysseys, 200 tasks | 151 perfect — **75.5%**; 1,050/1,182 rubric items, 86.5% average | `gemini-3.1-flash-lite` |
| BU-Bench-V1 | Charted; no table read here | — |

Aside carries its own chart on the [SOTA page](https://aside.com/sota); the figures below come from the repository behind it. Both runs are a single model, `gpt-5.5` via `openai-codex`, high thinking, fast mode, 900-second task timeout on Mind2Web ([README](https://raw.githubusercontent.com/at-inc/aside-benchmarks/main/README.md)). The harness, runner code and per-task results are in the repo, which is more than most vendors publish.

What weakens it: Aside wrote the tasks' framing, ran the runs, chose the grader, and published in its own repository. Every competitor figure in the chart — Browser Use at 97.7%, GPT-5.4 at 92.8%, Claude Opus 4.8 at 84.0% — is an Aside-run number. The review's phrasing is the right rule of thumb: "read the number, then read who graded it" ([review](https://www.eesel.ai/blog/aside-ai-browser-review)).

One methodological detail is genuinely creditable: impossible tasks are separated from failures, with the reason named. The two real failures were both live-inventory facts — a laptop out of stock, a monitor search that just failed. That is the correct way to report a live-web benchmark, and it also shows the ceiling: a live-web suite measures the web's stock levels as much as the agent.

## Where it fits

| Layer | Who | What the caller gets |
|---|---|---|
| OS observation and input | [Cua Driver](./cua-driver-vs-vercel-agent-desktop.md), [agent-desktop](./cua-driver-vs-vercel-agent-desktop.md), Peekaboo, Windows-MCP | A tree, a screenshot, typed errors, per-element refs |
| A browser with its own agent | **Aside**, [Playwright MCP](https://github.com/microsoft/playwright-mcp), browser-use | A delegated task or a page script |
| A machine of its own | [Orgo](https://www.orgo.ai/), Simular Box, Cua Spaces | A desktop nobody else touches |

Read down that column and Aside lands as a **narrowing**: from all three OSes to one application class, and from an input contract to a task contract. It wins where the job is genuinely browser-shaped and behind a login — which is most white-collar work, and precisely the case where a desktop driver burns its turns on pixels and pop-ups.

The three things it fixes outright:

- **The login wall.** No cookie harvesting, no fresh-profile fingerprint, no "please sign in" stall.
- **Antibot friction.** A real Chromium with real credentials is the whole point of the spare-laptop advice: "It lets your agents your real credentials as yourself from a real Chromium" ([Garry Tan](https://x.com/garrytan/status/2104221282095218731)).
- **Disturbance.** Nothing you are doing gets interrupted, because it is not on your screen.

The three it does not:

- **Native control on your terms.** Computer Use exists, but only on Max, only on the local machine, and only through the internal agent — a Blender session on Free is still out of reach.
- **Linux.** No build, so it cannot sit on the gVisor desktops this vault otherwise documents.
- **Determinism under your control.** You cannot make it act on element 8 of snapshot 3, only ask again or script the REPL.

## The spare-laptop pattern

The deployment that makes Aside coherent is a machine nobody is using: a plugged-in laptop, a mini PC, a VM. It is the same economic answer as renting a sandbox, except the credentials are already yours and the fingerprint is already a real one.

It is also a positional trade the vault should name. A cloud desktop gives you cleanliness and a fresh identity; a spare machine with your logins gives you your actual access and your actual history, and takes on the blast radius. The vault's gVisor thread is entirely about containing that radius ([gVisor control path](./computer-use-stack-for-agents-on-gvisor.md)); Aside's containment is a local sandbox with filesystem and network guards plus the approval gate, which is weaker than a kernel boundary and stronger than a bare desktop.

CLI sessions vanish about 15 minutes after they finish unless `aside settings save-sessions true` is set ([docs](https://docs.aside.com/help/developers)) — plan around that if the run is an audit trail.

## Limits

| Limit | Detail |
|---|---|
| No Linux | macOS 15+ and Windows only, both arch variants on Windows |
| Computer Use behind Max | $200/mo floor, and unavailable in cloud tasks |
| Two MCP tools | `exec` and `repl`; no element tree, no snapshot ids, no error codes. Computer Use is internal to the agent, so it adds no primitive either |
| Proprietary | Only the benchmark repo is MIT; the browser is closed |
| Self-graded benchmarks | One model, LLM grader, Aside's own repo, no third-party replay |
| No programmatic API | No task REST endpoint, hosted MCP, webhooks, or rate-limit contract |
| REPL unguarded | 120-second timeout, no permission flag, read-only by convention |
| Session loss | CLI sessions are pruned ~15 min after completion by default |
| Young | Public since 2026-06-23; early users already reported bugs ([review](https://www.eesel.ai/blog/aside-ai-browser-review)) |
| Not for CI | The wrapping skill excludes `CI=true` outright ([skill](https://www.typingmind.com/skills/modu-ai-moai-ref-aside-browser)) |
| Not for public pages | A plain fetch is cheaper and already works |

## Routing

| If | Then |
|---|---|
| The task lives behind your logins on a site with a real UI | **Aside**, on a machine you do not use |
| You want your coding agent to read a private CI log or dashboard | **Aside** over MCP, evidence only |
| You need deterministic element-level control | a driver, or Aside's REPL if you accept one page |
| Native apps, and you will pay for Max | **Aside** Computer Use, on a spare machine |
| Native apps on Free or Pro, or in the cloud | a driver — [Cua Driver](./cua-driver-vs-vercel-agent-desktop.md) or agent-desktop |
| The host must be Linux | not Aside; a driver, or a browser MCP inside the guest |
| Public pages only | a plain fetch, not a browser |

## Gotchas

- **Three hostnames.** `aside.com` is the product, `asidehq.com` sits in the benchmark README and the hiring address, and [@AsideAI](https://x.com/AsideAI) is the social handle. `aside.ai` is not the canonical site.
- **`exec` is state-changing by definition.** It drives a full agent that clicks, types and submits. Any read-only claim has to be enforced by the prompt, not assumed. With Computer Use on, the same run can also type into whatever app has focus.
- **The approval gate is not in the privacy policy.** If the run spends money or speaks to a customer, verify the gate yourself.
- **Computer Use is off by default and gated twice** — by plan and by the local-run requirement. A cloud or Remote Control task will never use it, and says nothing.
- **macOS needs two TCC grants**; without them the feature is invisible rather than erroring.
- **Credential file placement matters.** `ASIDE_CLI_AUTH_PATH` must be an absolute path in private, writable, durable storage, and the same value must ride every later call — a shell export does not cover new shells ([docs](https://docs.aside.com/help/developers)).
- **Channels expose the bot to strangers.** Pairing is required by default and requests expire in an hour, but anyone who finds the bot can file one ([channels](https://docs.aside.com/help/channels)).
- **"Nothing is shared with LLM providers" is vendor copy.** Tasks are local by default and memory is on-device, but the model still sees page text.

## Negative results

- **Aside does not run on Linux** — no build, no timeline given.
- **Aside exposes no per-element tree over MCP.** Two tools, task-shaped; it is not a ref-driven driver — Computer Use does not change that, being internal to the agent.
- **Computer Use has no cross-machine path**: not in cloud tasks, not over Remote Control, not on Linux.
- **There is no public task API, hosted MCP endpoint, or webhook contract**, so Aside cannot be an event target in an orchestration layer.
- **`repl` takes no permission flag**, so its read-only guarantee is not enforceable at the interface.
- **The benchmark suite is single-model and self-graded**; no independent reproduction was found on 2026-11-07.
- **Neither Cua Driver nor agent-desktop overlaps this job** — both inherit cookies and neither stores credentials, so "use a driver" is not a substitute for the login story.

## Open questions

- Whether the approval gate survives being driven over MCP under a `full-access` prompt with no human watching.
- Whether Computer Use ships below Max, and whether it ever becomes an MCP-visible primitive rather than an internal tool.
- Whether Aside will do Linux, given its whole pitch is "the machine you actually use".
- Whether anyone outside Aside reproduces the Mind2Web figure.
- What happens to a run's audit log after the 15-minute session prune.

## Related

- [Cua Driver vs Vercel agent-desktop — the driver head-to-head](./cua-driver-vs-vercel-agent-desktop.md)
- [Computer-use stacks for agents under gVisor](./computer-use-stack-for-agents-on-gvisor.md)
- ["Bevel agent desktop" — the name collisions and the shell-class field](./bevel-agent-desktop.md)
- [Cua — what the project is and what "Cua sandbox" means](./cua-computer-use-stack.md)
- [OpenMausBot's bot computer — the Cua Driver seam](./openmausbot-computer-layer.md)
- [Open-source Grok Bot alternatives with first-class sandbox VMs](./open-source-grok-bot-alternatives.md)

## Changelog

- 2026-11-07 — corrected after the asker pointed out Aside also has desktop control. Added the Computer Use section, plan and locality gates, table row, routing split and limits, and demoted the "different layer" framing from a category claim to a composition claim. The earlier draft's "native apps are invisible" was wrong as written.
- 2026-11-07 — created after the ask to consider "asideai" as an alternative to Cua Driver and agent-desktop. All external sources via TinyFish search and fetch. Confidence is `medium`: every fact is cited to a primary source read on this date, but the product is five months old, closed-source, and its benchmark numbers are self-graded with no independent replay found.
