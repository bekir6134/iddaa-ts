// ─── Primitives ───────────────────────────────────────────────────────────────

export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string;
}

export interface Team {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface Venue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface FixtureStatus {
  long: string;
  short: string; // NS, 1H, HT, 2H, FT, AET, PEN, SUSP, INT, ABD, AWD, WO, LIVE
  elapsed: number | null;
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

export interface FixtureInfo {
  id: number;
  referee: string | null;
  timezone: string;
  date: string; // ISO 8601
  timestamp: number;
  status: FixtureStatus;
  venue: Venue;
}

export interface FixtureScore {
  halftime: { home: number | null; away: number | null };
  fulltime: { home: number | null; away: number | null };
  extratime: { home: number | null; away: number | null };
  penalty: { home: number | null; away: number | null };
}

export interface Fixture {
  fixture: FixtureInfo;
  league: League;
  teams: { home: Team; away: Team };
  goals: { home: number | null; away: number | null };
  score: FixtureScore;
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export interface OddValue {
  value: string; // "Home" | "Draw" | "Away" | "Over 2.5" etc.
  odd: string; // numeric string e.g. "1.85"
  handicap: string | null;
  main: boolean | null;
  suspended: boolean;
}

export interface OddBet {
  id: number;
  name: string; // "Match Winner" | "Goals Over/Under" | "Both Teams Score"
  values: OddValue[];
}

export interface OddBookmaker {
  id: number;
  name: string;
  bets: OddBet[];
}

export interface FixtureOdds {
  fixture: { id: number };
  league: { id: number; season: number };
  update: string;
  bookmakers: OddBookmaker[];
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface PredictionTeamLast5 {
  form: string; // e.g. "WWDLW"
  att: string;
  def: string;
  goals: {
    for: { total: number; average: string };
    against: { total: number; average: string };
  };
}

export interface PredictionTeamLeague {
  form: string;
  fixtures: {
    played: { home: number; away: number; total: number };
    wins: { home: number; away: number; total: number };
    draws: { home: number; away: number; total: number };
    loses: { home: number; away: number; total: number };
  };
  goals: {
    for: {
      minute: Record<string, { total: number | null; percentage: string | null }>;
    };
    against: {
      minute: Record<string, { total: number | null; percentage: string | null }>;
    };
  };
}

export interface PredictionTeamForm {
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  last_5: PredictionTeamLast5;
  league: PredictionTeamLeague;
}

export interface Prediction {
  winner: { id: number | null; name: string | null; comment: string } | null;
  win_or_draw: boolean;
  under_over: string | null; // "+2.5" | "-2.5"
  goals: { home: string; away: string };
  advice: string;
  percent: { home: string; draw: string; away: string };
}

export interface PredictionComparison {
  form: { home: string; away: string };
  att: { home: string; away: string };
  def: { home: string; away: string };
  poisson_distribution: { home: string; away: string };
  h2h: { home: string; away: string };
  goals: { home: string; away: string };
  total: { home: string; away: string };
}

export interface FixturePrediction {
  fixture: { id: number };
  predictions: Prediction;
  league: Pick<League, 'id' | 'name' | 'country' | 'logo' | 'season'>;
  teams: {
    home: PredictionTeamForm;
    away: PredictionTeamForm;
  };
  comparison: PredictionComparison;
  h2h: Fixture[];
}

// ─── Injury ───────────────────────────────────────────────────────────────────

export interface InjuredPlayer {
  id: number;
  name: string;
  photo: string;
  type?: string;
  reason?: string;
}

export interface InjuryRecord {
  player: InjuredPlayer;
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  fixture: { id: number; timezone: string; date: string; timestamp: number };
  league: Pick<League, 'id' | 'name' | 'season'>;
  type: string; // "Missing Fixture" | "Questionable"
  reason: string; // e.g. "Knee Injury"
}

// ─── Standing ─────────────────────────────────────────────────────────────────

export interface StandingRecord {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
}

export interface StandingEntry {
  rank: number;
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  points: number;
  goalsDiff: number;
  group: string;
  form: string; // e.g. "WWDDL"
  status: string;
  description: string | null;
  all: StandingRecord;
  home: StandingRecord;
  away: StandingRecord;
  update: string;
}

// ─── Team Statistics ──────────────────────────────────────────────────────────

export interface TeamStatFixtures {
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  loses: { home: number; away: number; total: number };
}

export interface TeamStatGoals {
  for: {
    total: { home: number; away: number; total: number };
    average: { home: string; away: string; total: string };
    minute: Record<string, { total: number | null; percentage: string | null }>;
  };
  against: {
    total: { home: number; away: number; total: number };
    average: { home: string; away: string; total: string };
    minute: Record<string, { total: number | null; percentage: string | null }>;
  };
}

export interface TeamStatistics {
  league: Pick<League, 'id' | 'name' | 'country' | 'logo' | 'season'>;
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  form: string;
  fixtures: TeamStatFixtures;
  goals: TeamStatGoals;
  clean_sheet: { home: number; away: number; total: number };
  failed_to_score: { home: number; away: number; total: number };
  penalty: {
    scored: { total: number; percentage: string };
    missed: { total: number; percentage: string };
    total: number;
  };
  lineups: Array<{ formation: string; played: number }>;
  cards: {
    yellow: Record<string, { total: number | null; percentage: string | null }>;
    red: Record<string, { total: number | null; percentage: string | null }>;
  };
}

// ─── Fixture Statistics ───────────────────────────────────────────────────────

export interface FixtureStatValue {
  type: string;
  value: string | number | null;
}

export interface FixtureStatTeam {
  team: Pick<Team, 'id' | 'name' | 'logo'>;
  statistics: FixtureStatValue[];
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  get: string;
  parameters: Record<string, string | number>;
  errors: string[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}
