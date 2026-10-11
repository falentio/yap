---
title: "Which Locale to Add to i18n First — Language Priority Ranking"
category: business
tags: [i18n, localization, l10n, locale, market-priority, app-store]
status: complete
created: 2026-10-10
updated: 2026-10-10
sources:
  - https://en.wikipedia.org/wiki/Languages_used_on_the_Internet
  - https://localizeyourapp.com/blog/app-store-languages
  - https://appscreens.com/blog/what-languages-should-i-localize-my-app-into
  - https://neilpatel.com/marketing-stats/global-internet-users-by-language/
  - https://easyappsecom.com/guides/shopify-translation-multilingual-statistics
  - https://www.conveythis.com/blog/76-percent-of-shoppers-prefer-native-language-website
  - https://blog.laratranslate.com/which-languages-to-translate-first/
  - https://imminent.translated.com/t-index
confidence: high
---

# Which Locale to Add to i18n First — Language Priority Ranking

## TL;DR

- **If the product earns revenue (paid app, subscription, SaaS, B2B, e-commerce): add Japanese (`ja`) first.** It is the consensus top post-English locale: top-tier ARPU / in-app-purchase revenue, low English proficiency, and store listings that demonstrably underperform in English ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages), [AppScreens 2026](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into)).
- **If the product maximizes free reach: add Spanish (`es-MX` / `es-419`) first**, then **Portuguese (`pt-BR`)** — Spanish unlocks ~500M speakers across ~20 App Store storefronts, and Brazil is the fastest-growing app market at +73% year over year ([appscreens](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into), [localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)).
- The ranking axis matters more than the list: **revenue per user × English tolerance** beats raw speaker count for monetized products; speaker count and content-supply gaps win for free/ad-supported products.

## Context

Question: *which single language should be added next to a product's i18n locale set?* The answer is not universal — it depends on whether the product monetizes per user or maximizes reach — but the underlying market data is public and consistent. This file ranks the candidate locales on that data so the pick takes minutes instead of guesswork. Researched 2026-10-10 via TinyFish; all figures are from the cited sources.

## Findings

### 1. Two decision tracks

| Track | Pick | Why |
|---|---|---|
| Revenue per user | `ja` (Japanese) | Highest willingness to pay, lowest English tolerance among big app markets |
| Maximum reach (free/ad-supported) | `es-MX` → `pt-BR` | Largest post-English audiences; Brazilian market growing fastest |

Source: [AppScreens, "What Languages Should I Localize My App Into in 2026?"](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into) — broad-reach shortlist = Chinese, Spanish, Hindi, Arabic, Portuguese, Indonesian; paid/B2B/AI/education shortlist = Japan, South Korea, Germany, France, Spain, Italy, Canada, U.K., Australia, Taiwan, U.S.

### 2. Why Japanese tops the revenue track

[Localize Your App's ranking](https://localizeyourapp.com/blog/app-store-languages) of App Store locales to do first:

1. **Japanese** — "the classic first pick: top-tier ARPU, low English proficiency, and users who demonstrably prefer localized apps."
2. **German** — large paying market, strong preference for German-language products; text runs 40–60% longer than English, so test layouts.
3. **Korean** — high ARPU, mobile-first; English listings underperform badly.
4. **French, Spanish, Italian** — broad reach across many storefronts.
5. **Simplified Chinese** — enormous iOS market, if the category is not restricted and support is possible.
6. **Portuguese (Brazil), Russian, Turkish, Polish** — lower ARPU but high download growth.

Market-size context: global in-app-purchase revenue reached **$167B in 2025, +10.6% YoY** across iOS and Google Play (Sensor Tower *State of Mobile 2026*, reported by [AppScreens](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into)). Of the **$127B** spent across both stores in 2024, **$91.6B was the App Store**, the U.S. ~$47.6B, and **Brazil the fastest-growing market at +73% YoY** ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)).

### 3. Purchasing power vs. speaker count

Speaker counts alone pick the wrong markets. The **T-Index** (by Translated) ranks languages by online purchasing power — internet population × per-capita spending (household final consumption expenditure, World Bank) × internet penetration — precisely because "Japanese or German may rank higher than you'd expect based purely on speaker numbers" ([Lara Translate explainer](https://blog.laratranslate.com/which-languages-to-translate-first/), [T-Index](https://imminent.translated.com/t-index)). [unverified — the ProZ-hosted T-Index top-100 table was bot-blocked on 2026-10-10; the tool itself is interactive, so exact per-language values were not captured.]

Consumer-behavior evidence for why localization pays at all (CSA Research, "Can't Read, Won't Buy — B2C", 8,709 consumers in 29 countries):

- **76%** prefer buying when information is in their native language; **40%** will *never* buy from a site not in their language ([ConveyThis](https://www.conveythis.com/blog/76-percent-of-shoppers-prefer-native-language-website); same 2025 figures echoed by [easyappsecom](https://easyappsecom.com/guides/shopify-translation-multilingual-statistics)).
- **65%** prefer native-language content even when the quality is imperfect; average **35% conversion lift** in non-English markets ([easyappsecom](https://easyappsecom.com/guides/shopify-translation-multilingual-statistics)).

### 4. Audience vs. content supply (reach track)

W3Techs content-language share of the top 10M websites, as of 2025-12-03 ([Wikipedia](https://en.wikipedia.org/wiki/Languages_used_on_the_Internet)):

| Rank | Language | 2023-05-15 | 2025-12-03 |
|---|---|---|---|
| 1 | English | 55.5% | 49.3% |
| 2 | Spanish | 5.0% | 6.0% |
| 3 | German | 4.3% | 5.9% |
| 4 | Japanese | 3.7% | 5.1% |
| 5 | French | 4.4% | 4.5% |
| 6 | Portuguese | 2.4% | 4.1% |
| 7 | Russian | 4.9% | 3.7% |
| 8 | Italian | 1.9% | 2.8% |
| 9 | Dutch | 1.5% | 2.2% |
| 10 | Polish | 1.4% | 1.8% |

User-side mismatch (DataReportal/WeAreSocial 2025, via [Neil Patel](https://neilpatel.com/marketing-stats/global-internet-users-by-language/)): English = 49.4% of web content but ~1.2B online users; Spanish ≈363M users vs 6% of content; Indonesian 198M users vs 1.1% of content; Arabic 237M users vs 0.5% of content. Large audience + low content supply = underserved, low-competition search markets. Adding the top 5 languages (English, Spanish, French, German, Portuguese) covers ~60% of global online purchasing power; adding Mandarin Chinese and Japanese reaches ~75% ([easyappsecom, citing Internet World Stats 2026](https://easyappsecom.com/guides/shopify-translation-multilingual-statistics)).

### 5. Candidate comparison (wide format)

| Dimension | Japanese `ja` | German `de` | Spanish `es-MX/es-419` | Portuguese `pt-BR` | Korean `ko` | Chinese `zh-Hans` | French `fr` |
|---|---|---|---|---|---|---|---|
| Primary market | Japan | DE/AT/CH | Mexico + LATAM + Spain | Brazil | South Korea | China mainland | FR/CA/CH/BE |
| Audience signal | ~125M ([appscreens](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into)) | ~75M | ~500M | ~250M | ~80M | ~990M | ~75M |
| Web content share (Dec 2025) | 5.1% ([W3Techs/Wikipedia](https://en.wikipedia.org/wiki/Languages_used_on_the_Internet)) | 5.9% | 6.0% | 4.1% | n/a (not in top 10) | not in top 10 | 4.5% |
| Purchasing power | Top-tier ARPU ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)) | High; Europe's largest paying market | Medium; many storefronts | Growing fastest (+73% YoY) | High ARPU ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)) | Enormous but regulated/payment-friction | Medium-high |
| Text expansion risk | Low–medium | High: 40–60% longer than English | Medium (~15–25%) | Medium | Low–medium | Compact | High (~15–25% + spacing) |
| Verdict | **Best first locale for revenue** | First EU pick; also best second locale overall | **Best first locale for reach** | Speculative add with a number behind it | 2nd revenue pick after ja | Only if category/payments fit | Solid mid-priority multi-region |

E-commerce revenue by market, 2026 (Statista/eMarketer via [easyappsecom](https://easyappsecom.com/guides/shopify-translation-multilingual-statistics)): China $2.1T (Mandarin), U.S. $1.1T, U.K. $340B, Japan $280B, Germany $220B (28% cross-border), France $175B, South Korea $165B, Spain+LATAM $180B, Brazil $120B.

### 6. Practical checklist before adding a locale

1. Check your own analytics first — traffic, revenue, and support tickets by country; organic demand beats any list ([lara translate](https://blog.laratranslate.com/which-languages-to-translate-first/)).
2. Localize store/metadata before the binary where possible — a fraction of the word count, immediate discovery effect ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)).
3. Pick the exact locale, not just the language: `ja`, `de-DE`, `es-MX` or `es-419`, `pt-BR`, `zh-Hans` vs `zh-Hant` ([appscreens](https://appscreens.com/blog/what-languages-should-i-localize-my-app-into)).
4. Budget for text expansion — German runs 40–60% longer than English ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)).
5. Watch platform scope: Apple expanded App Store localizations from 39 to 50 on 2026-03-31, eight of the eleven additions being Indian languages — the clearest signal yet of expected growth markets ([localizeyourapp](https://localizeyourapp.com/blog/app-store-languages)).

## Open Questions

- Exact T-Index per-language values (top-100 table) — source was bot-blocked; re-fetch when accessible.
- Figures sourced from vendor blogs (CSA stats, Sensor Tower, Internet World Stats) are secondary citations; primary reports not yet read.

## Related

- [Business index](./README.md) — this file's category.

## Changelog

- 2026-10-10 — created; research via TinyFish search/fetch.
