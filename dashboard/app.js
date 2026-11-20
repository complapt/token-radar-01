// Token Radar's dashboard (radar-6). It reads window.RADAR, written beside
// dashboard/ by main.ts, and renders the ranked board, a filterable table,
// a per-protocol detail view with the fitted model's own inputs and the
// protocol's farm plan, plus the live-token anchors that fitted the model.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, signal: 'all', verdict: 'all', anchorSort: 'residual', anchorDir: -1 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(2); }

  // The fitted model in one function: the page recomputes a row from its
  // fitted contributions and checks the number board.json carries, so the
  // page's code and the board's data are visibly the same arithmetic.
  // implied = round(tvl * clamp(10 ^ (intercept + category + size +
  // growth), 0.02, 3)).
  function impliedOf(row, model) {
    var c = row.contributions;
    var logMult = c.intercept + c.category + c.size + c.growth;
    var mult = Math.min(model.multiple_cap, Math.max(model.multiple_floor, Math.pow(10, logMult)));
    return Math.max(1, Math.round(row.tvl_usd * mult));
  }
  function fmtLog(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2);
  }
  function fmtFactor(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (n >= 1) return 'x' + n.toFixed(2);
    return '÷' + (1 / n).toFixed(2);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC on ' + name + ' (' + chain + ') and leave the deposit earning.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Add $' + capital + ' of liquidity to the main pool of ' + name + ' on ' + chain + ' and keep it staked.';
    if (c.indexOf('bridge') >= 0) return 'Move $' + capital + ' of USDC to ' + chain + ' with ' + name + ', then put the bridged funds to work in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the native asset through ' + name + ' on ' + chain + ' and hold the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis') >= 0) return 'Fund a $' + capital + ' margin account on ' + name + ' (' + chain + ') and open a single small hedged trade.';
    if (c.indexOf('prediction') >= 0) return 'Back one outcome with $' + capital + ' on ' + name + ' (' + chain + ') and let the position settle.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + capital + ' of the stable asset issued by ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Buy $' + capital + ' of the yield-bearing asset from ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Take $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold it.';
    if (c.indexOf('privacy') >= 0) return 'Shield $' + capital + ' through ' + name + ' on ' + chain + ' and keep the shielded balance.';
    return 'Put $' + capital + ' of USDC to work in ' + name + ' on ' + chain + ' and leave the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\'s own page.';
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var steps = [
      { text: 'Start with a wallet used only for farming, funded with $' + (capital + 20) + ', and store its recovery phrase offline.', cost: 'about $3 of gas to fund it', time: '10 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital plus roughly $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to open' },
      { text: 'Do one real action every week on ' + p.name + ', such as a deposit, a swap, a borrow or a vote, so the wallet shows repeated use.', cost: 'about $2 of gas per week', time: '10 minutes a week' },
      { text: 'Keep the position open for at least ' + hold + ' days, so the activity spans more than one snapshot window.', cost: 'the $' + capital + ' stays locked in the position', time: hold + ' days' },
      { text: 'When a token or points page appears, claim only through the link the protocol itself publishes, and never pay anyone to claim for you.', cost: 'no fee to check; gas only if you claim', time: '10 minutes' },
      { text: 'Log the wallet address, the dates and every transaction hash, so you can prove the position or unwind it later.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    if (p.chains && p.chains.length > 1) {
      steps.splice(3, 0, { text: 'Repeat the same position on a second chain, ' + p.chains[1] + ', so the wallet is active on two chains the protocol supports.', cost: 'another $' + capital + ' of capital and about $4 of gas', time: '15 minutes' });
    }
    return steps.map(stepText);
  }

  // Shared by the KPI strip and the model panel validation table.
  function validationRows() {
    var f = DATA.fit;
    return [
      ['Leave-one-out miss', '×' + f.loo_miss_factor.toFixed(2), 'One anchor at a time', 'Typical error when each anchor is predicted from the other ' + (f.fit_anchors_n - 1) + '.'],
      ['Holdout miss, 10 seeds', '×' + f.holdout_miss_factor_10seed.toFixed(2), '20% of anchors, 10 splits', 'Typical miss on held-out anchors, 10-split average.'],
      ['Walk-forward miss', '×' + f.wf_miss_factor.toFixed(2), '2025+ listings', 'Typical miss on 2025+ listings, fitted before 2025.'],
      ['Range holds', Math.round(f.range_holds * 100) + '%', 'Holdout anchors', 'Share of holdout anchors whose actual value fell inside the predicted range.'],
      ['Launch odds, held out', Math.round(f.odds_holdout_accuracy * 100) + '%', 'Held-out protocols', 'Share of held-out launch calls that were right.']
    ];
  }

  // Intercept is identical for every row, so it cannot explain a rank.
  function largestDriver(c) {
    var ds = [['category', c.category], ['size', c.size], ['growth', c.growth]];
    ds.sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
    return ds[0];
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('signal')) state.signal = params.get('signal');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.signal !== 'all') params.set('signal', state.signal);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.signal !== 'all' && !(r.signals || []).includes(state.signal)) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.predicted_multiple; bv = b.predicted_multiple; }
      else if (key === 'ev') { av = a.expected_value_usd; bv = b.expected_value_usd; }
      else if (key === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
      else if (key === 'net') { av = a.net_per_hour_usd; bv = b.net_per_hour_usd; }
      else if (key === 'verdict') { av = verdictRank(a.verdict); bv = verdictRank(b.verdict); }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function verdictRank(v) {
    if (v === 'farm') return 0;
    if (v === 'marginal') return 1;
    return 2;
  }
  function verdictLabel(v) {
    if (v === 'farm') return 'Farm';
    if (v === 'marginal') return 'Marginal';
    return 'Skip';
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' more pre-token protocols, and every one of the ' + DATA.kpis.coverage_total + ' protocols in the snapshot is accounted for: ' + DATA.board_size + ' scored, ' + DATA.anchors_size + ' live-token anchors, ' + DATA.kpis.set_aside_count + ' set aside by category. Implied value is a fitted model, not a promise.' })
      ),
      el('p', { class: 'prov', text: 'Snapshot ' + DATA.as_of + ' · Source: DeFiLlama · ' + DATA.kpis.coverage_accounted + ' of ' + DATA.kpis.coverage_total + ' accounted for · ' + DATA.board_size + ' rows scored · ' + DATA.fit.fit_anchors_n + ' of ' + DATA.fit.anchors_n + ' anchors fitted · Watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size })
    );
  }

  function kpiStrip() {
    var k = DATA.kpis;
    var v = validationRows();
    function kpi(row) {
      return el('div', { class: 'kpi' }, el('span', { text: row[0] }), el('b', { text: row[1] }), el('span', { class: 'sub', text: row[3] }));
    }
    return el('section', { class: 'panel kpis', 'aria-label': 'How good is the model?' },
      el('h2', { text: 'How good is the model?' }),
      el('div', { class: 'kpi-groups' },
        el('div', { class: 'kpi-group' },
          el('h3', { text: 'Error' }),
          el('div', { class: 'kpi-grid' },
            kpi(v[0]),
            kpi(v[1]),
            kpi(v[2])
          )
        ),
        el('div', { class: 'kpi-group' },
          el('h3', { text: 'Calibration' }),
          el('div', { class: 'kpi-grid' },
            kpi(v[3]),
            kpi(v[4]),
            el('div', { class: 'kpi' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(k.total_implied_usd) }), el('span', { class: 'sub', text: 'Scale total for all ' + DATA.board_size + ' rows, not a validation score.' }))
          )
        )
      )
    );
  }

  function evTop10() {
    var list = DATA.ev_top10 || [];
    if (list.length === 0) return null;
    var cats = {};
    DATA.rows.forEach(function (x) { cats[x.slug] = x.category || 'Other'; });
    return el('section', { class: 'panel ev', 'aria-label': 'Top ten by expected value' },
      el('h2', { text: 'Top 10 by expected value' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mult-table' },
          el('caption', { class: 'sub', text: 'Top ten by expected value (implied value times launch odds). Rank stays by implied value; this second ranking finds the old protocols that still have not launched.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'By EV' }),
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Implied rank' }),
            el('th', { scope: 'col', text: 'Launch odds' }),
            el('th', { scope: 'col', text: 'Expected value' })
          )),
          el('tbody', null, list.map(function (r, i) {
            var attrs = {
              tabindex: '0',
              onclick: function (e) { openDetail(r.slug, e.currentTarget); },
              onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, e.currentTarget); } }
            };
            if (i === 0) attrs.class = 'top1';
            return el('tr', attrs,
              el('td', { class: 'num rank' + (i < 3 ? ' top3' : ''), text: String(i + 1) }),
              el('td', null, el('div', { class: 'name' },
                el('b', { text: r.name }),
                el('span', { class: 'sub', text: cats[r.slug] || 'Other' })
              )),
              el('td', { class: 'num', text: '#' + r.rank }),
              el('td', { class: 'num', text: Math.round(r.launch_odds * 100) + '%' }),
              el('td', { class: 'num ev-num', text: fmtUsd(r.expected_value_usd) })
            );
          }))
        )
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); var q2 = document.getElementById('q'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var signalSelect = el('select', { id: 'signal', 'aria-label': 'Filter by signal' },
      el('option', { value: 'all', text: 'All signals' }),
      ['surging', 'cooling', 'young', 'seasoned', 'single-chain', 'multi-chain', 'large-tvl', 'small-tvl'].map(function (s) { return el('option', { value: s, text: s, selected: s === state.signal ? 'selected' : null }); })
    );
    signalSelect.addEventListener('change', function () { state.signal = signalSelect.value; writeHash(); render(); });
    var verdictTabs = ['all', 'farm', 'marginal', 'skip'].map(function (v) {
      return el('button', { type: 'button', 'aria-pressed': state.verdict === v ? 'true' : 'false', text: v === 'all' ? 'All' : verdictLabel(v), onclick: function () { state.verdict = v; writeHash(); render(); } });
    });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'anchors' ? 'true' : 'false', text: 'Anchors', onclick: function () { state.tab = 'anchors'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field search' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'signal', text: 'Signal' }), signalSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Verdict' }), el('div', { class: 'tabs', id: 'verdict', role: 'group', 'aria-label': 'Filter by verdict' }, verdictTabs)),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? 'Showing ' + rows().length + ' of ' + DATA.board_size : DATA.anchors.length + ' live-token anchors' })
    );
  }

  function sortHeader(key, label) {
    var active = state.sort === key;
    var attrs = { scope: 'col' };
    if (key !== 'name' && key !== 'verdict') attrs.class = 'num';
    if (active) attrs['aria-sort'] = state.dir < 0 ? 'descending' : 'ascending';
    return el('th', attrs,
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        el('span', { 'aria-hidden': 'true', class: active ? 'sort on' : 'sort', text: active ? (state.dir < 0 ? ' ↓' : ' ↑') : ' ↕' })
      )
    );
  }

  function boardTable() {
    var m = DATA.model;
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function (e) { openDetail(r.slug, e.currentTarget); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, e.currentTarget); } }
      },
        el('td', { class: 'num' }, el('div', null,
          el('b', { text: String(r.rank) }),
          el('span', { class: 'sub', text: ' ' + r.rank_p10 + '–' + r.rank_p90 })
        )),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.predicted_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: Math.round(r.launch_odds * 100) + '%' }),
        el('td', { class: 'num', text: fmtUsd(r.expected_value_usd) }),
        el('td', null, el('span', { class: 'verdict ' + r.verdict, text: verdictLabel(r.verdict) })),
        el('td', { class: 'cue', 'aria-hidden': 'true', text: '›' })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel board' },
      el('p', { class: 'verdict-key', text: 'Farm: net $' + m.farm_per_hour_usd + ' or more per hour. Marginal: $' + m.marginal_per_hour_usd + ' to $' + m.farm_per_hour_usd + ' per hour. Skip: below $' + m.marginal_per_hour_usd + ' per hour.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Rank shows the bootstrap range over 200 refits of the model. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Pred. mult.'),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Launch odds'),
            sortHeader('ev', 'Expected value'),
            sortHeader('verdict', 'Verdict'),
            el('th', { scope: 'col', text: 'Details' })
          )),
          tbody
        )
      )
    );
  }

  function anchorsTable() {
    var list = DATA.anchors.slice().sort(function (a, b) {
      var key = state.anchorSort || 'residual';
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'actual') { av = a.actual_multiple === null ? -Infinity : a.actual_multiple; bv = b.actual_multiple === null ? -Infinity : b.actual_multiple; }
      else if (key === 'predicted') { av = a.predicted_multiple === null ? -Infinity : a.predicted_multiple; bv = b.predicted_multiple === null ? -Infinity : b.predicted_multiple; }
      else { av = a.residual_log === null ? -Infinity : Math.abs(a.residual_log); bv = b.residual_log === null ? -Infinity : Math.abs(b.residual_log); }
      if (av < bv) return -state.anchorDir;
      if (av > bv) return state.anchorDir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var resid = r.residual_log === null ? 'n/a' : fmtFactor(Math.pow(10, r.residual_log));
      var residClass = r.residual_log === null ? '' : r.residual_log >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: r.mcap_usd === null ? 'n/a' : fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.actual_multiple === null ? 'n/a' : fmtMult(r.actual_multiple) }),
        el('td', { class: 'num', text: r.predicted_multiple === null ? 'n/a' : fmtMult(r.predicted_multiple) }),
        el('td', { class: 'num ' + residClass, text: resid }),
        el('td', null, el('span', { class: 'status ' + (r.fit_status === 'fitted' ? 'live' : ''), text: r.fit_status === 'fitted' ? 'anchor, fitted' : r.fit_status === 'no-date' ? 'anchor, no date' : r.fit_status === 'set-aside' ? 'anchor, set aside' : 'live, unpriced' }))
      ));
    });
    function anchorHeader(key, label) {
      var active = state.anchorSort === key;
      var attrs = { scope: 'col', class: 'num' };
      if (active) attrs['aria-sort'] = state.anchorDir < 0 ? 'descending' : 'ascending';
      return el('th', attrs,
        el('button', { type: 'button', onclick: function () { if (state.anchorSort === key) state.anchorDir = -state.anchorDir; else { state.anchorSort = key; state.anchorDir = -1; } render(); } },
          label,
          el('span', { 'aria-hidden': 'true', class: active ? 'sort on' : 'sort', text: active ? (state.anchorDir < 0 ? ' ↓' : ' ↑') : ' ↕' })
        )
      );
    }
    var noDate = DATA.anchors.filter(function (a) { return a.fit_status === 'no-date'; }).length;
    var aside = DATA.anchors.filter(function (a) { return a.fit_status === 'set-aside'; }).length;
    var unpriced = DATA.anchors.filter(function (a) { return a.fit_status === 'unpriced'; }).length;
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live-token anchors: the ' + DATA.fit.fit_anchors_n + ' with a market cap, a known listing date and a priceable category fitted the model, so each one\u2019s actual multiple sits next to the model\u2019s prediction and the gap between them. ' + noDate + ' priced anchors have no listing date and were not fitted; ' + aside + ' are exchanges, bridges or staked receipts and were set aside; ' + unpriced + ' trade but carry no market cap here, so they anchor nothing. Sorted by the size of the gap.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            anchorHeader('tvl', 'TVL'),
            el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Market cap' }),
            anchorHeader('actual', 'Actual mult.'),
            anchorHeader('predicted', 'Predicted mult.'),
            anchorHeader('residual', 'Gap'),
            el('th', { scope: 'col', text: 'Role' })
          )),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var multRows = Object.keys(DATA.category_multiples).sort(function (a, b) { return DATA.category_multiples[b] - DATA.category_multiples[a]; });
    var pl = f.power_law;
    return el('section', { class: 'panel model', id: 'model' },
      el('p', { class: 'method-link' }, el('a', { href: 'method.md', text: 'Read the full method' })),
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'use', text: 'This ranking orders pre-token protocols for farm prioritisation; it is not a price prediction.' }),
      el('p', { class: 'sub', text: 'One fitted model scores every row: ordinary least squares on log10(market-cap / TVL) over the ' + f.fit_anchors_n + ' live-token anchors with a market cap, a known listing date and a priceable category. Exchanges, bridges and staked receipts are excluded by the same rule that sets them aside on the board, their multiples are custodial balances, not protocol value. No name is special-cased.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x clamp(10 ^ (intercept + category + size + growth), ' + fmtMult(m.multiple_floor) + ', ' + fmtMult(m.multiple_cap) + ') )'
      ),
      el('p', { class: 'sub', text: 'As a power law: implied = 10^' + pl.intercept_log.toFixed(2) + ' x TVL^' + pl.tvl_exponent.toFixed(2) + ' x 10^(' + pl.growth_coef.toFixed(2) + ' x growth) x category. Value grows with TVL, but slower than TVL itself, so bigger protocols trade at lower multiples. Growth now helps: among genuine DeFi protocols, growing TVL predicts a higher multiple.' }),
      el('p', { class: 'sub', text: 'The honest part: the snapshot\u2019s figures predict the multiple only roughly. Leave-one-out miss x' + f.loo_miss_factor.toFixed(2) + ', seeded 80/20 holdout x' + f.holdout_miss_factor.toFixed(2) + ' on one split and x' + f.holdout_miss_factor_10seed.toFixed(2) + ' over ten seeds (one split is fifteen anchors, so quote the two together), walk-forward x' + f.wf_miss_factor.toFixed(2) + ' (fitted before 2025, tested on 2025+ listings). The 50% range holds for ' + Math.round(f.range_holds * 100) + '% of holdout anchors. A ranking by the best fit the data supports, not a price forecast.' }),
      el('p', { class: 'sub', text: 'Age is not in the multiple on purpose: adding it made the walk-forward miss 12x, so the age a protocol was listed at does not transfer across years. Age is used where the data supports it instead: the launch odds below, and the expected value, which is the implied value times those odds.' }),
      el('h3', { text: 'Fitted coefficients' }),
      el('p', { class: 'sub', text: 'Each row is one feature\u2019s weight in log10(multiple). A negative size weight means larger protocols trade at lower multiples; the category rows shift the baseline for that category only.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Feature' }), el('th', { scope: 'col', text: 'Coefficient' }))),
        el('tbody', null, f.features.map(function (name, i) {
          return el('tr', null,
            el('td', { text: f.feature_labels[i] }),
            el('td', { class: 'num', text: fmtLog(f.coefficients[i]) })
          );
        }))
      ),
      el('h3', { text: 'Validation' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Method' }), el('th', { scope: 'col', text: 'What was held out' }), el('th', { scope: 'col', text: 'Result' }), el('th', { scope: 'col', text: 'What it means' }))),
        el('tbody', null, validationRows().map(function (v) {
          return el('tr', null,
            el('td', { text: v[0] }),
            el('td', { text: v[2] }),
            el('td', { class: 'num', text: v[1] }),
            el('td', { text: v[3] })
          );
        }))
      ),
      el('h3', { text: 'Limitations' }),
      el('p', { class: 'sub', text: 'Typical miss runs ×' + f.wf_miss_factor.toFixed(2) + ' to ×' + f.loo_miss_factor.toFixed(2) + ', so adjacent ranks are within noise. The range holds only ' + Math.round(f.range_holds * 100) + '% of the time, so treat ranges as wide. Launch odds were right ' + Math.round(f.odds_holdout_accuracy * 100) + '% of held-out calls, so roughly one in three would be wrong.' }),
      el('h3', { text: 'How often protocols this old have a token' }),
      el('p', { class: 'sub', text: 'Counted from the snapshot itself. The 6-12 month and 1-2 year bands are pooled at their joint share, the raw shares dip (39.7% then 38.3%) and odds that fall with age are noise. Held out over ten 80/20 splits, the odds predict whether a protocol has a token with ' + Math.round(f.odds_holdout_accuracy * 100) + '% accuracy (base rate ' + Math.round(f.odds_base_rate * 100) + '%), Brier ' + f.odds_holdout_brier.toFixed(3) + '. A stock, not a forecast: the share that has launched so far.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Listed' }), el('th', { scope: 'col', text: 'Live' }), el('th', { scope: 'col', text: 'Pre-token' }), el('th', { scope: 'col', text: 'Share with a token' }), el('th', { scope: 'col', text: 'Odds used' }))),
        el('tbody', null, (DATA.launch_shares || []).map(function (s) {
          return el('tr', null,
            el('td', { text: s.bucket }),
            el('td', { class: 'num', text: String(s.live) }),
            el('td', { class: 'num', text: String(s.pre_token) }),
            el('td', { class: 'num', text: (s.share * 100).toFixed(0) + '%' }),
            el('td', { class: 'num', text: (s.odds * 100).toFixed(0) + '%' })
          );
        }))
      ),
      el('h3', { text: 'Expected value' }),
      el('p', { class: 'sub', text: 'Expected value is the implied value times the launch odds. Rank stays by implied value; the top ten by expected value sit above the board and surface the old protocols that still have not launched: Polymarket implied #9, expected #3; Lofty implied #35, expected #9.' }),
      el('h3', { text: 'Farm verdicts, net of costs' }),
      el('p', { class: 'sub', text: 'A farm plan costs gas and locks capital. The payoff if the token launches is a typical 5% airdrop of the implied value, times the launch odds, minus gas, minus the lock-up cost of the capital at 4% a year. Farm at $' + m.farm_per_hour_usd + ' net/hour or more, marginal $' + m.marginal_per_hour_usd + '–$' + m.farm_per_hour_usd + ', skip below $' + m.marginal_per_hour_usd + '. ' + DATA.kpis.farmable_count + ' rows are farm, ' + DATA.kpis.marginal_count + ' marginal, ' + DATA.kpis.skip_count + ' skip. The 5% is an assumption, every row prints its net hourly rate and break-even odds, so the verdict can be re-derived with a different share. The honest limit: a 5% slice of tens of millions dwarfs a $25 gas bill, so nearly every row clears $50/hour. The Best farms list and the portfolio below, ranked by net $/hour, are where farms separate.' }),
      el('h3', { text: 'Best farms and the $500 portfolio' }),
      el('p', { class: 'sub', text: 'The five best farms by net $/hour, and a $' + DATA.planner.budget_usd + ' portfolio allocated to the best farms in order, each taking its plan\u2019s capital in full. The farms run in parallel, so the portfolio\u2019s rate is the sum of the farms\u2019 net rates: $' + DATA.planner.total_net_per_hour_usd.toFixed(2) + ' an hour on $' + DATA.planner.total_capital_usd + ' of capital and $' + DATA.planner.total_gas_usd + ' of gas.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Farm' }), el('th', { scope: 'col', text: 'Net $/hour' }), el('th', { scope: 'col', text: 'Expected value' }), el('th', { scope: 'col', text: 'Break-even odds' }), el('th', { scope: 'col', text: 'In $500 portfolio' }))),
        el('tbody', null, (DATA.best_farms || []).map(function (bf) {
          var pf = (DATA.planner.farms || []).filter(function (x) { return x.slug === bf.slug; })[0];
          return el('tr', null,
            el('td', { text: bf.name }),
            el('td', { class: 'num', text: '$' + bf.net_per_hour_usd.toFixed(2) }),
            el('td', { class: 'num', text: fmtUsd(bf.expected_value_usd) }),
            el('td', { class: 'num', text: (bf.break_even_odds * 100).toFixed(2) + '%' }),
            el('td', { class: 'num', text: pf ? fmtUsd(pf.capital_usd) : 'n/a' })
          );
        }))
      ),
      el('h3', { text: 'How stable is a rank' }),
      el('p', { class: 'sub', text: 'The board is refitted 200 times on resamples of the ' + f.fit_anchors_n + ' fit anchors and re-ranked each time. Each row shows its rank range (10th–90th percentile) beside its rank. The top 3 are tight; ranks 7–10 are wide, and one row in eleven swings across the board. A point rank is a claim; the range is how much to trust it.' }),
      el('h3', { text: 'Sensitivity' }),
      el('p', { class: 'sub', text: 'The top five implied values with TVL halved or grown 50%, and with seven-day growth halved or grown 50%. A ranking that collapses under a small input change is not a ranking.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Implied' }), el('th', { scope: 'col', text: 'TVL −50%' }), el('th', { scope: 'col', text: 'TVL +50%' }), el('th', { scope: 'col', text: 'Growth −50%' }), el('th', { scope: 'col', text: 'Growth +50%' }))),
        el('tbody', null, (DATA.sensitivity.top5 || []).map(function (s) {
          return el('tr', null,
            el('td', { text: s.name }),
            el('td', { class: 'num', text: fmtUsd(s.base_usd) }),
            el('td', { class: 'num', text: fmtUsd(s.tvl_down_usd) }),
            el('td', { class: 'num', text: fmtUsd(s.tvl_up_usd) }),
            el('td', { class: 'num', text: fmtUsd(s.growth_down_usd) }),
            el('td', { class: 'num', text: fmtUsd(s.growth_up_usd) })
          );
        }))
      ),
      el('h3', { text: 'Fitted category multiples' }),
      el('p', { class: 'sub', text: 'Each category\u2019s multiple at the reference protocol: $100M TVL, flat seven days. The global baseline is ' + fmtMult(DATA.global_multiple) + '. The target log-ratio is winsorized to [' + m.winsor_lo + ', ' + m.winsor_hi + '] before fitting, so one 400x outlier cannot drag the fit.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Fitted mcap / TVL' }))),
        el('tbody', null, multRows.map(function (c) {
          return el('tr', null, el('td', { text: c }), el('td', { class: 'num', text: fmtMult(DATA.category_multiples[c]) }));
        }))
      ),
      el('h3', { text: 'Set aside, not hidden' }),
      el('p', { class: 'sub', text: DATA.kpis.set_aside_count + ' pre-token rows are set aside by category, not scored: exchanges (custodial balances), bridges (assets in transit) and staked receipts (a repackaged asset). The watchlist has none of these categories. Every one is listed below with its reason.' }),
      el('details', { class: 'set-aside' },
        el('summary', { text: 'Show the ' + DATA.kpis.set_aside_count + ' set-aside rows' }),
        el('table', { class: 'mult-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Reason' }))),
          el('tbody', null, (DATA.set_aside || []).map(function (s) {
            return el('tr', null,
              el('td', { text: s.name }),
              el('td', { text: s.category || 'Other' }),
              el('td', { class: 'num', text: fmtUsd(s.tvl_usd) }),
              el('td', { text: s.reason })
            );
          }))
        )
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  var lastTrigger = null;
  dialog.addEventListener('close', function () {
    state.selected = null;
    writeHash();
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  });

  function openDetail(slug, trigger) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    if (trigger) lastTrigger = trigger;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var drv = largestDriver(row.contributions);
    var drvLabel = drv[0] === 'size' ? 'size (TVL)' : drv[0] === 'growth' ? '7-day growth' : 'category';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('div', { class: 'title-row' },
          el('h2', { id: 'detail-title', text: row.name }),
          el('span', { class: 'verdict ' + row.verdict, text: verdictLabel(row.verdict) })
        ),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('p', { class: 'why' }, el('b', { text: 'Why this rank: ' }), drvLabel + ' is the largest driver (' + fmtLog(drv[1]) + ' in log10 multiple).'));
    var chips = (row.signals || []).map(function (s) {
      return el('span', { class: 'chip', text: s });
    });
    if (chips.length > 0) {
      dialog.appendChild(el('div', { class: 'chips' }, chips));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Predicted multiple' }), el('b', { class: 'num', text: fmtMult(row.predicted_multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: '50% range' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd) })),
        el('div', null, el('span', { text: 'Launch odds' }), el('b', { class: 'num', text: (row.launch_odds * 100).toFixed(0) + '%' })),
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(row.expected_value_usd) })),
        el('div', null, el('span', { text: 'Net $/hour, farm plan' }), el('b', { class: 'num', text: '$' + row.net_per_hour_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Rank range, 200 refits' }), el('b', { class: 'num', text: row.rank_p10 + '–' + row.rank_p90 }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the fitted log10 multiple is ' + fmtLog(row.log_multiple) + ' = ' + fmtLog(row.contributions.intercept) + ' intercept ' + fmtLog(row.contributions.category) + ' category ' + fmtLog(row.contributions.size) + ' size ' + fmtLog(row.contributions.growth) + ' growth. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' }),
      el('p', { class: 'sub', text: 'Verdict ' + verdictLabel(row.verdict) + ': net expected value ' + fmtUsd(row.net_ev_usd) + ' over the plan, after ' + fmtUsd(row.plan_gas_usd) + ' gas and ' + fmtUsd(row.plan_lockup_usd) + ' lock-up cost on ' + fmtUsd(row.plan_capital_usd) + ' of capital, $' + row.net_per_hour_usd.toFixed(2) + ' an hour net. Expected value is ' + fmtUsd(row.expected_value_usd) + ' (implied ' + fmtUsd(row.implied_value_usd) + ' times ' + (row.launch_odds * 100).toFixed(0) + '% launch odds); the launch breaks even at ' + (row.break_even_odds * 100).toFixed(2) + '% odds. The 5% airdrop share is an assumption.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Nearest traded neighbours' }),
      el('p', { class: 'sub', text: 'The five nearest live-token protocols by log10 TVL, same category first, each with its actual mcap / TVL. Median neighbour multiple ' + fmtMult(row.nearest_median_multiple) + ' against the model\u2019s ' + fmtMult(row.predicted_multiple) + ' for this protocol. The neighbours vary widely, so this is a cross-check, not a second valuation.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Neighbour' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Actual multiple' }))),
        el('tbody', null, (row.nearest_comps || []).map(function (c) {
          return el('tr', null,
            el('td', { text: c.name }),
            el('td', { text: c.category }),
            el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
            el('td', { class: 'num', text: fmtMult(c.multiple) })
          );
        }))
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('div', { class: 'note', text: 'No token is promised. A protocol on this board records no token in the snapshot, which is not proof it has none, and farming costs real money.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Costs' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Capital' }), el('b', { class: 'num', text: fmtUsd(row.plan_capital_usd) })),
        el('div', null, el('span', { text: 'Gas' }), el('b', { class: 'num', text: fmtUsd(row.plan_gas_usd) })),
        el('div', null, el('span', { text: 'Lock-up cost' }), el('b', { class: 'num', text: fmtUsd(row.plan_lockup_usd) })),
        el('div', null, el('span', { text: 'Net expected value' }), el('b', { class: 'num', text: fmtUsd(row.net_ev_usd) })),
        el('div', null, el('span', { text: 'Net $/hour' }), el('b', { class: 'num', text: '$' + row.net_per_hour_usd.toFixed(2) }))
      )
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function profileSection() {
    var groups = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!groups[c]) groups[c] = { count: 0, top: 0 };
      groups[c].count++;
      if (r.implied_value_usd > groups[c].top) groups[c].top = r.implied_value_usd;
    });
    var names = Object.keys(groups).sort(function (a, b) { return groups[b].count - groups[a].count; });
    var max = names.length ? groups[names[0]].count : 1;
    return el('section', { class: 'panel profile' },
      el('h2', { text: 'Profile by category' }),
      el('p', { class: 'sub', text: 'Protocols per category, with the largest implied value.' }),
      el('div', { class: 'bars' }, names.map(function (n) {
        return el('div', { class: 'bar-row' },
          el('span', { class: 'bar-label', text: n }),
          el('div', { class: 'hbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round((groups[n].count / max) * 100)) + '%' })),
          el('span', { class: 'num bar-value', text: groups[n].count + ' · top ' + fmtUsd(groups[n].top) })
        );
      }))
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(evTop10());
    shell.appendChild(kpiStrip());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : anchorsTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    if (state.tab === 'pre-token') shell.appendChild(profileSection());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
