#!/usr/bin/env bash
# ============================================================================
# Headless smoke test for index.html over file:// (no server, no bundler).
#
# Proves the page: loads clean, runs a CPU-vs-CPU game in a real browser,
# renders the board + log, advances turns, and never throws.
# Prints PASS/FAIL and exits non-zero on failure so it can gate a commit.
#   ./browser-smoke.sh
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")"

BIN=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  p="$(command -v "$c" 2>/dev/null)" || continue
  # the Ubuntu chromium-browser is a snap stub that cannot run headless; skip it
  if "$p" --version >/dev/null 2>&1; then BIN="$p"; break; fi
done
if [ -z "$BIN" ]; then echo "SKIP: no working chrome/chromium on PATH"; exit 0; fi
echo "browser: $("$BIN" --version)"

PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

fails=0
check () { # name, file, needle
  if grep -qF -- "$3" "$2"; then echo "  PASS  $1"; else echo "  FAIL  $1 (missing: $3)"; fails=$((fails+1)); fi
}
dump () { # url, budget, outfile
  "$BIN" --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" \
    --virtual-time-budget="$2" --dump-dom "$1" > "$3" 2>/dev/null
}
# The error handler writes the banner as ">JS ERROR: ..." ; the inline script
# source contains "'JS ERROR: '" (a quote, not '>'), so this cannot false-positive.
assert_clean () { # file, label
  if grep -q '>JS ERROR:' "$1" || grep -q '<title>ERR:' "$1"; then
    echo "  FAIL  $2: runtime JS error"; grep -o 'JS ERROR:[^<]*' "$1" | head -3; fails=$((fails+1))
  else
    echo "  PASS  $2: no runtime JS error"
  fi
}

echo "== 1. cold load, setup screen =="
dump "file://$PWD/index.html" 4000 /tmp/blb_setup.html
check "setup screen rendered"    /tmp/blb_setup.html 'Mulai Brawl'
check "archetype grid rendered"  /tmp/blb_setup.html 'Tukang Parkir'
check "help text rendered"       /tmp/blb_setup.html 'Pak Satpam'
assert_clean /tmp/blb_setup.html "cold load"

echo "== 2. auto-start, CPU vs CPU, seeded 4-player game =="
dump "file://$PWD/index.html#auto=0&seed=7&total=4" 20000 /tmp/blb_auto.html
check "game screen visible"      /tmp/blb_auto.html 'id="game" style="display: grid;"'
check "round counter rendered"   /tmp/blb_auto.html 'Ronde <b>'
check "log has real entries"     /tmp/blb_auto.html 'giliran'
check "canvas present"           /tmp/blb_auto.html '<canvas id="cv"'
check "player panel rendered"    /tmp/blb_auto.html 'Poin (duit+3KO+HP)'
assert_clean /tmp/blb_auto.html "cpu game"

echo "== 3. a full game runs to completion in the browser =="
# The engine already proved termination over 400 games; here we prove the UI
# can drive a whole game to the results screen without throwing. The log is
# capped at 60 lines, so completion (not log length) is the real signal.
dump "file://$PWD/index.html#auto=0&seed=11&total=5" 90000 /tmp/blb_long.html
check "banner shows GAME OVER"   /tmp/blb_long.html '>GAME OVER — '
check "results modal opened"     /tmp/blb_long.html 'class="modal show"'
check "winner still on feet"     /tmp/blb_long.html 'class="win"'
check "result columns rendered"  /tmp/blb_long.html 'Poin</th>'
assert_clean /tmp/blb_long.html "long run"

echo
if [ "$fails" -eq 0 ]; then echo "BROWSER SMOKE TEST: ALL CHECKS PASSED"; else echo "BROWSER SMOKE TEST: $fails FAILED"; fi
exit $fails
