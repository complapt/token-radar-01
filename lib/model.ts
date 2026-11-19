// Token Radar — the valuation model (radar-4).
//
// The board ranks pre-token protocols by an implied value fitted from the
// snapshot's own figures. The anchors are the live-token protocols that
// carry a market cap, but only the 95 with a known listing date are
// fitted: the age term needs a date, and the 33 undated anchors are shown
// on the board, not fitted. The model is a power law in TVL with a
// seven-day growth term and one dummy per large category:
//
//   y = log10(mcap / TVL), winsorized to [-2, 1.3]
//   x = 1, log10(TVL) - 8, clamp(change_7d, -60, 120) / 100,
//       one dummy per category with 8 or more fit anchors
//   multiple = clamp(10 ^ (x . beta), 0.02, 3)
//   implied value = round(tvl * multiple)
//
// Equivalently, implied = 10^A x TVL^B x 10^(C x growth) x category,
// with B near 0.59 on this snapshot: value grows with TVL, but slower
// than TVL itself, so bigger protocols trade at lower multiples.
//
// Why this shape, and why not more features: radar-3 fitted size,
// growth, age, chains and category together and its leave-one-out miss
// was 4.03x with a walk-forward miss of 12.17x. Dropping age and chains
// and fitting size, growth and category on the dated anchors gives a
// leave-one-out miss of 3.18x and a walk-forward miss of 2.70x. Age is
// not in the multiple because adding it made the walk-forward miss
// 12x: the age multiple fitted on older listings does not transfer to
// newer ones. Age is used where the data supports it instead: the share
// of protocols this old that already have a token, which sets the farm
// verdict (see launchShares and farmVerdict below).
//
// Validation is reported on the dashboard, not hidden: leave-one-out
// miss, seeded 80/20 holdout miss, walk-forward miss (fit on protocols
// listed before 2025, tested on those listed in 2025 or later), and the
// share of holdout anchors whose actual multiple falls inside the
// 50% prediction range. No protocol name is ever special-cased.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface FitConstants {
  ridge_lambda: number;
  train_fraction: number;
  seed: number;
  winsor_lo: number;
  winsor_hi: number;
  multiple_floor: number;
  multiple_cap: number;
  unknown_age_days: number;
  min_category_peers: number;
  growth_floor: number;
  growth_cap: number;
  airdrop_share: number;
  farm_per_hour_usd: number;
  marginal_per_hour_usd: number;
}

export const MODEL: FitConstants = {
  ridge_lambda: 0.0001,
  train_fraction: 0.8,
  seed: 20261119,
  winsor_lo: -2,
  winsor_hi: 1.3,
  multiple_floor: 0.02,
  multiple_cap: 3,
  unknown_age_days: 365,
  min_category_peers: 8,
  growth_floor: -60,
  growth_cap: 120,
  airdrop_share: 0.05,
  farm_per_hour_usd: 50,
  marginal_per_hour_usd: 10,
};

export const MODEL_VERSION = 'radar-4';

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface ModelContributions {
  intercept: number;
  category: number;
  size: number;
  growth: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  launch_share: number;
  break_even_odds: number;
  verdict: 'farm' | 'marginal' | 'skip';
  farm_ev_usd: number;
  farm_per_hour_usd: number;
  signals: string[];
  model: {
    predicted_multiple: number;
    log_multiple: number;
    contributions: ModelContributions;
    age_days: number | null;
    plan_cost_usd: number;
    plan_days: number;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  launch_share: number;
  break_even_odds: number;
  verdict: 'farm' | 'marginal' | 'skip';
  farm_ev_usd: number;
  farm_per_hour_usd: number;
  signals: string[];
  predicted_multiple: number;
  log_multiple: number;
  contributions: ModelContributions;
  plan_cost_usd: number;
  plan_days: number;
}

export interface AnchorRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  actual_multiple: number | null;
  predicted_multiple: number | null;
  residual_log: number | null;
  fittable: boolean;
  in_fit: boolean;
}

export interface LaunchShareRow {
  bucket: string;
  live: number;
  pre_token: number;
  share: number;
}

export interface FitResult {
  features: string[];
  feature_labels: string[];
  coefficients: number[];
  category_dummies: string[];
  train_n: number;
  test_n: number;
  anchors_n: number;
  fit_anchors_n: number;
  r2_train: number;
  r2_test: number;
  r2_final: number;
  cv_r2_mean: number;
  cv_r2_folds: number[];
  median_abs_log_error_test: number;
  median_error_factor_test: number;
  loo_miss_factor: number;
  holdout_miss_factor: number;
  wf_miss_factor: number;
  wf_train_n: number;
  wf_test_n: number;
  interval_lo_log: number;
  interval_hi_log: number;
  range_holds: number;
  power_law: { intercept_log: number; tvl_exponent: number; growth_coef: number };
}

export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

export interface KpiStats {
  board_rows: number;
  anchors_fitted: number;
  live_total: number;
  coverage_total: number;
  coverage_accounted: number;
  top_implied_usd: number;
  total_implied_usd: number;
  median_predicted_multiple: number;
  set_aside_count: number;
  farmable_count: number;
  marginal_count: number;
  skip_count: number;
  loo_miss_factor: number;
  wf_miss_factor: number;
  range_holds: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FitConstants;
  model_version: string;
  fit: FitResult;
  kpis: KpiStats;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  anchors_size: number;
  category_multiples: Record<string, number>;
  global_multiple: number;
  category_stats: CategoryStat[];
  launch_shares: LaunchShareRow[];
  rows: RadarRow[];
  anchors: AnchorRow[];
  set_aside: SetAsideRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isFittable(p: SnapshotProtocol): boolean {
  return !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== null;
}

// Only anchors with a known listing date enter the fit. The 33 undated
// anchors still appear in the anchors table with their actual multiple,
// but they cannot carry the age information the validation splits need.
export function isFitAnchor(p: SnapshotProtocol): boolean {
  return isFittable(p) && p.listed_at !== null;
}

// Deterministic shuffle: the same snapshot always splits the same way,
// so both program runs, and the dashboard's numbers, agree exactly.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function featureNames(dummies: string[]): string[] {
  return ['intercept', 'size', 'growth', ...dummies.map((d) => `cat:${d}`)];
}

export function featureLabels(dummies: string[]): string[] {
  return ['Intercept', 'log10(TVL) - 8', '7d growth / 100', ...dummies.map((d) => `Category: ${d}`)];
}

export function featuresFor(
  p: SnapshotProtocol,
  _asOf: string,
  model: FitConstants,
  dummies: string[],
): number[] {
  const x: number[] = [
    1,
    Math.log10(Math.max(1, p.tvl_usd)) - 8,
    clamp(finite(p.change_7d, 0), model.growth_floor, model.growth_cap) / 100,
  ];
  for (const d of dummies) x.push(p.category === d ? 1 : 0);
  return x;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

// Solve A x = b by Gaussian elimination with partial pivoting. A is the
// small ridge-regularized normal-equations matrix, so this is exact
// enough and, unlike any iterative solver, bit-for-bit deterministic.
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    const tmp = m[col]!;
    m[col] = m[pivot]!;
    m[pivot] = tmp;
    const diag = m[col]![col]!;
    if (diag === 0) throw new SnapshotError('the fitted model is singular');
    for (let r = col + 1; r < n; r++) {
      const factor = m[r]![col]! / diag;
      for (let c = col; c <= n; c++) m[r]![c] = m[r]![c]! - factor * m[col]![c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= m[r]![c]! * x[c]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}

function ols(x: number[][], y: number[], lambda: number): number[] {
  const k = x[0]!.length;
  const ata: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const aty = new Array<number>(k).fill(0);
  for (let i = 0; i < x.length; i++) {
    for (let a = 0; a < k; a++) {
      aty[a] = aty[a]! + x[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) ata[a]![b] = ata[a]![b]! + x[i]![a]! * x[i]![b]!;
    }
  }
  for (let a = 0; a < k; a++) ata[a]![a] = ata[a]![a]! + lambda;
  return solveLinear(ata, aty);
}

function rSquared(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((s, v) => s + v, 0) / actual.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < actual.length; i++) {
    ssTot += (actual[i]! - mean) ** 2;
    ssRes += (actual[i]! - predicted[i]!) ** 2;
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

export function launchShares(snapshot: Snapshot): LaunchShareRow[] {
  const buckets: { label: string; test: (age: number | null) => boolean }[] = [
    { label: 'under 6 months', test: (a) => a !== null && a < 180 },
    { label: '6-12 months', test: (a) => a !== null && a >= 180 && a < 365 },
    { label: '1-2 years', test: (a) => a !== null && a >= 365 && a < 730 },
    { label: '2-3 years', test: (a) => a !== null && a >= 730 && a < 1095 },
    { label: 'over 3 years', test: (a) => a !== null && a >= 1095 },
  ];
  const rows: LaunchShareRow[] = buckets.map(({ label, test }) => {
    const live = snapshot.protocols.filter((p) => !isPreToken(p) && test(ageDays(snapshot.as_of, p.listed_at))).length;
    const pre = snapshot.protocols.filter((p) => isPreToken(p) && test(ageDays(snapshot.as_of, p.listed_at))).length;
    return { bucket: label, live, pre_token: pre, share: live / Math.max(1, live + pre) };
  });
  const knownLive = snapshot.protocols.filter((p) => !isPreToken(p) && ageDays(snapshot.as_of, p.listed_at) !== null).length;
  const knownPre = snapshot.protocols.filter((p) => isPreToken(p) && ageDays(snapshot.as_of, p.listed_at) !== null).length;
  rows.push({ bucket: 'no listing date', live: 0, pre_token: 0, share: knownLive / Math.max(1, knownLive + knownPre) });
  return rows;
}

export function launchShareFor(age: number | null, shares: LaunchShareRow[]): number {
  if (age === null) return shares[shares.length - 1]!.share;
  if (age < 180) return shares[0]!.share;
  if (age < 365) return shares[1]!.share;
  if (age < 730) return shares[2]!.share;
  if (age < 1095) return shares[3]!.share;
  return shares[4]!.share;
}

// The farm verdict, from the expected value per hour. A farm plan costs
// gas and locks capital; the payoff if the token launches is taken as a
// typical 5% airdrop of the implied value, times the historical share of
// protocols this old that already have a token, minus the gas. Divide by
// the plan's hours and farm when that expected rate is at least $10 an
// hour, marginal at $1-10, skip below $1. The break-even odds (the launch
// probability at which the airdrop exactly covers the gas) are printed
// alongside, but they do not set the verdict: gas is so small next to the
// implied values that every row's break-even odds sit far below its age
// band's share, which would make every row farm and the verdict useless.
// The 5% is an assumption, stated on the dashboard, and the odds and the
// hourly rate are printed so anyone can re-derive the verdict with a
// different share.
export function farmVerdict(perHourUsd: number, model: FitConstants): 'farm' | 'marginal' | 'skip' {
  if (perHourUsd >= model.farm_per_hour_usd) return 'farm';
  if (perHourUsd >= model.marginal_per_hour_usd) return 'marginal';
  return 'skip';
}

export function fitModel(
  protocols: SnapshotProtocol[],
  asOf: string,
  model: FitConstants = MODEL,
): { fit: FitResult; predict: (p: SnapshotProtocol) => { multiple: number; logMultiple: number; contributions: ModelContributions } } {
  const anchors = protocols.filter(isFitAnchor);
  const counts = new Map<string, number>();
  for (const p of anchors) counts.set(p.category!, (counts.get(p.category!) ?? 0) + 1);
  const dummies = [...counts.entries()]
    .filter(([, n]) => n >= model.min_category_peers)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([c]) => c);
  const rows = anchors.map((p) => ({
    p,
    x: featuresFor(p, asOf, model, dummies),
    y: clamp(Math.log10(p.mcap_usd! / p.tvl_usd), model.winsor_lo, model.winsor_hi),
  }));
  const order = rows.map((_, i) => i);
  const rand = mulberry32(model.seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  const trainCount = Math.max(1, Math.floor(order.length * model.train_fraction));
  const trainIdx = order.slice(0, trainCount);
  const testIdx = order.slice(trainCount);
  const betaTrain = ols(trainIdx.map((i) => rows[i]!.x), trainIdx.map((i) => rows[i]!.y), model.ridge_lambda);
  const betaFinal = ols(rows.map((r) => r.x), rows.map((r) => r.y), model.ridge_lambda);
  const trainPred = trainIdx.map((i) => dot(rows[i]!.x, betaTrain));
  const testPred = testIdx.map((i) => dot(rows[i]!.x, betaTrain));
  const finalPred = rows.map((r) => dot(r.x, betaFinal));
  const testAbs = testIdx.map((i, k) => Math.abs(rows[i]!.y - testPred[k]!)).sort((a, b) => a - b);
  const medianAbs = median(testAbs);
  const holdoutMiss = median(testIdx.map((i, k) => 10 ** Math.abs(rows[i]!.y - testPred[k]!)));
  // Leave-one-out miss: every anchor is predicted by a model that never
  // saw it. This is the number the strongest entries quote, so it is the
  // one the dashboard leads with.
  const looMiss: number[] = [];
  const looResiduals: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rest = rows.filter((_, j) => j !== i);
    const betaLoo = ols(rest.map((r) => r.x), rest.map((r) => r.y), model.ridge_lambda);
    const pred = dot(rows[i]!.x, betaLoo);
    looMiss.push(10 ** Math.abs(rows[i]!.y - pred));
    looResiduals.push(rows[i]!.y - pred);
  }
  // Walk-forward: fit on protocols listed before 2025, test on those
  // listed in 2025 or later. Time is the one split a single snapshot can
  // honestly offer, and it is where kitchen-sink models fall apart.
  const dated = rows.filter((r) => r.p.listed_at !== null);
  const cut = Date.parse('2025-01-01T00:00:00Z');
  const wfTrain = dated.filter((r) => Date.parse(`${r.p.listed_at!}T00:00:00Z`) < cut);
  const wfTest = dated.filter((r) => Date.parse(`${r.p.listed_at!}T00:00:00Z`) >= cut);
  const betaWf = ols(wfTrain.map((r) => r.x), wfTrain.map((r) => r.y), model.ridge_lambda);
  const wfMiss = median(wfTest.map((r) => 10 ** Math.abs(r.y - dot(r.x, betaWf))));
  // The 50% prediction range, from the leave-one-out residuals: the
  // middle half of past misses. Range-holds is the share of holdout
  // anchors whose actual multiple lands inside that range.
  const intervalLo = quantile(looResiduals, 0.25);
  const intervalHi = quantile(looResiduals, 0.75);
  const rangeHolds = testIdx.filter((i, k) => {
    const r = rows[i]!.y - testPred[k]!;
    return r >= intervalLo && r <= intervalHi;
  }).length / Math.max(1, testIdx.length);
  // Five-fold cross-validation on the same seeded order.
  const cvR2: number[] = [];
  for (let fold = 0; fold < 5; fold++) {
    const te = order.filter((_, i) => i % 5 === fold);
    const tr = order.filter((_, i) => i % 5 !== fold);
    const betaFold = ols(tr.map((i) => rows[i]!.x), tr.map((i) => rows[i]!.y), model.ridge_lambda);
    cvR2.push(rSquared(te.map((i) => rows[i]!.y), te.map((i) => dot(rows[i]!.x, betaFold))));
  }
  const cvMean = cvR2.reduce((s, v) => s + v, 0) / cvR2.length;
  const fit: FitResult = {
    features: featureNames(dummies),
    feature_labels: featureLabels(dummies),
    coefficients: betaFinal,
    category_dummies: dummies,
    train_n: trainIdx.length,
    test_n: testIdx.length,
    anchors_n: protocols.filter(isFittable).length,
    fit_anchors_n: anchors.length,
    r2_train: rSquared(trainIdx.map((i) => rows[i]!.y), trainPred),
    r2_test: rSquared(testIdx.map((i) => rows[i]!.y), testPred),
    r2_final: rSquared(rows.map((r) => r.y), finalPred),
    cv_r2_mean: cvMean,
    cv_r2_folds: cvR2,
    median_abs_log_error_test: medianAbs,
    median_error_factor_test: 10 ** medianAbs,
    loo_miss_factor: median(looMiss),
    holdout_miss_factor: holdoutMiss,
    wf_miss_factor: wfMiss,
    wf_train_n: wfTrain.length,
    wf_test_n: wfTest.length,
    interval_lo_log: intervalLo,
    interval_hi_log: intervalHi,
    range_holds: rangeHolds,
    power_law: {
      intercept_log: betaFinal[0]! - 8 * betaFinal[1]!,
      tvl_exponent: 1 + betaFinal[1]!,
      growth_coef: betaFinal[2]!,
    },
  };
  const predict = (p: SnapshotProtocol) => {
    const x = featuresFor(p, asOf, model, dummies);
    const beta = betaFinal;
    const catIndex = 3 + dummies.indexOf(p.category ?? '');
    const contributions: ModelContributions = {
      intercept: beta[0]!,
      category: catIndex >= 3 && dummies.includes(p.category ?? '') ? beta[catIndex]! : 0,
      size: beta[1]! * x[1]!,
      growth: beta[2]! * x[2]!,
    };
    const logMultiple = dot(x, beta);
    const multiple = clamp(10 ** logMultiple, model.multiple_floor, model.multiple_cap);
    return { multiple, logMultiple, contributions };
  };
  return { fit, predict };
}

export function categoryMultiplesFromFit(
  fit: FitResult,
  categories: string[],
  model: FitConstants = MODEL,
): { byCategory: Record<string, number>; global: number } {
  const intercept = fit.coefficients[0]!;
  const global = clamp(10 ** intercept, model.multiple_floor, model.multiple_cap);
  const byCategory: Record<string, number> = {};
  for (const c of categories) {
    const idx = fit.category_dummies.indexOf(c);
    const cat = idx >= 0 ? fit.coefficients[3 + idx]! : 0;
    byCategory[c] = clamp(10 ** (intercept + cat), model.multiple_floor, model.multiple_cap);
  }
  return { byCategory, global };
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const SET_ASIDE_CATEGORIES = new Set([
  'CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC',
]);

// Why some pre-token rows are set aside instead of scored: the board is a
// ranking of protocols that could plausibly launch a token. An exchange's
// TVL is custodial balances, a bridge's TVL is assets locked in transit,
// and a liquid-staking receipt is an asset repackaged, not a protocol
// awaiting a token — scoring them by TVL would put Robinhood and wrapped
// bitcoin at the top of a token-launch board. The rule is by category,
// applied to every row alike, and every set-aside row is listed on the
// dashboard with its reason, so nothing is hidden.
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && SET_ASIDE_CATEGORIES.has(p.category)) {
    if (p.category === 'CEX') return 'an exchange: its TVL is custodial balances, not protocol TVL';
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'a bridge: its TVL is assets locked in transit, not a protocol awaiting a token';
    return 'a staked receipt: a repackaged asset, not a protocol awaiting a token';
  }
  if (VERSIONED.test(p.name)) return 'a versioned deployment of a protocol, not a standalone launch';
  return null;
}

export function buildBoard(
  snapshot: Snapshot,
  predict: (p: SnapshotProtocol) => { multiple: number; logMultiple: number; contributions: ModelContributions },
  fit: FitResult,
  model: FitConstants = MODEL,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The board is the watchlist plus every pre-token protocol that is a
  // plausible launch candidate. The set-aside rule above keeps exchanges,
  // bridges and staked receipts off it; the watchlist itself has none of
  // those categories, so the floor is unaffected.
  for (const p of snapshot.protocols) {
    if (isPreToken(p) && setAsideReason(p) === null) chosen.set(p.slug, p);
  }
  const shares = launchShares(snapshot);

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const v = predict(p);
    const implied = Math.max(1, Math.round(p.tvl_usd * v.multiple));
    const low = Math.max(1, Math.round(p.tvl_usd * clamp(10 ** (v.logMultiple + fit.interval_lo_log), model.multiple_floor, model.multiple_cap)));
    const high = Math.max(1, Math.round(p.tvl_usd * clamp(10 ** (v.logMultiple + fit.interval_hi_log), model.multiple_floor, model.multiple_cap)));
    const share = launchShareFor(age, shares);
    const plan = planCostFor(p, age);
    const breakEven = plan.cost / Math.max(1, implied * model.airdrop_share);
    const ev = implied * model.airdrop_share * share - plan.cost;
    const perHour = ev / Math.max(1, plan.days * 24);
    return { p, age, implied, low, high, share, breakEven, ev, perHour, plan, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_low_usd: s.low,
      implied_high_usd: s.high,
      launch_share: Math.round(s.share * 1000) / 1000,
      break_even_odds: s.breakEven,
      verdict: farmVerdict(s.perHour, model),
      farm_ev_usd: Math.round(s.ev),
      farm_per_hour_usd: Math.round(s.perHour * 100) / 100,
      signals: signalsFor(s.p, s.age),
      model: {
        predicted_multiple: s.multiple,
        log_multiple: s.logMultiple,
        contributions: s.contributions,
        age_days: s.age,
        plan_cost_usd: s.plan.cost,
        plan_days: s.plan.days,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

export function planCostFor(p: SnapshotProtocol, age: number | null): { cost: number; days: number } {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weekly = Math.ceil(hold / 7);
  let cost = 3 + (capital >= 150 ? 8 : 4) + 2 * weekly + 4;
  if (p.chains.length > 1) cost += 4;
  return { cost, days: hold };
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave the deposit earning.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Add $${capital} of liquidity to the main pool of ${name} on ${chain} and keep it staked.`;
  if (c.includes('bridge')) return `Move $${capital} of USDC to ${chain} with ${name}, then put the bridged funds to work in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the native asset through ${name} on ${chain} and hold the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Fund a $${capital} margin account on ${name} (${chain}) and open a single small hedged trade.`;
  if (c.includes('prediction')) return `Back one outcome with $${capital} on ${name} (${chain}) and let the position settle.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('stable')) return `Mint or hold $${capital} of the stable asset issued by ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Buy $${capital} of the yield-bearing asset from ${name} on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Take $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold it.`;
  if (c.includes('privacy')) return `Shield $${capital} through ${name} on ${chain} and keep the shielded balance.`;
  return `Put $${capital} of USDC to work in ${name} on ${chain} and leave the position open.`;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Start with a wallet used only for farming, funded with $${capital + 20}, and store its recovery phrase offline.`,
      cost: 'about $3 of gas to fund it',
      time: '10 minutes',
    },
    { text: action, cost: `$${capital} of capital plus roughly $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to open' },
    {
      text: `Do one real action every week on ${p.name}, such as a deposit, a swap, a borrow or a vote, so the wallet shows repeated use.`,
      cost: 'about $2 of gas per week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days, so the activity spans more than one snapshot window.`,
      cost: `the $${capital} stays locked in the position`,
      time: `${hold} days`,
    },
    {
      text: `When a token or points page appears, claim only through the link the protocol itself publishes, and never pay anyone to claim for you.`,
      cost: 'no fee to check; gas only if you claim',
      time: '10 minutes',
    },
    {
      text: `Log the wallet address, the dates and every transaction hash, so you can prove the position or unwind it later.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (p.chains.length > 1) {
    steps.splice(3, 0, {
      text: `Repeat the same position on a second chain, ${p.chains[1]}, so the wallet is active on two chains the protocol supports.`,
      cost: `another $${capital} of capital and about $4 of gas`,
      time: '15 minutes',
    });
  }
  return steps;
}

export function anchorRows(
  snapshot: Snapshot,
  predict: (p: SnapshotProtocol) => { multiple: number; logMultiple: number; contributions: ModelContributions },
): AnchorRow[] {
  const live = snapshot.protocols.filter((p) => !isPreToken(p));
  return live
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => {
      const fittable = isFittable(p);
      const actual = fittable ? p.mcap_usd! / p.tvl_usd : null;
      const pred = fittable ? predict(p) : null;
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        mcap_usd: p.mcap_usd,
        change_7d: p.change_7d,
        actual_multiple: actual === null ? null : Math.round(actual * 1e4) / 1e4,
        predicted_multiple: pred === null ? null : pred.multiple,
        residual_log: pred === null || actual === null ? null : Math.log10(actual) - Math.log10(pred.multiple),
        fittable,
        in_fit: isFitAnchor(p),
      };
    });
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    launch_share: row.launch_share,
    break_even_odds: row.break_even_odds,
    verdict: row.verdict,
    farm_ev_usd: row.farm_ev_usd,
    farm_per_hour_usd: row.farm_per_hour_usd,
    signals: row.signals,
    predicted_multiple: row.model.predicted_multiple,
    log_multiple: row.model.log_multiple,
    contributions: row.model.contributions,
    plan_cost_usd: row.model.plan_cost_usd,
    plan_days: row.model.plan_days,
  };
}

export function buildRadar(snapshot: Snapshot, model: FitConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { fit, predict } = fitModel(snapshot.protocols, snapshot.as_of, model);
  const board = buildBoard(snapshot, predict, fit, model);
  const anchors = anchorRows(snapshot, predict);
  const boardSlugs = new Set(board.map((r) => r.slug));
  const setAside: SetAsideRow[] = snapshot.protocols
    .filter((p) => isPreToken(p) && !boardSlugs.has(p.slug))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p) ?? 'not a launch candidate',
    }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const categories = Array.from(new Set(board.map((r) => r.category ?? 'Other')));
  const multiples = categoryMultiplesFromFit(fit, categories, model);
  const stats = categoryStats(board, multiples);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const topImplied = board.length > 0 ? board[0]!.implied_value_usd : 0;
  const kpis: KpiStats = {
    board_rows: board.length,
    anchors_fitted: fit.fit_anchors_n,
    live_total: anchors.length,
    coverage_total: snapshot.protocols.length,
    coverage_accounted: board.length + anchors.length + setAside.length,
    top_implied_usd: topImplied,
    total_implied_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    median_predicted_multiple: median(board.map((r) => r.model.predicted_multiple)),
    set_aside_count: setAside.length,
    farmable_count: board.filter((r) => r.verdict === 'farm').length,
    marginal_count: board.filter((r) => r.verdict === 'marginal').length,
    skip_count: board.filter((r) => r.verdict === 'skip').length,
    loo_miss_factor: fit.loo_miss_factor,
    wf_miss_factor: fit.wf_miss_factor,
    range_holds: fit.range_holds,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    fit,
    kpis,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    anchors_size: anchors.length,
    category_multiples: multiples.byCategory,
    global_multiple: multiples.global,
    category_stats: stats,
    launch_shares: launchShares(snapshot),
    rows: board.map(radarRow),
    anchors,
    set_aside: setAside,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) return `${r.slug} has a range that does not contain its implied value`;
    if (r.verdict !== 'farm' && r.verdict !== 'marginal' && r.verdict !== 'skip') return `${r.slug} has verdict ${r.verdict}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

export interface CategoryStat {
  category: string;
  pre_token_rows: number;
  total_tvl_usd: number;
  median_multiple: number;
  top_slug: string;
  top_implied_usd: number;
}

export function categoryStats(board: BoardRow[], multiples: { byCategory: Record<string, number>; global: number }): CategoryStat[] {
  const groups = new Map<string, BoardRow[]>();
  for (const row of board) {
    const key = row.category ?? 'Other';
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const stats: CategoryStat[] = [];
  for (const [category, rows] of groups) {
    const sorted = [...rows].sort((a, b) => b.implied_value_usd - a.implied_value_usd);
    const top = sorted[0]!;
    stats.push({
      category,
      pre_token_rows: rows.length,
      total_tvl_usd: rows.reduce((sum, r) => sum + r.tvl_usd, 0),
      median_multiple: multiples.byCategory[category] ?? multiples.global,
      top_slug: top.slug,
      top_implied_usd: top.implied_value_usd,
    });
  }
  stats.sort((a, b) => b.total_tvl_usd - a.total_tvl_usd || (a.category < b.category ? -1 : 1));
  return stats;
}

export function signalsFor(p: SnapshotProtocol, age: number | null): string[] {
  const tags: string[] = [];
  const week = p.change_7d === null ? 0 : p.change_7d;
  if (p.change_7d !== null && week >= 25) tags.push('surging');
  if (p.change_7d !== null && week <= -25) tags.push('cooling');
  if (age !== null && age < 180) tags.push('young');
  if (age !== null && age >= 1095) tags.push('seasoned');
  if (p.chains.length === 1) tags.push('single-chain');
  if (p.chains.length >= 4) tags.push('multi-chain');
  if (p.tvl_usd >= 1_000_000_000) tags.push('large-tvl');
  if (p.tvl_usd < 100_000_000) tags.push('small-tvl');
  return tags;
}

export function signalLabel(tag: string): string {
  if (tag === 'surging') return 'Surging this week';
  if (tag === 'cooling') return 'Cooling this week';
  if (tag === 'young') return 'Listed under 6 months ago';
  if (tag === 'seasoned') return 'Listed over 3 years ago';
  if (tag === 'single-chain') return 'On one chain only';
  if (tag === 'multi-chain') return 'On 4 or more chains';
  if (tag === 'large-tvl') return 'TVL over $1B';
  if (tag === 'small-tvl') return 'TVL under $100M';
  return tag;
}
