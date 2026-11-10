---
title: Syncing File Changes to a Remote SSH Host — Approaches Compared
category: technology
tags: [ssh, rsync, lsyncd, syncthing, mutagen, unison, inotify, entr, file-sync]
status: complete
created: 2026-10-11
updated: 2026-10-11
sources:
  - https://lsyncd.github.io/lsyncd/
  - https://github.com/lsyncd/lsyncd
  - https://mutagen.io/documentation/introduction/
  - https://mutagen.io/documentation/synchronization/
  - https://mutagen.io/documentation/transports/ssh/
  - https://syncthing.net/
  - https://docs.syncthing.net/users/faq.html
  - https://forum.syncthing.net/t/how-to-perform-simple-scanning-of-files-instead-of-a-full-scan/25323
  - https://github.com/eradman/entr
  - https://github.com/emcrisostomo/fswatch
  - https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/
  - https://facebook.github.io/watchman/
  - https://www.cis.upenn.edu/~bcpierce/unison/
  - https://en.wikipedia.org/wiki/Unison_(software)
  - https://man7.org/linux/man-pages/man1/sshfs.1.html
confidence: high
---

# Syncing File Changes to a Remote SSH Host — Approaches Compared

## TL;DR

- **Yes — three families fit "whenever a file changes".** (a) A local watcher pushes over SSH (`lsyncd`; or `inotifywait`/`entr`/`fswatch` piped into `rsync`); (b) a two-way sync daemon (`Mutagen`, `Syncthing`, `Unison`); (c) no sync at all — mount the remote tree (`sshfs`) or edit in place over SSH.
- **Pick by direction, not by speed.** One-way "secure → less-secure" mirroring is `lsyncd`'s stated design point; it watches with inotify/fsevents, collates events for a few seconds, and spawns rsync ([manual](https://lsyncd.github.io/lsyncd/)). A local→remote *code editing* loop is Mutagen's niche (rsync-like deltas + fs watching, injects its agent via `scp`, no remote install ([docs](https://mutagen.io/documentation/introduction/))). Two sides changing *independently* needs Syncthing or Unison.
- **Watch-based is not instantaneous, and events are not authoritative.** `lsyncd` batches for seconds ([manual](https://lsyncd.github.io/lsyncd/)); Syncthing pairs fs events with a **full rescan every 3600 s by default** ([forum](https://forum.syncthing.net/t/how-to-perform-simple-scanning-of-files-instead-of-a-full-scan/25323)). Design the remote side to tolerate both a lag and a missed delta.
- **SSH-only server narrows the field.** Syncthing speaks its own TLS protocol, not SSH ([syncthing.net](https://syncthing.net/)) — it fits only where you can run a daemon and open a non-SSH port. `Mutagen`, `Unison`, `lsyncd`, and plain `rsync`+`inotify` all ride SSH.

## Context

Question asked in this repo (2026-10-11): *"sync every file change on a remote SSH machine whenever they change — any approaches?"* Repo grep on 2026-10-11 found no prior file-sync coverage; the adjacent topic [Watching File Changes on S3](./s3-file-change-detection.md) covers the cloud-storage side of the same question.

## Findings

### 1. The landscape — three families

| Family | Mechanism | Answer to "whenever they change" |
|---|---|---|
| Watch → push (one-way) | Kernel fs events (inotify, kqueue, FSEvents, fanotify, ReadDirectoryChangesW) trigger rsync/scp over SSH | Yes — event-driven, seconds-scale |
| Continuous two-way sync | Both ends run an agent; three-way merge reconciles changes each cycle | Yes — event-driven both directions |
| No sync | Mount remote dir (sshfs/SFTP) or run the editor on the remote host | N/A — there is one copy of the data |

### 2. Wide comparison

| | lsyncd | inotify-tools + rsync | entr + rsync | Mutagen | Syncthing | Unison | sshfs |
|---|---|---|---|---|---|---|---|
| **What it is** | Live mirror daemon; rsync is default action ([manual](https://lsyncd.github.io/lsyncd/)) | DIY loop wrapping a watcher and rsync | Runs arbitrary commands on change ([README](https://github.com/eradman/entr)) | Dev-focused sync + net forwarding daemon ([docs](https://mutagen.io/documentation/introduction/)) | Continuous file sync program ([site](https://syncthing.net/)) | Two-replica synchronizer, conflict-aware ([site](https://www.cis.upenn.edu/~bcpierce/unison/)) | SFTP filesystem client over SSH ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)) |
| **Watch API** | inotify / fsevents ([manual](https://lsyncd.github.io/lsyncd/)) | inotify ([guide](https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/)) | kqueue(2) / inotify(7) ([README](https://github.com/eradman/entr)) | fs watching + per-cycle scan ([synchronization docs](https://mutagen.io/documentation/synchronization/)) | fs events + full rescan fallback ([FAQ](https://docs.syncthing.net/users/faq.html)) | None — reconciles when run (cron/manual) | None — each op crosses the wire |
| **Transport** | rsync, or rsync+ssh (moves applied remotely) ([manual](https://lsyncd.github.io/lsyncd/)) | rsync over ssh | whatever command you pipe to | ssh (or docker exec) `[user@]host[:port]:path` ([transport docs](https://mutagen.io/documentation/transports/ssh/)) | own TLS protocol — **not SSH** ([site](https://syncthing.net/)) | socket or ssh tunnel ([site](https://www.cis.upenn.edu/~bcpierce/unison/)) | SFTP subsystem ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)) |
| **Direction** | One-way | One-way | One-way | One- or two-way (4 modes) ([synchronization docs](https://mutagen.io/documentation/synchronization/)) | Multi-device, many-to-many ([FAQ](https://docs.syncthing.net/users/faq.html)) | Two-way, conflicts displayed ([site](https://www.cis.upenn.edu/~bcpierce/unison/)) | Live view, no copy |
| **Propagation** | Events collated "for several seconds", then rsync spawns ([manual](https://lsyncd.github.io/lsyncd/)) | One rsync per event batch (loop-dependent) | One command per changed file ([README](https://github.com/eradman/entr)) | Per-change sync cycle, "imperceptibly fast for most content" ([synchronization docs](https://mutagen.io/documentation/synchronization/)) | Real-time when both ends online; 3600 s rescan catches missed events ([forum](https://forum.syncthing.net/t/how-to-perform-simple-scanning-of-files-instead-of-a-full-scan/25323)) | Only when invoked | Per-operation, no batching |
| **Remote-side setup** | rsync ≥ 3.1 on both ends ([manual](https://lsyncd.github.io/lsyncd/)) | rsync + sshd | rsync + sshd | Nothing — agent injected via scp ([introduction](https://mutagen.io/documentation/introduction/)) | Runs on both ends ([FAQ](https://docs.syncthing.net/users/faq.html)) | unison binary on both ends ([site](https://www.cis.upenn.edu/~bcpierce/unison/)) | "nothing to do on the server-side" ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)) |
| **Platforms** | Linux, macOS (inotify/fsevents) ([manual](https://lsyncd.github.io/lsyncd/)) | Linux | macOS, \*BSD, Linux; WSL/Docker need `ENTR_INOTIFY_WORKAROUND` ([README](https://github.com/eradman/entr)) | POSIX + Windows ([ssh transport](https://mutagen.io/documentation/transports/ssh/)) | macOS/Windows/Linux/FreeBSD/Solaris/OpenBSD ([site](https://syncthing.net/)) | Windows + Unix ([site](https://www.cis.upenn.edu/~bcpierce/unison/)) | wherever FUSE exists |
| **Remote copy at rest** | Mirror via rsync | Mirror via rsync | Whatever the command does | Mirror (staged deltas) | Replica per device | Two replicas | None — it is a mount |

### 3. lsyncd — the purpose-built one-way mirror

- Watches with inotify (Linux) or fsevents (macOS), collates events, then spawns rsync so local tree "does not hamper local filesystem performance"; needs rsync ≥ 3.1 on both machines; GPLv2+; config is Lua ([manual](https://lsyncd.github.io/lsyncd/)).
- Plain rsync re-sends a moved file wholesale; the rsync+ssh action makes the move happen on the target instead of re-transmitting ([manual](https://lsyncd.github.io/lsyncd/)).
- **Maintenance risk:** the upstream repo banner reads "Needs new maintainer. Up for adoption" ([README](https://github.com/lsyncd/lsyncd)) — weigh this before adopting.
- **Two-way is out of scope.** The README documents the corruption case: a big file syncing A→B is seen by B's watcher and pushed back, overwriting your in-flight edits ([README](https://github.com/lsyncd/lsyncd)). One source, one target.

### 4. DIY watch-and-push — inotify-tools, entr, fswatch, watchman

- `inotifywait` is "for continuous monitoring ... generally used with the rsync incremental backup tool"; flags: `-m` continuous, `-r` recursive, `-q` quiet, `-e` event list, with `modify`, `attrib`, `close_write`, etc. ([guide](https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/)). The loop pattern — one rsync pass per event batch — is the canonical implementation of family (a).
- inotify has kernel-side ceilings: on the documented host, `max_queued_events`=16384, `max_user_instances`=128, `max_user_watches`=28014, raised via `/etc/sysctl.conf` (e.g. `fs.inotify.max_user_watches = 1048576`) ([guide](https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/)). Big trees exhaust the *default* 8192 watches-per-instance figure quoted there.
- `entr` runs arbitrary commands on change via kqueue/inotify, "to avoid polling"; watch lists arrive on stdin (`find src/ | entr -s 'make'`). Gotchas: WSL/Docker inotify is incomplete — set `ENTR_INOTIFY_WORKAROUND`; symlinks not followed unless `ENTR_FOLLOW_SYMLINK` ([README](https://github.com/eradman/entr)).
- `fswatch` unifies backends across platforms (FSEvents, kqueue, FEN, inotify, fanotify, ReadDirectoryChangesW, and a stat() fallback); its kqueue monitor "requires a file descriptor to be opened for every file being watched" and "scales badly" with file count ([README](https://github.com/emcrisostomo/fswatch)).
- `watchman` is Facebook's watching service: it records change state and fires triggers (e.g. rebuild on `*.css`) when a root "settles down"; conservative about what it considers freshly changed ([site](https://facebook.github.io/watchman/)).

### 5. Mutagen — for the local-edit / remote-run dev loop

- Synchronization runs between endpoints **alpha/beta** (not source/target, because bidirectional modes exist), with a three-way merge per short cycle: scan both ends, reconcile, stage, apply ([synchronization docs](https://mutagen.io/documentation/synchronization/)).
- Modes: `two-way-safe` (default), plus other unidirectional/bidirectional modes; unresolved conflicts are recorded in session state ([synchronization docs](https://mutagen.io/documentation/synchronization/)). Endpoint pair need not include the local machine — the local host can proxy two remotes ([introduction](https://mutagen.io/documentation/introduction/)).
- SSH endpoints use SCP-like URLs: `[<user>@]<host>[:<port>]:<path>`, e.g. `example.org:/var/www`, `example.org:23:relative/path` — requires an OpenSSH client and an sshd supporting `ssh` + `scp` ([transport docs](https://mutagen.io/documentation/transports/ssh/)).
- No remote install: small agents are injected with `scp`/`docker cp`, and `ssh`/`docker exec` are transports — "not a plug-in or a wrapper", works "between your local system and the remote infrastructure" ([introduction](https://mutagen.io/documentation/introduction/)).

### 6. Syncthing — continuous, multi-device, not SSH

- Creation/modification/deletion replicate across devices "as soon as they are online at the same time"; TLS with perfect forward secrecy; every device identified by a cryptographic certificate; no central server; web UI; runs on macOS, Windows, Linux, FreeBSD, Solaris, OpenBSD ([site](https://syncthing.net/)).
- Syncs file contents and modification times always; permissions, symlinks, owners, xattrs conditionally; does **not** sync directory mtimes, hard links, Windows ACLs, specials ([FAQ](https://docs.syncthing.net/users/faq.html)).
- Per-folder **Full Rescan Interval defaults to 3600 s**, the safety net for changes the event feed misses ([forum](https://forum.syncthing.net/t/how-to-perform-simple-scanning-of-files-instead-of-a-full-scan/25323)). Neutered for the stated question's "one SSH server" case: it needs a daemon on both ends and its own port ([site](https://syncthing.net/)).

### 7. Unison — two-way reconciliation, conflict-aware, SSH-tunnelable

- Two replicas modified separately are "brought up to date by propagating the changes in each replica to the other"; non-conflicting updates propagate automatically, conflicting ones are detected and displayed; user-level, no kernel change or superuser ([site](https://www.cis.upenn.edu/~bcpierce/unison/)).
- Communicates over a direct socket or an encrypted ssh connection; small updates inside large files transfer via an rsync-like compression protocol; runs on Windows and Unix, cross-platform ([site](https://www.cis.upenn.edu/~bcpierce/unison/)).
- No event watching — reconciliation happens when you run it (manually or scheduled); that is the trade for conflict awareness. Stable release **2.53.8, 2025-11-05** ([Wikipedia](https://en.wikipedia.org/wiki/Unison_(software))).

### 8. sshfs — the "no copy" option

- Mounts a remote filesystem over SSH's SFTP subsystem; most sshds enable SFTP by default, so "there's nothing to do on the server-side" ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)).
- Security defaults: local file permissions are ignored (add `-o default_permissions` to enforce), and only the mounting user can reach the mount (add `-o allow_other` to share) ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)). Run it as a regular user with a user-owned mountpoint ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)).
- There is no second copy and no propagation lag — every stat/read/write is a round trip over the tunnel [design consequence of the SFTP model described in the man page]. Right for browsing and single-file edits; rough for build tools that hammer many small files.

### 9. Decision guide

| Situation | Pick | Why |
|---|---|---|
| SSH-only server, one-way push, near-real-time | `lsyncd` if the maintainer risk is acceptable; otherwise `inotifywait`+`rsync` loop | event-driven, rsync deltas, nothing to install remotely ([manual](https://lsyncd.github.io/lsyncd/)) |
| Edit locally, run on the remote (code) | `Mutagen` two-way-safe | rsync-like deltas + fs watching, agent injected over scp ([introduction](https://mutagen.io/documentation/introduction/)) |
| Both sides edit independently, offline intervals OK | `Syncthing` (own TLS port) or `Unison` (SSH, conflict display) | only these reconcile concurrent edits ([site](https://syncthing.net/), [site](https://www.cis.upenn.edu/~bcpierce/unison/)) |
| macOS/BSD-heavy environment, ad-hoc hooks | `fswatch` or `entr` + command | cross-platform backends / command runner ([READMEs](https://github.com/emcrisostomo/fswatch)) |
| Build-tool triggers only | `watchman` | watching service with settle + trigger model ([site](https://facebook.github.io/watchman/)) |
| Just need the files there, editing in place | `sshfs` | zero server-side setup ([man](https://man7.org/linux/man-pages/man1/sshfs.1.html)) |

### 10. Recipes

**inotifywait → rsync (one-way, Linux).** Loop on event batches; each pass is a full rsync with `--delete`. Grounded in the pairing statement and the `-m -r -q -e` flags from the [Rocky guide](https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/); raise `fs.inotify.max_user_watches` ([same](https://docs.rockylinux.org/9/books/learning_rsync/06_rsync_inotify/)) before watching a large tree:

```sh
rsync_opts="-az --delete"      # -a archive, -z compress, --delete mirror removals
while inotifywait -m -r -q -e modify,create,delete,move /local/dir; do
  rsync $rsync_opts /local/dir/ remotehost:/remote/dir/
done
```

**entr → command (cross-platform hook).** stdin is the watch list ([README](https://github.com/eradman/entr)):

```sh
find /local/dir -type f | entr -s 'rsync -az --delete /local/dir/ remotehost:/remote/dir/'
```

**Mutagen session over SSH.** Endpoints are `path` or `[user@]host[:port]:path`; SSH transport requires an OpenSSH client ([transport docs](https://mutagen.io/documentation/transports/ssh/)):

```sh
mutagen sync create --name=site /local/dir example.org:/remote/dir   # default mode: two-way-safe
```

**lsyncd.** The manual ships two example syncs for `/home` → `remotehost`: one via an rsync share, one over ssh so moves are applied on the target ([manual](https://lsyncd.github.io/lsyncd/)); requires rsync ≥ 3.1 both ends.

## Open Questions

- Whether `lsyncd` has gained a maintainer since the "up for adoption" banner ([README](https://github.com/lsyncd/lsyncd)) — checked 2026-10-11, unresolved.
- Race handling when the same write touches both endpoints (Mutagen `two-way-safe` conflict recording) — semantics described in docs, not stress-tested here.
- Directory-rename behavior across watchers (inotify `move` pairs vs lsyncd's rsync+ssh move handling) — not tested.
- Latency distributions (p50/p99) for each tool — docs describe mechanism ("several seconds" for lsyncd, per-cycle for Mutagen), not numbers.

## Related

- [Watching File Changes on S3 Object Storage](./s3-file-change-detection.md) — the object-storage side of "detect the change" (event notifications vs polling vs full-scan), same push-beats-poll theme.
- [Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore](../howto/durable-pi-state-on-ephemeral-vm.md) — the object-storage counterpart for a machine that will be destroyed: content-addressed seals instead of a live mirror.
- [Reading a File From the End](./read-file-from-end.md) — HTTP suffix ranges and streaming primitives when "getting the file" is the problem rather than copying it.

## Changelog

- 2026-10-11 — created. All external sources gathered via TinyFish (`mcp__tinyfish__search` / `mcp__tinyfish__fetch_content`); every substantive claim cited inline.
