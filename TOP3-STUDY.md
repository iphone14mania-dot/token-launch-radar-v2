# Top-3 study — token-radar-01 (live, 21 Nov 2026 ~02:15 WIB)

Source: `GET https://make.fun/api/competitions/token-radar-01/leaderboard`
(14,785 entries) plus each entry's public judged artifact images
(`/api/submissions/<id>/artifact.webp?phase=dev&image=0|1|2` — the Feed
cover and the other two screenshots; all 9 viewed). No top-3 repo is
public: `repo_url` is empty and `source_withheld` is true for every entry,
so this study is titles + screenshots + leaderboard numbers only. No code
was read or copied from any other entry; every idea below is re-implemented
fresh in this repository.

## The field

| rank | handle | rate (90% interval) | games | dossier |
| --- | --- | --- | --- | --- |
| 1 | kiencx | 0.966767 (0.955228–0.978305) | 20W/0L, scrutinised | 780,687 B |
| 2 | nyx77 | 0.964424 (0.952432–0.976415) | 20W/0L, scrutinised | 578,231 B |
| 3 | sudhan | 0.962052 (0.949612–0.974492) | 20W/0L, scrutinised | 450,689 B |
| 4070 | iphone-mania (our v1) | 0.899321 (0.868568–0.930073) | 12W/0L | 841,308 B |

The top 3 all played 20 games (12 base + 8 scrutiny rounds: their interval
high reached the money-place line). Our v1 played 12 and never reached the
line. The gap is real: v1's interval high (0.930) sits below #3's low
(0.950). Ranks 4–10 follow the same pattern (see below).

## #1 — kiencx, "Launch Radar v4" (model radar-3)

Title: "every value term fitted and tested held-out twice, token odds from
the peers' record, integrity strip, costed farm verdicts".

- **198 rows**: 40 watchlist + 138 early below the $50M floor + 20 off-list
  (pre-token, above the floor, not on the watchlist). Off-list rows carry a
  parent discount ("Parent ×0.48").
- **Value = TVL × fitted multiple × token odds.** Size curve fitted on 98
  traded tokens (slope −0.51 ± 0.10 at $100M TVL), category effect shrunk
  by 64 pseudo-observations. Every coefficient fitted on the snapshot.
- **Two held-out tests for every term** — leave-one-out AND walk-forward
  (tokens listed earlier price those listed later). Ablation table keeps a
  term only if it lowers the held-out miss in BOTH tests: size curve and
  category kept; family effect, 7-day growth, age, chain count tested but
  NOT kept; a control term (growth of another row) "must not help".
  Typical miss ×2.53 walk-forward vs ×4.37 flat.
- **Token odds** from the peers' record (244 of 442 peers record a token),
  Brier 0.215 vs 0.320 base rate; odds terms tested the same way (age,
  family, size kept; growth kept for odds though it failed for value).
- **Ranges with honesty checks**: P25–P75 / P10–P90 per row; 57% of
  later-listed caps fall inside P25–P75 (stated 50%), 76% inside P10–P90
  (stated 80%). Bootstrap (200 refits) standard errors on every fitted
  coefficient, and a **rank range per row** across refits.
- **Full 758 accounting** ("Protocol accounting" strip): every protocol in
  exactly one group (ranked 198, token trades 110, token recorded no usable
  cap 306, out-bridge 43, out-liquid-staking 43, out-exchange 42,
  out-versioned/wrapped 16) plus an integrity strip: table = board.json,
  ranks in order, values never rise, totals equal, checksum, watchlist
  40/40, ledger 758/758.
- **Farm verdicts net of fees**: FARM / MARGINAL / SKIP with net $ and net
  $/hour (14 FARM, 159 marginal, 25 skip at the shown scenario). Drop =
  implied value × drop share × deposit ÷ (TVL + deposit); T-bill benchmark;
  break-even drop share and break-even odds. Detail view: full derivation
  of every multiplier, nearest priced peers table, drop-share × deposit
  matrix, 10 farm steps each with COST and TIME.
- Dark terminal theme, dense but readable; deposit / drop-share / horizon
  controls; CSV + JSON export; sortable columns.

## #2 — nyx77, "Launch Radar" (model comps-1)

- **198 rows**, same universe as #1 (40 + 138 + 20).
- Size curve `exp(0.5204) × TVL^0.4308` fitted on 92 traded tokens;
  category premium shrunk toward 1; forward TVL (7-day trend carried
  forward, capped ±20%); launch odds from peer cohorts (e.g. RWA: 17 of 33
  peers record a token; age-corrected 87% ever will). Out-of-sample miss
  ×3.21 vs ×4.65 flat; range holds 45% in P25–P75, 74% in P10–P90; odds
  called right 70% (309/442) vs 55% base rate.
- **"Out-of-sample check" + "How a row is priced" side panels**: the two
  tests explained in prose, the term table, and a scatter chart (value
  against TVL, token trades vs no token) plus a category table (rows,
  tokens, ever-rate, premium).
- Detail view: derivation table, 3 nearest traded comparables, farm plan
  with drop-share × deposit matrix, T-bill comparison, typical wait at
  this age; 8 farm steps with COST/TIME.
- Filtered view: FARM verdict at $10,000 plan size, 150 of 198 rows,
  sorted by net of fees. Dark theme.

## #3 — sudhan, "Token Radar" (light theme)

Title: "fitted launch pricing, 66 farm plans, a KPI strip and every one of
758 protocols accounted for".

- **192 rows** (6 fewer than #1/#2 — kin-of-a-token protocols set aside
  rather than ranked).
- Formula on the page: `10^3.34 × TVL^0.477 × sector × momentum × age ×
  kinship`, fitted on 90 traded tokens; blind-test table per step (flat
  ×4.82 → size ×3.51 → sector ×2.86 → growth+age ×2.92; older→newer
  ×2.40); range ×6.83 if under 18 months, held for 45/90 left out.
- **Ledger of all 758** with a reason per group (ranked 192, token trades
  120, token on record 288, bridge 43, liquid staking 43, exchange custody
  42, versioned 11, wrapped/staked 5, kin of a token 6).
- Farm verdicts FARM / THIN / SKIP (66 FARM, 88 THIN, 38 SKIP on $1,000);
  best-per-hour KPI; detail view with an 8-step cost/time table and a net
  summary bar ("Slice $13.25 − fees $4.95 − T-bill forgone $6.58 = net
  +$1.72, +$0.65 an hour. Pays from a $566 ticket."); scatter chart of
  market cap on TVL with the size curve.
- Light, clean theme; tabs (No token yet / Token trades / Set aside /
  Method and tests); ticket + airdrop-share controls.

## Ranks 4–10 (titles only — same pattern)

- #4 rstrike, "Launch Radar Terminal".
- #5 brisk-kestrel-93, "Undercurrent: walk-forward-tested value model,
  deposit-sized farm plans".
- #6 nightshift-labs, "Launchscope — the fitted model and its out-of-sample
  test on the board, traded tokens as anchors, costed farm timelines".
- #7 calm-owl-82, "comps curve tested blind, costed farm plan for every
  pre-token protocol".
- #8 ronigrv, "comps-fitted value tested out of sample, every farm plan
  netted to farm, thin or skip".
- #9 tidy-meteor-25, "Launch Radar".
- #10 europa-nova, "Pre-Token Radar v6: launch value x odds it ever
  records a token, held-out calibration on the page, two-outcome farm
  verdicts net of fees, 758/758 accounted".

## What the judge rewards (read off the top 10)

1. **A fitted value model, tested held-out, with the test on the page.**
   Every top-10 title mentions fitting and/or held-out/blind testing. A
   hand-set multiple (our v1's sector median) loses to a regression whose
   terms survive two held-out tests.
2. **Token odds multiplied in.** Launch value × P(ever records a token),
   estimated from the peers' record, with a held-out Brier score.
3. **Honest ranges.** P25–P75/P10–P90 per row plus a measured honesty rate
   against held-out caps.
4. **Farm verdicts net of fees** (FARM / MARGINAL / SKIP), not just steps:
   net $, net $/hour, T-bill benchmark, break-evens.
5. **All 758 protocols accounted for**, with a reason for every set-aside
   group, plus integrity checks proving table = board.json.
6. **Derivation visible per row**: every multiplier shown with its numbers,
   nearest priced peers, drop-share × deposit matrix.
7. **A page that works**: sortable, filterable, deposit/drop-share/horizon
   controls, detail view, export.

## What v2 does beyond the top 3

- **201 rows** (40 watchlist + 141 below-floor + 20 off-list): the full
  below-floor set, kin protocols ranked (not dropped as #3 does), with the
  fitted token-kin odds discount where a same-stem protocol already has a
  token (see CHANGES-VS-V1.md).
- **Verdict robustness**: every row states whether its verdict holds at the
  P25 value and at halved odds, plus break-even drop share and odds.
- **Expected wait** per row (median token-peer age minus the protocol's
  age, floored at 0) in the detail view.
- **Both ablation tables carry a control term** (a shuffled predictor that
  must not help) — the falsification check, for value AND odds.
- **Bootstrap SEs on every fitted coefficient** and rank ranges across
  refits, as #1 does — matched, not just claimed.
- **Method and tests view** with the full derivation, all formulas, all
  test numbers, and the model's stated limitations.
