---
title: High sensitivity + low DPI vs low sensitivity + high DPI in VALORANT
category: technology
tags: [valorant, mouse, dpi, sensitivity, edpi, gaming, input-latency]
status: complete
created: 2026-02-14
updated: 2026-02-14
sources:
  - https://en.akkogear.com/mouse-dpi-explained-and-why-there-is-no-universal-sweet-spot/
  - https://dignitas.gg/articles/the-best-mouse-dpi-settings-in-valorant-according-to-pro-players
  - https://www.vlr.gg/534792/does-dpi-really-matter
  - https://www.mouse-sensitivity.com/forums/topic/5041-high-dpi-and-low-sens-vs-low-dpi-and-high-sens/
  - https://rankedkings.com/blog/what-sens-do-pro-players-use-in-valorant
  - https://liquipedia.net/valorant/List_of_player_mouse_settings
  - https://www.overclock.net/threads/high-dpi-less-input-lag.1793088/
  - https://www.reddit.com/r/VALORANT/comments/13393aw/histogram_of_pro_edpis_it_shows_which_values_are/
  - https://gamingsmart.com/valorant-edpi-calculator/
confidence: medium
---

## Summary

**Short version: high DPI + low in-game sensitivity wins on measurable grounds, but by a margin small enough that comfort dominates.** The two configurations are not equivalent: at the same eDPI, the higher-DPI one feeds the game more sensor counts per physical movement, so each count maps to a smaller camera rotation. That removes coarse angular stepping ("pixel skipping") and can shave a fraction of a millisecond of first-count latency. What it does *not* do is make you meaningfully more accurate — several sources put the practical gain below human perception above roughly 800–1600 DPI.

The counter-argument for low DPI + high sens is not accuracy, it is **granularity of the sensitivity value**: at 400 or 800 DPI, in-game sensitivity (a 3-decimal float) can express a finer set of achievable eDPI values than at 1600 DPI. That is a convenience, not a performance edge.

The reason 400 DPI is so visible among pros is **inertia**, not optimisation: it is the CS:GO-era default carried over by players who never had a reason to change.

| Dimension | High DPI + low sens | Low DPI + high sens |
|---|---|---|
| eDPI (if tuned the same) | Identical by construction | Identical by construction |
| Angular granularity | Finer — more counts per inch | Coarser, more visible stepping |
| First-count / input latency | Marginally lower | Marginally higher |
| Hand tremor / jitter pickup | Higher — it reads more of your noise | Lower — low DPI filters micro-jitter |
| Sensitivity value precision | Coarser steps of eDPI | Finer steps of eDPI |
| Pro usage | Growing; 800 and 1600 now dominate | Legacy; 400 still common but shrinking |
| Ergonomics outside the game | Wrist-heavy desktop navigation | Arm-friendly desktop navigation |
| Realistic skill ceiling impact | Negligible above ~1600 | Negligible below ~400 |

---

## The arithmetic that makes this question well-posed

`eDPI = mouse DPI × in-game sensitivity` ([Akko](https://en.akkogear.com/mouse-dpi-explained-and-why-there-is-no-universal-sweet-spot/), [Corsair](https://www.corsair.com/us/en/explorer/tools/edpi/valorant-edpi-calculator/)). So 800 DPI × 0.5 and 1600 DPI × 0.25 are both 400 eDPI and produce the same centimetres-per-360.

That equivalence holds *only if the game scales input linearly*. VALORANT does apply a linear scale on top of raw input, so at equal eDPI the turn distance is the same. The difference is not **where** the crosshair goes, it is **how many discrete samples** describe the path it took to get there.

This is why "which is better" is answerable at all: the two settings differ in sampling resolution, not in overall speed.

---

## Argument 1 — Higher DPI gives finer angular granularity (real, small)

Each sensor count at 1600 DPI represents a quarter of the physical distance of one at 400 DPI. Because in-game sensitivity is lowered by the same factor, one count now rotates the camera by a quarter of the angle.

Akko's explainer is the cleanest technical statement of this:

> "At low DPI, each reported count represents a larger physical step... Raising DPI while proportionally lowering in-game sensitivity produces more sensor counts for the same physical movement. Each count then represents a smaller camera rotation. This can make very slow mouse movements appear smoother and preserve more detail before the game applies sensitivity scaling."
> — [akko, Mouse DPI Explained](https://en.akkogear.com/mouse-dpi-explained-and-why-there-is-no-universal-sweet-spot/)

The same source is equally clear that the effect is bounded:

> "The benefit is largest when the original combination is unusually low DPI and high in-game sensitivity. Once each physical movement is already represented by sufficiently fine counts, further increases have diminishing practical value."

So the gain is largest going from 400 → 800, present but smaller 800 → 1600, and effectively gone above ~3200. This maps onto the empirical community answer that "anything between 800 and 3200 is fine" ([VLR.gg](https://www.vlr.gg/534792/does-dpi-really-matter)).

At 400 DPI with a pro-typical 0.7 in-game value (107 cm/360 territory at 280 eDPI), you are in the range where coarse stepping is *visible* on slow tracking. That is the real case for not going below 800.

## Argument 2 — Higher DPI does not meaningfully reduce input latency

This is the most repeated claim and the one that most overstates the evidence. Akko, again, separates spatial quantisation from the latency pipeline:

> "DPI is not a report schedule... A higher DPI can make a moving mouse generate counts sooner because less physical distance is needed for the first count. That is a spatial quantization effect, not a guaranteed reduction in the complete device-to-pixel latency. Sensor processing, firmware, polling rate, game sampling, rendering, and display scanout still dominate the pipeline."
> — [akko](https://en.akkogear.com/mouse-dpi-explained-and-why-there-is-no-universal-sweet-spot/)

Click latency is independent of tracking DPI entirely — the switch and debounce routine do not get faster because you raised the sensor's counts-per-inch.

Community measurement anecdotes do report a small latency edge for higher DPI, on the order of a few milliseconds at most, and they consistently qualify it as imperceptible ([VLR.gg thread](https://www.vlr.gg/534792/does-dpi-really-matter), [overclock.net](https://www.overclock.net/threads/high-dpi-less-input-lag.1793088/)). Treat "high DPI reduces input lag" as *directionally supported, practically negligible* — `confidence: medium`, since the underlying tests are community-run rather than controlled.

There is also a real counter-effect on 1000 Hz-era mice: high DPI plus high polling can push the mouse's internal report queue toward saturation on some firmware. The practical reason 800 DPI was the old standard was that it played nicely with 1000 Hz polling, not that it was optimal in isolation.

## Argument 3 — Higher DPI picks up your hand tremor

The strongest argument in favour of **low DPI + high sens**, and it appears repeatedly in player reports:

> "With this DPI I was so inaccurate (I had low sens too), the mouse was catching my jittery hand... When I went to a lower DPI and higher sens... the DPI filtered out my hand jitters."
> — [mouse-sensitivity.com forum](https://www.mouse-sensitivity.com/forums/topic/5041-high-dpi-and-low-sens-vs-low-dpi-and-high-sens/)

Akko agrees this is a genuine cost: "hand tremor and surface texture are represented by more counts."

The distinction that matters: low DPI does not *smooth* anything — it **quantises away** sub-count movement. Your hand still jitters; the sensor just does not report it. For a player with shaky hands or a desk that transmits vibration, this reads as a stability advantage. For a player who wants fidelity to what their hand is doing, it is lost information.

It is the same mechanism as Argument 1, viewed from the opposite side. You cannot have "more samples" and "fewer jitter samples" at once.

## Argument 4 — Low DPI gives you finer eDPI steps

The only *strict* argument for low DPI in VALORANT, and it is about the UI, not the sensor.

In-game sensitivity is stored and entered to three decimals. At 1600 DPI, 0.001 sensitivity = 1.6 eDPI; at 400 DPI it is 0.4 eDPI. So a low-DPI player can land on an arbitrary target eDPI (say 283) precisely, where a 1600 DPI player is constrained to multiples of 1.6 ([VLR.gg discussion](https://www.vlr.gg/534792/does-dpi-really-matter)).

Whether this matters depends on whether you believe a 1.6-eDPI difference is perceptible. At a pro-typical 280 eDPI that is ~0.6% turn distance — well below the threshold where you would notice, let alone prefer. The argument is real but the effect size is trivial.

## What the professionals actually do

The pro data shows that DPI is a **carried habit**, not an optimisation.

Dignitas's 2021 breakdown of pro DPI ([source](https://dignitas.gg/articles/the-best-mouse-dpi-settings-in-valorant-according-to-pro-players)):

| DPI | Share of pros (2021) |
|---|---|
| 400 | 53% |
| 800 | 37% |
| Other (incl. 1600+) | 10% |

That 400-dominant split is now stale. Liquipedia's current [list of player mouse settings](https://liquipedia.net/valorant/List_of_player_mouse_settings) shows 800 and 1600 as the common values, with 400 appearing mostly among players whose settings date back to CS. The same Liquipedia table also shows 4000 Hz and 8000 Hz polling rates — which only became usable on high-DPI sensors.

Representative current pros, spanning the range:

| Player | DPI | Sens | eDPI |
|---|---|---|---|
| Alfajer | 400 | 0.45 | 180 |
| aspas | 800 | 0.40 | 320 |
| Derke | 400 | 0.74 | 296 |
| Demon1 | 1600 | 0.10 | 160 |
| TenZ | 1600 | 0.275 | 440 |
| f0rsakeN | 800 | 0.712 | 569.6 |

Sources: [rankedkings](https://rankedkings.com/blog/what-sens-do-pro-players-use-in-valorant), [Liquipedia](https://liquipedia.net/valorant/List_of_player_mouse_settings).

Two things follow. **First**, eDPI — not DPI — is what good players actually optimise; it clusters hard at 200–400 for most, up to ~570 for aggressive entry fraggers ([rankedkings](https://rankedkings.com/blog/what-sens-do-pro-players-use-in-valorant), [histogram of pro eDPIs](https://www.reddit.com/r/VALORANT/comments/13393aw/histogram_of_pro_edpis_it_shows_which_values_are/)). **Second**, the best players have converged on wildly different DPI at similar eDPI — Demon1 at 1600/0.10 plays the same effective speed as Alfajer at 400/0.45. If DPI strongly determined outcome, that spread would not exist at the top of the same competition.

The consensus in player discussion is blunt about this: "it doesn't matter and is just a comfort thing" ([VLR.gg](https://www.vlr.gg/534792/does-dpi-really-matter)).

## Recommendation

1. **Keep eDPI in the pro band unless you have a reason not to.** 200–400 eDPI covers the large majority of professionals; ~280 is the median. For VALORANT that is roughly 40–55 cm per 360°.
2. **Prefer 800 or 1600 DPI over 400.** At equal eDPI this removes coarse angular stepping and gives you headroom to run 2000–8000 Hz polling if your mouse supports it. There is no accuracy penalty for doing so, and no serious latency penalty for not doing it.
3. **Do not chase DPI above 3200.** The granularity gain is exhausted, some sensors apply smoothing or interpolation at high steps, and hand tremor becomes more of your input. Akko notes smoothing behaviour is "product-specific", so the ceiling is per-mouse.
4. **Pick DPI by what your hand wants, then set sensitivity by eDPI.** If you have jittery hands or play at high in-game sensitivity, 800 will feel more stable than 1600 and that stability is worth more than the granularity you give up.
5. **Never change sensitivity to fix a DPI question.** Adjust DPI and *inversely* adjust in-game sensitivity so eDPI stays fixed. Changing eDPI and DPI at the same time means you cannot tell which change did what to your aim.

The honest answer to the original framing: **high sens + low DPI is not "better" than low sens + high DPI, and neither is the reverse — but if you are picking blind, pick high DPI + low sens.** It has no downside that most players can feel, and it removes one source of coarse movement. It is not a competitive advantage; it is a marginally cleaner signal at the same effective speed.

## Gotchas

- **DPI deviation is real and non-trivial.** A mouse may report 800 DPI while actually delivering 794, and the deviation grows at higher nominal values. One user measured a G102 at 4.4% above spec ([Reddit](https://www.reddit.com/r/VALORANT/comments/13393aw/histogram_of_pro_edpis_it_shows_which_values_are/)). Two players at "the same eDPI" on different mice can be several percent apart in real cm/360. This swamps every effect discussed above.
- **eDPI does not transfer across games.** Field of view, yaw constants, and zoom multipliers differ. A CS eDPI is not a VALORANT eDPI at the same number ([akko](https://en.akkogear.com/mouse-dpi-explained-and-why-there-is-no-universal-sweet-spot/)).
- **Windows pointer speed and "enhance pointer precision" affect the desktop, not the game.** With raw input on, the in-game value is what counts. Do not mix them up when troubleshooting "my sens feels different".
- **Higher DPI costs you wrist comfort outside the game.** Several players report the desktop cursor at 1600 DPI forcing wrist movement, and switching back down ([VLR.gg](https://www.vlr.gg/534792/does-dpi-really-matter)). Lowering Windows pointer speed compensates, but then your game mouse *feel* and desktop mouse *feel* diverge.
- **Sources on this topic age fast.** The Dignitas data is from 2021 and its 53%/37% split for 400 vs 800 no longer describes the pro population. Liquipedia is the better current reference.

## Changelog

- 2026-02-14 — Created. `xbitlabs.com` sensor-smoothing article could not be fetched through TinyFish (`bot_blocked`) and its assertions were not incorporated; the smoothing threshold reasoning relies on the Akko piece instead. No fallback fetch method was used.
