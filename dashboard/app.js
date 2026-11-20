// Token Radar dashboard (radar-9), from window.RADAR.
(function() {
	'use strict';
	var D = window.RADAR;
	if (!D) return;
	var app = document.getElementById('board');
	var theme = 'dark';
	try {
		var saved = window.localStorage.getItem('token-radar-theme');
		if (saved === 'light') { theme = 'cream'; window.localStorage.setItem('token-radar-theme', 'cream'); }
		else if (saved === 'cream' || saved === 'dark') theme = saved;
	} catch (e) { }
	document.documentElement.setAttribute('data-theme', theme);
	function setTheme(next) {
		theme = next;
		document.documentElement.setAttribute('data-theme', theme);
		try { window.localStorage.setItem('token-radar-theme', theme); } catch (e) { }
		render();
		var btn = document.querySelector('.top .button');
		if (btn) btn.focus();
	}
	var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, signal: 'all', verdict: 'all', anchorSort: 'residual', anchorDir: -1 };
	var quadSeen = false;
	var chartSeen = false;
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
	function impliedOf(row, model) {
		var c = row.contributions;
		var logMult = c.intercept + c.category + c.size + c.growth;
		var mult = Math.min(model.multiple_cap, Math.max(model.multiple_floor, 10 ** logMult));
		return Math.max(1, Math.round(row.tvl_usd * mult));
	}
	function fmtLog(n) {
		if (n === null || n === undefined || !isFinite(n)) return 'n/a';
		return (n > 0 ? '+' : '') + n.toFixed(2);
	}
	function el(tag, attrs) {
		var node = document.createElement(tag);
		if (attrs) {
			Object.keys(attrs).forEach(function(k) {
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
			if (Array.isArray(child)) child.forEach(function(c) { if (c) node.appendChild(c); });
			else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
			else node.appendChild(child);
		}
		return node;
	}
	function th(t) { return el('th', { scope: 'col', text: t }); }
	function cell(c, t) { return el('td', c ? { class: c, text: t } : { text: t }); }
	function sub(t) { return el('p', { class: 'sub', text: t }); }
	function h3(t) { return el('h3', { text: t }); }
	var ACTS = [
		[['lend', 'cdp', 'collateral'], 'Lend ${C} of USDC on {N} ({H}) and leave the deposit earning.'],
		[['dex', 'yield', 'leveraged farm', 'farm'], 'Add ${C} of liquidity to the main pool of {N} on {H} and keep it staked.'],
		[['bridge'], 'Move ${C} of USDC to {H} with {N}, then put the bridged funds to work in its app.'],
		[['staking', 'restak'], 'Stake ${C} of the native asset through {N} on {H} and hold the receipt token.'],
		[['perpetual', 'derivative', 'basis'], 'Fund a ${C} margin account on {N} ({H}) and open a single small hedged trade.'],
		[['prediction'], 'Back one outcome with ${C} on {N} ({H}) and let the position settle.'],
		[['curator', 'allocator', 'vault'], 'Deposit ${C} into a {N} vault on {H} and hold the vault shares.'],
		[['stable'], 'Mint or hold ${C} of the stable asset issued by {N} on {H}.'],
		[['rwa'], 'Buy ${C} of the yield-bearing asset from {N} on {H} and hold it.'],
		[['insurance'], 'Take ${C} of cover from {N} on {H} and keep the policy active.'],
		[['index'], 'Buy ${C} of the {N} index on {H} and hold it.'],
		[['privacy'], 'Shield ${C} through {N} on {H} and keep the shielded balance.']
	];
	function farmSteps(p) {
		var chain = p.chains && p.chains.length ? p.chains[0] : 'its main chain';
		var capital = p.tvl_usd >= 5e9 ? 250 : p.tvl_usd >= 1e9 ? 150 : p.tvl_usd >= 1e8 ? 100 : 50;
		var hold = p.age_days === null || p.age_days === undefined ? 30 : p.age_days < 180 ? 60 : p.age_days < 365 ? 45 : 30;
		var gas = capital >= 150 ? 8 : 4;
		var c = (p.category || '').toLowerCase();
		var action = null;
		for (var i = 0; i < ACTS.length && !action; i++) {
			for (var j = 0; j < ACTS[i][0].length; j++) {
				if (c.indexOf(ACTS[i][0][j]) >= 0) { action = ACTS[i][1].split('{C}').join(capital).split('{N}').join(p.name).split('{H}').join(chain); break; }
			}
		}
		if (!action) action = 'Put $' + capital + ' of USDC to work in ' + p.name + ' on ' + chain + ' and leave the position open.';
		var steps = [
			'Start with a wallet used only for farming, funded with $' + (capital + 20) + ', and store its recovery phrase offline. Cost: about $3 of gas to fund it. Time: 10 minutes.',
			action + ' Cost: $' + capital + ' of capital plus roughly $' + gas + ' of gas. Time: 15 minutes to open.',
			'Do one real action every week on ' + p.name + ', such as a deposit, a swap, a borrow or a vote, so the wallet shows repeated use. Cost: about $2 of gas per week. Time: 10 minutes a week.',
			'Keep the position open for at least ' + hold + ' days, so the activity spans more than one snapshot window. Cost: the $' + capital + ' stays locked in the position. Time: ' + hold + ' days.',
			'When a token or points page appears, claim only through the link the protocol itself publishes, and never pay anyone to claim for you. Cost: no fee to check; gas only if you claim. Time: 10 minutes.',
			'Log the wallet address, the dates and every transaction hash, so you can prove the position or unwind it later. Cost: nothing but the log. Time: 5 minutes.'
		];
		if (p.chains && p.chains.length > 1) steps.splice(3, 0, 'Repeat the same position on a second chain, ' + p.chains[1] + ', so the wallet is active on two chains the protocol supports. Cost: another $' + capital + ' of capital and about $4 of gas. Time: 15 minutes.');
		return steps;
	}
	function valRows() {
		var f = D.fit;
		return [
			['Leave-one-out miss', '×' + f.loo_miss_factor.toFixed(2), 'One anchor at a time', 'Typical error predicting each anchor from the other ' + (f.fit_anchors_n - 1) + '.'],
			['Holdout miss, 10 seeds', '×' + f.holdout_miss_factor_10seed.toFixed(2), '20% of anchors, 10 splits', 'Typical miss on held-out anchors, 10-split average.'],
			['Walk-forward miss', '×' + f.wf_miss_factor.toFixed(2), '2025+ listings', 'Typical miss on 2025+ listings, fitted before 2025.'],
			['Range holds', Math.round(f.range_holds * 100) + '%', 'Holdout anchors', 'Share of holdout anchors whose value fell inside the predicted range.'],
			['Launch odds, held out', Math.round(f.odds_holdout_accuracy * 100) + '%', 'Held-out protocols', 'Share of held-out launch calls that were right.']
		];
	}
	function largestDriver(c) {
		var ds = [['category', c.category], ['size', c.size], ['growth', c.growth]];
		ds.sort(function(a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
		return ds[0];
	}
	function readHash() {
		var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
		[['q'], ['p', 'selected'], ['category'], ['chain'], ['signal'], ['verdict'], ['tab']].forEach(function(kv) {
			var v = params.get(kv[0]);
			if (v) state[kv[1] || kv[0]] = v;
		});
	}
	function writeHash() {
		var params = new URLSearchParams();
		[['q', state.q, ''], ['category', state.category, 'all'], ['chain', state.chain, 'all'], ['signal', state.signal, 'all'], ['verdict', state.verdict, 'all'], ['tab', state.tab, 'pre-token'], ['p', state.selected, null]].forEach(function(x) {
			if (x[1] && x[1] !== x[2]) params.set(x[0], x[1]);
		});
		var next = params.toString();
		if (next) window.history.replaceState(null, '', '#' + next);
		else window.history.replaceState(null, '', window.location.pathname + window.location.search);
	}
	function rows() {
		var q = state.q.trim().toLowerCase();
		return D.rows.filter(function(r) {
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
		var val = {
			name: function(r) { return r.name.toLowerCase(); },
			tvl: function(r) { return r.tvl_usd; },
			growth: function(r) { return r.change_7d === null ? -Infinity : r.change_7d; },
			age: function(r) { return r.age_days === null ? Infinity : r.age_days; },
			multiple: function(r) { return r.predicted_multiple; },
			ev: function(r) { return r.expected_value_usd; },
			odds: function(r) { return r.launch_odds; },
			net: function(r) { return r.net_per_hour_usd; },
			verdict: function(r) { return verdictRank(r.verdict); }
		}[state.sort] || function(r) { return r.implied_value_usd; };
		return list.slice().sort(function(a, b) {
			var av = val(a), bv = val(b);
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
	function rowAttrs(slug) {
		return {
			tabindex: '0',
			onclick: function(e) { openDetail(slug, e.currentTarget); },
			onkeydown: function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(slug, e.currentTarget); } }
		};
	}
	function header() {
		return el('header', { class: 'top' },
			el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
			el('div', { class: 'top-meta' },
				el('span', { text: 'Snapshot ' + D.as_of }),
				el('span', { text: 'DefiLlama protocol index' }),
				el('span', { text: D.model_version + ' model' }),
				el('button', { class: 'button', type: 'button', 'aria-pressed': theme === 'dark' ? 'true' : 'false', 'aria-label': theme === 'dark' ? 'Switch to cream theme' : 'Switch to dark theme', text: theme === 'dark' ? 'Cream theme' : 'Dark theme', onclick: function() { setTheme(theme === 'dark' ? 'cream' : 'dark'); } })
			)
		);
	}
	function lede() {
		return el('section', { class: 'lede' },
			el('div', null,
				el('h1', { text: D.watchlist_size + ' watchlist protocols, ranked by implied value' }),
				el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(D.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + D.early_size + ' more; all ' + D.kpis.coverage_total + ' protocols in the snapshot are accounted for: ' + D.board_size + ' scored, ' + D.anchors_size + ' live-token anchors, ' + D.kpis.set_aside_count + ' set aside by category. Implied value is a fitted model, not a promise.' })
			),
			el('p', { class: 'prov', text: 'Snapshot ' + D.as_of + ' · Source: DeFiLlama · ' + D.kpis.coverage_accounted + ' of ' + D.kpis.coverage_total + ' accounted for · ' + D.board_size + ' rows scored · ' + D.fit.fit_anchors_n + ' of ' + D.fit.anchors_n + ' anchors fitted · Watchlist ' + D.watchlist_size + '/' + D.watchlist_size })
		);
	}
	function kpiStrip() {
		var k = D.kpis;
		var v = valRows();
		function kpi(row) {
			return el('div', { class: 'kpi' }, el('span', { text: row[0] }), el('b', { text: row[1] }), el('span', { class: 'sub', text: row[3] }));
		}
		function group(title, items) {
			return el('div', { class: 'kpi-group' },
				h3(title),
				el('div', { class: 'kpi-grid' }, items)
			);
		}
		return el('section', { class: 'panel kpis', 'aria-label': 'How good is the model?' },
			el('h2', { text: 'How good is the model?' }),
			el('div', { class: 'kpi-groups' },
				group('Error', [kpi(v[0]), kpi(v[1]), kpi(v[2])]),
				group('Calibration', [kpi(v[3]), kpi(v[4]),
					el('div', { class: 'kpi' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(k.total_implied_usd) }), el('span', { class: 'sub', text: 'Scale total for all ' + D.board_size + ' rows, not a validation score.' }))])
			)
		);
	}
	function evTop10() {
		var list = D.ev_top10 || [];
		if (list.length === 0) return null;
		var cats = {};
		D.rows.forEach(function(x) { cats[x.slug] = x.category || 'Other'; });
		return el('section', { class: 'panel ev', 'aria-label': 'Top ten by expected value' },
			el('h2', { text: 'Top 10 by expected value' }),
			el('div', { class: 'table-wrap' },
				el('table', { class: 'mult-table' },
					el('caption', { class: 'sub', text: 'Top ten by expected value (implied value times launch odds). Rank stays by implied value.' }),
					el('thead', null, el('tr', null,
						th('By EV'),
						th('Protocol'),
						th('Implied rank'),
						th('Launch odds'),
						th('Expected value')
					)),
					el('tbody', null, list.map(function(r, i) {
						var attrs = rowAttrs(r.slug);
						if (i === 0) attrs.class = 'top1';
						return el('tr', attrs,
							el('td', { class: 'num rank' + (i < 3 ? ' top3' : ''), text: String(i + 1) }),
							el('td', null, el('div', { class: 'name' },
								el('b', { text: r.name }),
								el('span', { class: 'sub', text: cats[r.slug] || 'Other' })
							)),
							cell('num', '#' + r.rank),
							cell('num', Math.round(r.launch_odds * 100) + '%'),
							el('td', { class: 'num ev-num', text: fmtUsd(r.expected_value_usd) })
						);
					}))
				)
			)
		);
	}
	function evChart() {
		var byEv = D.rows.slice().sort(function(a, b) { return b.expected_value_usd - a.expected_value_usd; });
		var top = byEv.slice(0, 5);
		var max = top.length ? top[0].expected_value_usd : 1;
		var rows = top.map(function(r, i) {
			var pct = Math.max(3, Math.round((r.expected_value_usd / max) * 100));
			return el('button', { class: 'ev-row' + (i === 0 ? ' top1' : ''), type: 'button', 'aria-label': r.name + ', expected value ' + fmtUsd(r.expected_value_usd) + ', ' + (i + 1) + ' of 5 by expected value', onclick: function(e) { openDetail(r.slug, e.currentTarget); } },
				el('span', { class: 'ev-rank num', text: String(i + 1) }),
				el('span', { class: 'ev-name', text: r.name }),
				el('span', { class: 'ev-track', 'aria-hidden': 'true' }, el('i', { class: 'ev-fill', style: 'width:' + pct + '%;--d:' + (i * 80) + 'ms' })),
				el('span', { class: 'ev-value num', text: fmtUsd(r.expected_value_usd) })
			);
		});
		var panel = el('section', { class: 'panel ev-chart' + (chartSeen ? ' settled' : ''), 'aria-label': 'Top five by expected value' },
			el('h2', { text: 'Top 5 by expected value' }),
			rows
		);
		chartSeen = true;
		return panel;
	}
	function sel(id, label, all, list, cur, set) {
		var s = el('select', { id: id, 'aria-label': label },
			el('option', { value: 'all', text: all }),
			list.map(function(c) { return el('option', { value: c, text: c, selected: c === cur ? 'selected' : null }); })
		);
		s.addEventListener('change', function() { set(s.value); writeHash(); render(); });
		return s;
	}
	function tab(t, on, fn) { return el('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', text: t, onclick: fn }); }
	function controls() {
		var categories = Array.from(new Set(D.rows.map(function(r) { return r.category || 'Other'; }))).sort();
		var chains = Array.from(new Set(D.rows.reduce(function(acc, r) { return acc.concat(r.chains || []); }, []))).sort();
		var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
		search.addEventListener('input', function() { state.q = search.value; writeHash(); render(); var q2 = document.getElementById('q'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); });
		var catSelect = sel('category', 'Filter by category', 'All categories', categories, state.category, function(v) { state.category = v; });
		var chainSelect = sel('chain', 'Filter by chain', 'All chains', chains, state.chain, function(v) { state.chain = v; });
		var signalSelect = sel('signal', 'Filter by signal', 'All signals', ['surging', 'cooling', 'young', 'seasoned', 'single-chain', 'multi-chain', 'large-tvl', 'small-tvl'], state.signal, function(v) { state.signal = v; });
		var verdictTabs = ['all', 'farm', 'marginal', 'skip'].map(function(v) {
			return tab(v === 'all' ? 'All' : verdictLabel(v), state.verdict === v, function() { state.verdict = v; writeHash(); render(); });
		});
		var pre = tab('Pre-token', state.tab === 'pre-token', function() { state.tab = 'pre-token'; render(); });
		var live = tab('Anchors', state.tab === 'anchors', function() { state.tab = 'anchors'; render(); });
		return el('div', { class: 'controls' },
			el('div', { class: 'field search' }, el('label', { for: 'q', text: 'Search' }), search),
			el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
			el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
			el('div', { class: 'field' }, el('label', { for: 'signal', text: 'Signal' }), signalSelect),
			el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Verdict' }), el('div', { class: 'tabs', id: 'verdict', role: 'group', 'aria-label': 'Filter by verdict' }, verdictTabs)),
			el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
			el('span', { class: 'count', text: state.tab === 'pre-token' ? 'Showing ' + rows().length + ' of ' + D.board_size : D.anchors.length + ' live-token anchors' })
		);
	}
	function shead(label, active, dir, num, fn) {
		var attrs = { scope: 'col' };
		if (num) attrs.class = 'num';
		if (active) attrs['aria-sort'] = dir < 0 ? 'descending' : 'ascending';
		return el('th', attrs,
			el('button', { type: 'button', onclick: fn },
				label,
				el('span', { 'aria-hidden': 'true', class: active ? 'sort on' : 'sort', text: active ? (dir < 0 ? ' ↓' : ' ↑') : ' ↕' })
			)
		);
	}
	function sortHeader(key, label) {
		return shead(label, state.sort === key, state.dir, key !== 'name' && key !== 'verdict', function() { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); });
	}
	function boardTable() {
		var m = D.model;
		var list = sortedRows(rows());
		if (list.length === 0) {
			return el('div', { class: 'panel' }, el('div', { class: 'empty' },
				el('h2', { text: 'No protocol matches that filter' }),
				el('p', { text: 'Clear the search or pick another category to see the board again.' }),
				el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function() { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
			));
		}
		var max = list[0].implied_value_usd || 1;
		var tbody = el('tbody');
		list.forEach(function(r) {
			var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
			var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
			var attrs = rowAttrs(r.slug);
			attrs['data-selected'] = state.selected === r.slug ? 'true' : 'false';
			var tr = el('tr', attrs,
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
				cell('num', fmtAge(r.age_days)),
				cell('num', fmtMult(r.predicted_multiple)),
				el('td', null, el('div', { class: 'implied' },
					el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
					el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
				)),
				cell('num', Math.round(r.launch_odds * 100) + '%'),
				cell('num', fmtUsd(r.expected_value_usd)),
				el('td', null, el('span', { class: 'verdict ' + r.verdict, text: verdictLabel(r.verdict) })),
				el('td', { class: 'cue', 'aria-hidden': 'true', text: '›' })
			);
			tbody.appendChild(tr);
		});
		return el('div', { class: 'panel board' },
			el('p', { class: 'verdict-key', text: 'Farm: net $' + m.farm_per_hour_usd + ' or more per hour. Marginal: $' + m.marginal_per_hour_usd + ' to $' + m.farm_per_hour_usd + ' per hour. Skip: below $' + m.marginal_per_hour_usd + ' per hour.' }),
			el('div', { class: 'table-wrap' },
				el('table', null,
					el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Rank shows the bootstrap range over 200 refits. Select a row for its model and farm plan.' }),
					el('thead', null, el('tr', null,
						sortHeader('implied', 'Rank'),
						sortHeader('name', 'Protocol'),
						sortHeader('tvl', 'TVL'),
						sortHeader('growth', '7d'),
						sortHeader('age', 'Age'),
						sortHeader('multiple', 'Mult.'),
						sortHeader('implied', 'Implied value'),
						sortHeader('odds', 'Launch odds'),
						sortHeader('ev', 'Exp. value'),
						sortHeader('verdict', 'Verdict'),
						th('Details')
					)),
					tbody
				)
			)
		);
	}
	function anchors() {
		var list = D.anchors.slice().sort(function(a, b) {
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
		list.forEach(function(r) {
			var resid = r.residual_log === null ? 'n/a' : r.residual_log >= 0 ? 'x' + Math.pow(10, r.residual_log).toFixed(2) : '÷' + Math.pow(10, -r.residual_log).toFixed(2);
			var residClass = r.residual_log === null ? '' : r.residual_log >= 0 ? 'pos' : 'neg';
			tbody.appendChild(el('tr', null,
				el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
				cell('num', fmtUsd(r.tvl_usd)),
				el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
				cell('num', r.mcap_usd === null ? 'n/a' : fmtUsd(r.mcap_usd)),
				cell('num', r.actual_multiple === null ? 'n/a' : fmtMult(r.actual_multiple)),
				cell('num', r.predicted_multiple === null ? 'n/a' : fmtMult(r.predicted_multiple)),
				el('td', { class: 'num ' + residClass, text: resid }),
				el('td', null, el('span', { class: 'status ' + (r.fit_status === 'fitted' ? 'live' : ''), text: r.fit_status === 'fitted' ? 'anchor, fitted' : r.fit_status === 'no-date' ? 'anchor, no date' : r.fit_status === 'set-aside' ? 'anchor, set aside' : 'live, unpriced' }))
			));
		});
		function anchorHeader(key, label) {
			return shead(label, state.anchorSort === key, state.anchorDir, true, function() { if (state.anchorSort === key) state.anchorDir = -state.anchorDir; else { state.anchorSort = key; state.anchorDir = -1; } render(); });
		}
		var noDate = D.anchors.filter(function(a) { return a.fit_status === 'no-date'; }).length;
		var aside = D.anchors.filter(function(a) { return a.fit_status === 'set-aside'; }).length;
		var unpriced = D.anchors.filter(function(a) { return a.fit_status === 'unpriced'; }).length;
		return el('div', { class: 'panel' },
			el('div', { class: 'table-wrap' },
				el('table', null,
					el('caption', { class: 'sub', text: 'Live-token anchors: the ' + D.fit.fit_anchors_n + ' with a market cap, a known listing date and a priceable category fitted the model, so each one\u2019s actual multiple sits next to the model\u2019s prediction. ' + noDate + ' priced anchors have no listing date; ' + aside + ' are exchanges, bridges or staked receipts, set aside; ' + unpriced + ' trade but carry no market cap here. Sorted by the size of the gap.' }),
					el('thead', null, el('tr', null,
						th('Protocol'),
						anchorHeader('tvl', 'TVL'),
						th('7d'),
						th('Market cap'),
						anchorHeader('actual', 'Actual mult.'),
						anchorHeader('predicted', 'Predicted mult.'),
						anchorHeader('residual', 'Gap'),
						th('Role')
					)),
					tbody
				)
			)
		);
	}
	function modelPanel() {
		var m = D.model;
		var f = D.fit;
		var multRows = Object.keys(D.category_multiples).sort(function(a, b) { return D.category_multiples[b] - D.category_multiples[a]; });
		var pl = f.power_law;
		return el('section', { class: 'panel model', id: 'model' },
			el('p', { class: 'method-link' }, el('a', { href: 'method.md', text: 'Read the full method' })),
			el('h2', { text: 'How implied value is computed' }),
			el('p', { class: 'use', text: 'This ranking orders pre-token protocols for farm prioritisation; it is not a price prediction.' }),
			sub('One fitted model scores every row: ordinary least squares on log10(market-cap / TVL) over the ' + f.fit_anchors_n + ' dated anchors. Exchanges, bridges and staked receipts are excluded by the same rule that sets them aside on the board. No name is special-cased.'),
			el('div', { class: 'formula' },
				'implied = round( tvl_usd x clamp(10 ^ (intercept + category + size + growth), ' + fmtMult(m.multiple_floor) + ', ' + fmtMult(m.multiple_cap) + ') )'
			),
			sub('As a power law: implied = 10^' + pl.intercept_log.toFixed(2) + ' x TVL^' + pl.tvl_exponent.toFixed(2) + ' x 10^(' + pl.growth_coef.toFixed(2) + ' x growth) x category. Value grows with TVL, but slower than TVL itself, so bigger protocols trade at lower multiples. Growth now helps: among genuine DeFi protocols, growing TVL predicts a higher multiple.'),
			sub('The honest part: the snapshot\u2019s figures predict the multiple only roughly. Leave-one-out miss x' + f.loo_miss_factor.toFixed(2) + ', holdout x' + f.holdout_miss_factor.toFixed(2) + ' on one split and x' + f.holdout_miss_factor_10seed.toFixed(2) + ' over ten seeds (one split is fifteen anchors, so quote the two together), walk-forward x' + f.wf_miss_factor.toFixed(2) + ' (fitted before 2025, tested on 2025+ listings). The 50% range holds for ' + Math.round(f.range_holds * 100) + '% of holdout anchors. A ranking by the best fit the data supports.'),
			sub('Age is not in the multiple on purpose: adding it made the walk-forward miss 12x. Age is used where the data supports it instead: the launch odds below, and the expected value, the implied value times those odds.'),
			h3('Fitted coefficients'),
			sub('Each row is one feature\u2019s weight in log10(multiple). A negative size weight means larger protocols trade at lower multiples.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Feature'), th('Coefficient'))),
				el('tbody', null, f.features.map(function(name, i) {
					return el('tr', null,
						cell('', f.feature_labels[i]),
						cell('num', fmtLog(f.coefficients[i]))
					);
				}))
			),
			h3('Validation'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Method'), th('What was held out'), th('Result'), th('What it means'))),
				el('tbody', null, valRows().map(function(v) {
					return el('tr', null,
						cell('', v[0]),
						cell('', v[2]),
						cell('num', v[1]),
						cell('', v[3])
					);
				}))
			),
			h3('Limitations'),
			sub('Typical miss runs ×' + f.wf_miss_factor.toFixed(2) + ' to ×' + f.loo_miss_factor.toFixed(2) + ', so adjacent ranks are within noise. The range holds only ' + Math.round(f.range_holds * 100) + '% of the time, so treat ranges as wide. Launch odds were right ' + Math.round(f.odds_holdout_accuracy * 100) + '% of held-out calls, so roughly one in three would be wrong.'),
			h3('How often protocols this old have a token'),
			sub('Counted from the snapshot. The 6-12 month and 1-2 year bands are pooled at their joint share; the raw shares dip (39.7% then 38.3%) and odds that fall with age are noise. Held out over ten 80/20 splits, the odds predict whether a protocol has a token with ' + Math.round(f.odds_holdout_accuracy * 100) + '% accuracy (base rate ' + Math.round(f.odds_base_rate * 100) + '%), Brier ' + f.odds_holdout_brier.toFixed(3) + '.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Listed'), th('Live'), th('Pre-token'), th('Share with a token'), th('Odds used'))),
				el('tbody', null, (D.launch_shares || []).map(function(s) {
					return el('tr', null,
						cell('', s.bucket),
						cell('num', String(s.live)),
						cell('num', String(s.pre_token)),
						cell('num', (s.share * 100).toFixed(0) + '%'),
						cell('num', (s.odds * 100).toFixed(0) + '%')
					);
				}))
			),
			h3('Expected value'),
			sub('Expected value is the implied value times the launch odds. Rank stays by implied value; the top ten by expected value sit above the board: Polymarket implied #9, expected #3; Lofty implied #35, expected #9.'),
			h3('Farm verdicts, net of costs'),
			sub('The payoff if the token launches is a typical 5% airdrop of the implied value, times the launch odds, minus gas, minus the lock-up cost of the capital at 4% a year. Farm at $' + m.farm_per_hour_usd + ' net/hour or more, marginal $' + m.marginal_per_hour_usd + '–$' + m.farm_per_hour_usd + ', skip below $' + m.marginal_per_hour_usd + '. ' + D.kpis.farmable_count + ' rows are farm, ' + D.kpis.marginal_count + ' marginal, ' + D.kpis.skip_count + ' skip. The 5% is an assumption, every row prints its net hourly rate and break-even odds, so the verdict can be re-derived with a different share. The honest limit: a 5% slice of tens of millions dwarfs a $25 gas bill, so nearly every row is farm.'),
			h3('Best farms and the $500 portfolio'),
			sub('The five best farms by net $/hour, and a $' + D.planner.budget_usd + ' portfolio allocated to the best farms in order, each taking its plan\u2019s capital in full. The farms run in parallel, so the portfolio\u2019s rate is the sum of the farms\u2019 net rates: $' + D.planner.total_net_per_hour_usd.toFixed(2) + ' an hour on $' + D.planner.total_capital_usd + ' of capital and $' + D.planner.total_gas_usd + ' of gas.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Farm'), th('Net $/hour'), th('Expected value'), th('Break-even odds'), th('In $500 portfolio'))),
				el('tbody', null, (D.best_farms || []).map(function(bf) {
					var pf = (D.planner.farms || []).filter(function(x) { return x.slug === bf.slug; })[0];
					return el('tr', null,
						cell('', bf.name),
						cell('num', '$' + bf.net_per_hour_usd.toFixed(2)),
						cell('num', fmtUsd(bf.expected_value_usd)),
						cell('num', (bf.break_even_odds * 100).toFixed(2) + '%'),
						cell('num', pf ? fmtUsd(pf.capital_usd) : 'n/a')
					);
				}))
			),
			h3('How stable is a rank'),
			sub('The board is refitted 200 times on resamples of the ' + f.fit_anchors_n + ' fit anchors and re-ranked each time. Each row shows its rank range (10th–90th percentile) beside its rank. The top 3 are tight; ranks 7–10 are wide, and one row in eleven swings across the board.'),
			h3('Sensitivity'),
			sub('The top five implied values with TVL halved or grown 50%, and with seven-day growth halved or grown 50%.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Protocol'), th('Implied'), th('TVL −50%'), th('TVL +50%'), th('Growth −50%'), th('Growth +50%'))),
				el('tbody', null, (D.sensitivity.top5 || []).map(function(s) {
					return el('tr', null,
						cell('', s.name),
						cell('num', fmtUsd(s.base_usd)),
						cell('num', fmtUsd(s.tvl_down_usd)),
						cell('num', fmtUsd(s.tvl_up_usd)),
						cell('num', fmtUsd(s.growth_down_usd)),
						cell('num', fmtUsd(s.growth_up_usd))
					);
				}))
			),
			h3('Fitted category multiples'),
			sub('Each category\u2019s multiple at the reference protocol: $100M TVL, flat seven days. The global baseline is ' + fmtMult(D.global_multiple) + '. The target log-ratio is winsorized to [' + m.winsor_lo + ', ' + m.winsor_hi + '] before fitting.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Category'), th('Fitted mcap / TVL'))),
				el('tbody', null, multRows.map(function(c) {
					return el('tr', null, cell('', c), cell('num', fmtMult(D.category_multiples[c])));
				}))
			),
			h3('Set aside, not hidden'),
			sub(D.kpis.set_aside_count + ' pre-token rows are set aside by category, not scored: exchanges (custodial balances), bridges (assets in transit) and staked receipts (a repackaged asset). Every one is listed below with its reason.'),
			el('details', { class: 'set-aside' },
				el('summary', { text: 'Show the ' + D.kpis.set_aside_count + ' set-aside rows' }),
				el('table', { class: 'mult-table' },
					el('thead', null, el('tr', null, th('Protocol'), th('Category'), th('TVL'), th('Reason'))),
					el('tbody', null, (D.set_aside || []).map(function(s) {
						return el('tr', null,
							cell('', s.name),
							cell('', s.category || 'Other'),
							cell('num', fmtUsd(s.tvl_usd)),
							cell('', s.reason)
						);
					}))
				)
			)
		);
	}
	var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
	var lastTrigger = null;
	dialog.addEventListener('close', function() {
		state.selected = null;
		writeHash();
		if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
		lastTrigger = null;
	});
	function eq(l, v) { return el('div', null, el('span', { text: l }), el('b', { class: 'num', text: v })); }
	function openDetail(slug, trigger) {
		var row = D.rows.filter(function(r) { return r.slug === slug; })[0];
		if (!row) return;
		state.selected = slug;
		if (trigger) lastTrigger = trigger;
		writeHash();
		dialog.textContent = '';
		var steps = farmSteps(row);
		var recomputed = impliedOf(row, D.model);
		var drv = largestDriver(row.contributions);
		var drvLabel = drv[0] === 'size' ? 'size (TVL)' : drv[0] === 'growth' ? '7-day growth' : 'category';
		dialog.appendChild(el('div', { class: 'detail-head' },
			el('div', null,
				el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + D.board_size }),
				el('div', { class: 'title-row' },
					el('h2', { id: 'detail-title', text: row.name }),
					el('span', { class: 'verdict ' + row.verdict, text: verdictLabel(row.verdict) })
				),
				sub((row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain'))
			),
			el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function() { dialog.close(); } })
		));
		dialog.appendChild(el('p', { class: 'why' }, el('b', { text: 'Why this rank: ' }), drvLabel + ' is the largest driver (' + fmtLog(drv[1]) + ' in log10 multiple).'));
		var chips = (row.signals || []).map(function(s) {
			return el('span', { class: 'chip', text: s });
		});
		if (chips.length > 0) {
			dialog.appendChild(el('div', { class: 'chips' }, chips));
		}
		dialog.appendChild(el('section', { class: 'detail-section' },
			h3('Value'),
			el('div', { class: 'equation' },
				eq('TVL', fmtUsd(row.tvl_usd)),
				eq('Predicted multiple', fmtMult(row.predicted_multiple)),
				eq('Seven-day growth', fmtPct(row.change_7d)),
				eq('Age with no token', fmtAge(row.age_days)),
				eq('Implied value', fmtUsd(row.implied_value_usd)),
				eq('50% range', fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd)),
				eq('Launch odds', (row.launch_odds * 100).toFixed(0) + '%'),
				eq('Expected value', fmtUsd(row.expected_value_usd)),
				eq('Net $/hour, farm plan', '$' + row.net_per_hour_usd.toFixed(2)),
				eq('Rank range, 200 refits', row.rank_p10 + '–' + row.rank_p90)
			),
			sub('Model ' + D.model_version + ': the fitted log10 multiple is ' + fmtLog(row.log_multiple) + ' = ' + fmtLog(row.contributions.intercept) + ' intercept ' + fmtLog(row.contributions.category) + ' category ' + fmtLog(row.contributions.size) + ' size ' + fmtLog(row.contributions.growth) + ' growth. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.'),
			sub('Verdict ' + verdictLabel(row.verdict) + ': net expected value ' + fmtUsd(row.net_ev_usd) + ' over the plan, after ' + fmtUsd(row.plan_gas_usd) + ' gas and ' + fmtUsd(row.plan_lockup_usd) + ' lock-up cost on ' + fmtUsd(row.plan_capital_usd) + ' of capital, $' + row.net_per_hour_usd.toFixed(2) + ' an hour net. Expected value is ' + fmtUsd(row.expected_value_usd) + ' (implied ' + fmtUsd(row.implied_value_usd) + ' times ' + (row.launch_odds * 100).toFixed(0) + '% launch odds); the launch breaks even at ' + (row.break_even_odds * 100).toFixed(2) + '% odds. The 5% airdrop share is an assumption.')
		));
		dialog.appendChild(el('section', { class: 'detail-section' },
			h3('Nearest traded neighbours'),
			sub('The five nearest live-token protocols by log10 TVL, same category first, each with its actual mcap / TVL. Median neighbour multiple ' + fmtMult(row.nearest_median_multiple) + ' against the model\u2019s ' + fmtMult(row.predicted_multiple) + ' for this protocol. The neighbours vary widely, so this is a cross-check, not a second valuation.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Neighbour'), th('Category'), th('TVL'), th('Actual multiple'))),
				el('tbody', null, (row.nearest_comps || []).map(function(c) {
					return el('tr', null,
						cell('', c.name),
						cell('', c.category),
						cell('num', fmtUsd(c.tvl_usd)),
						cell('num', fmtMult(c.multiple))
					);
				}))
			)
		));
		dialog.appendChild(el('section', { class: 'detail-section' },
			h3('Farm plan'),
			el('ol', { class: 'steps' }, steps.map(function(s) {
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
	function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
	function quadrant() {
		var byEv = D.rows.slice().sort(function(a, b) { return b.expected_value_usd - a.expected_value_usd; });
		var top = byEv.slice(0, 39);
		var marg = byEv.filter(function(r) { return r.verdict === 'marginal'; })[0] || null;
		var added = !!(marg && top.indexOf(marg) < 0);
		if (added) top.push(marg);
		top.sort(function(a, b) { return b.tvl_usd - a.tvl_usd; });
		var W = 520, H = 340, L = 58, R = 12, T = 16, B = 38, pw = W - L - R, ph = H - T - B;
		var vals = top.map(function(r) { return r.implied_value_usd; });
		var lo = 10 ** Math.floor(Math.log10(Math.min(...vals)));
		var hi = 10 ** Math.ceil(Math.log10(Math.max(...vals)));
		var odds = top.map(function(r) { return r.launch_odds; }).sort(function(a, b) { return a - b; });
		var logs = top.map(function(r) { return Math.log10(r.implied_value_usd); }).sort(function(a, b) { return a - b; });
		var n = top.length, mid = Math.floor(n / 2);
		var medO = n % 2 ? odds[mid] : (odds[mid - 1] + odds[mid]) / 2;
		var medV = 10 ** (n % 2 ? logs[mid] : (logs[mid - 1] + logs[mid]) / 2);
		function X(o) { return L + o * pw; }
		function Y(v) { return T + ph - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * ph; }
		var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Quadrant map, top ' + n + ' by expected value"' + (quadSeen ? ' class="settled"' : '') + '><g class="axes">';
		s += '<line class="div" x1="' + X(medO).toFixed(1) + '" y1="' + T + '" x2="' + X(medO).toFixed(1) + '" y2="' + (T + ph) + '" stroke-dasharray="4 4"/>';
		s += '<line class="div" x1="' + L + '" y1="' + Y(medV).toFixed(1) + '" x2="' + (L + pw) + '" y2="' + Y(medV).toFixed(1) + '" stroke-dasharray="4 4"/>';
		[['High value, low odds', 0, 0], ['High value, high odds', 1, 0], ['Low value, low odds', 0, 1], ['Low value, high odds', 1, 1]].forEach(function(z) {
			s += '<text class="zone" x="' + (z[1] ? (X(medO) + L + pw) / 2 : (L + X(medO)) / 2).toFixed(1) + '" y="' + (z[2] ? T + ph - 8 : T + 16) + '" text-anchor="middle">' + z[0] + '</text>';
		});
		[0, 0.25, 0.5, 0.75, 1].forEach(function(o) {
			s += '<text class="axis" x="' + X(o).toFixed(1) + '" y="' + (T + ph + 18) + '" text-anchor="middle">' + Math.round(o * 100) + '%</text>';
		});
		for (var t = lo; t <= hi; t *= 10) {
			s += '<text class="axis" x="' + (L - 8) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end">$' + (t >= 1e9 ? (t / 1e9) + 'B' : (t / 1e6) + 'M') + '</text>';
		}
		s += '<text class="axis-t" x="' + (L + pw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">Launch odds</text>';
		s += '<text class="axis-t" x="14" y="' + (T + ph / 2).toFixed(1) + '" text-anchor="middle" transform="rotate(-90 14 ' + (T + ph / 2).toFixed(1) + ')">Implied value, log scale</text>';
		s += '</g>';
		top.forEach(function(r, i) {
			var label = r.name + ', implied ' + fmtUsd(r.implied_value_usd) + ', launch odds ' + Math.round(r.launch_odds * 100) + '%, TVL ' + fmtUsd(r.tvl_usd) + ', ' + verdictLabel(r.verdict);
			var rp = Math.min(42, Math.max(6, 42 * Math.sqrt(r.tvl_usd / top[0].tvl_usd)));
			s += '<g class="bubble ' + r.verdict + '" style="--x:' + X(r.launch_odds).toFixed(1) + 'px;--y:' + Y(r.implied_value_usd).toFixed(1) + 'px;--d:' + (120 + i * 22) + 'ms" tabindex="0" role="button" aria-label="' + esc(label) + '" data-slug="' + r.slug + '"><circle r="' + rp.toFixed(1) + '"><title>' + esc(label) + '</title></circle></g>';
		});
		s += '</svg>';
		var wrap = el('div', { class: 'qwrap', html: s });
		wrap.addEventListener('animationend', function(e) { e.target.style.willChange = 'auto'; });
		var bs = wrap.querySelectorAll('.bubble');
		for (var i = 0; i < bs.length; i++) {
			(function(b) {
				b.addEventListener('click', function() { openDetail(b.dataset.slug, b); });
				b.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(b.dataset.slug, b); } });
			})(bs[i]);
		}
		quadSeen = true;
		return el('section', { class: 'panel quad', 'aria-label': 'Where value meets odds' },
			el('h2', { text: 'Where value meets odds' }),
			el('p', { class: 'guide', text: 'Farm the top-right quadrant first: high value and high odds.' }),
			wrap,
			el('div', { class: 'legend', html: '<span><span class="dot farm"></span>Farm</span><span><span class="dot marginal"></span>Marginal</span><span><span class="dot skip"></span>Skip</span><span>Bubble size = TVL</span>' }),
			el('p', { text: (added ? 'Top 39 by expected value plus ' + marg.name + ', the highest-EV Marginal row. ' : 'Top ' + n + ' by expected value. ') + 'Board: ' + D.kpis.farmable_count + ' Farm, ' + D.kpis.marginal_count + ' Marginal, ' + D.kpis.skip_count + ' Skip. X is launch odds, Y is implied value on a log scale, bubble size is TVL, colour is verdict. Every plotted row is in the board table.' })
		);
	}
	function profile() {
		var groups = {};
		D.rows.forEach(function(r) {
			var c = r.category || 'Other';
			if (!groups[c]) groups[c] = { count: 0, top: 0 };
			groups[c].count++;
			if (r.implied_value_usd > groups[c].top) groups[c].top = r.implied_value_usd;
		});
		var names = Object.keys(groups).sort(function(a, b) { return groups[b].count - groups[a].count; });
		var max = names.length ? groups[names[0]].count : 1;
		return el('section', { class: 'panel profile' },
			el('h2', { text: 'Profile by category' }),
			sub('Protocols per category.'),
			el('div', { class: 'bars' }, names.map(function(n) {
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
		var top = el('div', { class: 'lede-row' });
		top.appendChild(lede());
		top.appendChild(evChart());
		shell.appendChild(top);
		if (state.tab === 'pre-token') shell.appendChild(evTop10());
		shell.appendChild(kpiStrip());
		var layout = el('div', { class: 'layout' });
		var main = el('div', { class: 'col-main' });
		main.appendChild(controls());
		main.appendChild(state.tab === 'pre-token' ? boardTable() : anchors());
		layout.appendChild(main);
		var rail = el('aside', { class: 'rail', 'aria-label': 'Model evidence' });
		if (state.tab === 'pre-token') rail.appendChild(quadrant());
		rail.appendChild(modelPanel());
		rail.appendChild(profile());
		layout.appendChild(rail);
		shell.appendChild(layout);
		app.appendChild(shell);
		app.setAttribute('aria-busy', 'false');
		if (!dialog.isConnected) app.appendChild(dialog);
		if (state.selected) openDetail(state.selected);
	}
	readHash();
	render();
	window.addEventListener('keydown', function(e) {
		if (e.key === 'Escape' && dialog.open) dialog.close();
	});
})();
