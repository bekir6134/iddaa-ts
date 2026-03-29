export type BetType = '1X2' | 'BTTS' | 'Over2.5' | 'Over1.5' | 'Under2.5' | 'DNB';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type RiskRating = 'low' | 'medium' | 'high' | 'very-high';

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
};

export const RISK_LABELS: Record<RiskRating, string> = {
  low: 'Düşük Risk',
  medium: 'Orta Risk',
  high: 'Yüksek Risk',
  'very-high': 'Çok Yüksek Risk',
};

export const BET_TYPE_LABELS: Record<BetType, string> = {
  '1X2': 'Maç Sonucu',
  'BTTS': 'KG Var/Yok',
  'Over2.5': '2.5 Üst',
  'Over1.5': '1.5 Üst',
  'Under2.5': '2.5 Alt',
  'DNB': 'Berabere İptal',
};

export interface ScoreBreakdown {
  predictionScore: number;  // 0-30
  formScore: number;        // 0-25
  h2hScore: number;         // 0-20
  homeAdvantageScore: number; // 0-15
  injuryImpactScore: number;  // -10 to 0
  total: number;            // 0-100
}

export interface CouponSelection {
  fixtureId: number;
  homeTeam: string;
  homeTeamLogo: string;
  awayTeam: string;
  awayTeamLogo: string;
  leagueName: string;
  leagueLogo: string;
  matchDate: string; // ISO
  betType: BetType;
  selection: string; // "Ev Sahibi" | "Beraberlik" | "Deplasman" | "Var" | "2.5 Üst" etc.
  odds: number;
  confidence: ConfidenceLevel;
  riskRating: RiskRating;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string[];
}

export interface CouponFilters {
  leagues: number[];
  minConfidence: ConfidenceLevel;
  betTypes: BetType[];
  minOdds: number;
  maxOdds: number;
  minSelections: number;
  maxSelections: number;
}

export interface GeneratedCoupon {
  id: string;
  selections: CouponSelection[];
  totalOdds: number;
  overallRisk: RiskRating;
  generatedAt: string;
}

export const DEFAULT_FILTERS: CouponFilters = {
  leagues: [],
  minConfidence: 'medium',
  betTypes: ['1X2', 'Over2.5', 'BTTS'],
  minOdds: 1.3,
  maxOdds: 4.0,
  minSelections: 3,
  maxSelections: 8,
};
