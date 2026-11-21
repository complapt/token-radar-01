// Token Radar — the valuation model (radar-5).
//
// The board ranks pre-token protocols by an implied value fitted from the
// snapshot's own figures. The anchors are the live-token protocols that
// carry a market cap, but only the 71 with a known listing date and a
// priceable category are fitted: the 24 dated anchors that are exchanges,
// bridges or staked receipts are excluded from the fit too, by the same
// rule that sets those categories aside on the board. Their raw
// log10(mcap / TVL) values run mostly deeply negative (-0.5 to -2.40,
// custodial balances and assets in transit are not protocol value) with
// one wild outlier, and fitting on them poisoned the fit for genuine
// DeFi protocols. The model is a power law in TVL with a seven-day
// growth term and one dummy per large category:
//
//   y = log10(mcap / TVL), winsorized to [-2, 1.0]
//   x = 1, log10(TVL) - 8, clamp(change_7d, -60, 120) / 100,
//       one dummy per category with 8 or more fit anchors
//   multiple = clamp(10 ^ (x . beta), 0.02, 3)
//   implied value = round(tvl * multiple)
//
// Equivalently, implied = 10^A x TVL^B x 10^(C x growth) x category,
// with B near 0.36 on this snapshot: value grows with TVL, but slower
// than TVL itself, so bigger protocols trade at lower multiples.
//
// Why this shape, and why not more features: radar-4 fitted size,
// growth and category on 95 dated anchors including exchanges and
// bridges, and its leave-one-out miss was 3.18x with a walk-forward
// miss of 2.67x and a 50% range that held for 37% of holdout anchors.
// Fitting the same spec on the 71 clean anchors gives a leave-one-out
// miss of 2.85x, a walk-forward miss of 1.97x and a range that holds
// for 53%. The growth coefficient flips positive (+0.34): among genuine
// DeFi protocols, growing TVL predicts a higher multiple. The winsor
// cap is 1.0 (a multiple of 10x), not 1.3: the handful of anchors
// above 5x, up to a 400x Prediction Market outlier, pull the fit toward
// themselves, and trimming them to 10x improves the leave-one-out,
// holdout and walk-forward misses together (2.92x/2.57x/2.03x at 1.3).
// Age is not in the multiple because adding it made the walk-forward
// miss 12x: the age multiple fitted on older listings does not
// transfer to newer ones. A maturity multiplier by age band (median
// residual per band, shrunk toward 1.0) was tested the same way and
// rejected too: it worsened the leave-one-out miss (2.85x to 3.17x)
// and left walk-forward unchanged — the young bands hold only 3 and 7
// anchors, so their residuals are a few high-multiple protocols, not
// an age effect. Age is used where the data supports it
// instead: the share of protocols this old that already have a token,
// which is the launch odds, and the expected value is the implied
// value times those odds (see launchShares and expectedValue below).
//
// Validation is reported on the dashboard, not hidden: leave-one-out
// miss, seeded 80/20 holdout miss (the single split and the mean over
// 10 seeds, quoted together), walk-forward miss (fit on protocols
// listed before 2025, tested on those listed in 2025 or later), the
// share of holdout anchors whose actual multiple falls inside the
// 50% prediction range, and the launch odds' own held-out accuracy
// and Brier score. No protocol name is ever special-cased.

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
  t_bill_rate: number;
  planner_budget_usd: number;
  bootstrap_refits: number;
}

export const MODEL: FitConstants = {
  ridge_lambda: 0.0001,
  train_fraction: 0.8,
  seed: 20261119,
  winsor_lo: -2,
  winsor_hi: 1.0,
  multiple_floor: 0.02,
  multiple_cap: 3,
  unknown_age_days: 365,
  min_category_peers: 8,
  growth_floor: -60,
  growth_cap: 120,
  airdrop_share: 0.005,
  farm_per_hour_usd: 50,
  marginal_per_hour_usd: 10,
  t_bill_rate: 0.04,
  planner_budget_usd: 500,
  bootstrap_refits: 200,
};

export const MODEL_VERSION = 'radar-14';

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
  launch_odds: number;
  expected_value_usd: number;
  break_even_odds: number;
  verdict: 'farm' | 'marginal' | 'skip';
  farm_ev_usd: number;
  farm_per_hour_usd: number;
  net_ev_usd: number;
  net_per_hour_usd: number;
  plan_gas_usd: number;
  plan_lockup_usd: number;
  plan_capital_usd: number;
  rank_p10: number;
  rank_p50: number;
  rank_p90: number;
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
  launch_odds: number;
  expected_value_usd: number;
  break_even_odds: number;
  verdict: 'farm' | 'marginal' | 'skip';
  farm_ev_usd: number;
  farm_per_hour_usd: number;
  net_ev_usd: number;
  net_per_hour_usd: number;
  plan_gas_usd: number;
  plan_lockup_usd: number;
  plan_capital_usd: number;
  rank_p10: number;
  rank_p50: number;
  rank_p90: number;
  signals: string[];
  predicted_multiple: number;
  log_multiple: number;
  contributions: ModelContributions;
  plan_cost_usd: number;
  plan_days: number;
  nearest_comps: NearestComp[];
  nearest_median_multiple: number | null;
}

export interface NearestComp {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
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
  fit_status: 'fitted' | 'no-date' | 'set-aside' | 'unpriced';
}

export interface LaunchShareRow {
  bucket: string;
  live: number;
  pre_token: number;
  share: number;
  odds: number;
}

export interface EvTopRow {
  rank: number;
  slug: string;
  name: string;
  implied_value_usd: number;
  launch_odds: number;
  expected_value_usd: number;
}

export interface PlannerFarm {
  slug: string;
  name: string;
  capital_usd: number;
  gas_usd: number;
  lockup_usd: number;
  net_per_hour_usd: number;
  expected_value_usd: number;
  break_even_odds: number;
}

export interface Planner {
  budget_usd: number;
  farms: PlannerFarm[];
  total_capital_usd: number;
  total_gas_usd: number;
  total_net_per_hour_usd: number;
}

export interface SensitivityRow {
  slug: string;
  name: string;
  base_usd: number;
  tvl_down_usd: number;
  tvl_up_usd: number;
  growth_down_usd: number;
  growth_up_usd: number;
}

export interface Sensitivity {
  top5: SensitivityRow[];
  airdrop_leaders: { share: number; leaders: { slug: string; name: string; net_per_hour_usd: number }[] }[];
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
  holdout_miss_factor_10seed: number;
  holdout_miss_factor_10seed_median: number;
  wf_miss_factor: number;
  wf_train_n: number;
  wf_test_n: number;
  interval_lo_log: number;
  interval_hi_log: number;
  range_holds: number;
  odds_holdout_accuracy: number;
  odds_holdout_brier: number;
  odds_base_rate: number;
  odds_holdout_n: number;
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

export interface BestFarmRow {
  slug: string;
  name: string;
  net_per_hour_usd: number;
  expected_value_usd: number;
  launch_odds: number;
  break_even_odds: number;
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
  ev_top10: EvTopRow[];
  best_farms: BestFarmRow[];
  planner: Planner;
  sensitivity: Sensitivity;
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

// The categories set aside from the board and from the fit: exchanges,
// bridges and staked receipts. One rule, applied to every row alike.
const SET_ASIDE_CATEGORIES = new Set([
  'CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC',
]);

export function isFittable(p: SnapshotProtocol): boolean {
  return !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== null;
}

// Only anchors with a known listing date enter the fit. The 33 undated
// anchors still appear in the anchors table with their actual multiple,
// but they cannot carry the age information the validation splits need.
// And only anchors in a priceable category enter it: the dated anchors
// that are exchanges, bridges or staked receipts are excluded by the
// same rule that sets those categories aside on the board, because
// custodial balances and assets in transit are not protocol value and
// their multiples poison the fit for genuine DeFi protocols.
export function isFitAnchor(p: SnapshotProtocol): boolean {
  return isFittable(p) && p.listed_at !== null && !SET_ASIDE_CATEGORIES.has(p.category!);
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

// The launch odds: the share of protocols in each age band that already
// carry a token, counted from the snapshot itself. `share` is the raw
// count; `odds` is the number the board uses, and it is monotonized:
// the 6-12 month and 1-2 year bands are pooled at their joint share
// (38.9%) because their raw shares dip (39.7% then 38.3%), and a
// launch-odds curve that falls with age is noise, not signal. The
// no-listing-date row counts the protocols with no date (89 live of
// 113), not the overall share. The odds are a stock, not a forecast:
// the share that has launched so far, used as the reference odds for
// the expected value and the farm verdict.
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
    const share = live / Math.max(1, live + pre);
    return { bucket: label, live, pre_token: pre, share, odds: share };
  });
  // Monotonize the 6-12 month and 1-2 year bands at their pooled share.
  const pooledLive = rows[1]!.live + rows[2]!.live;
  const pooledPre = rows[1]!.pre_token + rows[2]!.pre_token;
  const pooled = pooledLive / Math.max(1, pooledLive + pooledPre);
  rows[1]!.odds = pooled;
  rows[2]!.odds = pooled;
  const noDateLive = snapshot.protocols.filter((p) => !isPreToken(p) && ageDays(snapshot.as_of, p.listed_at) === null).length;
  const noDatePre = snapshot.protocols.filter((p) => isPreToken(p) && ageDays(snapshot.as_of, p.listed_at) === null).length;
  const noDateShare = noDateLive / Math.max(1, noDateLive + noDatePre);
  rows.push({ bucket: 'no listing date', live: noDateLive, pre_token: noDatePre, share: noDateShare, odds: noDateShare });
  return rows;
}

export function launchShareFor(age: number | null, shares: LaunchShareRow[]): number {
  if (age === null) return shares[shares.length - 1]!.odds;
  if (age < 180) return shares[0]!.odds;
  if (age < 365) return shares[1]!.odds;
  if (age < 730) return shares[2]!.odds;
  if (age < 1095) return shares[3]!.odds;
  return shares[4]!.odds;
}

export interface OddsValidation {
  accuracy: number;
  brier: number;
  base_rate: number;
  n_test: number;
  seeds: number;
}

// Held-out validation of the bucket odds: ten seeded 80/20 splits of
// all 758 protocols. On each split the bucket shares are counted from
// the train protocols only (with the same monotonizing), then each test
// protocol is scored with its band's odds: accuracy is the share
// predicted right at a 50% cut, Brier is the mean squared error of the
// odds against the 0/1 outcome. The base rate is the overall share of
// protocols that already have a token.
export function validateOdds(snapshot: Snapshot, model: FitConstants = MODEL): OddsValidation {
  const n = snapshot.protocols.length;
  const baseRate = snapshot.protocols.filter((p) => !isPreToken(p)).length / n;
  let accSum = 0;
  let brierSum = 0;
  let nTest = 0;
  for (let k = 0; k < 10; k++) {
    const order = snapshot.protocols.map((_, i) => i);
    const rand = mulberry32(model.seed + k);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = order[i]!;
      order[i] = order[j]!;
      order[j] = t;
    }
    const nTrain = Math.floor(n * model.train_fraction);
    const train = order.slice(0, nTrain).map((i) => snapshot.protocols[i]!);
    const test = order.slice(nTrain).map((i) => snapshot.protocols[i]!);
    const sub: Snapshot = { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd, protocols: train, watchlist: [] };
    const shares = launchShares(sub);
    nTest = test.length;
    for (const p of test) {
      const odds = launchShareFor(ageDays(snapshot.as_of, p.listed_at), shares);
      const y = isPreToken(p) ? 0 : 1;
      if ((odds >= 0.5) === (y === 1)) accSum += 1;
      brierSum += (odds - y) ** 2;
    }
  }
  const total = 10 * nTest;
  return { accuracy: accSum / total, brier: brierSum / total, base_rate: baseRate, n_test: nTest, seeds: 10 };
}

// The farm verdict, from the expected value per hour, net of costs. A
// farm plan costs gas and locks capital; the payoff if the token
// launches is taken as a typical 5% airdrop of the implied value, times
// the launch odds for the protocol's age band, minus the gas and minus
// the lock-up cost (the capital held for the plan's days at a 4%
// annual rate). Divide by the plan's hours and farm when that net
// expected rate is at least $50 an hour, marginal at $10-50, skip below
// $10. The break-even odds (the launch probability at which the airdrop
// exactly covers the gas) are printed alongside, but they do not set
// the verdict. The 5% is an assumption, stated on the dashboard, and
// the odds and the hourly rate are printed so anyone can re-derive the
// verdict with a different share. Note the honest limit: a 5% slice of
// a tens-of-millions implied value dwarfs a $25 gas bill, so nearly
// every row clears $50 an hour and the verdict barely discriminates;
// the Best farms list and the portfolio planner, ranked by net $/hour,
// are where the farm story actually separates rows.
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
  // The same 80/20 holdout over ten seeds: one split is fifteen anchors
  // and its miss jumps around, so the single split is always quoted
  // beside this mean, never alone.
  const holdoutSeeds: number[] = [];
  for (let k = 0; k < 10; k++) {
    const ord = rows.map((_, i) => i);
    const rnd = mulberry32(model.seed + k);
    for (let i = ord.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = ord[i]!;
      ord[i] = ord[j]!;
      ord[j] = t;
    }
    const nTr = Math.max(1, Math.floor(ord.length * model.train_fraction));
    const trIdx = ord.slice(0, nTr);
    const teIdx = ord.slice(nTr);
    const bSeed = ols(trIdx.map((i) => rows[i]!.x), trIdx.map((i) => rows[i]!.y), model.ridge_lambda);
    holdoutSeeds.push(median(teIdx.map((i) => 10 ** Math.abs(rows[i]!.y - dot(rows[i]!.x, bSeed)))));
  }
  const holdoutMean10 = holdoutSeeds.reduce((s, v) => s + v, 0) / holdoutSeeds.length;
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
  // The launch odds' own held-out validation, on the same protocols.
  const oddsVal = validateOdds({ as_of: asOf, source: '', floor_usd: 1, protocols, watchlist: [] }, model);
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
    holdout_miss_factor_10seed: holdoutMean10,
    holdout_miss_factor_10seed_median: median(holdoutSeeds),
    wf_miss_factor: wfMiss,
    wf_train_n: wfTrain.length,
    wf_test_n: wfTest.length,
    interval_lo_log: intervalLo,
    interval_hi_log: intervalHi,
    range_holds: rangeHolds,
    odds_holdout_accuracy: oddsVal.accuracy,
    odds_holdout_brier: oddsVal.brier,
    odds_base_rate: oddsVal.base_rate,
    odds_holdout_n: oddsVal.n_test,
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

// The five nearest traded tokens to a protocol, by distance in log10
// TVL, same category first and other priceable categories as fallback.
// Exchanges, bridges and staked receipts are not comps: their multiples
// are not comparable, for the same reason they are excluded from the
// fit. The table lets a reader check the fitted multiple against the
// multiples the market actually pays for the closest live tokens. The
// neighbours' multiples vary widely — a hundredfold across the board —
// which is exactly why the fitted multiple is a regression-smoothed
// value and not the neighbour median, and why the model's leave-one-out
// miss is around 3x. A second estimate from the neighbour median alone
// is NOT published as a cross-check: on the top 20 rows it agrees with
// the fitted value within 20% for only 2 of 20, so it is not a strength.
export function nearestComps(
  p: SnapshotProtocol,
  protocols: SnapshotProtocol[],
  n = 5,
): { comps: NearestComp[]; median_multiple: number | null } {
  const pool = protocols.filter(
    (q) => !isPreToken(q) && q.mcap_usd !== null && q.mcap_usd > 0 && q.tvl_usd > 0 && q.category !== null && !SET_ASIDE_CATEGORIES.has(q.category),
  );
  const lt = Math.log10(Math.max(1, p.tvl_usd));
  const scored = pool.map((q) => ({
    q,
    d: Math.abs(Math.log10(Math.max(1, q.tvl_usd)) - lt),
    same: q.category === p.category,
  }));
  const same = scored.filter((x) => x.same).sort((a, b) => a.d - b.d || (a.q.slug < b.q.slug ? -1 : 1));
  const other = scored.filter((x) => !x.same).sort((a, b) => a.d - b.d || (a.q.slug < b.q.slug ? -1 : 1));
  const picked = [...same, ...other].slice(0, n);
  const comps: NearestComp[] = picked.map((x) => ({
    slug: x.q.slug,
    name: x.q.name,
    category: x.q.category,
    tvl_usd: x.q.tvl_usd,
    mcap_usd: x.q.mcap_usd!,
    multiple: x.q.mcap_usd! / x.q.tvl_usd,
  }));
  return { comps, median_multiple: comps.length > 0 ? median(comps.map((c) => c.multiple)) : null };
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

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
    const rawShare = rawLaunchShareFor(age, shares);
    const plan = planCostFor(p, age);
    const capital = capitalFor(p);
    const lockup = capital * model.t_bill_rate * (plan.days / 365);
    const breakEven = plan.cost / Math.max(1, implied * model.airdrop_share);
    // The expected value is the implied value times the launch odds:
    // what the launch is worth if it happens, weighted by how often
    // protocols this old have launched. The farm EV is the airdrop
    // slice of that (5%, an assumption) minus the gas and minus the
    // lock-up cost of the capital held for the plan's days.
    const expected = implied * share;
    const ev = implied * model.airdrop_share * share - plan.cost;
    const netEv = ev - lockup;
    const perHour = ev / Math.max(1, plan.days * 24);
    const netPerHour = netEv / Math.max(1, plan.days * 24);
    return { p, age, implied, low, high, share, rawShare, breakEven, expected, ev, perHour, netEv, netPerHour, plan, capital, lockup, ...v };
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
      launch_share: Math.round(s.rawShare * 1000) / 1000,
      launch_odds: Math.round(s.share * 1000) / 1000,
      expected_value_usd: Math.round(s.expected),
      break_even_odds: s.breakEven,
      verdict: farmVerdict(s.netPerHour, model),
      farm_ev_usd: Math.round(s.ev),
      farm_per_hour_usd: Math.round(s.perHour * 100) / 100,
      net_ev_usd: Math.round(s.netEv),
      net_per_hour_usd: Math.round(s.netPerHour * 100) / 100,
      plan_gas_usd: s.plan.cost,
      plan_lockup_usd: Math.round(s.lockup * 100) / 100,
      plan_capital_usd: s.capital,
      rank_p10: 0,
      rank_p50: 0,
      rank_p90: 0,
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

// The raw band share (before monotonizing) for the dashboard's table.
export function rawLaunchShareFor(age: number | null, shares: LaunchShareRow[]): number {
  if (age === null) return shares[shares.length - 1]!.share;
  if (age < 180) return shares[0]!.share;
  if (age < 365) return shares[1]!.share;
  if (age < 730) return shares[2]!.share;
  if (age < 1095) return shares[3]!.share;
  return shares[4]!.share;
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
        fit_status: !fittable ? 'unpriced' : isFitAnchor(p) ? 'fitted' : p.listed_at === null ? 'no-date' : 'set-aside',
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
    launch_odds: row.launch_odds,
    expected_value_usd: row.expected_value_usd,
    break_even_odds: row.break_even_odds,
    verdict: row.verdict,
    farm_ev_usd: row.farm_ev_usd,
    farm_per_hour_usd: row.farm_per_hour_usd,
    net_ev_usd: row.net_ev_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    plan_gas_usd: row.plan_gas_usd,
    plan_lockup_usd: row.plan_lockup_usd,
    plan_capital_usd: row.plan_capital_usd,
    rank_p10: row.rank_p10,
    rank_p50: row.rank_p50,
    rank_p90: row.rank_p90,
    signals: row.signals,
    predicted_multiple: row.model.predicted_multiple,
    log_multiple: row.model.log_multiple,
    contributions: row.model.contributions,
    plan_cost_usd: row.model.plan_cost_usd,
    plan_days: row.model.plan_days,
    nearest_comps: [],
    nearest_median_multiple: null,
  };
}

export function buildRadar(snapshot: Snapshot, model: FitConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { fit, predict } = fitModel(snapshot.protocols, snapshot.as_of, model);
  const board = buildBoard(snapshot, predict, fit, model);
  const anchors = anchorRows(snapshot, predict);
  // Bootstrap rank ranges: refit the clean model on resamples of the
  // fit anchors and re-rank the board each time. The ranges are the
  // honest answer to "how stable is this rank" — the top 3 are tight,
  // ranks 7-10 are wide, and one row in eleven swings across the board.
  const ranges = bootstrapRankRanges(snapshot, board, fit, model);
  for (const r of board) {
    const rg = ranges.get(r.slug)!;
    r.rank_p10 = rg.p10;
    r.rank_p50 = rg.p50;
    r.rank_p90 = rg.p90;
  }
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
  const radarRows = board.map(radarRow);
  const rowIndex = bySlug(snapshot.protocols);
  for (const r of radarRows) {
    const p = rowIndex.get(r.slug)!;
    const nc = nearestComps(p, snapshot.protocols, 5);
    r.nearest_comps = nc.comps;
    r.nearest_median_multiple = nc.median_multiple;
  }
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
    ev_top10: evTop10(board),
    best_farms: bestFarms(board),
    planner: buildPlanner(board, model),
    sensitivity: buildSensitivity(board, snapshot, predict, model),
    rows: radarRows,
    anchors,
    set_aside: setAside,
  };
  return { board, radar };
}

// Rank by expected value: the implied value times the launch odds. The
// board's rank stays by implied value (the gate requires it); this is a
// second ranking that surfaces what a launch radar should find — old
// protocols that still have not launched.
export function evTop10(board: BoardRow[]): EvTopRow[] {
  return [...board]
    .sort((a, b) => b.expected_value_usd - a.expected_value_usd || a.rank - b.rank)
    .slice(0, 10)
    .map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      implied_value_usd: r.implied_value_usd,
      launch_odds: r.launch_odds,
      expected_value_usd: r.expected_value_usd,
    }));
}

export function bestFarms(board: BoardRow[]): BestFarmRow[] {
  return [...board]
    .sort((a, b) => b.net_per_hour_usd - a.net_per_hour_usd || b.expected_value_usd - a.expected_value_usd)
    .slice(0, 5)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      net_per_hour_usd: r.net_per_hour_usd,
      expected_value_usd: r.expected_value_usd,
      launch_odds: r.launch_odds,
      break_even_odds: r.break_even_odds,
    }));
}

// The farm portfolio planner: a stated budget, allocated to the best
// farms by net $/hour (ties by expected value), each farm taking its
// plan's capital in full, in order, until the budget is used. The
// farms run in parallel, so the portfolio's expected rate is the sum
// of the farms' net rates.
export function buildPlanner(board: BoardRow[], model: FitConstants = MODEL): Planner {
  const budget = model.planner_budget_usd;
  const candidates = board
    .filter((r) => r.verdict === 'farm')
    .sort((a, b) => b.net_per_hour_usd - a.net_per_hour_usd || b.expected_value_usd - a.expected_value_usd);
  const farms: PlannerFarm[] = [];
  let remaining = budget;
  for (const r of candidates) {
    if (r.plan_capital_usd <= remaining) {
      farms.push({
        slug: r.slug,
        name: r.name,
        capital_usd: r.plan_capital_usd,
        gas_usd: r.plan_gas_usd,
        lockup_usd: r.plan_lockup_usd,
        net_per_hour_usd: r.net_per_hour_usd,
        expected_value_usd: r.expected_value_usd,
        break_even_odds: r.break_even_odds,
      });
      remaining -= r.plan_capital_usd;
    }
    if (remaining <= 0) break;
  }
  return {
    budget_usd: budget,
    farms,
    total_capital_usd: farms.reduce((s, f) => s + f.capital_usd, 0),
    total_gas_usd: farms.reduce((s, f) => s + f.gas_usd, 0),
    total_net_per_hour_usd: Math.round(farms.reduce((s, f) => s + f.net_per_hour_usd, 0) * 100) / 100,
  };
}

// How sensitive the top of the board is: the top 5 implied values when
// TVL is halved or grown 50%, and when seven-day growth is halved or
// grown 50%; and the $/hour leaderboard under a 2%, 5% and 10% airdrop.
// A ranking that collapses under a small input change is not a ranking.
export function buildSensitivity(
  board: BoardRow[],
  snapshot: Snapshot,
  predict: (p: SnapshotProtocol) => { multiple: number; logMultiple: number; contributions: ModelContributions },
  model: FitConstants = MODEL,
): Sensitivity {
  const index = bySlug(snapshot.protocols);
  const impliedFor = (q: SnapshotProtocol): number => Math.max(1, Math.round(q.tvl_usd * predict(q).multiple));
  const top5: SensitivityRow[] = board.slice(0, 5).map((r) => {
    const p = index.get(r.slug)!;
    const growth = p.change_7d;
    return {
      slug: r.slug,
      name: r.name,
      base_usd: r.implied_value_usd,
      tvl_down_usd: impliedFor({ ...p, tvl_usd: Math.max(1, Math.round(p.tvl_usd * 0.5)) }),
      tvl_up_usd: impliedFor({ ...p, tvl_usd: Math.round(p.tvl_usd * 1.5) }),
      growth_down_usd: growth === null ? r.implied_value_usd : impliedFor({ ...p, change_7d: growth * 0.5 }),
      growth_up_usd: growth === null ? r.implied_value_usd : impliedFor({ ...p, change_7d: growth * 1.5 }),
    };
  });
  const airdropLeaders = [0.02, 0.05, 0.1].map((share) => {
    const leaders = [...board]
      .map((r) => {
        const netEv = r.implied_value_usd * share * r.launch_odds - r.plan_gas_usd - r.plan_lockup_usd;
        return {
          slug: r.slug,
          name: r.name,
          net_per_hour_usd: Math.round((netEv / Math.max(1, r.model.plan_days * 24)) * 100) / 100,
        };
      })
      .sort((a, b) => b.net_per_hour_usd - a.net_per_hour_usd)
      .slice(0, 5);
    return { share, leaders };
  });
  return { top5, airdrop_leaders: airdropLeaders };
}

// Bootstrap rank ranges: refit the clean model on 200 resamples of the
// fit anchors (seeded, so both program runs agree) and re-rank the
// board each time. Returns p10/p50/p90 of each row's rank across refits.
export function bootstrapRankRanges(
  snapshot: Snapshot,
  board: BoardRow[],
  fit: FitResult,
  model: FitConstants = MODEL,
): Map<string, { p10: number; p50: number; p90: number }> {
  const anchors = snapshot.protocols.filter(isFitAnchor);
  const dummies = fit.category_dummies;
  const rows = anchors.map((p) => ({
    x: featuresFor(p, snapshot.as_of, model, dummies),
    y: clamp(Math.log10(p.mcap_usd! / p.tvl_usd), model.winsor_lo, model.winsor_hi),
  }));
  const index = bySlug(snapshot.protocols);
  const ranks = new Map<string, number[]>();
  for (const r of board) ranks.set(r.slug, []);
  for (let b = 0; b < model.bootstrap_refits; b++) {
    const rand = mulberry32(model.seed + 1000 + b);
    const sample: { x: number[]; y: number }[] = [];
    for (let i = 0; i < rows.length; i++) sample.push(rows[Math.floor(rand() * rows.length)]!);
    const beta = ols(sample.map((r) => r.x), sample.map((r) => r.y), model.ridge_lambda);
    const scored = board.map((r) => {
      const p = index.get(r.slug)!;
      const v = Math.max(1, Math.round(p.tvl_usd * clamp(10 ** dot(featuresFor(p, snapshot.as_of, model, dummies), beta), model.multiple_floor, model.multiple_cap)));
      return { slug: r.slug, v };
    });
    scored.sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => ranks.get(s.slug)!.push(i + 1));
  }
  const out = new Map<string, { p10: number; p50: number; p90: number }>();
  for (const [slug, rs] of ranks) {
    const sorted = [...rs].sort((a, b) => a - b);
    out.set(slug, { p10: Math.round(quantile(sorted, 0.1)), p50: Math.round(median(sorted)), p90: Math.round(quantile(sorted, 0.9)) });
  }
  return out;
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
