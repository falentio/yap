---
title: T3 Code — How It Ships: Server Archives, Desktop Installers, and the Release Train
category: technology
tags: [t3-code, distribution, electron, electron-builder, electron-updater, code-signing, notarization, github-actions, npm, homebrew, aur, release-engineering]
status: complete
created: 2026-10-30
updated: 2026-10-30
sources:
  - https://github.com/pingdotgg/t3code
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/user/install.md
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/README.md
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/.github/workflows/release.yml
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/scripts/build-desktop-artifact.ts
  - https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/packages/shared/src/cliRelease.ts
  - https://registry.npmjs.org/t3
  - https://t3.codes
confidence: high
---

# T3 Code — How It Ships

## TL;DR

- **One workflow, three trains.** stable, nightly, preview — all `.github/workflows/release.yml`. Stable is a *promotion of a verified nightly commit*, not `main` HEAD: `resolve_commit` builds the latest published nightly for `channel=stable`. Preview is a maintainer test train with no update feed, and it is the dispatch default so an omitted selection cannot ship stable.
- **The server ships as a Node single-executable archive, not as an npm install.** Five archives per release (`darwin-arm64`, `linux-x64`, `linux-arm64`, `win32-x64`, `win32-arm64`) sit on the GitHub Release beside `SHA256SUMS`; the install scripts, `t3 update`, the boot service, and the desktop's SSH bootstrap all fetch and verify those bytes.
- **The `t3` npm package is a launcher, not the product.** It downloads its own exact version's archive, verifies it, and unpacks into `<T3 home>/runtime/versions/<version>`. The per-platform npm packages were retired because npm's publish-time scan held 80–250 MB tarballs back for up to an hour, handing users a launcher with no executable.
- **Desktop is electron-builder, six artifacts, signed per OS.** DMG + zip (arm64, x64), NSIS (x64, arm64), AppImage + `.deb` (x64, arm64). macOS is Developer ID signed and notarized; Windows is signed with Azure Trusted Signing through jsign **on a Linux runner**. electron-builder runs with `--publish never` — the release job uploads.
- **There is no update server and no object store.** The GitHub Release *is* the feed: `provider: github`, `latest*.yml` / `nightly*.yml` plus blockmaps, background checks, and no download or install without a click. Preview builds get `publish = null` and carry no manifests at all.
- **No Docker image.** No `Dockerfile`, no image publish job, no registry reference outside the devcontainer.
- **Release ordering is an invariant.** Release assets → npm launcher → hosted web alias, because a connected server updates to the *client's exact version* and the desktop reads the GitHub Release directly.

## Context

Question: how does T3 Code distribute itself — how do the server and the desktop app reach a machine, and what does the release pipeline look like? Researched 2026-10-30 against `github.com/pingdotgg/t3code` @ `32ecd71726fee16f335484c1f95cbce126d461f6` (`main`, 2026-10-30), from the release runbook, install docs, workflow files, and packaging scripts at that commit. Every `path:line` anchor below is a path in that commit; doc and code links are pinned to it.

Why it is shaped this way: the product is a *server* that agents run on, and three shells attach to it. That makes distribution two problems at once — a server-runtime problem (a large native-ish payload that must exist on the user's machine before any UI works) and a client-update problem (three surfaces that must stay compatible with whatever server version a given host runs). T3 solves the first with Node single-executable archives and the second with exact-version pairing plus channel-scoped updater feeds.

## The three trains

| Dimension | stable | nightly | preview |
|---|---|---|---|
| Trigger | `workflow_dispatch channel=stable`; also a `v*.*.*` tag push | `schedule` at `8,38 * * * *`, releasing only when there are new commits; manual dispatch | manual dispatch, any branch |
| Commit built | latest *published* nightly, not `main` HEAD | the triggering commit (manual nightlies bypass the change and 6-hour-gap checks) | the triggering commit |
| Version | the version the nightly previewed (`0.0.39-nightly.*` ships as `0.0.39`) | next patch on the committed desktop version, `<base>-nightly.<date>.<run>` | same base, `-preview.<date>.<run>` |
| GitHub Release | full release, marked latest | prerelease, never latest | prerelease named as a maintainer test build, body is a warning |
| npm `t3` dist-tag | `latest` | `nightly` | `preview` |
| Updater manifests | `latest*.yml` + blockmaps | `nightly*.yml` + blockmaps | none — the release job refuses them |
| Hosted web | `app.t3.codes` router + `latest.app.t3.codes` | `nightly.app.t3.codes` only | skipped |
| AUR / marketing site | `publish_aur` / no marketing deploy | `publish_aur` / marketing staged + promoted | skipped |

From the runbook and `release.yml`. The default is deliberate: "The channel defaults to preview so an omitted selection cannot publish a stable release" ([`release.md:18`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L18)). Tag triggers explicitly exclude nightlies and previews (`release.yml:6`), and concurrency is split `release-stable` / `release-nightly` so a nightly can never drop a queued stable (`release.yml:34`).

Three consequences worth naming:

- **A stable release is a re-build of someone else's commit.** The maintainer verifies a nightly, then dispatches stable with no version; `resolve_commit` builds the latest published nightly's commit, so merges landing on `main` during verification never leak into the stable build ([release.md:23](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L23), `release.yml:80`).
- **There is no dry-run path.** Any accepted non-nightly tag, including `v0.0.0-test.1`, is classified as stable and publishes for real: GitHub Release, npm `latest`, hosted app aliases, and possibly a version-bump commit to `main`.
- **Beta is a label, not a channel.** It is not a version suffix and not a dist-tag; the stable desktop build literally sets `productName: "T3 Code (Beta)"` (`apps/desktop/package.json:43`). Removing the label is a branding change independent of the version.

## What reaches a machine, per path

| Dimension | curl-pipe installer | npm `t3` launcher | desktop app | Nix | build from source |
|---|---|---|---|---|---|
| Artifact | `scripts/install.sh` / `install.ps1` served at `t3.codes` | `t3` on npm, OIDC trusted publishing | DMG / NSIS / AppImage / `.deb` from GitHub Releases | `pkgs/by-name/t3/t3code` in nixpkgs | `git clone` + `vp run build:desktop` |
| Payload | CLI archive for the host target | downloads the same CLI archive on first run | server bundle in `resources/` (Windows: `server.asar`) | both `t3code-desktop` and `t3` | `node apps/server/dist/bin.mjs` |
| Verifies bytes | `SHA256SUMS` | `SHA256SUMS` | builder-time artifact invariants | nixpkgs hashes | n/a |
| Updates via | `t3 update` | `t3 update` / re-run npx | `electron-updater` (user-clicked) | `nix profile upgrade t3code` | `git pull` + rebuild |
| Arch coverage | per host | per host | see the target table | per nixpkgs | any |

The installer URLs are the marketing site's: `apps/marketing/scripts/stage-install-scripts.mjs:9` copies the two scripts into `public/` at build time, so `t3.codes/install.sh` is a Vercel-served copy rather than a redirect. The script itself fetches from GitHub — `base_url="${T3CODE_RELEASE_BASE_URL:-https://github.com/${repo}/releases/download}"` (`scripts/install.sh:21`) — resolves `stable` from `releases/latest` (`install.sh:157`) and nightly/preview by paging the releases API (`install.sh:160`), checks the archive against `SHA256SUMS` (`install.sh:203,212`), unpacks to `$T3CODE_HOME/runtime/versions/<version>` (`install.sh:186`), and symlinks `~/.local/bin/t3` (`install.sh:230`). Knobs are `T3CODE_CHANNEL`, `T3CODE_VERSION`, `T3CODE_HOME`, `T3CODE_INSTALL_BIN_DIR`, `T3CODE_RELEASE_BASE_URL` (`install.sh:8`).

Where package managers appear, they are downstream repackagers of the same artifacts, not a second build: winget (`T3Tools.T3Code`), Homebrew cask (`t3-code`), Scoop (`extras/t3code`), and nixpkgs. **Only AUR is packaged in this repo** (`packaging/aur`, two packages repackaging the x86_64 AppImage, `packaging/aur/README.md:3`); the others are maintained upstream and can trail the release. The `.deb` is the odd one: it self-updates through `electron-updater`, which installs with `dpkg`, so it needs a password prompt and fails if the desktop has none ([`install.md`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/user/install.md)).

## The server: archives, not packages

The server compiles to a Node single-executable and is attached to the Release as `t3-<version>-<platform>-<arch>.tar.gz` (`.zip` on Windows) with a top-level `SHA256SUMS`. The target list is fixed in code — `darwin-arm64 | linux-x64 | linux-arm64 | win32-x64 | win32-arm64` (`packages/shared/src/cliRelease.ts:13`, filename builder at `:40`) — and that archive "is the only form in which T3 Code manages a runtime": the desktop's SSH environments, the boot service, `t3 update`, and the install scripts all consume it ([`release.md:47-48`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L47-L48)). Nothing in the product installs from npm.

Three details define the shape:

- **No macOS x64 archive.** Node single-executables are unsupported on x64 macOS and the binary segfaults on start, so Intel Mac users run the Electron desktop app instead; the install doc tells them to build from source for a server there ([`install.md`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/user/install.md)).
- **Linux arm64 is a temporary special case.** The archive builds only on a Linux arm64 host and is injected with `postject`, because Node's `--build-sea` output cannot load on 16 or 64 KiB page kernels — to be reverted when [nodejs/node#67048](https://github.com/nodejs/node/issues/67048) is fixed ([`release.md:49`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L49)).
- **Runtimes are cached by version.** Installed runtimes live under `<T3 home>/runtime/versions/<version>`, so a runtime change needs a new T3 release version rather than a repack, and several versions can coexist (same paragraph).

Signing follows the payload: macOS archives get the Developer ID certificate and notarization when the Apple secrets are present, ad hoc otherwise — which still runs from a curl-and-tar install — and every native addon inside is signed, because the hardened runtime refuses unsigned libraries. Windows executables use the same Azure Trusted Signing setup as the installer ([`release.md:50`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L50)).

The npm side is deliberately thin: `scripts/npm-launcher/t3.mjs` downloads its exact version's archive, verifies it against `SHA256SUMS`, unpacks it, and execs (`t3.mjs:65,69,153`). The published tarball's manifest is generated by `scripts/build-npm-launcher.ts:34` with `bin` → `./bin/t3.mjs` (`:20,42`); the server's own `apps/server/package.json` is a different manifest for the same name, with `bin` → `./dist/bin.mjs` (`:10`). One package per release is published, by the `publish_cli` job, with npm OIDC trusted publishing (`id-token: write`, `--provenance`, dist-tag passed as `--tag`) — and it hard-fails if the trusted publisher is not registered for `.github/workflows/release.yml` (`release.yml:987,995,1016,1017`). There is no hand-publishing path.

The retired `@t3code/t3-<platform>-<arch>` optional dependencies are the informative part: npm's publish-time scanning held those 80–250 MB packages back for up to an hour after the launcher was already live, and every install in that window got a launcher with no executable. They remain on npm at old versions and receive no new ones ([`release.md:52`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L52)).

## Versioning: one number, four manifests

There is no changesets and no release-please. The root manifest is `private` with no version (`package.json:2`); a single script aligns exactly four manifests — `apps/server`, `apps/desktop`, `apps/web`, `packages/contracts` (`scripts/update-release-package-versions.ts:49`) — and every build job runs it before packaging (`release.yml:553`). At this commit all four read `0.1.5`.

| Question | Answer | Where |
|---|---|---|
| Who sets the number | `preflight`: tag or dispatch input for stable; derived base + stamp for nightly/preview | `release.yml:102,196-197` |
| Nightly base | committed desktop version, patch + 1 | `scripts/resolve-nightly-release.ts:88` |
| Nightly stamp | `<base>-<channel>.<date>.<runNumber>` | `resolve-nightly-release.ts:115` |
| Written back to `main` | stable only, as `chore(release): prepare $RELEASE_TAG` | `release.yml:1391` |
| Who can write it | a GitHub App (`RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY`) | `release.yml:1327` |

Desktop and server therefore carry the *same* number by construction, and the desktop does not fetch a server at runtime: the server bundle is copied into the app tree at `apps/server/dist` for non-Windows targets (`scripts/build-desktop-artifact.ts:3755`, gate at `:3730`), or into `resources/server.asar` on Windows (`:3141`). At launch the desktop re-enters its own binary as Node — `path.join(serverRoot, "apps/server/dist/bin.mjs")` (`apps/desktop/src/app/DesktopEnvironment.ts:211`) spawned with `ELECTRON_RUN_AS_NODE=1` (`apps/desktop/src/backend/DesktopBackendConfiguration.ts:522,534`). Remote servers are then pinned to the client's exact version ("Connected servers update to the client's exact version, not to an npm dist-tag", [`release.md:427`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L427)); a server updates by downloading that version's archive (`apps/server/src/cli/update.ts`) or is handed `t3 update <client-version>` when it runs from npm ([`updating.md`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/user/updating.md)).

## The desktop app: one bundle, six packages

`build_bundle` builds the platform-independent JavaScript once — server bundle, web client, Electron main — and hands it to every platform job as the `js-bundle` artifact; platform jobs only package it, so no runner rebuilds the JS ([`release.md:33`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L33)). Six jobs then call `release-desktop.yml`, one artifact each, gated only on that bundle (`release.yml:591,615,641,667,695,719`).

| Dimension | macOS arm64 | macOS x64 | Linux x64 | Linux arm64 | Windows x64 | Windows arm64 |
|---|---|---|---|---|---|---|
| Installer | DMG + zip | DMG + zip | AppImage + `.deb` | AppImage + `.deb` | NSIS `.exe` | NSIS `.exe` |
| Builder | electron-builder on arm64 macOS | electron-builder on Intel macOS | one electron-builder run per arch | one electron-builder run per arch | packaged and jsign-signed on a **Linux** runner | same |
| Signing | Developer ID + notarization | Developer ID + notarization | none | none | Azure Trusted Signing | Azure Trusted Signing |
| Update payload | zip (Squirrel.Mac) | zip | AppImage / `.deb` via `dpkg` | same | NSIS differential | NSIS differential |
| Verified by | smoke opens the DMG | no launch check | smoke opens the AppImage under Xvfb | native run | `windows-2025` runner | `windows-11-arm` runner |

Packaging is a repo script, not a checked-in builder config: `scripts/build-desktop-artifact.ts` assembles the config and shells out to electron-builder 26.16.1 (`apps/desktop/package.json:39`) with `--projectDir <stage> --<platform> --<arch> --publish never` (`:4007,4018`). Because of `--publish never`, electron-builder only *writes* installers and updater manifests; uploading is the `release` job's work (`release.yml:939`). Identity is fixed — `appId: com.t3tools.t3code` (`:65`), artifact template `T3-Code-${version}-${arch}.${ext}` (`:2776`) — and the product name changes per channel: `T3 Code (Beta)` for stable (`apps/desktop/package.json:43`), `T3 Code (Nightly)` for nightly (`:2751`).

Signing is optional and auto-detected per platform from secrets, so a fork or a maintainer without certificates still produces a release — unsigned, not blocked. macOS uses `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `MACOS_PROVISIONING_PROFILE` plus the `APPLE_TEAM_ID` variable, signing through a custom hook (`scripts/sign-macos.ts:3`, wrapping `@electron/osx-sign`, wired at `build-desktop-artifact.ts:2858`) with entitlements and the provisioning profile at `:2861`. Notarization rides electron-builder's env-driven default off the `APPLE_API_KEY*` trio. Windows needs seven Azure values and signs through jsign 7.6 off-Windows (`build-desktop-artifact.ts:2950`), covering `.node` and `.dll` as well as the installer (`:2944`); `CSC_LINK` is deleted before Windows builds so the macOS certificate is never read as a Windows one (`:3974`).

**The Windows payload is its own sub-project.** The server lives in `resources/server.asar` with native modules and helper executables present at matching paths under `resources/server.asar.unpacked`; unpacked files are capped at 80, because whole-package smart unpacking slows NSIS installs and counts against the payload limit. Windows builds also carry `resources/wsl-runtime.tar.gz` plus a SHA-256 sidecar — the *same-arch Linux CLI archive*, handed over as `--wsl-runtime` and copied verbatim, so WSL runs exactly the bytes a Linux user downloads, extracted once to `~/.t3/wsl-runtime/sha256-<digest>` (`release-desktop.yml:508`, `build-desktop-artifact.ts:3949`). The builder rejects the artifact when any invariant breaks: missing `server.asar`, an unpacked file absent from disk, a same-arch primary that cannot load the native library through its `.unpacked` sibling, an extracted sidecar that cannot load the server entry with plain Node, a WSL archive whose digest mismatches or that carries a loose `bin.mjs`, a missing resource monitor, or more than 80 unpacked files.

**Gates before publish** are smoke tests on real packaged artifacts, not unit tests. The CLI archive is extracted and executed on hardware of its own architecture (`release-desktop.yml:432`), the packaged Linux AppImage and macOS arm64 DMG are opened against a *seeded, deliberately old* database and must open a thread (`release-desktop.yml:633`), and the Windows natives plus the archive are re-verified on real Windows runners (`release-desktop.yml:779,793`). The old fixture is the point: it forces the packaged server to migrate a real user's database forward on every release, and the runbook forbids regenerating it on schema changes. Prereleases are flipped public only after every asset is attached, because desktop clients read the release directly (`release.yml:975`).

## Auto-update

| Piece | Where | Behaviour |
|---|---|---|
| Channel decision | `scripts/build-desktop-artifact.ts:2708` | `latest` unless the version matches `/-nightly\.\d{8}\.\d+$/` |
| Preview | `build-desktop-artifact.ts:2803,2712` | `publish = null`; `release.yml:831` refuses to publish manifests on a preview |
| Feed | `build-desktop-artifact.ts:2686,2700` | `provider: github`, `T3CODE_DESKTOP_UPDATE_REPOSITORY` else `GITHUB_REPOSITORY`; baked into `app-update.yml` |
| Runtime | `apps/desktop/src/updates/DesktopUpdates.ts` | `electron-updater` 6.8.9 behind an Effect wrapper (`electron/ElectronUpdater.ts:7,87`) |
| Polling | `DesktopUpdates.ts:56,57,842` | 15 s startup delay, then every 4 minutes |
| Download | `DesktopUpdates.ts:1101` | `setAutoDownload(false)`, `setAutoInstallOnAppQuit(false)` |
| Install | `DesktopUpdates.ts:781` | `quitAndInstall({ isForceRunAfter: true })` on a second click |
| `.deb` | `DesktopUpdates.ts:422` | detected by reading `resources/package-type` |
| No feed | `DesktopUpdates.ts:327` | "Automatic updates are not available because no update feed is configured." |

Two invariants keep this sane. **Downloads never downgrade**: `allowDowngrade` is forced false outside a guarded track switch, and switching tracks sets a release floor so nothing older than the release whose migrations the switch cleared is ever offered (`DesktopUpdates.ts:365,369,484,1160`). **Compatibility is enforced by the protocol, not by a minimum-version gate**: a newer app refuses to connect to an older server and vice versa ([`updating.md:89-90`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/user/updating.md#L89-L90)), so a stale host blocks its own session instead of corrupting state. A failed install is remembered and not retried automatically (`DesktopUpdates.ts:44`).

The macOS and Windows manifests need one more step because each platform builds per arch: the arm64 and x64 mac manifests are merged into one channel manifest (`release.yml:847`), and Windows copies are suffixed `-win-<arch>.yml` and merged (`release.yml:859`). Without that merge, one architecture would never see the update.

## The release job graph

```text
release.yml
├── resolve_commit ──┬── preflight ──┬── quality
│                    │               ├── test
│                    │               ├── test_web
│                    │               └── test_server  (8 shards)
│                    └── relay_public_config   (relay URL + Clerk config, read
│                                               from the "production" env)
├── build_bundle  (server bundle + web client + Electron main, once)
│   ├── desktop job: macOS arm64   ──▶ DMG/zip + t3 darwin-arm64 archive
│   ├── desktop job: macOS x64     ──▶ DMG/zip, no CLI archive
│   ├── desktop job: Linux x64     ──▶ AppImage/.deb + t3 linux-x64  ─┐
│   ├── desktop job: Linux arm64   ──▶ AppImage/.deb + t3 linux-arm64 │ WSL runtime
│   ├── desktop job: Windows x64   ──▶ NSIS ──────────────────────────┘ (same arch)
│   └── desktop job: Windows arm64 ──▶ NSIS
├── release      (one GitHub Release, all assets, notes via gpt-6.1-terra)
│   ├── publish_cli    (npm t3 launcher, OIDC)
│   ├── publish_aur    (skipped for preview)
│   ├── build_web ──▶ deploy_web   (needs build_web + release + publish_cli)
│   ├── build_marketing ──▶ deploy_marketing   (nightly only)
│   ├── finalize       (stable only: commit the version bump to main)
│   └── announce_discord
```

Job names and anchors are from `release.yml`: `resolve_commit:51`, `preflight:102`, `quality:232`, `test:264`, `test_web:300`, `test_server:354`, `relay_public_config:388`, `build_bundle:498`, six desktop jobs `591–719`, `release:743`, `publish_cli:987`, `publish_aur:1021`, `build_web:1037`, `deploy_web:1138`, `build_marketing:1210`, `deploy_marketing:1277`, `finalize:1320`, `announce_discord:1394`. Concurrency is `release-<stable|nightly>` (`:34`), and the `release` job's long `if:` waits on every desktop job plus the three test jobs and `quality` (`:745`). `SHA256SUMS` is written from the final asset bytes at `:813`, so it describes what actually shipped.

The ordering is load-bearing, not incidental: **Release → npm launcher → hosted web** (`deploy_web` needs both `release` and `publish_cli`, `:1140`). Connected servers update to the client's *exact* version; a server that updates itself downloads that version's CLI archive from the GitHub Release, and an npm-run server is handed a `t3@<version>` command. Publishing a client first would leave "Update server" pointing at a version that does not exist yet. Desktop auto-update reads the GitHub Release directly, so a desktop user can see a new version minutes before `t3@` lands on npm — fine, because only the manual npm command depends on npm.

Release notes are generated: a computed header with commit counts, a short summary from `gpt-6.1-terra` (needs `OPENAI_API_KEY`), and GitHub's list folded under `<details>`; the desktop update popover shows the summary paragraph. Notes compare against the previous tag *in the same channel*, so stable never diffs against a nightly.

## The rest of the fleet

| Thing | Hosting | How it deploys | Versioned with clients? |
|---|---|---|---|
| T3 Connect relay | Cloudflare Worker + PlanetScale Postgres (via Hyperdrive) + Axiom + R2, provisioned by Alchemy | `deploy-relay.yml` deploys stage `prod` on every push to `main`; PRs get ephemeral `pr-<n>` stages behind a `relay:preview` label | No — separately, but all channels must point at one relay |
| Hosted web app | Vercel | staged `vercel deploy --prod --skip-domain` during desktop builds, aliased after `release` + `publish_cli` | Yes, same commit |
| Marketing site | Vercel (`t3code-marketing`) | nightly only: staged build, then `vercel promote` after publish; also serves the install scripts | No (that nightly's commit) |
| Mobile | EAS + `expo-updates` | push to `main` publishes production-channel OTAs and iOS `testflight` builds; production via dispatch | Loosely — fingerprint-separated OTAs per major |
| Android beta APK | GitHub prereleases | hourly Play Alpha check publishes `android-beta-<n>` when a new beta appears | No |

The relay is the surprise: a control plane deployed on **every push to `main`**, independent of client releases, and explicitly *off* the data path — "intentionally not in the hot path for normal T3 Code traffic" (`infra/relay/README.md:10`). It provisions environments, short-lived connect credentials, device registration, and push (`README.md:6,17`), and the release workflow reads its URL and Clerk configuration from the `production` environment *before* packaging desktop, CLI, or web artifacts. That is why all channels must share one relay — otherwise a user switching channels loses their linked environments ([`release.md:187`](https://github.com/pingdotgg/t3code/blob/32ecd71726fee16f335484c1f95cbce126d461f6/docs/operations/release.md#L105)).

Hosted web is deliberately not deployed by Vercel's Git integration: `apps/web/vercel.ts:29` sets `git.deploymentEnabled: false`, the release workflow deploys with `--skip-domain` (`release.yml:1090`), and only later aliases `latest.app.t3.codes` / `nightly.app.t3.codes` — plus `app.t3.codes` for stable (`release.yml:1161,1178`). The router is a cookie: `/__t3code/channel` writes `t3code_web_channel` and host rewrites route `app.t3.codes` to the chosen channel origin (`apps/web/vercel.ts:34,55,59`). Web PR previews exist too, for `preview:web`-labeled same-repo PRs, deployed unaliased (`web-preview.yml`).

Mobile is EAS with profiles `development | preview | preview:dev | testflight | production` (`apps/mobile/eas.json:14,34,48,72`), `appVersionSource: "remote"` (`:4`), production `autoIncrement` (`:74`), submit to App Store Connect app `6787819824` and Play's `internal` track (`:86,89`). OTA is `eas update --channel production` (`mobile-eas-production.yml:325`); TestFlight builds pin version `3.0.0` (`eas.json:62`) while the store version stays committed.

## Pull-request previews

Labeling a PR `preview:mac` produces a signed, notarized Apple Silicon DMG on a rolling `desktop-preview` prerelease. The interesting part is how the Developer ID certificate is kept away from PR code: two workflows split the job.

1. `desktop-macos-preview.yml` runs on `pull_request` with **no secrets** and builds only the JS bundle (`:3,32`) — the same `js-bundle` artifact the release produces.
2. `desktop-macos-preview-publish.yml` runs on `workflow_run` from `main`, and refuses unless the PR is open, still labeled, its head is the built commit, and the author is a bot, a collaborator, or listed in `.github/VOUCHED.td` (read from the default branch, so a PR cannot vouch for itself). It then packages through `release-desktop.yml` **checked out at `main`**, so packaging, native helpers, and desktop dependencies come from `main` rather than the PR; only the version (`<committed version>-pr.<PR>.<run>`, `:226`) and public T3 Connect identifiers are read from the PR commit, as data. The ZIP entry list is validated (regular files under `server/dist` and `desktop/dist-electron` only) before the bundle reaches the signing runner, and a `pull_request_target` cleanup job removes the download when the PR closes or the label is dropped.

The voucher file is the trust anchor: vouching a contributor lets their labeled commits be signed, and it is not a standing grant. A PR that changes *packaging* cannot use this path at all and must go through the `channel=preview` release train. Those builds carry no update feed (`build-desktop-artifact.ts:2804`).

## Gotchas

| Trap | Why it bites |
|---|---|
| Tagging to "test" the workflow | Any `v*` tag ships stable for real; there is no dry-run mode |
| Bumping a runtime without a version | Runtimes are cached per version; the change never reaches existing installs |
| Publishing the client before its archives | Desktop reads GitHub, servers read the Release, web aliases last |
| Regenerating the desktop smoke fixture | The old DB snapshot is the migration test; regenerating it hides forward-migration breakage |
| Adding loose files to the Windows payload | NSIS install cost and the 80-unpacked-file cap both gate the build |
| Assuming preview is safe to hand out | No manifests, no default dist-tag, `publish = null`, warning-named release |
| Expecting a macOS x64 CLI | No SEA support there; the desktop app is the supported Intel path |
| Pointing a channel at its own relay | Environments would split by channel; all channels share one relay |
| Expecting electron-builder to upload | It runs `--publish never`; the release job is the publisher |

## Open Questions

- **Who bumps the out-of-repo manifests?** Homebrew cask, winget, Scoop and nixpkgs are documented user channels but maintained outside this repo; how far each trails a release is unmeasured. Probe: `gh api repos/Homebrew/homebrew-cask/contents/Casks/t/t3-code.rb`.
- **Is the npm trusted publisher live, and what do the dist-tags point at now?** The repo only proves the workflow side. Probe: `npm view t3 version dist-tags`.
- **Why did a registry read of `t3@latest` report ~101 MB across 815 files?** That is more payload than a launcher implies, and the read may have been stale. Probe: `npm pack t3@<version>` and list the tarball.
- **Where is notarization actually wired?** No `notarize` key exists in the generated build config, so it depends on electron-builder's env-driven default plus the `APPLE_API_KEY*` trio. Probe: a signed build log with `electron-notarize*` debug output (`build-desktop-artifact.ts:3999`).
- **Who consumes the `resource-monitor-<key>` artifacts?** They are built (`release-desktop.yml:757`) but not attached to the Release. Probe: `grep -rn "resource-monitor-" .github/workflows`.
- **How does an old client talk to a newer relay?** The relay deploys on every merge and is versioned independently; the compatibility contract lives in `infra/relay` and was not read.

## Related

- [T3 Code — Server, Desktop, Web, and Mobile Architecture](./t3-code-client-server-architecture.md) — the runtime shape this distribution serves: one server, Electron serving the web build, a remote-only mobile client.
- [T3 Code — Context Handoff When Switching CLI Providers](./t3-code-provider-switch-context-handoff.md) — the same project, focused on agent-side state rather than artifacts.
- [Pi Durable on Cloudflare Workers & Durable Objects](./pi-durable-cloudflare-workers-durable-objects.md) — a contrasting approach: no native payload, the agent runs in the platform.

## Changelog

- 2026-10-30 — created, then re-pinned the same day. First pass cited the docs at `33806e7355…`; a delegated source crawl refreshed `main` to `32ecd71726fee16f335484c1f95cbce126d461f6` and this file now cites that commit throughout. The crawl added the version-alignment mechanism (four manifests, no changesets), electron-builder's `--publish never` split from the upload job, the concrete update gating (`setAutoDownload(false)`, release floor, protocol mismatch), the in-repo-only AUR packaging, and the Docker negative result. It also removed a claimed "newest release" version string, which came from a stale API read.
- 2026-10-30 — anchor pass. Doc line numbers were re-checked against the checkout at the pinned commit rather than the moving `main` URL (TinyFish returned 503 during that check, so the pinned tree was the source of truth); four doc pointers were off and are corrected, and two claims are now anchored to `release.yml` instead of prose.
