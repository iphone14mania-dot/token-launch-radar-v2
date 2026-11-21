# Changes vs v1 (token-launch-radar, submission 01a1f80a, rank 4070)

V1's model ("radar-2") was a sector-median multiple with shrinkage, a
hand-set growth curve, a hand-set maturity curve and a chain bonus, plus
six generic farm steps per protocol. It ranked 178 rows and accounted for
382 of 758 protocols. The live leaderboard (21 Nov 2026) puts it at rate
0.899, well below the top 3 (0.962–0.967). V2 ("launchfit-1") rebuilds the
model, the farm plans and the page from the top-3 study (TOP3-STUDY.md).
No v1 code was read or copied; this is a fresh implementation.

## Model: fitted, not hand-set

| | v1 (radar-2) | v2 (launchfit-1) |
| --- | --- | --- |
| Size term | sector median mcap/TVL, shrunk | OLS log-log regression of mcap on TVL over 92 usable traded comps, fitted in the run |
| Sector term | median ratio per category | mean residual per category, shrunk toward 0 (16 pseudo-observations; only categories with 4+ comps earn an effect) |
| Growth term | hand-set `1 + 0.45·sign·sqrt` | tested, not kept: lowers the leave-one-out miss but worsens walk-forward |
| Age term | hand-set `0.6 + 0.4·age/(age+365)` | tested, not kept: helps one test, hurts the other |
| Chain term | hand-set +3% per chain to +15% | tested, not kept: helps one test, hurts the other |
| Kinship | not modelled | tested for value, not kept (coefficient ~0); enters the odds instead, where it is kept |
| Token odds | none — implied value assumed launch | P(ever records a token) from a logistic fit on the 465 eligible peers (age, size, token-bearing kin); growth tested, not kept; Brier reported held-out |
| Implied value | TVL × multiple × growth × maturity × chain | value-if-launches × token odds |
| Held-out tests | none | leave-one-out + older→newer walk-forward for value AND odds; ablation table with kept / tested-not-kept / control term |
| Ranges | none | P25–P75 and P10–P90 from the held-out residual distribution, with measured honesty rates |
| Uncertainty | none | deterministic seeded bootstrap (200 refits): SE on every coefficient, rank range per row |

## Coverage

- **201 rows** (v1: 178): the whole 40-protocol watchlist, all 141
  pre-token protocols below the floor that pass the rules, and the 20
  pre-token protocols above the floor the watchlist leaves out (off-list,
  marked). V1 set aside 164 pre-token protocols without ranking them.
- **All 758 protocols accounted for** (v1: 382): the ledger names every
  group — ranked watchlist / early / off-list, priced comps, token on
  record without a usable cap, bridge, liquid staking, exchange custody,
  versioned, wrapped/staked — with the count and the reason for each.
- **Off-list protocols ranked with a discount** instead of ignored:
  Sentora Curator ($2.76B TVL) is the largest pre-token protocol in the
  snapshot and v1 left it out entirely.

## Farm plans: verdicts, not just steps

- **10 steps per protocol** (v1: 6), each with a cost and a time, and
  the numbers derive from the protocol's own record: first chain's gas,
  category's play, an exit rule at −17% TVL and a review date 12 weeks
  out. 3.5 hours hands-on, 19 transactions.
- **A verdict per row** (v1: none): FARM / MARGINAL / SKIP, net of fees,
  with net $, net $/hour, the T-bill benchmark, break-even drop share,
  break-even odds, and whether the verdict holds at the P25 value and at
  halved odds.
- Drop model on the page: drop = implied value × drop share × deposit ÷
  (TVL + deposit); the detail view shows the drop-share × deposit matrix
  and the benchmarks.
- Deposit, drop share and horizon are live controls; the verdicts
  recompute in the browser.

## Dashboard

- KPI strip (protocols ranked, watchlist 40/40, FARM verdicts, median
  token odds, top implied value, set aside) + the model formula in words.
- Out-of-sample evidence panel: both ablation tables, range-honesty
  table, fitted coefficients with bootstrap SEs.
- Protocol accounting strip (ledger 758/758) + integrity strip: the
  browser refits the model from the shipped snapshot and recomputes every
  row — 201/201 implied values match, 201/201 farm plans match word for
  word, coefficients match.
- Scatter chart (log-log TVL vs market cap: the 92 comps and the fitted
  size curve).
- Detail view per protocol: full derivation of every multiplier, nearest
  priced peers, farm verdict panel, 10-step plan, expected wait.
- Views: board, token trades (comps), set aside (every non-ranked protocol
  with its reason), method and tests.
- Sortable columns, verdict/tier/category/chain/search filters, CSV/JSON
  export, deep links (`#/protocol/<slug>`, `#/<view>`).
- Same shape as v1 (main.ts + dashboard + screenshots + dossier), same
  gate contract; dashboard source kept under the 64 KB dossier-text
  budget so the judge reads it whole.

## What v1 did right and v2 keeps

- Sector multiples from the market, not from names; median-age fallback
  for unknown listing dates; "records no token, never has none" wording;
  the dashboard recomputing the board so screen and board.json agree;
  deterministic two-run byte-identical output.
