import type { ApiResponse, Fixture, FixtureOdds, FixturePrediction, InjuryRecord, StandingEntry, TeamStatistics, FixtureStatTeam } from '@/types/api-football';
import { getTurkeyDate } from './utils';

const BASE_URL = 'https://v3.football.api-sports.io';
const SEASON = process.env.CURRENT_SEASON ?? '2025';

function getHeaders() {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new Error('API_SPORTS_KEY env değişkeni tanımlı değil');
  return {
    'x-apisports-key': key,
  };
}

async function apiFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`API isteği başarısız: ${res.status} ${res.statusText} — ${url.toString()}`);
  }

  return res.json() as Promise<ApiResponse<T>>;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export async function getFixtures(leagueId: number, date?: string): Promise<ApiResponse<Fixture>> {
  const params: Record<string, string | number> = {
    league: leagueId,
    season: SEASON,
  };
  if (date) params.date = date;
  return apiFetch<Fixture>('/fixtures', params);
}

export async function getFixtureById(fixtureId: number): Promise<ApiResponse<Fixture>> {
  return apiFetch<Fixture>('/fixtures', { id: fixtureId });
}

// Bir ligi önümüzdeki N maçını çek (tarih döngüsü olmadan tek istek)
export async function getFixturesNext(leagueId: number, count = 20): Promise<ApiResponse<Fixture>> {
  return apiFetch<Fixture>('/fixtures', {
    league: leagueId,
    season: SEASON,
    next: count,
  });
}

// Son oynanan N maçı çek (free plan için — next parametresi desteklenmiyor)
export async function getFixturesLast(leagueId: number, count = 20): Promise<ApiResponse<Fixture>> {
  return apiFetch<Fixture>('/fixtures', {
    league: leagueId,
    season: SEASON,
    last: count,
  });
}

export async function getH2H(team1Id: number, team2Id: number, last = 10): Promise<ApiResponse<Fixture>> {
  return apiFetch<Fixture>('/fixtures/headtohead', {
    h2h: `${team1Id}-${team2Id}`,
    last,
  });
}

export async function getFixtureStatistics(fixtureId: number): Promise<ApiResponse<FixtureStatTeam>> {
  return apiFetch<FixtureStatTeam>('/fixtures/statistics', { fixture: fixtureId });
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export async function getOdds(leagueId: number, date?: string): Promise<ApiResponse<FixtureOdds>> {
  const params: Record<string, string | number> = {
    league: leagueId,
    season: SEASON,
  };
  if (date) params.date = date;
  return apiFetch<FixtureOdds>('/odds', params);
}

export async function getOddsByFixture(fixtureId: number): Promise<ApiResponse<FixtureOdds>> {
  return apiFetch<FixtureOdds>('/odds', { fixture: fixtureId });
}

// ─── Predictions ──────────────────────────────────────────────────────────────

export async function getPrediction(fixtureId: number): Promise<ApiResponse<FixturePrediction>> {
  return apiFetch<FixturePrediction>('/predictions', { fixture: fixtureId });
}

// ─── Injuries ─────────────────────────────────────────────────────────────────

export async function getInjuries(leagueId: number): Promise<ApiResponse<InjuryRecord>> {
  return apiFetch<InjuryRecord>('/injuries', {
    league: leagueId,
    season: SEASON,
  });
}

// ─── Standings ────────────────────────────────────────────────────────────────

export async function getStandings(leagueId: number): Promise<ApiResponse<StandingEntry[][]>> {
  return apiFetch<StandingEntry[][]>('/standings', {
    league: leagueId,
    season: SEASON,
  });
}

// ─── Team Statistics ──────────────────────────────────────────────────────────

export async function getTeamStatistics(teamId: number, leagueId: number): Promise<ApiResponse<TeamStatistics>> {
  return apiFetch<TeamStatistics>('/teams/statistics', {
    team: teamId,
    league: leagueId,
    season: SEASON,
  });
}

// ─── Helper: date utilities ───────────────────────────────────────────────────

export function getTodayStr(): string {
  return getTurkeyDate();
}

export function getTomorrowStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getTurkeyDate(tomorrow);
}

export function getNextDaysStr(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return getTurkeyDate(d);
  });
}
