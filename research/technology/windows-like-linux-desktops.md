---
title: Windows-Like Linux Desktops — Which Desktops Actually Reproduce the Windows Shell, and What Each Costs
category: technology
tags: [linux, desktop-environment, kde-plasma, cinnamon, xfce, deepin, budgie, zorin, linuxfx, wubuntu, anduinos, windows, migration, theming]
status: complete
created: 2026-11-06
updated: 2026-11-06
sources:
  - https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/
  - https://www.xda-developers.com/make-linux-look-like-windows-11/
  - https://docs.kde.org/trunk_kf6/en/plasma-desktop/plasma-desktop/panel.html
  - https://userbase.kde.org/Plasma/Kickoff/en
  - https://discuss.kde.org/t/optional-windows-like-settings/46352
  - https://en.wikipedia.org/wiki/Cinnamon_(desktop_environment)
  - https://en.wikipedia.org/wiki/Zorin_OS
  - https://zorin.com/os/
  - https://zorin.com/os/pro/
  - https://en.wikipedia.org/wiki/Deepin
  - https://security.opensuse.org/2025/05/07/deepin-desktop-removal.html
  - https://en.wikipedia.org/wiki/Winux
  - https://www.theregister.com/software/2024/12/05/wubuntu-the-lovechild-of-windows-and-linux-nobody-asked-for/1541244
  - https://www.zdnet.com/article/why-i-no-longer-recommend-this-windows-like-linux-distro/
  - https://www.tomshardware.com/software/linux/ive-tried-many-linux-distros-designed-to-look-and-feel-like-windows-but-linuxfx-is-the-best-ive-tested-yet
  - https://en.ubunlog.com/Controversies-surrounding-Wubuntu%3A-a-reliable-Linux-distribution/
  - https://www.anduinos.com/
  - https://itsfoss.com/news/anduin-os/
  - https://medium.com/feren-os/2025-still-relatively-uneventful-fc8b141649f5
  - https://www.xda-developers.com/gnome-extensions-are-reason-linux-desktops-break-themselves/
  - https://en.wikipedia.org/wiki/ReactOS
  - https://www.phoronix.com/news/ReactOS-Starts-2026
  - https://en.wikipedia.org/wiki/Proton_(software)
  - https://www.howtogeek.com/why-zorin-os-pro-is-worth-paying-for/
  - https://betanews.com/article/this-updated-windows-11-clone-is-linux-underneath-and-makes-your-old-pc-run-faster-get-it-now/
  - https://www.reddit.com/r/unixporn/comments/vl64b0/q4os_trinity_windows_xp_classic_theme/
  - https://www.makeuseof.com/q4os-brings-old-laptop-back-to-life/
  - https://forum.zorin.com/t/desktop-layout-changed-itself-from-zorin-windows-standard-to-gnome-zorin-appearance-not-working/30041
confidence: high
---

# Windows-Like Linux Desktops — Which Desktops Actually Reproduce the Windows Shell, and What Each Costs

## TL;DR

- **The honest answer is a ranking of shells, not of distros.** Three desktops ship a Windows-shaped shell as native code: **Cinnamon** (bottom panel, left Start-style launcher, tray, desktop icons, persistent taskbar), **KDE Plasma** (same anatomy, far more configurability), and **Xfce** (same anatomy, dated, the lightest of the three). Almost everything else on the market is one of those three plus a theme, or a GNOME shell plus an extension set.
- **KDE Plasma is the maximum-fidelity answer available today, and it is deliberately not a Windows clone by default.** Plasma 6 ships a floating panel and a centred taskbar, and a KDE Brainstorm thread lists the Windows habits it still does not default to (a panel that morphs on maximise, "Peak at desktop" instead of "Show desktop", collapsible folders in Dolphin) and asks for a one-click "apply Windows-like settings" wizard ([discuss.kde.org](https://discuss.kde.org/t/optional-windows-like-settings/46352)). Full fidelity takes a global theme plus an OnzeMenu 11 widget ([XDA](https://www.xda-developers.com/make-linux-look-like-windows-11/)).
- **The distros built around the look are Zorin OS** (Core free, Pro $47.99 for the Windows 11 and Windows Classic layouts, GNOME-based, 2M downloads in under three months mostly from Windows users), **AnduinOS** (Ubuntu base, GNOME 50, a Windows 11 "Fluent UI" look, GPLv3, free), and **Linuxfx / Wubuntu / Winux** (Kubuntu plus the Redsand or Win11OS KDE themes, proprietary, paid PowerTools, recurring nag screen, trademark complaints). **Feren OS** used to be on that list and is mid-rewrite to Plasma 6.
- **Two separate things get called "Windows-like":** the shell layout (taskbar bottom-left, Start menu, window buttons right, single-click launchers) and the applications. The shell is cheap and reliable; the applications are not — .exe support is Wine, Proton or WinBoat, never native. **ReactOS** is the only candidate that is binary-compatible by construction, and it is still alpha after 28 years.

## Context

Ask "which Linux desktop is most similar to Windows" and the answer splits along a seam the articles blur: the shell (where the panel sits, what the launcher looks like, how windows decorate, what a file manager shows by default) versus the application layer (can the .exe run, is there a Control Panel wired to anything).

The shell is a solved problem. The Windows layout — panel at the bottom, launcher left, window buttons right — is one of the most conservative desktop paradigms on Linux, and several desktops reproduce it in native code. The application layer is not solved, and it is not what "Windows-like" usually means in practice. This file ranks shells by how much of the Windows way is native rather than bolted on, then covers the distros that curate the look, the Windows-11 clone lineage, and the one exception that moves the goalpost entirely.

Scope: Linux and near-Linux free operating systems, at 2026-11-06. Excluded: macOS imitations (already dense), tiling compositors (Hyprland, Sway), and ChromeOS lookalikes.

## Findings

### Ranked by how much of the shell is native code

|  | **Cinnamon** | **KDE Plasma** | **Xfce** | **AnduinOS** | **Zorin OS** | **Deepin (DDE)** | **Budgie** | **Linuxfx / Wubuntu** | **ReactOS** |
|---|---|---|---|---|---|---|---|---|---|
| Shell implemented as | Native GTK fork of GNOME Shell — own WM (Muffin), own file manager (Nemo) | Native Qt shell — plasma-desktop, Kickoff, KWin | Native GTK shell | GNOME 50 plus a curated extension set | GNOME plus the Zorin Appearance layout switcher | Native Qt shell | Native shell | Kubuntu plus a third-party theme and paid widgets | Its own NT-shaped kernel and explorer |
| Application launcher | Start-shaped menu, left of a bottom panel | Kickoff, default at the far left of the bottom panel | Whisker Menu | GNOME app grid with a dock | Start-like layout toggled in Appearance | Launcher left of the taskbar | Start-shaped left, Raven tray right | Start-like launcher | Start menu |
| Taskbar model | Persistent taskbar with window list, pinning, tray | Persistent panel with task manager and spacer widgets | Persistent panel | Bottom dock plus top bar | Bottom panel from the chosen layout | Centred bottom taskbar | Bottom taskbar | Centred Windows 11 taskbar | Taskbar |
| Window buttons default | Right | Right | Right | Right, via a GNOME tweak | Right on the Windows layouts | Right | Right | Right | Right |
| Desktop icons | Yes | Yes | Yes | Yes, via extension | Yes | Yes | Yes | Yes | Yes |
| Distance from Windows out of the box | Windows 7, mutated forward | Windows 11, besides floating-panel quirks | Windows-shaped, Windows XP era looks | Windows 11 look, published as the product | Windows 11 or Classic, one click | Windows 11 look, little theming | Windows 7 layout, Windows 11 action center | Windows 10/11 look, published as the product | Windows is the target |
| Configurability | Good — themes, applets, layouts | Highest here — every element is a widget | Good for a lightweight DE | Curated, distro-fixed extension set | Curated layouts | Low | Medium — Raven and applets | Curated, PowerTools for the control panel | Low — no theming ecosystem |
| Paid component needed to be complete | No | No | No | No | No, Pro adds layouts and apps | No | No | **Yes, PowerTools** | No |
| Maturity | 14 years, GPL-2.0, 6.6.9 | Decades | Decades | 2.0.5, months old | 2009, 18.1 | 2004, 25.0.2 | Long, small team | Rebranded since 2007 | Alpha since 1998 |
| Notable caveat | Wayland session still experimental | Defaults are not Windows defaults | Looks 20 years old | Ubuntu base, though IT'S FOSS wrote Debian | Free Core is the cautious pick | openSUSE dropped DDE in 2025 | Small team behind its own distro | Nag screen and trust complaints | Alpha, evaluation only |

Sources per row: Cinnamon's own WM and file manager, GPL-2.0 licence and 6.6.9 release are [Wikipedia](https://en.wikipedia.org/wiki/Cinnamon_(desktop_environment)); "bottom panel… Start Menu–style launcher on the left, a taskbar… a system tray on the right" is [How-To Geek](https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/); Kickoff's far-left bottom placement is [KDE UserBase](https://userbase.kde.org/Plasma/Kickoff/en) and the task-manager widget is the [KDE docs](https://docs.kde.org/trunk_kf6/en/plasma-desktop/plasma-desktop/panel.html); the floating-panel and centred-taskbar gaps are [KDE Brainstorm](https://discuss.kde.org/t/optional-windows-like-settings/46352); AnduinOS's GNOME 50, Fluent UI claim, GPLv3 licence and 2.0.5 version are its [own site](https://www.anduinos.com/) plus [IT'S FOSS](https://itsfoss.com/news/anduin-os/); Zorin's layout claim is [zorin.com](https://zorin.com/os/), the layout names are the [Pro page](https://zorin.com/os/pro/), and the 18.1 and download record are [Wikipedia](https://en.wikipedia.org/wiki/Zorin_OS); DDE's Qt implementation and 25.0.2 are [Wikipedia](https://en.wikipedia.org/wiki/Deepin), its removal is the [SUSE security blog](https://security.opensuse.org/2025/05/07/deepin-desktop-removal.html); Budgie and Xfce descriptions are [How-To Geek](https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/); Linuxfx's PowerTools control panel and WinBoat packaging are [Wikipedia](https://en.wikipedia.org/wiki/Winux); ReactOS's goal, 1998 start, alpha status and 0.4.16 are [Wikipedia](https://en.wikipedia.org/wiki/ReactOS).

### The three honest shell answers

**Cinnamon** is the closest thing on Linux to a maintained continuation of the Windows 7 shell, and it got there by construction rather than by theming: panel, Start-shaped launcher, tray, desktop icons, context menus and window buttons are all its own widgets ([How-To Geek](https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/)). It is also structurally independent of GNOME — a GNOME Shell fork with its own window manager (Muffin, a Mutter fork), its own file manager (Nemo, a Nautilus fork) and its own settings app, no longer a GNOME frontend since 2.0.0 in 2013 ([Wikipedia](https://en.wikipedia.org/wiki/Cinnamon_(desktop_environment))). That independence is why it does not inherit GNOME's extension fragility. Its cost is a Wayland session that only appeared in 6.0.0 in November 2023 and is still called experimental, and a project run by a single distro.

**KDE Plasma** matches the Windows anatomy by default and out-specs Windows on every axis, because each part of the layout is a widget with settings: panel position and floating behaviour, task manager, tray entries, spacers, and launcher choice, with Kickoff the default and Application Dashboard among the alternatives ([KDE docs](https://docs.kde.org/trunk_kf6/en/plasma-desktop/plasma-desktop/panel.html), [UserBase](https://userbase.kde.org/Plasma/Kickoff/en)). It is the only environment where a Windows 11 clone is a configuration rather than a fork: a global theme (Win11OS-light or windows-eleven), an icon pack and the OnzeMenu 11 widget produce the look, then spacer widgets and a one-row task manager centre the start button ([XDA](https://www.xda-developers.com/make-linux-look-like-windows-11/)). The gaps are defaults, not capabilities.

**Xfce** has the anatomy — one panel, app menu left, window list middle, tray right — arranged top-first by default, so a distro has to move the panel to the bottom ([How-To Geek](https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/)). It is the lightest of the three and the most dated-looking; How-To Geek compares it to Windows XP visually.

**GNOME is absent from that ranking on purpose.** The default shell is not Windows-shaped — no persistent taskbar, no desktop icons, an overview-first workflow — so every Windows-like GNOME distro is really shipping an extension set. The two in scope, AnduinOS and Zorin OS, are graded on their curated sets below.

### Distros built around the look

**Zorin OS** is the mainstream, longest-running version of the idea: a Dublin company, around since 2008, whose Zorin Appearance app switches the desktop between layouts "whether it's Windows, macOS, or Linux" ([zorin.com](https://zorin.com/os/)). Pro adds eight premium layouts — macOS, Windows 11, Windows Classic, ChromeOS, Compact panel, Ubuntu, elementary OS and Cinnamon — on top of four core ones ([zorin.com/os/pro](https://zorin.com/os/pro/)), and Wikipedia puts Pro at $47.99 with the free Core edition doing the same technical work ([Wikipedia](https://en.wikipedia.org/wiki/Zorin_OS), [How-To Geek](https://www.howtogeek.com/why-zorin-os-pro-is-worth-paying-for/)). Adoption followed Windows 10's October 2025 end of support: 1M downloads in five weeks, then 2M in under three months of Zorin OS 18, most from Windows users ([Wikipedia](https://en.wikipedia.org/wiki/Zorin_OS)). ZDNET's answer to the trust question names Zorin OS ([ZDNET](https://www.zdnet.com/article/why-i-no-longer-recommend-this-windows-like-linux-distro/)).

**AnduinOS** is the same goal on a different base and for a different reason: a 2.38 GB Ubuntu-derived image with GNOME 50, a Fluent-design Windows 11 look, Flatpak-only GUI apps, GPLv3, no telemetry and no Snap ([anduinos.com](https://www.anduinos.com/)). It launched in 2024 as 1.0.2, where IT'S FOSS found the look right and the software story wrong — an "App Store" that was a web page of shell instructions, with neither Flatpak nor Snap shipped ([IT'S FOSS](https://itsfoss.com/news/anduin-os/)). Both have since changed: 2.0.5 ships Flatpak and advertises an app-store path, LTS support into April 2031, a 2.38 GB live image and a comparison page against Zorin, Mint and Ubuntu.

**Linuxfx / Wubuntu / Winux** is the extreme end, and it is one project wearing three names: Linuxfx from 2007, rebranded to Wubuntu, then Winux ([Wikipedia](https://en.wikipedia.org/wiki/Winux), [The Register](https://www.theregister.com/software/2024/12/05/wubuntu-the-lovechild-of-windows-and-linux-nobody-asked-for/1541244)). It goes furthest on what a Windows user reaches for — bundled Wine, Microsoft Edge, Teams, a Windows-style Control Panel, one-click .exe and .msi, Active Directory, OneDrive, and since 11.25.12 WinBoat running Windows inside a Docker container ([Wikipedia](https://en.wikipedia.org/wiki/Winux), [BetaNews](https://betanews.com/article/this-updated-windows-11-clone-is-linux-underneath-and-makes-your-old-pc-run-faster-get-it-now/)). Tom's Hardware called the installer the simplest it had ever done and the theme convincing ([Tom's Hardware](https://www.tomshardware.com/software/linux/ive-tried-many-linux-distros-designed-to-look-and-feel-like-windows-but-linuxfx-is-the-best-ive-tested-yet)).

### What the clone distros get wrong

**A nag screen is the whole story.** ZDNET tested Wubuntu for a week, then got a persistent pop-up demanding a PowerTools product key; without one the desktop was unusable, and the only source is a purchase. After digging, the writer withdrew the recommendation ([ZDNET](https://www.zdnet.com/article/why-i-no-longer-recommend-this-windows-like-linux-distro/)). Ubunlog files the same complaint plus the licence-database exposure ([Ubunlog](https://en.ubunlog.com/Controversies-surrounding-Wubuntu%3A-a-reliable-Linux-distribution/)), and Tom's Hardware notes the pop-up conflates buying with donating ([Tom's Hardware](https://www.tomshardware.com/software/linux/ive-tried-many-linux-distros-designed-to-look-and-feel-like-windows-but-linuxfx-is-the-best-ive-tested-yet)).

**Trademark exposure is structural, not incidental.** "Windows" is a Microsoft trademark and the projects never say they had permission; the boot logo is the flat Windows mark, the taskbar icons are indistinguishable from Microsoft's, and the theme repo carries a GPL3 copy with no attribution for the images ([The Register](https://www.theregister.com/software/2024/12/05/wubuntu-the-lovechild-of-windows-and-linux-nobody-asked-for/1541244)). The Register's verdict: the imitation "does look good", but it is "skin-deep".

**The naming churn bites in search and in trust.** Someone looking for Linuxfx lands on Wubuntu and then Winux, each with its own ISO, its own PowerTools status — no longer key-gated at 11.25.09 — and its own forum lore ([Wikipedia](https://en.wikipedia.org/wiki/Winux), [BetaNews](https://betanews.com/article/this-updated-windows-11-clone-is-linux-underneath-and-makes-your-old-pc-run-faster-get-it-now/)). The Register and XDA both cite it as a reason not to recommend the project ([The Register](https://www.theregister.com/software/2024/12/05/wubuntu-the-lovechild-of-windows-and-linux-nobody-asked-for/1541244), [Wikipedia](https://en.wikipedia.org/wiki/Winux)).

### Deepin: the best-looking shell with the worst packaging record

DDE is the one desktop here that recreates the Windows 11 anatomy — centred taskbar, launcher left, tray right — natively, in Qt, with its own window manager, and is routinely described as the best-looking desktop on the market ([How-To Geek](https://www.howtogeek.com/best-windows-like-linux-desktops-for-a-familiar-look-and-feel/), [Wikipedia](https://en.wikipedia.org/wiki/Deepin)). It also has almost no theming depth, so if the default look is not the one you want there is nothing to do about it.

The cost is all provenance. Deepin was accused in 2018 of shipping spyware through App Store analytics, and openSUSE's SUSE security team removed DDE from Tumbleweed and partly from Leap in May 2025 after finding that the deepin-feature-enable package had, since April 2021, been extracting D-Bus configuration files and Polkit policies into /etc from tarballs to skirt the security review whitelist ([Wikipedia](https://en.wikipedia.org/wiki/Deepin), [SUSE security blog](https://security.opensuse.org/2025/05/07/deepin-desktop-removal.html)). DDE remains in Arch and Fedora repositories and ships in the Deepin distribution itself, which as of 25.0.2 supports x86-64, ARM64, RISC-V and LoongArch.

### GNOME extension shells and their failure mode

AnduinOS and Zorin OS both rebuild a Windows shell out of GNOME extensions, which is exactly where the brittleness lives. Extensions inject JavaScript and override default behaviour instead of extending a stable API, so any GNOME release that changes the internals breaks the unmaintained ones, and a broken one can crash the shell ([XDA](https://www.xda-developers.com/gnome-extensions-are-reason-linux-desktops-break-themselves/)). A Zorin forum thread has the mild version, where a layout reset itself to stock GNOME and Appearance stopped working ([forum.zorin.com](https://forum.zorin.com/t/desktop-layout-changed-itself-from-zorin-windows-standard-to-gnome-zorin-appearance-not-working/30041)).

Both distros mitigate by freezing the extension set against their own base — Zorin on its LTS, AnduinOS on GNOME 50 with its own curation — which is also why neither is a good candidate if you want to follow GNOME upstream. If the isolation problem is the thing that bothers you, skip the distro and turn upstream GNOME into Windows yourself with Dash-to-Panel, ArcMenu, Clipboard Indicator, gnome-tweaks and dconf: same result, manual maintenance, nobody else's boundary to blame.

### Feren OS — the fifth name the listicles skip

Feren OS is the Windows-10-era answer to this question and it is mid-surgery. The developer's January 2026 annual post describes a year of "drained motivation" and an art and coding block, a 10th Anniversary release rebased on Ubuntu 24.04 and shipping Plasma 6 for the first time, an installer still recommending an empty disk, broken Bluetooth pairing, and "an unprecedented mess" of pending fixes, with the release pushed to early 2026 ([Medium](https://medium.com/feren-os/2025-still-relatively-uneventful-fc8b141649f5)). The point is not that breakage is unusual; it is that Feren's Windows look rides on a base being rewritten from Plasma 5 to 6, so the layout you would theme is the thing most likely to move.

### If you want Windows 7 or XP specifically

The layout above is the Windows 11 one; Cinnamon and Plasma both still speak Windows 7 natively once the panel moves and a classic launcher is chosen. For a Windows XP target, Q4OS with the XPQ4 theme pack on the Trinity desktop, a KDE 3.5 lineage, is the dedicated answer, and it idles at roughly 460–520 MB of RAM ([Reddit](https://www.reddit.com/r/unixporn/comments/vl64b0/q4os_trinity_windows_xp_classic_theme/), [MakeUseOf](https://www.makeuseof.com/q4os-brings-old-laptop-back-to-life/)). XPQ4's own site returned a bot-block to TinyFish, so the pack's current release is unverified here.

### The applications half — a caveat, not a feature

A Windows-looking shell changes where the buttons are. It does not change what runs. .exe support is Wine, Proton or WinBoat in a container; Proton is a Valve compatibility layer that lets Windows software run on Linux ([Wikipedia](https://en.wikipedia.org/wiki/Proton_(software))). Distros differ in how much plumbing they preinstall — Linuxfx bundles Wine and a Docker-based WinBoat, Zorin bundles a Windows App Support path, AnduinOS ships none of it — but none of them is a Windows runtime. If the daily flow is three .exe files, budget for Wine or a VM whichever desktop wins the ranking above.

### The exception: ReactOS

ReactOS is not a themed Linux desktop. It is a free operating system written to be binary-compatible with Windows NT applications and drivers, in development since 1998, on i586/amd64, GPL-2.0-or-later, with its own explorer and no compose or bash underneath ([Wikipedia](https://en.wikipedia.org/wiki/ReactOS)). It is also alpha after 28 years and formally recommended for evaluation only. Progress still lands: in January 2026 the MSVCRT implementation was rebased onto Wine 10.0, clearing roughly 7,574 of 25,517 API test failures, 29.6% ([Phoronix](https://www.phoronix.com/news/ReactOS-Starts-2026)). Pick it if the Windows API surface matters more than polish and you can live with alpha; otherwise pick Linux.

### Picking one, in order

| If the goal is | Take | Because |
|---|---|---|
| The taskbar-and-Start habit, with nothing to maintain | **Cinnamon** on Linux Mint, or Plasma on Kubuntu | Both are native shells; neither needs a theme to reach Windows 7 / Windows 11 anatomy |
| Maximum control, Windows 11 look, willing to theme | **KDE Plasma** plus a global theme (`Win11OS-light` or `windows-eleven`), an icon pack and the OnzeMenu 11 widget | Only environment where the clone is a configuration, and the only one with spacer widgets to centre the start button ([XDA](https://www.xda-developers.com/make-linux-look-like-windows-11/)) |
| A curated zero-theme Windows 11 desktop | **AnduinOS**, or **Zorin OS** on the Windows 11 layout | Both ship it as the product; both are GNOME-extension based, so freeze the base |
| .exe files as a daily habit | **Linuxfx / Winux**, plus Wine or a VM anyway | Bundles Edge, Teams, Wine, PowerTools control panel and WinBoat — and the nag screen ([Wikipedia](https://en.wikipedia.org/wiki/Winux), [ZDNET](https://www.zdnet.com/article/why-i-no-longer-recommend-this-windows-like-linux-distro/)) |
| Windows 7 or XP exactly | **Plasma / Cinnamon** for 7; **Q4OS + XPQ4** for XP | XPQ4 is purpose-built, Q4OS is light |
| The Windows API, not the look | **ReactOS** | Binary compatibility by construction — and alpha ([Wikipedia](https://en.wikipedia.org/wiki/ReactOS)) |

The one structural point under all of these: **measure how much of the Windows look is native code.** A native panel, taskbar and launcher do not break on an upstream release; a theme does, and an extension more so. Cinnamon and Plasma put the whole shell in the desktop's own repository. Zorin, AnduinOS and every GNOME reskin put it in third-party JavaScript.

## Open Questions

- Whether Plasma 6 has gained a first-class "apply Windows-like defaults" switch since the Brainstorm thread. The thread is a request, and nothing found says one shipped.
- Whether the Q4OS and Trinity stack behind XPQ4 is still maintained at a current release. The project site was bot-blocked.
- What the per-distro fidelity actually is in the mid-tier. Zorin, AnduinOS and Feren OS all rely on curated GNOME or Plasma sets, and nobody published side-by-side measurements.
- Whether Linuxfx and Wubuntu settled the nag screen for good, or whether 11.25.09's keyless PowerTools was a single release.
- Whether the 2025 Feren OS 10th Anniversary release shipped on Plasma 6 and how its redesign compares. The developer's January 2026 post still lists it as pending.

## Related

- [Debian-Derived Distros With KDE Plasma](./debian-based-kde-distributions.md) — where Plasma comes from on Debian and which Debian branch each derivative pins.
- [Running a Linux Desktop Inside gVisor](./linux-desktop-in-gvisor.md) — the same desktop question where there is no GPU and no display connector: why headless Wayland GNOME over RDP works and Xorg, xrdp and VNC do not.
- [Computer-Use Stacks for Agents Under gVisor](./computer-use-stack-for-agents-on-gvisor.md) — the control plane over a desktop, per combination.
- [Browser-Viewable VNC on gVisor](./vnc-server-on-gvisor-with-browser-client.md) — why a remotely served Windows-like desktop has to be X11.

## Changelog

- 2026-11-06 — created. Every external source went through TinyFish search and fetch_content; XPQ4's own site returned bot_blocked, so its details rest on secondary sources.
