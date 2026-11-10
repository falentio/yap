---
title: Recording tmux Sessions for Agents — Capture Layers, Cast Formats, and Video Pipelines
category: technology
tags: [tmux, asciinema, asciicast, terminal-recording, agents, video, pipe-pane, agg, vhs]
status: complete
created: 2026-10-30
updated: 2026-10-30
sources:
  - https://docs.asciinema.org/manual/cli/
  - https://docs.asciinema.org/manual/cli/quick-start/
  - https://docs.asciinema.org/manual/asciicast/v3/
  - https://docs.asciinema.org/manual/asciicast/v2/
  - https://docs.asciinema.org/manual/agg/
  - https://github.com/asciinema/asciinema/releases
  - https://github.com/asciinema/agg
  - https://github.com/bitplane/tvmux
  - https://discourse.asciinema.org/t/tvmux-a-tmux-pane-recorder/985
  - https://github.com/dcoles/asciicast-tools
  - https://github.com/blacknon/tmux-rewinder
  - https://github.com/blacknon/twatch
  - https://github.com/tmux-plugins/tmux-logging
  - https://github.com/bitplane/sh2mp4
  - https://github.com/charmbracelet/vhs
  - https://www.mankier.com/1/vhs
  - https://github.com/coder/agent-tty
  - https://blog.github.com/changelog/2026-09-01-github-cli-media-in-issues-pull-requests-and-comments/
  - https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files
confidence: high
---

# Recording tmux Sessions for Agents — Capture Layers, Cast Formats, and Video Pipelines

## TL;DR

- **tmux has no timestamped recorder.** It gives two primitives — `pipe-pane` (raw output bytes, no clock) and `capture-pane` (a grid snapshot, no clock) — and you supply the clock. Everything below is a choice of which boundary the recorder sits on.
- For agents that live in a pane and are driven by both a human and an agent, **`pipe-pane` → a chunk-timestamping filter that emits asciicast** is the winner: it dies with the pane rather than the process, costs kilobytes per minute, and produces a file every downstream tool already reads. Verified locally (Recipes below).
- If the recording must show **keystrokes in a raw-mode TUI**, only a PTY recorder *inside* the pane sees them (`asciinema rec -c`, `script -t`); `pipe-pane` sees redraws, not keys.
- **Cast → video**: `sh2mp4 --cast-file in.cast out.mp4` for a straight MP4, `agg` for GIF, and **VHS** when the demo should be scripted and designed (`.mp4`, `.webm`, `.gif` directly). GitHub attaches MP4/WebM to PRs and comments.
- **`agent-tty`** is the one project built for exactly this ask — agent drives a real terminal, gets back PNG screenshots, WebM video, and a replayable recording as artifacts.
- The step that decides whether anyone watches: **trim idle time** (`asciinema play -i 2`, `agg --idle-time-limit`, `sh2mp4 --speed 8x`). An unedited agent session is 40 minutes of silence around 40 seconds of work.

## Context

Setup: tmux is the multiplexer; long-running agent work lives in panes; the human and the agent both steer the same pane (`send-keys` from the agent, a keyboard from the human). What is missing is the artifact — a recording an agent can hand over as proof, the way a browser agent hands over screenshots.

That gap is structural, not a missing command. tmux exposes the pane as two views: a **byte stream** (`pipe-pane`) and a **character grid** (`capture-pane`). Neither carries time. A recording format needs time to be a recording, so every approach below is "put a clock on one of those views", or "bypass tmux and record the screen".

## Findings

### 1. Four boundaries a recorder can sit on

| Boundary | What the recorder sees | What it misses |
|----------|----------------------|----------------|
| PTY of the program in the pane | Every byte in and out: output, human keys, agent `send-keys`, own redraws, with timestamps | Nothing inside the pane; nothing outside the pane (other panes, tmux chrome) |
| Pane output stream (`pipe-pane`) | Everything the pane paints, from the moment the pipe opens | Input that the program does not echo (raw-mode TUIs), scrollback before the pipe opened, pane resize as an event |
| Pane grid (`capture-pane`) | The grid as it looks at poll time | Everything between samples; cursor-only motion; scrollback beyond `history-limit` unless `-S -` |
| Screen pixels | Exactly what a human sees, tmux status bar and all panes included | Text (it is now image data), CPU and disk headroom |

The choice is driven by one question: **must the recording show the keystroke, or the result?** Agents mostly need the result. TUI demos need the keystroke.

### 2. The format worth targeting: asciicast

asciicast is newline-delimited JSON: a header line, then one 3-element event array per line. Event codes are `o` (output), `i` (input), `m` (marker), `r` (resize), `x` (exit) ([v3 spec](https://docs.asciinema.org/manual/asciicast/v3/)).

Two versions matter, and they disagree on the single most important field:

- **v2** — times are **absolute** seconds from session start, header carries `width`/`height` ([v2 spec](https://docs.asciinema.org/manual/asciicast/v2/)).
- **v3** — times are **intervals** relative to the previous event, header nests geometry under `term: {cols, rows, type, theme}`, and the format is explicitly *not* backward compatible with v1/v2 because of that change ([v3 spec](https://docs.asciinema.org/manual/asciicast/v3/)).

The v3 spec also states, plainly, that "asciinema CLI doesn't capture keyboard input by default" — `i` events are opt-in. So a cast is normally an **output-only** artifact, which is what `pipe-pane` can produce without any loss.

Aim at asciicast because everything reads it: the asciinema CLI (3.2.1 as of 2026-06, [releases](https://github.com/asciinema/asciinema/releases)), the web player, asciinema.org uploads, `agg`, `sh2mp4`, and `tvmux`. Support for v3 specifically arrived in CLI v3.0, player v3.10.0, and server 20250509 ([v3 spec](https://docs.asciinema.org/manual/asciicast/v3/)).

### 3. Layer A — PTY recorder inside the pane

```bash
asciinema rec -c "$SHELL" demo.cast      # record one command
asciinema rec demo.cast                    # record a shell
asciinema play -i 2 demo.cast              # replay, idle clamped to 2s
```

`--command/-c` records any program, not just a shell, and the recording ends when that program exits ([quick start](https://docs.asciinema.org/manual/cli/quick-start/)). asciinema CLI 3.x adds `session`, which records to a file and live-streams in one command ([discourse](https://discourse.asciinema.org/t/tvmux-a-tmux-pane-recorder/985), [v3.2.0 notes](https://github.com/asciinema/asciinema/releases)).

The dependency-free equivalent, verified locally inside a tmux pane on util-linux 2.39.3:

```bash
script -q --log-out out/typescript --log-timing out/timing -c "bash --norc --noprofile"
scriptreplay -t out/timing out/typescript     # replays with original timing
```

Both recorded the human-typed and `send-keys`-typed commands identically, because `send-keys` writes to the PTY master and the slave records what it sees — *this is the layer that sees agent keystrokes as keystrokes*.

Cost: **the recorder is the pane's process**. Kill or restart the agent and the recording ends with it; `remain-on-exit` leaves a dead pane, and `respawn-pane` starts a fresh process, not a continued recording. That is precisely the lifecycle an agent session has.

### 4. Layer B — pane stream to a cast (the tmux-native route)

```bash
tmux pipe-pane -O -t "=DEV repo branch 3100:" 'cat >> /tmp/pane.log'
tmux pipe-pane -t "=DEV repo branch 3100:"        # close it
```

tmux(1) constraints, from the local 3.4 man page:

- **One pipe per pane.** "A pane may only be connected to one command at a time"; opening a new one closes the old.
- `-O` (the default) pipes pane output into the command's stdin; `-I` writes the command's stdout into the pane; both can be used at once.
- `-o` only opens a pipe if none exists, which is what makes a single keybinding a toggle.
- The command string supports the same `#{`…`}` expansions as `status-left`, so a per-pane log path is one format string.

What the pipe does **not** give you, measured locally:

```
printf "hello\n"^M
^[[?2004hbash-5.2$ printf "hello\n"^M
^[[?2004l^Mhello^M
```

155 bytes for two commands. No timestamps anywhere. Echoed keys appear only because the shell echoes them; a full-screen app in raw mode would show redraws and nothing else. And the stream starts when the pipe opens — the scrollback before it is gone.

So the whole of Layer B is: **add a clock.** A filter that reads stdin in chunks, timestamps each chunk, and writes one JSON event line per chunk produces a valid cast. Verified locally against the v2 shape:

```json
{"version": 2, "width": 60, "height": 12, "timestamp": 1793338704, "env": {"TERM": "xterm-256color"}}
[0.0, "o", "echo alpha\r\n\u001b[?2004hbash-5.2$ echo alpha\r\n\u001b[?2004l\ralpha\r\n\u001b[?2004hbash-5.2$ "]
[0.485, "o", "echo beta\r\n\u001b[?2004l\rbeta\r\n"]
[0.485, "o", "\u001b[?2004hbash-5.2$ "]
```

308 bytes, 3 events, 0.97 s of real time — the same session that produced the 155-byte flat log. Delta encoding is the correct choice here: two writes can land in the same read chunk, and v3 intervals are what the current CLI writes anyway.

Prior art at this layer, so nobody has to re-derive it:

| Project | Approach | Output | Maturity signal |
|---------|----------|--------|-----------------|
| [asciicast-tools](https://github.com/dcoles/asciicast-tools) | `asciicast-pipe` filter + `tmux-asciicast-pane` wrapper; docs state the design goal explicitly ("recording from a tmux session using `tmux pipe-pane`") | asciicast v2 | Small, single-purpose, 16 commits |
| [tvmux](https://github.com/bitplane/tvmux) | Python 3.13 CLI + background server; **follows the active pane** across a window, dumping screen state and injecting control codes on switch, then stovepiping into asciinema | asciicast under `~/Videos/tmux/YYYY-MM/` | 16 stars; author documents the failure that motivated it (below) |
| [tmux-rewinder](https://github.com/blacknon/tmux-rewinder) | TPM plugin over [twatch](https://github.com/blacknon/twatch); `prefix+C-t` toggles, `prefix+R` replays in a popup | twatch JSONL trace | 4 stars; store-and-replay, not shareable video |
| [tmux-logging](https://github.com/tmux-plugins/tmux-logging) | `pipe-pane` to plain text, plus pane capture and full-history dump | `.log` text | Mature plugin, but no timing — a transcript, not a recording |

The negative result worth keeping, from the tvmux author: recording the whole client with `asciinema rec -c "tmux attach"` produced **~450 MB for one day** of hacking (`xz` down to ~15 MB), with no record of where the window splits were. Recording every pane is the opposite failure — background panes with huge output dominate. Following the *active* pane was the fix ([discourse](https://discourse.asciinema.org/t/tvmux-a-tmux-pane-recorder/985)).

### 5. Layer C — pane snapshots, when only the outcome matters

```bash
tmux capture-pane -p -t "=DEV repo branch 3100:"          # visible grid
tmux capture-pane -ep -t "=DEV repo branch 3100:" -S -    # attributes + full scrollback
```

`-e` emits escape sequences for text and background attributes, `-S -` starts at the top of the scrollback, `-J` rejoins rows tmux wrapped (which is why a reader wants `-J` and a recorder usually does not: wrapped rows are real rows of the grid). All from the local man page.

Poll at 1–5 s and you get a timelapse of an agent's run: no animation, every state, a few hundred KiB for an hour. This is the honest format for "watch the build go from red to green over 20 minutes", and the one to fall back on when a cast would be unrepresentably long.

[twatch](https://github.com/blacknon/twatch) is the sophisticated version of this layer: it wraps the app in a PTY, keeps `latest` plus checkpoint+delta screen history, diffs frames, and can export a selected frame as ANSI or SVG.

### 6. Layer D — pixels, when tmux chrome must be in frame

On this machine (`XDG_SESSION_TYPE=wayland`, GNOME, `xdg-desktop-portal-gnome` present), the portable route is the **desktop portal**: GNOME's built-in screencast or OBS over PipeWire.

- `ffmpeg -f x11grab` — X11 only; under a Wayland session it cannot see native Wayland windows.
- `wf-recorder` — wlroots compositors only (sway, Hyprland); not GNOME/Mutter.
- **OBS Studio / portal screencast** — works on GNOME Wayland, records a window or a region.

Buys: the status bar, the pane layout, images, non-text panes, and the exact font rendering. Costs: 10–100× the bytes, no text, no search, no speed-up without re-encoding.

### 7. Cast → video

| Tool | Input | Output | Mechanism | Notes |
|------|-------|--------|-----------|-------|
| [agg](https://docs.asciinema.org/manual/agg/) | asciicast v1/v2/v3, file/stdin/URL | **GIF** | Rasterizes in-process via gifski | Themes incl. dracula/nord/gruvbox, `--font-family`/`--font-size`, `--speed`, idle-time limiting, fps cap, last-frame duration, `--cols`/`--rows` re-render, Nerd Font symbols |
| [sh2mp4](https://github.com/bitplane/sh2mp4) | a command **or** `--cast-file` | **MP4** | Replays the cast inside xterm on an owned Xvfb display, ffmpeg captures and encodes | `--speed 8x` accelerates conversion (not playback timing); needs `Xvfb`, `xterm`, `openbox`, X11 utilities |
| [VHS](https://github.com/charmbracelet/vhs) | a `.tape` script | `.gif`, `.webm`, `.mp4` by extension | Drives `ttyd` in a headless browser, ffmpeg records it | Needs `ttyd` + `ffmpeg`; `vhs record` turns your own keystrokes into a tape |
| `ffmpeg -i in.gif out.mp4` | GIF | MP4 | Re-encode | Palette-quantized, so text goes soft; a fallback, not a plan |

Two capability gaps decide between them. `agg` cannot write MP4 — GIF only, by design. `sh2mp4` writes MP4 but reconstructs the terminal: fonts, themes, and colour handling are its choices, and its dependency list is X11-shaped. VHS is the only one that both writes MP4 natively and lets you *design* the demo — set the font size, the window size, the sleep between beats — which is the difference between a recording and a demo.

Local availability check on 2026-10-30: `ffmpeg` 6.1.1 present; `asciinema`, `agg`, `vhs`, `ttyd`, `ttyrec`, `xterm`, and `Xvfb` all absent. So `sh2mp4` needs `Xvfb`/`xterm`/`openbox` installed first, and VHS needs `ttyd` fetched separately (it is not in the Debian/Ubuntu repos the README points at).

### 8. agent-tty — the agent-native option

[coder/agent-tty](https://github.com/coder/agent-tty) is the one tool in this space aimed at the ask rather than at the mechanism. Its own framing: "like `agent-browser` / Playwright, but for terminal apps instead of web pages" — hand a real long-lived terminal to an agent, read the screen back, and get reviewable artifacts.

```bash
SID=$(agent-tty create --json -- /bin/bash | jq -r '.result.sessionId')
agent-tty run "$SID" 'pnpm test' --json
agent-tty wait "$SID" --text 'Test Files' --json
agent-tty snapshot "$SID" --format text --json
agent-tty screenshot "$SID" --json
agent-tty record export "$SID" --format webm --json
agent-tty destroy "$SID" --json
```

Where it lands against tmux, in its own comparison: tmux + `send-keys`/`capture-pane` gives you a pane and raw bytes, while agent-tty adds a **`wait`-for-condition primitive** (no sleep-and-grep), semantic snapshots, and PNG / `.cast` / WebM artifacts.

Constraints: Node `>=24 <27`; screenshots and WebM additionally need a Playwright Chromium install; state under `~/.agent-tty` (`AGENT_TTY_HOME` to relocate). It is a *replacement* for the pane, not a recorder for existing panes — so it fits "agent demonstrates a TUI it just built", not "record the session I already have running".

### 9. Wide comparison

|   | PTY recorder in pane | `pipe-pane` → cast | `capture-pane` polling | Portal / pixel capture | agent-tty |
|---|----------------------|---------------------|------------------------|------------------------|-----------|
| Sees agent keystrokes | Yes, real keys | Only echoed ones | Via the resulting text | Yes, as pixels | Yes |
| Time fidelity | Per byte | Per read chunk | Per poll interval | Per frame | Per frame |
| Survives agent restart | No | **Yes** | **Yes** | **Yes** | No (session-scoped) |
| tmux chrome in frame | No | No | No | **Yes** | No |
| Full-screen TUIs | **Yes** | Redraws only | Yes | **Yes** | **Yes** |
| Typical size | ~1 KB/s | ~0.3 KB/s | ~KB/min | MB/min | MB/min + cast |
| Native output | `.cast`, typescript | `.cast` | text / ANSI | `.mp4` / `.webm` | PNG, WebM, `.cast` |
| Needs tmux running | Yes | Yes | Yes | No | No |
| Install cost | `asciinema` or 0 (`script`) | a filter, or tvmux/asciicast-tools | 0 | OBS | npm + Chromium |

### 10. Recommendation

**Adopt `pipe-pane` → asciicast as the standing recorder, and treat the other layers as on-demand.**

1. **Recording is a property of the pane, not the process.** Agent sessions restart constantly; a recorder tied to the process ends at the first restart, and a recorder tied to the pane does not. That single property eliminates Layer A as the default, despite it being the more accurate one.
2. **The existing `devproc` log is already 90% of it.** `~/.pi/agent/bin/devproc` starts every DEV session as `"$cmd 2>&1 | tee '$log'"` with `log="/tmp/devproc-$slug.log"` — a flat, timestamp-free text file. Replacing that `tee` with the caster below upgrades every DEV session to a replayable cast in one line, with no change to how sessions are started or read.
3. **Reach for Layer A only when the demo is a TUI.** `asciinema rec -c "nvim"` inside the pane, or `agent-tty` if the agent is generating the proof itself.
4. **Reach for VHS when it is a demo, not a recording.** A `.tape` is a reproducible script — rerun it after a refactor and the demo stays true. That property has no equivalent in any capture layer here.
5. **Always publish the trimmed version.** Cast in hand, then `agg --idle-time-limit 1` → GIF, or `sh2mp4 --cast-file ... --speed 8x` → MP4, or `asciinema upload` → embeddable player. GitHub's CLI accepts MP4, MOV, and WebM in issues, PRs, and comments ([changelog](https://blog.github.com/changelog/2026-09-01-github-cli-media-in-issues-pull-requests-and-comments/), [attach-files docs](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)).

#### Recipe A — pane → cast, verified locally

```python
#!/usr/bin/env python3
# pane2cast.py — stdin (tmux pipe-pane) → asciicast v2 on stdout
import json, os, sys, time

cols, rows = int(os.environ.get("COLS", 80)), int(os.environ.get("ROWS", 24))
out = sys.stdout
out.write(json.dumps({"version": 2, "width": cols, "height": rows,
                      "timestamp": int(time.time()),
                      "env": {"TERM": "xterm-256color"}}) + "\n")
out.flush()
t0 = time.time()
while True:
    chunk = sys.stdin.buffer.read1(4096)
    if not chunk:
        break
    out.write(json.dumps([round(time.time() - t0, 3), "o",
                          chunk.decode("utf-8", "surrogateescape")]) + "\n")
    out.flush()
```

```bash
# start / stop for one pane; -O is the default, -o would make this a toggle
tmux pipe-pane -O -t "=DEV repo branch 3100:" \
  'COLS=120 ROWS=40 python3 ~/bin/pane2cast.py >> /tmp/dev-repo-branch-3100.cast'
tmux pipe-pane -t "=DEV repo branch 3100:"
```

Use `-t "=<name>:"` — the `=` and trailing `:` are what keep a bare session-name prefix from matching a longer sibling, the same targeting rule `devproc` documents.

#### Recipe B — chapter markers an agent can write

asciicast has a marker event (`[0.0, "m", "label"]`), and a marker line is a single append under `PIPE_BUF`, so an agent can drop one mid-recording without a lock:

```bash
printf '[0.001, "m", "phase: tests"]\n' >> /tmp/dev-repo-branch-3100.cast
```

Rarely worth it for a human, but it is the one part of the artifact an agent authors deliberately — a build/test/fix timeline the viewer can navigate. Atomicity of interleaved append on the same fd is [unverified] for this exact writer pairing; only do it if the cast later proves correctly ordered.

#### Recipe C — make it watchable, then ship it

```bash
asciinema play -i 2 session.cast                    # preview, idle clamped
agg --idle-time-limit 1 --speed 2 session.cast out.gif
sh2mp4 --cast-file session.cast out.mp4 --speed 8x
asciinema upload session.cast                       # embeddable player, secret link
```

### Gotchas

- **No `r` events from `pipe-pane`.** The header geometry is the only geometry; a pane resized mid-session replays at its original size, and the app's own redraw on resize is all that records the change.
- **No scrollback.** The stream starts at pipe-open. Snapshot the existing grid first if the recording must include it.
- **Alternate screen.** A full-screen app owns the screen while it runs; `capture-pane -a` reads the alternate screen deliberately, and `history-limit` bounds what a plain capture can reach.
- **`script`'s typescript has a header and footer line** (`Script started on …`). `scriptreplay` skips it correctly; a hand-rolled replay will print it as content.
- **Rounded intervals drift.** The v3 spec warns that rounding each interval to 3 decimals accumulates error over a long recording and recommends carrying the rounding error forward (error diffusion). A 40-minute agent session is long enough to care.
- **`agg` is GIF-only.** If MP4 is the deliverable, plan for `sh2mp4` or VHS, not `agg` + a re-encode.

## Open Questions

- Can `asciinema session` attach to an already-running PID, or must it own the PTY from exec? The docs describe `-c`/command spawning; attaching to a live pane's existing process is the shape that would collapse Layer A and Layer B.
- How much does the per-chunk read in Recipe A coalesce under a fast TUI repaint? A 4 KiB `read1` batches bursts into single events, which is fine for playback but loses sub-burst ordering.
- Whether `tvmux`'s active-pane follow is stable enough to vendor versus writing the 20-line caster — unmeasured here; 16 stars and an author-described "test of the release process" suggests vendoring the caster.
- Whether GitHub's MP4 attachment preserves playback in all viewer clients, or degrades to a download link in some.

## Related

- [Modern JavaScript Video Player Libraries — 2026 Landscape](./js-video-player-libraries.md) — if the recording is delivered as an embedded player rather than a file, the player choice is a separate decision.
- [T3 Code — Server, Desktop, Web, and Mobile Architecture](./t3-code-client-server-architecture.md) — libghostty-vt is a terminal engine that turns an output stream into screen state, the primitive a custom player needs.

## Changelog

- 2026-10-30 — created. `pipe-pane`→cast and `script`/`scriptreplay` pipelines verified locally on tmux 3.4 and util-linux 2.39.3.
