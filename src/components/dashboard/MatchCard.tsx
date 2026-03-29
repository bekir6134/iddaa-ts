'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Fixture } from '@/types/api-football';
import type { FixtureOdds, FixturePrediction } from '@/types/api-football';
import { Badge } from '@/components/ui/badge';
import { formatTurkeyTime, formatOdd, formatMatchDay, cn } from '@/lib/utils';

interface MatchCardProps {
  fixture: Fixture;
  odds?: FixtureOdds | null;
  prediction?: FixturePrediction | null;
}

function ConfidenceBadge({ percent }: { percent: number }) {
  if (percent >= 70) return <Badge className="bg-emerald-600 text-white text-xs">Yüksek</Badge>;
  if (percent >= 50) return <Badge className="bg-yellow-600 text-white text-xs">Orta</Badge>;
  return <Badge className="bg-slate-600 text-white text-xs">Düşük</Badge>;
}

function OddPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[52px]',
      highlight ? 'bg-emerald-600' : 'bg-slate-700'
    )}>
      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
      <span className={cn('text-sm font-bold', highlight ? 'text-white' : 'text-slate-200')}>{value}</span>
    </div>
  );
}

export function MatchCard({ fixture, odds, prediction }: MatchCardProps) {
  const { home, away } = fixture.teams;
  const matchWinner = odds?.bookmakers?.[0]?.bets?.find((b) => b.name === 'Match Winner');
  const odd1 = matchWinner?.values?.find((v) => v.value === 'Home')?.odd;
  const oddX = matchWinner?.values?.find((v) => v.value === 'Draw')?.odd;
  const odd2 = matchWinner?.values?.find((v) => v.value === 'Away')?.odd;

  const pred = prediction?.predictions;
  const homePct = pred ? parseFloat(pred.percent.home) : null;
  const drawPct = pred ? parseFloat(pred.percent.draw) : null;
  const awayPct = pred ? parseFloat(pred.percent.away) : null;
  const maxPct = homePct !== null ? Math.max(homePct!, drawPct!, awayPct!) : null;

  const winnerId = pred?.winner?.id;
  const highlightHome = winnerId === home.id;
  const highlightAway = winnerId === away.id;

  return (
    <Link href={`/mac-analizi/${fixture.fixture.id}`}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-emerald-500 transition-colors cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {fixture.league.logo && (
              <Image src={fixture.league.logo} alt={fixture.league.name} width={16} height={16} className="rounded-sm" />
            )}
            <span className="text-xs text-slate-400">{fixture.league.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{formatMatchDay(fixture.fixture.date)}</span>
            <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded text-slate-200">
              {formatTurkeyTime(fixture.fixture.date)}
            </span>
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-3 mb-3">
          {/* Home */}
          <div className={cn('flex items-center gap-2 flex-1 min-w-0', highlightHome && 'text-emerald-400')}>
            {home.logo && (
              <Image src={home.logo} alt={home.name} width={28} height={28} className="shrink-0" />
            )}
            <span className={cn('text-sm font-semibold truncate', highlightHome ? 'text-emerald-400' : 'text-slate-100')}>
              {home.name}
            </span>
          </div>

          {/* Score / VS */}
          <div className="shrink-0 text-center">
            {fixture.fixture.status.short === 'FT' ? (
              <span className="text-sm font-bold text-slate-200">
                {fixture.goals.home} - {fixture.goals.away}
              </span>
            ) : (
              <span className="text-xs text-slate-500 font-medium">vs</span>
            )}
          </div>

          {/* Away */}
          <div className={cn('flex items-center gap-2 flex-1 min-w-0 justify-end', highlightAway && 'text-emerald-400')}>
            <span className={cn('text-sm font-semibold truncate text-right', highlightAway ? 'text-emerald-400' : 'text-slate-100')}>
              {away.name}
            </span>
            {away.logo && (
              <Image src={away.logo} alt={away.name} width={28} height={28} className="shrink-0" />
            )}
          </div>
        </div>

        {/* Odds */}
        {(odd1 || odd2 || oddX) && (
          <div className="flex gap-2 justify-center mb-3">
            <OddPill label="1" value={formatOdd(odd1 ?? '0')} highlight={highlightHome} />
            <OddPill label="X" value={formatOdd(oddX ?? '0')} />
            <OddPill label="2" value={formatOdd(odd2 ?? '0')} highlight={highlightAway} />
          </div>
        )}

        {/* Prediction bar */}
        {homePct !== null && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{homePct}%</span>
              <span>{drawPct}%</span>
              <span>{awayPct}%</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500" style={{ width: `${homePct}%` }} />
              <div className="bg-slate-500" style={{ width: `${drawPct}%` }} />
              <div className="bg-blue-500" style={{ width: `${awayPct}%` }} />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] text-slate-400">{pred?.advice}</span>
              {maxPct !== null && <ConfidenceBadge percent={maxPct} />}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
