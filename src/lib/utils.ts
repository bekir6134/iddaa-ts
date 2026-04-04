import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Turkey Timezone Helpers ──────────────────────────────────────────────────

export const TURKEY_TZ = 'Europe/Istanbul';

export function getTurkeyDate(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? parseISO(date) : date) : new Date();
  return formatInTimeZone(d, TURKEY_TZ, 'yyyy-MM-dd');
}

export function getTurkeyNow(): Date {
  return toZonedTime(new Date(), TURKEY_TZ);
}

export function formatTurkeyTime(isoDate: string): string {
  return formatInTimeZone(parseISO(isoDate), TURKEY_TZ, 'HH:mm');
}

export function formatTurkeyDateTime(isoDate: string): string {
  return formatInTimeZone(parseISO(isoDate), TURKEY_TZ, 'dd MMM yyyy HH:mm', { locale: tr });
}

export function formatMatchDay(isoDate: string): string {
  const d = toZonedTime(parseISO(isoDate), TURKEY_TZ);
  if (isToday(d)) return 'Bugün';
  if (isTomorrow(d)) return 'Yarın';
  return format(d, 'dd MMM', { locale: tr });
}

export function isTodayTurkey(isoDate: string): boolean {
  return getTurkeyDate(isoDate) === getTurkeyDate();
}

export function isTomorrowTurkey(isoDate: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getTurkeyDate(isoDate) === getTurkeyDate(tomorrow);
}

// ─── Odds Helpers ─────────────────────────────────────────────────────────────

export function parseOdd(odd: string | number): number {
  return typeof odd === 'string' ? parseFloat(odd) : odd;
}

export function isValueBet(odd: number, impliedProbability: number): boolean {
  const bookmakerProb = 1 / odd;
  return impliedProbability > bookmakerProb;
}

export function percentToFloat(pct: string): number {
  return parseFloat(pct.replace('%', '')) / 100;
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

export function formToPoints(form: string): number {
  return form.split('').reduce((acc, c) => {
    if (c === 'W') return acc + 3;
    if (c === 'D') return acc + 1;
    return acc;
  }, 0);
}

export function formToColor(char: string): string {
  if (char === 'W') return 'bg-green-500';
  if (char === 'D') return 'bg-yellow-500';
  if (char === 'L') return 'bg-red-500';
  return 'bg-gray-400';
}

export function getFormColor(points: number, max: number): string {
  if (max === 0) return 'text-slate-400';
  const ratio = points / max;
  if (ratio >= 0.67) return 'text-emerald-400';
  if (ratio >= 0.34) return 'text-yellow-400';
  return 'text-red-400';
}

// ─── League Constants ─────────────────────────────────────────────────────────

export const LEAGUE_IDS = {
  SUPER_LIG: 203,
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  SERIE_A: 135,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
} as const;

export const LEAGUE_NAMES: Record<number, string> = {
  203: 'Süper Lig',
  39: 'Premier League',
  140: 'La Liga',
  78: 'Bundesliga',
  61: 'Ligue 1',
  135: 'Serie A',
  2: 'Şampiyonlar Ligi',
  3: 'Avrupa Ligi',
};

export const ALL_LEAGUE_IDS = Object.values(LEAGUE_IDS);

// ─── Score Helpers ────────────────────────────────────────────────────────────

export function formatScore(home: number | null, away: number | null): string {
  if (home === null || away === null) return 'vs';
  return `${home} - ${away}`;
}

export function getMatchResult(
  home: number | null,
  away: number | null
): 'home' | 'draw' | 'away' | null {
  if (home === null || away === null) return null;
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function formatOdd(odd: number | string): string {
  return parseFloat(String(odd)).toFixed(2);
}

export function formatPercent(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `%${Math.round(num)}`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}
