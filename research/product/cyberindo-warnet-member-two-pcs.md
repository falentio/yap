---
title: CyberIndo Warnet Member Account — One Account on Two PCs at Once?
category: product
tags: [warnet, internet-cafe, cyberindo, billing, indonesia, membership, garena]
status: complete
created: 2026-10-24
updated: 2026-10-24
sources:
  - https://web.archive.org/web/20191229222351/http://www.cyberindo.co.id/
  - https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan
  - https://web.archive.org/web/20200702202547/http://www.cyberindo.co.id/faq
  - https://www.scribd.com/doc/288599882/Standart-Pengoperasian-Billing
  - https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html
  - https://lintaswarnet.blogspot.com/2017/11/cyberindo-billing-warnet.html
  - https://masteknisi.com/2024/05/23/exit-billing-client-cyberindo/
  - https://masteknisi.com/2024/05/22/hapus-pc-client-yang-tidak-terpakai-di-billing-cyberindo/
  - https://www.kaskus.co.id/post/579d2ecb507410c0488b4568
  - https://www.kaskus.co.id/thread/5646b731de2cf245608b4568/sharing-produk-gratis-billling-dan-updater-cyberindo
  - https://azkaizzam.blogspot.com/2017/11/program-untuk-warnet-cyberindo-diskless.html
  - https://cyberindo.ebilling.id:4433/cyberindo/
  - https://cybercafebilling.com/
  - https://m2gic-35871204.cybercafebilling.com/
  - https://www.fauzannet.co.id/billing
  - https://www.fauzannet.co.id/berita/baca/warnet-fauzan-hadirkan-ekosistem-digital-terintegrasi-satu-akun-untuk-semua-kini-mendukung-jaringan-nasional
confidence: medium
---

# CyberIndo Warnet Member Account — One Account on Two PCs at Once?

## TL;DR

- **There is no CyberIndo membership that exists outside one café.** CyberIndo is warnet management software (billing, updater, diskless) that a café installs on its own server and client PCs; your "member account" is a row in *that* café's billing database, created by its operator ([archived cyberindo.co.id](https://web.archive.org/web/20191229222351/http://www.cyberindo.co.id/), [phancyber](https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html), [masteknisi](https://masteknisi.com/2024/05/23/exit-billing-client-cyberindo/)).
- **A member account is prepaid time/saldo, and the *café* sets the rules for it.** The manual documents a member as "user yang dapat login dengan menggunakan username dan password dan **harus membeli paket**", and the operator-facing tutorial says account and package terms are "tergantung kebijakan di warnet itu sendiri" ([CyberIndo SOP — search snippet, page bot-blocked](https://www.scribd.com/doc/288599882/Standart-Pengoperasian-Billing), [phancyber](https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html)).
- **One account on two PCs at the same time is therefore a counter question, not a CyberIndo feature.** Nothing public says the software forbids or supports it, but the operator console shows per-PC status *and* the member/coupon account list, so any second session is visible to the operator and can be closed from the counter ([CyberIndo SOP — snippet](https://www.scribd.com/doc/288599882/Standart-Pengoperasian-Billing), [lintaswarnet](https://lintaswarnet.blogspot.com/2017/11/cyberindo-billing-warnet.html), [masteknisi](https://masteknisi.com/2024/05/22/hapus-pc-client-yang-tidak-terpakai-di-billing-cyberindo/)).
- **Economically you save only an account-creation fee, if your café even charges one.** The app itself is free to the café ([archived cyberindo.co.id/panduan](https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan)); the money is in the paket. Two live PCs off one paket either burn the block twice as fast or hand the café an unbilled seat — which is why the usual answer at the counter is no, or "boleh, tapi PC kedua bayar sendiri" ([inference](#the-two-pc-question-what-is-and-is-not-documented)).
- **Practical route:** ask the operator directly, and if you just need a second seat, take a kupon/voucher or "personal" time for PC 2 — CyberIndo's payment modes are personal, kupon, and member account, so a second member account is not required to use a second PC ([informatikasolo](http://informatikasolo.blogspot.com/2016/02/download-cyberindo-billing-v-185.html), [Kaskus](https://www.kaskus.co.id/thread/5646b731de2cf245608b4568/sharing-produk-gratis-billling-dan-updater-cyberindo)).

## Context

Question asked (2026-10-24): *"I have a CyberIndo account member at an internet cafe — can I use 2 PCs with the same account concurrently, so I don't need to create a second account for membership?"*

This needed unpacking, because "CyberIndo account" can mean three unrelated things: a warnet billing/management product (the one this question is about), Garena's CyberIndo café programme, and a family of unrelated modern cloud billings that reuse the "Cyberindo" name. Nothing in this repo covered warnet or café billing before this file. Research ran through TinyFish (search + fetch), plus Wayback snapshots, because the vendor site no longer resolves.

## Findings

### What CyberIndo actually is (and is not)

CyberIndo is a free software suite that a warnet runs on its own LAN: a game updater, a diskless/virtual/local client image system, a café console, and **CyberIndo Billing** for money, staff, and PCs ([archived cyberindo.co.id](https://web.archive.org/web/20191229222351/http://www.cyberindo.co.id/), [azkaizzam](https://azkaizzam.blogspot.com/2017/11/program-untuk-warnet-cyberindo-diskless.html)). It is distributed under Garena Indonesia's café programme — the site claims "Telah dipercaya oleh 20.000+ warnet se-Indonesia" and contact at `cyberindo@garena.co.id` ([archived cyberindo.co.id](https://web.archive.org/web/20191229222351/http://www.cyberindo.co.id/)) — and the app plus the in-game GCA (Garena Cybercafe Alliance) benefits are free to the café owner ([archived panduan](https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan)).

Two things follow immediately:

- **Membership is the café's, not CyberIndo's.** Café owners register for a Cafe ID and AuthKey; end customers never get a CyberIndo ID ([archived panduan](https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan)). Your member account is created inside that café's billing, and it disappears with that café's database — the operator workflow backs it up and can move it to a replacement machine ([masteknisi](https://masteknisi.com/2024/05/23/exit-billing-client-cyberindo/)).
- **"Cyberindo" is also the name of unrelated products**, including a cloud "Billing System V.3.0" login portal on `cyberindo.ebilling.id` ([login page](https://cyberindo.ebilling.id:4433/cyberindo/)) and the separate *CyberCafe Solution* hosted billing that advertises importing a "Cyberindo Billing" `.bak` database ([cybercafebilling.com](https://cybercafebilling.com/), [hosted instance](https://m2gic-35871204.cybercafebilling.com/)). Which generation your café runs changes who to ask, not the shape of the answer.

### The member account model at the counter

| | Member | Kupon (coupon card) | Personal / guest |
|---|---|---|---|
| Who creates it | Operator, in the billing console | Operator | No account |
| Credential | Username + password | Operator-issued code | None |
| Before first use | Must buy a paket (prepaid time/saldo) | Must be issued first | Pay per block at the PC |
| Typical use | Regulars, keeping leftover time between visits | One-off/other people | Walk-ins |

Sources: member and coupon definitions and the prepaid requirement are from the CyberIndo SOP's user-type section ([Scribd — search snippet](https://www.scribd.com/doc/288599882/Standart-Pengoperasian-Billing)); the operator's creation flow ("Account → + → isi data", then buy a paket) and the "harus Beli Paket terlebih dahulu" rule are from [phancyber](https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html); the payment-mode list is repeated by [informatikasolo](http://informatikasolo.blogspot.com/2016/02/download-cyberindo-billing-v-185.html) and [Kaskus](https://www.kaskus.co.id/thread/5646b731de2cf245608b4568/sharing-produk-gratis-billling-dan-updater-cyberindo).

The cultural reason the feature exists is visible in the same tutorial: regulars (jokingly, "bocil") park unused minutes on an account — "nitip waktu" — instead of losing them ([phancyber](https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html)). A member account is thus a **prepaid store of value that follows the person to any PC — one at a time**.

### How a session behaves

- **Sessions are per-PC and live on the server.** The billing console has tabs for computer status, "Akun Member / Kupon", transactions, and server/client logs ([CyberIndo SOP — snippet](https://www.scribd.com/doc/288599882/Standart-Pengoperasian-Billing)), and the operator manages PCs from a "Kontrol PC" menu — including deleting clients that are no longer used ([masteknisi](https://masteknisi.com/2024/05/22/hapus-pc-client-yang-tidak-terpakai-di-billing-cyberindo/)).
- **A session does not close itself when the PC dies.** After a power cut, "member dan waktu personal belum sempat diclose dari Billing Server"; the operator closes it later, and member time does not drain while the PC is genuinely off ([lintaswarnet](https://lintaswarnet.blogspot.com/2017/11/cyberindo-billing-warnet.html)). Sessions that outlive their PC are exactly what the console's PC/hapus and close workflows exist for.
- **The client side is what the customer touches:** lock-with-password, chat to the operator to add time, remote control from the server, and the standard client reconnection routine (client admin login `GARENA / GARENA`, then point the client at the server IP) ([lintaswarnet](https://lintaswarnet.blogspot.com/2017/11/cyberindo-billing-warnet.html), [archived panduan](https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan), [masteknisi](https://masteknisi.com/2024/05/23/exit-billing-client-cyberindo/)).

Consequence: if the same member credentials are used on a second PC while the first session is alive, the console has two live PCs with one member name on them. Nothing in the software hides that.

### The two-PC question: what is and is not documented

**Not found (negative results, recorded deliberately):**

- No vendor statement, FAQ entry, or manual text saying a member may log in on **two client PCs at once**. The archived official FAQ covers installation, updater, diskless, and connectivity errors — not customer membership ([archived FAQ](https://web.archive.org/web/20200702202547/http://www.cyberindo.co.id/faq)).
- No vendor statement saying the second login is **rejected** either. No error message, no documented single-session lock.
- The CyberIndo SOP/manual that would settle it (Scribd doc 288599882, "Standart Pengoperasian Billing") is bot-blocked to automated fetch — the page returns a "Client Challenge" interstitial; mirrors `pdfslide.net` and `vdocuments.mx` are 404 and `baixardoc.com` returns `bot_blocked`. Its user-type text is only reachable as a search snippet, which is why those claims above are cited as snippet-level.
- `cyberindo.co.id` no longer resolves; the archived copies are the surviving vendor documentation.

**What the mechanics imply** (labelled explicitly as inference, not evidence): a member login is an authentication against the café's own server, followed by a per-PC session that the operator can see and close. Nothing found suggests a hard cross-PC lock; that would be a café-side configuration or a house rule, not a CyberIndo-wide policy.

**Why cafés normally say no** ([inference](#the-two-pc-question-what-is-and-is-not-documented)):

| Scenario | What the café sees | Who pays |
|---|---|---|
| Both PCs draw the same paket block | Two live PCs under one member name | Member's prepaid time burns twice as fast — *you* lose, the café gets paid twice over |
| The billing counts only one session, PC 2 runs free | Two live PCs, one account consumed | The café loses a seat for every hour PC 2 runs |
| Operator blocks the second login | A rejected login at PC 2 | You buy a second seat, or go home |

The middle row is the abuse case operators watch for; the third row is the common outcome when a café notices. The first row is the one worth asking about, because it is the only case that behaves like an honest two-seat purchase.

### What to do at the counter

1. Ask the operator the exact question: **"Kak, akun member saya bisa dipakai di 2 PC sekaligus? Kalau boleh, kena biaya berapa untuk PC keduanya?"** It is a counter policy, and the operator can answer in one sentence.
2. If the goal is simply two seats (you plus a friend, or two clients open at once), **do not require a second membership account**. CyberIndo bills in three modes — personal, kupon, member account — so PC 2 can be paid as personal time or a voucher ([informatikasolo](http://informatikasolo.blogspot.com/2016/02/download-cyberindo-billing-v-185.html)).
3. Be explicit that account creation for a *second member* is usually free; the cost is the paket you top it up with ([phancyber](https://phancyber.blogspot.com/2015/11/cara-membuat-akun-member-di-billing.html)). If your café charges a membership fee, that fee is the café's own policy, not a CyberIndo license cost — the software is free even to the café ([archived panduan](https://web.archive.org/web/20210412130355/http://www.cyberindo.co.id/panduan)).
4. Expect sharing to be traceable. Every session is tied to a PC in the console, and a stale session can be closed from the counter at any time ([lintaswarnet](https://lintaswarnet.blogspot.com/2017/11/cyberindo-billing-warnet.html)).

### Where the market is going (context, not your current case)

Modern hosted billings keep the same one-account-one-seat shape while adding portability. The web-based *CyberCafe Solution* exposes member management with levels, saldo deposit, inter-member balance transfer, auto-expire rules, cross-branch member pull, and a member-login verification endpoint (`{"username": ..., "password": ...}`) ([hosted instance](https://m2gic-35871204.cybercafebilling.com/), [search snippet](https://cybercafebilling.com/)). Warnet Fauzan's publicly described setup goes further: single sign-on between its website and billing client, and one member account usable at every branch in its network — while the client widget still shows a single seat, "PC 04 • Sesi Member" with an "AKHIRI SESI" action ([FauzanNet Billing](https://www.fauzannet.co.id/billing), [FauzanNet announcement](https://www.fauzannet.co.id/berita/baca/warnet-fauzan-hadirkan-ekosistem-digital-terintegrasi-satu-akun-untuk-semua-kini-mendukung-jaringan-nasional)). Cross-branch, not multi-seat.

## Open Questions

- Does CyberIndo Billing (1.8.x / Pro) reject a second concurrent login for the same member, allow it, or allow it and count both against the paket? Probe: read the "Akun Member / Kupon" section of the SOP manual (Scribd doc 288599882) in a browser, or test it at the counter and watch the console.
- Does your café run classic CyberIndo Billing, CyberIndo Pro, or a newer hosted billing (e-billing v3 / CyberCafe Solution)? Probe: ask the operator which billing they run.
- Does your café charge a membership/registration fee separate from the paket, and does that fee change for a second account? Café-specific; only the counter knows.

## Related

- [Product index](./README.md) — no other file in this repo covers warnet or café billing yet; this is the first.

## Changelog

- 2026-10-24 — created. Researched via TinyFish search and fetch. Negative results recorded: Scribd/everand copies of the CyberIndo SOP return a bot interstitial; two document mirrors 404 and one blocks bots; `cyberindo.co.id` does not resolve and was read through Wayback snapshots; Facebook page/group posts require login and were not retrievable.
