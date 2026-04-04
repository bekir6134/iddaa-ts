import type { FixturePrediction, FixtureOdds, Fixture } from '@/types/api-football';
import type { PoissonResult } from '@/types/cache';
import { parseOdd } from '@/lib/utils';

export interface MatchScore {
  fixtureId: number;
  total: number;       // 0–100
  formScore: number;   // 0–100
  poissonScore: number; // 0–100
  h2hScore: number;    // 0–100
  valueScore: number;  // 0–100
  recommendation: 'MS1' | 'MS2' | 'X' | 'ÜST' | '-';
  confidence: 'Yüksek' | 'Orta' | 'Düşük';
}

// ─── Form skoru (0–100) ──────────────────────────────────────────────────────

function calcFormScore(prediction: FixturePrediction | null | undefined): number {
  if (!prediction) return 0;
  const home = prediction.teams.home;
  const away = prediction.teams.away;

  // league.form = "WWDLW" (W/D/L dizisi), last_5.form = "47%" (yüzde)
  const parseWDL = (form: string): number => {
    const chars = form.split('').filter((c) => ['W', 'D', 'L'].includes(c));
    if (chars.length === 0) return 50; // veri yok → nötr
    const pts = chars.reduce((a, c) => a + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0);
    return Math.round((pts / (chars.length * 3)) * 100);
  };
  const parsePct = (pct: string): number => {
    const n = parseFloat(pct);
    return isNaN(n) ? 50 : Math.min(100, Math.max(0, n));
  };

  // Önce league.form (W/D/L), yoksa last_5.form (yüzde) kullan
  const homeForm = home.league?.form
    ? parseWDL(home.league.form)
    : parsePct(home.last_5?.form ?? '');
  const awayForm = away.league?.form
    ? parseWDL(away.league.form)
    : parsePct(away.last_5?.form ?? '');

  // Ev formunun üstünlüğü skora yansır (ev avantajı yüksek ise puan artar)
  const diff = homeForm - awayForm; // -100 .. +100
  // Normalize: farklılık ne kadar büyük olursa skor o kadar güvenilir
  return Math.min(100, Math.round(50 + Math.abs(diff) * 0.5));
}

// ─── Poisson güven skoru (0–100) ─────────────────────────────────────────────

function calcPoissonScore(poisson: PoissonResult | null | undefined): number {
  if (!poisson) return 0;
  // En yüksek olasılıklı sonuç ne kadar baskın?
  const max = Math.max(poisson.probHome, poisson.probDraw, poisson.probAway);
  const second = [poisson.probHome, poisson.probDraw, poisson.probAway]
    .sort((a, b) => b - a)[1];
  const margin = max - second; // 0.0 – 1.0
  return Math.min(100, Math.round(margin * 250)); // 0.4 fark → 100
}

// ─── H2H uyum skoru (0–100) ──────────────────────────────────────────────────

function calcH2HScore(
  h2h: Fixture[] | null | undefined,
  homeId: number,
  awayId: number
): number {
  if (!h2h || h2h.length === 0) return 50; // veri yok → nötr
  const last5 = h2h.slice(0, 5);
  let homeWins = 0, draws = 0, awayWins = 0;
  for (const f of last5) {
    const hg = f.goals?.home;
    const ag = f.goals?.away;
    if (hg === null || ag === null) continue;
    const isHome = f.teams.home.id === homeId;
    if (hg > ag) isHome ? homeWins++ : awayWins++;
    else if (hg === ag) draws++;
    else isHome ? awayWins++ : homeWins++;
  }
  const total = homeWins + draws + awayWins;
  if (total === 0) return 50;
  // Belirgin bir üstünlük varsa skor yüksek
  const dominance = Math.max(homeWins, awayWins) / total;
  return Math.min(100, Math.round(dominance * 100));
}

// ─── Oran değeri (EV) skoru (0–100) ──────────────────────────────────────────

function calcValueScore(
  odds: FixtureOdds | null | undefined,
  poisson: PoissonResult | null | undefined
): number {
  if (!odds || !poisson) return 0;
  const bets = odds.bookmakers[0]?.bets ?? [];
  const mw = bets.find((b) => b.name === 'Match Winner');
  if (!mw) return 0;

  const homeOdd = parseOdd(mw.values.find((v) => v.value === 'Home')?.odd ?? '0');
  const drawOdd = parseOdd(mw.values.find((v) => v.value === 'Draw')?.odd ?? '0');
  const awayOdd = parseOdd(mw.values.find((v) => v.value === 'Away')?.odd ?? '0');

  if (homeOdd <= 1 && drawOdd <= 1 && awayOdd <= 1) return 0;

  const evHome = poisson.probHome * homeOdd - 1;
  const evDraw = poisson.probDraw * drawOdd - 1;
  const evAway = poisson.probAway * awayOdd - 1;
  const maxEV = Math.max(evHome, evDraw, evAway);

  if (maxEV <= 0) return 0;
  return Math.min(100, Math.round(maxEV * 200)); // EV 0.5 → 100
}

// ─── Öneri ───────────────────────────────────────────────────────────────────

function getRecommendation(
  poisson: PoissonResult | null | undefined,
  odds: FixtureOdds | null | undefined
): MatchScore['recommendation'] {
  if (!poisson) return '-';
  const bets = odds?.bookmakers[0]?.bets ?? [];
  const mw = bets.find((b) => b.name === 'Match Winner');

  const evHome = mw
    ? poisson.probHome * parseOdd(mw.values.find((v) => v.value === 'Home')?.odd ?? '0') - 1
    : -1;
  const evDraw = mw
    ? poisson.probDraw * parseOdd(mw.values.find((v) => v.value === 'Draw')?.odd ?? '0') - 1
    : -1;
  const evAway = mw
    ? poisson.probAway * parseOdd(mw.values.find((v) => v.value === 'Away')?.odd ?? '0') - 1
    : -1;

  if (poisson.probOver25 > 0.6) return 'ÜST';

  const max = Math.max(evHome, evDraw, evAway);
  if (max <= 0) {
    // EV yoksa Poisson olasılığına göre
    const pmax = Math.max(poisson.probHome, poisson.probDraw, poisson.probAway);
    if (pmax === poisson.probHome) return 'MS1';
    if (pmax === poisson.probAway) return 'MS2';
    return 'X';
  }
  if (max === evHome) return 'MS1';
  if (max === evAway) return 'MS2';
  return 'X';
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export function scoreMatch(
  fixtureId: number,
  homeId: number,
  awayId: number,
  prediction: FixturePrediction | null | undefined,
  poisson: PoissonResult | null | undefined,
  odds: FixtureOdds | null | undefined,
  h2h: Fixture[] | null | undefined
): MatchScore {
  const formScore = calcFormScore(prediction);
  const poissonScore = calcPoissonScore(poisson);
  const h2hScore = calcH2HScore(h2h, homeId, awayId);
  const valueScore = calcValueScore(odds, poisson);

  const total = Math.round(
    formScore * 0.25 +
    poissonScore * 0.30 +
    h2hScore * 0.20 +
    valueScore * 0.25
  );

  const confidence: MatchScore['confidence'] =
    total >= 60 ? 'Yüksek' : total >= 35 ? 'Orta' : 'Düşük';

  return {
    fixtureId,
    total,
    formScore,
    poissonScore,
    h2hScore,
    valueScore,
    recommendation: getRecommendation(poisson, odds),
    confidence,
  };
}
