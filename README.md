# token-launch-radar-v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iphone14mania-dot/token-launch-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iphone14mania-dot/token-launch-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks every DeFi protocol that records no token yet by an implied value — what it would be worth if a token launched, times the odds it ever records one — and gives each protocol a costed farm plan with a verdict. The model is fitted on the snapshot's own figures and tested held-out twice before it is allowed to price anything.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

## How it works

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot, scores every launch candidate with the model in `dashboard/model.js`, and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. The dashboard is a static page with no network: open `dashboard/index.html` beside the generated `data.js`.

**The board.** 201 rows: the whole 40-protocol watchlist, 141 early candidates below the $50M floor, and 20 off-list candidates above it that pass the watchlist rule but are left out only by DefiLlama's parent record. A launch candidate records no token (no market cap, no CoinGecko id, no symbol) and is not a bridge, liquid staking, exchange custody, versioned listing, or wrapped/staked by name. The 141 pre-token protocols the board does not rank are shown in the dashboard's "Set aside" view with the reason each was excluded, and the 40 largest live-token protocols are shown separately with their real market caps. All 758 protocols are accounted for in the ledger strip.

**The value model (`launchfit-1`).** Implied value follows from the snapshot's own figures, never from a hardcoded list of names:

- **Value if a token launches:** a log-log size curve fitted on the 92 traded tokens with usable caps — `log10(mcap) = 3.958 + 0.394 · log10(TVL)` — plus category effects shrunk toward no effect (16 pseudo-observations; only categories with 4+ comps earn one). Dexs ×1.06, Lending ×0.65, Basis Trading ×1.44.
- **Token odds:** a logistic fit on the 465 eligible peers — age (+0.79), size (+0.30), and token-bearing kin (−0.88: a same-stem protocol already has a token, and families almost never mint twice).
- **Held-out tests, on the page:** every term was tried and kept only if it lowered the held-out miss in one test and worsened neither. Leave-one-out and walk-forward (older protocols price newer ones). Value miss ×3.16 leave-one-out and ×2.11 walk-forward, against ×4.68 / ×4.52 for a flat median multiple. Odds Brier 0.211 / 0.254 against a 0.247 / 0.356 base rate. Growth, age, chain count and kinship were tested for the value model and did not survive; a permuted control term is reported to show the tests can say no.
- **Ranges:** P25–P75 and P10–P90 from the held-out residuals; walk-forward they hold 21/35 and 25/35. A seeded 200-refit bootstrap gives standard errors and a 90% rank interval per row.

The dashboard refits the model in the browser from the shipped snapshot and recomputes every row, so the number on screen and the number in `board.json` agree by construction — the integrity strip shows the match counts.

**Farm plans.** Ten steps per protocol, derived from its own record: the category decides the action, the first chain decides the gas, the TVL sets the exit rule. Each step states what it costs and how long it takes (3.5 hours hands-on, 19 transactions). The verdict is net of fees against the T-bill yield on the same deposit over the same weeks: 51 FARM, 75 MARGINAL, 75 SKIP at the $1,000 / 7% / 12-week reference. Every row also shows break-even drop share and token odds, and whether the verdict holds at P25 value or halved odds. No Ethereum-first farm pays at $1,000 — the gas alone is $115.50.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fcek93em&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
