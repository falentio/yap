---
title: Debian-Derived Distros With KDE Plasma — Which Ones Recommend Themselves
category: technology
tags: [linux, debian, kde, plasma, distro, desktop]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://wiki.debian.org/KDE
  - https://packages.debian.org/sid/task-kde-desktop
  - https://www.debian.org/security/faq
  - https://wiki.debian.org/LTS
  - https://community.kde.org/Distributions
  - https://kde.org/distributions/
  - https://distrowatch.com/table.php?distribution=mx
  - https://9to5linux.com/mx-linux-25-infinity-enters-public-beta-testing-based-on-debian-13-trixie
  - https://www.netrunner.com/
  - https://www.netrunner.com/download/
  - https://refreshos.org/
  - https://distrowatch.com/table.php?distribution=netrunner
  - https://distrowatch.com/table.php?distribution=refreshos
  - https://distrowatch.com/table.php?distribution=neptune
  - https://distrowatch.com/table.php?distribution=q4os
  - https://9to5linux.com/q4os-6-1-distro-is-out-based-on-debian-13-with-kde-plasma-and-trinity-desktops
  - https://www.q4os.org/
  - https://spirallinux.github.io/
  - https://distrowatch.com/table.php?distribution=spiral
  - https://www.tuxedocomputers.com/en/A-new-foundation-for-TUXEDO-OS-Switching-to-Debian.tuxedo
  - https://distrowatch.com/table.php?distribution=tuxedo
  - https://neon.kde.org/faq
confidence: high
---

# Debian-Derived Distros With KDE Plasma — Which Ones Recommend Themselves

The family here is not Ubuntu derivatives — Kubuntu and KDE neon are, and both are covered
alongside as the comparison baseline. The family is **Debian proper and the distros built
directly on a Debian branch**, where the only variable that matters is *which branch*.

## TL;DR

- **The branch is the distro.** Every candidate below is the same package set as Debian at a
  different pin: `stable` → backports → `testing` → `unstable`. The desktop is identical
  because it *is* Debian's own Plasma packages in all but the Roll-Your-Own-Flavour cases.
- **Debian itself ships Plasma 6.3 in Trixie and takes the KDE task at install time.** There is
  no desktop gap to close — the "distro" mostly buys pre-configuration and branding
  ([wiki.debian.org/KDE](https://wiki.debian.org/KDE),
  [task-kde-desktop](https://packages.debian.org/sid/task-kde-desktop)).
- **Plasma version parity.** Debian 13 "Trixie" carries Plasma 6.3, and every `stable`-pinned
  candidate inherits exactly that. "Latest KDE" is not a reason to pick any of them
  ([wiki.debian.org/KDE](https://wiki.debian.org/KDE)).
- **Two are worth a real recommendation:** Q4OS (stable, supported the longest, Plasma as a
  stock upstream build) and MX Linux KDE (polished, antiX-backed, Debian-stable pinned). Tuxedo
  OS is the one to watch — it just announced the move to `testing`.

## Context

Asked for: a Linux distro, Debian-based, using KDE. The KDE part is the least interesting
decision, because KDE is a supported desktop in Debian itself; the decision that actually shapes
the system is how far ahead of or behind Debian `stable` a distro pins you, and who is
accountable when it breaks.

Checked against the repo first — no prior coverage.

## Findings

### The branch is the decision

Debian publishes the KDE desktop as a first-class option: the wiki lists four installation
flavours (`kde-full`, `kde-standard`, `KDE Plasma Desktop`, KDE Plasma Task)
([wiki.debian.org/KDE](https://wiki.debian.org/KDE)), and `task-kde-desktop` pulls the desktop
with `sddm`, `kde-standard` and `libreoffice-plasma` recommended
([packages.debian.org](https://packages.debian.org/sid/task-kde-desktop)). Debian 13 "Trixie"
ships KDE Frameworks 6.13, Plasma 6.3 and KDE Gear 25.04.

What changes between branches ([Debian security FAQ](https://www.debian.org/security/faq)):

| Branch | Security handling | Outcome |
|---|---|---|
| `stable` | Security Team, priority over everything else | Fixes land fast, versions frozen |
| `testing` | Inherits `unstable` work, minimum two-day migration delay, stalls on transitions | Usually fine, occasionally late |
| `unstable` | Package maintainers, not the Security Team | Newest KDE, thinnest support |

Stable releases also get LTS to at least five years, run by volunteers and companies rather than
the Security or Release teams ([wiki.debian.org/LTS](https://wiki.debian.org/LTS)). Any distro
that pins `stable` inherits that clock; any distro that pins `testing` starts somewhere else.

### Wide comparison

| | Debian KDE | MX Linux KDE | Netrunner | RefreshOS | Neptune | Q4OS | SpiralLinux KDE | Tuxedo OS |
|---|---|---|---|---|---|---|---|---|
| Base branch | `stable` | `stable` | `stable` | `stable` | `stable` + newer kernel | `stable` | `stable` + backports | Ubuntu LTS → `testing` |
| Desktop shipped | Selectable at install | Xfce default, KDE as separate edition | KDE, heavily customised | KDE, Brave + LibreOffice + GIMP | KDE | KDE or Trinity | KDE spin | KDE |
| Plasma version | 6.3 | 6.3.6 | 6.3.6 | [unverified] | 6 | 6.3.6 | 6.3 | 6.5.x |
| Release model | ~2 years + LTS | Debian cycle | Debian cycle | Own v3 stable repo | Debian cycle | Debian cycle, 5-yr LTS | Debian cycle | Announced Debian `testing` |
| Repos | Debian + security | Debian + MX repo | Debian + own repo | Debian + own v3 repo | Debian + own repo | Debian + own repo | Debian only | Own repo |
| Hardware firmware | Non-free since Debian 12 | AHS kernel option | Ships firmware | Extended drivers | Newer kernel preinstalled | Ships firmware | Firmware + backports | Vendor hardware |
| Teams | Thousands of devs | antiX + MEPIS veterans | Single developer | Small team | Small team (DE) | Small team (CZ) | Single developer | Commercial vendor (DE) |
| Live status | Active | Active, #2 on DistroWatch | Active, 26 "Twilight" | Active, 3.1 | Active, v9 line | Active, 6.1 "Andromeda" | **Dormant** | Active, 6.5.x |
| Best fit | Own your config | Want polish, still stable | Want a themed desktop | Want a big app set | Want stable + new hardware | Want stable, longest life | Want Btrfs rollbacks | Own a Tuxedo, want newest KDE |

Version and status cells: [Debian wiki](https://wiki.debian.org/KDE),
[9to5linux MX](https://9to5linux.com/mx-linux-25-infinity-enters-public-beta-testing-based-on-debian-13-trixie),
[Netrunner](https://www.netrunner.com/download/), [RefreshOS](https://refreshos.org/), [DistroWatch Neptune](https://distrowatch.com/table.php?distribution=neptune),
[9to5linux Q4OS](https://9to5linux.com/q4os-6-1-distro-is-out-based-on-debian-13-with-kde-plasma-and-trinity-desktops),
[SpiralLinux](https://spirallinux.github.io/),
[TUXEDO](https://www.tuxedocomputers.com/en/A-new-foundation-for-TUXEDO-OS-Switching-to-Debian.tuxedo).
DistroWatch status cells: [MX](https://distrowatch.com/table.php?distribution=mx),
[Netrunner](https://distrowatch.com/table.php?distribution=netrunner),
[RefreshOS](https://distrowatch.com/table.php?distribution=refreshos),
[Neptune](https://distrowatch.com/table.php?distribution=neptune),
[Q4OS](https://distrowatch.com/table.php?distribution=q4os),
[Spiral](https://distrowatch.com/table.php?distribution=spiral),
[Tuxedo](https://distrowatch.com/table.php?distribution=tuxedo).

### Q4OS — the longest-lived `stable` option

Q4OS 6.1 "Andromeda" is Debian 13 with Plasma 6.3.6 or Trinity 14.1.5, and the project commits to
five years of free security patches with commercial support contemplated beyond that
([9to5linux](https://9to5linux.com/q4os-6-1-distro-is-out-based-on-debian-13-with-kde-plasma-and-trinity-desktops)).
The Plasma edition is a stock upstream build, not a remix. It ships its own Desktop Profiler and
software centre, targets i686 as well as x86_64, and states outright that it follows the Debian
release model rather than inventing one ([q4os.org](https://www.q4os.org/)). Trinity is offered
because the team considers mainstream desktops too heavy, which is the only real taste question
in the set.

Caveat: it is a small Czech team, and the lack of a custom KDE layer means you get few
conveniences past the defaults.

### MX Linux — the polished one, and the one that fights you least

MX Linux is an antiX and former-MEPIS co-operative pinned to Debian `stable`, ranking second on
DistroWatch over the last four weeks ([distrowatch/mx](https://distrowatch.com/table.php?distribution=mx)).
MX 25 "Infinity" is Debian 13 with Plasma 6.3.6, and the KDE edition now defaults to the Wayland
session ([9to5linux](https://9to5linux.com/mx-linux-25-infinity-enters-public-beta-testing-based-on-debian-13-trixie)).
The MX tooling — snapshot and remaster, the hardware-support kernel lane, its own repo — is the
work that makes a Debian install friendly without moving off `stable`.

Xfce is the flagship desktop, so KDE is a maintained edition rather than the headline.

### Neptune — Debian `stable` without the stale kernel

Neptune keeps Debian `stable` but ships a newer kernel, newer drivers and newer versions of
popular applications, plus Plasma 6 ([distrowatch/neptune](https://distrowatch.com/table.php?distribution=neptune),
[KDE wiki](https://community.kde.org/Distributions)). That is the right trade for recent hardware
whose support has not reached a point release yet.

It is a German project with no bug tracker listed on DistroWatch, and the release stream is
versioned in single digits (Neptune 9 beta on the forum).

### Tuxedo OS — announced exit from Ubuntu, worth watching

Tuxedo OS is currently Ubuntu LTS-based, ships Plasma 6.5.x, and dropped Snap in favour of its
own Control Centre, Calamares installer and PipeWire defaults
([distrowatch/tuxedo](https://distrowatch.com/table.php?distribution=tuxedo)). On 2026-07-07
Tuxedo announced the base moves to **Debian `testing`**, citing Plasma updates lagging (6.7
already out while they sit on 6.5.x) and security updates arriving slower than they should
([tuxedocomputers](https://www.tuxedocomputers.com/en/A-new-foundation-for-TUXEDO-OS-Switching-to-Debian.tuxedo)).

Treat it as Debian-family on announcement, not on the current ISO: the shipped image is still
Ubuntu-derived, and `testing` inherits the migration-delay caveat above.

### RefreshOS — the anti-Snap, anti-Flatpak `stable` build

RefreshOS 3.1 is Debian `stable` with Plasma, Brave, LibreOffice and GIMP, "extended driver
support", and a deliberate clean environment with no Snap and no Flatpak
([distrowatch/refreshos](https://distrowatch.com/table.php?distribution=refreshos)). That choice
is the whole identity, and it is also the constraint: three apps arrive pre-decided. Recent
versions theme the desktop with custom icons, cursors, a "Reload Menu", and upgrade through a
project-run v3 stable repository instead of a fresh install ([refreshos.org](https://refreshos.org/)).

### SpiralLinux KDE — best base hygiene, worst availability

SpiralLinux builds spins from Debian with **only official Debian repositories**, plus backports
firmware, PipeWire defaults, zRAM and a Btrfs plus Snapper layout with GRUB-bootable snapshots
([spirallinux.github.io](https://spirallinux.github.io/)). It is the least imposing overlay in the
set and the easiest to collapse back to plain Debian.

But DistroWatch lists it as **dormant**, and the whole offering comes from one developer
([distrowatch/spiral](https://distrowatch.com/table.php?distribution=spiral)). The
"developer-hit-by-a-bus" argument is the project's own stated motivation and, with one dev, its
main risk.

### Netrunner — a rebrand, not a project

Netrunner is Debian `stable` plus a theme and a preinstalled app set. Version 26 "Twilight" is
Debian 13 with Plasma 6.3.6 and leads with a Dash and Simplemenu launcher, Folderview icons and a
hot-spot corner ([netrunner.com](https://www.netrunner.com/)) — a desktop opinion, not an
engineering one. Netrunner's own download page also asks for a `full-upgrade` immediately
post-install, which tells you how much of the finished system it considers its job
([netrunner.com/download](https://www.netrunner.com/download/)).

### The ones that do not earn a column

- **siduction** — Debian `unstable`, so Plasma parity with Trixie and the thinnest security
  story ([distrowatch/siduction](https://distrowatch.com/table.php?distribution=siduction)).
  Pick it when you want Sid with an installer.
- **Kubuntu** — Ubuntu-based, Plasma 6 only from 24.10 ([KDE wiki](https://community.kde.org/Distributions)),
  so it is Debian one hop removed plus Snap and Canonical's release clock.
- **KDE neon** — Ubuntu 24.04 plus daily KDE builds, and its own FAQ is careful that the
  "User" edition is unsupported past the KDE stack with no review of the whole system
  ([neon FAQ](https://neon.kde.org/faq)). Best when you want latest KDE specifically.

## Open Questions

- RefreshOS, Netrunner and Neptune all reach Plasma 6 "easy and formally supported" per the KDE
  wiki, but only Neptune of the three has a published upgrade story — what happens to the other
  two on a Debian point release is unverified.
- Neptune has no public bug tracker; where its issues actually get filed is unresolved.
- Whether Tuxedo OS's `testing` move lands with the Snapper snapshotting it advertised is
  unannounced beyond the blog post.

## Related

- [Windows-Like Linux Desktops](./windows-like-linux-desktops.md) — the same Plasma pick where the
  goal is a familiar layout instead of a plain one; Q4OS appears in both.
- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — which of these desktops
  still renders when there is no GPU and no display connector.
- [Computer-Use Stacks for Agents Under gVisor](./computer-use-stack-for-agents-on-gvisor.md) — the
  control plane over a remote desktop, per combination.

## Changelog

- 2026-11-06 — created. External facts came from TinyFish `search` and `fetch_content`. Two
  fetches fell back to verification through other pages: `mxlinux.org/products/kde/` returned
  `bot_blocked`, so MX KDE details rest on the 9to5linux release article and DistroWatch;
  `neptuneos.com` and `q4os.org/knowledgebase.html` failed, so both rest on DistroWatch, the KDE
  wiki and 9to5linux. RefreshOS' Plasma version stayed `[unverified]`.
