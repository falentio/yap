# Reference

Index of research files in `research/reference/`.

<!-- Add new entries here as: - [Title](./slug.md) — one-line description (YYYY-MM-DD) -->

## Entries

- [MATI LAMPU — Blackout Bar Brawl (Indonesian bar-fight board game)](./indonesian-blackout-bar-brawl.md) — Full design + rules for a 2–6 player fog-of-war brawl in a blacked-out Indonesian bar: a shared light level sets everyone's vision radius every round, noise markers steer an NPC security guard, KOs drop loot on the floor, and score is money + KOs, not survival. Includes a simulated engine with a 600-game balance run (2026-10-11)

- [Effect v4 Primitives — A Reader's Map](./effect-v4-primitives.md) — A beginner's orientation to the Effect v4 core: the `Effect<A, E, R>` mental model, laziness, `gen`/`fn`, the Option/Result/Exit/Cause error model, Context/Layer DI, Scope, Fiber, Ref/Queue/PubSub/Deferred, Stream, Schedule, Schema, and the dual API — every example executed against `effect@4.0.2` (2026-10-08)
- [oh-my-pi (omp) — Complete Agent Tool Inventory](./oh-my-pi-tools.md) — All 40 model-callable tools at v18.8.4 (30 built-ins + 3 hidden + 5 vibe controls + 2 gated custom), with approval tiers, load modes, gating settings, eval preludes, and internal URL schemes (2026-10-08)
- [Pi Package Map — What "Pi Core" Refers To](./pi-package-map.md) — "Pi core" is not a package: pi-ai supplies providers/streaming, pi-agent-core the Node-builtin-free agent loop, pi-coding-agent the tools/sessions/extensions/TUI product layer, and pi-durable is a second stack on chord that never uses agent-core (2026-10-29)
- [Pusher Channels WebSocket Protocol: Server Implementation Reference](./pusher-websocket-protocol.md) — Wire-level behavior for a Pusher-compatible server: protocol 7 handshake, ping/pong, the 4000/4100/4200 close-code bands, subscribe/auth signatures, presence and cache channels, encrypted-channel KDF, the signed HTTP API, and webhooks, anchored to pinned pusher-js/pusher-http/soketi source (2026-10-15)
- [Headless Browser Viewport Screenshots](./headless-browser-viewport-screenshot.md) — Three verified ways to capture just the viewport (Chrome `--window-size --screenshot`, agent-browser `set viewport` + `screenshot`, Playwright `clip`), with measured PNG dimensions, HiDPI scaling, device emulation, and the traps that silently change the image size (2026-10-29)
