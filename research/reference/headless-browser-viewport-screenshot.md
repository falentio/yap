---
title: Headless Browser Viewport Screenshots
category: reference
tags: [headless-chrome, screenshot, chromium, cdp, playwright, agent-browser, cli, devtools]
status: complete
created: 2026-10-29
updated: 2026-10-29
sources:
  - https://developer.chrome.com/docs/chromium/headless
  - https://playwright.dev/docs/screenshots
  - https://playwright.dev/docs/api/class-page#page-screenshot
confidence: high
---

# Headless Browser Viewport Screenshots

## Summary

- Yes. Capturing the viewport (not the full page) from a headless browser is a one-command problem: `google-chrome --headless --window-size=W,H --screenshot=out.png`, or `agent-browser set viewport W H` plus `agent-browser screenshot`.
- The image size is decided by whoever sets the viewport, and three setters can silently disagree: the OS window size (Chrome CLI), a CDP device-metrics override (agent-browser, Playwright), and the page's own `<meta name="viewport">` while device emulation is on.
- Chrome's `--screenshot` captures the viewport only. A full-page capture needs a driver that asks CDP to render beyond the viewport (`agent-browser screenshot --full`, Playwright `fullPage: true`).
- Every number below was measured on 2026-10-29 on this machine: Chrome 149.0.7827.155, agent-browser 0.40.0, Node v26.13.0, Linux. Each section carries the command that reproduces it.

## Details

### Route comparison

| dimension | Chrome CLI | agent-browser | Playwright |
|---|---|---|---|
| invocation | `--screenshot=out.png` | `screenshot out.png` | `page.screenshot({path})` |
| viewport control | `--window-size=W,H` | `set viewport W H` | `newContext({viewport})` |
| default viewport | 780x437 (measured) | 1280x577 (measured) | 1280x720 (documented) |
| HiDPI | `--force-device-scale-factor=N` | `set device <name>` | `deviceScaleFactor: N` |
| full page | not supported | `--full` | `fullPage: true` |
| sub-rect capture | no | no | `clip: {x,y,width,height}` |
| waits for load | load event only; `--virtual-time-budget` advances the clock | yes, on `open` | `waitUntil` option |
| installed here | yes | yes, 0.40.0 | browsers cached, npm package absent |

### Chrome CLI, one shot and no dependency

```bash
google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir=/tmp/shot-profile \
  --window-size=1280,720 \
  --screenshot=/tmp/shot.png file:///abs/path/page.html
```

Measured against a probe page that prints its own `innerWidth x innerHeight`:

| flags | PNG |
|---|---|
| none | 780x437 |
| `--window-size=1280,720` | 1280x720 |
| `--window-size=1280,720 --force-device-scale-factor=2` | 2560x1440 |

`--window-size` sets the window, and the screenshot is the viewport inside that window, so the two only match when the size is given explicitly. Chrome's help output does not list the screenshot flags at all: they are stable, but documented by behaviour rather than by flags.

`--headless` now means unified headless. The old implementation ships as a separate binary, `chrome-headless-shell`, since Chrome 132.0.6793.0 ([Chrome headless mode](https://developer.chrome.com/docs/chromium/headless)).

### agent-browser, the scripting route

```bash
agent-browser --session shot open http://localhost:3000/page
agent-browser --session shot set viewport 1280 720
agent-browser --session shot screenshot /tmp/vp.png          # viewport
agent-browser --session shot screenshot --full /tmp/full.png # full page
agent-browser --session shot close --all
```

| step | measured |
|---|---|
| `open` then `screenshot` | 1280x577 |
| `set viewport 1280 720` then `screenshot` | 1280x720 |
| `screenshot --full` | 1280x1875, equal to `document.scrollHeight` |
| `set device "iPhone 16 Pro"`, no viewport meta | 1206x2622, page saw `innerWidth=980` |
| same page with `width=device-width` | 1206x2622, page saw `402x874 dpr=3` |

Two command-shape facts worth memorising. The subcommand is `set viewport`, not `viewport`: a bare `viewport 1280 720` fails with `Unknown command: viewport`. And the device names are a fixed list, `iPhone 15`, `iPhone 16`, `iPhone 16 Pro`, `iPhone 17`, `iPad`, `iPad Pro`, `Pixel 9`, `Galaxy S25`; `iPhone 15 Pro` is rejected. Headless Chromium screenshots hide native scrollbars by default, and `--hide-scrollbars false` at launch keeps them.

Two flags that pay for themselves in review loops: `--annotate` overlays numbered labels matching the accessibility-tree refs, and `--if-changed` skips the write when the frame is pixel-identical.

### Playwright, pixel and clip control

Browsers are already cached here (`~/.cache/ms-playwright/chromium-1229`), but the npm package is not installed globally, so a first `npx playwright` call downloads the library.

```js
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'vp.png' });                                    // viewport
await page.screenshot({ path: 'full.png', fullPage: true });                  // full page
await page.screenshot({ path: 'clip.png', clip: { x: 0, y: 0, width: 600, height: 400 } });
```

`fullPage` is documented as a screenshot of the full scrollable page, "as if you had a very tall screen and the page could fit it entirely" ([Playwright screenshots](https://playwright.dev/docs/screenshots)). `clip`, `scale`, `type`, `quality`, and the per-call `animations`, `caret` and `mask` options live on the same method ([Page.screenshot](https://playwright.dev/docs/api/class-page#page-screenshot)).

### "Viewport" names three different things

The layout viewport is what CSS sees (`innerWidth`, `100vw`). The visual viewport is what the user can see at the current zoom. The screenshot is the visual viewport rasterised at the device scale factor. All three coincide on desktop and diverge under mobile emulation:

- Without `<meta name="viewport" content="width=device-width">` the mobile layout viewport falls back to 980 CSS px, so an emulated 402 pt phone reports `innerWidth=980` and shrinks the page to fit. Measured: 980x2131 at `dpr=3`, against 402x874 with the meta tag, both producing the same 1206x2622 PNG.
- `--force-device-scale-factor=2` doubles the PNG pixels and leaves the CSS viewport at 1280x720, so the image is 2560x1440.

## Gotchas

- **The default window is not an 800x600 screenshot.** It is an 800x600 window minus browser insets, measured at 780x437. Always pass `--window-size`.
- **`--screenshot` never captures below the fold.** A 1875 px document produced a 720 px image. The Chrome CLI has no full-page flag, so the driver must request a beyond-viewport capture over CDP.
- **A running Chrome blocks a second launch on the same profile.** Pass `--user-data-dir=<fresh dir>`, or the CLI reuses or refuses the live profile.
- **Scrollbars change both the image and the layout.** `--hide-scrollbars` for the CLI; agent-browser hides them unless launched with `--hide-scrollbars false`.
- **The CLI screenshots at the load event, not at settle.** Fonts, lazy images, or rendering that lands after load misses the frame; `--virtual-time-budget=1500` advances the clock past them. `agent-browser open` already waits. In Playwright, pass `waitUntil: 'networkidle'` or await a selector.
- **`--force-device-scale-factor` is a browser-wide flag, not a screenshot option**, so it also changes font rasterisation while media queries keep the CSS viewport width.
- **Device emulation without a viewport meta tag yields a 980 px layout viewport**, and the shot shows the page zoomed out rather than the mobile layout.
- **`file://` works** on all three routes, so a static probe page needs no server.

## Open Questions

- Whether the window insets behind the 780x437 default differ on macOS and Windows; only Linux was measured here.
- Whether any recent Chrome build screenshots past the viewport through `--screenshot` alone. No flag was found, but the CLI does not enumerate these flags, so the absence rests on a 720 px PNG over a 1875 px document rather than on documentation.

## Related

- [Reference index](./README.md)
- [Pi Package Map — What "Pi Core" Refers To](./pi-package-map.md)

## Changelog

- 2026-10-29 — created from local measurements on Chrome 149.0.7827.155 and agent-browser 0.40.0; Playwright and headless-history claims cited to the docs.
