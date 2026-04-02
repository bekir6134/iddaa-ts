import type { TeamStatistics, FixtureOdds } from '@/types/api-football';
import type { PoissonResult } from '@/types/cache';

const LEAGUE_AVG_GOALS = 1.2; // fallback when team stats missing
const MAX_GOALS = 8;

// ─── Math Core ────────────────────────────────────────────────────────────────

const factCache: number[] = [1];
function factorial(n: number): number {
  if (n < 0) return 1;
  if (factCache[n] !== undefined) return factCache[n];
  factCache[n] = n * factorial(n - 1);
  return factCache[n];
}

export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

export function poissonCDF(n: number, lambda: number): number {
  let sum = 0;
  for (let k = 0; k <= n; k++) sum += poissonPMF(k, lambda);
  return sum;
}

// ─── Lambda Calculation ───────────────────────────────────────────────────────

function parseAvg(val: string | number | null | undefined): number | null {
  const n = parseFloat(String(val ?? ''));
  return isNaN(n) || n < 0 ? null : n;
}

export function calcLambdas(
  homeStats: TeamStatistics,
  awayStats: TeamStatistics
): { homeLambda: number; awayLambda: number; quality: 'full' | 'partial' } {
  const hFor = parseAvg(homeStats.goals?.for?.average?.home);
  const aAgainst = parseAvg(awayStats.goals?.against?.average?.away);
  const aFor = parseAvg(awayStats.goals?.for?.average?.away);
  const hAgainst = parseAvg(homeStats.goals?.against?.average?.home);

  const homeLambda = ((hFor ?? LEAGUE_AVG_GOALS) + (aAgainst ?? LEAGUE_AVG_GOALS)) / 2;
  const awayLambda = ((aFor ?? LEAGUE_AVG_GOALS) + (hAgainst ?? LEAGUE_AVG_GOALS)) / 2;
  const quality = (hFor !== null && aAgainst !== null && aFor !== null && hAgainst !== null) ? 'full' : 'partial';
  return { homeLambda: Math.max(0.1, homeLambda), awayLambda: Math.max(0.1, awayLambda), quality };
}

// ─── Match Probabilities ──────────────────────────────────────────────────────

export function calcMatchProbabilities(homeLambda: number, awayLambda: number) {
  let probHome = 0, probDraw = 0, probAway = 0, probOver25 = 0, probOver15 = 0;

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPMF(i, homeLambda) * poissonPMF(j, awayLambda);
      if (i > j) probHome += p;
      else if (i === j) probDraw += p;
      else probAway += p;
      if (i + j >= 3) probOver25 += p;
      if (i + j >= 2) probOver15 += p;
    }
  }

  const probBTTS = (1 - poissonCDF(0, homeLambda)) * (1 - poissonCDF(0, awayLambda));
  return { probHome, probDraw, probAway, probOver25, probOver15, probBTTS };
}

// ─── Value Bet ────────────────────────────────────────────────────────────────

export function isPoissonValueBet(modelProb: number, odd: number | null | undefined): boolean {
  if (!odd || odd <= 1) return false;
  return modelProb * odd - 1 > 0;
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export function calcConfidence(probHome: number, probDraw: number, probAway: number): number {
  const probs = [probHome, probDraw, probAway].sort((a, b) => b - a);
  const base = Math.round(probs[0] * 100);
  const margin = probs[0] - probs[1];
  const bonus = margin > 0.2 ? 5 : 0;
  return Math.min(100, base + bonus);
}

// ─── Odds Extraction ─────────────────────────────────────────────────────────

function extractOdd(oddsEntry: FixtureOdds | undefined, value: string): number | null {
  const bets = oddsEntry?.bookmakers?.[0]?.bets ?? [];
  const mw = bets.find((b) => b.name === 'Match Winner');
  const raw = mw?.values?.find((v) => v.value === value)?.odd;
  const n = parseFloat(String(raw ?? ''));
  return isNaN(n) ? null : n;
}

// ─── Top-Level Builder ────────────────────────────────────────────────────────

export function buildPoissonResult(
  fixtureId: number,
  homeStats: TeamStatistics | undefined,
  awayStats: TeamStatistics | undefined,
  oddsEntry: FixtureOdds | undefined
): PoissonResult {
  if (!homeStats && !awayStats) {
    return {
      fixtureId, homeLambda: 0, awayLambda: 0,
      probHome: 0, probDraw: 0, probAway: 0,
      probOver25: 0, probOver15: 0, probBTTS: 0,
      valueHome: false, valueDraw: false, valueAway: false,
      confidence: 0, dataQuality: 'none',
    };
  }

  const fakeStats = (stats: TeamStatistics | undefined): TeamStatistics => stats ?? {
    goals: { for: { average: { home: String(LEAGUE_AVG_GOALS), away: String(LEAGUE_AVG_GOALS), total: String(LEAGUE_AVG_GOALS) } }, against: { average: { home: String(LEAGUE_AVG_GOALS), away: String(LEAGUE_AVG_GOALS), total: String(LEAGUE_AVG_GOALS) } } },
  } as TeamStatistics;

  const { homeLambda, awayLambda, quality } = calcLambdas(
    fakeStats(homeStats),
    fakeStats(awayStats)
  );

  const { probHome, probDraw, probAway, probOver25, probOver15, probBTTS } =
    calcMatchProbabilities(homeLambda, awayLambda);

  const homeOdd = extractOdd(oddsEntry, 'Home');
  const drawOdd = extractOdd(oddsEntry, 'Draw');
  const awayOdd = extractOdd(oddsEntry, 'Away');

  return {
    fixtureId,
    homeLambda: Math.round(homeLambda * 100) / 100,
    awayLambda: Math.round(awayLambda * 100) / 100,
    probHome: Math.round(probHome * 1000) / 1000,
    probDraw: Math.round(probDraw * 1000) / 1000,
    probAway: Math.round(probAway * 1000) / 1000,
    probOver25: Math.round(probOver25 * 1000) / 1000,
    probOver15: Math.round(probOver15 * 1000) / 1000,
    probBTTS: Math.round(probBTTS * 1000) / 1000,
    valueHome: isPoissonValueBet(probHome, homeOdd),
    valueDraw: isPoissonValueBet(probDraw, drawOdd),
    valueAway: isPoissonValueBet(probAway, awayOdd),
    confidence: calcConfidence(probHome, probDraw, probAway),
    dataQuality: (!homeStats || !awayStats) ? 'partial' : quality,
  };
}
