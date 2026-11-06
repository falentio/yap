---
title: KDE Plasma vs Xfce — Where the Two Actually Diverge, and Which Machines Each Fits
category: technology
tags: [linux, desktop-environment, kde-plasma, xfce, wayland, x11, resource-usage, accessibility,
  maintenance, release-cadence, security-process]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://community.kde.org/Schedules/Plasma_6
  - https://blogs.kde.org/2025/11/26/going-all-in-on-a-wayland-future/
  - https://kde.org/announcements/plasma/6/6.8.0/
  - https://kde.org/announcements/megarelease/6/
  - https://kde.org/info/security/
  - https://www.xfce.org/about/tour420/
  - https://wiki.xfce.org/releng/wayland_roadmap
  - https://www.xfce.org/about/news/1734220800/
  - https://www.xfce.org/download/
  - https://www.spurint.org/journal/2026/08/xfwl4s-second-preview-release
  - https://www.phoronix.com/news/Xfce-xfwm4-Merges-Wayland-Code
  - https://www.phoronix.com/news/Plasma-68-Better-Remote-Desktop
  - https://9to5linux.com/kde-desktop-environment-is-getting-a-rust-based-wayland-compositor
  - https://9to5linux.com/kde-receives-over-e1m-from-sovereign-tech-fund-for-software-development
  - https://9to5linux.com/kde-announces-bulletproof-kde-suite-with-three-years-of-support
  - https://www.theregister.com/software/2026/08/18/sponsor-gives-kde-plasma-66-the-lts-treatment/5288531
  - https://kubuntu.org/news/kubuntu-26-04-release-notes/
  - https://xubuntu.org/releasedocs/26.04/release-notes/
  - https://pointieststick.com/2023/09/24/a-bit-on-sponsorship-and-money/
  - https://alexxcons.github.io/blogpost_15.html
  - https://www.xfce.org/getinvolved/
  - https://eylenburg.github.io/de_comparison.htm
  - https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce
  - https://hostingb2b.com/blog/compute/vps-hosting/kde-vs-gnome-vs-xfce-the-ultimate-linux-desktop-comparison/
  - https://vermaden.wordpress.com/2022/07/12/desktop-environments-resource-usage-comparison/
  - https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060
  - https://blogs.kde.org/2026/10/31/this-week-in-plasma-an-avalanche-of-performance-improvements-and-bug-fixes/
  - https://discussion.fedoraproject.org/t/state-of-blind-a11y-in-fedora-gnome-kde-anaconda-apps/146540
  - https://www.reddit.com/r/xfce/comments/1p15xs8/just_spent_the_last_hour_trying_to_use_orca/
  - https://en.wikipedia.org/wiki/Xfce
confidence: high
---

# KDE Plasma vs Xfce — Where the Two Actually Diverge, and Which Machines Each Fits

## TL;DR

- **The folk answer — "Xfce is the light one, Plasma is the heavy one" — is the least reliable axis in 2026.** Measured idle RAM says Xfce is lighter; the same benchmark suite says the two are within 4% on CPU and 0.2% on GPU, and practitioners report the RAM ordering flipping on their own hardware. Nobody chooses between these two on frames.
- **The fork in the road is the display server.** Plasma 6.8 (2026-10-14) ships with no X11 session at all and X11 support ends with 6.7.7 in January 2027 ([kde.org](https://kde.org/announcements/plasma/6/6.8.0/), [schedule](https://community.kde.org/Schedules/Plasma_6)). Xfce 4.20 calls its Wayland support experimental, "advanced users only", and its own compositor — xfwl4 — is at a second preview release with no stable ship date ([Xfce tour](https://www.xfce.org/about/tour420/), [roadmap](https://wiki.xfce.org/releng/wayland_roadmap), [preview 2](https://www.spurint.org/journal/2026/08/xfwl4s-second-preview-release)). One desktop is on the far side of the Wayland migration; the other is mid-river.
- **The second fork is who pays to keep it working.** Plasma out-ships Xfce about six-to-one: a four-month release interval with an LTS series commercially funded to February 2029, staffed by KDE e.V. contractors and a €1.29M grant from the Sovereign Tech Fund ([cadence](https://community.kde.org/Schedules/Plasma_6), [Register](https://www.theregister.com/software/2026/08/18/sponsor-gives-kde-plasma-66-the-lts-treatment/5288531), [9to5Linux](https://9to5linux.com/kde-receives-over-e1m-from-sovereign-tech-fund-for-software-development)). Xfce's majors are ~2 years apart, its biggest current project runs on community donations and one developer, and its last release is 23 months old ([4.20 news](https://www.xfce.org/about/news/1734220800/), [xfwl4 funding](https://alexxcons.github.io/blogpost_15.html)).
- **Read that as risk, not as a verdict.** Plasma is the desktop for a machine with a GPU, a blank disk, an accessibility need, or a remote-desktop requirement. Xfce is the desktop for 2 GB of RAM, a VPS with no /dev/dri, an X11-only workflow, or an operator who values not having to re-learn the shell.

## Context

The question "how does KDE compare to Xfce" is usually asked to pick one, so this file answers as a pick. It compares the two desktops on the axes that change what happens to a machine over three years — not on the axis marketing uses.

Two things needed correcting before the comparison could mean anything:

1. **The resource argument is stale and rarely measured.** Xfce's lightness is a GTK2-era inheritance. The most-cited current tests overlap ranges (400–700 MB vs 300–500 MB is not a decision, [LinuxForDevices](https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce)) and no public benchmark shows a CPU or GPU gap worth the word "performance". Section [The RAM number is smaller than folklore and contested](#the-ram-number-is-smaller-than-folklore-and-contested) carries the arithmetic.
2. **Both desktops are mid-migration, in opposite directions.** Plasma dropped X11 on purpose and documented why ([KDE blog, 2025-11-26](https://blogs.kde.org/2025/11/26/going-all-in-on-a-wayland-future/)); Xfce abandoned the in-place xfwm4 port as "the wrong path forward" and is writing a compositor from scratch in Rust on smithay ([xfwl4 announcement](https://alexxcons.github.io/blogpost_15.html), [Phoronix](https://www.phoronix.com/news/Xfce-xfwm4-Merges-Wayland-Code)). A comparison of shells today that ignores the differential on Wayland readiness is comparing last year's products.

Scope: current releases at 2026-11-06 — Plasma 6.8 and Xfce 4.20, the latter still the stable series since 2024-12-15. Excluded: other desktops, distro politics, and bare window managers.

## Findings

### Side by side

|  | **KDE Plasma** | **Xfce** |
|---|---|---|
| Toolkit | Qt 6 + KDE Frameworks | GTK |
| Compositor | KWin — Wayland by default since Plasma 6 | Xfwm4, X11 only |
| Wayland self-sufficiency | Native; HDR, VRR, fractional scaling, colour profiles, screencopy permissions | None — needs Labwc or Wayfire, and its own compositor is unshipped |
| X11 session in the current release | Gone in 6.8; support ends 2027-01-19 | Default, supported, and the mature path |
| What breaks on Wayland today | Third-party screenshot/screencast tools, per KDE's own FAQ | Keyboard and mouse settings, brightness/suspend keys, workspaces, systray icons, rectangle and window screenshots, the screensaver |
| Idle RAM, 2025 bench (Fedora 42, same host) | 2,670 MiB | 1,360 MiB (+96% for Plasma) |
| Idle RAM, vendor-guide range | 400–700 MB | 300–500 MB |
| Idle RAM, 2022 FreeBSD top() | 2,843 MB | 1,548 MB |
| CPU/GPU in the same 2025 suite | Geekbench SC 2,695 · MC 11,450 · Heaven 846 | SC 2,700 · MC 11,366 · Heaven 848 |
| Feature-release cadence | Every 4 months, ~3 a year | Majors ~2 years apart (4.16 → 4.18 → 4.20) |
| Long-term support of its own | 6.6 LTS, fixes through Feb 2029, commercially sponsored | None; you get whatever the distro gives |
| Paid engineering | KDE e.V. employees and contractors, €1.29M Sovereign Tech Fund for 2026–27 | One core developer funded from community donations (xfwl4) |
| Security process | Public advisory feed, published policy, four PGP contacts | No advisory feed found; CVEs land in distro trackers |
| Accessibility built in | Dwell clicker (6.8), on-screen keyboard (6.6); KDE claims parity with its X11 session | Orca reads window titles and buttons; a WCAG professional could not get window or page contents read |
| Configurability | Every element is a widget with settings, global menu toggle, scheduled theme switch | Four-sided panels, themes, Night Light, hidden xfconf keys |
| HiDPI / display | Fractional scaling, HDR, VRR, colour profiles | Fractional scaling only |
| Remote desktop | RDP unattended mode, client-matched resize, clipboard, libei (6.8) | Compositor's problem; Plasma's is a KDE project, Xfce's is not |
| Native app suite | Dolphin, Konsole, Kate, Kdenlive, Spectacle, Discover | Thunar, Mousepad, Ristretto, Parole; no software centre |
| Active distributions shipping it (12/2025) | 107 | 123 |
| Usage share (Hardware for Linux Trends, 11/2025) | 41.4% | 5.1% |
| Install cost | In every major repo; co-installable with Xfce | Same |

Sources per row: compositor, toolkit, licence and first release are the [eylenburg comparison table](https://eylenburg.github.io/de_comparison.htm); the X11 removal is [kde.org's 6.8 announcement](https://kde.org/announcements/plasma/6/6.8.0/) and the end date is the [release schedule](https://community.kde.org/Schedules/Plasma_6); Wayland feature rows are [eylenburg](https://eylenburg.github.io/de_comparison.htm) (HDR, VRR, colour profiles, fractional scaling, screencopy permissions) and KDE's [Wayland FAQ](https://blogs.kde.org/2025/11/26/going-all-in-on-a-wayland-future/); the breakage list on Xfce is its own [4.20 tour](https://www.xfce.org/about/tour420/); all RAM and benchmark numbers are [The Linux Experiment's Fedora 42 run as reposted on the EndeavourOS forum](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060), the ranges are [LinuxForDevices](https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce) and [HostingB2B](https://hostingb2b.com/blog/compute/vps-hosting/kde-vs-gnome-vs-xfce-the-ultimate-linux-desktop-comparison/), and the 2022 numbers are [vermaden](https://vermaden.wordpress.com/2022/07/12/desktop-environments-resource-usage-comparison/); release dates are the [Xfce news feed](https://www.xfce.org/about/news/1734220800/) and [Wikipedia](https://en.wikipedia.org/wiki/Xfce); LTS terms are the [schedule](https://community.kde.org/Schedules/Plasma_6) and [The Register](https://www.theregister.com/software/2026/08/18/sponsor-gives-kde-plasma-66-the-lts-treatment/5288531); funding is [pointieststick.com](https://pointieststick.com/2023/09/24/a-bit-on-sponsorship-and-money/) and [9to5Linux](https://9to5linux.com/kde-receives-over-e1m-from-sovereign-tech-fund-for-software-development) for KDE, the [xfwl4 post](https://alexxcons.github.io/blogpost_15.html) and [Get Involved](https://www.xfce.org/getinvolved/) for Xfce; the advisory feed is [kde.org/info/security](https://kde.org/info/security/); accessibility is [Plasma 6.8](https://kde.org/announcements/plasma/6/6.8.0/), [Kubuntu 26.04's notes](https://kubuntu.org/news/kubuntu-26-04-release-notes/) and an [Orca user report](https://www.reddit.com/r/xfce/comments/1p15xs8/just_spent_the_last_hour_trying_to_use_orca/); remote desktop is [Phoronix](https://www.phoronix.com/news/Plasma-68-Better-Remote-Desktop); app suites are [LinuxForDevices](https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce); distro count and usage share are [eylenburg](https://eylenburg.github.io/de_comparison.htm).

### The Wayland split is the real fork in the road

KDE's position is deliberate and public. The November 2025 post that announced the X11 session's end argues the split had "held back" development and that keeping two window systems alive forced the whole desktop to the "lowest common denominator" ([KDE blog](https://blogs.kde.org/2025/11/26/going-all-in-on-a-wayland-future/)). The schedule put a date on it: 6.7.7, 2027-01-19, "marks the termination of support for the X11 window manager" ([schedule](https://community.kde.org/Schedules/Plasma_6)). X11 applications keep running through XWayland; the Plasma X11 *login session* is what goes.

KDE also answered the awkward questions in the same post rather than after release: X11 forwarding survives via Xwayland, old cards fall back to Nouveau, accessibility is "generally on par" with the X11 session, and third-party screenshot and screencast tools are the known exception ([KDE blog](https://blogs.kde.org/2025/11/26/going-all-in-on-a-wayland-future/)). Plasma 6.8 shipped remote-desktop work timed to the same release — unattended-mode resize, bidirectional clipboard, libei input — explicitly to close "the X11 vs. Wayland gap" ([Phoronix](https://www.phoronix.com/news/Plasma-68-Better-Remote-Desktop)).

Xfce's position is the mirror image: it ships an experimental Wayland session since 4.20 and says so in bold — "recommended for advanced users only, as you may encounter bugs and experience incomplete functionality" ([Xfce tour](https://www.xfce.org/about/tour420/)). The tour's own list of what does not work is the useful part: workspace support is missing, systray icons disappear, keyboard and mouse settings are unreachable because the compositor owns them, brightness and suspend keys stop working, and rectangle or active-window screenshots are unsupported. Four components — xfwm4, xfdashboard, xfce4-screensaver, xfce4-xkb-plugin — do not run at all ([Xfce tour](https://www.xfce.org/about/tour420/)).

Xfce's plan is xfwl4: a scratch Wayland compositor in Rust on smithay that will sit beside xfwm4 rather than replace it, keeping xfwm4 X11-only ([roadmap](https://wiki.xfce.org/releng/wayland_roadmap), [announcement](https://alexxcons.github.io/blogpost_15.html)). It is at 4.21.1, a second preview, and the roadmap still calls it "under heavy development, somewhat usable but not stable yet" ([preview](https://www.spurint.org/journal/2026/08/xfwl4s-second-preview-release), [roadmap](https://wiki.xfce.org/releng/wayland_roadmap)). The roadmap explicitly declines to say which release completes the transition, "or if such a transition will happen at all".

Practical consequence: on 2026-11-06, if you need a Wayland session you land on KWin, not Xfce. If you need X11 to keep working, Xfce is the only one of the two that will still sign you in on an X11 session by default.

### The RAM number is smaller than folklore and contested

The strongest 2025 measurement is a same-host Fedora 42 run across seven desktops: XFCE 1,360 MiB, KDE Plasma 2,670 MiB, a 96% gap — and CPU scores 2,700 vs 2,695 single-core and 11,366 vs 11,450 multi-core, with Unigine Heaven at 848 and 846 ([forum repost](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060)). Read the CPU and GPU columns together with the RAM column: single-digit points across a whole desktop is noise, so *frames per second is not a reason to pick either one*.

The RAM column itself is where the numbers stop agreeing:

- **Two vendor-style guides put the ranges almost on top of each other** — 400–700 MB for Plasma against 300–500 MB for Xfce, described as "only slightly" heavier ([LinuxForDevices](https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce)) and 500–800 against 350–500 MB ([HostingB2B](https://hostingb2b.com/blog/compute/vps-hosting/kde-vs-gnome-vs-xfce-the-ultimate-linux-desktop-comparison/)).
- **A controlled 2022 FreeBSD run** using four measurement tools found Plasma at roughly twice Xfce (2,843 MB vs 1,548 MB by top) on a 1-CPU, 8 GB VM ([vermaden](https://vermaden.wordpress.com/2022/07/12/desktop-environments-resource-usage-comparison/)).
- **EndeavourOS maintainers disputed the 2025 run on the forum thread itself** — one said his own Plasma-versus-Xfce tests have Plasma "slightly less memory," and that Xfce's usage rose with the GTK3 move; a second observed Plasma consumes more when RAM is plentiful and runs in 400–600 MB on a 2 GB machine ([thread](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060)).

Two caveats make the disagreement legible. Fedora spins are not equally stocked, so the KDE spin starts more services ([thread](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060)). And the distributable number is not the idle number — the same maintainers point out that Plasma's default effects and its caching behaviour are what hurt, and both are switchable ([thread](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060), [LinuxForDevices](https://www.linuxfordevices.com/tutorials/linux/kde-vs-xfce)).

So the honest form of the claim: **Xfce's floor is lower and its variance is smaller; Plasma's ceiling is higher and its floor depends on the config.** Below roughly 2 GB, or on a machine with no GPU at all, that floor is the whole decision — Plasma's compositor falls back to software rendering and dragging a window can hold a full core ([HostingB2B](https://hostingb2b.com/blog/compute/vps-hosting/kde-vs-gnome-vs-xfce-the-ultimate-linux-desktop-comparison/)). From 4 GB up with any GPU, the two are close enough that RAM should not decide it.

### Who has to keep it working

Plasma ships a feature release every four months, two betas and six bugfix updates per cycle, on a published calendar with a release team ([schedule](https://community.kde.org/Schedules/Plasma_6)). Xfce's last three majors landed 2020-12-22, 2022-12-15 and 2024-12-15 — two years apart, each announced as having taken "almost two years of work" ([Wikipedia](https://en.wikipedia.org/wiki/Xfce), [release post](https://www.xfce.org/about/news/1734220800/)). As of 2026-11-06 Xfce 4.20 is 23 months old and 4.22 has not shipped; the download page still calls 4.20 "the most recent version" ([xfce.org/download](https://www.xfce.org/download/)).

That cadence difference is a stability difference in both directions. A faster train means the shell changes under you several times a year — Plasma 6.8 introduced regressions in enough volume that the team's own weekly post leads with "most of the regressions reported in Plasma 6.8 have been resolved now" ([This Week in Plasma](https://blogs.kde.org/2026/10/31/this-week-in-plasma-an-avalanche-of-performance-improvements-and-bug-fixes/)) — and Kubuntu 26.04 warns upgraders about broken panel layouts and themes across the 6.6 jump ([release notes](https://kubuntu.org/news/kubuntu-26-04-release-notes/)). A slower train means the shell is boringly the same for two years, and it also means Wayland arrives late.

Where Xfce has no answer is support contracts. Plasma 6.6 is an LTS with fixes through roughly February 2029, funded through a commercial partnership with Kubuntu Focus and Techpaladin Software ([schedule](https://community.kde.org/Schedules/Plasma_6), [Register](https://www.theregister.com/software/2026/08/18/sponsor-gives-kde-plasma-66-the-lts-treatment/5288531)). Xfce has no LTS of its own; its support horizon is whatever Xubuntu, MX Linux or Debian ships, which for Xubuntu 26.04 is three years to April 2029 — and Xubuntu is the flavour whose desktop, like Kubuntu's, is a three-year proposition while the Ubuntu base underneath runs to 2031 ([Xubuntu notes](https://xubuntu.org/releasedocs/26.04/release-notes/), [Register](https://www.theregister.com/software/2026/08/18/sponsor-gives-kde-plasma-66-the-lts-treatment/5288531)).

The funding asymmetry tracks that. KDE e.V. runs employees and contractors on core software and is spending down reserves to do it ([pointieststick.com](https://pointieststick.com/2023/09/24/a-bit-on-sponsorship-and-money/)); the Sovereign Tech Fund, a German federal programme, added €1,285,200 across 2026 and 2027 ([9to5Linux](https://9to5linux.com/kde-receives-over-e1m-from-sovereign-tech-fund-for-software-development)). Xfce's comparable story is one core developer paid from community donations to write xfwl4, announced by the team itself as using "a significant portion of the project's donated funds" ([announcement](https://alexxcons.github.io/blogpost_15.html), [Get Involved](https://www.xfce.org/getinvolved/)).

### Security surface

KDE runs a security page with a reporting address, a published policy, four named PGP keys, and an advisory feed — and states plainly that there is no bug bounty ([kde.org/info/security](https://kde.org/info/security/)). The 2026 advisories are everyday desktop-shaped bugs: a Dolphin sandbox escape from FileManager1 argument handling, remote code execution through a Kdenlive project file, malformed-packet denial of service in KDE Connect that can flood D-Bus and freeze the shell, and KAuth mount-helper issues in Smb4K ([advisories](https://kde.org/info/security/)).

Xfce is harder to audit and mostly benign by construction. Tried against OpenCVE's vendor index, the entire Xfce record is five CVEs, the newest from 2022 (an argument-injection flaw in `xfce4-mime-helper`, CVSS 9.8) ([OpenCVE](https://app.opencve.io/cve/?product=xfce&vendor=xfce)). "Five CVEs in 29 years" is not five-times-safer firmware: it reflects a smaller attack surface (fewer daemons, no KRunner-style extensible launcher, no package-install surface) *and* a thinner disclosure habit — no Xfce advisory page surfaced in this research, so fixes ship as changelog lines inside distro packages.

### Where Xfce genuinely wins

- **Machines with no GPU.** A VPS session, a 1–2 GB container, a 15-year-old laptop: software rendering turns Plasma's compositor cost into real latency, and Xfce's own compositor is optional ([HostingB2B](https://hostingb2b.com/blog/compute/vps-hosting/kde-vs-gnome-vs-xfce-the-ultimate-linux-desktop-comparison/)).
- **X11 holdouts with a horizon.** Plasma's X11 session dies in January 2027; Xfce's roadmap commits to keeping X11 "for the foreseeable future" with a separate compositor for Wayland precisely so the two never collide ([schedule](https://community.kde.org/Schedules/Plasma_6), [roadmap](https://wiki.xfce.org/releng/wayland_roadmap)).
- **Drift-free workstations.** Two-year majors mean a shell that does not re-arrange itself; useful on a kiosk, a lab, or a remote box you visit twice a year.
- **Distro breadth.** Xfce is the default of 123 active distributions against Plasma's 107, so it is the desktop you can find on the distro you already run ([eylenburg](https://eylenburg.github.io/de_comparison.htm)).

### Where Plasma genuinely wins

- **Wayland features that are not replannable onto X11** — HDR, VRR, per-app fractional scaling, colour profiles, screencopy permission prompts ([eylenburg](https://eylenburg.github.io/de_comparison.htm)).
- **Remote desktop.** RDP with client-matched resize and unattended mode is a KDE deliverable, and Plasma 6.8 hardened it; on Xfce it is whatever Labwc or Wayfire happen to do ([Phoronix](https://www.phoronix.com/news/Plasma-68-Better-Remote-Desktop)).
- **Accessibility.** Plasma shipped a dwell clicker in 6.8 and an on-screen keyboard in 6.6, and KDE claims parity with its own X11 session ([6.8](https://kde.org/announcements/plasma/6/6.8.0/), [Kubuntu notes](https://kubuntu.org/news/kubuntu-26-04-release-notes/)). Xfce's own components are fine for a keyboard-only user, but an Orca user in 2026 could tab to buttons and never hear window or page contents, across an hour of trying ([report](https://www.reddit.com/r/xfce/comments/1p15xs8/just_spent_the_last_hour_trying_to_use_orca/)).

### Pick by what fails first

| Situation | Pick | Why |
|---|---|---|
| 2 GB RAM, or a VPS with no /dev/dri | **Xfce** | The compositor is the cost, and it is optional here |
| Wayland, HiDPI, HDR, VRR | **Plasma** | Shipped features, not roadmap items |
| Must stay on X11 past January 2027 | **Xfce** | Plasma's X11 session is retired; Xfce's is the default |
| Screen-reader user | **Plasma** | Dwell clicker, on-screen keyboard, Orca-shaped reputation |
| Headless box driven over RDP | **Plasma** | Unattended mode and resize in 6.8 |
| Kiosk or lab reimaged twice a year | **Xfce** | Two-year majors, no shell churn |
| Answered on a tidy laptop with 16 GB | **Either** | RAM is not the axis; pick the panel you want to live in |
| No appetite for a mid-migration compositor | **Plasma now, or Xfce 4.22 later** | Xfce's Wayland endgame is unfinished |

### The negative findings

- **Xfce 4.22 has not shipped.** 4.20 remains stable 23 months on ([download page](https://www.xfce.org/download/)).
- **xfwl4 is not a daily driver.** Second preview, explicitly unstable, no completion release named ([roadmap](https://wiki.xfce.org/releng/wayland_roadmap)).
- **The Xfce team cannot promise the Wayland transition at all** — "we cannot tell yet when/if it will be done, so please don't hold your breath" regarding xfwm4 ([tour](https://www.xfce.org/about/tour420/)).
- **There is no Xfce equivalent of kde.org/info/security**: no advisory feed, no policy page, no bounties ([kde.org security page](https://kde.org/info/security/) as the contrast).
- **CPU and GPU differences between the two are too small to arbitrate** — a 4-point single-core spread and 2 fps on Heaven ([thread](https://forum.endeavouros.com/t/linux-des-resource-usage-compared/70060)).

## Open Questions

- Does Plasma's RAM advantage-in-reverse hold on an Arch or Alpine floor with both desktops at stock? No same-host run with matched package sets surfaced.
- Will xfwl4 land in 4.22, and does its arrival change the accessibility and remote-desktop rows? The preview notes list neither.
- Is "five CVEs" for Xfce a real record or an artefact? A probe: count Xfce fixes that shipped in distro stable-security channels without a CVE.
- Does Xubuntu's three-year desktop horizon outlast Xfce 4.20's usefulness, or does the 4.22 branch cut it short for LTS users?

## Related

- [Windows-Like Linux Desktops](./windows-like-linux-desktops.md) — the same two desktops graded on shell fidelity to Windows rather than on cost, where Plasma is the maximum-fidelity answer and Xfce the XP-era-looking one.
- [Debian-Derived Distros With KDE Plasma](./debian-based-kde-distributions.md) — where Plasma comes from on Debian and which branch each derivative pins, if the Plasma side is settled.
- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — the no-GPU, no-display-connector case that pushes this comparison toward Xfce by force.
- [Browser-Viewable VNC on gVisor](./vnc-server-on-gvisor-with-browser-client.md) — why a remotely served desktop is an X11 proposition today, which is Xfce's session.

## Changelog

- 2026-11-06 — created. Researched via TinyFish search and fetch; all measurements are second-hand and cited, with the conflicting runs kept rather than averaged.
