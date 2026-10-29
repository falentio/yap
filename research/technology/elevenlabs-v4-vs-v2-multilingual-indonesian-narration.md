---
title: ElevenLabs Eleven v4 vs Multilingual v2 — Indonesian Narration for Reels
category: technology
tags: [tts, elevenlabs, eleven-v4, multilingual-v2, indonesian, reels, narration, voice-quality]
status: complete
created: 2026-10-20
updated: 2026-10-20
sources:
  - https://elevenlabs.io/docs/overview/models
  - https://elevenlabs.io/docs/help-center/other/what-languages-do-you-support
  - https://elevenlabs.io/pricing/api
  - https://help.elevenlabs.io/hc/en-us/articles/17883183930129-What-models-do-you-offer-and-what-is-the-difference-between-them
  - https://help.elevenlabs.io/hc/en-us/articles/13298164480913-What-s-the-maximum-amount-of-characters-and-text-I-can-generate
  - https://help.elevenlabs.io/hc/en-us/articles/35869113958801-How-much-does-it-cost-to-generate-using-Eleven-v3
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert
  - https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
  - https://elevenlabs.io/docs/overview/capabilities/text-to-speech
  - https://elevenlabs.io/blog/v3-audiotags
  - https://elevenlabs.io/text-to-speech/indonesian
  - https://elevenlabs.io/text-to-speech
  - https://invideo.io/blog/elevenlabs-ai-voice-models/
  - https://cloudzat.com/elevenlabs-v3-vs-multilingual-v2/
  - https://z.tools/blog/eleven-v3-vs-multilingual-v2-when-each-wins
  - https://www.reddit.com/r/ElevenLabs/comments/1rua838/three_studio_issues_for_audiobook_production/
confidence: medium
---

# ElevenLabs Eleven v4 vs Multilingual v2 — Indonesian Narration for Reels

## TL;DR

- **Use Eleven v4 (`eleven_v4`) for Indonesian Reels.** Indonesian (`id`) is on v4's 90+ language list and on Multilingual v2's 29 ([models doc](https://elevenlabs.io/docs/overview/models)), but v4 carries the audio-tag direction system and the higher quality ceiling, which is what makes a 20–45 second read land ([audio tags](https://elevenlabs.io/blog/v3-audiotags), [pricing](https://elevenlabs.io/pricing/api)).
- **Price is identical: $0.08 per 1K characters for both** ([API pricing](https://elevenlabs.io/pricing/api)). The model choice costs you nothing; the only extra spend is regeneration when a v4 take misses.
- **v4's 5,000-character/request limit is not a constraint for Reels.** A 60-second Indonesian script is roughly 800–1,000 characters ([unverified] — derived from typical speaking rates, see [Script length](#script-length-vs-the-request-cap)). Multilingual v2's 10,000-character limit solves a problem Reels does not have ([limits](https://help.elevenlabs.io/hc/en-us/articles/13298164480913-What-s-the-maximum-amount-of-characters-and-text-I-can-generate)).
- **Multilingual v2's real advantage is stability across long text**, the thing ElevenLabs and its own support staff call out for long-form ([help center](https://help.elevenlabs.io/hc/en-us/articles/17883183930129-What-models-do-you-offer-and-what-is-the-difference-between-them), [Reddit support reply](https://www.reddit.com/r/ElevenLabs/comments/1rua838/three_studio_issues_for_audiobook_production/)). A Reel is one short, isolated take, so drift between paragraphs is a non-issue.
- **Neither model ships an Indonesian voice by default.** Accent and locality come from the **voice** you pick, not the model ([TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)). Indonesian-specific voices are a filter in the voice library, not a model property ([Indonesian TTS page](https://elevenlabs.io/text-to-speech/indonesian)).
- **Fall back to Multilingual v2 when** a v4 take keeps hallucinating or drifting, or when you batch-produce a long series with one locked voice and want minimum regeneration ([Reddit support reply](https://www.reddit.com/r/ElevenLabs/comments/1rua838/three_studio_issues_for_audiobook_production/)).

## Context

Question asked: for **Indonesian narration for Reels**, which ElevenLabs model — Eleven v4 or Eleven Multilingual v2?

The workload has a specific shape that decides the answer before any quality judgment:

- **Short.** A Reel is 15–90 seconds of audio; the median script is a couple of paragraphs.
- **Single-voice, isolated.** One narrator, one take, no chapter-to-chapter continuity requirement.
- **Performance-matters.** Social narration lives or dies on delivery — a hook that sounds read-aloud is scrolled past.
- **Regeneration-heavy.** Creators routinely generate 3–6 takes and pick the best; ElevenLabs even prices in "up to 2 free regenerations" per identical generation ([TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)).
- **Language-specific quality.** Indonesian prosody, loanwords (English tech terms are pervasive in Indonesian marketing copy), and place/brand names are where TTS breaks ([best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)).

## Findings

### Side by side

| Dimension | Eleven v4 | Eleven Multilingual v2 |
|---|---|---|
| Model ID | `eleven_v4` | `eleven_multilingual_v2` |
| Status | Current flagship | Previous generation, still current-default for TTS ([API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)) |
| Indonesian (`id`) | Yes | Yes |
| Language count | 90+ | 29 |
| Request cap | 5,000 chars | 10,000 chars |
| Price (API) | $0.08 / 1K chars | $0.08 / 1K chars |
| Credits (UI) | 1 credit per character | 1 credit per character |
| Audio tags | Yes (`[whispers]`, `[excited]`, `[sighs]`, …) | No |
| SSML | Not supported — tags replace it | No — alias tags + pronunciation dictionaries |
| Pronunciation control | Inline IPA in slashes across 70+ languages | Pronunciation dictionary (alias tags), no phoneme tags on v2-multilingual |
| Multi-speaker dialogue | Yes, via Text to Dialogue | No |
| Voice cloning | High-fidelity, reliable speaker preservation over long text | PVC-capable, the more consistent cloning path per support |
| Best-fit scenarios | Character VO, emotional dialogue, audiobook, multilingual projects | Voiceovers, audiobooks, content creation, stable long-form |
| Consistency over long text | Lower — the documented weak spot | Higher |
| Latency | Not the low-latency default | Higher than Flash, same ballpark as v4 for offline work |

Sources for every cell: [models](https://elevenlabs.io/docs/overview/models), [API pricing](https://elevenlabs.io/pricing/api), [model help article](https://help.elevenlabs.io/hc/en-us/articles/17883183930129-What-models-do-you-offer-and-what-is-the-difference-between-them), [limits](https://help.elevenlabs.io/hc/en-us/articles/13298164480913-What-s-the-maximum-amount-of-characters-and-text-I-can-generate), [best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices).

### Indonesian support is a non-differentiator

Both models list `id` as supported ([models doc](https://elevenlabs.io/docs/overview/models)). ElevenLabs also publishes a dedicated [Indonesian TTS landing page](https://elevenlabs.io/text-to-speech/indonesian) that positions Indonesian for "video voiceovers for ads, YouTube videos, or animation" — the Reels use case exactly — and shows sample copy with inline audio tags (`[sarcastically]`, `[giggles]`, `[whispers]`), which is v3/v4-only syntax. That page is the strongest signal that ElevenLabs treats Indonesian + tags as a first-class combination.

What neither model guarantees is **a native-sounding Indonesian accent out of the box**. ElevenLabs' own guidance: "For the most natural results, choose a voice with an accent that matches your target language and region" ([TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)). Voices are multilingual containers; an American-English voice reading Indonesian will sound like Indonesian spoken by an American. The voice is the variable that matters most, and it is orthogonal to the model choice.

[unverified] No published Indonesian-specific MOS or blind-preference score exists for v4 vs Multilingual v2. ElevenLabs' model docs publish quality claims per model in prose, not per language. Treat "v4 sounds better in Indonesian" as a hypothesis you settle with an A/B on your own script, not as a documented fact.

### Audio tags are the reason v4 wins for Reels

v4 (and v3 before it) does not support SSML; bracketed audio tags replace the whole SSML tag set ([audio tags 101](https://elevenlabs.io/blog/v3-audiotags)):

| SSML you would have written | v4 equivalent |
|---|---|
| `<break time="1s">` | `[pause]`, an ellipsis, or a line break |
| `<prosody rate="slow">` | `[slowly]`, `[drawn out]` |
| `<prosody rate="fast">` | `[rushed]` |
| `<emphasis>` | `[shouts]` or capitalization |
| `<prosody pitch="high">` | `[excited]` and similar emotion tags |
| `<prosody pitch="low">` | `[softly]`, `[sorrowful]` |

For a Reel that means one thing concretely: **the hook can be directed** instead of regenerated until it happens to land. `[whispers]` before the reveal, `[laughs]` on the punchline, `[excited]` on the CTA. Multilingual v2 has no equivalent — its only emotional input is the text itself and the Stability/Style settings.

The cost of that control: **the model speaks anything you do not bracket away**, and tags occasionally get read aloud instead of performed. Community reports on v3 are explicit — "a lot of the times I generate something its reading the audio tags instead of changing to the inflection" ([r/ElevenLabs](https://www.reddit.com/r/ElevenLabs/comments/1mzdo3q/for_those_having_success_v2_or_v3/)). Budget regeneration for a tag being vocalised.

### Script length vs the request cap

v4's 5,000-character ceiling and Multilingual v2's 10,000 are both far above what a Reel needs ([limits](https://help.elevenlabs.io/hc/en-us/articles/13298164480913-What-s-the-maximum-amount-of-characters-and-text-I-can-generate)). Reels run 15–90 seconds; at natural Indonesian narration pace (~2.5–3.5 words/second [unverified], Indonesian averaging ~7 characters per word including the trailing space [unverified]) a 60-second script lands near 1,000 characters. Even a 3-minute spoken piece stays under 3,000.

Where the cap does bite: ElevenLabs' own pricing comparison puts v3 at a **5,000-character limit** and describes Multilingual v2 as "stable on long-form generations" with a **10,000-character limit** ([API pricing](https://elevenlabs.io/pricing/api)). For an audiobook chapter, v2's headroom and stability win outright; for a Reel, both limits are dead letter.

### Stability is Multilingual v2's one real edge

ElevenLabs' models page is hedged on this, calling v4's consistency "reliable speaker preservation across long text" ([models](https://elevenlabs.io/docs/overview/models)) while describing Multilingual v2 as "Produces consistent, high-quality audio output" and "Stable Quality" ([same page](https://elevenlabs.io/docs/overview/models)). An ElevenLabs support engineer answering an audiobook thread put it plainly:

> "v3 is more prone to hallucinations and inconsistencies … There's no seed-pinning or setting that reliably prevents it. If you need consistent results for a full audiobook, **Multilingual v2** is currently the more reliable model for production work." — [r/ElevenLabs, ElevenLabs staff reply](https://www.reddit.com/r/ElevenLabs/comments/1rua838/three_studio_issues_for_audiobook_production/)

That thread is about v3, not v4, and it is 7 months old at the time of writing. v4's documented improvements are for cloning fidelity and speaker preservation, not for eliminating hallucination ([models](https://elevenlabs.io/docs/overview/models)). Treat it as a live risk, not a settled one.

For a Reel the risk shape is different from an audiobook:

| Failure | Audiobook cost | Reel cost |
|---|---|---|
| Accent drift mid-text | Breaks a 300-page project | Invisible — the take is short |
| Hallucinated word | Whole chapter regen | Regenerate the 1 line |
| Inconsistent energy across sessions | Ruins the whole book | Irrelevant — one session per Reel |

Reels convert the failure modes that favour v2 into non-events, and leave v4's one-vs-one advantage (expressive direction) fully intact.

### Pricing is a flat tie — the cost model you actually pay

Both models are **$0.08 per 1,000 characters** on the API ([API pricing](https://elevenlabs.io/pricing/api)). Subscription arithmetic, same source:

| Plan | $/mo | Chars included (v4 or v2) | Effective $/1K |
|---|---|---|---|
| Free | $0 | 10,000 | — (no commercial use) |
| Starter | $6 | 75,000 | $0.08 |
| Creator | $22 | 275,000 | $0.08 |
| Pro | $99 | 1,238,000 | $0.08 |
| Scale | $299 | 3,738,000 | $0.08 |
| Business | $990 | 12,375,000 | $0.08 |

Flat, at every tier, for both models. The real cost variable is **regeneration count**, not model: at $0.08/1K and ~900 chars per Reel, a take costs about **$0.07**; ten takes cost about **$0.72**. Three Reels a day at 4 takes each runs roughly **$25/month [unverified — derived]** in API characters, which pulls you to Creator ($22 for 275K chars) rather than Starter.

Note the UI path differs in metering: **1 character = 1 credit** on both models in the web app ([v3 cost article](https://help.elevenlabs.io/hc/en-us/articles/35869113958801-How-much-does-it-cost-to-generate-using-Eleven-v3), [pricing](https://elevenlabs.io/pricing/api)). API generations are the discounted path; the pricing page states per-1K rates that match that 1:1 for these two models.

### The prompt that actually produces a good Indonesian Reel

Multilingual v2 accepts no direction beyond the text, so the script has to carry it. v4 gives you both the script and the tags.

**v4 script shape (the shape to reach for):**

```text
[excited] Oke, ini yang nggak banyak orang tahu.

[pause]

Kopi di sini diseduh pakai air 92 derajat — bukan 100.
[surprised] Bedanya? Nggak pahit sama sekali.

[softly] Coba sendiri minggu ini.
```

**Multilingual v2, same content** — the emotion has to live in punctuation, sentence length, and word choice; there is no tag to write. The equivalent script reads flatter by construction, which is exactly the difference a scroll-stopping Reel cares about.

Operational notes that apply to both:

- **Pronunciation** — v4 (and v3) take inline IPA wrapped in slashes directly in the text: `"/ˌbaɪoʊˈkemɪstri/"` ([best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)). Multilingual v2 has no phoneme tags; its lever is a **pronunciation dictionary** with alias tags (`<grapheme>…</grapheme><alias>…</alias>`), which is the right tool for Indonesian brand names and English loanwords ([same page](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)). ElevenLabs reports v3's IPA path achieves 80–90% pronunciation consistency — useful, not guaranteed.
- **Pauses** — v4 does not support `<break>`. Use `[pause]`, an ellipsis, or a line break.
- **Numbers and currency** — Multilingual v2 is the larger model and normalises "Rp1.000.000" style inputs more naturally than the small fast models ([best practices, text normalization](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)). This is a v2-vs-Flash point, not a v2-vs-v4 point, but it favours the larger models generally.
- **Determinism** — output is nondeterministic; pass `seed` for best-effort repeatability, which does not guarantee an identical file ([TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)).
- **Free regenerations** — up to 2 per generation, only when text, voice, and settings are byte-identical ([same](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)). Freeze the script before you burn takes.

## Recommendation

**Default: `eleven_v4`, at $0.08/1K, with an Indonesian voice from the voice library.**

The decision reduces to: both models speak Indonesian, both cost the same, v4's request cap is irrelevant at Reel length, and v4's one advantage — directed delivery via audio tags — is the axis Reels compete on. Multilingual v2's advantage, long-text stability, addresses a risk a 30-second take does not carry.

**Switch to `eleven_multilingual_v2` when any of these hold:**

- A v4 take repeatedly hallucinates words or drifts accent on the same script, and regeneration is not converging.
- You are producing a **long** Indonesian series (audiobook, 20-minute course module) with one locked cloned voice, where cross-session consistency outranks expressive range.
- You want the most mature, least surprising path — v2 is the API's own **default `model_id`** ([API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)), the "content creation" model ElevenLabs itself positions for voiceovers ([help center](https://help.elevenlabs.io/hc/en-us/articles/17883183930129-What-models-do-you-offer-and-what-is-the-difference-between-them)).

**Do not decide on the character cap.** 5,000 vs 10,000 is the most-quoted difference between these two models and the least relevant one here.

**Do not skip the voice test.** Pick 3–5 Indonesian voices from the library, run the *same* script through each on v4, and listen for: correct stress on loanwords ("budget", "content", "checkout"), non-Jakartan accent if that matters, and whether the delivery reads as narration or conversation. The voice choice will move perceived quality further than the model choice.

## Gotchas

- **v4 is not the API default.** Omitting `model_id` gets you `eleven_multilingual_v2` ([API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)). Set `model_id: "eleven_v4"` explicitly.
- **`language_code` is ignored on Multilingual v2.** The parameter "is not supported for multilingual_v2 models" ([API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)). If you are passing `language_code: "id"` to force Indonesian, you must be on v4 (or another code-capable model) for it to do anything.
- **v4's headline endpoint is Text to Dialogue.** The models doc says "Eleven v4 is available via the Text to Dialogue API" ([models](https://elevenlabs.io/docs/overview/models)) and lists a separate ~100ms `eleven_v4_turbo` behind the Text to Dialogue websocket. Which endpoint accepts `eleven_v4` for plain single-voice TTS is unspecified in the pages read here — confirm with a live API call before wiring a pipeline. [unverified]
- **Audio tags get read aloud.** Not always, not never. Check every take.
- **Commercial use requires a paid plan**, both models ([TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)). Free tier output is not licensable for brand Reels.
- **"Eleven v3.1" is not a model ID** in the published model table. If a forum post or tutorial names it, treat it as Studio UI labelling, not an API value ([models](https://elevenlabs.io/docs/overview/models); an ElevenLabs staffer in the same thread asked the poster what they meant by it).

## Open questions

- No independent, Indonesian-specific blind-preference score exists for v4 vs Multilingual v2. An A/B on 10 real Reels would settle it; nothing published does. [unverified]
- Whether v4 has meaningfully reduced the tag-vocalisation and accent-drift behaviour attributed to v3 is undocumented. The v4 model card describes cloning and speaker preservation improvements only. [unverified]
- Indonesian loanword handling ("deadline", "viral", "budget") is the practical break point and is untested in every source found.

## Changelog

- 2026-10-20 — Initial write. Note during research: Eleven v4 exists and is the current flagship, superseding the v3-vs-v2 framing this question was originally posed in. All primary facts read from ElevenLabs' own docs and pricing page on 2026-10-20.
