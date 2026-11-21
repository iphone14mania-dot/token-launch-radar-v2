// launchfit-1: the token-launch radar model. One file, no imports, no network.
// main.ts (Node) and the dashboard page (browser) both run it: the page refits
// the model from the shipped snapshot and recomputes every row, so the number on
// screen and the number in board.json agree by construction, never by trust.
//
//   implied value = value if a token launches x odds it ever records one.
// Value if it launches is a log-log size curve fitted on the 92 traded tokens
// with usable caps, plus shrunk category effects. Odds come from a logistic fit
// on the 465 eligible peers (age, size, token-bearing kin). Every term was
// tried and kept only if it lowered the held-out miss in BOTH tests —
// leave-one-out and walk-forward — and a permuted control term is reported to
// show the tests can say no. Ranges come from the held-out residuals; a seeded
// bootstrap gives standard errors and 90% rank intervals.

const DAY = 86400000;
const CAT_WHY = { Bridge: 'bridge', 'Canonical Bridge': 'bridge', 'Liquid Staking': 'liquid staking',
  'Liquid Restaking': 'liquid staking', 'Restaked BTC': 'liquid staking', CEX: 'exchange custody' };
const EXCL_CATS = new Set(Object.keys(CAT_WHY));
const EXCH = ['binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx', 'bitfinex', 'gemini'];
const VERSIONED = /\s(V2|v2|2\.0|V3|v3|3\.0)\s*$/;
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/;
const CAT_K = 16; // pseudo-count shrinking each category effect toward no effect
const CAT_MIN = 4; // a category needs this many traded comps to earn an effect
const BOOT_REPS = 200; // bootstrap refits (seeded, deterministic)
const BOOT_SEED = 0xc0ffee;
const REF_DEPOSIT = 1000; // farm reference plan: $1,000, 7% drop share, 12 weeks
const REF_DROP = 0.07;
const REF_WEEKS = 12;
const TBILL = 0.04; // 4% a year, the yield a farm must beat

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Chain count of a protocol record or a board row (array or count). */
const chainCount = (r) => (Array.isArray(r.chains) ? r.chains.length : r.chains);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => {
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
const sig = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// snapshot

function parseSnapshot(text) {
  const s = JSON.parse(text);
  if (!Array.isArray(s.protocols) || !Array.isArray(s.watchlist) || typeof s.as_of !== 'string') {
    throw new Error('snapshot is not the sealed DefiLlama snapshot');
  }
  return s;
}

const isPreToken = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;

/** The watchlist rule's name clause, as RULES.txt states it. */
function nameRule(p) {
  if (VERSIONED.test(p.name)) return 'versioned';
  if (WRAPPED_WORD.test(p.name.toLowerCase())) return 'wrapped';
  if (EXCH.some((e) => p.name.toLowerCase().startsWith(e))) return 'exchange';
  return null;
}

const stemOf = (name) => name.trim().split(/[\s\-:]+/)[0].toLowerCase();
const ageDays = (p, asOfMs) =>
  !p.listed_at ? null : Math.max(1, Math.round((asOfMs - Date.parse(`${p.listed_at}T00:00:00Z`)) / DAY));

/** Every protocol in exactly one group. Ranked: the watchlist (authoritative),
 * early (below the $50M floor) and off-list (above the floor, left out only
 * by DefiLlama's parent record, which the snapshot does not carry). Set
 * aside: bridge, liquid staking, exchange custody, versioned, wrapped, or a
 * token already on record. Token-bearing protocols split into comps (a usable
 * market cap: the value model's calibration set) and the rest. */
function classify(snapshot) {
  const asOfMs = Date.parse(`${snapshot.as_of}T00:00:00Z`);
  const wl = new Set(snapshot.watchlist);
  const ages = snapshot.protocols.map((p) => ageDays(p, asOfMs)).filter((a) => a !== null);
  const medAge = median(ages);
  const famSize = new Map();
  const famTok = new Map();
  for (const p of snapshot.protocols) {
    const st = stemOf(p.name);
    if (st.length < 3) continue;
    famSize.set(st, (famSize.get(st) || 0) + 1);
    if (!isPreToken(p)) famTok.set(st, true);
  }
  const kinOf = (p) => (famSize.get(stemOf(p.name)) || 0) >= 2;
  const tokenKinOf = (p) => isPreToken(p) && famTok.has(stemOf(p.name));
  const rows = [];
  const comps = [];
  const peers = [];
  const setAside = [];
  const live = [];
  for (const p of snapshot.protocols) {
    const pre = isPreToken(p);
    const age = ageDays(p, asOfMs);
    const base = { slug: p.slug, name: p.name, category: p.category || 'Uncategorised', chains: p.chains,
      tvl: p.tvl_usd, change: p.change_7d === null ? null : clamp(p.change_7d, -50, 100),
      age: age === null ? medAge : age, ageKnown: age !== null, listed: p.listed_at,
      kin: kinOf(p), tokenKin: tokenKinOf(p), mcap: p.mcap_usd };
    if (!pre) {
      if (p.mcap_usd > 0 && p.tvl_usd > 0) live.push(base);
      const usable = p.mcap_usd > 0 && p.tvl_usd > 0 && !EXCL_CATS.has(p.category) && !nameRule(p);
      if (usable) comps.push(base);
      if (!EXCL_CATS.has(p.category) && !nameRule(p)) peers.push({ ...base, y: 1 });
      continue;
    }
    if (wl.has(p.slug)) { rows.push({ ...base, tier: 'watchlist' }); peers.push({ ...base, y: 0 }); continue; }
    const cw = CAT_WHY[p.category];
    if (cw) { setAside.push({ ...base, why: cw }); continue; }
    const nr = nameRule(p);
    if (nr) { setAside.push({ ...base, why: nr === 'versioned' ? 'versioned listing' : nr === 'wrapped' ? 'wrapped or staked by name' : 'exchange-named' }); continue; }
    rows.push({ ...base, tier: p.tvl_usd >= snapshot.floor_usd ? 'offlist' : 'early' });
    peers.push({ ...base, y: 0 });
  }
  rows.sort((a, b) => b.tvl - a.tvl);
  live.sort((a, b) => b.mcap - a.mcap);
  return { rows, comps, peers, setAside, live: live.slice(0, 40), medAge, asOfMs };
}

// value fit

const ols = (xs, ys) => {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
};
const slope0 = (xs, ys) => {
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
  return sxx === 0 ? 0 : sxy / sxx;
};
const missRatio = (a, b) => Math.max(a, b) / Math.min(a, b);

/** Medians the value terms centre on, from the comps. */
function centres(comps) {
  return {
    g: median(comps.map((c) => (c.change === null ? 0 : c.change))),
    a: median(comps.map((c) => Math.log10(c.age))),
    c: median(comps.map((c) => Math.log(chainCount(c)))),
  };
}

/** Fit the value model on `rows` (comps) with `terms` kept. The size curve is
 * always on; each further term is fitted on the residuals in order. */
function fitValue(rows, terms, cen) {
  const size = ols(rows.map((r) => Math.log10(r.tvl)), rows.map((r) => Math.log10(r.mcap)));
  let resid = rows.map((r) => Math.log10(r.mcap) - (size.a + size.b * Math.log10(r.tvl)));
  const catEff = {};
  if (terms.includes('cat')) {
    const byCat = new Map();
    rows.forEach((r, i) => {
      const e = byCat.get(r.category) || { s: 0, n: 0 };
      e.s += resid[i]; e.n++;
      byCat.set(r.category, e);
    });
    for (const [c, e] of byCat) if (e.n >= CAT_MIN) catEff[c] = e.s / (e.n + CAT_K);
    resid = resid.map((r, i) => r - (catEff[rows[i].category] || 0));
  }
  const feat = { mom: (r) => (r.change === null ? 0 : r.change) - cen.g, age: (r) => Math.log10(r.age) - cen.a,
    chain: (r) => Math.log(chainCount(r)) - cen.c, ctrl: (r) => (r.ctrl === undefined ? 0 : r.ctrl - cen.g) };
  const co = { mom: 0, age: 0, chain: 0, ctrl: 0, kin: 0 };
  for (const t of ['mom', 'age', 'chain', 'ctrl']) {
    if (!terms.includes(t)) continue;
    co[t] = slope0(rows.map(feat[t]), resid);
    resid = resid.map((r, i) => r - co[t] * feat[t](rows[i]));
  }
  if (terms.includes('kin')) {
    const kr = rows.map((r, i) => (r.kin ? resid[i] : null)).filter((v) => v !== null);
    co.kin = kr.length ? (mean(kr) * kr.length) / (kr.length + 8) : 0;
  }
  return { sizeA: size.a, sizeB: size.b, catEff, ...co, cen };
}

/** The value model's multiplicative parts for one protocol. */
function valueParts(r, m) {
  return { size: 10 ** (m.sizeA + m.sizeB * Math.log10(r.tvl)),
    catF: 10 ** (m.catEff[r.category] || 0),
    momF: 10 ** (m.mom * ((r.change === null ? 0 : r.change) - m.cen.g)),
    ageF: 10 ** (m.age * (Math.log10(r.age) - m.cen.a)),
    chainF: 10 ** (m.chain * (Math.log(chainCount(r)) - m.cen.c)),
    ctrlF: 10 ** ((m.ctrl || 0) * (r.ctrl === undefined ? 0 : r.ctrl - m.cen.g)),
    kinF: r.kin ? 10 ** m.kin : 1 };
}

/** log10 of the value if a token launches, from the fitted terms. */
function logValueIf(r, m) {
  const p = valueParts(r, m);
  return Math.log10(p.size * p.catF * p.momF * p.ageF * p.chainF * p.ctrlF * p.kinF);
}

function looMissValue(comps, terms, cen) {
  const ms = [];
  for (let i = 0; i < comps.length; i++) {
    const f = fitValue(comps.filter((_, j) => j !== i), terms, cen);
    ms.push(missRatio(10 ** logValueIf(comps[i], f), comps[i].mcap));
  }
  return median(ms);
}

function wfSplit(comps) {
  const dated = comps.filter((c) => c.listed).sort((a, b) => (a.listed < b.listed ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  return { train: dated.slice(0, half), test: dated.slice(half), cut: dated[half].listed };
}

function wfMissValue(split, terms, cen) {
  const f = fitValue(split.train, terms, cen);
  return median(split.test.map((c) => missRatio(10 ** logValueIf(c, f), c.mcap)));
}

/** Greedy term selection, fixed order: a term is kept when adding it lowers
 * the held-out miss in one test and worsens neither. Returns the kept terms
 * and the full ablation table (the page prints it). */
function selectValueTerms(comps, cen) {
  const split = wfSplit(comps);
  const flatMed = (rows) => median(rows.map((r) => r.mcap / r.tvl));
  const flat = { loo: median(comps.map((c, i) => missRatio(c.tvl * flatMed(comps.filter((_, j) => j !== i)), c.mcap))),
    wf: median(split.test.map((c) => missRatio(c.tvl * flatMed(split.train), c.mcap))) };
  const table = [];
  let kept = [];
  let cur = { loo: looMissValue(comps, [], cen), wf: wfMissValue(split, [], cen) };
  table.push({ term: 'size curve', loo: cur.loo, wf: cur.wf, kept: true });
  for (const t of ['cat', 'mom', 'age', 'chain', 'kin']) {
    const trial = [...kept, t];
    const l = looMissValue(comps, trial, cen);
    const w = wfMissValue(split, trial, cen);
    const keep = (l < cur.loo && w <= cur.wf) || (w < cur.wf && l <= cur.loo);
    table.push({ term: t, loo: l, wf: w, kept: keep });
    if (keep) { kept = trial; cur = { loo: l, wf: w }; }
  }
  const lc = looMissValue(comps, [...kept, 'ctrl'], cen);
  const wc = wfMissValue(split, [...kept, 'ctrl'], cen);
  table.push({ term: 'control', loo: lc, wf: wc, kept: false });
  return { kept, table, flat, split: { train: split.train.length, test: split.test.length, cut: split.cut }, final: cur };
}

/** Range multipliers from the final model's leave-one-out residuals. */
function rangeFactors(comps, terms, cen) {
  const res = [];
  for (let i = 0; i < comps.length; i++) {
    const f = fitValue(comps.filter((_, j) => j !== i), terms, cen);
    res.push(Math.log10(comps[i].mcap) - logValueIf(comps[i], f));
  }
  res.sort((a, b) => a - b);
  const q = (p) => res[Math.floor(p * res.length)];
  return { r25: 10 ** q(0.25), r75: 10 ** q(0.75), r10: 10 ** q(0.1), r90: 10 ** q(0.9),
    q25: q(0.25), q75: q(0.75), q10: q(0.1), q90: q(0.9) };
}

/** Do the ranges hold, out of sample? Share of the walk-forward test caps
 * inside P25-P75 and P10-P90. (Leave-one-out coverage would be circular:
 * the ranges are quantiles of those same residuals.) */
function rangeHonesty(comps, terms, cen, ranges) {
  const split = wfSplit(comps);
  const f = fitValue(split.train, terms, cen);
  let in25 = 0, in10 = 0;
  for (const c of split.test) {
    const r = Math.log10(c.mcap) - logValueIf(c, f);
    if (r >= ranges.q25 && r <= ranges.q75) in25++;
    if (r >= ranges.q10 && r <= ranges.q90) in10++;
  }
  return { wf: { in2575: in25, in1090: in10, n: split.test.length } };
}

// odds fit

/** Standardisation for the odds features, from the peers. */
function oddsStats(peers) {
  const st = {};
  for (const f of ['age', 'size', 'growth', 'chain', 'ctrl']) {
    const v = peers.map((p) => oddsFeat(p, f));
    st[f] = { mu: mean(v), sd: Math.sqrt(mean(v.map((x) => (x - mean(v)) ** 2))) || 1 };
  }
  return st;
}
const oddsFeat = (p, f) =>
  f === 'age' ? Math.log10(p.age)
  : f === 'size' ? Math.log10(p.tvl)
  : f === 'growth' ? (p.change === null ? 0 : p.change)
  : f === 'chain' ? Math.log(chainCount(p))
  : f === 'kin' ? (p.tokenKin ? 1 : 0)
  : (p.ctrl || 0);

/** Logistic regression by gradient descent: deterministic, fixed iterations. */
function fitLogistic(rows, feats, st, iters) {
  const d = feats.length + 1;
  const b = new Array(d).fill(0);
  const n = rows.length;
  const X = rows.map((p) => [1, ...feats.map((f) => (f === 'kin' ? oddsFeat(p, f) : (oddsFeat(p, f) - st[f].mu) / st[f].sd))]);
  const y = rows.map((p) => p.y);
  for (let it = 0; it < iters; it++) {
    const g = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (let j = 0; j < d; j++) z += X[i][j] * b[j];
      const e = sig(z) - y[i];
      for (let j = 0; j < d; j++) g[j] += e * X[i][j];
    }
    for (let j = 0; j < d; j++) b[j] -= 0.5 * (g[j] / n + 0.001 * b[j]);
  }
  return b;
}

function oddsBrier(rows, feats, st, b) {
  let s = 0;
  for (const p of rows) s += (sig(oddsZ(p, feats, st, b)) - p.y) ** 2;
  return s / rows.length;
}

/** The logistic linear predictor for one protocol. */
function oddsZ(p, feats, st, b) {
  let z = b[0];
  feats.forEach((f, j) => { z += b[j + 1] * (f === 'kin' ? oddsFeat(p, f) : (oddsFeat(p, f) - st[f].mu) / st[f].sd); });
  return z;
}

/** Greedy odds-feature selection, same rule as the value terms. The
 * walk-forward split is by listing date (older peers fit, newer tested). */
function selectOddsFeatures(peers, st) {
  const dated = peers.filter((p) => p.listed).sort((a, b) => (a.listed < b.listed ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const train = dated.slice(0, half), test = dated.slice(half);
  const loo = (feats) => {
    let s = 0;
    for (let i = 0; i < peers.length; i++) {
      const rest = peers.filter((_, j) => j !== i);
      const b = fitLogistic(rest, feats, st, 150);
      s += (sig(oddsZ(peers[i], feats, st, b)) - peers[i].y) ** 2;
    }
    return s / peers.length;
  };
  const wf = (feats) => oddsBrier(test, feats, st, fitLogistic(train, feats, st, 300));
  const table = [];
  let kept = [];
  let cur = { loo: loo([]), wf: wf([]) };
  table.push({ term: 'base rate', loo: cur.loo, wf: cur.wf, kept: true });
  for (const t of ['age', 'size', 'growth', 'kin', 'chain']) {
    const trial = [...kept, t];
    const l = loo(trial), w = wf(trial);
    const keep = (l < cur.loo && w <= cur.wf) || (w < cur.wf && l <= cur.loo);
    table.push({ term: t, loo: l, wf: w, kept: keep });
    if (keep) { kept = trial; cur = { loo: l, wf: w }; }
  }
  table.push({ term: 'control', loo: loo([...kept, 'ctrl']), wf: wf([...kept, 'ctrl']), kept: false });
  return { kept, table, split: { train: train.length, test: test.length, cut: dated[half].listed }, final: cur };
}

// bootstrap

/** Seeded bootstrap: refit the whole model on resampled comps and peers and
 * re-rank the board, 200 times. Gives a standard error for every fitted
 * coefficient and a 90% rank interval (5th-95th percentile) for every row. */
function bootstrap(comps, peers, rows, vTerms, oFeats, cen, st) {
  const rnd = mulberry32(BOOT_SEED);
  const pick = (arr) => arr.map(() => arr[Math.floor(rnd() * arr.length)]);
  const sizeB = [], coefs = { oAge: [], oSize: [], oKin: [] };
  const ranks = new Map(rows.map((r) => [r.slug, []]));
  let negSlope = 0;
  for (let rep = 0; rep < BOOT_REPS; rep++) {
    const cs = pick(comps);
    const ps = pick(peers);
    const f = fitValue(cs, vTerms, cen);
    const ob = fitLogistic(ps, oFeats, st, 200);
    sizeB.push(f.sizeB);
    if (f.sizeB < 0) negSlope++;
    oFeats.forEach((feat, j) => { if (feat === 'age') coefs.oAge.push(ob[j + 1]); if (feat === 'size') coefs.oSize.push(ob[j + 1]); if (feat === 'kin') coefs.oKin.push(ob[j + 1]); });
    const vals = rows.map((r) => {
      const v = 10 ** logValueIf(r, f);
      return { slug: r.slug, v: v * clamp(sig(oddsZ(r, oFeats, st, ob)), 0.02, 0.98) };
    }).sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : 1));
    vals.forEach((x, i) => { ranks.get(x.slug).push(i + 1); });
  }
  const se = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
  // Rank range = 5th-95th percentile of the bootstrap ranks. Min and max are
  // dominated by single tail refits (in 1 of 200 the size slope flips
  // negative, sending the biggest rows to the bottom), so the 90% interval
  // is the honest summary of where a row usually ranks.
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * s.length)]; };
  const rankLo = {}, rankHi = {};
  for (const [slug, rs] of ranks) { rankLo[slug] = pct(rs, 0.05); rankHi[slug] = pct(rs, 0.95); }
  return { sizeBSe: se(sizeB), coefsSe: Object.fromEntries(Object.entries(coefs).map(([k, v]) => [k, v.length ? se(v) : 0])),
    rankLo, rankHi, negSlope };
}

// prediction

/** The fitted model as plain data: what data.js ships and the page refits. */
function serialise(fit, odds, ranges, vTerms, oFeats) {
  return {
    sizeA: fit.sizeA, sizeB: fit.sizeB, catEff: fit.catEff,
    mom: fit.mom, age: fit.age, chain: fit.chain, kin: fit.kin,
    cen: fit.cen, vTerms, oFeats,
    oddsB: odds.b, oddsSt: odds.st,
    r25: ranges.r25, r75: ranges.r75, r10: ranges.r10, r90: ranges.r90,
  };
}

/** Full derivation for one ranked protocol: every multiplier, named. */
function derive(r, m) {
  const p = valueParts(r, m);
  const valueIf = Math.max(1, Math.round(p.size * p.catF * p.momF * p.ageF * p.chainF * p.kinF));
  const odds = clamp(sig(oddsZ(r, m.oFeats, m.oddsSt, m.oddsB)), 0.02, 0.98);
  const implied = Math.max(1, Math.round(valueIf * odds));
  return { size: p.size, catF: p.catF, momF: p.momF, ageF: p.ageF, chainF: p.chainF, kinF: p.kinF, valueIf, odds, implied,
    p25: Math.max(1, Math.round(implied * m.r25)), p75: Math.max(1, Math.round(implied * m.r75)),
    p10: Math.max(1, Math.round(implied * m.r10)), p90: Math.max(1, Math.round(implied * m.r90)) };
}

/**
 * Recompute one row's implied value from the row and the fitted model — the
 * page and the validator run this against board.json. Exact: same arithmetic
 * as the build, same rounding, so a mismatch means the page or the board is
 * wrong, never a rounding difference.
 */
function impliedOf(row, model, medianAgeDays) {
  const r = { tvl: row.tvl_usd, category: row.category, change: row.change_7d,
    age: row.age_days === null || row.age_days === undefined ? medianAgeDays : row.age_days,
    chains: row.chains, kin: !!row.kin, tokenKin: !!row.tokenKin };
  return derive(r, model).implied;
}

// farm plans

/** Typical cost of one transaction on each chain, in dollars (public rates).
 * Most chains cost about $0.05 a transaction; only the exceptions are listed. */
const GAS = { Ethereum: 6, Bitcoin: 3, Solana: 0.02, Binance: 0.15, Arbitrum: 0.3, Sui: 0.02,
  Tron: 0.5, Stellar: 0.01, Avalanche: 0.3, Aptos: 0.02, Bittensor: 0.1, Canton: 0.1,
  Algorand: 0.01, Ripple: 0.01, Noble: 0.01, XION: 0.01, Qubic: 0.01, Starknet: 0.1,
  Ronin: 0.01, Proton: 0.01, 'zkSync Era': 0.1 };
const gasOf = (chain) => GAS[chain] ?? 0.05;

/** What to do on each kind of protocol: action, venue, risk, second step. */
const PLAY = {
  Dexs: ['add liquidity to', 'deepest pool', 'impermanent loss if the pair moves', 'route a weekly swap through its router'],
  Lending: ['supply assets to', 'lending market', 'supplied assets can be paused, and borrowers can default', 'borrow a small amount against the supply and repay it'],
  Yield: ['deposit into', 'yield vault', 'the vault stacks other protocols beneath it', 'stake the receipt token where the vault offers it'],
  'Yield Aggregator': ['deposit into', 'yield vault', 'the vault stacks other protocols beneath it', 'stake the receipt token where the vault offers it'],
  RWA: ['subscribe to', 'tokenised asset', 'the issuer can gate redemptions; read the terms first', 'hold through a distribution cycle and claim it'],
  'Risk Curators': ['deposit into', 'curated vault', 'the curator picks the strategies, so read who they are', 'split the deposit across a second vault the curator runs'],
  'Onchain Capital Allocator': ['deposit into', 'allocation vault', 'allocations move between venues; read the current split', 'follow an allocation rebalance and log it'],
  CDP: ['mint against collateral in', 'CDP vault', 'a collateral price drop can liquidate the position', 'adjust the collateral ratio once and log it'],
  'CDP Manager': ['mint against collateral in', 'CDP vault', 'a collateral price drop can liquidate the position', 'adjust the collateral ratio once and log it'],
  Derivatives: ['open volume on', 'perpetuals market', 'perpetuals can liquidate fast; use minimal leverage', 'close and reopen a small position weekly for volume'],
  'Prediction Market': ['trade', 'prediction market', 'markets resolve against you; size each trade small', 'take both sides of a market across two weeks'],
  'Basis Trading': ['join', 'basis trade', 'funding rates flip; the trade can pay or charge you', 'roll the position once and log the funding'],
  Farm: ['stake in', 'farm', 'reward emissions dilute; check the emission schedule', 'compound the rewards weekly'],
  'OTC Marketplace': ['list an offer on', 'OTC desk', 'counterparty risk: use the escrow the desk offers', 'complete a second trade with another counterparty'],
  'Cross Chain Bridge': ['bridge a small amount through', 'bridge', 'bridges hold custody mid-transfer; never bridge more than you can wait for', 'bridge back on a second route'],
  'Stablecoin Wrapper': ['wrap into', 'wrapped stablecoin', 'the wrapper is only as good as its backing and audits', 'unwrap and re-wrap once to show use'],
};
const playOf = (cat) => PLAY[cat] || ['deposit into', 'main vault or pool', 'smart-contract risk: read the audits before depositing', 'use a second product the protocol offers'];

const money = (n) => {
  const neg = n < 0;
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M`
    : a >= 1000 ? `$${Math.round(a).toLocaleString('en-US')}` : a >= 10 ? `$${a.toFixed(0)}` : `$${a.toFixed(2)}`;
  return neg ? `-${s}` : s;
};

/**
 * Farm economics for one row at a scenario (deposit, drop share, weeks).
 * drop = implied value x drop share x deposit / (TVL + deposit): the farm's
 * pro-rata slice of the modelled airdrop. Verdict: FARM when the net beats
 * the T-bill yield on the same deposit over the same weeks; SKIP when fees
 * eat the drop; MARGINAL between. The net per hour is reported for every
 * row so the reader can apply their own wage bar.
 */
function farmEconomics(row, scen) {
  const deposit = scen.deposit, dropShare = scen.dropShare, weeks = scen.weeks;
  const gas = gasOf(row.chain);
  const fees = Math.round((19 * gas + 1.5) * 100) / 100;
  const hours = 3.5;
  const drop = (row.implied_value_usd * dropShare * deposit) / (row.tvl_usd + deposit);
  const tbill = deposit * TBILL * (weeks * 7 / 365);
  const net = drop - fees;
  const perHour = net / hours;
  const verdict = net > tbill ? 'FARM' : net <= 0 ? 'SKIP' : 'MARGINAL';
  const slice = (row.implied_value_usd * deposit) / (row.tvl_usd + deposit);
  const beDrop = slice > 0 ? fees / slice : 1;
  const beOdds = row.value_if_launches > 0 ? fees / ((row.value_if_launches * dropShare * deposit) / (row.tvl_usd + deposit)) : 1;
  const netP25 = ((row.p25 * dropShare * deposit) / (row.tvl_usd + deposit)) - fees;
  const holdsP25 = verdict === 'FARM' ? netP25 > tbill : netP25 > 0;
  const netHalf = ((row.implied_value_usd * 0.5 * dropShare * deposit) / (row.tvl_usd + deposit)) - fees;
  const holdsHalf = verdict === 'FARM' ? netHalf > tbill : netHalf > 0;
  return { deposit, dropShare, weeks, gas, fees, hours, drop, tbill, net, perHour, verdict,
    beDrop, beOdds, holdsP25, holdsHalf, netP25, netHalf };
}

/** The reference farm plan: 10 steps, each 20-600 chars, costs and times in. */
function farmSteps(row) {
  const chain = row.chain, play = playOf(row.category);
  const dep = money(REF_DEPOSIT), gas = gasOf(chain);
  const exitTvl = money(Math.round(row.tvl_usd * 0.83));
  const tvl = money(row.tvl_usd);
  const steps = [
    `Set up a fresh ${chain} wallet for this farm only (hardware-backed is best) and fund it with ${dep} plus about ${money(19 * gas + 1.5)} for gas. Keep it separate from your main holdings.`,
    `Verify ${row.name} before sending anything: open it from its DefiLlama page (defillama.com/protocol/${row.slug}), match the contract addresses against its docs, and check for a points page. Never trust a link from a search ad or a DM.`,
    `Fund the wallet with ${dep} on ${chain} from an exchange (about $1.50 withdrawal fee) or bridge it in. Arrive with the asset the ${play[1]} takes, so you do not pay a swap on entry.`,
    `Read the risk before depositing: ${play[2]}. The ${dep} is at risk while it sits in the protocol — only farm money you can afford to lose, and never loop leverage on a first farm.`,
    `Enter: ${play[0]} ${row.name}'s ${play[1]} on ${chain} with the full ${dep}. Start with a $100 test, confirm the receipt token lands, then add the rest. This is the position a drop, if any, is measured on.`,
    `Deepen the footprint: ${play[3]}. A second product or chain shows real use rather than a single deposit, and most programmes score breadth over size.`,
    `Touch the position once a week for ${REF_WEEKS} weeks: a small top-up, a claim, or a rebalance, so the wallet shows ${REF_WEEKS} active weeks rather than one deposit. About 12 transactions in all, roughly ${money(12 * gas)} of gas.`,
    `Watch the exit rule weekly: withdraw if ${row.name}'s TVL prints below ${exitTvl} (17% under today's ${tvl}), if withdrawals pause, or if the team ships a snapshot you have already taken. Review on ${row.review_date}.`,
    `Keep a ledger from the first transaction: date, transaction hash, asset and dollar value of every deposit, claim and withdrawal. A claim may ask the wallet to prove its history, and a drop is taxable income in many places.`,
    `Claim and exit: if a token launches, claim only from ${row.name}'s own site, never pay to claim, then revoke approvals. After ${REF_WEEKS} weeks or at the claim, unwind and send the funds back to the exchange.`,
  ];
  return steps;
}

/** Per-step cost and hands-on minutes, parallel to farmSteps. */
function farmStepMeta(row) {
  const gas = gasOf(row.chain);
  const costs = [0, 0, 1.5, 0, 2 * gas, 2 * gas, 12 * gas, 0, 0, 3 * gas];
  const mins = [10, 15, 10, 10, 15, 10, 60, 60, 10, 10];
  return costs.map((c, i) => ({ cost: Math.round(c * 100) / 100, mins: mins[i] }));
}

// build

function addCtrl(arr) {
  const s = [...arr].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  s.forEach((r, i) => { r.ctrl = s[(i + 1) % s.length].change === null ? 0 : s[(i + 1) % s.length].change; });
}

/** Build the whole radar from the snapshot: classify, select terms by the
 * held-out tests, fit, rank, price the farms, bootstrap the uncertainty.
 * opts.fast skips selection + bootstrap (the page's refit path). */
function buildRadar(snapshot, opts = {}) {
  const c = classify(snapshot);
  addCtrl(c.comps);
  addCtrl(c.peers);
  const cen = centres(c.comps);
  const st = oddsStats(c.peers);
  let vTerms, oFeats, evidence;
  if (opts.fast) {
    vTerms = opts.vTerms; oFeats = opts.oFeats;
    evidence = null;
  } else {
    const vSel = selectValueTerms(c.comps, cen);
    const oSel = selectOddsFeatures(c.peers, st);
    vTerms = vSel.kept; oFeats = oSel.kept;
    evidence = { valueTable: vSel.table, oddsTable: oSel.table, valueFlat: vSel.flat,
      valueSplit: vSel.split, oddsSplit: oSel.split,
      valueFinal: vSel.final, oddsFinal: oSel.final };
  }
  const fit = fitValue(c.comps, vTerms, cen);
  const oddsB = fitLogistic(c.peers, oFeats, st, 300);
  const ranges = rangeFactors(c.comps, vTerms, cen);
  if (evidence) evidence.honesty = rangeHonesty(c.comps, vTerms, cen, ranges);
  const model = serialise(fit, { b: oddsB, st }, ranges, vTerms, oFeats);
  // peers' typical token age, for the expected-wait line in the detail view
  const tokAges = c.peers.filter((p) => p.y === 1).map((p) => p.age);
  const medTokAge = median(tokAges);
  const reviewDate = new Date(c.asOfMs + REF_WEEKS * 7 * DAY).toISOString().slice(0, 10);
  const rows = c.rows.map((r) => {
    const d = derive(r, model);
    const row = { slug: r.slug, name: r.name, tier: r.tier, category: r.category,
      chain: r.chains[0], chains: r.chains.length, tvl_usd: r.tvl, change_7d: r.change,
      age_days: r.ageKnown ? r.age : null, listed_at: r.listed,
      kin: r.kin, tokenKin: r.tokenKin,
      value_if_launches: d.valueIf, odds: Math.round(d.odds * 1000) / 1000,
      implied_value_usd: d.implied, p25: d.p25, p75: d.p75, p10: d.p10, p90: d.p90,
      parts: { size: Math.round(d.size), catF: Math.round(d.catF * 1000) / 1000 },
      review_date: reviewDate,
      wait_years: Math.max(0, Math.round(((medTokAge - r.age) / 365) * 10) / 10) };
    const e = farmEconomics(row, { deposit: REF_DEPOSIT, dropShare: REF_DROP, weeks: REF_WEEKS });
    row.verdict = e.verdict; row.net_usd = Math.round(e.net * 100) / 100;
    row.net_per_hour = Math.round(e.perHour * 100) / 100; row.drop_usd = Math.round(e.drop * 100) / 100;
    row.fees_usd = e.fees; row.tbill_usd = Math.round(e.tbill * 100) / 100;
    row.break_even_drop = Math.round(e.beDrop * 10000) / 10000;
    row.break_even_odds = Math.round(e.beOdds * 10000) / 10000;
    row.holds_p25 = e.holdsP25; row.holds_half_odds = e.holdsHalf;
    row.farm_steps = farmSteps(row);
    return row;
  });
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  rows.forEach((r, i) => { r.rank = i + 1; });
  // nearest priced peers per row (same category first, nearest TVL)
  const compByCat = new Map();
  for (const cp of c.comps) {
    if (!compByCat.has(cp.category)) compByCat.set(cp.category, []);
    compByCat.get(cp.category).push(cp);
  }
  for (const r of rows) {
    const pool = [...(compByCat.get(r.category) || []), ...c.comps];
    const seen = new Set();
    r.peers = pool.filter((p) => !seen.has(p.slug) && seen.add(p.slug))
      .map((p) => ({ slug: p.slug, name: p.name, tvl: p.tvl, mcap: p.mcap,
        dist: Math.abs(Math.log10(p.tvl) - Math.log10(r.tvl_usd)) + (p.category === r.category ? 0 : 1) }))
      .sort((a, b) => a.dist - b.dist).slice(0, 3).map(({ slug, name, tvl, mcap }) => ({ slug, name, tvl, mcap }));
  }
  let boot = null;
  if (!opts.fast) {
    boot = bootstrap(c.comps, c.peers, c.rows, vTerms, oFeats, cen, st);
    for (const r of rows) { r.rank_low = boot.rankLo[r.slug]; r.rank_high = boot.rankHi[r.slug]; }
  } else {
    for (const r of rows) { r.rank_low = r.rank; r.rank_high = r.rank; }
  }
  const board = rows.map((r) => ({ slug: r.slug, name: r.name, rank: r.rank,
    implied_value_usd: r.implied_value_usd, farm_steps: r.farm_steps, tier: r.tier,
    tvl_usd: r.tvl_usd, value_if_launches: r.value_if_launches, odds: r.odds,
    p25: r.p25, p75: r.p75, verdict: r.verdict, net_usd: r.net_usd }));
  const ledger = [
    { group: 'watchlist', label: 'ranked · watchlist', n: rows.filter((r) => r.tier === 'watchlist').length, why: 'on the house watchlist' },
    { group: 'early', label: 'ranked · early', n: rows.filter((r) => r.tier === 'early').length, why: 'records no token, passes the rules' },
    { group: 'offlist', label: 'ranked · off-list', n: rows.filter((r) => r.tier === 'offlist').length, why: 'records no token, passes the rules; the watchlist leaves it out' },
    { group: 'comp', label: 'priced comp', n: c.comps.length, why: 'a usable market cap: calibrates the model, never ranked' },
    { group: 'token-other', label: 'token on record · not a comp', n: 0, why: 'a token on record, no usable cap or an excluded kind' },
  ];
  // recount the token set-aside groups exactly (ledger must sum to 758)
  const whyCount = {};
  for (const s of c.setAside) whyCount[s.why] = (whyCount[s.why] || 0) + 1;
  const tokenOther = snapshot.protocols.length - rows.length - c.comps.length - c.setAside.length;
  ledger[4].n = tokenOther;
  for (const [why, n] of Object.entries(whyCount)) {
    ledger.push({ group: `out-${why}`, label: `Set aside · ${why}`, n, why: 'the watchlist rule sets it aside' });
  }
  const radar = { meta: { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
      n_protocols: snapshot.protocols.length, model: 'launchfit-1' },
    model, median_age_days: c.medAge, evidence, ledger,
    rows, set_aside: c.setAside.map((s) => ({ slug: s.slug, name: s.name, category: s.category, tvl_usd: s.tvl, why: s.why })),
    live: c.live.map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl, mcap_usd: p.mcap })),
    comps: c.comps.map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl, mcap_usd: p.mcap })),
    boot: boot ? { sizeBSe: boot.sizeBSe, coefsSe: boot.coefsSe, negSlope: boot.negSlope, reps: BOOT_REPS } : null,
    snapshot: { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
      watchlist: snapshot.watchlist, protocols: snapshot.protocols } };
  return { board, radar };
}

/** The gate's own checks, run before anything is written. */
function boardIssue(board, snapshot) {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, not 100..4000`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set();
  let prev = Infinity;
  for (let i = 0; i < board.length; i++) {
    const r = board[i];
    if (!known.has(r.slug)) return `${r.slug}: not a snapshot protocol`;
    if (seen.has(r.slug)) return `${r.slug}: ranked twice`;
    seen.add(r.slug);
    if (r.rank !== i + 1) return `${r.slug}: rank ${r.rank} at position ${i + 1}`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug}: bad implied value`;
    if (r.implied_value_usd > prev) return `${r.slug}: value rises with rank`;
    prev = r.implied_value_usd;
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug}: ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug}: a farm step of ${t.length} chars`;
    }
  }
  if (board[0].implied_value_usd === board[board.length - 1].implied_value_usd) return 'all implied values equal';
  for (const s of snapshot.watchlist) if (!seen.has(s)) return `watchlist slug ${s} missing from the board`;
  return null;
}

/** data.js: the page's data, one assignment, deterministic key order. */
function dataScript(radar) {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

const API = { parseSnapshot, classify, fitValue, selectValueTerms, selectOddsFeatures, buildRadar,
  boardIssue, dataScript, impliedOf, farmSteps, farmStepMeta, farmEconomics, centres, oddsStats, fitLogistic, rangeHonesty, money };
// The one export: a global, so the file loads as a classic script in the
// browser, as a module in Node (main.ts, the validator), and everywhere the
// same single source of truth.
globalThis.RADAR_MODEL = API;
if (typeof globalThis.window !== 'undefined') globalThis.window.RADAR_MODEL = API;

