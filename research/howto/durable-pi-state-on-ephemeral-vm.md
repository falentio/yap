---
title: Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore
category: howto
tags: [pi, pi-coding-agent, backup, object-storage, s3, r2, rclone, restic, litestream, session-dir, ephemeral-vm]
status: complete
created: 2026-11-02
updated: 2026-11-03
sources:
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sessions.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/settings.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/environment-variables.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/configuration.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/session-format.md
  - https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/extensions.md
  - https://rclone.org/docs/
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
  - https://developers.cloudflare.com/r2/api/s3/extensions/
  - https://rclone.org/bisync/
  - https://litestream.io/how-it-works/
  - https://github.com/awslabs/mountpoint-s3/blob/main/doc/SEMANTICS.md
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-synchronization.html
confidence: high
---

# Durable pi State on an Ephemeral VM — Object-Storage Backup and Restore

## Goal

Keep work done with the pi coding agent on a throwaway VM and lose nothing when
the VM is reaped: the bucket is the system of record, the VM filesystem is a
write-through cache, and a fresh VM restores in one command.

Two things must survive, and they need opposite treatment:

| What | Size on this host (2026-11-02) | Restore-critical? | Correct mechanism |
|---|---|---|---|
| `~/.pi/agent/` config: `auth.json`, `settings.json`, `models.json`, `mcp.json`, `extensions/`, `skills/`, `prompts/`, `AGENTS.md` | ~7 MB | Yes — a fresh VM without it is a blank agent | One-way, content-addressed snapshot every few minutes |
| `~/.pi/agent/sessions/*.jsonl` (1146 files, 870 MB here) | up to 20 MB per file | Yes — this is the transcript history | Per-file sealed copies on an idle trigger, never a bulk mirror |
| Working tree in `~/Repositories/...` | Varies | Yes | Already Git; push, do not sync |

The trap: the obvious move — point `sessionDir` straight at a mounted bucket —
breaks, because a session file is **appended to synchronously**
(`appendFileSync`,
[`session-manager.js:813`](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/src/core/session-manager.ts)).
S3 objects are immutable and Mountpoint implements neither append nor rename
([SEMANTICS](https://github.com/awslabs/mountpoint-s3/blob/main/doc/SEMANTICS.md)),
so a live mount turns every turn into a full rewrite of a growing object. Keep
sessions on local disk and ship them.

## Prerequisites

- Object storage with an S3-compatible API. AWS S3, Cloudflare R2, Backblaze B2,
  MinIO, or Wasabi all work; anything that honours `If-None-Match: *` on
  `PutObject` is enough.
- A bucket scoped to this purpose, **versioning on**, and a credential limited to
  that one prefix.
- `rclone` (>= 1.66) on the VM and a systemd timer or cron entry.
- `age` or `gpg` if the bucket is not trusted with provider credentials
  (`auth.json` holds bearer tokens).

## Steps

### 1. Decide what the bucket is

Choose a layout where every write is a new key and nothing is ever mutated in
place. That is what makes the bucket safe for a machine that can die mid-write.

```text
s3://<bucket>/
  state/<vm-id>/config-<sha256>.tar.zst              # immutable config snapshot
  sessions/<vm-id>/<path>/<file>-<sha256>.jsonl.zst   # one object per seal
```

`state/` and `sessions/` keys are content-addressed, so a re-upload is free and a
truncated upload can never overwrite a good object. Bucket versioning is the
second layer: even a same-key overwrite keeps the prior bytes.

### 2. Keep sessions on local disk, not on a mount

`sessionDir` is still useful — not to point at the bucket, but to move sessions
to an **explicit local path** so the sync scope is a single directory and nothing
else in the agent dir is in scope. `PI_CODING_AGENT_SESSION_DIR` or
`--session-dir` sets it ([sessions.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/sessions.md),
[environment-variables.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/environment-variables.md)).

```bash
export PI_CODING_AGENT_SESSION_DIR=/var/tmp/pi/sessions
```

### 3. Seal config as an immutable snapshot

```bash
#!/usr/bin/env bash
# ~/bin/pi-config-snapshot — cron, every 2 minutes
set -euo pipefail
AGENT="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
BUCKET="${PI_STATE_BUCKET:?}"
VM_ID="$(cat /etc/pi-vm-id)"

umask 077
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# only members that exist: tar exits non-zero for a missing one under pipefail
members=()
for m in settings.json models.json mcp.json auth.json mcp-auth.json \
         extensions skills prompts agents docs AGENTS.md; do
  [ -e "$AGENT/$m" ] && members+=("$m")
done

tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
    -cf - -C "$AGENT" -- "${members[@]}" | zstd -qf -3 -o "$TMP/config.tar.zst"

SUM="$(sha256sum "$TMP/config.tar.zst" | cut -d' ' -f1)"
rclone copyto "$TMP/config.tar.zst" "pi:${BUCKET}/state/${VM_ID}/config-${SUM}.tar.zst" --immutable
```

`--immutable` skips the transfer when the destination already matches
([rclone docs](https://rclone.org/docs/)); content-addressed keys make that
correct rather than lossy. Every run is idempotent — unchanged config produces
the same key and zero traffic. Because the archive forces `--mtime=@0`, an
unchanged run logs `Timestamp mismatch between immutable objects` and still
exits 0; that notice is expected, not a failure.

Two shell details this depends on: `tar` must be given `-cf -` explicitly
(without `-c` it prints a usage error), and under `set -o pipefail` a missing
member aborts the pipeline, hence the existence loop and `zstd -qf` to overwrite
a staged file that `-o` would otherwise refuse.

### 4. Seal session files on an idle trigger

Sessions are the volume. Do not mirror them with `rclone sync`: a mirror cannot
distinguish "still being appended to" from "changed", so it re-uploads the whole
file on every pass and re-lists the whole corpus.

Instead, seal each file's *current* content under a key carrying its own hash.

```bash
#!/usr/bin/env bash
# ~/bin/pi-sessions-seal
set -euo pipefail
SRC="${PI_CODING_AGENT_SESSION_DIR:?}"
STAMP="$HOME/.local/state/pi-seal.stamp"
BUCKET="${PI_STATE_BUCKET:?}"
VM_ID="$(cat /etc/pi-vm-id)"
mkdir -p "$(dirname "$STAMP")"
[ -e "$STAMP" ] || touch -d '1970-01-01' "$STAMP"

umask 077
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# files touched since the last seal
: > "$TMP/stamp"; touch "$TMP/stamp"
find "$SRC" -name '*.jsonl' -newer "$STAMP" > "$TMP/pending" 2>/dev/null || true

while read -r file; do
  rel="${file#$SRC/}"
  opened="$(date -r "$file" +%s%N)"          # ordering component, stable per content
  zstd -q -3 -c "$file" > "$TMP/out.zst"
  sum="$(sha256sum "$TMP/out.zst" | cut -d' ' -f1)"
  remote="pi:${BUCKET}/sessions/${VM_ID}/${rel}-${opened}-${sum}.jsonl.zst"
  rclone copyto "$TMP/out.zst" "$remote" --immutable || echo "seal failed: $file" >&2
done < "$TMP/pending"

touch "$STAMP"
```

Two details that matter:

- `copyto` is a transfer command, so `--immutable` applies. `rclone rcat` does
  **not** honour `--immutable` — the docs scope it to "commands which transfer
  files (e.g. sync, copy or move)" ([rclone docs](https://rclone.org/docs/)) —
  so stage to a temp file and `copyto`.
- Sealing a file mid-append is safe because a session file is an append-only
  JSONL tree ([session-format.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/session-format.md)).
  A trailing partial line is the worst case, and the *next* seal of the same file
  is a new object that supersedes it.
- The key carries the file's own mtime in nanoseconds, so a plain lexicographic
  sort of keys is chronological and restore never depends on the backend
  preserving object timestamps. Same content and same mtime produce the same key,
  so the seal stays idempotent.

### 5. Restore on a fresh VM

```bash
#!/usr/bin/env bash
# ~/bin/pi-state-restore
set -euo pipefail
BUCKET="${PI_STATE_BUCKET:?}"
VM_ID="$(cat /etc/pi-vm-id)"
export PI_CODING_AGENT_SESSION_DIR="${PI_CODING_AGENT_SESSION_DIR:-/var/tmp/pi/sessions}"
mkdir -p ~/.pi/agent "$PI_CODING_AGENT_SESSION_DIR"

# newest config snapshot
key="$(rclone lsf --files-only "pi:${BUCKET}/state/${VM_ID}/" | sort | tail -1)"
rclone copyto "pi:${BUCKET}/state/${VM_ID}/${key}" /tmp/pi-config.tar.zst
tar --zstd -xf /tmp/pi-config.tar.zst -C ~/.pi/agent

# every seal, lexicographically ascending: the newest seal of a file is the last writer
rclone copy "pi:${BUCKET}/sessions/${VM_ID}/" "$PI_CODING_AGENT_SESSION_DIR" \
  --include '*.jsonl.zst' --no-traverse
find "$PI_CODING_AGENT_SESSION_DIR" -name '*.jsonl.zst' | sort | while read -r f; do
  orig="$(dirname "$f")/$(basename "$f" | sed 's/-[0-9][0-9]*-[0-9a-f]\{64\}\.jsonl\.zst$//')"
  zstd -dq -c -- "$f" > "$orig" && rm -f "$f"
done

pi --resume
```

### 6. Make the seal atomic against a concurrent writer

If two seals of the same key can race, the write must be create-only.
`PutObject` with `If-None-Match: *` succeeds only when the key is absent, and
among concurrent writers exactly one wins while the rest get
`412 Precondition Failed`
([S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
— "the first write operation to finish succeeds";
[R2](https://developers.cloudflare.com/r2/api/s3/extensions/) — "at most one
request succeeds").

rclone's `--immutable` is a listing comparison, not an atomic precondition. Use
the header when the collision itself matters:

```bash
aws s3api put-object --bucket "$BUCKET" --key "$KEY" --body "$FILE" --if-none-match '*'
```

Treat `412` on a content-addressed key as success: the same bytes are already
there.

## Verification

Three checks, in increasing strength.

1. **The snapshot round-trips.** Run `pi-config-snapshot`, then `rclone lsf` on
   `state/<vm-id>/`; extract the newest key into a temp dir and confirm `pi`
   starts from it.
2. **An append seals as a new object.** Complete a turn, run `pi-sessions-seal`,
   and confirm `rclone lsf` on `sessions/<vm-id>/` lists a second key for the same
   file with a different hash suffix — nothing overwritten.
3. **Cold restore resumes the tree.** On a scratch VM, restore, `cd` into the
   restored session's directory, `pi --resume`, open `/tree`, and confirm branch
   structure and entries logged after the last seal are present.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Restore leaves `.zst` files and `pi --resume` shows nothing | Decompress step skipped | Run the sorted decompress loop before `pi` |
| Every seal re-uploads everything | `rclone sync` used instead of `copyto` with a stamp | Replace with the `find -newer` loop |
| `seal failed` lines in the log | `rclone rcat` with `--immutable`, or two VMs sharing `VM_ID` | Stage to a temp file and `copyto`; give each VM its own `VM_ID` |
| Last turn missing after restore | Interval longer than the VM survived | Seal on `agent_settled`, not only on a timer (below) |
| Restore ran, but `pi --resume` lists nothing | The picker filters by current folder, and each session's `cwd` comes from its header | `cd` into the restored session's directory first, or press Tab in the picker to search all folders |
| `auth.json` restored but the provider 401s | Credentials are per-environment secrets, not state | Restore the file, but re-run `/login` where the token is environment-bound |

### Seal on idle, not only on a timer

A timer alone loses the last N minutes. `agent_settled` is the final
notification-only boundary, safe for status integrations
([extensions.md](https://github.com/earendil-works/pi/blob/babe30a7e6c1/packages/coding-agent/docs/extensions.md#agent_start--agent_end--agent_settled)):

```typescript
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";

export default function (pi: ExtensionAPI) {
  const run = () => spawn("pi-sessions-seal", [], { detached: true, stdio: "ignore" }).unref();
  pi.on("agent_settled", run);
  pi.on("session_shutdown", () => spawn("pi-sessions-seal", [], { stdio: "ignore" }));
}
```

Register the child from event handlers, not the factory — the docs warn the
factory can run in invocations with no session.

## Design notes

### Why not the alternatives

| Option | Why it fits or fails for pi state |
|---|---|
| **`rclone bisync`** ([docs](https://rclone.org/bisync/)) | Bidirectional, so a fresh VM's empty tree can clobber the bucket on first run and it needs `--resync` discipline plus a listing workdir. Right when two *live* machines share state; wrong for one throwaway VM. |
| **`rclone sync` one-way** | Simplest to reason about but *deletes* bucket objects when the VM prunes, and re-uploads a file mid-append. Acceptable for `config/`, wrong for `sessions/`. |
| **`restic` / `kopia` snapshots** | Content-deduplicated, encrypted, snapshot-aware — the strongest answer for `auth.json` and a growing history at once. Costs a repository format and a restore path. Use it if encryption should be the default rather than an option. |
| **Mounting the bucket (`mountpoint-s3`, `s3fs`)** | No atomic rename, no random write ([SEMANTICS](https://github.com/awslabs/mountpoint-s3/blob/main/doc/SEMANTICS.md)); every append rewrites the object. Append exists only on S3 Express One Zone directory buckets. |
| **Litestream** ([docs](https://litestream.io/how-it-works/)) | Good at what it does — WAL streaming into TXID-ordered LTX files — but it replicates a *SQLite database*, and pi sessions are JSONL files. Only relevant if sessions move into SQLite. |
| **AWS S3 Files** ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-synchronization.html)) | A real POSIX mount backed by a bucket, exporting after 60 s of write inactivity. The closest thing to "bucket as disk", at the price of EFS-style hot storage. |
| **SSHFS to an always-up host** | Works and is simple when such a host exists; adds a single point of failure a bucket does not have. |

### The one-object-per-entry alternative

Whole-file sealing is coarse. If volume grows, use the SDK seam from
[pi-session-persistence-external-store.md](../technology/pi-session-persistence-external-store.md):
hydrate a `SessionManager` with `inMemory(cwd, {}, entries)`, override
`_persist`, and write **each entry** as its own object
`sessions/<session-id>/<entry-id>.json` with `If-None-Match: *`. Entries are
~150–260 B each and per-entry objects make restore a `ListObjectsV2` plus
ordering by `parentId`. The same document records the gotchas: `_persist` is
underscore-prefixed, and compaction entries embed the whole system message, so
they must be stored whole ([pi-session-persistence-external-store.md](../technology/pi-session-persistence-external-store.md)).

### Cost and volume sanity

870 MB across 1146 files compresses to ~58% at `zstd -3` (measured: 19.7 MB
sample → 11.4 MB; `-19` reaches 48%). At S3/R2 standard rates the whole corpus
is cents per month, and seal traffic is bounded by per-turn deltas rather than
corpus size. Versioning on top is the real safety net — an overwrite of a live
object cannot destroy the prior copy.

## Related

- [pi-coding-agent Sessions in Your Own Store — The In-Memory Seam](../technology/pi-session-persistence-external-store.md)
  — per-entry persistence and the `_persist` override this guide defers to.
- [pi Custom Session Store — The Directory Knob, the Extension Takeover, and What Breaks](../technology/pi-custom-session-store.md)
  — what `sessionDir` does and does not change: flat storage, picker scope, a dangling symlink
  stopping startup, and why the knob survives project trust.
- [Watching File Changes on S3 Object Storage](../technology/s3-file-change-detection.md)
  — the push-don't-poll mechanism if the bucket side must react to seals.
- [Syncing File Changes to a Remote SSH Host](../technology/live-file-sync-to-remote-host.md)
  — the SSH-host variant when the durable target is a machine, not a bucket.
- [Pi Package Map](../reference/pi-package-map.md) — where sessions and config
  actually live in the package.

## Changelog

- 2026-11-03 — added the Related link to the directory-level sibling
  ([pi-custom-session-store.md](../technology/pi-custom-session-store.md)); no claim in this guide changed.

- 2026-11-02 — created, answering "my VM's filesystem is not durable, I prefer
  object storage". All external research via TinyFish: S3 conditional writes, R2
  conditional PUT atomicity, rclone `--immutable` scope, rclone bisync
  limitations, litestream LTX mechanics, Mountpoint semantics, S3 Files
  synchronisation. Host inventory measured here: 1146 session files / 870 MB /
  844 MB agent dir; `rclone`, restic, litestream absent; `zstd`, duplicity, git
  present; 19.7 MB sample compresses to 11.4 MB at `zstd -3`. Steps 3–5 were
  then executed verbatim against `rclone v1.75.2` on a local backend: three
  appends produced three keys, a clean-home restore recovered the config and the
  newest seal with all three lines, and an unchanged config produced one key and
  exit 0.
