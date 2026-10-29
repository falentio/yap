---
title: MiniMax Audio Plan vs ElevenLabs Plan — Which Is Worth the Money
category: product
tags: [tts, text-to-speech, pricing, minimax, elevenlabs, voice-cloning]
status: complete
created: 2026-10-15
updated: 2026-10-15
sources:
  - https://platform.minimax.io/docs/pricing/overview
  - https://elevenlabs.io/pricing
  - https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html
  - https://minimax-ai.chat/pricing/
  - https://minimax-ai.chat/audio/
  - https://www.toolcolumn.com/pricing/minimax-audio-pricing
confidence: medium
---

# MiniMax Audio Plan vs ElevenLabs Plan — Which Is Worth the Money

## TL;DR

- **Steady monthly speech volume, and speech is all you need: MiniMax Audio wins on raw cost, sometimes by 2–4×.** Its $5 Starter tier converts to roughly $0.05 per 1,000 HD characters against ElevenLabs' $0.20 at the $6 Starter tier ([realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html), [pricing](https://elevenlabs.io/pricing)).
- **Mixed workloads (speech + music + dubbing + SFX + an editor) or spiky/one-off volume: ElevenLabs wins.** One shared credit pool across every product, credits that roll over two months, and cheaper list-price pay-as-you-go per character than MiniMax ([pricing](https://elevenlabs.io/pricing)).
- **MiniMax's headline discount is a trap at the mid tier.** Points-per-dollar is *not* monotonic: the $5 and $999 tiers sit near $0.05/1,000 points while the $30 tier sits near $0.10/1,000 — Standard is the worst value on the ladder ([realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html), [minimax pricing](https://platform.minimax.io/docs/pricing/overview)).
- **Verdict:** "more worth the value" depends on *scope*, not price. **TTS only → MiniMax, at every volume band; ElevenLabs' subscription is the worst-priced TTS path in the comparison at 2.5–4× MiniMax's points rate.** Voice plus music/dubbing/SFX/an editor → ElevenLabs. See [If the use case is TTS only](#if-the-use-case-is-tts-only).

## Context

Question asked: compare the MiniMax audio subscription against the ElevenLabs subscription and decide which is worth the money. Both vendors sell a subscription *and* a metered API, and the subscriptions are not equivalent products: ElevenLabs credits are one pool covering TTS, STT, music, SFX, dubbing, voice changer, and image/video; MiniMax audio points cover voice generation on the audio line only, with music and video on separate meters.

Prices are published list prices read on 2026-10-15. ElevenLabs was serving a first-month promotional price at read time ($1 Starter, $11 Creator) — budgeting on the promo is what the sources warn against.

## Findings

### Plan ladders side by side

| Dimension | ElevenLabs | MiniMax Audio |
|---|---|---|
| Entry tier | $6/mo, 30,000 credits | $5/mo, 100,000 audio points |
| Mid tier | $22/mo, 121,000 credits | $30/mo, 300,000 audio points |
| Upper tier | $99/mo, 600,000 credits | $99/mo, 1,100,000 audio points |
| Team tier | $299/mo, 1.8M credits, 3 seats | $249/mo, 3.3M points, 500 voice slots |
| Business tier | $990/mo, 6M credits, 10 seats | $999/mo, 20M points, 800 voice slots |
| Free tier | $0, 10,000 credits/mo, commercial use excluded | Login points only, amount unpublished |
| Annual billing | 10 months for 12 (≈17% off) | 20% off ($48/$288/$950/$2,390/$9,590) |
| Effective $/1k units | ≈$0.17–$0.20 at every tier | ≈$0.05 entry & business, ≈$0.10 mid |
| Rollover | Up to 2 months, capped at 3× monthly quota | None — resets monthly, no top-ups published |
| Rate limit | ≈2 → 25 concurrent requests by tier | 10 → 800 RPM by tier |
| Seats | 3 (Scale) / 10 (Business) | Not sold as seats |

Sources: [pricing](https://elevenlabs.io/pricing), [minimax pricing](https://platform.minimax.io/docs/pricing/overview), [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html).

Unit note: 1 ElevenLabs credit = 1 character on Multilingual v2 (0.5–1 on Flash/Turbo); 1 MiniMax audio point = 1 HD character or 0.6 turbo characters, per MiniMax's subscription FAQ as quoted by [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html). MiniMax publishes point allowances but **not** the conversion factor ([minimax pricing](https://platform.minimax.io/docs/pricing/overview), [minimax-ai.chat](https://minimax-ai.chat/pricing/)), so every MiniMax per-character figure below is [unverified] against the primary source.

### The arithmetic behind the headline numbers

Every per-unit figure in this file is derived, not quoted. The derivations matter because the two vendors meter different things and neither publishes a clean cross-walk.

**ElevenLabs — credits are stable per dollar.** Credits per dollar are taken straight from the pricing page:

| Tier | Price | Credits | $ per 1,000 credits |
|---|---|---|---|
| Starter | $6 | 30,000 | $0.200 |
| Creator | $22 | 121,000 | $0.182 |
| Pro | $99 | 600,000 | $0.165 |
| Scale | $299 | 1,800,000 | $0.166 |
| Business | $990 | 6,000,000 | $0.165 |

The ladder flattens after Creator: doubling from Pro to Scale buys no discount per unit. Since 1 credit = 1 character on Multilingual v2, $/1,000 characters equals $/1,000 credits — $0.165 at the top end, $0.20 at entry. [pricing](https://elevenlabs.io/pricing)

**MiniMax — points per dollar are not monotonic.** Same extraction from the audio subscription table:

| Tier | Price | Audio points | $ per 1,000 points | ≈$ per 1,000 HD characters |
|---|---|---|---|---|
| Starter | $5 | 100,000 | $0.050 | $0.050 |
| Standard | $30 | 300,000 | $0.100 | $0.100 |
| Pro | $99 | 1,100,000 | $0.090 | $0.090 |
| Scale | $249 | 3,300,000 | $0.075 | $0.075 |
| Business | $999 | 20,000,000 | $0.050 | $0.050 |

Standard is a discontinuity: **six times Starter's price for three times the points.** Going $5 → $30 raises the unit cost 100%. The cheapest points on the ladder sit at the two extremes. The HD column converts at 1 point = 1 HD character; turbo stretches the same plan by ~66% because turbo costs 0.6 points per character. [minimax pricing](https://platform.minimax.io/docs/pricing/overview), conversion per [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html)

That inversion is the single most actionable finding: a buyer who reasons "I need more than Starter, let me move up one tier" lands on the worst-priced plan MiniMax sells, and on a plan with no rollover and no top-up to soften the miss.

**Why ElevenLabs' API is cheaper than its own subscription.** List rates are $0.08/1k characters for quality TTS (v3, v4, Multilingual v2) and $0.04/1k for Flash/Turbo [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html). Both sit *below* its $0.165–0.20/1k subscription rate. The subscription is therefore not a discount on characters — it is a bundle: the credit pool, the Studio/Dubbing surfaces, commercial licensing, and voice slots. A subscriber who only generates speech is paying a 2× character premium for the suite. A subscriber who uses Dubbing and Music is paying closer to fair value, because those are priced in the same credits at 2,000–10,000 credits/minute and 900 credits/minute respectively [pricing](https://elevenlabs.io/pricing).

**Why MiniMax's API is *more* expensive than its subscription.** Reverse direction: $60/M turbo = $0.060/1k, $100/M HD = $0.100/1k [minimax pricing](https://platform.minimax.io/docs/pricing/overview). Against $0.05–0.10/1k in points, the subscription is the discount, not the API. So the "which is cheaper" answer flips depending on how you pay — the same asymmetry that makes ElevenLabs' PAYG the cheaper of its two doors.

| | ElevenLabs | MiniMax |
|---|---|---|
| Subscription cheaper than API? | No — costs ~2× its own API rate | Yes — $0.05/1k points vs $0.10/1k HD API |
| Best price for 1M HD characters | ≈$800 (PAYG $0.08/1k) | $100 (API) / ≈$50 (points) |

### Cost per finished minute

Both vendors converge on ≈1,000 English characters per minute of narration ([realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html)), so the per-character and per-minute rankings agree.

| Workload | ElevenLabs | MiniMax |
|---|---|---|
| 10 min narration | $0.80 list (v4/multilingual) | $1.00 HD / $0.60 turbo pay-as-you-go; ≈$0.50 via points |
| 60 min audiobook block | ≈$4.80 | ≈$6.00 HD / $3.60 turbo |
| 1M characters (≈18 h audio) | ≈$800 at $0.08/1k | $100 HD / $60 turbo pay-as-you-go |
| Realtime agent speech | $0.08/min published | Not published; RPM-tiered only |

The 1M-character row is where the products diverge: 6M ElevenLabs subscription credits cost $990, while MiniMax pay-as-you-go sells the same 6M HD characters for $600 and turbo for $360. MiniMax's list API beats both its own subscription and ElevenLabs; ElevenLabs' list API ($0.08/1k) sits *below* its own subscription rate ($0.17–0.20/1k), which means an ElevenLabs subscriber pays a premium for the surrounding products, not for characters.

### What each dollar actually buys

| Capability | ElevenLabs subscription | MiniMax Audio subscription |
|---|---|---|
| TTS | Yes, six model families incl. v3/v4 | Yes, speech-2.8 + legacy, all models included |
| STT | Yes, Scribe v2, 330 credits/min | Paid API only, $0.38/hour, separate meter |
| Music | Yes, 900 credits/min | **Closed to new users since 2026-08-20** on the API; app-only |
| SFX / voice isolator / voice changer | Yes, same credit pool | No — not on the audio line |
| Dubbing / Studio editor | Yes, Dubbing Studio from $6 | No equivalent product surface |
| Images & video | Yes, included from Starter | Separate meters (video points, pay-as-you-go) |
| Instant voice cloning | From $6 Starter | Rapid Clone, $1.50/voice, charged at first synthesis |
| Professional voice cloning | From $22 Creator | Not tiered — one clone flow |
| Custom voice slots | 3 → 2,200 by tier | 10 → 800 by tier |
| Cloned-voice export | Not exportable as files | — |

Sources: [pricing](https://elevenlabs.io/pricing), [minimax pricing](https://platform.minimax.io/docs/pricing/overview), [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html).

This table is the decision. The two subscriptions are not competitors at the same job: ElevenLabs sells a **production suite** with speech at its centre; MiniMax sells **speech** with other modalities on separate meters — and its music API is closed to new users, a negative result worth recording.

### Hidden rules that erode the headline number

| Rule | ElevenLabs | MiniMax Audio |
|---|---|---|
| Rollover | 2 months, capped at 3× quota | None; over budget means upgrade or wait |
| Mid-cycle top-up | PAYG top-ups, 12-month validity | Not yet available |
| Cloning cost | Included, billed as credits | $1.50/voice at first synthesis; $3/voice Voice Design |
| Clone upkeep | Slot persists while the plan covers it | Voice **deleted after 7 days** if never synthesized |
| Long-form cap | 10,000 chars/request (v4) | 1,000,000 chars/request async |
| Free tier | Commercial use forbidden, attribution required | Login points, amount unpublished |
| Per-seat pricing | 3 seats at $299, 10 at $990 | No seats; per-account RPM ceiling |

Two of these change real value more than sticker price: ElevenLabs' rollover means a lumpy month wastes nothing, and MiniMax's no-top-up rule turns a size miss into an *upgrade*. On a hard $30/month budget, MiniMax Standard is the most brittle plan in either ladder — and also the tier with the worst points-per-dollar.

### Pick by workload

| Workload | Pick | Why |
|---|---|---|
| Audiobook / course narration, steady volume | MiniMax | 1M-char async requests, ≈$0.50 per 10 min via points, no chunking |
| Realtime voice agent in production | ElevenLabs | Published latency (~100 ms v4 Turbo, ~75 ms Flash) and concurrency |
| Marketing video needing voice + music + SFX | ElevenLabs | One credit pool; MiniMax music API closed to new users |
| Localisation / dubbing pipeline | ElevenLabs | Dubbing Studio is a product MiniMax does not sell |
| Batch voiceover, cost is the only axis | MiniMax | $60/1M turbo characters vs $80/1M ElevenLabs list |
| Lumpy or one-off usage, no subscription | ElevenLabs | PAYG $0.08/1k undercuts MiniMax's $0.10/1k HD; credits live 12 months |
| Team of 3+ sharing one bill | ElevenLabs | Seats from Scale; MiniMax sells none |
| Cloning many characters | MiniMax | $1.50/voice flat vs Professional Cloning gated at $22+ with slot caps |

### Five worked scenarios

Numbers below use the derived unit costs above. ElevenLabs uses its subscription rate ($0.18/1k at Creator) where a plan is specified, otherwise the PAYG list rate ($0.08/1k). MiniMax uses $0.05/1k points at Starter/$999, $0.09/1k at Pro, and the API rate for pay-as-you-go.

**1. Hobbyist — 25 minutes of narration a month (≈25k characters).**

| Option | Monthly cost | Headroom |
|---|---|---|
| MiniMax Starter $5 | $5 | 75% unused → gone (no rollover) |
| ElevenLabs Starter $6 | $6 | 17% unused → rolls 2 months |
| ElevenLabs Free | $0 | Exactly at quota; commercial use forbidden |

Winner: **ElevenLabs Free**, then Starter. At this volume MiniMax's larger quota is pure waste, and the loss of rollover costs nothing because there is nothing to roll.

**2. Solo builder shipping voice-enabled product — 200k characters/month, lumpy.**

| Option | Cost | Behaviour in a 350k month |
|---|---|---|
| MiniMax Starter $5 | $5 | Blows the 100k quota; only path is the $30 Standard jump |
| MiniMax Standard $30 | $30 | Covers it, but unit cost doubles |
| ElevenLabs Creator $22 | $22 | 121k base + rollover bank up to 363k absorbs the spike |
| ElevenLabs Creator + PAYG top-up | $22 + usage | Overage at $0.08/1k |

Winner: **ElevenLabs Creator**. The rollover bank (2× monthly, capped at 3× cumulative) is a free buffer that MiniMax does not offer at any price, and it is worth more than the 2.5× per-character discount when variance is the dominant term. [pricing](https://elevenlabs.io/pricing)

**3. Audiobook production — 1M characters, twice a year.**

| Option | Cost per book |
|---|---|
| MiniMax pay-as-you-go, HD | $100 |
| MiniMax pay-as-you-go, turbo | $60 |
| ElevenLabs PAYG v4 ($0.08/1k) | $800 |
| ElevenLabs Business $990/mo | $990 for a month you barely use |

Winner: **MiniMax pay-as-you-go, decisively** — 8× cheaper than ElevenLabs list, and it sidesteps subscriptions entirely. The 1M-character async endpoint removes the 10k-char/request chunking that ElevenLabs v4 imposes, so the pipeline is simpler too. [minimax pricing](https://platform.minimax.io/docs/pricing/overview), [realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html)

**4. Marketing team — voice + music + SFX + dubbing, 300k characters, 20 music tracks, 3 videos dubbed per month.**

| Option | Cost | Gap |
|---|---|---|
| ElevenLabs Creator $22 | 121k credits | Short on characters alone |
| ElevenLabs Pro $99 | 600k credits | ≈333k credits consumed (300k TTS + 18k music + 15k dubbing); illustrative — real dubbing bills per finished minute |
| MiniMax Pro $99 + separate music/video | $99 speech | Music API closed to new users; SFX, isolator, dubbing not sold |

Winner: **ElevenLabs Pro**. MiniMax cannot serve this workload at any tier — the credit pool is the product. Studio, Dubbing Studio, and SFX being priced in the same currency is the whole reason to pay the character premium in scenario 2 and 4.

**5. Realtime voice agent — 10,000 minutes/month.**

| Option | Cost | Notes |
|---|---|---|
| ElevenLabs Business | $990 + $0.08/min speech engine | Published latency and per-plan concurrency; 10 seats |
| MiniMax Business | $999 / 20M points | 20M points ≈ 20M HD chars ≈ 20,000 minutes, so quota covers it — but no published latency figure |

Winner: **ElevenLabs if a latency number must appear in a contract; MiniMax if you self-benchmark.** MiniMax is ~2× cheaper per minute here (≈$0.05 vs $0.08 plus subscription) but publishes only RPM tiers (10 → 800), not latency. This is a case where the cheaper vendor is the riskier choice, and the risk is measurable — run the agent on both for a week.

**What the five scenarios share:** ElevenLabs takes the small, the spiky, the multi-modal and the realtime case; MiniMax takes the bulk-narration and cost-only cases. No single "which is more worth it" answer survives contact with a concrete use case, which is why the verdict below is conditioned rather than ranked.

### If the use case is TTS only

This is the case the plan tables above were built to answer, and it collapses the comparison to a single dimension: **cost per character, at your monthly volume, with the rules that claw spend back.** Everything ElevenLabs sells beyond TTS — Dubbing, Music, SFX, Voice Isolator, Studio, image/video, STT — stops counting, which means the premium in its $0.165–0.20/1k subscription rate buys nothing.

**Ranked by cost per 1,000 characters, TTS only:**

| Rank | Path | $/1k chars | Fit |
|---|---|---|---|
| 1 | MiniMax audio points, Starter ($5/100k) | **$0.050** | Only if 100k/mo is enough |
| 1 | MiniMax audio points, Business ($999/20M) | **$0.050** | Volume play |
| 3 | MiniMax pay-as-you-go, speech-2.8-turbo | $0.060 | No subscription, no quota |
| 4 | MiniMax audio points, Scale ($249/3.3M) | $0.075 | |
| 5 | ElevenLabs pay-as-you-go (Flash/Turbo) | $0.080 | Needs a plan to top up, but the balance beats subscription credits |
| 6 | MiniMax audio points, Pro ($99/1.1M) | $0.090 | |
| 7 | MiniMax audio points, Standard ($30/300k) | $0.100 | **Avoid** |
| 7 | MiniMax pay-as-you-go, speech-2.8-hd | $0.100 | |
| 9 | ElevenLabs public list rates (v3/v4/Multilingual v2) | ≈$0.080 | |
| 10 | ElevenLabs subscription credits, any tier | $0.165–0.200 | **Worst path in the comparison** |

Sources as above; ElevenLabs PAYG minimum top-up is $5, balance expires 12 months after purchase, and subscription credits are consumed *before* PAYG balance ([docs](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)).

**The decisive number:** for pure TTS, ElevenLabs' subscription is **2.5–4× MiniMax's cheapest points rate**, and its own top-up balance undercuts its subscription by roughly half. There is no TTS-only workload where paying ElevenLabs for subscription credits is the right move — the only reason to hold an ElevenLabs plan is to unlock higher voice-slot counts, higher concurrency, and 44.1 kHz PCM output, which are *capability* gates rather than character pricing.

**So the choice reduces to volume:**

| Monthly characters | Recommended | Monthly cost | Why |
|---|---|---|---|
| ≤ 100k | MiniMax Starter, $5 | $5 | Cheapest rate in the comparison |
| 100k–300k | MiniMax PAYG turbo, no subscription | $6–$18 | Avoids the $30 Standard trap entirely |
| 300k–1.1M | MiniMax Pro $99 toward the top of the band, else PAYG | $18–$99 | Compare against PAYG: at $0.06/1k, 1.1M costs $66 on PAYG vs $99 on Pro |
| 1.1M+ | MiniMax PAYG turbo ($60/M) or Business points at $0.05/1k | $60+/M | PAYG stays cheaper until ~1.67M chars/mo |

The 300k–1.1M row is the one worth checking: because MiniMax's *own* pay-as-you-go ($0.06/1k turbo) is cheaper than its *own* Pro subscription ($0.09/1k), the subscription only wins if you need the voice slots (250) and the 200 RPM ceiling. For a TTS-only pipeline that runs batch jobs, PAYG is the correct answer up to roughly 1.67M characters/month.

**What would flip this back to ElevenLabs, for TTS only:** (a) quality — if a blind test on your script and language shows ElevenLabs v3/v4 clearly better, and the difference matters for the product, the 2–4× premium is a *quality* purchase, not a pricing one; (b) a concurrency or latency requirement MiniMax's RPM tiers cannot meet; (c) 44.1 kHz PCM output for downstream mastering, which ElevenLabs gates at the $99 Pro tier; (d) a voice library dependency — ElevenLabs' ~11,000-voice library against MiniMax's ~300 system voices, though ElevenLabs' figure counts community uploads.

Everything else — rollover, seats, dubbing, music — is noise once the scope is TTS only, which is why the earlier "workload decides" verdict resolves to a single recommendation here.

### The verdict

1. **MiniMax is the better *voice* subscription.** Per unit of speech it is 2–4× cheaper at entry and business tiers, it accepts audiobook-length requests in one call, and its pay-as-you-go API undercuts its own subscription. For a product whose only audio need is TTS, paying $22–99 to ElevenLabs buys products you will not use.
2. **ElevenLabs is the better *audio team* subscription.** Credit pool, two-month rollover, dubbing, music, SFX, and paid seats mean a media team billing hours rather than characters gets more per dollar. Its $0.08/1k pay-as-you-go also removes the reason to subscribe if usage is lumpy.
3. **Skip MiniMax Standard ($30).** Worst points-per-dollar on its own ladder, and the tier most exposed to no-top-up and no-rollover rules. Take $5 Starter or jump to $99 Pro.
4. **Budget on list price.** ElevenLabs was running a first-month promo at read time; the sources warn explicitly against planning around promotions.

Concrete recommendation for a solo builder shipping a voice-enabled product with occasional demo videos: **MiniMax $5 Starter plus ElevenLabs pay-as-you-go top-ups**, rather than either subscription at $22–30. Speech prices at the MiniMax rate, music/SFX/dubbing stay available when a video needs them, and no unused credits are paid for on either side.

If you want one sentence: **ElevenLabs costs about twice as much per spoken character and is worth it only when you use the suite; MiniMax is cheaper per character at every tier that matters and is the only one of the two worth subscribing to for speech alone.** The wrong purchase is a MiniMax plan sized above Starter without needing the quota, or an ElevenLabs plan bought for characters it will not be used for.

### The risks each choice carries

Value is expected cost, not list cost, and the two vendors fail differently.

| Risk | ElevenLabs | MiniMax Audio |
|---|---|---|
| Quota overrun mid-cycle | PAYG top-up at list rate; no forced upgrade | Upgrade or wait; no top-up published |
| Unused quota | Rolls 2 months, caps at 3× | Expires at cycle end |
| Vendor lock-in on voices | Clones cannot be exported as files; re-clone required to migrate | Same — clones live on-platform |
| Clone lifecycle surprise | Slot persists while plan active | **Deleted after 7 days** if never synthesized — a project pause silently costs you the voice |
| Model deprecation | Six model families, gradual deprecation | Music/lyrics APIs closed to new users 2026-08-20; music paid APIs no longer sold |
| Latency guarantee | Published (~100 ms v4 Turbo, ~75 ms Flash) | Unpublished; RPM tiers only |
| Data use | Help center: customer data used to improve models by default, opt-out available; TTS page says no training without consent — treat the account setting as authoritative | ToS: user retains ownership, grants MiniMax a licence to use content to provide and improve services |

The 7-day clone deletion is the sharpest asymmetry nobody prices: on MiniMax, every cloned voice must be used in a synthesis call within a week of being created or it disappears, and the $1.50 is charged at that first synthesis — so a voice you set up "for later" is a cost you may pay twice. On ElevenLabs a clone sits in a slot until the plan stops covering the slot.

Lock-in is symmetric and worth stating plainly: **neither platform lets you take a cloned voice away.** Migrating in either direction means re-cloning, re-verifying, and re-testing every voice, which for a project with more than a handful of narrator voices dwarfs any per-character saving. That is the strongest argument for picking on suite fit and staying.

## Open Questions

- **The MiniMax point-to-character factor is not on MiniMax's own docs.** "1 point = 1 HD character / 0.6 turbo character" comes from MiniMax's subscription FAQ as quoted by a third party ([realaitest](https://www.realaitest.com/reviews/elevenlabs-vs-minimax.html)); the official page publishes allowances only. Verify in the console before sizing a tier.
- MiniMax publishes no latency figure, only RPM tiers — any realtime-agent decision on MiniMax should be self-tested.
- MiniMax's consumer page `minimax.io/audio/subscribe` errored on fetch (2026-10-15), so app-side plan details (storage and traffic limits in the [toolcolumn](https://www.toolcolumn.com/pricing/minimax-audio-pricing) listing) could not be confirmed first-hand.
- The ElevenLabs share numbers for dubbing/music credits and the MiniMax point→character factor are both third-party-quoted; the official pages publish the plans and allowances but not the cross-walk. Treat any cost model built on this file as ±25% until checked against a real invoice.
- No blind A/B quality test was run. Both 2026-10 flagships (Eleven v4, Speech 2.8) claim emotional-delivery gains; price does not settle quality.

## Related

- [Product index](./README.md)
- [ElevenLabs Eleven v4 vs Multilingual v2 — Indonesian Narration for Reels](../technology/elevenlabs-v4-vs-v2-multilingual-indonesian-narration.md) — which ElevenLabs model to pick for Indonesian short-form narration, and what it costs per take
- [Upstash Box vs Cloudflare Sandboxes — Price Comparison](./upstash-box-vs-cloudflare-sandbox.md) — same shape of analysis for compute sandboxes

## Changelog

- 2026-10-15 — added a TTS-only ranking section, moved ahead of the general verdict, since TTS-only is the scope that decides the question; added ElevenLabs PAYG top-up rules.
- 2026-10-15 — expanded: added unit-cost derivations for both ladders, a points-per-dollar monotonicity table, five worked scenarios, and a risk comparison. Corrected a duplicated row in scenario 3.
- 2026-10-15 — created. Prices read from official pages on 2026-10-15; MiniMax per-character figures derived from a third-party-quoted conversion factor and flagged.
