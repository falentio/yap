---
title: MATI LAMPU — Blackout Bar Brawl (Indonesian bar-fight board game)
category: reference
tags: [board-game, game-design, hidden-movement, fog-of-war, indonesia, social-deduction, simulation]
status: in-progress
created: 2026-10-11
updated: 2026-10-11
sources:
  - https://www.eftaios.com/ruleditor.html
  - https://meeplescorner.net/blogs/meeple-musings/what-are-hidden-movement-board-games-everything-you-need-to-know
  - https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/
  - https://theplayersaid.com/2024/03/22/best-3-games-with-hidden-movement/
  - https://id.wikipedia.org/wiki/Mati_listrik_Jawa_2019
  - https://www.kompas.id/artikel/en-tragedi-blackout-listrik-sumatera-dari-kekacauan-ekonomi-hingga-hilangnya-nyawa
  - http://www.journal.stkipsubang.ac.id/index.php/didaktik/article/download/11102/6490
confidence: high
---

# MATI LAMPU — Blackout Bar Brawl

A 2–6 player tactical brawl that takes place **entirely during a blackout**, in one
Indonesian *warung* / bar. Nobody can see across the room; the only map is what you
can reach with your own eyes, a torch beam, or the sound of somebody else's chair
scraping the floor. You are not trying to kill anyone — you are trying to walk out at
closing time with the most money.

> **Working title:** *Mati Lampu* ("the lights died"). Alternates: *Blackout Bar Brawl*,
> *Jam Malam*, *Genset*.

---

## Summary

- **Genre:** hidden-movement / fog-of-war brawl with a shared physical board — the
  closest published relatives are *Escape from the Aliens in Outer Space* (noise cards)
  and *Letters from Whitechapel* (trail deduction) [1](https://www.eftaios.com/ruleditor.html) [2](https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/).
- **The one mechanic it is built around:** the **light level is public and changes every
  round**, and it sets everyone's vision radius *at the same time*. Darkness is not a
  punishment aimed at you; it is a shared resource that flips the game between a
  knife-fight in a closet (GELAP) and a bloodbath in a lit room (TERANG).
- **Non-obvious twist:** you win on **money and KO count, not survival**, and a KO
  *drops* the victim's cash on the floor. So the optimal play is usually to let two
  other people fight over a dropped wallet, then hit whoever is left standing.
- **Core tension:** the **senter (torch)**. It is the only way to see far — and it makes
  you visible to everyone on the board at once. Vision is bought with exposure.
- **Fully specified and simulated.** A DOM-free engine plus a 600-game headless
  simulation exist under [prototypes/indonesian-blackout-bar-brawl/](../../prototypes/indonesian-blackout-bar-brawl/);
  the numbers in §12 are what that simulation actually reports.

---

## Details

### 1. Pitch

It is 11pm. The *gardu* (neighbourhood transformer) blows and the whole street goes
dark. In the bar, the music stops, the freezer hums down, and eleven people who were
politely ignoring each other are suddenly alone together with a lot of loose cash and a
lot of unresolved history. The genset is in the back room. Someone is going to try to
start it. Someone else is going to be very unhappy if they do.

Rolling blackouts are a lived reality in Indonesia, not a dramatic device — the 2019
Javan blackout affected tens of millions of people across Jabodetabek and parts of West
Java [3](https://id.wikipedia.org/wiki/Mati_listrik_Jawa_2019), and the 2026 Sumatran outage shut down factories and small businesses for two
days [4](https://www.kompas.id/artikel/en-tragedi-blackout-listrik-sumatera-dari-kekacauan-ekonomi-hingga-hilangnya-nyawa). The game's premise is not a fantasy; it is a Tuesday.

### 2. Design pillars

1. **Vision is the board.** The board never changes. What changes is how much of it
   exists for you this round. A player who tracks the light cycle is playing a different
   game from a player who does not.
2. **Noise is the only long-range information.** You cannot see across the room, but you
   can *hear* it. Every meaningful action makes a marker someone else can use.
3. **Money is loud.** The thing you are fighting over is the thing that makes you a
   target. Wealth is public information, and it is a beacon.
4. **Nobody dies.** A KO is a loss of tempo and cash, not an elimination. Players stay in
   the game, stay angry, and stay relevant.
5. **The table argues.** The rules are built to produce negotiation: "who took my
   wallet?", "who turned the lights on?", "are you *sure* that was the genset?"

### 3. Components

| Component | Qty | Notes |
|---|---|---|
| Board, 9×9 tiles | 1 | One bar: bar counter, tables, toilets, cash register, genset room, doors |
| Character standees | 6 | One per archetype, double-sided (upright / knocked down) |
| Vision screens | 1 per player | Card stock; hides the player's own sheet |
| Light die | 1 | d6; read every round: 1–2 GELAP, 3–4 REDUP, 5–6 TERANG |
| Light track marker | 1 | Public; sits at the top of the board |
| Noise markers | 24 | Cardboard "!" tokens; placed on the board by the acting player |
| Loot tokens | 30 | Face value 1 duit; public |
| Item cards | 25 | Draw deck for *geledah* (search) |
| Pak Satpam standee | 1 | The NPC; red base, torch radius printed on the base |
| KO markers | 6 | Placed when a character is knocked down |
| Score pad | 1 | End-of-game tally |

### 4. The board

The bar is a 9×9 grid. Everything the players do happens inside it; there is no hidden
second map and no notepad — the fog is **per-player line-of-sight**, not bookkeeping. The
prototype's map:

```
P.......P     P  pintu / door (walkable, exit)
.........     .  open floor
..#...#..     B  bar counter (blocks movement and sight)
...BBB...     #  table (blocks movement and sight)
...B.B...     T  toilet (blocks movement and sight)
...BBB...     $  kasir / cash register (walkable, searchable)
..#...#..     G  genset room (walkable; controls the lights)
.........
T..$G..$T
```

- **Doors (P)** are the exits and the spawn points; being caught by Pak Satpam sends you
  to the nearest free door.
- **The bar counter (B)** is a solid ring in the middle — the central obstacle everyone
  has to walk around, and the reason the room has a "far side".
- **The cash registers ($)** are where *geledah* reliably pays; a register search is the
  main way to convert AP into money.
- **The genset room (G)** is the single most contested tile on the board (§6).

### 5. Setup

1. Place the board; place the genset and cash-register markers.
2. Each player takes one archetype card (§8), sets HP and AP to its printed values,
   takes its starting item(s), and takes its starting *duit* (public, face up in front of
   them).
3. Players place standees on **door tiles**, in reverse seating order.
4. Shuffle the item deck and place it beside the board.
5. Place **Pak Satpam** in the middle of the open floor.
6. Roll the light die and set the light track. The game begins at **GELAP** on round 1,
   regardless of the roll — the blackout has just happened.
7. The youngest player goes first; play proceeds clockwise.

### 6. Turn structure

Each turn a player spends **AP** (Action Points) on any mix of actions until they are
spent or they choose to stop. AP does not carry over. The turn order is the same every
round; there is no initiative roll, because the interesting randomness is the light.

| Action | AP | Effect |
|---|---|---|
| **Jalan** (move) | 1 | Move 1 tile orthogonally. Makes 1 noise. Bumping into someone shoves them one tile. |
| **Serang** (attack) | 2 | Attack an adjacent target (or 2 tiles with a long weapon). Resolve per §9. |
| **Lempar** (throw) | 2 | Throw a bottle/magic-com/stone up to 3 tiles in line of sight. |
| **Geledah** (search) | 1 | Search a register or adjacent furniture; draw 1 item. |
| **Ngumpet** (hide) | 1 | +2 defence until your next turn; you cannot be seen by Pak Satpam's sight check. |
| **Senter** (torch) | 1 | Raise your vision radius to 3 for the round; you become visible to the whole table. |
| **Genset** | 1 | Only on the genset tile: force the lights TERANG or GELAP for the rest of the round. |
| **Pakai barang** (use item) | item's cost | Heal, buff, or trigger a tool. |
| **Selesai** (end turn) | 0 | Pass. |

**Hard rules:** you may not act out of turn; a rejected action costs nothing; AP resets
at the start of your turn; if you are knocked down you lose your next turn and re-enter
at a door.

### 7. Light and fog — the core

At the **start of every round**, roll the light die:

| Roll | Light | Vision radius | Table state |
|---|---|---|---|
| 1–2 | **GELAP TOTAL** | 2 tiles | Everyone is blind past arm's length. A knife-fight. |
| 3–4 | **REDUP** | 3 tiles | You can read the room, not the far side. |
| 5–6 | **TERANG** | 4 tiles | The whole bar is legible. A shooting gallery. |

Rules that make this the whole game:

- **Vision is per-player and simultaneous.** Two players in the same round may see
  completely different boards. There is no "table view" — each player sees only their
  own radius, plus whatever is lit by a torch (yours or someone else's), plus Pak
  Satpam's torch radius (public, because he is the NPC).
- **Light is public and shared.** Nobody chooses GELAP. The die does. The only agency is
  the **genset** (one tile) and the **powerbank** (one item) — see §10.
- **The senter is the deal with the devil.** A player who lights a torch sees 3 tiles in
  any light level — and every other player can see *them*, anywhere on the board. This
  inverts the usual stealth game: the strongest information tool is also the strongest
  target-painting tool.
- **The kedip (flicker).** On a roll of 6, the lights flicker fully on for one beat: every
  player's position is revealed to everyone for that round. This is the round where the
  money changes hands.
- **Furniture blocks sight.** The bar counter and tables are the only cover; a player
  standing beside furniture is harder to hit (§9).

### 8. Archetypes

Six archetypes, chosen at the start, each a recognisable Jakarta street figure. They are
deliberately **not** balanced to equal win rates; they are balanced to *different* win
rates, because the game's fun comes from arguing about whether the Bule is too strong.

| Dimension | Preman | Tukang Parkir | Driver Ojol | Mahasiswa | Ibu Warung | Bule |
|---|---|---|---|---|---|---|
| **HP** | 6 | 6 | 5 | 5 | 6 | 4 |
| **AP / turn** | 3 | 3 | **4** | 3 | 3 | 3 |
| **Attack bonus** | **+1** | 0 | 0 | 0 | 0 | **+1** |
| **Starting duit** | 2 | 2 | 2 | 3 | 2 | **5** |
| **Starting items** | Golok | Peluit, Batu | Helm, Batu | Powerbank, Senter, Batu | Kopi, Sapu | Senter |
| **Special** | Best damage in the game | Can make noise anywhere (peluit) | Most AP; fastest to loot and flee | Controls the lights remotely (powerbank) | Searches 2 items per action | Starts rich — the table's obvious target |
| **Fantasy** | He came to fight | He came to *watch* | He came to get paid | He came to cause a scene | She came to protect the shop | He came to have a story |
| **Sim win rate** | 21% | 19% | 14% | 7% | 17% | 23% |

The **Bule** is intentionally the strongest raw position and the weakest social one:
everyone can see his money, so everyone's first instinct is to take it. The **Mahasiswa**
is the weakest on paper and the only archetype that can flip the light switch from
anywhere, which is the correct home for the most skill-testing role.

### 9. Combat

Attacks are opposed d6 rolls:

```
attacker:  d6 + weapon damage + archetype attack bonus (+2 if "berani" buff)
defender:  d6 + armour + 2 if hiding + 1 if adjacent to furniture (cover)
```

- If the attacker **beats** the defender, the difference is the damage, **capped at 4**.
- If the attacker ties or loses, the attack **misses** and nothing happens.
- A natural consequence of the opposed roll: a hiding, armoured player behind the bar
  counter can survive a Preman with a golok. Position is defence.
- **Weapons break.** Every attack rolls a break die; if it comes up at or above the
  weapon's *break* value, the weapon is destroyed. A **bottle** becomes a **pecahan**
  (shard) when it breaks — a worse-to-hold but better-to-hit weapon. This keeps combat
  from snowballing: the Preman's golok is a resource, not a permanent upgrade.

**Knockdown.** At 0 HP a player is **knocked down**, not eliminated. Their entire stash
of duit and every item they carry **drops on the floor at their tile**, they are placed
at a door, and they lose their next turn. The attacker scores **3 KO points**. This is the
engine of the game's economy: the fastest way to get rich is to knock down whoever is
currently rich, and the fastest way to be poor is to be the player everyone can see.

### 10. Noise and Pak Satpam

**Pak Satpam** (the night security guard) is the board's only NPC and the game's
anti-camping mechanism. He has a torch with a 3-tile radius, and his torch is **public
information** — everyone sees what he sees, which is why the correct play is often to
stand *just* outside his light.

| Action | Noise |
|---|---|
| Move 1 tile | 1 |
| Search / loot | 1–2 |
| Shove someone | 2 |
| Torch / throw | 2 |
| Attack | 3 |
| **Peluit (whistle)** | 4, placed up to 5 tiles away |

Every round, Pak Satpam moves toward the **loudest noise marker** on the board, three
tiles per round when alerted. If he reaches a player he **catches** them: they lose half
their duit (rounded up, dropped on the floor), are placed at the nearest free door, and
lose their next turn.

Two design consequences:

- **The peluit is a decoy weapon.** The Tukang Parkir can place a loud noise marker up to
  5 tiles from himself, which means he can send the guard *away* from himself, or *into*
  someone else. It is the game's only offensive use of the NPC.
- **The genset is loud.** Turning the lights on draws Pak Satpam's attention. The player
  who ends the blackout is the player who pays for it. This is the single best
  negotiation lever in the game.

### 11. Scoring and end of game

The game ends after **round 12** (the generator is repaired and the lights come back), or
immediately if only one player is still standing.

```
score = duit on hand + 3 * (KOs scored) + HP remaining
```

Highest score wins; ties break on HP, then on duit. **Surviving is worth less than
fighting.** A player who hides all game with 6 duit loses to a player who knocked out two
people and lost half their cash. This is deliberate: it is a brawl, not a survival game.

### 12. Digital prototype and what the simulation proved

A complete implementation lives in
[prototypes/indonesian-blackout-bar-brawl/](../../prototypes/indonesian-blackout-bar-brawl/):
a DOM-free engine (`engine.js`), a shared heuristic policy (`ai.js`), a headless
simulator (`sim.js`), a UI/engine contract test (`ui-contract.js`), a browser smoke
test (`browser-smoke.sh`), and a playable single-file UI (`index.html`).

The simulator is the design tool, and it changed the design. The first version of the map
was a **maze**, and the invariant-annotated simulation immediately exposed the consequence:

| Metric | Maze map (first draft) | Open-bar map (current) |
|---|---|---|
| Enemy positions ever visible | **3.3%** of samples | **35.0%** |
| Attacks attempted per game | 0.5 | 2.4 |
| Pak Satpam catches per game | **0** | **7.9** |
| KOs per game | 0.27 | 1.10 |
| Games ending with a knockout | 0/200 | 65/600 |
| Light level actually mattered | no (LOS-capped) | yes |

The bug was not in the code — it was in the **design**. Line-of-sight through a maze
capped visible tiles at ~18 no matter how bright the light was, so the light die was
decorative and combat almost never happened. Widening the map to a real bar floor fixed
both. This is the argument for building the simulator before the rulebook: a fog-of-war
game's *map topology* is a balance parameter, and you cannot feel it by reading.

Final 600-game run (seed 1..600, 2–6 players, mixed archetypes):

```
avg rounds/game      : 12.42      (round limit is 12 — games run to the wire)
avg KOs/game         : 1.10
avg satpam catches   : 7.87
last player standing : 65/600
winner still on feet : 600/600
wins by archetype    : Ojol 81, Mahasiswa 39, Warung 102, Bule 139, Preman 128, Parkir 111
```

### 13. Comparison to published hidden-movement games

Items across the columns; dimensions down the rows.

| Dimension | **Mati Lampu** | Scotland Yard | Letters from Whitechapel | Fury of Dracula | Escape from the Aliens in Outer Space | Beast |
|---|---|---|---|---|---|---|
| **Hidden information** | Per-player line-of-sight on a *shared* board | One hidden player | One hidden player | One hidden player | Everyone hidden, no board | One hidden player |
| **How hiding is tracked** | Nothing is hidden — it is unseen | Notepad + periodic reveal | Trail of clue markers | Location card stack | Personal map + pencil | Secret miniature + hunt reveals |
| **Vision model** | **Shared light level sets everyone's radius; changes every round** | None | None | None | None (sector graph) | None |
| **Noise model** | Public noise markers that steer an NPC and other players | None | None | None | Noise/silence cards [1](https://www.eftaios.com/ruleditor.html) | Hunt reveals the beast |
| **Combat** | Opposed d6, weapons break, knockdown drops loot | None | None | Card-based | Card-based, instant kill | Dice-based |
| **Player count** | 2–6 | 3–6 | 2–6 | 2–5 | 2–8 | 2–4 |
| **Length** | ~30–45 min | ~45 min | 90–150 min | ~150 min | ~45 min | ~90 min |
| **What it takes** | — | The genre's origin [2](https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/) | Trail deduction as a pure form [2](https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/) | Night/day asymmetry | Noise as the sole long-range signal [1](https://www.eftaios.com/ruleditor.html) | Burst hiding: you must hunt, and hunting reveals you [2](https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/) |

The design's position in that table is deliberate: **it is the only entry where the
hidden information is a shared, externally-driven light level rather than a hidden
player.** Nobody is hiding; everybody is blind, and they are blind *together*. That is a
different social experience from the genre's one-versus-many spine, and it is the reason
the game supports up to 6 players without an asymmetric role split [2](https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/) [5](https://meeplescorner.net/blogs/meeple-musings/what-are-hidden-movement-board-games-everything-you-need-to-know).

### 14. Strategy notes

1. **Read the light die before you commit.** A round of GELAP is a round to loot and
   reposition; a round of TERANG is a round to be somewhere you can defend.
2. **Never carry more than 5 duit if you can help it.** Wealth is public. Cash on hand is
   an invitation.
3. **The genset is a trap you set for someone else.** Turning the lights on makes the
   whole board legible — including you, standing alone in the genset room, in a 1-tile
   doorway, with a loud noise marker on your head.
4. **Knockdown is a *transfer*, not a kill.** Hitting the richest player moves the money
   to the floor, where anyone (including them, next turn) can pick it up. Only hit the
   rich player if you can be the one standing next to the pile.
5. **The peluit is a positioning tool, not a trick.** Use it to walk the guard onto a
   rival's tile before they can loot.
6. **Hiding is a combat buff, not a stealth stat.** +2 defence and immunity to the
   guard's sight check is worth one AP almost every round you expect to be attacked.

---

## Gotchas

- **Per-player fog is a real cost at the table.** Six players each seeing a different
  board means six vision screens and a lot of "wait, can you see me?". The digital
  prototype hides this, but a physical print will need a cheap solution — most likely a
  per-player acetate overlay or a "visible tiles" reference card per light level. This is
  the single biggest unsolved problem in the design.
- **The light die can produce a boring game.** Three consecutive GELAP rounds is a lot of
  shuffling in the dark. The current mitigation is the genset and the powerbank, but a
  physical version should probably use a **light deck** (shuffled, with a guaranteed
  distribution) rather than a raw d6.
- **The Bule is genuinely stronger than the table wants to admit.** The simulation says
  23% win rate against a fair share of ~17%; playtesting will tell whether the "everyone
  hates the rich guy" social pressure is enough to close that gap.
- **The kedip round is swingy.** When the lights flicker on, whoever acts first in that
  round has a large advantage. The order is fixed clockwise, so the same player benefits
  every time a 6 is rolled. Consider letting the *lowest-scoring* player act first on a
  flicker round.
- **Pak Satpam's torch is public.** This was a deliberate choice (he is an NPC and the
  players should be able to use him), but it does mean the guard is a shared tool rather
  than a threat. Watch for a degenerate "stand in his light forever" strategy in
  playtest; the current answer is that his light also reveals *you*.
- **Weapon break values are untuned.** The break dice are the least-simulated part of the
  system; the AI does not value weapons by their expected lifetime. Treat the printed
  break values as a first draft.

---

## Open Questions

- Does per-player fog survive the table, or does it need a physical aid (acetate overlay,
  screen, or a phone companion)?
- Is the light **deck** (guaranteed distribution) better than the light **die**?
- Should the flicker round reverse or randomise turn order?
- What is the right number of rounds? 12 makes the round limit bind; 10 might make combat
  more decisive.
- Is the archetype spread (7%–23%) acceptable as "asymmetric by design", or does it need
  a bid/handicap system?

---

## Sources

1. *Escape from the Aliens in Outer Space* — scenario/rules page (noise and silence cards) — https://www.eftaios.com/ruleditor.html
2. No Rolls Barred — *Now You See Me: A Guide to Hidden Movement Games* — https://norollsbarred.com/articles/now-you-see-me-a-guide-to-hidden-movement-games/
3. Wikipedia (id) — *Mati listrik Jawa 2019* (the 2019 Javan blackout) — https://id.wikipedia.org/wiki/Mati_listrik_Jawa_2019
4. Kompas.id — *The Sumatra Electricity Blackout Tragedy* (2026 outage) — https://www.kompas.id/artikel/en-tragedi-blackout-listrik-sumatera-dari-kekacauan-ekonomi-hingga-hilangnya-nyawa
5. Meeples Corner — *What Are Hidden Movement Board Games?* — https://meeplescorner.net/blogs/meeple-musings/what-are-hidden-movement-board-games-everything-you-need-to-know
6. The Players' Aid — *Best 3 Games with… Hidden Movement* — https://theplayersaid.com/2024/03/22/best-3-games-with-hidden-movement/
7. Jurnal Ilmiah PGSD — study on informal *tukang parkir* in Indonesian cities — http://www.journal.stkipsubang.ac.id/index.php/didaktik/article/download/11102/6490

## Related

- [Mascarade — Bluffing Game Guidelines](../../mascarade-guidelines.md) — the repo's other
  hidden-information game doc; *Mascarade* hides *identity*, *Mati Lampu* hides
  *position*, and both are driven by a shared table-level uncertainty.
- [Citadels-like Games](../../citadels-like-games.md) and
  [Citadels Comparison Table](../../citadels-comparison-table.md) — role-selection design
  notes; the archetype table in §8 borrows their "role as a different win condition"
  framing.
- [prototypes/indonesian-blackout-bar-brawl/](../../prototypes/indonesian-blackout-bar-brawl/) —
  the engine, simulator, tests, and playable UI.

---

## Changelog

- 2026-10-11 — created. Engine, AI, 600-game simulation, UI contract test, and browser
  smoke test all passing; design tuned against simulation output (maze → open bar map
  raised visibility from 3.3% to 35% and satpam catches from 0 to 7.9 per game).
