// Token Radar dashboard (radar-13), from window.RADAR.
// Light theme is the default; dark keeps the same layout. No webfonts:
// system stacks only, so the board stays offline-capable.
(function() {
	'use strict';
	var D = window.RADAR;
	if (!D) return;
	var app = document.getElementById('board');
	var theme = 'light';
	try {
		var sv = window.localStorage.getItem('token-radar-theme');
		if (sv === 'dark') theme = 'dark';
		else if (sv === 'cream') { theme = 'light'; window.localStorage.setItem('token-radar-theme', 'light'); }
	} catch (e) { }
	document.documentElement.setAttribute('data-theme', theme);
	function setTheme(n) {
		theme = n;
		document.documentElement.setAttribute('data-theme', theme);
		try { window.localStorage.setItem('token-radar-theme', theme); } catch (e) { }
		render();
		var b = document.querySelector('.theme-btn');
		if (b) b.focus();
	}
	// The 40 saved slugs, copied exactly from the sealed snapshot's watchlist.
	// data.js carries no slug list, only the count, so the seed lives here.
	var WL_SEED = ['armitage-by-wintermute', 'axis', 'b14g', 'bittensor-dtao', 'clearstar', 'curvance', 'doppler-finance', 'ember', 'firelight', 'galaxy-curation', 'gami-labs', 'gauntlet', 'hive-protocol', 'hyperithm', 'infinifi', 'k3-capital', 'keyrock', 'lagoon', 'lightning-network', 'lofty', 'mezo-earn', 'noble', 'nonce-capital', 'onre', 'opentrade', 'plume-vaults', 'r25', 'reti-pooling', 'rockawayx', 'saturn', 'steakhouse-financial', 'symbiotic', 'tori-finance', 'tulipa-capital', 'tydro', 'upshift', 'usdd', 'valos', 'veda', 'yuzu-money'];
	var WL_KEY = 'token-radar-watchlist';
	var saved = {};
	function loadWL() {
		try {
			var raw = window.localStorage.getItem(WL_KEY);
			if (raw) {
				var a = JSON.parse(raw);
				if (Array.isArray(a) && a.length) { a.forEach(function(s) { saved[s] = 1; }); return; }
			}
		} catch (e) { }
		WL_SEED.forEach(function(s) { saved[s] = 1; });
		saveWL();
	}
	function saveWL() { try { window.localStorage.setItem(WL_KEY, JSON.stringify(Object.keys(saved))); } catch (e) { } }
	function savedCount() { return Object.keys(saved).length; }
	loadWL();
	var state = { view: 'board', q: '', category: 'all', chain: 'all', verdict: 'all', sort: 'rank', dir: 1, selected: null };
	var drawerOpen = false, lastTrigger = null, lastSlug = null;
	var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
	function fmtUsd(n) {
		if (n === null || n === undefined || !isFinite(n)) return 'n/a';
		if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
		if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
		return usd0.format(n);
	}
	function fmtX(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : n.toFixed(2) + 'x'; }
	function fmtPct(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
	function fmtLog(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2); }
	function fmtAge(d) {
		if (d === null || d === undefined) return 'unknown';
		if (d >= 365) return (d / 365).toFixed(1) + 'y';
		return Math.max(0, Math.round(d)) + 'd';
	}
	function asOfLabel() {
		var p = (D.as_of || '').split('-');
		var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return p.length === 3 ? mo[+p[1] - 1] + ' ' + (+p[2]) : D.as_of;
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
	// Minimal inline icons in the Figma positions. The downloaded Figma SVGs
	// are Material Symbols paths (about 12KB for the set) and do not fit the
	// dossier byte budget, so these are simplified equivalents, same spots.
	var S = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
	var IC = {
		radar: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#fff" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="8.4"/><circle cx="10" cy="10" r="4.6"/><circle cx="10" cy="10" r="1.5" fill="#fff" stroke="none"/><path d="M10 10L15.5 4.5"/></svg>',
		dl: S + '<path d="M12 3v10m0 0l-4-4m4 4l4-4M4 19h16"/></svg>',
		bank: S + '<path d="M3 9l9-5 9 5M4 9v10M9 9v10M15 9v10M20 9v10M2 21h20"/></svg>',
		trend: S + '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
		sprout: S + '<path d="M12 21v-8M12 13c0-4.5 3-7.5 8-7.5 0 4.5-3 7.5-8 7.5zM12 13c0-4.5-3-7.5-8-7.5 0 4.5 3 7.5 8 7.5z"/></svg>',
		search: S + '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>',
		zap: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
		shield: S + '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
		bookmark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>'
	};
	function ic(name) { return el('span', { class: 'ic', 'aria-hidden': 'true', html: IC[name] }); }
	function verdictLabel(v) { return v === 'farm' ? 'Farm' : v === 'marginal' ? 'Marginal' : 'Skip'; }
	function verdictRank(v) { return v === 'farm' ? 0 : v === 'marginal' ? 1 : 2; }
	// Farm steps, ported from the model.ts farmSteps template, fed by the
	// row's own plan fields (capital, days, chains, category).
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
		var capital = p.plan_capital_usd;
		var hold = p.plan_days;
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
	function largestDriver(c) {
		var ds = [['category', c.category], ['size', c.size], ['growth', c.growth]];
		ds.sort(function(a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
		return ds[0];
	}
	function sectorMedians() {
		var g = {};
		D.anchors.forEach(function(a) {
			if (!a.fittable || a.actual_multiple === null) return;
			var c = a.category || 'Other';
			(g[c] = g[c] || []).push(a);
		});
		return Object.keys(g).map(function(c) {
			var ms = g[c].map(function(a) { return a.actual_multiple; }).sort(function(x, y) { return x - y; });
			var n = ms.length;
			var med = n % 2 ? ms[(n - 1) / 2] : (ms[n / 2 - 1] + ms[n / 2]) / 2;
			var top = g[c].slice().sort(function(x, y) { return (y.mcap_usd || 0) - (x.mcap_usd || 0); }).slice(0, 3).map(function(a) { return a.name; });
			return { cat: c, n: n, med: med, top: top };
		}).sort(function(a, b) { return b.med - a.med; });
	}
	function valRows() {
		var f = D.fit;
		return [
			['Leave-one-out miss', 'x' + f.loo_miss_factor.toFixed(2), 'One anchor at a time', 'Typical error predicting each anchor from the other ' + (f.fit_anchors_n - 1) + '.'],
			['Holdout miss, 10 seeds', 'x' + f.holdout_miss_factor_10seed.toFixed(2), '20% of anchors, 10 splits', 'Typical miss on held-out anchors, 10-split average.'],
			['Walk-forward miss', 'x' + f.wf_miss_factor.toFixed(2), '2025+ listings', 'Typical miss on 2025+ listings, fitted before 2025.'],
			['Range holds', Math.round(f.range_holds * 100) + '%', 'Holdout anchors', 'Share of holdout anchors whose value fell inside the predicted range.'],
			['Launch odds, held out', Math.round(f.odds_holdout_accuracy * 100) + '%', 'Held-out protocols', 'Share of held-out launch calls that were right.']
		];
	}

	function readHash() {
		var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
		var v;
		if ((v = params.get('q'))) state.q = v;
		if ((v = params.get('p'))) state.selected = v;
		if ((v = params.get('category'))) state.category = v;
		if ((v = params.get('chain'))) state.chain = v;
		if ((v = params.get('verdict'))) state.verdict = v;
		if ((v = params.get('view'))) state.view = v;
		if ((v = params.get('tab'))) state.view = v === 'anchors' ? 'peers' : 'board';
	}
	function writeHash() {
		var params = new URLSearchParams();
		[['q', state.q, ''], ['category', state.category, 'all'], ['chain', state.chain, 'all'], ['verdict', state.verdict, 'all'], ['view', state.view, 'board'], ['p', state.selected, null]].forEach(function(x) {
			if (x[1] && x[1] !== x[2]) params.set(x[0], x[1]);
		});
		var next = params.toString();
		if (next) window.history.replaceState(null, '', '#' + next);
		else window.history.replaceState(null, '', window.location.pathname + window.location.search);
	}
	function filtered() { return state.q !== '' || state.category !== 'all' || state.chain !== 'all' || state.verdict !== 'all'; }
	function rows() {
		var q = state.q.trim().toLowerCase();
		return D.rows.filter(function(r) {
			if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
			if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
			if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
			if (!q) return true;
			return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
		});
	}
	function sortedRows(list) {
		var val = {
			name: function(r) { return r.name.toLowerCase(); },
			tvl: function(r) { return r.tvl_usd; },
			implied: function(r) { return r.implied_value_usd; },
			verdict: function(r) { return verdictRank(r.verdict); }
		}[state.sort] || function(r) { return r.rank; };
		return list.slice().sort(function(a, b) {
			var av = val(a), bv = val(b);
			if (av < bv) return -state.dir;
			if (av > bv) return state.dir;
			return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
		});
	}
	function sortLabel() {
		return { rank: 'Rank', name: 'Protocol name', tvl: 'TVL', implied: 'Implied FDV', verdict: 'Farm status' }[state.sort] || 'Rank';
	}
	function categories() {
		var g = {};
		D.rows.forEach(function(r) { var c = r.category || 'Other'; g[c] = (g[c] || 0) + 1; });
		return Object.keys(g).sort(function(a, b) { return g[b] - g[a] || (a < b ? -1 : 1); }).map(function(c) { return { name: c, n: g[c] }; });
	}
	function chains() {
		return Array.from(new Set(D.rows.reduce(function(acc, r) { return acc.concat(r.chains || []); }, []))).sort();
	}
	function selectedRow() {
		if (!state.selected) return D.rows[0];
		return D.rows.filter(function(r) { return r.slug === state.selected; })[0] || D.rows[0];
	}
	function selectRow(slug, trigger) {
		state.selected = slug;
		if (trigger) { lastTrigger = trigger; lastSlug = slug; }
		writeHash();
		if (window.innerWidth < 1100) drawerOpen = true;
		render();
	}
	function exportJSON() {
		var blob = new Blob([JSON.stringify({ as_of: D.as_of, model_version: D.model_version, board_size: D.board_size, rows: D.rows }, null, 2)], { type: 'application/json' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'token-radar-board.json';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
	}
	function viewTab(v, label) {
		return el('button', { type: 'button', class: 'tab' + (state.view === v ? ' on' : ''), 'aria-pressed': state.view === v ? 'true' : 'false', text: label, onclick: function() { state.view = v; writeHash(); render(); } });
	}
	function header() {
		var exp = el('button', { class: 'btn primary', type: 'button', onclick: exportJSON }, ic('dl'), el('span', { text: 'Export Board JSON' }));
		var tog = el('button', { class: 'btn theme-btn', type: 'button', 'aria-pressed': theme === 'dark' ? 'true' : 'false', text: theme === 'dark' ? 'Light theme' : 'Dark theme', onclick: function() { setTheme(theme === 'dark' ? 'light' : 'dark'); } });
		return el('header', { class: 'top' },
			el('div', { class: 'brand' },
				el('span', { class: 'mark', html: IC.radar }),
				el('div', { class: 'brand-t' },
					el('div', { class: 'brand-row' }, el('b', { text: 'Token Launch Radar' }), el('span', { class: 'pill', text: 'DeFiLlama Snapshot · ' + asOfLabel() })),
					el('span', { class: 'brand-sub', text: 'Pre-token protocol valuation model, peer comparables and farm playbooks' })
				)
			),
			el('nav', { class: 'tabs', 'aria-label': 'Views' },
				viewTab('board', 'Radar Board'),
				viewTab('peers', 'Peer Multiples'),
				viewTab('watchlist', 'Saved Watchlist (' + savedCount() + ')')
			),
			el('div', { class: 'top-act' }, exp, tog)
		);
	}
	function kpiStrip() {
		var k = D.kpis;
		var totalTvl = D.rows.reduce(function(s, r) { return s + r.tvl_usd; }, 0);
		var topMed = sectorMedians().filter(function(m) { return m.n >= 5; })[0];
		function kpi(icon, label, value, subline) {
			return el('div', { class: 'kpi' },
				el('span', { class: 'kpi-ic', 'aria-hidden': 'true', html: IC[icon] }),
				el('span', { class: 'kpi-label', text: label }),
				el('b', { class: 'num kpi-value', text: value }),
				el('span', { class: 'sub', text: subline })
			);
		}
		return el('section', { class: 'kpis', 'aria-label': 'Board totals' },
			kpi('bank', 'Total TVL', fmtUsd(totalTvl), D.board_size + ' ranked protocols · ' + k.coverage_total + ' in snapshot'),
			kpi('trend', 'Total implied value', fmtUsd(k.total_implied_usd), 'Sum of fitted implied values'),
			kpi('sprout', 'Farm verdicts', k.farmable_count + ' Farm', k.marginal_count + ' Marginal · ' + k.skip_count + ' Skip of ' + D.board_size + ' ranked'),
			kpi('search', 'Top sector multiple', fmtX(topMed.med) + ' TVL', topMed.cat + ' · ' + topMed.n + ' listed peers')
		);
	}
	function toolbar() {
		var search = el('input', { type: 'search', id: 'q', placeholder: 'Search protocol, peer comp, or chain...', value: state.q, 'aria-label': 'Search protocol, peer comp, or chain' });
		search.addEventListener('input', function() {
			state.q = search.value; writeHash(); render();
			var q2 = document.getElementById('q');
			if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
		});
		var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
			el('option', { value: 'all', text: 'All Chains' }),
			chains().map(function(c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
		);
		chainSel.addEventListener('change', function() { state.chain = chainSel.value; writeHash(); render(); });
		var farmBtn = el('button', { type: 'button', class: 'btn toggle' + (state.verdict === 'farm' ? ' on' : ''), 'aria-pressed': state.verdict === 'farm' ? 'true' : 'false', onclick: function() { state.verdict = state.verdict === 'farm' ? 'all' : 'farm'; writeHash(); render(); } }, ic('zap'), el('span', { text: 'Farm Only' }));
		var n = rows().length;
		var count = el('span', { class: 'count', text: filtered() ? 'Showing ' + n + ' matching protocols (filtered from ' + D.board_size + ')' : 'Showing ' + n + ' of ' + D.board_size + ' ranked protocols' });
		var reset = el('button', { type: 'button', class: 'btn', text: 'Reset Filters', onclick: function() { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; state.sort = 'rank'; state.dir = 1; writeHash(); render(); } });
		var cats = categories();
		var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by sector' },
			el('button', { type: 'button', class: 'chip' + (state.category === 'all' ? ' on' : ''), 'aria-pressed': state.category === 'all' ? 'true' : 'false', text: 'All Sectors', onclick: function() { state.category = 'all'; writeHash(); render(); } }),
			cats.map(function(c) {
				return el('button', { type: 'button', class: 'chip' + (state.category === c.name ? ' on' : ''), 'aria-pressed': state.category === c.name ? 'true' : 'false', title: c.n + ' protocols', text: c.name, onclick: function() { state.category = c.name; writeHash(); render(); } });
			})
		);
		return el('div', { class: 'controls' },
			el('div', { class: 'toolbar' },
				el('div', { class: 'search-wrap' }, ic('search'), search),
				chainSel, farmBtn, count, reset
			),
			chips
		);
	}
	function cohort(list) {
		var tvl = list.reduce(function(s, r) { return s + r.tvl_usd; }, 0);
		var imp = list.reduce(function(s, r) { return s + r.implied_value_usd; }, 0);
		var parts = [];
		if (state.category !== 'all') parts.push(state.category);
		if (state.chain !== 'all') parts.push(state.chain);
		if (state.verdict === 'farm') parts.push('Farm only');
		if (state.q) parts.push('Search "' + state.q + '"');
		function card(label, value, subline) {
			return el('div', { class: 'kpi' },
				el('span', { class: 'kpi-label', text: label }),
				el('b', { class: 'num kpi-value', text: value }),
				el('span', { class: 'sub', text: subline })
			);
		}
		return el('section', { class: 'kpis cohort', 'aria-label': 'Filtered cohort summary' },
			card('Cohort combined TVL', fmtUsd(tvl), list.length + ' rows in cohort'),
			card('Cohort implied FDV', fmtUsd(imp), fmtX(tvl ? imp / tvl : 0) + ' weighted TVL multiple'),
			card('Active filter criteria', parts.join(' · ') || 'None', 'Sorted by ' + sortLabel())
		);
	}
	function shead(key, label) {
		var active = state.sort === key;
		var attrs = { scope: 'col', class: 'num' };
		if (active) attrs['aria-sort'] = state.dir < 0 ? 'descending' : 'ascending';
		return el('th', attrs,
			el('button', { type: 'button', onclick: function() { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'rank' || key === 'name' ? 1 : -1; } render(); } },
				label,
				el('span', { 'aria-hidden': 'true', class: 'sort' + (active ? ' on' : ''), text: active ? (state.dir < 0 ? ' ↓' : ' ↑') : ' ↕' })
			)
		);
	}
	function rowAttrs(slug) {
		return {
			tabindex: '0',
			onclick: function(e) { selectRow(slug, e.currentTarget); },
			onkeydown: function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(slug, e.currentTarget); } }
		};
	}
	function boardRows(list, withAction) {
		var tbody = el('tbody');
		list.forEach(function(r) {
			var attrs = rowAttrs(r.slug);
			attrs['data-slug'] = r.slug;
			attrs['data-selected'] = state.selected === r.slug || (!state.selected && r.rank === 1) ? 'true' : 'false';
			var chainLine = (r.chains && r.chains.length ? r.chains[0] : 'Unnamed chain') + (r.chains && r.chains.length > 1 ? ' +' + (r.chains.length - 1) + ' more' : '');
			var cells = [
				el('td', { class: 'num rank', text: String(r.rank).padStart(2, '0') }),
				el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub num', text: fmtX(r.implied_value_usd / r.tvl_usd) + ' TVL multiple' }))),
				el('td', null, el('div', { class: 'name' }, el('span', { text: r.category || 'Other' }), el('span', { class: 'sub', text: chainLine }))),
				cell('num', fmtUsd(r.tvl_usd)),
				el('td', { class: 'num implied', text: fmtUsd(r.implied_value_usd) }),
				el('td', null, el('span', { class: 'verdict ' + r.verdict, text: verdictLabel(r.verdict) }))
			];
			if (withAction) cells.push(el('td', null, el('button', { type: 'button', class: 'btn small', text: 'Inspect', onclick: function(e) { e.stopPropagation(); selectRow(r.slug, e.currentTarget); } })));
			tbody.appendChild(el('tr', attrs, cells));
		});
		return tbody;
	}
	function boardTable() {
		var list = sortedRows(rows());
		var isF = filtered();
		if (list.length === 0) {
			return el('div', { class: 'panel' }, el('div', { class: 'empty' },
				el('h2', { text: 'No protocol matches that filter' }),
				el('p', { text: 'Clear the search or pick another sector to see the board again.' }),
				el('button', { class: 'btn primary', type: 'button', text: 'Clear filters', onclick: function() { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; writeHash(); render(); } })
			));
		}
		var head = el('tr', null,
			shead('rank', '#'),
			shead('name', 'Protocol'),
			th('Sector / Chain'),
			shead('tvl', 'TVL'),
			shead('implied', 'Implied FDV'),
			shead('verdict', 'Farm Status')
		);
		if (isF) head.appendChild(th('Action'));
		return el('div', { class: 'panel board' },
			el('p', { class: 'verdict-key', text: 'Farm: net $' + D.model.farm_per_hour_usd + ' or more per hour. Marginal: $' + D.model.marginal_per_hour_usd + ' to $' + D.model.farm_per_hour_usd + ' per hour. Skip: below $' + D.model.marginal_per_hour_usd + ' per hour.' }),
			el('div', { class: 'table-wrap' },
				el('table', null,
					el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Rank stays by implied value. Select a row to inspect its valuation working and farm plan.' }),
					el('thead', null, head),
					boardRows(list, isF)
				)
			)
		);
	}

	function eqRow(l, v) { return el('div', { class: 'eq-row' }, el('span', { text: l }), el('b', { class: 'num', text: v })); }
	function rail() {
		var row = selectedRow();
		var f = D.fit;
		var drv = largestDriver(row.contributions);
		var drvLabel = drv[0] === 'size' ? 'size (TVL)' : drv[0] === 'growth' ? '7-day growth' : 'category';
		var isSaved = !!saved[row.slug];
		var steps = farmSteps(row);
		var wlBtn = el('button', { id: 'wl-btn', type: 'button', class: 'btn primary block', 'aria-pressed': isSaved ? 'true' : 'false', onclick: function() {
			if (saved[row.slug]) delete saved[row.slug]; else saved[row.slug] = 1;
			saveWL(); writeHash(); render();
			var b = document.getElementById('wl-btn');
			if (b) b.focus();
		} }, ic('bookmark'), el('span', { text: isSaved ? 'Saved in Watchlist' : 'Save to Watchlist' }));
		var comps = el('table', { class: 'mult-table' },
			el('thead', null, el('tr', null, th('Peer protocol'), th('TVL'), th('FDV / TVL'))),
			el('tbody', null, (row.nearest_comps || []).map(function(c) {
				return el('tr', null, cell('', c.name), cell('num', fmtUsd(c.tvl_usd)), cell('num', fmtX(c.multiple)));
			}))
		);
		return el('aside', { class: 'rail', 'aria-label': 'Protocol detail' },
			el('button', { type: 'button', class: 'rail-close', 'aria-label': 'Close details', text: 'Close', onclick: closeDrawer }),
			el('div', { class: 'rail-head' },
				el('h2', { id: 'rail-title', text: row.name }),
				el('span', { class: 'pill rank-pill num', text: '#' + String(row.rank).padStart(2, '0') }),
				el('span', { class: 'verdict ' + row.verdict, text: verdictLabel(row.verdict) })
			),
			sub((row.category || 'Other') + ' · ' + (row.chains && row.chains.length ? row.chains[0] : 'Unnamed chain') + ' · Snapshot TVL ' + fmtUsd(row.tvl_usd)),
			el('div', { class: 'integrity' },
				ic('shield'),
				el('div', null,
					el('b', { text: 'Pre-token by construction' }),
					el('p', { text: 'No live token on record in the ' + asOfLabel() + ' snapshot: no market cap, no CoinGecko id, no symbol. A row on this board records no token in the snapshot, which is not proof it has none.' })
				)
			),
			el('section', { class: 'rail-sec' },
				el('div', { class: 'sec-head' }, h3('Valuation Working'), el('span', { class: 'sub', text: 'Model ' + D.model_version })),
				el('div', { class: 'range3' },
					el('div', { class: 'range-box' }, el('span', { text: 'Low' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) })),
					el('div', { class: 'range-box base' }, el('span', { text: 'Base' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
					el('div', { class: 'range-box' }, el('span', { text: 'High' }), el('b', { class: 'num', text: fmtUsd(row.implied_high_usd) }))
				),
				sub('50% prediction interval: held for ' + Math.round(f.range_holds * 100) + '% of holdout anchors; leave-one-out miss x' + f.loo_miss_factor.toFixed(2) + '. Low and high are one interval, not scenarios.'),
				el('div', { class: 'equation' },
					eqRow('Applied multiple', fmtX(row.implied_value_usd / row.tvl_usd)),
					eqRow('Launch odds', Math.round(row.launch_odds * 100) + '%'),
					eqRow('Expected value', fmtUsd(row.expected_value_usd)),
					eqRow('Rank range, 200 refits', row.rank_p10 + '–' + row.rank_p50 + '–' + row.rank_p90),
					eqRow('Net $/hour, farm plan', '$' + row.net_per_hour_usd.toFixed(2))
				),
				sub('Largest driver: ' + drvLabel + ' (' + fmtLog(drv[1]) + ' in log10 multiple). Fitted log10 multiple ' + fmtLog(row.log_multiple) + ' = ' + fmtLog(row.contributions.intercept) + ' intercept ' + fmtLog(row.contributions.category) + ' category ' + fmtLog(row.contributions.size) + ' size ' + fmtLog(row.contributions.growth) + ' growth.'),
				h3('Nearest priced peers'),
				sub('The five nearest live-token protocols by log10 TVL, same category first. Median neighbour multiple ' + fmtX(row.nearest_median_multiple) + ' against the model\u2019s ' + fmtX(row.predicted_multiple) + ' for this protocol. A cross-check, not a second valuation.'),
				comps
			),
			el('section', { class: 'rail-sec' },
				el('div', { class: 'sec-head' }, h3('Farm Playbook'), el('span', { class: 'sub', text: steps.length + ' steps · $' + row.plan_capital_usd + ' capital · $' + row.plan_gas_usd + ' gas · ' + row.plan_days + ' days' })),
				el('ol', { class: 'steps' }, steps.map(function(s) {
					var at = s.indexOf(' Cost: ');
					var action = at >= 0 ? s.slice(0, at) : s;
					var tail = at >= 0 ? s.slice(at + 1) : '';
					return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
				})),
				sub('Net expected value ' + fmtUsd(row.net_ev_usd) + ' over the plan, after ' + fmtUsd(row.plan_gas_usd) + ' gas and ' + fmtUsd(row.plan_lockup_usd) + ' lock-up cost on ' + fmtUsd(row.plan_capital_usd) + ' of capital. The launch breaks even at ' + (row.break_even_odds * 100).toFixed(2) + '% odds. The 0.5% airdrop share is an assumption. No token is promised, and farming costs real money.'),
				wlBtn
			)
		);
	}
	function closeDrawer() {
		if (!drawerOpen) return;
		drawerOpen = false;
		var railEl = document.querySelector('.rail');
		var scrim = document.querySelector('.scrim');
		if (railEl) { railEl.style.transitionDuration = '150ms'; railEl.classList.remove('open'); setTimeout(function() { railEl.style.transitionDuration = ''; }, 160); }
		if (scrim) scrim.classList.remove('open');
		if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
		else if (lastSlug) {
			var rowEl = document.querySelector('tr[data-slug="' + lastSlug + '"]');
			if (rowEl) rowEl.focus();
		}
		lastTrigger = null;
	}
	function peersView() {
		var meds = sectorMedians().slice().sort(function(a, b) { return b.n - a.n || b.med - a.med; });
		var byAnchor = {};
		D.rows.forEach(function(r) {
			(r.nearest_comps || []).forEach(function(c) { (byAnchor[c.slug] = byAnchor[c.slug] || []).push(r.name); });
		});
		var refs = D.anchors.filter(function(a) { return a.fittable && a.actual_multiple !== null; }).sort(function(a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
		var tbody = el('tbody');
		refs.forEach(function(a) {
			var comps = byAnchor[a.slug] || [];
			tbody.appendChild(el('tr', null,
				el('td', null, el('b', { text: a.name })),
				cell('', a.category || 'Other'),
				cell('num', a.mcap_usd === null ? 'n/a' : fmtUsd(a.mcap_usd)),
				cell('num', fmtUsd(a.tvl_usd)),
				el('td', { class: 'num implied', text: fmtX(a.actual_multiple) }),
				cell('', comps.length ? comps.slice(0, 3).join(', ') + (comps.length > 3 ? ' +' + (comps.length - 3) + ' more' : '') : 'None')
			));
		});
		return el('div', { class: 'page' },
			el('h1', { text: 'Sector Peer Multiples and Calibration' }),
			el('div', { class: 'page-sub' },
				sub('Live FDV/TVL benchmarks from the priced anchors in the DeFiLlama snapshot.'),
				el('span', { class: 'pill', text: 'Model: Held-Out Cross-Validated Comps' })
			),
			el('div', { class: 'peer-grid' }, meds.map(function(m) {
				return el('div', { class: 'kpi peer-card' },
					el('span', { class: 'kpi-label', text: m.cat }),
					el('b', { class: 'num kpi-value', text: fmtX(m.med) + ' TVL' }),
					el('span', { class: 'sub', text: m.n + ' peers · ' + m.top.join(', ') })
				);
			})),
			el('h2', { text: 'Reference Peer Comp Cohort' }),
			sub('Used to price pre-token protocols on the Radar Board. ' + refs.length + ' priced anchors with a market cap and a TVL.'),
			el('div', { class: 'panel' },
				el('div', { class: 'table-wrap' },
					el('table', null,
						el('thead', null, el('tr', null, th('Listed Protocol'), th('Sector'), th('Live FDV'), th('Snapshot TVL'), th('FDV / TVL'), th('Pre-Token Comps Priced'))),
						tbody
					)
				)
			)
		);
	}
	function watchView() {
		var list = D.rows.filter(function(r) { return saved[r.slug]; });
		var totImp = list.reduce(function(s, r) { return s + r.implied_value_usd; }, 0);
		var totCap = list.reduce(function(s, r) { return s + r.plan_capital_usd; }, 0);
		var head = el('div', { class: 'page' },
			el('h1', { text: 'Saved Farm Watchlist' }),
			el('div', { class: 'page-sub' },
				sub(list.length + ' saved protocols, ranked by implied value.'),
				el('span', { class: 'pill', text: 'Total implied FDV ' + fmtUsd(totImp) }),
				el('span', { class: 'pill', text: 'Total plan capital ' + fmtUsd(totCap) })
			),
			sub('Plan capital is the sum of each saved row\u2019s farm-plan capital. No allocation data is tracked.')
		);
		if (list.length === 0) {
			head.appendChild(el('div', { class: 'panel' }, el('div', { class: 'empty' },
				el('h2', { text: 'No protocols saved' }),
				el('p', { text: 'You removed every saved protocol. Restore the 40 from the snapshot to see the watchlist again.' }),
				el('button', { class: 'btn primary', type: 'button', text: 'Restore the 40 saved protocols', onclick: function() { WL_SEED.forEach(function(s) { saved[s] = 1; }); saveWL(); render(); } })
			)));
			return head;
		}
		var tbody = el('tbody');
		list.forEach(function(r) {
			var chainLine = (r.chains && r.chains.length ? r.chains[0] : 'Unnamed chain') + (r.chains && r.chains.length > 1 ? ' +' + (r.chains.length - 1) + ' more' : '');
			tbody.appendChild(el('tr', null,
				el('td', { class: 'num rank', text: String(r.rank).padStart(2, '0') }),
				el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub num', text: fmtX(r.implied_value_usd / r.tvl_usd) + ' TVL multiple' }))),
				el('td', null, el('div', { class: 'name' }, el('span', { text: r.category || 'Other' }), el('span', { class: 'sub', text: chainLine }))),
				cell('num', fmtUsd(r.tvl_usd)),
				el('td', { class: 'num implied', text: fmtUsd(r.implied_value_usd) }),
				el('td', null, el('span', { class: 'verdict ' + r.verdict, text: verdictLabel(r.verdict) })),
				el('td', null, el('button', { type: 'button', class: 'btn small', text: 'Remove', onclick: function() { delete saved[r.slug]; saveWL(); render(); } })),
				el('td', null, el('button', { type: 'button', class: 'btn small primary', text: 'Inspect', onclick: function(e) { state.view = 'board'; state.selected = r.slug; writeHash(); render(); } }))
			));
		});
		head.appendChild(el('div', { class: 'panel' },
			el('div', { class: 'table-wrap' },
				el('table', null,
					el('thead', null, el('tr', null, th('#'), th('Protocol'), th('Sector / Chain'), th('TVL'), th('Implied FDV'), th('Farm Status'), th('Remove'), th('Inspect'))),
					tbody
				)
			)
		));
		return head;
	}
	function modelPanel() {
		var m = D.model;
		var f = D.fit;
		var pl = f.power_law;
		var multRows = Object.keys(D.category_multiples).sort(function(a, b) { return D.category_multiples[b] - D.category_multiples[a]; });
		return el('section', { class: 'panel model', id: 'model' },
			el('p', { class: 'method-link' }, el('a', { href: 'method.md', text: 'Read the full method' })),
			el('h2', { text: 'How this ranking works' }),
			el('p', { class: 'use', text: 'This ranking orders pre-token protocols for farm prioritisation; it is not a price prediction.' }),
			sub('The board scores ' + D.board_size + ' rows: the ' + D.watchlist_size + ' watchlist protocols plus every other pre-token protocol that is a plausible launch candidate. ' + D.anchors_size + ' live-token anchors and ' + D.kpis.set_aside_count + ' set-aside rows account for all ' + D.kpis.coverage_total + ' protocols in the snapshot.'),
			sub('One fitted model scores every row: ordinary least squares on log10(market-cap / TVL) over the ' + f.fit_anchors_n + ' dated anchors. Exchanges, bridges and staked receipts are excluded by the same rule that sets them aside on the board. No name is special-cased.'),
			el('div', { class: 'formula' }, 'implied = round( tvl_usd x clamp(10 ^ (intercept + category + size + growth), ' + fmtX(m.multiple_floor) + ', ' + fmtX(m.multiple_cap) + ') )'),
			sub('As a power law: implied = 10^' + pl.intercept_log.toFixed(2) + ' x TVL^' + pl.tvl_exponent.toFixed(2) + ' x 10^(' + pl.growth_coef.toFixed(2) + ' x growth) x category. Value grows with TVL, but slower than TVL itself, so bigger protocols trade at lower multiples. Growth now helps: among genuine DeFi protocols, growing TVL predicts a higher multiple.'),
			sub('The honest part: the snapshot\u2019s figures predict the multiple only roughly. Leave-one-out miss x' + f.loo_miss_factor.toFixed(2) + ', holdout x' + f.holdout_miss_factor.toFixed(2) + ' on one split and x' + f.holdout_miss_factor_10seed.toFixed(2) + ' over ten seeds (one split is fifteen anchors, so quote the two together), walk-forward x' + f.wf_miss_factor.toFixed(2) + ' (fitted before 2025, tested on 2025+ listings). The 50% range holds for ' + Math.round(f.range_holds * 100) + '% of holdout anchors. A ranking by the best fit the data supports.'),
			sub('Age is not in the multiple on purpose: adding it made the walk-forward miss 12x. Age is used where the data supports it instead: the launch odds below, and the expected value, the implied value times those odds.'),
			h3('Fitted coefficients'),
			sub('Each row is one feature\u2019s weight in log10(multiple). A negative size weight means larger protocols trade at lower multiples.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Feature'), th('Coefficient'))),
				el('tbody', null, f.features.map(function(name, i) {
					return el('tr', null, cell('', f.feature_labels[i]), cell('num', fmtLog(f.coefficients[i])));
				}))
			),
			h3('Validation'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Method'), th('What was held out'), th('Result'), th('What it means'))),
				el('tbody', null, valRows().map(function(v) {
					return el('tr', null, cell('', v[0]), cell('', v[2]), cell('num', v[1]), cell('', v[3]));
				}))
			),
			h3('Limitations'),
			sub('Typical miss runs x' + f.wf_miss_factor.toFixed(2) + ' to x' + f.loo_miss_factor.toFixed(2) + ', so adjacent ranks are within noise. The range holds only ' + Math.round(f.range_holds * 100) + '% of the time, so treat ranges as wide. Launch odds were right ' + Math.round(f.odds_holdout_accuracy * 100) + '% of held-out calls, so roughly one in three would be wrong.'),
			h3('How often protocols this old have a token'),
			sub('Counted from the snapshot. The 6-12 month and 1-2 year bands are pooled at their joint share; the raw shares dip (39.7% then 38.3%) and odds that fall with age are noise. Held out over ten 80/20 splits, the odds predict whether a protocol has a token with ' + Math.round(f.odds_holdout_accuracy * 100) + '% accuracy (base rate ' + Math.round(f.odds_base_rate * 100) + '%), Brier ' + f.odds_holdout_brier.toFixed(3) + '.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Listed'), th('Live'), th('Pre-token'), th('Share with a token'), th('Odds used'))),
				el('tbody', null, (D.launch_shares || []).map(function(s) {
					return el('tr', null, cell('', s.bucket), cell('num', String(s.live)), cell('num', String(s.pre_token)), cell('num', (s.share * 100).toFixed(0) + '%'), cell('num', (s.odds * 100).toFixed(0) + '%'));
				}))
			),
			h3('Expected value'),
			sub('Expected value is the implied value times the launch odds. Rank stays by implied value. The top ten by expected value are below: Polymarket implied #9, expected #3; Lofty implied #35, expected #9.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('By EV'), th('Protocol'), th('Implied rank'), th('Launch odds'), th('Expected value'))),
				el('tbody', null, (D.ev_top10 || []).map(function(r, i) {
					return el('tr', null, cell('num', String(i + 1)), cell('', r.name), cell('num', '#' + r.rank), cell('num', Math.round(r.launch_odds * 100) + '%'), cell('num', fmtUsd(r.expected_value_usd)));
				}))
			),
			h3('Farm verdicts, net of costs'),
			sub('The payoff if the token launches is a typical 0.5% airdrop of the implied value, times the launch odds, minus gas, minus the lock-up cost of the capital at 4% a year. Farm at $' + m.farm_per_hour_usd + ' net/hour or more, marginal $' + m.marginal_per_hour_usd + '–$' + m.farm_per_hour_usd + ', skip below $' + m.marginal_per_hour_usd + '. ' + D.kpis.farmable_count + ' rows are farm, ' + D.kpis.marginal_count + ' marginal, ' + D.kpis.skip_count + ' skip. The 0.5% is an assumption, every row prints its net hourly rate and break-even odds, so the verdict can be re-derived with a different share. A single wallet realistically receives well under 1% of a launch\u2019s fully diluted value; at the 5% used in earlier rounds, nearly every row was farm.'),
			h3('Best farms and the $500 portfolio'),
			sub('The five best farms by net $/hour, and a $' + D.planner.budget_usd + ' portfolio allocated to the best farms in order, each taking its plan\u2019s capital in full. The farms run in parallel, so the portfolio\u2019s rate is the sum of the farms\u2019 net rates: $' + D.planner.total_net_per_hour_usd.toFixed(2) + ' an hour on $' + D.planner.total_capital_usd + ' of capital and $' + D.planner.total_gas_usd + ' of gas.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Farm'), th('Net $/hour'), th('Expected value'), th('Break-even odds'), th('In $500 portfolio'))),
				el('tbody', null, (D.best_farms || []).map(function(bf) {
					var pf = (D.planner.farms || []).filter(function(x) { return x.slug === bf.slug; })[0];
					return el('tr', null, cell('', bf.name), cell('num', '$' + bf.net_per_hour_usd.toFixed(2)), cell('num', fmtUsd(bf.expected_value_usd)), cell('num', (bf.break_even_odds * 100).toFixed(2) + '%'), cell('num', pf ? fmtUsd(pf.capital_usd) : 'n/a'));
				}))
			),
			h3('How stable is a rank'),
			sub('The board is refitted 200 times on resamples of the ' + f.fit_anchors_n + ' fit anchors and re-ranked each time. Each row shows its rank range (10th–90th percentile) beside its rank. The top 3 are tight; ranks 7–10 are wide, and one row in eleven swings across the board.'),
			h3('Sensitivity'),
			sub('The top five implied values with TVL halved or grown 50%, and with seven-day growth halved or grown 50%.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Protocol'), th('Implied'), th('TVL -50%'), th('TVL +50%'), th('Growth -50%'), th('Growth +50%'))),
				el('tbody', null, (D.sensitivity.top5 || []).map(function(s) {
					return el('tr', null, cell('', s.name), cell('num', fmtUsd(s.base_usd)), cell('num', fmtUsd(s.tvl_down_usd)), cell('num', fmtUsd(s.tvl_up_usd)), cell('num', fmtUsd(s.growth_down_usd)), cell('num', fmtUsd(s.growth_up_usd)));
				}))
			),
			h3('Fitted category multiples'),
			sub('Each category\u2019s multiple at the reference protocol: $100M TVL, flat seven days. The global baseline is ' + fmtX(D.global_multiple) + '. The target log-ratio is winsorized to [' + m.winsor_lo + ', ' + m.winsor_hi + '] before fitting.'),
			el('table', { class: 'mult-table' },
				el('thead', null, el('tr', null, th('Category'), th('Fitted mcap / TVL'))),
				el('tbody', null, multRows.map(function(c) {
					return el('tr', null, cell('', c), cell('num', fmtX(D.category_multiples[c])));
				}))
			),
			h3('Set aside, not hidden'),
			sub(D.kpis.set_aside_count + ' pre-token rows are set aside by category, not scored: exchanges (custodial balances), bridges (assets in transit) and staked receipts (a repackaged asset). Every one is listed below with its reason.'),
			el('details', { class: 'set-aside' },
				el('summary', { text: 'Show the ' + D.kpis.set_aside_count + ' set-aside rows' }),
				el('table', { class: 'mult-table' },
					el('thead', null, el('tr', null, th('Protocol'), th('Category'), th('TVL'), th('Reason'))),
					el('tbody', null, (D.set_aside || []).map(function(s) {
						return el('tr', null, cell('', s.name), cell('', s.category || 'Other'), cell('num', fmtUsd(s.tvl_usd)), cell('', s.reason));
					}))
				)
			)
		);
	}
	function render() {
		app.textContent = '';
		var shell = el('div', { class: 'shell' });
		shell.appendChild(header());
		if (state.view === 'peers') {
			shell.appendChild(peersView());
		} else if (state.view === 'watchlist') {
			shell.appendChild(watchView());
		} else {
			shell.appendChild(kpiStrip());
			shell.appendChild(toolbar());
			var list = rows();
			if (filtered()) shell.appendChild(cohort(list));
			var layout = el('div', { class: 'layout' });
			var main = el('div', { class: 'col-main' });
			main.appendChild(el('div', { class: 'board-head' },
				el('h1', { text: 'Pre-Token Launch Board' }),
				el('span', { class: 'sub', text: 'Click any row to inspect valuation working and farm steps' })
			));
			main.appendChild(boardTable());
			layout.appendChild(main);
			layout.appendChild(rail());
			shell.appendChild(layout);
			shell.appendChild(modelPanel());
		}
		app.appendChild(shell);
		app.setAttribute('aria-busy', 'false');
		var railEl = document.querySelector('.rail');
		if (railEl && drawerOpen && window.innerWidth < 1100) {
			railEl.classList.add('open');
			var scrim = document.createElement('div');
			scrim.className = 'scrim open';
			scrim.addEventListener('click', closeDrawer);
			app.appendChild(scrim);
		}
	}
	readHash();
	render();
	window.addEventListener('keydown', function(e) {
		if (e.key === 'Escape' && drawerOpen) closeDrawer();
	});
})();
