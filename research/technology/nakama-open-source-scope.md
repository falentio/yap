---
title: Nakama — How Much of It Is Actually Open Source, and What Sits Behind Nakama Cloud
category: technology
tags: [nakama, open-source, mit-license, open-core, saas, ai-agents, self-hosting]
status: complete
created: 2026-11-02
updated: 2026-11-02
sources:
  - https://github.com/ahmadrosid/nakama
  - https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/LICENSE
  - https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/README.md
  - https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/package.json
  - https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/Dockerfile
  - https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/CONTRIBUTING.md
  - https://withnakama.com/
  - https://ahmadrosid.github.io/nakama/
confidence: high
---

# Nakama — How Much of It Is Actually Open Source, and What Sits Behind Nakama Cloud

## TL;DR

- The **whole product** is open source: one MIT repo, no open-core split, no premium edition. The client *and* the server that deploys elsewhere both live in the repo, and the published Docker image is built from it by a Dockerfile committed in it.
- MIT is a grant, not a promise about scope, so the answer rests on the tree being complete: all five apps, ten packages, eight deploy targets, 84 server route modules, and the docs site are in the snapshot read here ([tree @ `bb1ecee`](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a)). Nothing in the tree carries a second license.
- The only closed part is **Nakama Cloud, the hosting business**: the signup and provision-instance wizard, per-workspace subscription billing, and the ops runbook behind them ([withnakama.com](https://withnakama.com/)). It is not a paid tier of the same artifact — self-hosting the container is feature-complete against the cloud product.
- Two real caveats: there is **no CLA or relicensing right** in `CONTRIBUTING.md`, and Cloud is priced per workspace in Indonesian rupiah at Rp 100.000 / month ([withnakama.com](https://withnakama.com/)), which points the project at a single regional market.

## Context

Asked on 2026-11-02 as "is this full open source or just partial, if partial what part is probably closed source" against [github.com/ahmadrosid/nakama](https://github.com/ahmadrosid/nakama). Extends [Nakama vs Hermes Agent](./nakama-vs-hermes-agent.md), which covers capability and maturity but not licensing.

Nakama is ahmadrosid and fajarhide's self-hostable AI workspace for teams: agents with per-agent prompts, tools, skills, and memory, channels into Telegram, WhatsApp, Discord and Slack, and org-scoped tenancy ([README](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/README.md)). It sells managed hosting beside the repo, at getnakama.cloud, which now redirects to withnakama.com.

Snapshot: `main` at [`bb1ecee6cd00198e99156a75d47b27c3ac70317a`](https://github.com/ahmadrosid/nakama/commit/bb1ecee6cd00198e99156a75d47b27c3ac70317a), committed 2026-11-02T16:24:32Z. 2,285 tracked files, 46 MB of git, v0.4.67 in `package.json`.

## Findings

### The license is stock MIT

`LICENSE` is the unmodified MIT text, `SPDX: MIT`, "Copyright (c) 2026 ahmadrosid" ([LICENSE](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/LICENSE)); GitHub's license API classifies the repo as `mit` ([api.github.com/repos/ahmadrosid/nakama](https://api.github.com/repos/ahmadrosid/nakama)). The README's License section repeats "MIT".

The tree holds no `LICENSE.md` rename, no per-directory license, no "premium" or "pro" directory, and no `enterprise` suffix anywhere. The only other license files are third-party copies inside a vendored linter plugin and a bundled package.

### Nothing is carved out of the tree

The complete product is present, not a severed community edition:

| Surface | Present in the repo | Evidence |
|---|---|---|
| Web dashboard | `apps/web`, full React app | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/web) |
| API server | `apps/server`, 84 route modules under `src/http/routes/` | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/server/src/http/routes) |
| Desktop | `apps/desktop`, Electron main + builder config | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/desktop) |
| CLI | `apps/cli` | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/cli) |
| Channel workers | `apps/platform/{automation,telegram,whatsapp,discord,slack,teams}` | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/platform) |
| Shared packages | `packages/{agent,client,core,db,plugins,ui,telegram-manager}` including the bundled skills | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/packages) |
| Docs site | `docs/website`, the Next app behind ahmadrosid.github.io/nakama | [tree](https://github.com/ahmadrosid/nakama/tree/bb1ecee6cd00198e99156a75d47b27c3ac70317a/docs/website) |

The `Dockerfile` is the decisive one: it builds `@nakama/web`, `@nakama/server` and every channel worker from the copied `apps` and `packages` with `bun install --frozen-lockfile`, then copies the `dist` output into the runtime stage ([Dockerfile](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/Dockerfile)). The published `ghcr.io/ahmadrosid/nakama` image is that build, not a separate proprietary artifact ([README](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/README.md)).

### There is no license gate, key check, or trial timer in the code

Grepping the file tree for `licen`, `entitle`, `billing`, `stripe`, `paddle`, `signup` and `feature-flag` returns no licensing module. `subscription-sign-in.shared.ts` is not billing — it is the ChatGPT and Grok OAuth device flows for model providers ([subscription-sign-in.shared.ts](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/web/src/components/subscription-sign-in.shared.ts)).

So the self-hosted container has every feature, forever, and expiry is a matter of the Cloud invoice, not of code in the binary. `ARCHITECTURE.md` never mentions the cloud, a license, or a paid tier at all.

### What is actually closed: the hosting business

withnakama.com sells "per workspace", Rp 100.000 per month, Rp 285.000 for three months, Rp 1.080.000 for a year, paid by bank transfer, QRIS, or e-wallet, invoiced by email a week before renewal, up to 10 workspaces per account ([withnakama.com](https://withnakama.com/)). The README sells the same thing as a three-step wizard: "Create an account. Provision an instance. Complete the first-time setup wizard in the browser" ([README](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/README.md)).

None of that machinery is in the repo: no control plane, no provisioning service, no payment integration, no multi-instance fleet code. A workspace on Cloud is one container the operator runs with backups, updates, an HTTPS proxy, and the Update button enabled through Compose.

### The parts that are genuinely not source

| Closed surface | Why it is closed | Where it is described |
|---|---|---|
| Signup, and provision-instance wizard | Runs on the vendor's infrastructure, not a shipped app | [README](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/README.md) |
| Subscription billing, renewal, workspace caps | No billing code in any package | [withnakama.com](https://withnakama.com/) |
| Ops runbook behind those | Deployment is a documented operator chore, not shipped automation | [deployment hardening](https://ahmadrosid.github.io/nakama/deployment-hardening) |
| Optional third-party services | Composio, model APIs, channel bots | [integrations](https://ahmadrosid.github.io/nakama/integrations) |

The desktop client adds a narrow, non-license gap: the macOS build is signed with a Developer ID and notarized, so only mac binaries come from Apple credentials while the source is open ([desktop README](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/apps/desktop/README.md)).

### Precedent, and the exposure that comes with it

The "open source, paid managed hosting" shape is what Cal.com and Plausible run: MIT or AGPL core, revenue from hosting, no paid feature tier. It is a business model, not a license question.

MIT also means MIT for competitors. Anyone can run withnakama.com's business and charge less, since the server, the dashboard and the channel workers are all in the tree. Nothing reserves hosting.

## The caveats worth knowing

**No CLA, no relicensing right.** `CONTRIBUTING.md` asks contributors to claim an issue and open a PR, and sets an assignment timeout, but has no clause on licensing, copyright assignment, or the right to relicense contributions ([CONTRIBUTING.md](https://github.com/ahmadrosid/nakama/blob/bb1ecee6cd00198e99156a75d47b27c3ac70317a/CONTRIBUTING.md)). A move off MIT — or an open-core split later — needs every past contributor's agreement. Forkers should price that in before building on it.

**Hosting is a regional bet.** Rupiah-only pricing, bank transfer and QRIS settlement, and "your next hire will still be human" positioning are aimed at Indonesian teams first ([withnakama.com](https://withnakama.com/)). A company outside that market self-hosts; there is no card-payment path.

**The open part is the whole product and also the whole risk.** 753 stars, four months old on 2026-11-02, pre-1.0 ([repo metadata](https://api.github.com/repos/ahmadrosid/nakama)). The isolation boundary is an `org_id` row filter enforced by service code — see [Nakama vs Hermes Agent](./nakama-vs-hermes-agent.md).

## Verdict

Full open source, MIT, with no closed-source component in the shipped product. The closed part is the business around it: withnakama.com's signup, provisioning, and per-workspace Rupiah billing. That is genuinely uncontroversial for self-hosting — every listed feature is in the repo and in the image — and genuinely weak protection for the maintainers, since a license-free path exists to compete with their own hosting.

## Open Questions

- Whether the Cloud fleet runs any private patches on top of `main`. Nothing in the repo says so, and the Docker build shares the source tree, which argues it does not.
- Whether a CLA is coming. Its absence is unlikely to be deliberate.
- Nothing here covers the Heroic Labs game server of the same name; see [Nakama vs Hermes Agent](./nakama-vs-hermes-agent.md).

## Related

- [Nakama vs Hermes Agent — A Team Platform Against a One-Operator Harness](./nakama-vs-hermes-agent.md)
- [Hermes Agent vs Grok Bot](./hermes-agent-vs-grok-bot.md)
- [The Bot as a Primitive](./bot-primitive.md)

## Changelog

- 2026-11-02 — created. Repo tree, license, Dockerfile, README, CONTRIBUTING and the cloud pricing page read at `bb1ecee` via the GitHub API and TinyFish fetch.
