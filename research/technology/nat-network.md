---
title: NAT networks — what network address translation is and how it behaves
category: technology
tags: [networking, nat, napt, ipv4, nat-traversal, udp, tcp]
status: complete
created: 2026-10-20
updated: 2026-10-20
sources:
  - https://en.wikipedia.org/wiki/Network_address_translation
  - https://www.rfc-editor.org/rfc/rfc3022.html
  - https://www.rfc-editor.org/rfc/rfc4787.html
  - https://www.rfc-editor.org/info/rfc2663/
  - https://www.rfc-editor.org/info/rfc1918/
  - https://www.rfc-editor.org/info/rfc8489/
  - https://www.rfc-editor.org/info/rfc5128/
confidence: high
---

# NAT networks — what network address translation is and how it behaves

## TL;DR

- **A NAT network is a network whose hosts sit behind a translation device** that rewrites IP headers in flight, so internal (usually RFC 1918 private) addresses never appear on the wire: [RFC 3022](https://www.rfc-editor.org/rfc/rfc3022.html).
- The everyday meaning is **NAPT / PAT / "IP masquerading"**: many internal `ip:port` pairs multiplexed onto **one** public `ip:port` tuple, because the port is the disambiguator — not just the address.
- It exists because IPv4 has ~4.3 billion addresses and ran out; one routable address per site (or per carrier subscriber) became the norm — [Wikipedia](https://en.wikipedia.org/wiki/Network_address_translation).
- The consequence that matters architecturally: **sessions are outbound-only unless you punch a hole** (port forwarding, PCP/NAT-PMP, or hole punching/STUN/ICE/TURN), and NAT breaks the end-to-end principle.

## Context

Asked as "what is nat network". It reads three ways and all three are the same mechanism at different scopes:

| Reading | Means |
|---|---|
| The mechanism | Network Address Translation — rewriting source/dest IP (and often port) fields in transit |
| The topology | A private/LAN/overlay network *behind* a NAT gateway (home router, CGNAT, cloud NAT, container/VM NAT) |
| The vendor feature | Docker/VMware/VirtualBox/libvirt "NAT network" — a virtual switch that SNATs guests to the host's address |

This file covers the mechanism and the behavior taxonomy, then the concrete cases (home, CGNAT, cloud, container/VM). Sources are the RFCs plus the Wikipedia summary; behavior claims come from [RFC 4787](https://www.rfc-editor.org/rfc/rfc4787.html) (BCP 127), which is what STUN/ICE/TURN implementations actually code against.

## Abbreviations

| Abbreviation | Expansion | Note |
|---|---|---|
| NAT | Network Address Translation | umbrella term; RFC 1631 coined it |
| NAPT | Network Address and Port Translation | the many-to-one case; what "NAT" usually means |
| PAT | Port Address Translation | Cisco-flavored name for NAPT, a.k.a. *NAT overload* |
| SNAT | Source NAT | overloaded: some vendors read *static* / *stateful* / *secure* NAT |
| DNAT | Destination NAT | port forwarding is DNAT |
| CGNAT | Carrier-Grade NAT | a.k.a. NAT444 when a home router NATs behind it |
| NAT66 | NAT for IPv6 | ULA prefix masqueraded to one GUA |
| NAT-T | NAT Traversal (IPsec) | ESP-in-UDP so IPsec survives header rewriting |
| ALG | Application Level Gateway | per-protocol payload fixer; FTP is the classic |
| STUN | Session Traversal Utilities for NAT | asks a server what your external ip:port is |
| TURN | Traversal Using Relays around NAT | relay fallback, works through anything |
| ICE | Interactive Connectivity Establishment | tries STUN/punching, falls back to TURN |
| PCP | Port Control Protocol | explicit "open this mapping" request to the NAT |
| NAT-PMP | NAT Port Mapping Protocol | Apple's predecessor to PCP |
| UPnP IGD | UPnP Internet Gateway Device | the consumer-router port-forwarding protocol |
| UNSAF | UNilateral Self-Address Fixing | RFC 3424 class of techniques STUN belongs to |
| SOHO | Small Office / Home Office | the deployment class NAPT was designed for |

## Findings

### 1. The core operation

A NAT device is a router that, in addition to forwarding, **edits the packet headers** and keeps **per-session state** so the reverse direction can be translated back. RFC 3022 splits it into two flavors:

- **Basic NAT** — one-to-one mapping of an internal address to an external address. Only the IP header (address, header checksum, and any transport checksum covering the address) changes. Addresses are exhausted if you have more hosts than public addresses.
- **NAPT (Network Address Port Translation)** — many internal addresses *and their transport ports* collapse into one registered address plus assigned ports. This is what everyone means by "NAT" in practice. ICMP queries ride the same scheme via the query identifier field, which is mapped like a port; sessions other than TCP/UDP/ICMP-query are simply not permitted through a NAPT box ([RFC 3022 §2.2](https://www.rfc-editor.org/rfc/rfc3022.html)).

The translation tuple for NAPT is *(local IP, local port) ⇄ (registered IP, assigned port)*.

### 2. Outbound flow, step by step

1. Host `10.0.0.10:3017` sends to `138.76.29.7:23`.
2. The NAT rewrites the source to its WAN address and a port it allocates, e.g. `138.76.28.4:1024`, and **records the binding** in a translation table.
3. The reply arrives addressed to `138.76.28.4:1024`; the NAT looks the destination port up in the table, rewrites the destination back to `10.0.0.10:3017`, forwards inside.
4. No table entry ⇒ the packet is **dropped or rejected** — the box has nowhere to send it.

That last point is the whole discipline of NAT: an inbound packet with no matching state does not exist. It also means NAT is *not* a firewall in the security sense — its filtering is a side effect of connection tracking, and RFC 4787 explicitly says the three mapping behaviors "make no difference to the security properties of the NAT".

### 3. Behavior taxonomy — mapping and filtering are separate axes

The folk taxonomy (full-cone / restricted-cone / port-restricted-cone / symmetric) came from [RFC 3489's] STUN and was **deprecated as a description** because real boxes don't fall cleanly into it. RFC 4787 replaced it with two independent behaviors:

**Mapping** — which external port gets reused when the same internal `ip:port` opens sessions to *different* destinations:

| Behavior | Reuses external mapping for | Notes |
|---|---|---|
| Endpoint-Independent Mapping | any destination | `MUST` per REQ-1; the "cone" family |
| Address-Dependent Mapping | same destination IP, any port | |
| Address- and Port-Dependent Mapping | same destination ip:port only | the "symmetric NAT" case |

**Filtering** — which inbound packets are let through at all:

| Behavior | Inbound allowed from |
|---|---|
| Endpoint-Independent Filtering | anyone, once the mapping exists (full cone) |
| Address-Dependent Filtering | hosts you have already sent to, any port |
| Address- and Port-Dependent Filtering | only the exact ip:port you have sent to |

RFC 4787 recommends endpoint-independent mapping (REQ-1) and, when transparency matters, endpoint-independent filtering (REQ-8) — otherwise ICE ends up falling back to a relayed path.

**A common real-world hybrid:** symmetric mapping for outbound plus **static port mapping** for inbound, which is what a consumer router's port-forwarding page is ([Wikipedia](https://en.wikipedia.org/wiki/Network_address_translation)).

Two more behaviors the RFC pins down, because peer-to-peer code depends on them:

- **Port preservation** — the external port equals the internal one. Important for TCP hole punching, where a port can carry only one connection at a time and the peer must predict it; irrelevant for UDP, where one socket fans out to many destinations. Collisions (two internal hosts asking for the same external port) force a remap.
- **Hairpinning** — two hosts behind the *same* NAT reach each other via the NAT's external address. Without it, "connect to your public IP" fails on the LAN.

### 4. The variants you actually meet

| Variant | What it does | Where you see it |
|---|---|---|
| **SNAT / masquerade** | rewrite source; the outbound case above | home router, `iptables -t nat -j MASQUERADE` |
| **DNAT / port forwarding** | rewrite destination; publish an internal service on a public ip:port | `dnat` rules, cloud load balancers |
| **Static NAT (1:1)** | fixed mapping, both directions | servers needing a stable public address |
| **Dynamic NAT (pool)** | maps to a *group* of public addresses | enterprise edge |
| **CGNAT (carrier-grade / NAT444)** | carrier NATs subscribers, then the home router NATs again | mobile/LTE, fixed wireless, some ISPs |
| **Cloud NAT** | managed SNAT for instances without public IPs | AWS NAT Gateway, GCP Cloud NAT |

SNAT/DNAT are direction labels; note the acronym is overloaded across vendors — *source NAT*, *stateful NAT* (Cisco), *static NAT* (WatchGuard), *secure NAT* (F5/Microsoft) all abbreviate to "SNAT".

**Hairpinning needs both halves.** The realistic hairpin case from RFC 4787 §4.4 is two hosts with *conflicting* RFC 1918 addresses on either side of a second NAT; they can only meet through temporary public endpoints, and only if the shared upstream NAT hairpins.

### 5. What NAT breaks

- **End-to-end connectivity.** An IAB-readable architectural violation, tolerated as a deployment necessity. Inbound-initiated connections and stateless protocols are disrupted; VoIP, video, and P2P all need traversal.
- **Payload-embedded addresses.** FTP active mode, SIP/SDP, H.323 carry `ip:port` *inside* the application data. NAT rewriting those requires an **Application Level Gateway** per protocol — and ALGs cannot work on encrypted payload.
- **Integrity checks.** IPsec and other tunneling protocols checksum headers that NAT rewrites; ESP without NAT-T breaks. Workaround is encapsulation in UDP (NAT-T, RFC 3715/3948) rather than sparse ALG support.
- **Checksums and fragmentation.** TCP/UDP checksums cover a pseudo-header containing the IP addresses, so the NAT must recompute them — and therefore must reassemble fragments to do it correctly.
- **Port exhaustion.** ~64K ports per external address bounds concurrent sessions; a page with many embedded objects or a busy browser can burn mappings fast. Sharing a local port across destinations (address tracking rather than pure port tracking) mitigates it; RFC 4787's mapping behaviors are exactly that knob.
- **DNS source-port randomization.** A NAT that de-randomizes UDP source ports undoes the Kaminsky-era mitigation.

### 6. Traversal, when you cannot forward a port

| Technique | What it needs |
|---|---|
| Port forwarding / DMZ host | administrative access to the NAT |
| UPnP IGD, NAT-PMP, PCP | NAT implements the control protocol |
| STUN | a third-party server; learns your external ip:port, no relay |
| Hole punching (UDP, TCP) | *endpoint-independent mapping*; TCP needs port preservation |
| ICE | orchestrates STUN + punching, falls back to TURN |
| TURN (relay) | a relay server; works everywhere, costs bandwidth/latency |

[RFC 8489 (STUN)](https://www.rfc-editor.org/info/rfc8489/) is the standard way an endpoint asks "what did the outside world see?" — a NAT binding request answered with the reflexive transport address. ICE is the layer that tries the direct paths first and uses a relay only when the NAT pair forces it. Hairpinning is specified in [RFC 5128](https://www.rfc-editor.org/info/rfc5128/).

### 7. IPv4 vs IPv6

NAT is an IPv4-exhaustion workaround; IPv6's design goal is to restore end-to-end addressing, so NAT is not normally used there. Where a carrier hands out only a single `/128` (or a `/64` you must subdivide), practitioners reach for **NAT66** — a ULA prefix masqueraded to one GUA — and RFC 4864 exists to argue for *local network protection* instead of address translation.

## Open Questions

- [unverified] Real-world distribution of mapping/filtering behaviors in 2026 consumer CPE and mobile CGNAT — RFC 4787 is a requirement doc, not a survey. Worth measuring with a STUN-based probe if a P2P project depends on punching success rates.
- Whether hairpinning in any given cloud NAT (AWS NAT GW, GCP Cloud NAT) is supported — vendor docs are the only authority, and behavior has changed across releases.

## Related

- Nothing yet in the repo on networking/NAT-adjacent infrastructure; this is the first file in that area.

## Changelog

- 2026-10-20 — created.
- 2026-10-20 — added an abbreviations table: NAT, NAPT, PAT, SNAT, DNAT, CGNAT, NAT66, NAT-T, ALG, STUN, TURN, ICE, PCP, NAT-PMP, UPnP IGD. Sources: Wikipedia NAT article, RFC 3022 (traditional NAT / NAPT), RFC 4787 (UDP behavioral requirements, BCP 127), plus RFC 8489 / 5128 / 1918 / 2663 references.
