// Token Radar's dashboard (radar-4). It reads window.RADAR, written beside
// dashboard/ by main.ts, and renders the ranked board, a filterable table,
// a per-protocol detail view with the fitted model's own inputs and the
// protocol's farm plan, plus the live-token anchors that fitted the model.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, signal: 'all', anchorSort: 'residual', anchorDir: -1 };

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

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('signal')) state.signal = params.get('signal');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.signal !== 'all') params.set('signal', state.signal);
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

  function signalSummary() {
    var counts = {};
    DATA.rows.forEach(function (r) {
      (r.signals || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    });
    var parts = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).map(function (s) {
      return counts[s] + ' ' + s;
    });
    if (parts.length === 0) return 'No signal flags on this board.';
    return 'Signals across the board: ' + parts.join(', ') + '.';
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
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token anchors fitted' }), el('b', { text: String(DATA.fit.fit_anchors_n) + ' of ' + String(DATA.fit.anchors_n) })),
        el('div', { class: 'fact' }, el('span', { text: 'Snapshot accounted for' }), el('b', { text: String(DATA.kpis.coverage_accounted) + ' / ' + String(DATA.kpis.coverage_total) }))
      ),
      el('p', { class: 'sub', text: signalSummary() })
    );
  }

  function kpiStrip() {
    var f = DATA.fit;
    var k = DATA.kpis;
    return el('section', { class: 'panel kpis', 'aria-label': 'Model key figures' },
      el('div', { class: 'kpi' }, el('span', { text: 'Leave-one-out miss' }), el('b', { text: '×' + f.loo_miss_factor.toFixed(2) })),
      el('div', { class: 'kpi' }, el('span', { text: 'Walk-forward miss' }), el('b', { text: '×' + f.wf_miss_factor.toFixed(2) })),
      el('div', { class: 'kpi' }, el('span', { text: 'Range holds' }), el('b', { text: Math.round(f.range_holds * 100) + '%' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(k.total_implied_usd) })),
      el('div', { class: 'kpi' }, el('span', { text: 'Farmable rows' }), el('b', { text: String(k.farmable_count) + ' of ' + String(k.board_rows) })),
      el('div', { class: 'kpi' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(k.top_implied_usd) }))
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
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
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'anchors' ? 'true' : 'false', text: 'Anchors', onclick: function () { state.tab = 'anchors'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'signal', text: 'Signal' }), signalSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.anchors.length + ' live-token anchors' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
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
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
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
        el('td', null, el('span', { class: 'verdict ' + r.verdict, text: verdictLabel(r.verdict) }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Pred. mult.'),
            sortHeader('implied', 'Implied value'),
            sortHeader('verdict', 'Verdict')
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
        el('td', null, el('span', { class: 'status ' + (r.fittable ? 'live' : ''), text: !r.fittable ? 'live, unpriced' : r.in_fit ? 'anchor, fitted' : 'anchor, no date' }))
      ));
    });
    function anchorHeader(key, label) {
      return el('th', { scope: 'col' },
        el('button', { type: 'button', onclick: function () { if (state.anchorSort === key) state.anchorDir = -state.anchorDir; else { state.anchorSort = key; state.anchorDir = -1; } render(); } },
          label,
          state.anchorSort === key ? el('span', { 'aria-hidden': 'true', text: state.anchorDir < 0 ? ' v' : ' ^' }) : null
        )
      );
    }
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live-token anchors: the ' + DATA.fit.fit_anchors_n + ' protocols with a market cap and a known listing date fitted the model, so their actual multiple sits next to the model\'s prediction and the gap between them. The other ' + (DATA.fit.anchors_n - DATA.fit.fit_anchors_n) + ' priced anchors have no listing date and were not fitted; the remaining ' + (DATA.anchors.length - DATA.fit.anchors_n) + ' trade but carry no market cap here, so they anchor nothing. Sorted by the size of the gap.' }),
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
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One fitted model scores every row. The anchors are the ' + f.fit_anchors_n + ' live-token protocols with a market cap and a known listing date, fitted by ordinary least squares with a small ridge term on log10(market-cap / TVL). No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x clamp(10 ^ (intercept + category + size + growth), ' + fmtMult(m.multiple_floor) + ', ' + fmtMult(m.multiple_cap) + ') )'
      ),
      el('p', { class: 'sub', text: 'As a power law: implied = 10^' + pl.intercept_log.toFixed(2) + ' x TVL^' + pl.tvl_exponent.toFixed(2) + ' x 10^(' + pl.growth_coef.toFixed(2) + ' x growth) x category. Value grows with TVL, but slower than TVL itself, so bigger protocols trade at lower multiples.' }),
      el('p', { class: 'sub', text: 'The honest part: the snapshot\'s figures predict the multiple only roughly. Leave-one-out miss is x' + f.loo_miss_factor.toFixed(2) + ' (every anchor predicted by a model that never saw it), the seeded 80/20 holdout miss is x' + f.holdout_miss_factor.toFixed(2) + ', and the walk-forward miss is x' + f.wf_miss_factor.toFixed(2) + ' (fitted on ' + f.wf_train_n + ' protocols listed before 2025, tested on ' + f.wf_test_n + ' listed in 2025 or later). The 50% prediction range holds for ' + Math.round(f.range_holds * 100) + '% of holdout anchors. The board is a ranking by the best fit the data supports, not a price forecast.' }),
      el('p', { class: 'sub', text: 'Age is not in the multiple on purpose: adding it made the walk-forward miss 12x, so the age a protocol was listed at does not transfer across years. Age is used where the data supports it instead: the share of protocols this old that already have a token, below, which sets each row\'s farm verdict.' }),
      el('h3', { text: 'Fitted coefficients' }),
      el('p', { class: 'sub', text: 'Each row is one feature\'s weight in log10(multiple). A negative size weight means larger protocols trade at lower multiples; the category rows shift the baseline for that category only.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Feature' }), el('th', { scope: 'col', text: 'Coefficient' }), el('th', { scope: 'col', text: 'What it means' }))),
        el('tbody', null, f.features.map(function (name, i) {
          return el('tr', null,
            el('td', { text: f.feature_labels[i] }),
            el('td', { class: 'num', text: fmtLog(f.coefficients[i]) }),
            el('td', { text: coefficientMeaning(name) })
          );
        }))
      ),
      el('h3', { text: 'How often protocols this old have a token' }),
      el('p', { class: 'sub', text: 'The share of protocols in each age band that already carry a token, counted from the snapshot itself. It is a stock, not a forecast: the share that has launched so far, used as the reference odds for the farm verdict. Protocols with no listing date use the overall share.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Listed' }), el('th', { scope: 'col', text: 'Live' }), el('th', { scope: 'col', text: 'Pre-token' }), el('th', { scope: 'col', text: 'Share with a token' }))),
        el('tbody', null, (DATA.launch_shares || []).map(function (s) {
          return el('tr', null,
            el('td', { text: s.bucket }),
            el('td', { class: 'num', text: String(s.live) }),
            el('td', { class: 'num', text: String(s.pre_token) }),
            el('td', { class: 'num', text: (s.share * 100).toFixed(0) + '%' })
          );
        }))
      ),
      el('h3', { text: 'Farm verdicts' }),
      el('p', { class: 'sub', text: 'A farm plan costs gas and locks capital; the payoff if the token launches is taken as a typical 5% airdrop of the implied value, times the age band\'s share above, minus the gas. Farm when that expected value runs at $' + m.farm_per_hour_usd + ' an hour or more over the plan, marginal at $' + m.marginal_per_hour_usd + '–$' + m.farm_per_hour_usd + ', skip below $' + m.marginal_per_hour_usd + '. ' + DATA.kpis.farmable_count + ' rows are farm, ' + DATA.kpis.marginal_count + ' marginal, ' + DATA.kpis.skip_count + ' skip. The 5% is an assumption, and every row prints its expected hourly rate and its break-even odds so the verdict can be re-derived with a different share.' }),
      el('h3', { text: 'Fitted category multiples' }),
      el('p', { class: 'sub', text: 'Each category\'s multiple at the reference protocol: $100M TVL, flat seven days. The global baseline is ' + fmtMult(DATA.global_multiple) + '. The target log-ratio is winsorized to [' + m.winsor_lo + ', ' + m.winsor_hi + '] before fitting, so one 400x outlier cannot drag the fit.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Feature' }), el('th', { scope: 'col', text: 'Coefficient' }), el('th', { scope: 'col', text: 'What it means' }))),
        el('tbody', null, f.features.map(function (name, i) {
          return el('tr', null,
            el('td', { text: f.feature_labels[i] }),
            el('td', { class: 'num', text: fmtLog(f.coefficients[i]) }),
            el('td', { text: coefficientMeaning(name) })
          );
        }))
      ),
      el('h3', { text: 'Fitted category multiples' }),
      el('p', { class: 'sub', text: 'Each category\'s multiple at the reference protocol: $100M TVL, flat seven days, one year old, one chain. The global baseline is ' + fmtMult(DATA.global_multiple) + '. The target log-ratio is winsorized to [' + m.winsor_lo + ', ' + m.winsor_hi + '] before fitting, so one 400x outlier cannot drag the fit.' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Fitted mcap / TVL' }))),
        el('tbody', null, multRows.map(function (c) {
          return el('tr', null, el('td', { text: c }), el('td', { class: 'num', text: fmtMult(DATA.category_multiples[c]) }));
        }))
      ),
      el('h3', { text: 'Category multiples at a glance' }),
      el('p', { class: 'sub', text: 'Each bar is a category\'s fitted multiple, longest bar first. A long bar means the market already pays near or above TVL for that kind of protocol.' }),
      categoryBars(),
      el('h3', { text: 'Categories by TVL' }),
      el('p', { class: 'sub', text: 'Combined TVL of the pre-token rows in each category, with the strongest row in each. A category with a few large rows reads differently from one with many small ones.' }),
      statsTable(),
      el('h3', { text: 'Set aside, not hidden' }),
      el('p', { class: 'sub', text: DATA.kpis.set_aside_count + ' pre-token rows are set aside by category, not scored: exchanges (their TVL is custodial balances), bridges (their TVL is assets locked in transit) and staked receipts (a repackaged asset). The watchlist has none of these categories. Every one of them is listed below with its reason.' }),
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

  function coefficientMeaning(name) {
    if (name === 'intercept') return 'Baseline log10 multiple at the reference protocol';
    if (name === 'size') return 'Per decade of TVL above $100M';
    if (name === 'growth') return 'Per 100 points of seven-day growth';
    if (name.indexOf('cat:') === 0) return 'Shift for this category against the baseline';
    return '';
  }

  function statsTable() {
    var stats = DATA.category_stats || [];
    return el('table', { class: 'mult-table' },
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Pre-token rows' }), el('th', { scope: 'col', text: 'Combined TVL' }), el('th', { scope: 'col', text: 'Top row by implied value' }))),
      el('tbody', null, stats.map(function (s) {
        return el('tr', null,
          el('td', { text: s.category }),
          el('td', { class: 'num', text: String(s.pre_token_rows) }),
          el('td', { class: 'num', text: fmtUsd(s.total_tvl_usd) }),
          el('td', { text: s.top_slug + ' at ' + fmtUsd(s.top_implied_usd) })
        );
      }))
    );
  }

  function categoryBars() {
    var entries = Object.keys(DATA.category_multiples).map(function (c) {
      return { name: c, mult: DATA.category_multiples[c], count: DATA.rows.filter(function (r) { return (r.category || 'Other') === c; }).length };
    }).sort(function (a, b) { return b.mult - a.mult; });
    var top = entries[0] ? entries[0].mult : 1;
    return el('div', { class: 'bars' }, entries.map(function (e) {
      return el('div', { class: 'bar-row' },
        el('span', { class: 'bar-name', text: e.name + ' (' + e.count + ')' }),
        el('div', { class: 'bar-track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round((e.mult / top) * 100)) + '%' })),
        el('span', { class: 'num', text: fmtMult(e.mult) })
      );
    }));
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var chips = (row.signals || []).map(function (s) {
      return el('span', { class: 'chip', text: s });
    });
    if (chips.length > 0) {
      dialog.appendChild(el('div', { class: 'chips' }, chips));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Predicted multiple' }), el('b', { class: 'num', text: fmtMult(row.predicted_multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: '50% range' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the fitted log10 multiple is ' + fmtLog(row.log_multiple) + ' = ' + fmtLog(row.contributions.intercept) + ' intercept ' + fmtLog(row.contributions.category) + ' category ' + fmtLog(row.contributions.size) + ' size ' + fmtLog(row.contributions.growth) + ' growth. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' }),
      el('p', { class: 'sub', text: 'Verdict ' + verdictLabel(row.verdict) + ': expected value about $' + fmtUsd(row.farm_ev_usd) + ', or $' + row.farm_per_hour_usd.toFixed(2) + ' an hour over the plan, at a 5% airdrop and the ' + (row.launch_share * 100).toFixed(0) + '% share of protocols this old that already have a token. The break-even launch odds are ' + (row.break_even_odds * 100).toFixed(2) + '%. Plan cost: about $' + row.plan_cost_usd + ' of gas over ' + row.plan_days + ' days, plus the deposit itself locked in the position.' })
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
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  var radarFrame = null;

  function radarPalette(i) {
    var colors = ['#f5b83d', '#4cc38a', '#6ea8fe', '#c084fc', '#f472b6', '#2dd4bf', '#fb923c', '#a3e635'];
    return colors[i % colors.length];
  }

  function radarLayout() {
    var groups = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });
    var names = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
    var total = DATA.rows.length;
    var start = -Math.PI / 2;
    return names.map(function (name, i) {
      var span = (groups[name].length / total) * Math.PI * 2;
      var sector = { name: name, from: start, to: start + span, color: radarPalette(i), rows: groups[name] };
      start += span;
      return sector;
    });
  }

  function radarSection() {
    return el('section', { class: 'panel radar' },
      el('h2', { text: 'The radar' }),
      el('p', { class: 'sub', text: 'Every pre-token protocol as a blip. The closer to the centre, the higher its implied value; the colour is its category. The beam lights each blip up as it passes. Select a blip to open its model and farm plan.' }),
      el('div', { class: 'radar-wrap' },
        el('canvas', { id: 'radar-canvas', width: 1000, height: 460, tabindex: '0', role: 'img', 'aria-label': 'Radar plot of pre-token protocols by implied value and category' }),
        el('div', { class: 'radar-tip', id: 'radar-tip', hidden: 'hidden' })
      ),
      el('p', { class: 'sub', text: 'Rings: $1B at the centre, then $100M, $10M, $1M at the edge. A ring around a blip means it is on the watchlist.' })
    );
  }

  function startRadar() {
    var canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    if (radarFrame !== null) cancelAnimationFrame(radarFrame);
    var ctx = canvas.getContext('2d');
    var tip = document.getElementById('radar-tip');
    var sectors = radarLayout();
    var litAt = {};
    var hovered = null;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var sweep = reduced ? Math.PI / 4 : 0;

    function geometry() {
      var w = canvas.clientWidth || 1000;
      var h = 460;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      return { w: w, h: h, cx: w / 2, cy: h / 2, maxR: Math.min(w, h) / 2 - 36 };
    }
    var g = geometry();

    function radiusFor(implied) {
      var v = Math.log10(Math.max(1, implied));
      var t = Math.min(1, Math.max(0, (v - 6) / 3));
      return g.maxR * (1 - t) + 6;
    }
    function points() {
      var out = [];
      sectors.forEach(function (s) {
        s.rows.forEach(function (r, i) {
          var f = s.rows.length <= 1 ? 0.5 : i / s.rows.length;
          out.push({ row: r, sector: s, angle: s.from + f * (s.to - s.from), r: radiusFor(r.implied_value_usd) });
        });
      });
      return out;
    }
    var pts = points();

    function ringLabel(v) {
      if (v === 9) return '$1B';
      if (v === 8) return '$100M';
      if (v === 7) return '$10M';
      return '$1M';
    }

    function draw(now) {
      if (canvas.clientWidth !== 0 && Math.abs(canvas.clientWidth - g.w) > 2) {
        g = geometry();
        pts = points();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.strokeStyle = '#26304d';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#93a1bd';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      [9, 8, 7, 6].forEach(function (v) {
        var rr = g.maxR * (1 - (v - 6) / 3) + 6;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(ringLabel(v), g.cx + 5, g.cy - rr + 15);
      });
      for (var a = 0; a < 12; a++) {
        var spoke = (a / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(g.cx, g.cy);
        ctx.lineTo(g.cx + Math.cos(spoke) * (g.maxR + 6), g.cy + Math.sin(spoke) * (g.maxR + 6));
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      sectors.forEach(function (s) {
        if (s.to - s.from < 0.3) return;
        var mid = (s.from + s.to) / 2;
        var lx = g.cx + Math.cos(mid) * (g.maxR + 20);
        var ly = g.cy + Math.sin(mid) * (g.maxR + 20);
        ctx.fillStyle = s.color;
        ctx.fillText(s.name, lx, ly);
      });
      var grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, g.cx, g.cy) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(245, 184, 61, 0.20)');
        grad.addColorStop(0.12, 'rgba(245, 184, 61, 0)');
        grad.addColorStop(1, 'rgba(245, 184, 61, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(g.cx, g.cy);
        ctx.arc(g.cx, g.cy, g.maxR + 6, sweep - 0.7, sweep);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#f5b83d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(g.cx + Math.cos(sweep) * (g.maxR + 6), g.cy + Math.sin(sweep) * (g.maxR + 6));
      ctx.stroke();
      pts.forEach(function (p) {
        var x = g.cx + Math.cos(p.angle) * p.r;
        var y = g.cy + Math.sin(p.angle) * p.r;
        var diff = (p.angle - sweep) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (diff < 0.09) litAt[p.row.slug] = now;
        var since = now - (litAt[p.row.slug] || 0);
        var glow = since < 2500 ? 1 - since / 2500 : 0;
        var size = Math.min(6, Math.max(3, 1.2 + Math.log10(Math.max(1, p.row.tvl_usd)) * 0.32));
        ctx.globalAlpha = 0.55 + glow * 0.45;
        ctx.fillStyle = p.sector.color;
        ctx.beginPath();
        ctx.arc(x, y, size + glow * 2, 0, Math.PI * 2);
        ctx.fill();
        if (p.row.tvl_usd >= DATA.floor_usd) {
          ctx.strokeStyle = '#e8edf7';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, size + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (hovered === p.row.slug) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, size + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    }

    function frame(now) {
      if (!reduced) sweep = (now / 5000) * Math.PI * 2;
      draw(now);
      if (!reduced) radarFrame = requestAnimationFrame(frame);
    }

    function locate(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var best = null;
      var bestD = 16;
      pts.forEach(function (p) {
        var x = g.cx + Math.cos(p.angle) * p.r;
        var y = g.cy + Math.sin(p.angle) * p.r;
        var d = Math.hypot(mx - x, my - y);
        if (d < bestD) { bestD = d; best = p; }
      });
      return best;
    }

    canvas.addEventListener('mousemove', function (e) {
      var p = locate(e);
      if (p) {
        hovered = p.row.slug;
        tip.hidden = false;
        tip.textContent = p.row.name + ' — ' + fmtUsd(p.row.implied_value_usd) + ' implied, ' + fmtUsd(p.row.tvl_usd) + ' TVL';
        var rect = canvas.getBoundingClientRect();
        tip.style.left = Math.min(rect.width - 260, e.clientX - rect.left + 14) + 'px';
        tip.style.top = Math.max(0, e.clientY - rect.top - 12) + 'px';
        canvas.style.cursor = 'pointer';
      } else {
        hovered = null;
        tip.hidden = true;
        canvas.style.cursor = 'default';
      }
    });
    canvas.addEventListener('mouseleave', function () {
      hovered = null;
      tip.hidden = true;
    });
    canvas.addEventListener('click', function (e) {
      var p = locate(e);
      if (p) openDetail(p.row.slug);
    });
    radarFrame = requestAnimationFrame(frame);
  }

  function render() {
    if (radarFrame !== null) { cancelAnimationFrame(radarFrame); radarFrame = null; }
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(kpiStrip());
    if (state.tab === 'pre-token') shell.appendChild(radarSection());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : anchorsTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    startRadar();
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
