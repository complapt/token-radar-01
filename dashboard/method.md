# Token Radar, radar-12: method

## The model

One ordinary least squares fit of `log10(market-cap / TVL)` on size
(`log10(TVL) − 8`), seven-day TVL growth and a category dummy (Lending,
RWA), with a small ridge term. The fitted multiple is clamped to
[0.02, 3] and multiplied by TVL for the implied value. As a power law:
implied = 10^4.36 × TVL^0.36 × 10^(0.24 × growth) × category.

## Clean comps

The fit uses **71 dated anchors only**: live-token protocols with a
market cap, a known listing date and a priceable category. Excluded, by
the same rule that sets them aside on the board: 24 exchanges, bridges
or staked receipts (their TVL is custodial balances, assets in transit
or a repackaged asset, not protocol value; fitting on them made the
leave-one-out miss ×3.18 instead of ×2.92) and 33 priced anchors with
no listing date (fitting on all 128 made the holdout miss ×5.84). No
name is special-cased and no row is hand-picked.

## Validation (recomputed from the sealed snapshot)

| Check | Result |
|---|---|
| Leave-one-out miss | ×2.92 |
| Seeded 80/20 holdout, one split (n=15) | ×2.88 |
| Seeded 80/20 holdout, 10-seed mean (median) | ×2.57 (×2.63) |
| Walk-forward, fitted before 2025, tested on 2025+ | ×2.03 |
| 50% prediction range holds, holdout | 53% |
| Total implied value, 203 rows | $2.65B |

Quote the single split and the 10-seed mean together: one split is 15
anchors, so it jumps around.

## Age: not in the multiple, used for launch odds

Age is deliberately **not** in the fitted multiple: adding it made the
walk-forward miss ×8.50–×12. It is used for **launch odds**, the share
of protocols in each age band that already carry a token, counted from
the snapshot. The 6–12 month and 1–2 year bands are pooled at their
joint 38.7% (raw shares dip 39.7% then 38.3%; odds that fall with age
are noise). Held out over ten 80/20 splits, the odds predict whether a
protocol has a token with 67.1% accuracy (base rate 54.9%), Brier
0.214.

**Expected value** = implied value × launch odds. Rank stays by implied
value; the top ten by expected value surface old protocols that still
have not launched (Polymarket implied #9, expected #3; Lofty #35, #9).

## Farm plans, net of costs

The payoff if the token launches is a **0.5% airdrop** of the
implied value, times the launch odds, minus gas, minus lock-up cost of
the capital at 4% a year. Farm at $50 net/hour or more, marginal
$10–$50, skip below $10. The 0.5% is an assumption, and a deliberate
one: a single farming wallet realistically receives well under 1% of a
launch's fully diluted value. Earlier rounds used 5%, which made the
verdict non-discriminating — a 5% slice of a tens-of-millions implied
value dwarfs a $25 gas bill, so 202 of 203 rows were farm and one was
marginal. At 0.5% the verdicts separate: 28 farm, 146 marginal, 29
skip. Every row prints its net hourly rate and break-even odds, so the
verdict can be re-derived with a different share. The **Best farms**
list and the **$500 portfolio**, ranked by net $/hour, are where farms
separate.

## Rank stability

The board is refitted 200 times on resamples of the 71 fit anchors;
each row shows its rank range (10th–90th percentile). The top 3 are
tight (rank 1 stays #1 in 43% of refits).

## Nearest neighbours

Each detail view shows the five nearest live-token protocols by log10
TVL, same category first, with each one's actual mcap / TVL and the
median multiple against the model's. The neighbours vary widely; the
median and the fitted multiple agree within 20% for only 2 of the top
20 rows, so the table is a cross-check, not a second valuation.
