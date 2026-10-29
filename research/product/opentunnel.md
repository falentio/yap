---
title: opentunnel.xyz — Anomaly's blind TLS tunnel (ngrok alternative)
category: product
tags: [tunnel, ngrok, tls, sni, reverse-proxy, localhost, anomaly, opencode, cli, sdk]
status: complete
created: 2026-10-28
updated: 2026-10-28
sources:
  - https://opentunnel.xyz/
  - https://github.com/anomalyco/opentunnel
  - https://opentunnel.xyz/install
  - https://opentunnel.sh/
  - https://opentunnel.net/
  - https://medium.com/the-writing-table/opentunnel-xyz-a-practical-guide-to-securely-exposing-local-services-to-the-internet-fb4efed99478
  - https://gridinsoft.com/online-virus-scanner/url/opentunnel-xyz
  - https://anoma.ly
confidence: high
---

# opentunnel.xyz — Anomaly's blind TLS tunnel (ngrok alternative)

## TL;DR

- **[opentunnel.xyz](https://opentunnel.xyz/) is the hosted service and website of OpenTunnel**, an MIT-licensed "blind TLS tunnel" from [Anomaly](https://github.com/anomalyco) — the org behind the [opencode](https://github.com/anomalyco/opencode) coding agent. It gives a localhost port a public HTTPS URL: `opentunnel route add 3000` → `https://<route>.<id>.opentunnel.xyz` ([repo](https://github.com/anomalyco/opentunnel)).
- **The differentiator is where TLS terminates.** The relay reads only the hostname out of the TLS ClientHello and forwards the *still-encrypted* stream over a WebSocket bridge; the certificate private key never leaves your machine, which terminates TLS itself ([homepage](https://opentunnel.xyz/), [architecture](https://github.com/anomalyco/opentunnel)).
- **It is not authentication.** The tunnel hostname and its certificate are published to Certificate Transparency logs, and route names, while absent from logs, are guessable ([homepage](https://opentunnel.xyz/)).
- **Three unrelated projects share the name "OpenTunnel".** The `.xyz` one is a localhost-to-public-URL tunnel; `.sh` is an agent command tunnel by a different author; `.net` is a free SSH/V2Ray VPN. Verify the domain, not the name.

## Context

Asked 2026-10-28: "what is https://opentunnel.xyz/?" The answer needs the name disambiguated first, because two other live services and a Play Store app answer to "OpenTunnel" and none of them is related.

## Findings

### What it is

A CLI plus SDK that turns `127.0.0.1:<port>` into a public HTTPS URL hosted under `*.opentunnel.xyz`, with the relay acting as a blind forwarder ([homepage](https://opentunnel.xyz/)). The repo states the design goal plainly: "a blind TLS tunnel. Each client receives a unique `<id>.opentunnel.xyz` hostname and terminates TLS locally, so the server never holds the certificate private key or sees HTTP plaintext" ([README](https://github.com/anomalyco/opentunnel)).

The pitch is ngrok-shaped, with one structural change: a normal tunnel proxy terminates TLS at the edge and *can* read HTTP. Here the edge cannot.

### The design, per the homepage's five steps

1. The first route creates a tunnel: a random hostname plus a private key generated on your machine; the key never leaves it ([homepage](https://opentunnel.xyz/)).
2. The CLI sends a certificate request for that hostname. The certificate is issued, bound to the tunnel name, and renewed for the same key before expiry. The relay only ever holds the public half ([homepage](https://opentunnel.xyz/)).
3. A local background service keeps an encrypted bridge open to the relay. SDK clients share one tunnel, each with its own routes ([homepage](https://opentunnel.xyz/)).
4. A visitor connects to the public URL; the relay reads only the hostname from the TLS handshake and pushes the encrypted stream through the bridge ([homepage](https://opentunnel.xyz/)).
5. Your machine terminates TLS with the private key and proxies the decrypted traffic to the local app ([homepage](https://opentunnel.xyz/)).

Routing key is SNI, so route names never have to appear in any log: the issued certificate is a wildcard ([homepage](https://opentunnel.xyz/)).

### Interfaces and install paths

| Need | Surface | Install |
| --- | --- | --- |
| Shell | `opentunnel route add <port>` | `curl -fsSL https://opentunnel.xyz/install \| sh`, `brew install anomalyco/tap/opentunnel`, `yay -S opentunnel-bin`, `npm install -g opentunnel`, `cargo install opentunnel-cli` ([README](https://github.com/anomalyco/opentunnel)) |
| Code | `@opentunnel/client` (TS, runs on Bun/Node/Deno): `create()` → `tunnel.connect({ routes })` ([homepage](https://opentunnel.xyz/)) | `bun add @opentunnel/client` ([homepage](https://opentunnel.xyz/)) |
| Proxied client IP | `--proxy-protocol v1` / `v2` per route ([README](https://github.com/anomalyco/opentunnel)) | flag on the route |
| Corporate TLS inspection | OS trust store by default; `SSL_CERT_FILE`, `SSL_CERT_DIR`, `--ca-cert`, `OPENTUNNEL_CA_CERT`; `HTTPS_PROXY` / `ALL_PROXY` minus `NO_PROXY` ([README](https://github.com/anomalyco/opentunnel)) | config |

The install script is a plain POSIX `sh` that fetches a prebuilt binary from GitHub Releases, and it supports Linux and Darwin on x64 and arm64 only ([script](https://opentunnel.xyz/install)). No Windows path is offered ([script](https://opentunnel.xyz/install), [README](https://github.com/anomalyco/opentunnel)).

Route names are a random 16 characters by default; `--name api` gives a readable one ([README](https://github.com/anomalyco/opentunnel)).

### Operating stack

| Layer | Choice | Source |
| --- | --- | --- |
| Relay binary | one Rust binary, `crates/opentunnel-server` (not published) | [README](https://github.com/anomalyco/opentunnel) |
| Hosting | Fly.io, app `opentunnel` in `iad`, raw TCP on 443 plus port 80 | [README](https://github.com/anomalyco/opentunnel) |
| State | MySQL (PlanetScale) for tunnel records, certificate state, issuance jobs | [README](https://github.com/anomalyco/opentunnel) |
| Certificates | ZeroSSL over ACME with DNS-01 challenges in the Cloudflare-hosted zone, renewed 30 days out | [README](https://github.com/anomalyco/opentunnel) |
| Clients | Rust lib (`opentunnel`) plus CLI (`opentunnel-cli`); TS SDK (`@opentunnel/client`) sharing `spec/vectors` | [README](https://github.com/anomalyco/opentunnel) |
| License / access | MIT; "We don't accept pull requests", issues only | [README](https://github.com/anomalyco/opentunnel) |

### Security model, and where it stops

| Property | What it means for you | Source |
| --- | --- | --- |
| Relay is blind to HTTP | Bytes stay encrypted to your machine; the relay holds no key | [homepage](https://opentunnel.xyz/) |
| Hostname is public | Anyone with the URL reaches your services; the certificate is in CT logs, so the hostname is discoverable by anyone watching them | [homepage](https://opentunnel.xyz/) |
| Route names are private, not secret | Absent from logs (wildcard cert) but guessable — `api`, `postgres` — so never treat one as auth | [homepage](https://opentunnel.xyz/) |
| Your app sees a loopback peer | The app sees a loopback peer and the visitor's own headers, so it must not treat tunneled requests as local; the repo carries a dedicated `docs/trust-boundary.md` | [README](https://github.com/anomalyco/opentunnel) |
| Visitor IP needs opt-in | Without `--proxy-protocol` the app cannot see the real client address; enable it only if the app expects the header | [README](https://github.com/anomalyco/opentunnel) |
| Metadata is visible to the relay | The relay necessarily sees SNI hostnames, connection timing, and sizes. Inference from the design rather than a stated limit [unverified] | — |

The practical rule the project states itself: "put auth in the services themselves — anything sensitive behind a tunnel should authenticate on its own" ([homepage](https://opentunnel.xyz/)).

### Adoption signals

As of 2026-10-28 the repo shows **361 stars, 26 forks, 113 commits**, MIT, and no description or topics ([repo page](https://github.com/anomalyco/opentunnel)). A LinkedIn post two weeks before this reading framed the release as "Think ngrok, but even easier" ([LinkedIn, snippet only](https://www.linkedin.com/posts/kostastsale_opentunnel-public-urls-for-anything-activity-7513950209312296962-8i19)). A Medium walkthrough from 2026-10-13 restates the architecture and security caveats without independent testing ([Neion Chowdhury](https://medium.com/the-writing-table/opentunnel-xyz-a-practical-guide-to-securely-exposing-local-services-to-the-internet-fb4efed99478)). Young project, small but real signal.

The parent org is verifiable rather than inferred: `github.com/anomalyco/opentunnel` and `github.com/anomalyco/opencode` sit in the same [GitHub org](https://github.com/anomalyco). The corporate site [anoma.ly](https://anoma.ly) shows consumer products (Rebase trivia, an Antarctica bike challenge) and never mentions opentunnel, so the GitHub org is the stronger link than the marketing site.

### Name collisions — three different products

| Dimension | [opentunnel.xyz](https://opentunnel.xyz/) | [opentunnel.sh](https://opentunnel.sh/) | [opentunnel.net](https://opentunnel.net/) |
| --- | --- | --- | --- |
| Operator | Anomaly (`anomalyco`) | `akoenig` (`ghcr.io/akoenig/opentunnel`) | unnamed, running since 2021 |
| What it does | public HTTPS URL for a local port | remote command execution for an AI agent | SSH/V2Ray/XRay/OpenVPN/WireGuard proxy accounts |
| Transport | SNI-routed blind TLS tunnel over a WebSocket bridge | ephemeral E2E-encrypted command tunnel | classic VPN/SSH tunneling |
| Access model | persistent hostname and certificate per tunnel | one invite, one client, one command, dies on Ctrl+C | account or subscription |
| Persistent state | MySQL records, long-lived tunnel | in-memory only, nothing stored | accounts, servers |
| Self-hosting | not offered (server crate unpublished) | one Docker container | n/a |

Sources: [.xyz](https://opentunnel.xyz/), [.sh](https://opentunnel.sh/), and [.net](https://opentunnel.net/) (search-result summary; the `.net` site was not fetched in full). A Play Store app `com.opentunnel.app` is a fourth unrelated claimant — an SSH-tunnel censorship-bypass client ([play.google.com](https://play.google.com/store/apps/details?id=com.opentunnel.app), snippet only).

### Reputation: one blacklist hit worth reading correctly

A URL-reputation aggregator reports "Multiple security vendors blacklist Opentunnel.xyz, and our checks show a 32/100 trust score" ([gridinsoft, search snippet](https://gridinsoft.com/online-virus-scanner/url/opentunnel-xyz); the page itself returned `bot_blocked` to a fetch). What the underlying blacklist entries actually allege is [unverified].

Read as a heuristic, not a finding: these scores key off young domains, the `.xyz` TLD, and keywords like "tunnel", and none of the fetched primary sources shows malicious behavior. The client is MIT-licensed and the install script only downloads a GitHub release binary ([script](https://opentunnel.xyz/install)). What the blacklist does correctly imply: the domain has no reputation history, so the trust argument has to come from the source, not from the domain.

### Pricing, terms, limits

No pricing page, no plan table, and no stated rate limits appear on the homepage or in the README ([homepage](https://opentunnel.xyz/), [README](https://github.com/anomalyco/opentunnel)). `/terms` and `/privacy` both return **404** ([probe](https://opentunnel.xyz/terms)). So: free to use as observed on 2026-10-28, with no published SLA, quota, data-retention statement, or acceptable-use policy — the operator's obligations are unstated.

## Open Questions

- Is the hosted relay free indefinitely, and what are its throughput and concurrency limits? Nothing published; needs a test or an answer from the operator.
- Does a tunnel survive laptop sleep or an IP change, and how long does hostname state live in MySQL after the client stops? Answerable only from `crates/opentunnel-server` source.
- Why is `.xyz` flagged by reputation vendors while `.sh` and `.net` are not? Domain age and TLD heuristics is the likely answer, unverified.
- The CT-log exposure is a mild leak of your endpoint's existence when the URL is shared with a third party; whether that matters depends on the use case.

## Related

- [NAT networks — what network address translation is and how it behaves](../technology/nat-network.md) — why a machine behind NAT needs an outbound relay to become reachable at all.

## Changelog

- 2026-10-28 — created. Read: homepage, GitHub README, install script, the `.sh` namesake, the Anomaly corporate site; `/terms` and `/privacy` returned 404; the reputation vendor blocked fetching.
