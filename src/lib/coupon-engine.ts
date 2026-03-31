import type { AppCache } from '@/types/cache';
import type { Fixture } from '@/types/api-football';
import type {
  BetType, CouponSelection, CouponFilters, GeneratedCoupon,
  ConfidenceLevel, RiskRating, ScoreBreakdown,
} from '@/types/coupon';
import { percentToFloat, formToPoints, parseOdd, generateId, LEAGUE_NAMES } from './utils';

// ─── Score → Confidence ───────────────────────────────────────────────────────

function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 68) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function scoreToRisk(score: number): RiskRating {
  if (score >= 68) return 'low';
  if (score >= 50) return 'medium';
  if (score >= 35) return 'high';
  return 'very-high';
}

// ─── Scoring Components ───────────────────────────────────────────────────────

function calcPredictionScore(
  homePct: number,
  drawPct: number,
  awayPct: number,
  betType: BetType,
  selection: string,
  advice: string
): number {
  let pct = 0;
  if (betType === '1X2') {
    if (selection === 'Ev Sahibi') pct = homePct;
    else if (selection === 'Beraberlik') pct = drawPct;
    else pct = awayPct;
  } else if (betType === 'DNB') {
    pct = selection === 'Ev Sahibi' ? homePct + drawPct / 2 : awayPct + drawPct / 2;
  } else {
    // For Over/Under and BTTS we use the max confidence as proxy
    pct = Math.max(homePct, awayPct);
  }

  let score = 0;
  if (pct >= 70) score = 30;
  else if (pct >= 60) score = 20;
  else if (pct >= 50) score = 10;

  // Bonus if advice matches our selection
  const adviceLower = advice.toLowerCase();
  if (selection === 'Ev Sahibi' && adviceLower.includes(selection.toLowerCase())) score += 5;

  return Math.min(score, 30);
}

function calcFormScore(
  homeForm: string,
  awayForm: string,
  betType: BetType,
  selection: string
): number {
  const maxPoints = 15; // W W W W W = 15
  let points = 0;

  if (betType === '1X2' || betType === 'DNB') {
    if (selection === 'Ev Sahibi') {
      points = formToPoints(homeForm.slice(-5));
    } else if (selection === 'Deplasman') {
      points = formToPoints(awayForm.slice(-5));
    } else {
      // Draw: average both
      points = (formToPoints(homeForm.slice(-5)) + formToPoints(awayForm.slice(-5))) / 2;
    }
  } else {
    // Over/Under and BTTS: average of both teams
    points = (formToPoints(homeForm.slice(-5)) + formToPoints(awayForm.slice(-5))) / 2;
  }

  return Math.round((points / maxPoints) * 25);
}

function calcH2HScore(
  h2hFixtures: Fixture[],
  homeTeamId: number,
  betType: BetType,
  selection: string
): number {
  if (!h2hFixtures.length) return 0;

  const last5 = h2hFixtures.slice(0, 5);
  let matches = 0;

  for (const f of last5) {
    const homeGoals = f.score.fulltime.home ?? 0;
    const awayGoals = f.score.fulltime.away ?? 0;
    const totalGoals = homeGoals + awayGoals;
    const isHomeTeam = f.teams.home.id === homeTeamId;

    let hit = false;
    if (betType === '1X2' || betType === 'DNB') {
      if (selection === 'Ev Sahibi') hit = isHomeTeam ? homeGoals > awayGoals : awayGoals > homeGoals;
      else if (selection === 'Deplasman') hit = isHomeTeam ? awayGoals > homeGoals : homeGoals > awayGoals;
      else hit = homeGoals === awayGoals;
    } else if (betType === 'Over2.5') {
      hit = totalGoals > 2.5;
    } else if (betType === 'Over1.5') {
      hit = totalGoals > 1.5;
    } else if (betType === 'Under2.5') {
      hit = totalGoals < 2.5;
    } else if (betType === 'BTTS') {
      hit = selection === 'Var' ? (homeGoals > 0 && awayGoals > 0) : !(homeGoals > 0 && awayGoals > 0);
    }

    if (hit) matches++;
  }

  if (matches >= 4) return 20;
  if (matches === 3) return 12;
  if (matches === 2) return 6;
  return 0;
}

function calcHomeAdvantageScore(
  homeWinPct: number,
  betType: BetType,
  selection: string
): number {
  if ((betType !== '1X2' && betType !== 'DNB') || selection !== 'Ev Sahibi') return 0;
  if (homeWinPct >= 0.60) return 15;
  if (homeWinPct >= 0.50) return 10;
  if (homeWinPct >= 0.40) return 5;
  return 0;
}

function calcInjuryImpact(injuryCount: number): number {
  if (injuryCount === 0) return 0;
  if (injuryCount === 1) return -3;
  if (injuryCount === 2) return -7;
  return -10;
}

// ─── Bet selection label helper ───────────────────────────────────────────────

function getSelectionLabel(betType: BetType, winner: 'home' | 'away' | null): string {
  if (betType === '1X2') {
    if (winner === 'home') return 'Ev Sahibi';
    if (winner === 'away') return 'Deplasman';
    return 'Beraberlik';
  }
  if (betType === 'BTTS') return 'Var';
  if (betType === 'Over2.5') return '2.5 Üst';
  if (betType === 'Over1.5') return '1.5 Üst';
  if (betType === 'Under2.5') return '2.5 Alt';
  if (betType === 'DNB') return winner === 'home' ? 'Ev Sahibi' : 'Deplasman';
  return '-';
}

function getOddForBet(
  betType: BetType,
  selection: string,
  cache: AppCache,
  fixtureId: number
): number | null {
  const odds = cache.odds.byFixture[fixtureId];
  if (!odds) return null;

  const bets = odds.bookmakers?.[0]?.bets ?? [];

  if (betType === '1X2' || betType === 'DNB') {
    const bet = bets.find((b) => b.name === 'Match Winner');
    const apiSel = selection === 'Ev Sahibi' ? 'Home' : selection === 'Deplasman' ? 'Away' : 'Draw';
    const val = bet?.values?.find((v) => v.value === apiSel);
    return val ? parseOdd(val.odd) : null;
  }
  if (betType === 'Over2.5') {
    const bet = bets.find((b) => b.name === 'Goals Over/Under');
    const val = bet?.values?.find((v) => v.value === 'Over 2.5');
    return val ? parseOdd(val.odd) : null;
  }
  if (betType === 'Over1.5') {
    const bet = bets.find((b) => b.name === 'Goals Over/Under');
    const val = bet?.values?.find((v) => v.value === 'Over 1.5');
    return val ? parseOdd(val.odd) : null;
  }
  if (betType === 'Under2.5') {
    const bet = bets.find((b) => b.name === 'Goals Over/Under');
    const val = bet?.values?.find((v) => v.value === 'Under 2.5');
    return val ? parseOdd(val.odd) : null;
  }
  if (betType === 'BTTS') {
    const bet = bets.find((b) => b.name === 'Both Teams Score');
    const val = bet?.values?.find((v) => v.value === 'Yes');
    return val ? parseOdd(val.odd) : null;
  }
  return null;
}

// ─── Score a single bet ───────────────────────────────────────────────────────

function scoreBet(
  fixture: Fixture,
  betType: BetType,
  cache: AppCache
): CouponSelection | null {
  const pred = cache.predictions.byFixture[fixture.fixture.id];

  // Prediction olmadan odds bazlı winner tahmin et
  let winner: 'home' | 'away' | null = null;
  let homePct = 0, drawPct = 0, awayPct = 0;
  let homeForm = '', awayForm = '';

  if (pred) {
    const p = pred.predictions;
    homePct = percentToFloat(p.percent.home) * 100;
    drawPct = percentToFloat(p.percent.draw) * 100;
    awayPct = percentToFloat(p.percent.away) * 100;
    winner = p.winner?.id === fixture.teams.home.id ? 'home' :
             p.winner?.id === fixture.teams.away.id ? 'away' : null;
    homeForm = pred.teams.home.last_5?.form ?? '';
    awayForm = pred.teams.away.last_5?.form ?? '';
  } else {
    // Prediction yok — odds'tan winner tahmin et
    const bets = cache.odds.byFixture[fixture.fixture.id]?.bookmakers?.[0]?.bets ?? [];
    const mw = bets.find((b) => b.name === 'Match Winner');
    const homeOdd = parseFloat(mw?.values?.find((v) => v.value === 'Home')?.odd ?? '99');
    const awayOdd = parseFloat(mw?.values?.find((v) => v.value === 'Away')?.odd ?? '99');
    if (homeOdd < awayOdd) { winner = 'home'; homePct = Math.round((1 / homeOdd) * 100); }
    else if (awayOdd < homeOdd) { winner = 'away'; awayPct = Math.round((1 / awayOdd) * 100); }
  }

  const selection = getSelectionLabel(betType, winner);

  const odd = getOddForBet(betType, selection, cache, fixture.fixture.id);
  if (!odd) return null;

  // H2H
  const h2hKey = `${fixture.teams.home.id}_${fixture.teams.away.id}`;
  const h2hFixtures = cache.h2h.byFixturePair[h2hKey] ?? [];

  // Home win rate
  const homeStats = cache.teamStats.byTeam[fixture.teams.home.id];
  const homePlayed = homeStats?.fixtures.played.home ?? 0;
  const homeWins = homeStats?.fixtures.wins.home ?? 0;
  const homeWinPct = homePlayed > 0 ? homeWins / homePlayed : 0;

  // Injury impact on predicted winner
  const winnerId = winner === 'home' ? fixture.teams.home.id : fixture.teams.away.id;
  const injuryCount = (cache.injuries.byTeam[winnerId] ?? []).length;

  const predScore = pred ? calcPredictionScore(homePct, drawPct, awayPct, betType, selection, pred.predictions.advice) : 0;
  const formScore = calcFormScore(homeForm, awayForm, betType, selection);
  const h2hScore = calcH2HScore(h2hFixtures, fixture.teams.home.id, betType, selection);
  const homeAdvScore = calcHomeAdvantageScore(homeWinPct, betType, selection);
  const injuryScore = calcInjuryImpact(injuryCount);

  // Prediction yoksa odds güvenilirliğine göre temel skor ekle (max 20)
  const oddsBaseScore = !pred ? (odd <= 1.5 ? 20 : odd <= 2.0 ? 15 : odd <= 2.5 ? 10 : 5) : 0;

  const total = Math.max(0, predScore + oddsBaseScore + formScore + h2hScore + homeAdvScore + injuryScore);

  const breakdown: ScoreBreakdown = {
    predictionScore: predScore,
    formScore,
    h2hScore,
    homeAdvantageScore: homeAdvScore,
    injuryImpactScore: injuryScore,
    total,
  };

  const reasoning: string[] = [];
  if (predScore >= 20) reasoning.push(`Yüksek tahmin güveni (${Math.round(Math.max(homePct, drawPct, awayPct))}%)`);
  if (formScore >= 18) reasoning.push(`Güçlü form performansı`);
  if (h2hScore >= 12) reasoning.push(`H2H geçmişi destekliyor`);
  if (homeAdvScore >= 10) reasoning.push(`Ev sahibi avantajı belirgin`);
  if (injuryScore < -5) reasoning.push(`Dikkat: ${injuryCount} sakatlık var`);
  if (reasoning.length === 0) reasoning.push(`Orta düzey tahmin gücü`);

  return {
    fixtureId: fixture.fixture.id,
    homeTeam: fixture.teams.home.name,
    homeTeamLogo: fixture.teams.home.logo,
    awayTeam: fixture.teams.away.name,
    awayTeamLogo: fixture.teams.away.logo,
    leagueName: LEAGUE_NAMES[fixture.league.id] ?? fixture.league.name,
    leagueLogo: fixture.league.logo,
    matchDate: fixture.fixture.date,
    betType,
    selection,
    odds: odd,
    confidence: scoreToConfidence(total),
    riskRating: scoreToRisk(total),
    scoreBreakdown: breakdown,
    reasoning,
  };
}

// ─── Generate Coupon ──────────────────────────────────────────────────────────

export function generateCoupon(filters: CouponFilters, cache: AppCache): GeneratedCoupon {
  const allFixtures = Object.values(cache.fixtures.byDate ?? {}).flat();

  const scored: CouponSelection[] = [];

  for (const fixture of allFixtures) {
    // League filter
    if (filters.leagues.length > 0 && !filters.leagues.includes(fixture.league.id)) continue;

    for (const betType of filters.betTypes) {
      const sel = scoreBet(fixture, betType, cache);
      if (!sel) continue;
      if (sel.odds < filters.minOdds || sel.odds > filters.maxOdds) continue;

      const confOrder: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
      if (confOrder[sel.confidence] < confOrder[filters.minConfidence]) continue;

      scored.push(sel);
    }
  }

  // Sort by score descending, deduplicate fixtures (keep best bet per fixture)
  const seen = new Set<number>();
  const deduped = scored
    .sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total)
    .filter((s) => {
      if (seen.has(s.fixtureId)) return false;
      seen.add(s.fixtureId);
      return true;
    });

  const selections = deduped.slice(0, filters.maxSelections);

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const avgScore = selections.length
    ? selections.reduce((acc, s) => acc + s.scoreBreakdown.total, 0) / selections.length
    : 0;

  return {
    id: generateId(),
    selections,
    totalOdds: Math.round(totalOdds * 100) / 100,
    overallRisk: scoreToRisk(avgScore),
    generatedAt: new Date().toISOString(),
  };
}

export function rankSelections(cache: AppCache, betTypes: BetType[] = ['1X2', 'Over2.5', 'BTTS']): CouponSelection[] {
  const allFixtures = Object.values(cache.fixtures.byDate ?? {}).flat();
  const scored: CouponSelection[] = [];

  for (const fixture of allFixtures) {
    for (const betType of betTypes) {
      const sel = scoreBet(fixture, betType, cache);
      if (sel) scored.push(sel);
    }
  }

  return scored.sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);
}
