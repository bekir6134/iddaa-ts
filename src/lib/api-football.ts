import type { ApiResponse, Fixture, FixtureOdds, FixturePrediction, InjuryRecord, StandingEntry, TeamStatistics, FixtureStatTeam } from '@/types/api-football';
import { getTurkeyDate } from './utils';

const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';
const SEASON = process.env.CURRENT_SEASON ?? '2024';

function getHeaders() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST ?? 'api-football-v1.p.rapidapi.com';
  if (!key) throw new Error('RAPIDAPI_KEY env değişkeni tanımlı değil');
  return {
    'X-RapidAPI-Key': key,
    'X-RapidAPI-Host': host,
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

// ─── Helper: today + tomorrow dates ──────────────────────────────────────────

export function getTodayStr(): string {
  return getTurkeyDate();
}

export function getTomorrowStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getTurkeyDate(tomorrow);
}
