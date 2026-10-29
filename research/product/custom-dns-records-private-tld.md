---
title: Custom DNS Records for a Private TLD — Resolving *.falentio to a Private IP
category: product
tags: [dns, custom-records, wildcard, split-horizon, nextdns, control-d, adguard, pi-hole, technitium, internal-tld]
status: complete
created: 2026-10-25
updated: 2026-10-25
sources:
  - https://help.nextdns.io/t/x2hn9qk/api-will-rewrites-be-modifiable-from-the-api
  - https://help.nextdns.io/t/m1hgw7b/dns-rewrites-not-working
  - https://nextdns.github.io/api/
  - https://docs.controld.com/docs/custom-rules
  - https://adguard-dns.io/kb/general/dns-filtering-syntax/
  - https://adguard-dns.io/kb/private-dns/setting-up-filtering/user-rules/
  - https://adguard-dns.io/en/blog/private-adguard-dns-v2-5.html
  - https://adguard-dns.io/en/blog/adguard-dns-2-0.html
  - https://adguard-dns.io/en/versions/dns/release.html
  - https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration
  - https://github.com/AdguardTeam/AdGuardHome/issues/1547
  - https://docs.pi-hole.net/ftldns/configfile/
  - https://discourse.pi-hole.net/t/support-wildcards-in-local-dns-records/32098
  - https://github.com/pi-hole/pi-hole/issues/5925
  - https://discourse.pi-hole.net/t/how-to-keep-separate-custom-dns-records-on-v6-via-ansible/76160
  - https://technitium.com/dns/help.html
  - https://technitium.com/dns/
  - https://developers.cloudflare.com/dns/internal-dns/
  - https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/local-domains/
  - https://developers.cloudflare.com/cloudflare-one/traffic-controls/resolver-policies/
  - https://en.wikipedia.org/wiki/.internal
  - https://www.icann.org/en/public-comment/proceeding/proposed-top-level-domain-string-for-private-use-24-01-2024
  - https://www.rfc-editor.org/info/rfc8375/
confidence: high
---

# Custom DNS Records for a Private TLD — Resolving *.falentio to a Private IP

## TL;DR

- **The feature exists in every serious resolver; the names differ.** NextDNS calls it Rewrites, Control D calls it Custom Rules, AdGuard DNS calls it User rules, AdGuard Home calls it DNS rewrites, Pi-hole calls it local DNS records plus custom dnsmasq lines.
- **NextDNS already does exactly this on the free plan**: a rewrite sets or overrides the DNS response for any domain, applies to subdomains as well, and accepts local IP addresses as answers ([NextDNS forum quoting the feature](https://help.nextdns.io/t/x2hn9qk/api-will-rewrites-be-modifiable-from-the-api)). One entry for the apex covers everything under it.
- **Do not invent a bare TLD like *.falentio.** ICANN reserved `.internal` for private use on 2024-07-29 and it is not delegable, so `falentio.internal` is collision-proof ([Wikipedia .internal](https://en.wikipedia.org/wiki/.internal), [ICANN proceeding](https://www.icann.org/en/public-comment/proceeding/proposed-top-level-domain-string-for-private-use-24-01-2024)); `home.arpa` is the RFC 8375 home-network alternative ([RFC 8375](https://www.rfc-editor.org/info/rfc8375/)).
- **Self-hosted is the strongest option**: AdGuard Home takes `*.falentio.internal` rewrites, Pi-hole takes `address=/falentio.internal/192.168.1.10` through `misc.dnsmasq_lines`, and Technitium hosts a real zone with wildcard records ([AdGuard Home wiki](https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration), [Pi-hole config reference](https://docs.pi-hole.net/ftldns/configfile/), [Technitium help](https://technitium.com/dns/help.html)).
- **Hosted free tiers that can hold the record**: NextDNS (free, unlimited rewrites), AdGuard DNS Starter (free, but 100 custom rules and 5 devices), Control D (paid only — free resolvers have no rules), Cloudflare (record store is Enterprise-only; the free path forwards the domain to your own resolver) ([AdGuard v2.5](https://adguard-dns.io/en/blog/private-adguard-dns-v2-5.html), [Control D docs](https://docs.controld.com/docs/custom-rules), [Cloudflare Internal DNS](https://developers.cloudflare.com/dns/internal-dns/)).

## Context

Question asked 2026-10-25: is there a feature that resolves a private TLD such as `*.falentio` to a private IP, and which service offers it? This is split-horizon DNS for a homelab: the same name should resolve to `192.168.x.y` (or a ULA IPv6) on your own network and stay out of the public DNS entirely.

Features and limits below were read from vendor documentation on 2026-10-25 through TinyFish fetches. Where a vendor's own page does not document a behaviour, the claim is marked **[unverified]**.

## Findings

### 1. The feature under each vendor's name

| | NextDNS | Control D | AdGuard DNS (hosted) | AdGuard Home | Pi-hole v6 | Technitium | Cloudflare Gateway |
|---|---|---|---|---|---|---|---|
| Feature name | Rewrites | Custom Rules | User rules with the dnsrewrite modifier | DNS rewrites | Local DNS records plus custom dnsmasq lines | Authoritative zone records | Internal DNS (Enterprise) or Local Domain Fallback |
| Where configured | Profile settings, or `POST /profiles/{id}/rewrites` on the API | Dashboard, per profile, Custom Rules section | Dashboard, per device, User rules | Web UI, Filters then DNS rewrites | `misc.dnsmasq_lines` in pihole.toml, or `/etc/dnsmasq.d/` with `misc.etc_dnsmasq_d` enabled | Web UI, zones and records | Cloudflare dashboard under Zero Trust |
| Answer types | IP or hostname (local IPs explicitly supported) | IPv4, IPv6, or CNAME via Redirect, or a proxy location | A, AAAA, CNAME, or response codes via dnsrewrite | IP address, CNAME, or the A and AAAA special values | Whatever dnsmasq answers, e.g. `address=/domain/IP` | Every record type the zone supports, including wildcard | Internal zone records |
| Subdomains covered | Yes — rewrites apply to subdomains as well | Yes — `domain.com` covers subdomains, `*.domain.com` matches them explicitly | Yes — `\|\|*.name^` pattern matches subdomains | Yes — `*.name` wildcard supported since Dec 2019 | Yes, but a dnsmasq `address=` line matches the domain and all subdomains in one shot | Yes — wildcard records in the zone | Yes |
| Private IP as answer | Yes, documented | Yes, documented for private domains | Yes, dnsrewrite accepts any IP | Yes | Yes | Yes | Yes, in Internal DNS zones |
| Plan needed | Free tier includes all features | Paid — the free offering is stateless public resolvers | Free Starter, capped at 100 rules | Free, self-hosted | Free, self-hosted | Free, self-hosted | Enterprise for Internal DNS; free client-side fallback otherwise |
| Rule cap | Not documented | 10,000 custom rules per profile | 100 rules on Starter, 1,000 on Personal | No published cap | No published cap | No published cap | Zone records per plan limits |
| Works off-network | Yes, via the same resolver | Yes | Yes | Only if the Home instance is reachable, e.g. over WireGuard or Tailscale | Same as AdGuard Home | Same | Yes for Internal DNS; fallback is client-side |

Sources per column: [NextDNS](https://help.nextdns.io/t/x2hn9qk/api-will-rewrites-be-modifiable-from-the-api), [Control D](https://docs.controld.com/docs/custom-rules), [AdGuard DNS syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/) and [user rules](https://adguard-dns.io/kb/private-dns/setting-up-filtering/user-rules/) and [v2.5 rule caps](https://adguard-dns.io/en/blog/private-adguard-dns-v2-5.html), [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration), [Pi-hole](https://docs.pi-hole.net/ftldns/configfile/) and [Pi-hole forum](https://discourse.pi-hole.net/t/support-wildcards-in-local-dns-records/32098), [Technitium](https://technitium.com/dns/help.html), [Cloudflare Internal DNS](https://developers.cloudflare.com/dns/internal-dns/) and [Local Domain Fallback](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/local-domains/).

Cloudflare detail: Local Domain Fallback only applies to devices running the Cloudflare One Client, and those queries bypass Gateway policies and logging; routing them to a resolver from Cloudflare's side is documented for Enterprise ([Local Domain Fallback](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/local-domains/), [Resolver policies](https://developers.cloudflare.com/cloudflare-one/traffic-controls/resolver-policies/)).

### 2. Pick the right name for the private zone

| Option | Status | Why use it |
|---|---|---|
| `name.internal` | Reserved by ICANN for private use since 2024-07-29, not delegable as a TLD; IETF draft exists but no RFC yet | Collision-proof, the modern default for internal names |
| `name.home.arpa` | IETF Standards Track, RFC 8375, designated for non-unique use in residential home networks | The standards answer for home networks |
| A subdomain of a domain you own, e.g. `lan.example.com` | Real, delegable, resolvable publicly if you publish records | Works with public DNS, but leaks the naming scheme and can be resolved by anyone |
| A bare invented TLD such as `falentio` | Unknown to ICANN, may be delegated later, no root server answers it | Works only because your resolver answers, and any client that ignores your resolver gets NXDOMAIN or an ISP error page |

Sources: [.internal](https://en.wikipedia.org/wiki/.internal), [ICANN proceeding](https://www.icann.org/en/public-comment/proceeding/proposed-top-level-domain-string-for-private-use-24-01-2024), [RFC 8375](https://www.rfc-editor.org/info/rfc8375/).

### 3. "Wildcard" is two different things

- **Resolver-level wildcard** (NextDNS subdomain coverage, AdGuard `*.name`, Technitium zone wildcard, dnsmasq `address=/name/IP`): every query ending in the name is answered with your IP. This is what a homelab wants.
- **RFC 1034/4592 wildcard semantics**: a wildcard only matches names for which no more specific record exists, so an explicit `mail.name` record wins over `*.name`. Pi-hole's team wrote this out when declining wildcard support in the UI, and noted that dnsmasq's `address=/name/IP` does not distinguish the domain from its subdomains — both resolve to the same IP ([Pi-hole forum](https://discourse.pi-hole.net/t/support-wildcards-in-local-dns-records/32098)).

Practical effect: with dnsmasq you cannot exempt one subdomain inside the wildcard while keeping the rest; with AdGuard Home and Technitium you can, by adding a more specific record.

### 4. Recipes

Assume the target IP is `192.168.1.10` and the zone is `falentio.internal`.

**NextDNS (free)** — Settings, Rewrites, add `falentio.internal` with value `192.168.1.10`. Subdomains are covered by the same entry. The same list is readable and writable over the API at `GET/POST/DELETE /profiles/{id}/rewrites` ([forum](https://help.nextdns.io/t/x2hn9qk/api-will-rewrites-be-modifiable-from-the-api), [API docs](https://nextdns.github.io/api/)). Whether the UI accepts a literal `*.` prefix is **[unverified]** — the documented behaviour covers subdomains without it.

**Control D (paid)** — Profile, Edit, Custom Rules, add `*.falentio.internal`, action Redirect, choose IP or Hostname, then enter the IPv4, IPv6, or CNAME value. Vendor example is a private domain that does not exist in public DNS ([docs](https://docs.controld.com/docs/custom-rules)).

**AdGuard DNS, hosted (free Starter)** — Device, User rules, add `||*.falentio.internal^$dnsrewrite=192.168.1.10`. The dnsrewrite modifier works in private-zone custom rules; in AdGuard Home it works in all rules ([syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/), [user rules](https://adguard-dns.io/kb/private-dns/setting-up-filtering/user-rules/)).

**AdGuard Home (self-hosted)** — Filters, DNS rewrites, add `*.falentio.internal` to `192.168.1.10`. The config file stores rewrites as a list where the domain may be a wildcard and the answer is an IP, CNAME, or A/AAAA ([wiki](https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration), [wildcard history](https://github.com/AdguardTeam/AdGuardHome/issues/1547)).

**Pi-hole v6 (self-hosted)** — Settings, All Settings, Miscellaneous, `misc.dnsmasq_lines`, add `address=/falentio.internal/192.168.1.10`. Files under `/etc/dnsmasq.d/` load again only when `misc.etc_dnsmasq_d` is enabled; both settings are in the FTL config reference ([config](https://docs.pi-hole.net/ftldns/configfile/), [issue #5925](https://github.com/pi-hole/pi-hole/issues/5925), [forum](https://discourse.pi-hole.net/t/how-to-keep-separate-custom-dns-records-on-v6-via-ansible/76160)).

**Technitium (self-hosted)** — Zones, add a primary zone `falentio.internal`, then an A record with the name `*` and the value `192.168.1.10` ([help](https://technitium.com/dns/help.html)).

### 5. Gotchas that break the setup after it looks correct

- **Browser DNS-over-HTTPS bypasses every resolver above.** Chrome and Firefox can resolve names over their own DoH endpoint, so `falentio.internal` never reaches your rule. Turn browser DoH off or point it at your own resolver ([AdGuard Home upstream wildcard semantics are also per-resolver](https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration)).
- **Android Private DNS and iOS encrypted-DNS profiles do the same** on mobile; the rule only applies to clients that actually query the resolver holding it.
- **NextDNS rewrites can be defeated by CNAME flattening.** In a user report, rewritten names kept returning public IPs until CNAME flattening was disabled, and router-forwarded queries behaved differently from queries sent straight to NextDNS ([NextDNS forum](https://help.nextdns.io/t/m1hgw7b/dns-rewrites-not-working)). The thread is user-reported, not vendor-documented.
- **A private IP answer is only useful where that IP routes.** Hotel Wi-Fi or mobile data will happily receive `192.168.1.10` and then fail to connect; pair the private zone with a VPN into the same network.
- **Do not publish the private zone at a real registrar** unless you intend it: a public record for an internal name is readable by everyone ([RFC 8375](https://www.rfc-editor.org/info/rfc8375/) describes why special-use names exist for this reason).

## Open Questions

- Whether NextDNS accepts a literal `*.falentio.internal` in the Rewrites name field, or only implicit subdomain coverage.
- Whether AdGuard DNS Starter's 100-rule cap counts only user rules or user rules plus imported blocklists, and whether `dnsrewrite` rules share that cap.
- Whether Cloudflare's resolver policies are Enterprise-only on the DNS path or available to Zero Trust free accounts; the docs scoped custom resolvers to Enterprise ([Resolver policies](https://developers.cloudflare.com/cloudflare-one/traffic-controls/resolver-policies/)).

## Related

- [NextDNS Free Tier Alternatives](./nextdns-free-tier-alternatives.md) — which free resolver to point the clients at once the private records exist
- Index: [Product](./README.md)

## Changelog

- 2026-10-25 — created. Feature names, caps, and syntax read from vendor documentation the same day through TinyFish.
