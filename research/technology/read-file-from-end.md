---
title: Reading a File From the End — Reverse Streaming, Suffix Ranges, and Tail Semantics
category: technology
tags: [file-io, streams, seek, tail, range-requests, reverse-read, node, python, go, rust, java, dotnet]
status: complete
created: 2026-10-08
updated: 2026-10-08
sources:
  - https://www.rfc-editor.org/rfc/rfc9110.html
  - https://httpwg.org/specs/rfc7233.html
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range
  - https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice
  - https://nodejs.org/api/fs.html
  - https://docs.python.org/3/library/io.html
  - https://doc.rust-lang.org/std/io/trait.Seek.html
  - https://pkg.go.dev/os#File.Seek
  - https://pkg.go.dev/io#SeekStart
  - https://www.gnu.org/software/coreutils/manual/html_node/tail-invocation.html
  - https://www.gnu.org/software/coreutils/manual/html_node/tac-invocation.html
  - https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.seek?view=net-10.0
  - https://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/input/ReversedLinesFileReader.html
  - https://github.com/soldair/node-fs-backwards-stream
  - https://www.npmjs.com/package/read-last-lines
  - https://pypi.org/project/file-read-backwards/
confidence: high
---

# Reading a File From the End — Reverse Streaming, Suffix Ranges, and Tail Semantics

## TL;DR

- **No mainstream runtime has a "stream backwards" primitive.** Every one of
  them (Node, Python, Go, Rust, Java, .NET, POSIX) gives you exactly one
  primitive — **seek to an offset, then read forward** — and reverse reading is
  a *recipe* you build on top of it: seek to `len`, read a block, seek back,
  read again, and re-order the blocks in memory.
- **The end of a file is a seek target, not a direction.** `SEEK_END` /
  `SeekFrom::End` / `SeekOrigin.End` position the cursor *relative to the end*;
  only a **negative** offset from there actually reads tail data. Positive or
  zero offsets from the end read *nothing* (a zero-byte read at EOF).
- **Over HTTP the equivalent is a suffix range, `Range: bytes=-N`** — the one
  range form that does not require you to know the resource length first.
  [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §14.1.1 defines it and
  obsoletes the older [RFC 7233](https://httpwg.org/specs/rfc7233.html).
- **The single biggest gotcha: naive byte reversal is not reverse *text*.**
  Reversing bytes breaks multi-byte UTF-8 and mangles line order. Reverse at
  the **record (line) boundary**, not the byte boundary.
- **Servers may silently ignore `Range`.** A `200 OK` with the full body means
  your suffix request was not honored; you must check the status code.

## Context

The question behind this file: *"I want to stream a file but not from the
start — from the end."* That phrasing maps onto two genuinely different
problems, and picking the wrong one is the usual cause of a broken
implementation:

1. **Reverse reading (tail-oriented).** Read the last bytes / lines first:
   log viewers, "show me the end of this 40 GB file", crash-tail inspection.
   The direction of travel is backwards.
2. **Resume-from-offset (seek-oriented).** Start at byte *k* instead of byte 0:
   resuming an interrupted download, chunked upload, or paging through a file.
   The direction is still forward; only the *start* moved.

This file covers both, with reverse reading as the primary subject because that
is what "from the end" most directly means. All claims below were checked
against the primary docs **and** executed locally on 2026-10-08 (see
[Verification](#verification)); the environment was Node.js v24.21.0, CPython
3.12.3, Go 1.x, rustc/cargo, and OpenJDK 21.

## Findings

### 1. There is no reverse-read primitive — only seek + read

Every seekable-stream API in the ecosystem is the same shape: a cursor with
three reference points (start, current, end) and a *forward-only* read.

- **POSIX/C**: `fseek(fp, 0, SEEK_END)` + `ftell` for the length; `fseek(fp, -n,
  SEEK_END)` to land in the tail.
- **Python**: [`seek(offset, whence)`](https://docs.python.org/3/library/io.html)
  with `whence` in `{SEEK_SET=0, SEEK_CUR=1, SEEK_END=2}`; "end of the stream;
  offset is usually negative".
- **Go**: [`os.File.Seek(offset, whence)`](https://pkg.go.dev/os#File.Seek) —
  "0 means relative to the origin of the file, 1 means relative to the current
  offset, and 2 means relative to the end"; the constants are
  [`io.SeekStart/SeekCurrent/SeekEnd`](https://pkg.go.dev/io#SeekStart).
- **Rust**: the [`Seek` trait](https://doc.rust-lang.org/std/io/trait.Seek.html)
  with `SeekFrom::{Start, Current, End}`; the docs note "seeking to a negative
  offset is considered an error".
- **Java**: `RandomAccessFile.length()` + `seek(len - n)`; there is no reverse
  stream in the JDK.
- **.NET**: [`FileStream.Seek(offset, SeekOrigin)`](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.seek?view=net-10.0)
  with `SeekOrigin.{Begin, Current, End}`; seeking before the start throws
  `IOException`.

So "stream from the end" always decomposes into: **learn the length → seek near
the end → read → re-order**.

### 2. End-relative positioning is a *reference point*, not a direction

A subtle trap: `seek(0, SEEK_END)` does not read anything — it parks the cursor
at EOF. You then read zero bytes. To get tail data you must pass a **negative**
offset:

| Intent | Call | Result |
|--------|------|--------|
| Get the length | `seek(0, SEEK_END)` | returns `len`, cursor at EOF |
| Read last 5 bytes | `seek(-5, SEEK_END)` then `read()` | the 5 tail bytes |
| Read *forward* from EOF | `seek(0, SEEK_END)` then `read()` | empty |

Verified: Python `f.seek(0, 2)` returned `20` on a 20-byte file, and
`f.seek(-5, 2)` returned `b'DDDD\n'`; Go `f.Seek(0, io.SeekEnd)` returned `20`
and `f.Seek(-5, io.SeekEnd)` yielded `"DDDD\n"`.

A negative offset that runs past the start is an **error**, not a clamp:

- Rust `f.seek(SeekFrom::End(-100))` on a 20-byte file → `Err(Invalid argument
  (os error 22))`.
- .NET throws `IOException` when "seeking is attempted before the beginning of
  the stream".
- Python's `os.lseek` raises `OSError: [Errno 22] Invalid argument`.

Guard with `min(n, len)`.

### 3. Local file APIs — wide comparison

| | Node.js | Python | Go | Rust | Java | .NET |
|---|---|---|---|---|---|---|
| Seek to end | `fs.statSync().size` | `seek(0, SEEK_END)` | `Seek(0, io.SeekEnd)` | `SeekFrom::End(0)` | `RandomAccessFile.length()` | `FileStream.Length` |
| Negative end offset | absolute offsets only | `seek(-n, SEEK_END)` | `Seek(-n, io.SeekEnd)` | `SeekFrom::End(-n)` | `seek(len - n)` | `Seek(-n, SeekOrigin.End)` |
| Reads backwards natively | no | no | no | no | no | no |
| End-relative *text* seek | n/a (buffers) | **unsupported** in text mode | n/a (bytes) | n/a (bytes) | n/a | n/a |
| Tail-N in stdlib | no | no | no | no | no | no |
| Positional read (no seek) | `fs.read(fd, buf, off, len, position)` | `os.pread(fd, n, off)` | `ReadAt(p, off)` | `ReadAt` (unix) | `FileChannel.read(buf, pos)` | `RandomAccessFile.seek` |
| Third-party reverse reader | `fs-backwards-stream`, `read-last-lines` | `file-read-backwards` | — | — | commons-io `ReversedLinesFileReader` | — |

Notes on the columns:

- **Node.js** has no negative-offset seek at all. `fs.createReadStream` takes
  absolute `start`/`end` **inclusive** offsets, so a tail read is
  `{ start: size - n, end: size - 1 }`. Passing `start > end` throws
  `RangeError [ERR_OUT_OF_RANGE]` (verified). The same file handle also offers
  `filehandle.createReadStream()`.
- **Python text mode is the standout trap.** `open(path, "r")` (a
  `TextIOWrapper`) supports only four seek forms, and a nonzero end-relative
  seek raises `UnsupportedOperation: can't do nonzero end-relative seeks`
  (verified). Binary mode (`"rb"`) has no such restriction. Text streams also
  return **opaque cookies**, not byte offsets, from `tell()`.
- **Java** reads from the end with `RandomAccessFile` or
  `FileChannel.read(ByteBuffer, position)`; for line-oriented reverse reading
  the ecosystem uses [Apache commons-io
  `ReversedLinesFileReader`](https://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/input/ReversedLinesFileReader.html)
  ("starting at the last line").
- **Go and Rust** have no reverse helper in the standard library; you write the
  block loop yourself. Rust's `stream_len()` helper is still nightly-only
  (`seek_stream_len`), so `SeekFrom::End(0)` is the stable way to get the
  length.

### 4. The reverse-read recipe (seek + block + re-order)

Because the primitive is forward-only, reverse streaming is a loop:

1. **Size it.** `len = seek(0, END)`.
2. **Walk backwards in blocks.** `pos = len`; each step `pos -= min(block,
   pos)`; seek to `pos`; read `block` bytes.
3. **Re-assemble in file order.** *Prepend* each new chunk to the buffer, or
   collect chunks and reverse the chunk list — never reverse the bytes.
4. **Stop when you have enough** (N bytes, or N newline delimiters found).

Verified reference implementation (Python, binary):

    def tail_lines(path, n, block=4096, encoding="utf-8"):
        with open(path, "rb") as f:
            f.seek(0, 2)                      # SEEK_END
            pos = f.tell()
            buf = b""
            while pos > 0 and buf.count(b"\n") <= n:
                step = min(block, pos)
                pos -= step
                f.seek(pos)
                buf = f.read(step) + buf      # prepend -> keep file order
            lines = buf.decode(encoding, errors="replace").splitlines()
        return lines[-n:]

On `line1..line5`, `tail_lines(path, 2)` returned `['line4', 'line5']`.

Why "re-order" matters — a chunk-wise reverse read of the 20-byte file
`AAAA\nBBBB\nCCCC\nDDDD\n` with a 4-byte block gathers the chunks in file order
as `b'lta\na\nde'`; naively reversing *that byte string* yields `b'ed\na\natl'`,
which is neither the tail nor readable text. Reverse the **chunk list** (or
prepend), then interpret records.

### 5. Line-oriented reverse readers (when you want `tac`, not bytes)

Record-aware reverse reading needs an extra step — a record boundary can
straddle a block boundary, so a block must be carried until a delimiter is
found. Existing tools encode that logic:

- **GNU `tac`** reverses records, not bytes: "records are separated by
  instances of a string (newline by default)"; `tac -r` treats the separator as
  a regex, `tac -s` sets a custom separator (an empty separator means NUL).
  Verified: `tac` on `alpha…delta` printed `delta gamma beta alpha`.
- **GNU `tail`** is the byte/line tail tool. `tail -c N` prints the last N
  **bytes**; `tail -n N` the last N lines; a `+` prefix inverts to *skip from
  the start* (`tail -c +5` skips the first 4 bytes; verified). GNU `tail` also
  documents that it "has no `-r` option (print in reverse), since reversing a
  file is really a different job" and recommends `tac` instead.
- **Libraries**: [`fs-backwards-stream`](https://github.com/soldair/node-fs-backwards-stream)
  ("exact same api as `fs.createReadStream` except reads chunks backwards",
  `start` defaults to end, `end` to 0), [`read-last-lines`](https://www.npmjs.com/package/read-last-lines)
  (Node), and [`file-read-backwards`](https://pypi.org/project/file-read-backwards/)
  (Python) implement exactly the recipe above.

### 6. Over HTTP: the suffix range is the "from the end" primitive

The network analogue of `seek(-N, SEEK_END)` is the **suffix range**:

    Range: bytes=-500        # the last 500 bytes

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §14.1.1: "A client can
refer to the last N bytes (N > 0) of the selected representation using a
suffix-range. If the selected representation is shorter than the specified
suffix-length, the entire representation is used." Its grammar is
`suffix-range = "-" suffix-length`. It is the only range form that needs **no
prior knowledge of the resource length**, which is why
[MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range)
calls it out for "if it's unknown how large a resource is".

Contrast with the two other forms, which both need the length up front:

| Range form | Example | Needs length? | Reads |
|---|---|---|---|
| int-range | `bytes=9500-` | yes (to know it is the tail) | from offset to end |
| int-range | `bytes=9500-9999` | yes | a fixed window |
| **suffix-range** | `bytes=-500` | **no** | last N units |

Protocol behavior that matters:

- A conforming server answers `206 Partial Content` with
  `Content-Range: bytes <first>-<last>/<complete-length>` — which is how you
  learn the true total length. Verified against a suffix-aware server: a
  `bytes=-5` request returned `206`, `Content-Range: bytes 15-19/20`, body
  `b'DDDD\n'`.
- **Servers may ignore `Range` entirely** and return `200 OK` with the whole
  body — the spec explicitly permits this ("Range requests are an OPTIONAL
  feature"). Verified: Python's `http.server` returned `200` and the full 20
  bytes for both `bytes=-5` and `bytes=0-3`. Always branch on the status code;
  do not assume `206`.
- An unsatisfiable or invalid range set gets `416 Range Not Satisfiable`
  (carrying `Content-Range: bytes */<len>`). A zero-length suffix (`bytes=-0`)
  is not satisfiable per the spec, since a suffix range is satisfiable only
  with a **non-zero** suffix-length.
- `Range` is a **CORS-safelisted request header** only when it is a single byte
  range — so `bytes=-N` is usable cross-origin without a preflight; a
  multi-range value is not.
- Only `bytes` is a registered unit, and offsets are **zero-indexed and
  inclusive**.

### 7. In the browser: `Blob.slice` is the local suffix range

For a user-selected `File`, the "from the end" operation is
[`Blob.prototype.slice`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice),
which takes **negative indices as offsets from the end**: "If you specify a
negative value, it's treated as an offset from the end of the `Blob` toward the
beginning." So `file.slice(-500)` is the last 500 bytes. Note the mismatch with
HTTP semantics: `slice(start, end)` has an **exclusive** `end`, whereas a byte
range's `last-byte-pos` is **inclusive**.

For random access on the Origin Private File System, `FileSystemSyncAccessHandle`
(worker-only) exposes `getSize()`, `read(buffer, { at })`, and `truncate()`,
giving you real positional reads client-side.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Read returns empty at "the end" | Used `seek(0, END)` then read | Use a negative offset: `seek(-n, END)` |
| `UnsupportedOperation: can't do nonzero end-relative seeks` | Python **text** stream | Open binary (`"rb"`) and decode yourself |
| Garbled characters in the tail | Reversed bytes split a UTF-8 sequence | Reverse at record boundaries; decode after ordering |
| Lines out of order / merged | Reversed the concatenated bytes | Reverse the chunk *list* (or prepend chunks) |
| `Err(Invalid argument)` / `IOException` | Negative offset past file start | Clamp: `min(n, len)` |
| `RangeError [ERR_OUT_OF_RANGE]` (Node) | `createReadStream` with `start > end` | Compute `start = size - n`, `end = size - 1` |
| Full file returned despite `Range` | Server ignores ranges (`200 OK`) | Check status; fall back to a full read or `HEAD` |
| `416 Range Not Satisfiable` | Invalid / zero-length suffix | Request `N > 0` and `N <= len` |
| `tail` blocks forever | `-f` follows a growing file | Drop `-f`, or use `tail -c`/`-n` |
| `tac` on a pipe is slow | Non-seekable input is buffered to `$TMPDIR` | Seek a real file, or accept the buffer |

## If you meant *resume*, not *reverse*

If "not from the start" meant "start at byte *k*", the answer is much simpler
and fully supported:

- **Local**: seek to `k` and read forward (`seek(k, SEEK_SET)` /
  `SeekFrom::Start(k)`).
- **HTTP**: `Range: bytes=k-` (int-range with an omitted end), expecting `206`
  and a `Content-Range` you can verify against your expected offset.
- **Uploads**: chunked/multipart uploads (e.g. S3) let you retry a single part
  without restarting the object, but parts are addressed by part number, and
  S3 requires every part except the last to be the same size and ≥ 5 MiB.

The reverse case is strictly harder than the resume case, because only resume
has a first-class primitive.

## Verification

All runtime claims were executed locally on 2026-10-08 (Node.js v24.21.0,
CPython 3.12.3, Go 1.x, rustc, OpenJDK 21) against a 20-byte fixture
`f.txt = "AAAA\nBBBB\nCCCC\nDDDD\n"`:

    # Python: end-relative seeks, binary vs text
    f.seek(0, 2)        -> 20          # SEEK_END returns length
    f.seek(-5, 2)       -> b'DDDD\n'   # binary tail
    open('f.txt').seek(-5, 2)          # -> UnsupportedOperation (text mode)

    # Go / Rust: length and negative end offset
    f.Seek(0, io.SeekEnd)          -> 20
    f.Seek(-5, io.SeekEnd)         -> "DDDD\n"
    f.seek(SeekFrom::End(-100))    -> Err(Invalid argument (os error 22))

    # Node: inclusive start/end; start > end throws
    createReadStream(p, {start: size-5, end: size-1})  -> "DDDD\n"
    createReadStream(p, {start: 10, end: 2})           -> RangeError ERR_OUT_OF_RANGE

    # CLI
    tail -c 5 f.txt   -> "DDDD"
    tail -c +5 f.txt  -> "\nBBBB\nCCCC\nDDDD"
    tac f.txt         -> "DDDD\nCCCC\nBBBB\nAAAA\n"

    # HTTP suffix range against a suffix-aware server
    Range: bytes=-5  -> 206, Content-Range: bytes 15-19/20, body "DDDD\n"
    Range: bytes=-5  -> 200 (full body)  against python -m http.server

## Open Questions

- **Kernel-level reverse reads.** `preadv2`/`RWF_NOWAIT` and `io_uring` do not
  offer a "read backwards" op; whether a filesystem-level reverse iterator
  (e.g. `getdents`-style) is worth building for huge logs is unaddressed here.
  `[unverified]`
- **`Content-Range` on `200 OK`.** Whether a conforming server may include a
  `Content-Range` when it ignores `Range` and returns `200` — worth checking
  against RFC 9110 §15.3.7 before relying on it. `[unverified]`
- **Range + `Content-Encoding`.** MDN warns byte ranges apply to the **encoded**
  bytes when a content coding is applied; the interaction with
  `Accept-Encoding: gzip` for suffix ranges on text assets was not tested here.
  `[unverified]`

## Related

- [Effect v4 Primitives — A Reader's Map](../reference/effect-v4-primitives.md) —
  `Stream` as the effectful-sequence abstraction, if the "stream" in question is
  an Effect stream rather than a file handle.

## Changelog

- 2026-10-08 — created. Primary sources: RFC 9110 / RFC 7233 (HTTP range),
  Node `fs`, Python `io`, Rust `Seek`, Go `os`/`io`, .NET `FileStream`, GNU
  coreutils `tail`/`tac`, MDN `Range`/`Blob.slice`, commons-io
  `ReversedLinesFileReader`, and three third-party reverse-read libraries. All
  runtime claims executed locally on the same date.
