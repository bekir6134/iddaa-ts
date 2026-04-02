import * as api from './api-football';
// Not: Free plan `next` parametresini desteklemiyor. getFixturesLast kullanılıyor.
import { saveCache, getCache } from './data-cache';
import { buildPoissonResult } from './poisson';
import type { AppCache, CacheMeta } from '@/types/cache';
import type { Fixture } from '@/types/api-football';
import { ALL_LEAGUE_IDS, LEAGUE_IDS } from './utils';

const REQUEST_SAFETY_LIMIT = 7400;

// ─── Result ───────────────────────────────────────────────────────────────────

export interface RefreshResult {
  requestsUsed: number;
  fixtureCount: number;
  errors: string[];
  status: CacheMeta['status'];
}

// ─── Planner ──────────────────────────────────────────────────────────────────

export async function runDailyRefresh(): Promise<RefreshResult> {
  let requestsUsed = 0;
  const errors: string[] = [];
  const next7Days = api.getNextDaysStr(7); // bugün dahil 7 gün
  const today = next7Days[0];

  const cache = await getCache();

  function canRequest(count = 1): boolean {
    return requestsUsed + count <= REQUEST_SAFETY_LIMIT;
  }

  async function safe<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    if (!canRequest()) {
      errors.push(`Bütçe doldu, atlandı: ${label}`);
      return null;
    }
    try {
      const result = await fn();
      requestsUsed++;
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
      return null;
    }
  }

  // ── Phase 1: Standings (8 leagues) ──────────────────────────────────────────
  // API response format: response[0].league.standings = StandingEntry[][]
  const standingsByLeague: AppCache['standings']['byLeague'] = {};
  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`standings-${leagueId}`, () => api.getStandings(leagueId));
    if (res?.response?.length) {
      const leagueData = res.response[0] as unknown as { league: { standings: import('@/types/api-football').StandingEntry[][] } };
      if (leagueData?.league?.standings) {
        standingsByLeague[leagueId] = leagueData.league.standings;
      }
    }
  }
  cache.standings = { byLeague: standingsByLeague };
  await saveCache('standings', cache.standings);

  // ── Phase 2: Fixtures for next 7 days — 1 request per league (next param) ───
  // API /fixtures?league=X&season=Y&next=50 returns upcoming fixtures, no date loop needed
  const todayFixtures: Fixture[] = [];
  const tomorrowFixtures: Fixture[] = [];
  const allByLeague: Record<number, Fixture[]> = {};

  for (const leagueId of ALL_LEAGUE_IDS) {
    if (!canRequest()) break;
    const res = await safe(`fixtures-next20-${leagueId}`, () =>
      api.getFixturesNext(leagueId, 20)
    );
    if (res?.response?.length) {
      const fixtures = res.response;
      allByLeague[leagueId] = fixtures;

      for (const f of fixtures) {
        const fDate = f.fixture.date?.slice(0, 10);
        if (fDate === today) todayFixtures.push(f);
        else if (fDate === next7Days[1]) tomorrowFixtures.push(f);
      }
    }
  }

  // byDate: tüm maçları tarih bazında grupla
  const byDate: Record<string, Fixture[]> = {};
  for (const fixtures of Object.values(allByLeague)) {
    for (const f of fixtures) {
      const d = f.fixture.date?.slice(0, 10);
      if (d) {
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(f);
      }
    }
  }

  cache.fixtures = { today: todayFixtures, tomorrow: tomorrowFixtures, byLeague: allByLeague, byDate };
  await saveCache('fixtures', cache.fixtures);

  // ── Phase 4: Injuries (8 leagues) ───────────────────────────────────────────
  const injuriesByLeague: AppCache['injuries']['byLeague'] = {};
  const injuriesByTeam: AppCache['injuries']['byTeam'] = {};

  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`injuries-${leagueId}`, () => api.getInjuries(leagueId));
    if (res?.response?.length) {
      injuriesByLeague[leagueId] = res.response;
      for (const injury of res.response) {
        const tid = injury.team.id;
        if (!injuriesByTeam[tid]) injuriesByTeam[tid] = [];
        injuriesByTeam[tid].push(injury);
      }
    }
  }

  cache.injuries = { byLeague: injuriesByLeague, byTeam: injuriesByTeam };
  await saveCache('injuries', cache.injuries);

  // ── Phase 5: Odds — fixture bazlı, önümüzdeki 7 günün top maçları ───────────
  const allFixtures = Object.values(allByLeague).flat();
  const oddsByFixture: AppCache['odds']['byFixture'] = {};

  // Her lig için next param ile odds çek (tek istek/lig)
  const leaguesWithMatches = ALL_LEAGUE_IDS.filter((id) => (allByLeague[id]?.length ?? 0) > 0);

  for (const leagueId of leaguesWithMatches) {
    if (!canRequest()) break;
    const res = await safe(`odds-${leagueId}`, () => api.getOdds(leagueId));
    if (res?.response?.length) {
      for (const odd of res.response) {
        oddsByFixture[odd.fixture.id] = odd;
      }
    }
  }

  cache.odds = { byFixture: oddsByFixture };
  await saveCache('odds', cache.odds);

  // ── Phase 6: Predictions (top 10 fixtures by league priority) ───────────────
  const priorityLeagues = [LEAGUE_IDS.SUPER_LIG, LEAGUE_IDS.CHAMPIONS_LEAGUE, LEAGUE_IDS.PREMIER_LEAGUE, LEAGUE_IDS.LA_LIGA, LEAGUE_IDS.SERIE_A, LEAGUE_IDS.BUNDESLIGA, LEAGUE_IDS.LIGUE_1, LEAGUE_IDS.EUROPA_LEAGUE];
  const predictionFixtures = priorityLeagues
    .flatMap((id) => allByLeague[id] ?? []);

  const predictionsByFixture: AppCache['predictions']['byFixture'] = {};

  for (const fixture of predictionFixtures) {
    if (!canRequest()) break;
    const res = await safe(`prediction-${fixture.fixture.id}`, () => api.getPrediction(fixture.fixture.id));
    if (res?.response?.[0]) {
      predictionsByFixture[fixture.fixture.id] = res.response[0];
    }
  }

  cache.predictions = { byFixture: predictionsByFixture };
  await saveCache('predictions', cache.predictions);

  // ── Phase 7: H2H (top 5 fixtures) ───────────────────────────────────────────
  const h2hFixtures = allFixtures;
  const h2hByPair: AppCache['h2h']['byFixturePair'] = {};

  for (const fixture of h2hFixtures) {
    if (!canRequest()) break;
    const { home, away } = fixture.teams;
    const key = `${home.id}_${away.id}`;
    const res = await safe(`h2h-${key}`, () => api.getH2H(home.id, away.id, 10));
    if (res?.response?.length) {
      h2hByPair[key] = res.response;
    }
  }

  cache.h2h = { byFixturePair: h2hByPair };
  await saveCache('h2h', cache.h2h);

  // ── Phase 8: Team stats (up to 10 teams from upcoming matches) ───────────────
  const teamIds = new Set<number>();
  const teamLeagueMap = new Map<number, number>();

  for (const leagueId of priorityLeagues) {
    for (const fixture of (allByLeague[leagueId] ?? [])) {
      teamIds.add(fixture.teams.home.id);
      teamIds.add(fixture.teams.away.id);
      teamLeagueMap.set(fixture.teams.home.id, leagueId);
      teamLeagueMap.set(fixture.teams.away.id, leagueId);
    }
  }

  const teamStatsById: AppCache['teamStats']['byTeam'] = {};

  for (const teamId of teamIds) {
    if (!canRequest()) break;
    const leagueId = teamLeagueMap.get(teamId);
    if (!leagueId) continue;
    const res = await safe(`team-stats-${teamId}`, () => api.getTeamStatistics(teamId, leagueId));
    if (res?.response?.[0]) {
      teamStatsById[teamId] = res.response[0];
    }
  }

  cache.teamStats = { byTeam: teamStatsById };
  await saveCache('teamStats', cache.teamStats);

  // ── Phase 9: Recent results (last 10 finished fixtures per league) ───────────
  const resultsByLeague: AppCache['results']['byLeague'] = {};
  const resultsByFixture: AppCache['results']['byFixture'] = {};

  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`results-${leagueId}`, () => api.getFixturesLast(leagueId, 10));
    if (res?.response?.length) {
      resultsByLeague[leagueId] = res.response;
      for (const f of res.response) {
        resultsByFixture[f.fixture.id] = f;
      }
    }
  }

  cache.results = { byLeague: resultsByLeague, byFixture: resultsByFixture };
  await saveCache('results', cache.results);

  // ── Phase 10: Poisson (sıfır API isteği — teamStats + odds'tan hesaplanır) ──
  const poissonByFixture: AppCache['poisson']['byFixture'] = {};
  for (const fixture of allFixtures) {
    poissonByFixture[fixture.fixture.id] = buildPoissonResult(
      fixture.fixture.id,
      teamStatsById[fixture.teams.home.id],
      teamStatsById[fixture.teams.away.id],
      oddsByFixture[fixture.fixture.id]
    );
  }
  cache.poisson = { byFixture: poissonByFixture };
  await saveCache('poisson', cache.poisson);

  // ── Update meta ──────────────────────────────────────────────────────────────
  const fixtureCount = allFixtures.length;
  const now = new Date();
  const nextUpdate = new Date(now);
  nextUpdate.setDate(nextUpdate.getDate() + 1);
  nextUpdate.setHours(4, 0, 0, 0); // 04:00 UTC = 07:00 Turkey

  const meta: CacheMeta = {
    lastUpdated: now.toISOString(),
    nextUpdate: nextUpdate.toISOString(),
    requestsUsed,
    requestBudget: 7500,
    leagues: ALL_LEAGUE_IDS,
    fixtureCount,
    status: errors.length === 0 ? 'ok' : requestsUsed > 0 ? 'partial' : 'error',
    errorMessage: errors.length ? errors.join('; ') : undefined,
  };

  cache.meta = meta;
  await saveCache('meta', meta);

  return { requestsUsed, fixtureCount, errors, status: meta.status };
}
