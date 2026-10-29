---
title: Math Behind Everyday Things — 30 Facts
category: science
tags: [mathematics, probability, statistics, geometry, everyday, reels]
status: complete
created: 2026-10-19
updated: 2026-10-19
sources:
  - https://en.wikipedia.org/wiki/Birthday_problem
  - https://en.wikipedia.org/wiki/Monty_Hall_problem
  - https://www.statisticsdonewrong.com/p-value.html
  - https://en.wikipedia.org/wiki/Derangement
  - https://en.wikipedia.org/wiki/Secretary_problem
  - https://www.ams.org/publicoutreach/feature-column/fc-2016-06
  - https://en.wikipedia.org/wiki/Sports_Illustrated_cover_jinx
  - https://en.wikipedia.org/wiki/Friendship_paradox
  - https://kids.frontiersin.org/articles/10.3389/frym.2020.582433
  - https://en.wikipedia.org/wiki/Benford%27s_law
  - https://en.wikipedia.org/wiki/Simpson%27s_paradox
  - https://brilliant.org/wiki/berksons-paradox/
  - https://en.wikipedia.org/wiki/Zipf%27s_law
  - https://marketing.wharton.upenn.edu/wp-content/uploads/2018/11/Paper-Joshua-Miller.pdf
  - https://en.wikipedia.org/wiki/Phyllotaxis
  - https://en.wikipedia.org/wiki/Honeycomb_theorem
  - https://en.wikipedia.org/wiki/Periodical_cicadas
  - https://en.wikipedia.org/wiki/Kepler_conjecture
  - https://en.wikipedia.org/wiki/Coastline_paradox
  - https://en.wikipedia.org/wiki/International_standard_paper_sizes
  - https://en.wikipedia.org/wiki/Catenary
  - https://www.primermagazine.com/2017/learn/one-18-pizza-is-more-pizza-than-two-12-pizzas-math-shows-us-why-primer-tackling-the-serious-issues
  - https://en.wikipedia.org/wiki/Rule_of_72
  - https://www.investopedia.com/ask/answer/07/mortgagepayments.asp
  - https://en.wikipedia.org/wiki/Luhn_algorithm
  - https://www.qrcode.com/en/about/error_correction.html
  - https://arxiv.org/html/2407.17364v1
  - https://en.wikipedia.org/wiki/44,100_Hz
  - https://en.wikipedia.org/wiki/JPEG
  - https://en.wikipedia.org/wiki/MP3
  - http://paulgraham.com/spam.html
  - https://www.bsr.org/en/case-studies/center-for-technology-and-sustainability-orion-technology-ups
  - https://www.3newsnow.com/news/local-news/ups-saving-millions-at-the-pump-emphasizes-importance-of-planning-ahead
confidence: high
---

# Math Behind Everyday Things — 30 Facts

## TL;DR

- 30 facts where ordinary life is doing math nobody notices, grouped as probability and risk (1-9), statistics in the wild (10-14), nature and geometry (15-22), and money and tech (23-30).
- Each entry carries the fact with its numbers, the mechanism behind it, and a one-line Instagram-reel hook with a visual idea.
- Every claim is linked to a source fetched via TinyFish on 2026-10-19; worked examples are labeled as such.

## Context

Built as a pool of Instagram-reel topics: short, visual, counterintuitive facts with a numeric punchline. Selection favored facts that show up in daily life, read clean in 30 seconds of video, and survive a skeptical look — no "golden ratio in the Parthenon" style myths.

## Findings

### Probability and risk

#### 1. The birthday paradox — 23 people is enough
**Fact.** In a random group of 23 people there is a 50.7% chance that two share a birthday; 30 people gives 70.6%, 50 gives 97.0%, 70 gives 99.9% ([Wikipedia](https://en.wikipedia.org/wiki/Birthday_problem)).
**The math.** Comparisons happen pair by pair, not person by person: 23 people make 23 x 22 / 2 = 253 pairs, each colliding with probability 1/365. P(all different) = (365/365) x (364/365) x ... x (343/365) ≈ 0.49.
**Reel hook.** "How many people until two share a birthday? You think 183. It is 23." Visual: fill a room one person at a time while a pair counter races to 253.

#### 2. Monty Hall — switching wins two thirds of the time
**Fact.** With a car behind one of three doors and a goat revealed by the host, switching wins with probability 2/3 while staying wins only 1/3 ([Wikipedia](https://en.wikipedia.org/wiki/Monty_Hall_problem)).
**The math.** Your first pick is right with probability 1/3, so the two unchosen doors hold the car with probability 2/3. The host's reveal does not move the car; it concentrates that 2/3 into the single door left closed.
**Reel hook.** "The host knows where the car is. That is the entire trick." Visual: run the game 30 times with cards and tally stay versus switch.

#### 3. A positive screening test is usually not a positive diagnosis
**Fact.** With 0.8% prevalence, 90% test sensitivity, and a 7% false-positive rate, only about 9% of positive mammograms are actual cancer: of 1,000 women, 8 have cancer, about 7 are detected, and 70 of the 992 healthy women test positive ([Statistics Done Wrong](https://www.statisticsdonewrong.com/p-value.html)).
**The math.** Bayes' rule: P(cancer | positive) = 0.9 x 0.008 / 0.077 ≈ 0.09. When the disease is rare, the base rate dominates, and false positives vastly outnumber true ones.
**Reel hook.** "Two-thirds of doctors get this question wrong. You can get it right." Visual: 1,000 dots, 77 lit red, 7 circled.

#### 4. Secret Santa has a fixed 37% chance of zero awkward self-gifts
**Fact.** The probability that nobody in a random gift exchange draws their own name converges to 1/e ≈ 36.8%, and it gets there fast: with 5 people it is already 44/120 ≈ 36.7% ([Wikipedia](https://en.wikipedia.org/wiki/Derangement)).
**The math.** The count of such permutations (derangements) is !n = nearest integer to n!/e, from the alternating sum 1 - 1/1! + 1/2! - 1/3! + ... = e^(-1).
**Reel hook.** "Your office Secret Santa has a 37% chance of zero self-gifts, no matter how big the office." Visual: 1,000 simulated hat draws with the hit rate flatlining at 37%.

#### 5. The 37% rule — when to stop looking
**Fact.** For choosing the single best option from a sequence (apartments, hires), the optimal strategy is to reject the first ~37% and then take the next option better than all seen so far; it finds the best option about 37% of the time regardless of n ([Wikipedia](https://en.wikipedia.org/wiki/Secretary_problem)).
**The math.** Optimal stopping: sample n/e options for information, then act on the first record. It is exploration and exploitation solved by calculus.
**Reel hook.** "Apartment hunting math says reject the first 37% of flats on principle." Visual: timed apartment tour with the 37% cutoff marked on the timeline.

#### 6. Wald's bombers — armor the places with no holes
**Fact.** World War II bombers returned with most damage on the fuselage and very little around the motors; Wald advised armoring the motors, because aircraft hit there did not come back ([AMS Feature Column](https://www.ams.org/publicoutreach/feature-column/fc-2016-06)).
**The math.** Conditioning on survivors censors the failures: the visible damage distribution is not the risk distribution. Survivorship bias in one sentence.
**Reel hook.** "The holes in the planes that came back tell you where not to armor." Visual: a relieved plane with holes, then a ghost plane for the ones that never returned.

#### 7. The Sports Illustrated jinx is regression to the mean
**Fact.** The "curse" is an artifact: athletes land on the cover after an outlier performance, and an extreme result is likely to be followed by something closer to average ([Wikipedia](https://en.wikipedia.org/wiki/Sports_Illustrated_cover_jinx)).
**The math.** Performance = skill + luck. Selecting on a high total selects both high skill and high luck, and luck does not persist.
**Reel hook.** "The cover jinx is not a curse. It is the most predictable thing in sports." Visual: a career-best game, then the number drifting back toward the season average.

#### 8. Your friends have more friends than you do
**Fact.** On average, an individual's friends have more friends than that individual does — first observed by Scott Feld in 1991 ([Wikipedia](https://en.wikipedia.org/wiki/Friendship_paradox)).
**The math.** Size-biased sampling: a person with k friends appears in k friends' lists, so hubs are overrepresented in everyone's neighbor average. The arithmetic-geometric mean inequality makes it typical.
**Reel hook.** "Count your friends. Now count theirs. On average, you lose." Visual: a small social graph where the average friend-of-a-friend outranks you.

#### 9. Why your bus always feels late — the inspection paradox
**Fact.** If buses come every 6 minutes on average, your expected wait is not the naive 3 minutes. You are more likely to arrive inside a long gap, and with random arrivals the expected wait equals the full average gap ([Frontiers for Young Minds](https://kids.frontiersin.org/articles/10.3389/frym.2020.582433)).
**The math.** Length-biased sampling: the chance of landing in an interval is proportional to its length, so long gaps are oversampled.
**Reel hook.** "Your bus is not late. You are sampling the longest gaps." Visual: an uneven bus timeline where most random arrival arrows land in the long gaps.

### Statistics in the wild

#### 10. Benford's law — nature's non-uniform first digits
**Fact.** In many naturally occurring datasets the first digit is not uniform: 1 appears about 30.1% of the time, 2 about 17.6%, down to 9 at 4.6%. Auditors use deviations as a fraud screen ([Wikipedia](https://en.wikipedia.org/wiki/Benford%27s_law)).
**The math.** P(d) = log10(1 + 1/d). Quantities that span orders of magnitude live in logarithmic intervals, and low leading digits get the most room.
**Reel hook.** "In real-world numbers, 1 is the most common first digit — by far. Fake ledgers come out too flat." Visual: real expense data versus hand-picked numbers as bar charts.

#### 11. Simpson's paradox — the table that reverses
**Fact.** In Berkeley's 1973 graduate admissions, 44% of men and 35% of women were admitted overall, yet department by department the gap mostly favored women or vanished — women applied more often to departments with low admission rates ([Wikipedia](https://en.wikipedia.org/wiki/Simpson%27s_paradox)).
**The math.** A pooled average is a weighted average. When group sizes differ across strata, the weights rather than the effects can drive the total.
**Reel hook.** "This table says men were favored. Every single department says otherwise. Both can be true." Visual: an animated table flipping as it is split by department.

#### 12. Berkson's paradox — why filtered pools lie
**Fact.** Selection on a common effect creates correlations that are not there: admitted students show a negative GPA-SAT correlation, and restaurants found through five-star ratings tend to disappoint on taste ([Brilliant](https://brilliant.org/wiki/berksons-paradox/)).
**The math.** Collider bias: conditioning on a variable that both quality and reputation feed into induces dependence between them.
**Reel hook.** "The five-star restaurants you found are the ones where the rating and the food had to trade off." Visual: a quality-versus-rating scatter with the selected band highlighted.

#### 13. Zipf's law — the most common word does double duty
**Fact.** Word frequency in natural language is roughly proportional to 1/rank: the most common word appears about twice as often as the second and three times as often as the third. In the Brown Corpus, "the" alone is nearly 7% of all words ([Wikipedia](https://en.wikipedia.org/wiki/Zipf%27s_law)).
**The math.** A rank-frequency power law: the k-th most common word has frequency proportional to 1/k. The same shape shows up in city sizes and web traffic.
**Reel hook.** "Your number one word is used twice as much as number two. Every language does this." Visual: a word cloud where words shrink exactly with rank.

#### 14. The hot hand is real — after fixing a 30-year-old stats bug
**Fact.** The canonical 1985 finding that the basketball hot hand is a fallacy relied on a measure with a streak-selection bias; after correcting for it, the paper's conclusions reverse (Miller and Sanjurjo, 2018, Econometrica, [PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2018/11/Paper-Joshua-Miller.pdf)).
**The math.** Conditioning on "player made the last k shots" biases the measured probability of the next one; the bias grows with streak length and shrinks slowly with sequence length.
**Reel hook.** "For thirty years, sports math said the hot hand was fake. A statistics bug said otherwise." Visual: a shot chart that lights up during real streaks.

### Nature and geometry

#### 15. The golden angle — 137.5 degrees, forever
**Fact.** Many plants place each new leaf or seed about 137.5 degrees around from the last, and the spirals that result count in Fibonacci numbers: 8 and 13 on a pinecone, 13 and 21 on a sunflower ([Wikipedia](https://en.wikipedia.org/wiki/Phyllotaxis)).
**The math.** The golden angle is 360 x (1 - 1/phi) ≈ 137.507 degrees. Because the golden ratio is badly approximated by fractions, successive points never stack radially, so seeds pack with maximum spacing.
**Reel hook.** "Pinecones run 8 spirals one way and 13 the other. The plant is following one rule: 137.5 degrees." Visual: overlay both spiral families on a sunflower.

#### 16. Honeycombs are a proven optimum
**Fact.** A regular hexagonal grid has the least total perimeter of any subdivision of the plane into equal-area regions. Bees have built it for millions of years; Thomas Hales proved it in 1999 ([Wikipedia](https://en.wikipedia.org/wiki/Honeycomb_theorem)).
**The math.** Among tilings of equal-area cells, hexagons share walls at 120 degrees and minimize the wax spent per unit of storage.
**Reel hook.** "Bees solved an optimization problem that took humans until 1999 to prove." Visual: triangle, square, and hexagon tilings side by side with the same cell area, counting perimeter.

#### 17. Cicadas count in primes
**Fact.** Periodical cicadas emerge on 13- and 17-year cycles. One leading hypothesis is that prime periods rarely align with shorter predator cycles, and the two broods coincide only every 13 x 17 = 221 years ([Wikipedia](https://en.wikipedia.org/wiki/Periodical_cicadas)).
**The math.** A predator on a 3-year cycle meets a 13-year cicada every 39 years and a 17-year cicada every 51; a composite cycle such as 12 or 18 would sync far more often.
**Reel hook.** "13 and 17 are prime, and that may be the point: the two broods sync once in 221 years." Visual: two gears with 13 and 17 teeth locking only at the top.

#### 18. Stacking oranges hits a proven ceiling
**Fact.** No packing of equal spheres fills space better than about 74.05%, achieved by face-centered cubic and hexagonal close packing. Kepler conjectured it in 1611; Thomas Hales announced the proof in 1998 ([Wikipedia](https://en.wikipedia.org/wiki/Kepler_conjecture)).
**The math.** The optimal density is pi / (3 x sqrt(2)) ≈ 0.7405 — about 26% of any such arrangement is empty space, no matter how you stack.
**Reel hook.** "Stack oranges like a grocer and you have hit the proven limit of packing: 26% air." Visual: an orange pyramid with the voids highlighted.

#### 19. How long is a coastline? It depends on your ruler
**Fact.** Britain's coastline measures about 2,800 km with a 100 km ruler and about 3,400 km with a 50 km ruler; as the ruler shrinks, the measured length grows without settling ([Wikipedia](https://en.wikipedia.org/wiki/Coastline_paradox)).
**The math.** Coastlines are statistically self-similar: length scales as L(r) proportional to r^(1-D), where D is the fractal dimension. There is no single true perimeter.
**Reel hook.** "How long is a coastline? Wrong question — the ruler picks the answer." Visual: measuring sticks shrinking along a coast while the odometer climbs.

#### 20. One 18-inch pizza beats two 12-inch pizzas
**Fact.** An 18-inch pizza has about 254.5 square inches of area; two 12-inch pizzas have about 226.2. The single large is roughly 12.5% more pizza ([Primer](https://www.primermagazine.com/2017/learn/one-18-pizza-is-more-pizza-than-two-12-pizzas-math-shows-us-why-primer-tackling-the-serious-issues)).
**The math.** Area = pi x r^2, so area grows with the square of diameter: 9^2 = 81 beats 2 x 6^2 = 72.
**Reel hook.** "Two 12s or one 18? Math says the 18, every time." Visual: two 12-inch circles morphing into one 18-inch circle, with the leftover wedge.

#### 21. A4 paper is designed around the square root of 2
**Fact.** Every A-series sheet has a ratio of sqrt(2):1 (A4 is 210 x 297 mm), so folding any size in half produces the next size with the exact same ratio; A0 is defined as 1 square meter ([Wikipedia](https://en.wikipedia.org/wiki/International_standard_paper_sizes)).
**The math.** Requiring L/S = S/(L/2) squares to (L/S)^2 = 2, so L/S = sqrt(2) ≈ 1.414. Halving area preserves shape.
**Reel hook.** "Fold A4 in half and it is still A-ratio. Copy rooms run on a square root." Visual: A0 folding down to A4 while the ratio readout stays fixed at 1.414.

#### 22. Power lines are cosh curves, not parabolas
**Fact.** A hanging chain under its own weight follows a hyperbolic cosine, not a parabola — that is the shape of power lines and suspension cables. The St. Louis Gateway Arch is a weighted catenary, close to but not exactly a pure one ([Wikipedia](https://en.wikipedia.org/wiki/Catenary)).
**The math.** Minimizing potential energy along a uniform hanging cable gives y = a x cosh(x/a), the catenary.
**Reel hook.** "Power lines are not parabolas. They are cosh, and yes, that is a real curve." Visual: overlay a parabola and a catenary on a power line; the gap opens toward the towers.

### Money and tech

#### 23. The rule of 72
**Fact.** Divide 72 by the interest rate to estimate doubling time: at 6% money doubles in about 12 years; at 1% it takes about 72 years ([Wikipedia](https://en.wikipedia.org/wiki/Rule_of_72)).
**The math.** For compounding, doubling time is ln(2)/rate ≈ 69.3/rate; 72 is the convenient numerator because it divides by 1 through 12 easily.
**Reel hook.** "6% doubles your money in 12 years. 1% takes 72 years. Same rule." Visual: two balance curves racing on one axis.

#### 24. Year one of a mortgage is mostly interest
**Fact.** Mortgage payments are structured so early installments mostly cover interest. Worked example: $300,000 at 6% over 30 years means a payment of about $1,799, and the first month sends $1,500 (about 83%) to interest and only about $299 to principal (structure per [Investopedia](https://www.investopedia.com/ask/answer/07/mortgagepayments.asp)).
**The math.** Interest is charged on the remaining balance: 300,000 x 0.06/12 = 1,500. Every payment lowers the balance slightly, so the interest slice shrinks and the principal slice grows until they cross.
**Reel hook.** "First mortgage payment: 83 cents of every dollar goes to the bank." Visual: two pie charts, month one versus month 360.

#### 25. Your card number carries its own typo check
**Fact.** Credit card numbers end in a Luhn mod-10 check digit, so a site can spot a typo before charging anything. It catches every single-digit error and almost all adjacent swaps; the 09-to-90 transpose slips through ([Wikipedia](https://en.wikipedia.org/wiki/Luhn_algorithm)).
**The math.** Double every second digit from the right, subtract 9 from any result over 9, add everything up: a valid number sums to a multiple of 10.
**Reel hook.** "Mistype one digit of your card. The site knows before it even tries." Visual: a card number typed wrong, check digit flipping red instantly.

#### 26. A smudged QR code still scans — on purpose
**Fact.** QR codes carry Reed-Solomon error-correction codewords. The four levels restore roughly 7%, 15%, 25%, or 30% of codewords (L, M, Q, H), which is why a dirty or partly covered code still decodes ([DENSO WAVE](https://www.qrcode.com/en/about/error_correction.html), [arXiv](https://arxiv.org/html/2407.17364v1)).
**The math.** Reed-Solomon adds t check symbols to correct t unknown errors, or up to 2t when the error locations are known; redundancy buys survivability at the cost of code size.
**Reel hook.** "Scratch out 30% of a QR code (level H) and it still scans. That is math holding the picture together." Visual: progressively damaging a QR code until it dies, with the level shown.

#### 27. Why audio is sampled 44,100 times a second
**Fact.** Human hearing tops out near 20 kHz, and the Nyquist-Shannon theorem requires sampling above twice the highest frequency (over 40 kHz) plus headroom for practical anti-aliasing filters; the exact 44.1 kHz figure came from 1970s PCM adaptors storing digital audio on video tape ([Wikipedia](https://en.wikipedia.org/wiki/44,100_Hz)).
**The math.** Sampling at fs captures frequencies below fs/2. To keep 20 kHz safe, fs must exceed 40 kHz with a transition band for the filter.
**Reel hook.** "44,100 is not arbitrary: double your hearing limit, plus room for the filter." Visual: a waveform sampled at rising rates until the jaggies disappear.

#### 28. JPEG throws away what you cannot see; MP3 what you cannot hear
**Fact.** JPEG compression is built on the discrete cosine transform plus quantization that discards detail the eye is unlikely to notice; MP3 uses a psychoacoustic model exploiting auditory masking ([JPEG](https://en.wikipedia.org/wiki/JPEG), [MP3](https://en.wikipedia.org/wiki/MP3)).
**The math.** Transform coding: move the data into a basis (cosine blocks, frequency bands), then spend bits only where human perception is sensitive.
**Reel hook.** "JPEG deletes what you cannot see. MP3 deletes what you cannot hear while something louder is playing." Visual: zooming into JPEG blocks; a quiet tone vanishing next to a loud one.

#### 29. Your spam folder is Bayes' theorem
**Fact.** Paul Graham's 2002 "A Plan for Spam" filtered email by combining per-word spam probabilities with Bayes' rule; the essay reported fewer than 5 missed spams per 1,000 with 0 false positives ([Paul Graham](http://paulgraham.com/spam.html)).
**The math.** Each token contributes a likelihood ratio; multiplying the odds across tokens yields the message's spam probability.
**Reel hook.** "Every word in an email is a witness, and Bayes' theorem holds the trial." Visual: an email with each word weighted, probabilities flowing together into a verdict.

#### 30. Your delivery route is a traveling salesman problem
**Fact.** UPS's ORION evaluates more than 200,000 route alternatives per driver; since 2012 it has saved roughly 100 million miles and 10 million gallons of fuel per year, with $300-400 million in annual savings at full deployment ([KMTV](https://www.3newsnow.com/news/local-news/ups-saving-millions-at-the-pump-emphasizes-importance-of-planning-ahead), [BSR](https://www.bsr.org/en/case-studies/center-for-technology-and-sustainability-orion-technology-ups)).
**The math.** Vehicle routing is the traveling salesman problem with capacity and time-window constraints — NP-hard, so real systems settle for near-optimal routes. One saved mile per driver per day is worth about $50 million a year to UPS.
**Reel hook.** "Your package route is a 90-year-old unsolved math problem, solved well enough to save 100 million miles." Visual: a spaghetti route collapsing into an ordered loop stop by stop.

## Open Questions

- Benford's law is a screening tool, not proof: the Wikipedia page documents criticism of its use for election fraud and notes many caveats.
- The hot hand correction targets a specific streak measure; effect sizes and replications remain an active debate.
- The prime-cycle explanation for cicadas is a hypothesis (predator avoidance and hybridization prevention are both proposed), not settled science.
- ORION figures vary by source and deployment stage ($300-400 million per year once fully deployed, 100 million miles annually, 10 million gallons of fuel).
- Reserve bench for future reels, not yet researched: caffeine's ~5-hour half-life, braking distance scaling with the square of speed, MPG versus gallons-per-mile nonlinearity, Little's law for queues, Braess's paradox for traffic, and the size of 52 factorial.

## Related

- This is the first entry in `research/science/`.
- Probability-adjacent repo work: [Gambler x Gamble edition comparison](../product/gambler-x-gamble-edition-comparison-reviews.md) covers a dice-and-gambling board game.

## Changelog

- 2026-10-19 — created: 30 facts sourced and verified via TinyFish search and page fetches.
