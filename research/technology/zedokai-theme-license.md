---
title: Zedokai Theme — What Zed's Extension Registry Says About Its License
category: technology
tags: [zed, theme, zedokai, license, extensions-registry, monokai-pro, mit]
status: complete
created: 2026-11-13
updated: 2026-11-14
sources:
  - https://github.com/zed-industries/extensions
  - https://raw.githubusercontent.com/zed-industries/extensions/main/extensions.toml
  - https://api.github.com/repos/zed-industries/extensions/contents/extensions/zedokai
  - https://raw.githubusercontent.com/slymax/zedokai/b4c5a0b8b66f1889bd1eabafe5e984372ebff7a5/extension.toml
  - https://zed.dev/docs/extensions/publishing/license-requirements
  - https://zed.dev/docs/extensions/publishing/prerequisites
  - https://raw.githubusercontent.com/zed-industries/extensions/main/CONTRIBUTING.md
  - https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/license.js
  - https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/validation.js
  - https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/fs.js
  - https://raw.githubusercontent.com/zed-industries/extensions/main/src/package-extensions.js
  - https://raw.githubusercontent.com/zed-industries/extensions/main/.github/workflows/ci.yml
  - https://api.github.com/repos/zed-industries/zed/contents/
  - https://monokai.pro/license
  - https://raw.githubusercontent.com/monokai-pro/community-edition/main/LICENSE.md
confidence: high
---

# Zedokai Theme — What Zed's Extension Registry Says About Its License

## Summary

Checked from Zed's side this time, not the author's. Zed runs an official registry —
[zed-industries/extensions](https://github.com/zed-industries/extensions) — that every
marketplace extension enters as a **git submodule pinned to one commit**, and since
2025-10-01 that registry **refuses to package an extension without an accepted license**
([license requirements](https://zed.dev/docs/extensions/publishing/license-requirements)).
Zedokai is in that registry, pinned at
`b4c5a0b8b66f1889bd1eabafe5e984372ebff7a5`
([registry entry](https://api.github.com/repos/zed-industries/extensions/contents/extensions/zedokai)).

The finding that matters: **at the pinned commit, Zedokai still has no license file.**
Zed's own license check — `validateLicense()` in
[validation.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/validation.js),
called from [package-extensions.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/package-extensions.js)
— would throw "No license was found." on this submodule. The extension still installs, which
locates the gap precisely: **the check is diff-scoped.** CI packages only the extensions a PR
changes (`changedExtensionIds()`) or, on `main`, only those with no published version yet
(`unpublishedExtensionIds()`). Zedokai's last release predates the rule, so nothing re-runs
the check against it.

The practical consequence is unchanged from the author's side of the question, and now
sharper: the extension is installed from the Zed marketplace, and **Zed grants you nothing**
by listing it. Distributed binaries built from that commit are distributed without a license
on the source, which is the registry's problem to eventually catch, not a grant to you.

## The chain, from Zed's repository outward

```text
zed-industries/extensions
├── extensions.toml                    registry index: [zedokai] version = "1.2.2"
├── .gitmodules                        extensions/zedokai → https://github.com/slymax/zedokai.git
├── extensions/zedokai                 gitlink @ b4c5a0b8b66f1889bd1eabafe5e984372ebff7a5
└── src/
    ├── package-extensions.js          picks extensionIds, then per ID:
    │   ├── checkoutGitSubmodule()     checks out the pinned commit
    │   ├── retrieveLicenseCandidates()  readdir(extensionPath), names starting LICENSE/LICENCE
    │   └── validateLicense()          none found → throw "No license was found."
    └── lib/
        ├── fs.js                      retrieveLicenseCandidates (top level of the submodule only)
        ├── license.js                 MIT / Apache-2.0 / BSD-2 / BSD-3 / CC-BY-4.0 / GPLv3 / LGPLv3 / zlib / Unlicense matchers
        └── validation.js              LICENSE_REQUIREMENT_TEXT + the throw
```

Note what `retrieveLicenseCandidates()` does: `fs.readdir(extensionPath)`, non-recursive, on
the submodule root ([fs.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/fs.js)).
A license in `themes/` or `src/` does not count, matching the docs' "should be at the root of
your extension".

## What the pinned commit contains

Tree of `b4c5a0b8b66f1889bd1eabafe5e984372ebff7a5` from the GitHub trees API:

```text
.gitignore  extension.toml  readme.md  screenshot.png  themes/zedokai.json
```

Five files, no license among them. `extension.toml` at that commit carries `id`, `name`,
`version = "1.2.2"`, `schema_version = 1`, `authors = ["slymax"]`, `repository` and
`description` — **no `license` field**, which the schema does not require and the registry
does not read. The registry only looks at filenames.

## The rule Zed states, and the check it actually runs

| Where | Says | Enforced how |
|---|---|---|
| [Publishing prerequisites](https://zed.dev/docs/extensions/publishing/prerequisites) | "License your extension under one of the allowed licenses." | Reviewer + CI |
| [License requirements](https://zed.dev/docs/extensions/publishing/license-requirements) | As of 2025-10-01 the repo must include a license; "Without a valid license, the pull request to add or update your extension will fail CI." | `validateLicense()` in the packaging job |
| [CONTRIBUTING.md](https://raw.githubusercontent.com/zed-industries/extensions/main/CONTRIBUTING.md) | "Your extension repository must include an accepted license." | same |
| Accepted set, from [license.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/license.js) | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC-BY-4.0, GPLv3, LGPLv3, zlib, Unlicense | text patterns matched on normalized whitespace |

Two details worth pinning down:

- **The check is text matching, not SPDX.** `isMitLicense()` requires the literal phrases
  "Permission is hereby granted, free of charge, to any person obtaining a copy", the
  "above copyright notice" sentence, and the "AS IS" disclaimer. A short "MIT licensed" line
  in a README is not a license file and would fail.
- **The check is diff-scoped by design.** [package-extensions.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/package-extensions.js)
  computes `extensionIds` from `changedExtensionIds()` on a PR and `unpublishedExtensionIds()`
  on `main`. The only grandfather list in
  [validation.js](https://raw.githubusercontent.com/zed-industries/extensions/main/src/lib/validation.js)
  is `EXTENSION_VERSION_EXCEPTIONS = new Map([["platformio", "v0.0.1"]])` — for version
  format, not licensing. Zedokai is not on it, because it does not need to be: it is not
  rebuilt unless someone submits a change.

So the answer to "does Zed consider Zedokai licensed" is **no, and Zed has not looked.** The
next PR that touches `[zedokai]` in `extensions.toml` — a version bump, an update — runs the
check on the checked-out submodule and fails until slymax adds a `LICENSE` at the repository
root.

## Zed's own licensing, for contrast

The editor repository is `LICENSE-APACHE` plus `LICENSE-GPL` at its root
([zed repo contents](https://api.github.com/repos/zed-industries/zed/contents/)) — a dual
grant, with the GPL side covering the parts not moved to Apache. Nothing about the editor's
license reaches into `zed-industries/extensions`: that repo contains registry tooling, and the
extension code lives in each author's own submodule, under that author's license or none.

## What this changes for a user

| Intent | Verdict | Zed-side reason |
|---|---|---|
| Install Zedokai from the extensions list | Fine | Zed builds the binary from the pinned submodule and hands it to you; that is what the marketplace is |
| Treat the listing as an open-source signal | Wrong | Zed does not attest the submodule's license at listing time; it only checks on new or updated versions |
| Fork, vendor, or republish `themes/zedokai.json` | No grant | The submodule is unlicensed; nothing in the registry transfers rights to you |
| Submit an update to `[zedokai]` as an outside contributor | Will fail CI | `validateLicense()` runs on the checked-out submodule and finds no license |
| Build an equivalent Monokai Pro look yourself | Fine | Monokai's [CE LICENSE.md](https://raw.githubusercontent.com/monokai-pro/community-edition/main/LICENSE.md) is MIT, with the CE conditions |

The registry check also explains a shape the earlier read missed: an extension can be
marketplace-listed, unlicensed, and compliant *by inaction*. The rule is real but it is a
gate on pushes, not a state machine over the catalog.

## Shipping it in your own app

The question that follows from everything above: **you cannot bundle Zedokai's files.**
Bundling `themes/zedokai.json` — or a recolored copy of it — into your app's repo or
release is reproduction of an unlicensed work, and the Zed registry listing is not a grant
to you (it is Zed's build input, not a licence). slymax has published nothing that says
otherwise, and the pinned commit has no licence file.

There are four routes, in order of how clean they are:

| Route | What it requires | Works if you are… |
|---|---|---|
| Get a grant from slymax | A message asking for MIT (or a specific licence) on `themes/zedokai.json`; only the copyright holder can give it | Any app, once granted — get it in writing (an issue comment or commit) |
| Rebuild the palette from Monokai Pro (CE) | The CE colour files are MIT ([LICENSE.md](https://raw.githubusercontent.com/monokai-pro/community-edition/main/LICENSE.md)); you write your own theme file from those hex values | Free, non-commercial, open source, default filter only, named "Monokai Pro (CE)", no official Monokai Pro theme for your app |
| Ship your own palette inspired by it | Nothing but your own design work — colours as such are facts, not a protected work | Any app, commercial included, but it is no longer Monokai's look |
| Ship nothing and let the user install the extension | The user installs Zedokai themselves; your app only reads the resulting config | Any app, but only where a user-side install is the normal path |

Two of those routes collide with a commercial product. Monokai's CE [contribute page](https://monokai.pro/contribute)
makes the CE free, non-commercial and open source as conditions 3 and 4, and forbids
anything but the default filter — so a paid or closed-source app cannot take the CE route,
and Zedokai's published variants (Machine, Octagon, Spectrum, Darkest) are exactly the
non-default filters. Note the tension: the CE `LICENSE.md` is plain MIT, which *does* permit
commercial use; Monokai's own conditions page restricts it. Treat the stricter reading as
the operating rule and get written permission if the product matters.

Against Zedokai specifically, a fifth consideration applies even after a grant: the theme is
a derivative of Monokai Pro's scheme by its author's own description, so slymax's permission
cannot supply Monokai's. Both layers need clearing, or neither is safe.

The one-line version: **a Monokai look is legally obtainable; the Zedokai artifact is not,**
and a commercial app should plan on the third route — its own palette — unless it can get
written permission from both slymax and Monokai.
## Gotchas

- **`license` in `extension.toml` means nothing to Zed.** The registry never reads it;
  only the filename scan counts.
- **Nested licenses do not count.** `retrieveLicenseCandidates()` reads the submodule root
  only, so a `LICENSE` inside `themes/` would pass a human review and fail the build.
- **`extensions.toml` is generated order, not judgment.** CI enforces sorted
  `extensions.toml` and `.gitmodules`; the presence of `[zedokai]` records that a PR was
  accepted, not that licensing was verified then.
- **Pinning is the citation.** Citing `main` on `slymax/zedokai` would drift; the registry's
  gitlink SHA `b4c5a0b8b66f1889bd1eabafe5e984372ebff7a5` is the artifact Zed actually builds.
- **The Monokai layer is unchanged by any of this.** The palette obligation is still
  Monokai's CE conditions, and Zedokai's published variants are the non-default filters.

## Changelog

- 2026-11-14 - added the shipping decision: bundling the JSON is reproduction of an unlicensed work, the four admissible routes (grant from slymax, MIT CE rebuild, own palette, user-side install), and why the CE route excludes a paid or closed-source app.
- 2026-11-14 — rechecked from Zed's side: registry entry, pinned submodule SHA, the license
  check's source and its diff-scoped call path, and Zed's own license files. Adds the
  finding that the check would fail on Zedokai's pinned commit and that it never runs there.
- 2026-11-13 — created from the author's repository and Monokai's license pages.
