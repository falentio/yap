---
title: Grok Bot Extensibility — Apps, Skills, Routines, and MCP Connectors
category: technology
tags: [grok, grok-bot, mcp, connectors, plugins, skills, agents, xai]
status: complete
created: 2026-10-26
updated: 2026-10-26
sources:
  - https://docs.x.ai/grok-bot/overview.md
  - https://docs.x.ai/grok-bot/bots.md
  - https://docs.x.ai/grok-bot/computer-and-apps.md
  - https://docs.x.ai/grok-bot/skills-routines-and-automations.md
  - https://docs.x.ai/grok-bot/chat-and-collaboration.md
  - https://docs.x.ai/grok-bot/team-bots.md
  - https://docs.x.ai/grok-bot/tag-on-x.md
  - https://docs.x.ai/grok-bot/faq.md
  - https://docs.x.ai/grok/connectors.md
  - https://docs.x.ai/grok/connectors/custom-mcp-tunneling.md
  - https://docs.x.ai/build/features/skills-plugins-marketplaces.md
  - https://docs.x.ai/build/features/mcp-servers.md
  - https://docs.x.ai/developers/tools/remote-mcp.md
confidence: high
---

## Summary

**Yes — Grok Bot is extensible, but not the way a browser or an IDE is.** There is no plugin API that runs your code inside the Grok Bot app, and no UI/surface extension point. Every extension arrives through four data-and-tool contracts: **apps** (installed plugins from a catalog), **skills** (markdown instruction packs), **routines** (schedules and event triggers), and **MCP connectors** (your own server, or a Team Bot's custom MCP server). Bot-to-bot handoff, group chats, and shareable bot templates cover the "publish something others can use" case.

Three separate products share the name, and each has its own extension surface. Read the table in [Where the extension points live](#where-the-extension-points-live) before assuming a given feature exists on a given surface — the Migrator-shaped mistakes here are assuming Grok Build's plugin marketplaces exist in the Grok Bot app, or that `grok.com/connectors` connectors are available to a Grok Bot without being installed as an app.

The one hard constraint worth knowing up front: **an MCP server must be reachable over the public internet.** `localhost` and RFC1918 addresses are rejected, so local development needs a tunnel — the docs ship ngrok and Cloudflare Tunnel recipes ([custom MCP tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling)).

## Context

Asked whether "Grok bot" is extensible in the sense of extensions — custom tools, integrations, third-party add-ons — the way ChatGPT has GPTs and apps or Claude has MCP connectors. The name is ambiguous across three surfaces, so this file covers all three and says which features belong to which. Researched 2026-10-26 against the vendor's own docs at `docs.x.ai`.

## Findings

### What Grok Bot is

Grok Bot gives you named, persistent AI teammates ("Bots"), each with its own conversation, memory, and role. They run on a **persistent cloud computer** with a browser, filesystem, and terminal, so work continues with your laptop closed, and all Bots on one account share that one computer — files, browser sessions, and logins ([overview](https://docs.x.ai/grok-bot/overview.md)). The computer is per user, not per Bot: "The screens are separate work surfaces, not separate security boundaries" ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md)).

That computer is where extensibility lands. A Bot does not need an extension to touch a service — it can drive the website with computer use — but an app or MCP connector is the structured, reliable path.

### Where the extension points live

| Extension point | Grok Bot app | Grok Build (agent) | Grok API |
|---|---|---|---|
| App / plugin install from catalog | Yes — **Connect apps** sidebar ([apps](https://docs.x.ai/grok-bot/computer-and-apps.md)) | Yes — `.grok/plugins/`, marketplaces ([plugins](https://docs.x.ai/build/features/skills-plugins-marketplaces.md)) | No catalog; you compose tools yourself |
| Markdown skills | Yes — saved skills, `/` menu, shared library ([skills](https://docs.x.ai/grok-bot/skills-routines-and-automations.md)) | Yes — `SKILL.md` with YAML frontmatter ([skills](https://docs.x.ai/build/features/skills-plugins-marketplaces.md)) | No |
| Scheduled / event automation | Yes — routines, 50 per Bot, ≥5 min apart ([routines](https://docs.x.ai/grok-bot/skills-routines-and-automations.md)) | No (background tasks instead) | No (Batch, deferred completions) |
| Custom MCP server | Yes — Team Bots: remote HTTPS or local command ([Team Bots](https://docs.x.ai/grok-bot/team-bots.md)) | Yes — `grok mcp add`, `.grok/config.toml` ([MCP](https://docs.x.ai/build/features/mcp-servers.md)) | Yes — `type: "mcp"` tool ([remote MCP](https://docs.x.ai/developers/tools/remote-mcp.md)) |
| Hooks on lifecycle events | No | Yes — `~/.grok/hooks/`, plugin hooks | No |
| Subagents | Implicit — Bot-to-Bot handoff ([collab](https://docs.x.ai/grok-bot/chat-and-collaboration.md)) | Yes — child sessions ([subagents](https://docs.x.ai/build/features/subagents.md)) | Multi-agent in the model, not user-defined |
| Publish what you built | Bot **templates** (link) + **Marketplace** ([bots](https://docs.x.ai/grok-bot/bots.md)) | Plugin marketplaces | Nothing to publish |
| UI / rendering extension | Not documented `[unverified]` | Not documented (theming only) | n/a |

### Grok Bot: apps are plugins

"Apps give a Bot a structured way to work with services like Gmail, Notion, and Slack. **Apps are installed as plugins from Connect apps**" ([computer and apps](https://docs.x.ai/grok-bot/computer-and-apps.md)). The install flow is browse → Add → provider login → reference with `@`. Three properties matter:

- **Account-wide, not Bot-scoped.** A connected app is available to every Bot on the account; a teammate's Team Bot asks before using your accounts.
- **Credentials never reach the Bot.** "OAuth tokens are held on Cursor's connector backend, and the Bot invokes tools without receiving them." So an app is a tool proxy, not a token the model can exfiltrate.
- **Admin-gated.** A team's connector policy can show **Disabled by team admin**; blocking an app does not block the website, only a second control (Network Controls, Enterprise) closes that path.

Grok's own connectors (`grok.com/connectors`) are a *different* surface from Grok Bot apps, even though both are described as connectors. That page documents three tiers — built-in (Google/Microsoft/Salesforce, OAuth), a pre-configured OAuth catalog, and custom MCP ([connectors](https://docs.x.ai/grok/connectors.md)).

### Skills: the cheapest extension you can write

A skill is a reusable instruction set: when to use it, required inputs and access, the sequence of work, how to validate the result, what to return, and what requires approval ([skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations.md)). Two ways to author one:

1. **Ask for it in chat** — "Save the process we just used as a skill called Weekly account health" — which captures the steps from a completed task.
2. **Teach a task** — record a browser workflow once; the Bot drafts a skill from the demonstration. Recording is capped at **ten minutes**, captures no microphone audio, and the result is explicitly a draft: "Add decision rules, failure handling, and approval boundaries that may not be obvious from one example."

Skills live in one private library shared by all your Bots; if a skill is missing from the `/` menu it is not enabled for that Bot. Packaged skills also ship with apps — **Connect apps** is the discovery surface for both.

### Routines: the automation layer

A routine binds a skill to one Bot and a trigger — a schedule, and "where supported", an event. Documented limits: **50 routines per Bot**, **20 recent run records per routine**, schedules **at least five minutes apart**, deletion immediate and without undo, and deleting a Bot deletes its routines ([skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations.md)). Event triggers come from Cursor account integrations (Slack, GitHub) and are separate from the corresponding apps, so they may need their own connection flow.

There is no idempotency or retry contract in the product; the docs push it onto skill design — "Make retries idempotent where possible", plus an explicit no-data and stale-data policy.

### Custom MCP: bringing your own tools

Two paths, and they are not the same:

- **`grok.com/connectors` → New Connector → Custom.** Enter the MCP server URL, complete auth, and Grok discovers the tools and exposes them in conversations like any built-in connector. The server must be publicly reachable; local servers need a tunnel ([connectors](https://docs.x.ai/grok/connectors.md), [tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling.md)).
- **Team Bot plugins with a custom MCP server**, in two transports: **Remote HTTPS** (owner's credential, or per-person OAuth sign-in) or **Command** (runs on the shared computer; "a command that needs secrets works only in the owner's own chat") ([Team Bots](https://docs.x.ai/grok-bot/team-bots.md)).

For the coding-agent side, Grok Build configures MCP servers with `grok mcp add`, supports local stdio and remote HTTP with OAuth, expands `${VAR}` inside `url`/`command`/`args`/`env`/`headers`, stores tokens in `~/.grok/mcp_credentials.json`, and namespaces tools as `<server>__<tool>`. `--scope project` writes `.grok/config.toml`, which ships servers with the repo ([MCP servers](https://docs.x.ai/build/features/mcp-servers.md)).

### Grok Build: the fullest extension surface

If "extensions" means the Claude-Code-style ecosystem, this is where it lives ([skills, plugins, marketplaces](https://docs.x.ai/build/features/skills-plugins-marketplaces.md)):

- **Plugins** — "extend Grok with additional skills, agents, hooks, MCP servers, and LSP servers", loaded from `./.grok/plugins/`, `~/.grok/plugins/`, marketplace installs under `~/.grok/plugins/marketplaces/`, `[plugins] paths` in `~/.grok/config.toml`, or `--plugin-dir` on the CLI.
- **Marketplace tab in the TUI** — sources declared in `[[marketplace.sources]]`.
- **Hooks** — scripts on tool and session lifecycle events; plugin hooks get `GROK_PLUGIN_ROOT` and `GROK_PLUGIN_DATA`.
- **An extensions modal** — `/plugins`, `/hooks`, `/skills`, `/mcps` all open one manager.
- **Claude Code compatibility with zero config** — Grok reads Claude Code marketplaces, plugins, skills, MCPs, agents, hooks, and `CLAUDE.md` family files alongside `.grok/`. It also reads `AGENTS.md` and discovers skills from `~/.agents/skills/`.

Skills there are directories with `SKILL.md` YAML frontmatter (`name`, `description`, `when-to-use`, `paths`, `allowed-tools`, `argument-hint`, `user-invocable`, `disable-model-invocation`, `metadata`). Note the honest edge: `allowed-tools` "does not grant or restrict tools", and `model`/`effort`/`license`/`compatibility` are accepted but ignored.

### Publishing: templates, marketplace, Team Bots

Three distribution shapes for the app product ([bots](https://docs.x.ai/grok-bot/bots.md)):

- **Bot templates** — Share menu → Create template → Copy link, scoped **Public link** or **Team-only** (Enterprise defaults to Team-only). The recipient previews on x.ai and adds a copy; they get the configuration (identity, description, skills, routines) but not your computer, logins, or history. "Shared Bots are created by other users", and adding one accepts third-party bot terms.
- **Marketplace in the sidebar** — lists Bots you can **Add** or **Import Bot**.
- **Team Bots** — one Bot the whole team talks to, rather than a copy each person forks.

That is a genuine third-party ecosystem, closest to ChatGPT's GPT store, but with no monetisation or review pipeline documented `[unverified]`.

### What is not extensible

- **No in-process code extension for the app.** Apps, skills, routines, and MCP are the whole list; nothing in the docs describes a rendering API, custom UI, or sandboxed JS for the Grok Bot client.
- **No per-Bot isolation.** Extension state is account-wide where the docs say so (apps, the shared computer, private skills), so a Bot is not a sandbox.
- **No local-network MCP.** Public reachability is required, which rules out air-gapped internal servers without a tunnel.
- **Routine-scale ceilings.** 50 routines, 5-minute minimum spacing, 20 run records.
- **Teaching is capped.** Ten minutes of recording, draft-only output.

### Minimal recipe: your own tool, end to end

1. Write an MCP server exposing the tools you want (Streaming HTTP or SSE transport for the API path; the API rejects anything else per [remote MCP](https://docs.x.ai/developers/tools/remote-mcp.md)).
2. Expose it publicly — ngrok or `cloudflared tunnel --url http://localhost:3001`.
3. Register it: `grok.com/connectors` → New Connector → Custom for Grok, or a Team Bot plugin (Remote HTTPS) for Grok Bot, or `grok mcp add --transport http <name> <url>` for Grok Build.
4. Constrain it: `allowed_tools` on the API, the `authorization` header for static tokens, and your own schema-level validation — the server is the trust boundary, not the model.
5. Wrap the workflow in a skill so the Bot uses it the same way every time, then put that skill behind a routine.

## Open Questions

- Whether Grok Bot apps and `grok.com/connectors` connectors will converge into one registry. The docs describe both with the same vocabulary and no cross-reference.
- Whether bot templates get review, versioning, or monetisation; only public/team link scoping is documented.
- Whether `allowed-tools` in skills is enforced anywhere at runtime, given the docs say it neither grants nor restricts.
- Whether the Grok Bot app will ever take a desktop-local MCP server directly, without the connector + tunnel hop.

## Related

- [oh-my-pi (omp) — Feature Inventory](./oh-my-pi-features.md) — another agent's extension model, for contrast on plugins, hooks, and subagents.
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — how agent harnesses carry context across surfaces.
- [Open-Source Grok Bot Alternatives with First-Class Sandbox VMs](./open-source-grok-bot-alternatives.md) — which projects rebuild this product shape with a real VM or a container, and where each one stops short.
- [Grok Bot — What It Is, and How a Bot Works](./grok-bot.md) — the product overview this file assumes: what a Bot is, the shared computer, access and limits.
- [The Bot as a Primitive — Why the Bot, Not the Chat, Is the Unit](./bot-primitive.md) — why the extension points hang off a Bot rather than a session.

## Changelog

- 2026-10-26 — created. **Fallback recorded:** TinyFish was unavailable from this session (the `codemode` tool was not exposed, and the stored MCP OAuth token had expired at 2026-10-26 23:45 WIB while the refresh grant was rejected with `invalid_grant`). Sources were read with `curl` from `docs.x.ai`, which serves every page as markdown via a `.md` suffix or `Accept: text/markdown`. Confidence stays high because every claim comes from the vendor's own docs, but a TinyFish re-verification pass is owed per `AGENTS.md` §2.6.
- 2026-10-26 — linked the open-source alternatives comparison from Related.
