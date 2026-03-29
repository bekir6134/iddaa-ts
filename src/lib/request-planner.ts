import * as api from './api-football';
import { saveCache, getCache } from './data-cache';
import type { AppCache, CacheMeta } from '@/types/cache';
import type { Fixture } from '@/types/api-football';
import { ALL_LEAGUE_IDS, LEAGUE_IDS } from './utils';

const REQUEST_SAFETY_LIMIT = 95;

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
  const today = api.getTodayStr();
  const tomorrow = api.getTomorrowStr();

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
  const standingsByLeague: AppCache['standings']['byLeague'] = {};
  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`standings-${leagueId}`, () => api.getStandings(leagueId));
    if (res?.response?.length) {
      standingsByLeague[leagueId] = res.response as unknown as import('@/types/api-football').StandingEntry[][];
    }
  }
  cache.standings = { byLeague: standingsByLeague };
  await saveCache('standings', cache.standings);

  // ── Phase 2: Today's fixtures (8 leagues) ───────────────────────────────────
  const todayFixtures: Fixture[] = [];
  const byLeagueToday: Record<number, Fixture[]> = {};

  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`fixtures-today-${leagueId}`, () => api.getFixtures(leagueId, today));
    if (res?.response?.length) {
      byLeagueToday[leagueId] = res.response;
      todayFixtures.push(...res.response);
    }
  }

  // ── Phase 3: Tomorrow's fixtures (8 leagues) ─────────────────────────────────
  const tomorrowFixtures: Fixture[] = [];
  const byLeagueTomorrow: Record<number, Fixture[]> = {};

  for (const leagueId of ALL_LEAGUE_IDS) {
    const res = await safe(`fixtures-tomorrow-${leagueId}`, () => api.getFixtures(leagueId, tomorrow));
    if (res?.response?.length) {
      byLeagueTomorrow[leagueId] = res.response;
      tomorrowFixtures.push(...res.response);
    }
  }

  // Merge byLeague (today + tomorrow)
  const allByLeague: Record<number, Fixture[]> = {};
  for (const leagueId of ALL_LEAGUE_IDS) {
    allByLeague[leagueId] = [
      ...(byLeagueToday[leagueId] ?? []),
      ...(byLeagueTomorrow[leagueId] ?? []),
    ];
  }

  cache.fixtures = { today: todayFixtures, tomorrow: tomorrowFixtures, byLeague: allByLeague };
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

  // ── Phase 5: Odds (leagues with today's matches, up to 3 fixtures/league) ───
  const allFixtures = [...todayFixtures, ...tomorrowFixtures];
  const oddsByFixture: AppCache['odds']['byFixture'] = {};

  // Get up to 15 odds requests across leagues
  const leaguesWithMatches = ALL_LEAGUE_IDS.filter(
    (id) => (byLeagueToday[id]?.length ?? 0) > 0 || (byLeagueTomorrow[id]?.length ?? 0) > 0
  );

  for (const leagueId of leaguesWithMatches) {
    if (!canRequest()) break;
    const res = await safe(`odds-${leagueId}`, () => api.getOdds(leagueId, today));
    if (res?.response?.length) {
      for (const odd of res.response) {
        oddsByFixture[odd.fixture.id] = odd;
      }
    }
    // also tomorrow
    if (canRequest()) {
      const res2 = await safe(`odds-tomorrow-${leagueId}`, () => api.getOdds(leagueId, tomorrow));
      if (res2?.response?.length) {
        for (const odd of res2.response) {
          oddsByFixture[odd.fixture.id] = odd;
        }
      }
    }
  }

  cache.odds = { byFixture: oddsByFixture };
  await saveCache('odds', cache.odds);

  // ── Phase 6: Predictions (top 10 fixtures by league priority) ───────────────
  const priorityLeagues = [LEAGUE_IDS.SUPER_LIG, LEAGUE_IDS.CHAMPIONS_LEAGUE, LEAGUE_IDS.PREMIER_LEAGUE, LEAGUE_IDS.LA_LIGA, LEAGUE_IDS.SERIE_A, LEAGUE_IDS.BUNDESLIGA, LEAGUE_IDS.LIGUE_1, LEAGUE_IDS.EUROPA_LEAGUE];
  const predictionFixtures = priorityLeagues
    .flatMap((id) => byLeagueToday[id] ?? [])
    .slice(0, 10);

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
  const h2hFixtures = allFixtures.slice(0, 5);
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
    for (const fixture of (byLeagueToday[leagueId] ?? []).slice(0, 2)) {
      teamIds.add(fixture.teams.home.id);
      teamIds.add(fixture.teams.away.id);
      teamLeagueMap.set(fixture.teams.home.id, leagueId);
      teamLeagueMap.set(fixture.teams.away.id, leagueId);
      if (teamIds.size >= 10) break;
    }
    if (teamIds.size >= 10) break;
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

  // ── Update meta ──────────────────────────────────────────────────────────────
  const fixtureCount = todayFixtures.length + tomorrowFixtures.length;
  const now = new Date();
  const nextUpdate = new Date(now);
  nextUpdate.setDate(nextUpdate.getDate() + 1);
  nextUpdate.setHours(4, 0, 0, 0); // 04:00 UTC = 07:00 Turkey

  const meta: CacheMeta = {
    lastUpdated: now.toISOString(),
    nextUpdate: nextUpdate.toISOString(),
    requestsUsed,
    requestBudget: 100,
    leagues: ALL_LEAGUE_IDS,
    fixtureCount,
    status: errors.length === 0 ? 'ok' : requestsUsed > 0 ? 'partial' : 'error',
    errorMessage: errors.length ? errors.join('; ') : undefined,
  };

  cache.meta = meta;
  await saveCache('meta', meta);

  return { requestsUsed, fixtureCount, errors, status: meta.status };
}
