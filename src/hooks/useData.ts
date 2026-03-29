'use client';

import { useQuery } from '@tanstack/react-query';
import type { Fixture, FixtureOdds, FixturePrediction, InjuryRecord, StandingEntry, TeamStatistics } from '@/types/api-football';
import type { CacheMeta } from '@/types/cache';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Veri alınamadı: ${res.status}`);
  return res.json();
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function useMeta() {
  return useQuery<CacheMeta>({
    queryKey: ['meta'],
    queryFn: () => fetcher('/api/data/meta'),
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export function useTodayFixtures() {
  return useQuery<Fixture[]>({
    queryKey: ['fixtures', 'today'],
    queryFn: () => fetcher('/api/data/fixtures?day=today'),
  });
}

export function useTomorrowFixtures() {
  return useQuery<Fixture[]>({
    queryKey: ['fixtures', 'tomorrow'],
    queryFn: () => fetcher('/api/data/fixtures?day=tomorrow'),
  });
}

export function useWeekFixtures() {
  return useQuery<Record<string, Fixture[]>>({
    queryKey: ['fixtures', 'week'],
    queryFn: () => fetcher('/api/data/fixtures?week=1'),
  });
}

export function useLeagueFixtures(leagueId: number | null) {
  return useQuery<Fixture[]>({
    queryKey: ['fixtures', 'league', leagueId],
    queryFn: () => fetcher(`/api/data/fixtures?league=${leagueId}`),
    enabled: leagueId !== null,
  });
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export function useAllOdds() {
  return useQuery<Record<number, FixtureOdds>>({
    queryKey: ['odds'],
    queryFn: () => fetcher('/api/data/odds'),
  });
}

export function useFixtureOdds(fixtureId: number | null) {
  return useQuery<FixtureOdds | null>({
    queryKey: ['odds', fixtureId],
    queryFn: () => fetcher(`/api/data/odds?fixture=${fixtureId}`),
    enabled: fixtureId !== null,
  });
}

// ─── Predictions ──────────────────────────────────────────────────────────────

export function useAllPredictions() {
  return useQuery<Record<number, FixturePrediction>>({
    queryKey: ['predictions'],
    queryFn: () => fetcher('/api/data/predictions'),
  });
}

export function useFixturePrediction(fixtureId: number | null) {
  return useQuery<FixturePrediction | null>({
    queryKey: ['predictions', fixtureId],
    queryFn: () => fetcher(`/api/data/predictions?fixture=${fixtureId}`),
    enabled: fixtureId !== null,
  });
}

// ─── Injuries ─────────────────────────────────────────────────────────────────

export function useLeagueInjuries(leagueId: number | null) {
  return useQuery<InjuryRecord[]>({
    queryKey: ['injuries', 'league', leagueId],
    queryFn: () => fetcher(`/api/data/injuries?league=${leagueId}`),
    enabled: leagueId !== null,
  });
}

export function useTeamInjuries(teamId: number | null) {
  return useQuery<InjuryRecord[]>({
    queryKey: ['injuries', 'team', teamId],
    queryFn: () => fetcher(`/api/data/injuries?team=${teamId}`),
    enabled: teamId !== null,
  });
}

export function useAllInjuries() {
  return useQuery<{ byLeague: Record<number, InjuryRecord[]>; byTeam: Record<number, InjuryRecord[]> }>({
    queryKey: ['injuries'],
    queryFn: () => fetcher('/api/data/injuries'),
  });
}

// ─── Standings ────────────────────────────────────────────────────────────────

export function useStandings(leagueId: number | null) {
  return useQuery<StandingEntry[][]>({
    queryKey: ['standings', leagueId],
    queryFn: () => fetcher(`/api/data/standings?league=${leagueId}`),
    enabled: leagueId !== null,
  });
}

export function useAllStandings() {
  return useQuery<Record<number, StandingEntry[][]>>({
    queryKey: ['standings'],
    queryFn: () => fetcher('/api/data/standings'),
  });
}

// ─── H2H ──────────────────────────────────────────────────────────────────────

export function useH2H(team1Id: number | null, team2Id: number | null) {
  return useQuery<Fixture[]>({
    queryKey: ['h2h', team1Id, team2Id],
    queryFn: () => fetcher(`/api/data/h2h?pair=${team1Id}_${team2Id}`),
    enabled: team1Id !== null && team2Id !== null,
  });
}

// ─── Team Stats ───────────────────────────────────────────────────────────────

export function useTeamStats(teamId: number | null) {
  return useQuery<TeamStatistics | null>({
    queryKey: ['team-stats', teamId],
    queryFn: () => fetcher(`/api/data/team-stats?team=${teamId}`),
    enabled: teamId !== null,
  });
}
