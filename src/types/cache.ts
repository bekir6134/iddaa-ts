import type {
  Fixture,
  FixtureOdds,
  FixturePrediction,
  InjuryRecord,
  StandingEntry,
  TeamStatistics,
} from './api-football';

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface CacheMeta {
  lastUpdated: string; // ISO timestamp
  nextUpdate: string;  // ISO timestamp
  requestsUsed: number;
  requestBudget: number; // always 100
  leagues: number[];
  fixtureCount: number;
  status: 'ok' | 'partial' | 'stale' | 'error';
  errorMessage?: string;
}

// ─── Cache Slices ─────────────────────────────────────────────────────────────

export interface FixturesCache {
  today: Fixture[];
  tomorrow: Fixture[];
  byLeague: Record<number, Fixture[]>;
}

export interface OddsCache {
  byFixture: Record<number, FixtureOdds>;
}

export interface PredictionsCache {
  byFixture: Record<number, FixturePrediction>;
}

export interface InjuriesCache {
  byLeague: Record<number, InjuryRecord[]>;
  byTeam: Record<number, InjuryRecord[]>;
}

export interface StandingsCache {
  byLeague: Record<number, StandingEntry[][]>; // outer = groups
}

export interface H2HCache {
  byFixturePair: Record<string, Fixture[]>; // key = "teamA_teamB"
}

export interface TeamStatsCache {
  byTeam: Record<number, TeamStatistics>;
}

// ─── Root Cache ───────────────────────────────────────────────────────────────

export interface AppCache {
  meta: CacheMeta;
  fixtures: FixturesCache;
  odds: OddsCache;
  predictions: PredictionsCache;
  injuries: InjuriesCache;
  standings: StandingsCache;
  h2h: H2HCache;
  teamStats: TeamStatsCache;
}

// ─── Storage Adapter ──────────────────────────────────────────────────────────

export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  readBinary(key: string): Promise<Buffer | null>;
  writeBinary(key: string, buffer: Buffer): Promise<void>;
}
