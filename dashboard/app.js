// The radar page: renders window.RADAR, refits the model in this browser and
// checks every number against the shipped board. No network, no framework.
const R = window.RADAR, M = window.RADAR_MODEL;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mny = M.money;
const int = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const S = { scen: { deposit: 1000, dropShare: 0.07, weeks: 12 }, f: { verdict: '', tier: '', cat: '', chain: '', q: '' }, sort: { k: 'rank', d: 1 }, view: 'board' };
const econ = (r) => M.farmEconomics(r, S.scen);
const tierBadge = (t) => `<span class="badge ${t}">${t === 'watchlist' ? 'WATCHLIST' : t === 'offlist' ? 'OFF-LIST' : 'EARLY'}</span>`;
const verdictSpan = (v) => `<span class="verdict ${v}">${v}</span>`;

// header strips
(function header() {
  const rows = R.rows, farm = rows.filter((r) => r.verdict === 'FARM').length;
  const medOdds = rows.map((r) => r.odds).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  $('#kpis').innerHTML = [
    ['Protocols ranked', rows.length], ['Watchlist', `${rows.filter((r) => r.tier === 'watchlist').length}/40`],
    ['FARM verdicts', farm], ['Median token odds', pct(medOdds)],
    ['Top implied value', mny(rows[0].implied_value_usd)], ['Set aside', R.set_aside.length],
  ].map(([l, v]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
  const m = R.model, b = R.boot;
  $('#formula').innerHTML = `<b>How a row is priced.</b> Value if a token launches = 10<sup>${m.sizeA.toFixed(2)}</sup> × TVL<sup>${m.sizeB.toFixed(3)} ± ${b.sizeBSe.toFixed(3)}</sup>` +
    ` × category (Dexs ×${(10 ** (m.catEff.Dexs || 0)).toFixed(2)}, Lending ×${(10 ** (m.catEff.Lending || 0)).toFixed(2)}). ` +
    `Odds = logistic(age +${m.oddsB[1].toFixed(2)}, size +${m.oddsB[2].toFixed(2)}, token kin ${m.oddsB[3].toFixed(2)}). Implied value = value if it launches × odds. Details: <a href="#/method">Method &amp; tests</a>.`;
  $('#ledger').innerHTML = R.ledger.map((g) => `<span><b>${g.n}</b> ${esc(g.label)}</span>`).join('') +
    `<span><b>${R.ledger.reduce((s, g) => s + g.n, 0)}</b> of 758 protocols accounted for</span>`;
  $('#asof').textContent = R.meta.as_of;
  const e = R.evidence;
  $('#evidence-line').innerHTML = `<b>Held-out tests, on the page.</b> Value miss ×${e.valueFinal.loo.toFixed(2)} leave-one-out, ×${e.valueFinal.wf.toFixed(2)} walk-forward (flat: ×${e.valueFlat.loo.toFixed(2)} / ×${e.valueFlat.wf.toFixed(2)}). ` +
    `Odds Brier ${e.oddsFinal.loo.toFixed(3)} / ${e.oddsFinal.wf.toFixed(3)} (base rate: ${e.oddsTable[0].loo.toFixed(3)} / ${e.oddsTable[0].wf.toFixed(3)}). ` +
    `Ranges hold ${e.honesty.wf.in2575}/${e.honesty.wf.n} in P25–P75 walk-forward.`;
})();

// integrity: refit here, compare against the shipped board
(function integrity() {
  const el = $('#integrity');
  el.innerHTML = 'Refitting the model in this browser…';
  setTimeout(() => {
    try {
      const refit = M.buildRadar(R.snapshot, { fast: true, vTerms: R.model.vTerms, oFeats: R.model.oFeats });
      const bySlug = new Map(refit.radar.rows.map((r) => [r.slug, r]));
      let valOk = 0, planOk = 0;
      for (const r of R.rows) {
        const q = bySlug.get(r.slug);
        if (!q) continue;
        if (M.impliedOf(r, R.model, R.median_age_days) === r.implied_value_usd && q.implied_value_usd === r.implied_value_usd) valOk++;
        if (JSON.stringify(M.farmSteps(r)) === JSON.stringify(r.farm_steps) && JSON.stringify(q.farm_steps) === JSON.stringify(r.farm_steps)) planOk++;
      }
      const a = refit.radar.model, b = R.model;
      const coefOk = Math.abs(a.sizeB - b.sizeB) < 1e-9 && Math.abs(a.oddsB[1] - b.oddsB[1]) < 1e-9 && Math.abs(a.oddsB[2] - b.oddsB[2]) < 1e-9;
      const ok = valOk === R.rows.length && planOk === R.rows.length && coefOk;
      el.innerHTML = ok
        ? `<span class="ok">✓ Integrity strip.</span> Refit in this browser from the shipped snapshot: <b>${valOk}/${R.rows.length}</b> implied values match, <b>${planOk}/${R.rows.length}</b> farm plans match word for word, coefficients match.`
        : `<span class="bad">✗ Integrity check failed.</span> ${valOk}/${R.rows.length} values, ${planOk}/${R.rows.length} plans, coefficients ${coefOk ? 'match' : 'differ'}.`;
    } catch (err) { el.innerHTML = `<span class="bad">✗ Integrity check errored:</span> ${esc(err.message)}`; }
  }, 30);
})();

// controls
(function controls() {
  const cats = [...new Set(R.rows.map((r) => r.category))].sort();
  const chains = [...new Set(R.rows.map((r) => r.chain))].sort();
  const sel = (id, label, opts) => `<label>${label} <select id="${id}"><option value="">All</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  $('#controls').innerHTML =
    sel('f-verdict', 'Verdict', ['FARM', 'MARGINAL', 'SKIP']) +
    sel('f-tier', 'Tier', ['watchlist', 'early', 'offlist']) +
    sel('f-cat', 'Category', cats) + sel('f-chain', 'Chain', chains) +
    `<label>Search <input id="f-q" type="search" placeholder="name or slug"></label>` +
    `<label>Deposit $<input id="s-dep" type="number" min="100" max="100000" step="100" value="1000"></label>` +
    `<label>Drop share <input id="s-drop" type="range" min="1" max="20" step="1" value="7"> <span id="s-drop-v">7%</span></label>` +
    `<label>Horizon <select id="s-weeks">${[4, 8, 12, 26, 52].map((w) => `<option value="${w}"${w === 12 ? ' selected' : ''}>${w} weeks</option>`).join('')}</select></label>` +
    `<button class="btn" id="x-csv">CSV</button><button class="btn" id="x-json">JSON</button>`;
  const bind = (id, key) => $(id).addEventListener('change', (e) => { S.f[key] = e.target.value; renderBoard(); });
  bind('#f-verdict', 'verdict'); bind('#f-tier', 'tier'); bind('#f-cat', 'cat'); bind('#f-chain', 'chain');
  $('#f-q').addEventListener('input', (e) => { S.f.q = e.target.value.toLowerCase(); renderBoard(); });
  $('#s-dep').addEventListener('change', (e) => { S.scen.deposit = Math.max(100, +e.target.value || 1000); renderBoard(); });
  $('#s-drop').addEventListener('input', (e) => { S.scen.dropShare = +e.target.value / 100; $('#s-drop-v').textContent = `${e.target.value}%`; renderBoard(); });
  $('#s-weeks').addEventListener('change', (e) => { S.scen.weeks = +e.target.value; renderBoard(); });
  $('#x-csv').addEventListener('click', () => download('token-radar.csv', toCsv(filtered())));
  $('#x-json').addEventListener('click', () => download('token-radar.json', JSON.stringify(filtered(), null, 1)));
})();
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toCsv(rows) {
  const h = ['rank', 'slug', 'name', 'tier', 'category', 'chain', 'tvl_usd', 'odds', 'value_if_launches', 'implied_value_usd', 'p25', 'p75', 'verdict', 'net_usd'];
  return [h.join(','), ...rows.map((r) => h.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
}

// board
function filtered() {
  const f = S.f;
  let rows = R.rows.filter((r) =>
    (!f.verdict || econ(r).verdict === f.verdict) && (!f.tier || r.tier === f.tier) &&
    (!f.cat || r.category === f.cat) && (!f.chain || r.chain === f.chain) &&
    (!f.q || r.name.toLowerCase().includes(f.q) || r.slug.includes(f.q)));
  const k = S.sort.k, d = S.sort.d;
  const key = { rank: (r) => r.rank, tvl: (r) => r.tvl_usd, odds: (r) => r.odds, implied: (r) => r.implied_value_usd, net: (r) => econ(r).net }[k] || ((r) => r.rank);
  return rows.sort((a, b) => (key(a) - key(b)) * d || a.rank - b.rank);
}
function renderBoard() {
  const rows = filtered();
  const th = (k, l) => `<th data-sort="${k}">${l}${S.sort.k === k ? (S.sort.d === 1 ? ' ▲' : ' ▼') : ''}</th>`;
  $('#board-table').innerHTML = `<thead><tr>${th('rank', 'Rank')}<th>Protocol</th>${th('tvl', 'TVL')}<th>7D</th><th>Age</th>${th('odds', 'Token odds')}<th>If it launches</th>${th('implied', 'Implied value')}<th>Verdict · net</th>${th('net', 'Net / hour')}</tr></thead>` +
    `<tbody>${rows.map((r) => { const e = econ(r); return `<tr data-slug="${r.slug}"><td>${r.rank}<br><span class="sm">#${r.rank_low}–${r.rank_high}</span></td>` +
    `<td class="name">${esc(r.name)}${tierBadge(r.tier)}<br><span class="sm">${esc(r.category)} · ${esc(r.chain)}${r.tokenKin ? ' · kin has a token' : ''}</span></td>` +
    `<td>${mny(r.tvl_usd)}</td><td>${r.change_7d === null ? '—' : `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(1)}%`}</td>` +
    `<td>${r.age_days === null ? '—' : `${Math.round(r.age_days / 30.4)} mo`}</td><td>${pct(r.odds)}</td><td>${mny(r.value_if_launches)}</td>` +
    `<td><b>${mny(r.implied_value_usd)}</b><br><span class="sm">${mny(r.p25)}–${mny(r.p75)}</span></td>` +
    `<td>${verdictSpan(e.verdict)}<br><span class="sm">${mny(e.net)} net</span></td><td>${mny(e.perHour)}/h</td></tr>`; }).join('')}</tbody>`;
  document.querySelectorAll('#board-table th[data-sort]').forEach((h) => h.addEventListener('click', () => {
    const k = h.dataset.sort;
    S.sort = S.sort.k === k ? { k, d: -S.sort.d } : { k, d: k === 'rank' ? 1 : -1 };
    renderBoard();
  }));
  document.querySelectorAll('#board-table tbody tr').forEach((tr) => tr.addEventListener('click', () => { location.hash = `#/protocol/${tr.dataset.slug}`; }));
}
renderBoard();

// detail view
function renderDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  const el = $('#view-detail');
  if (!r) { el.innerHTML = `<p>Unknown protocol: ${esc(slug)}</p>`; return; }
  const e = econ(r), m = R.model, meta = M.farmStepMeta(r);
  const totCost = meta.reduce((s, x) => s + x.cost, 0), totMin = meta.reduce((s, x) => s + x.mins, 0);
  const shares = [0.03, 0.05, 0.07, 0.1, 0.15], deps = [100, 500, 1000, 5000, 10000];
  const netAt = (sh, dep) => (r.implied_value_usd * sh * dep) / (r.tvl_usd + dep) - e.fees;
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`;
  el.innerHTML = `<div class="detail"><p><a href="#/board">← back to the board</a></p><h2>${esc(r.name)}${tierBadge(r.tier)}</h2>` +
    `<p class="note">${esc(r.category)} · first chain ${esc(r.chain)} · ${r.chains} chain${r.chains > 1 ? 's' : ''} · TVL ${mny(r.tvl_usd)} · 7D ${r.change_7d === null ? '—' : `${r.change_7d.toFixed(1)}%`} · listed ${r.listed_at || 'unknown'}${r.tokenKin ? ' · a same-stem protocol already has a token, which cuts the odds' : ''}</p>` +
    `<div class="grid2"><div class="panel"><h3>How the price is built</h3>` +
    kv('Size curve', `10<sup>${m.sizeA.toFixed(2)}</sup> × TVL<sup>${m.sizeB.toFixed(3)}</sup> = ${mny(r.parts.size)}`) +
    kv('Category ×', `${r.parts.catF.toFixed(2)} (${esc(r.category)})`) +
    kv('Value if it launches', `<b>${mny(r.value_if_launches)}</b>`) +
    kv('Token odds', `<b>${pct(r.odds)}</b> — age, size${r.tokenKin ? ', token kin −0.88' : ''}`) +
    kv('Implied value', `<b>${mny(r.implied_value_usd)}</b> · rank #${r.rank} (90% interval #${r.rank_low}–${r.rank_high})`) +
    kv('Range P25–P75', `${mny(r.p25)} – ${mny(r.p75)}`) +
    kv('Range P10–P90', `${mny(r.p10)} – ${mny(r.p90)}`) +
    kv('Expected wait', r.wait_years === 0 ? 'past the typical token age already' : `about ${r.wait_years} year${r.wait_years === 1 ? '' : 's'} (median token peer age)`) +
    `</div><div class="panel"><h3>Farm verdict — $${int(S.scen.deposit)}, ${(S.scen.dropShare * 100).toFixed(0)}% drop share, ${S.scen.weeks} weeks</h3>` +
    kv('Verdict', `${verdictSpan(e.verdict)} — ${e.verdict === 'FARM' ? 'net beats T-bills' : e.verdict === 'SKIP' ? 'fees eat the drop' : 'beats fees, not T-bills'}`) +
    kv('Expected drop', mny(e.drop)) + kv('Fees (19 tx + withdrawal)', mny(e.fees)) +
    kv('T-bill forgone (4%/yr)', mny(e.tbill)) + kv('Net', `<b>${mny(e.net)}</b>`) +
    kv('Net per hour', `${mny(e.perHour)}/h over ${e.hours} h hands-on`) +
    kv('Break-even drop share', e.beDrop > 1 ? 'never (>100%)' : `${(e.beDrop * 100).toFixed(1)}%`) + kv('Break-even token odds', e.beOdds > 1 ? 'never (>100%)' : `${(e.beOdds * 100).toFixed(1)}%`) +
    kv('Holds at P25 value?', e.holdsP25 ? 'yes' : 'no — it needs the middle of the range') +
    kv('Holds at halved odds?', e.holdsHalf ? 'yes' : 'no') +
    kv('Exit rule', `withdraw if TVL prints below ${mny(Math.round(r.tvl_usd * 0.83))}; review ${r.review_date}`) +
    `</div></div>` +
    `<h3>Nearest priced peers</h3>` +
    `<div class="table-wrap"><table class="board"><thead><tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>Multiple</th></tr></thead><tbody>` +
    r.peers.map((p) => `<tr><td class="name">${esc(p.name)}</td><td>${mny(p.tvl)}</td><td>${mny(p.mcap)}</td><td>${(p.mcap / p.tvl).toFixed(2)}×</td></tr>`).join('') + `</tbody></table></div>` +
    `<h3>Net by drop share × deposit</h3><table class="matrix"><thead><tr><th>drop ↓ / deposit →</th>${deps.map((d) => `<th>$${int(d)}</th>`).join('')}</tr></thead><tbody>` +
    shares.map((sh) => `<tr><th>${(sh * 100).toFixed(0)}%</th>${deps.map((d) => { const n = netAt(sh, d); return `<td class="${n > 0 ? 'pos' : 'neg'}">${mny(n)}</td>`; }).join('')}</tr>`).join('') + `</tbody></table>` +
    `<h3>The farm plan — 10 steps, ${totMin} minutes hands-on, ${mny(totCost)} in fees</h3><ol class="steps">` +
    r.farm_steps.map((s, i) => `<li>${esc(s)}<br><span class="meta">${mny(meta[i].cost)} · ${meta[i].mins} min</span></li>`).join('') + `</ol></div>`;
}

// token trades / set aside
function renderTrades() {
  const comps = R.comps, m = R.model;
  const W = 720, H = 300, P = 44;
  const xs = comps.map((c) => Math.log10(c.tvl_usd)), ys = comps.map((c) => Math.log10(c.mcap_usd));
  const x0 = Math.min(...xs) - 0.2, x1 = Math.max(...xs) + 0.2, y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
  const X = (v) => P + ((v - x0) / (x1 - x0)) * (W - 2 * P), Y = (v) => H - P - ((v - y0) / (y1 - y0)) * (H - 2 * P);
  const line = `M ${X(x0)} ${Y(m.sizeA + m.sizeB * x0)} L ${X(x1)} ${Y(m.sizeA + m.sizeB * x1)}`;
  $('#scatter').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px">` +
    `<path d="${line}" stroke="#f59e0b" stroke-width="2" fill="none"/>` +
    comps.map((c) => `<circle cx="${X(Math.log10(c.tvl_usd)).toFixed(1)}" cy="${Y(Math.log10(c.mcap_usd)).toFixed(1)}" r="3.5" fill="#2dd4bf"><title>${esc(c.name)}: TVL ${mny(c.tvl_usd)}, cap ${mny(c.mcap_usd)}</title></circle>`).join('') +
    `<text x="${W / 2}" y="${H - 8}" fill="#8b9bb5" font-size="12" text-anchor="middle">TVL, log scale →</text>` +
    `<text x="12" y="${H / 2}" fill="#8b9bb5" font-size="12" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">market cap, log scale →</text></svg>` +
    `<p class="note">Each dot is one of the 92 comps; the amber line is the fitted size curve. Typical miss ×${R.evidence.valueFinal.loo.toFixed(2)} — a loose fit, honestly shown.</p>`;
  $('#trades-table').innerHTML = `<thead><tr><th>Protocol</th><th>Category</th><th>TVL</th><th>Market cap</th><th>Multiple</th></tr></thead><tbody>` +
    [...comps].sort((a, b) => b.mcap_usd - a.mcap_usd).map((c) => `<tr><td class="name">${esc(c.name)}</td><td>${esc(c.category)}</td><td>${mny(c.tvl_usd)}</td><td>${mny(c.mcap_usd)}</td><td>${(c.mcap_usd / c.tvl_usd).toFixed(2)}×</td></tr>`).join('') + `</tbody>`;
}
function renderAside() {
  $('#aside-table').innerHTML = `<thead><tr><th>Protocol</th><th>Category</th><th>TVL</th><th>Why set aside</th></tr></thead><tbody>` +
    [...R.set_aside].sort((a, b) => b.tvl_usd - a.tvl_usd).map((s) => `<tr><td class="name">${esc(s.name)}</td><td>${esc(s.category)}</td><td>${mny(s.tvl_usd)}</td><td>${esc(s.why)}</td></tr>`).join('') + `</tbody>`;
}

// method & tests
function renderMethod() {
  const e = R.evidence, m = R.model, b = R.boot;
  const tbl = (heads, rows) => `<div class="table-wrap"><table class="board"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const name = { cat: 'category (shrunk)', mom: '7-day growth', age: 'protocol age', chain: 'chain count', kin: 'name-stem kin', control: 'control — permuted growth', 'size curve': 'size curve (always in)', 'base rate': 'base rate (always in)', growth: '7-day growth', size: 'log TVL' };
  $('#view-method').innerHTML = `<h2>Method &amp; tests — launchfit-1</h2>` +
    `<p class="note">Fitted on the snapshot's figures and nothing else. No protocol is named in the code; no number is hard-coded. Every term was tried and kept only if it lowered the held-out miss in one test and worsened neither. The two tests: <b>leave-one-out</b> (each protocol priced by a model fitted without it) and <b>walk-forward</b> (older protocols price newer ones — value trains on ${e.valueSplit.train} listed before ${e.valueSplit.cut}, tests on ${e.valueSplit.test}; odds trains on ${e.oddsSplit.train} before ${e.oddsSplit.cut}, tests on ${e.oddsSplit.test}).</p>` +
    `<h3>Value: what was tried</h3>` + tbl(['Term', 'Leave-one-out miss', 'Walk-forward miss', 'Kept?'],
      [[`flat (median multiple)`, `×${e.valueFlat.loo.toFixed(2)}`, `×${e.valueFlat.wf.toFixed(2)}`, 'baseline'],
        ...e.valueTable.map((t) => [name[t.term] || t.term, `×${t.loo.toFixed(2)}`, `×${t.wf.toFixed(2)}`, t.kept ? '<b>yes</b>' : 'no'])]) +
    `<p class="note">Size and category survive. Growth, age and chain count each help one test and hurt the other, so none is in the model — a single test would have kept them. The control is growth shuffled between protocols: it “helps” walk-forward alone (×${e.valueTable.find((t) => t.term === 'control').wf.toFixed(2)}), which is why the rule needs both tests. Kinship's coefficient is ~0: families almost never mint twice, so kinship enters the odds, not the value.</p>` +
    `<h3>Odds: what was tried (Brier score, lower is better)</h3>` + tbl(['Feature', 'Leave-one-out', 'Walk-forward', 'Kept?'],
      e.oddsTable.map((t) => [name[t.term] || t.term, t.loo.toFixed(3), t.wf.toFixed(3), t.kept ? '<b>yes</b>' : 'no'])) +
    `<p class="note">Age, size and token kin survive. Growth is the closest call: it improves leave-one-out (0.209 vs 0.213) but worsens walk-forward by 0.0001, so the rule keeps it out. Chain count's coefficient is 0.00. The control again “helps” walk-forward alone — rejected.</p>` +
    `<h3>Ranges: do they hold, out of sample?</h3>` + tbl(['Test', 'In P25–P75 (claims 50%)', 'In P10–P90 (claims 80%)'],
      [[`Walk-forward (n=${e.honesty.wf.n})`, `${e.honesty.wf.in2575}/${e.honesty.wf.n} (${pct(e.honesty.wf.in2575 / e.honesty.wf.n)})`, `${e.honesty.wf.in1090}/${e.honesty.wf.n} (${pct(e.honesty.wf.in1090 / e.honesty.wf.n)})`]]) +
    `<h3>Uncertainty</h3><p class="note">200 seeded bootstrap refits. Size slope ${m.sizeB.toFixed(3)} ± ${b.sizeBSe.toFixed(3)}; odds age +${m.oddsB[1].toFixed(2)} ± ${b.coefsSe.oAge.toFixed(2)}, size +${m.oddsB[2].toFixed(2)} ± ${b.coefsSe.oSize.toFixed(2)}, token kin ${m.oddsB[3].toFixed(2)} ± ${b.coefsSe.oKin.toFixed(2)}. Rank intervals are the 5th–95th percentile of bootstrap ranks; in ${b.negSlope} of 200 refits the size slope flips negative, which is why the interval uses percentiles, not min and max.</p>` +
    `<h3>Limitations, stated plainly</h3><p class="note">The snapshot is one day (14 Nov 2026); nothing here updates. “Records no token” is DefiLlama's record — a protocol can have a token DefiLlama does not link. The value model explains size and category only, and the typical miss is still ×${e.valueFinal.loo.toFixed(2)}. Farm verdicts assume a 7% drop share and the stated gas. No Ethereum-first farm pays at $1,000 — the gas alone is $115.50.</p>`;
}

// routing
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [kind, arg] = h.split('/');
  document.querySelectorAll('.view').forEach((v) => { v.hidden = true; });
  document.querySelectorAll('.views button').forEach((btn) => btn.classList.toggle('on', btn.dataset.view === (kind === 'protocol' ? 'board' : kind || 'board')));
  if (kind === 'protocol' && arg) { renderDetail(arg); $('#view-detail').hidden = false; window.scrollTo(0, 0); return; }
  const view = ['board', 'trades', 'aside', 'method'].includes(kind) ? kind : 'board';
  if (view === 'trades') renderTrades();
  if (view === 'aside') renderAside();
  if (view === 'method') renderMethod();
  if (view === 'board') renderBoard();
  $(`#view-${view}`).hidden = false;
}
document.querySelectorAll('.views button').forEach((btn) => btn.addEventListener('click', () => { location.hash = `#/${btn.dataset.view}`; }));
window.addEventListener('hashchange', route);
route();
