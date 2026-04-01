'use client';

import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isValueBet, percentToFloat, formatOdd, getTurkeyDate, LEAGUE_NAMES, cn } from '@/lib/utils';
import type { Fixture, FixtureOdds, FixturePrediction } from '@/types/api-football';
import Link from 'next/link';

interface Props {
  fixtures: Fixture[];
  allOdds: Record<number, FixtureOdds> | undefined;
  allPredictions: Record<number, FixturePrediction> | undefined;
}

interface ValueBetHit {
  fixture: Fixture;
  label: string;
  odd: string;
  edge: number; // predicted prob - implied prob
}

export function ValueBetAlert({ fixtures, allOdds, allPredictions }: Props) {
  const hits = useMemo((): ValueBetHit[] => {
    if (!allOdds || !allPredictions) return [];

    const today = getTurkeyDate();
    const todayFixtures = fixtures.filter((f) => f.fixture.date?.slice(0, 10) === today);
    const results: ValueBetHit[] = [];

    for (const f of todayFixtures) {
      const odds = allOdds[f.fixture.id];
      const pred = allPredictions[f.fixture.id];
      if (!odds || !pred) continue;

      const mw = odds.bookmakers?.[0]?.bets?.find((b) => b.name === 'Match Winner');
      const homePct = percentToFloat(pred.predictions.percent.home);
      const drawPct = percentToFloat(pred.predictions.percent.draw);
      const awayPct = percentToFloat(pred.predictions.percent.away);

      const checks: { value: string; pct: number; label: string }[] = [
        { value: 'Home', pct: homePct, label: '1 (Ev)' },
        { value: 'Draw', pct: drawPct, label: 'X (Beraberlik)' },
        { value: 'Away', pct: awayPct, label: '2 (Deplasman)' },
      ];

      for (const { value, pct, label } of checks) {
        const oddVal = mw?.values?.find((v) => v.value === value)?.odd;
        if (!oddVal || !pct) continue;
        const oddNum = parseFloat(oddVal);
        if (isValueBet(oddNum, pct)) {
          results.push({
            fixture: f,
            label,
            odd: oddVal,
            edge: pct - 1 / oddNum,
          });
        }
      }
    }

    return results.sort((a, b) => b.edge - a.edge).slice(0, 4);
  }, [fixtures, allOdds, allPredictions]);

  if (hits.length === 0) return null;

  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-yellow-400" />
        <span className="font-semibold text-yellow-300 text-sm">Bugünün Value Bet Fırsatları</span>
        <Badge className="bg-yellow-700 text-yellow-200 text-[10px]">{hits.length} maç</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {hits.map((hit, i) => (
          <Link
            key={`${hit.fixture.fixture.id}-${i}`}
            href={`/mac-analizi/${hit.fixture.fixture.id}`}
            className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 hover:bg-slate-700/60 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{LEAGUE_NAMES[hit.fixture.league.id] ?? hit.fixture.league.name}</p>
              <p className="text-sm text-slate-200 font-medium truncate">
                {hit.fixture.teams.home.name} <span className="text-slate-500">vs</span> {hit.fixture.teams.away.name}
              </p>
            </div>
            <div className="ml-3 text-right shrink-0">
              <p className="text-yellow-400 font-bold text-sm">{formatOdd(hit.odd)}</p>
              <p className={cn('text-[10px] font-medium', hit.label.startsWith('1') ? 'text-emerald-400' : hit.label.startsWith('X') ? 'text-slate-400' : 'text-blue-400')}>{hit.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
