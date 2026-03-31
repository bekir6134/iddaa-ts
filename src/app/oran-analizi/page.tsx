'use client';

import { useState } from 'react';
import { useWeekFixtures, useAllOdds, useAllPredictions } from '@/hooks/useData';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTurkeyTime, formatOdd, LEAGUE_NAMES, cn, isValueBet, percentToFloat } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import type { Fixture } from '@/types/api-football';

export default function OranAnaliziPage() {
  const [leagueFilter, setLeagueFilter] = useState(0);
  const [sortBy, setSortBy] = useState<'time' | 'value'>('value');

  const { data: weekFixtures, isLoading } = useWeekFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();

  const allFixtures = Object.values(weekFixtures ?? {}).flat();

  const filtered = allFixtures.filter((f) =>
    leagueFilter === 0 ? true : f.league.id === leagueFilter
  );

  const counts: Record<number, number> = {};
  allFixtures.forEach((f) => { counts[f.league.id] = (counts[f.league.id] ?? 0) + 1; });

  const withOdds = filtered.filter((f) => allOdds?.[f.fixture.id]);

  const sorted = [...withOdds].sort((a, b) => {
    if (sortBy === 'time') return a.fixture.timestamp - b.fixture.timestamp;
    // Sort by "value bet" score: largest gap between implied prob and our prediction
    const scoreA = getValueScore(a, allOdds, allPredictions);
    const scoreB = getValueScore(b, allOdds, allPredictions);
    return scoreB - scoreA;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Oran Analizi</h1>
      <p className="text-slate-400 text-sm mb-6">Bookmaker oranları ve value bet tespiti</p>

      {/* Açıklama */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4 text-sm text-slate-400 space-y-1">
        <p><span className="text-yellow-400 font-semibold">Sarı (Value Bet)</span> — Bookmaker oranının gerçek olasılıktan düşük olduğunu gösterir. API tahminiyle implied probability arasındaki fark &gt;%5 ise işaretlenir.</p>
        <p><span className="text-slate-200 font-semibold">1 / X / 2</span> — Ev sahibi kazanır / Beraberlik / Deplasman kazanır</p>
        <p><span className="text-slate-200 font-semibold">2.5 Üst</span> — Maçta 3 veya daha fazla gol atılır</p>
        <p><span className="text-slate-200 font-semibold">2.5 Alt</span> — Maçta 2 veya daha az gol atılır</p>
        <p><span className="text-slate-200 font-semibold">KG Var</span> — Her iki takım da en az 1 gol atar (Karşılıklı Gol)</p>
      </div>

      <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} counts={counts} />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSortBy('value')}
          className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors', sortBy === 'value' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-emerald-500')}
        >
          Değer Bahis Sıralı
        </button>
        <button
          onClick={() => setSortBy('time')}
          className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors', sortBy === 'time' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-emerald-500')}
        >
          Saat Sıralı
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-slate-800" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500">Oran verisi bulunan maç yok</div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900 text-xs text-slate-400">
                  <th className="text-left p-3">Maç</th>
                  <th className="text-center p-3">Saat</th>
                  <th className="text-center p-3">1</th>
                  <th className="text-center p-3">X</th>
                  <th className="text-center p-3">2</th>
                  <th className="text-center p-3">2.5 Üst</th>
                  <th className="text-center p-3">2.5 Alt</th>
                  <th className="text-center p-3">KG Var</th>
                  <th className="text-center p-3">Değer</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f, i) => {
                  const odds = allOdds![f.fixture.id]!;
                  const pred = allPredictions?.[f.fixture.id];
                  const bets = odds.bookmakers?.[0]?.bets ?? [];

                  const mw = bets.find((b) => b.name === 'Match Winner');
                  const ou = bets.find((b) => b.name === 'Goals Over/Under');
                  const btts = bets.find((b) => b.name === 'Both Teams Score');

                  const odd1 = mw?.values?.find((v) => v.value === 'Home')?.odd;
                  const oddX = mw?.values?.find((v) => v.value === 'Draw')?.odd;
                  const odd2 = mw?.values?.find((v) => v.value === 'Away')?.odd;
                  const over25 = ou?.values?.find((v) => v.value === 'Over 2.5')?.odd;
                  const under25 = ou?.values?.find((v) => v.value === 'Under 2.5')?.odd;
                  const bttsYes = btts?.values?.find((v) => v.value === 'Yes')?.odd;

                  const homePct = pred ? percentToFloat(pred.predictions.percent.home) : 0;
                  const drawPct = pred ? percentToFloat(pred.predictions.percent.draw) : 0;
                  const awayPct = pred ? percentToFloat(pred.predictions.percent.away) : 0;
                  // Üst/Alt ve KG tahmini: under_over ve goals alanlarından
                  const underOverLabel = pred?.predictions?.under_over ?? '';
                  const over25Pct = underOverLabel === 'Over' ? 0.65 : underOverLabel === 'Under' ? 0.35 : 0;
                  const under25Pct = underOverLabel === 'Under' ? 0.65 : underOverLabel === 'Over' ? 0.35 : 0;
                  // KG Var: iki takım da gol atacaksa homePct + awayPct yüksek demek
                  const bttsPct = homePct > 0 && awayPct > 0 ? Math.min(homePct, awayPct) * 1.5 : 0;

                  const isHomeValue = odd1 && homePct > 0 && isValueBet(parseFloat(odd1), homePct);
                  const isDrawValue = oddX && drawPct > 0 && isValueBet(parseFloat(oddX), drawPct);
                  const isAwayValue = odd2 && awayPct > 0 && isValueBet(parseFloat(odd2), awayPct);
                  const isOver25Value = over25 && over25Pct > 0 && isValueBet(parseFloat(over25), over25Pct);
                  const isUnder25Value = under25 && under25Pct > 0 && isValueBet(parseFloat(under25), under25Pct);
                  const isBttsValue = bttsYes && bttsPct > 0 && isValueBet(parseFloat(bttsYes), bttsPct);
                  const hasAnyValue = isHomeValue || isDrawValue || isAwayValue || isOver25Value || isUnder25Value || isBttsValue;

                  return (
                    <tr key={f.fixture.id} className={cn('border-b border-slate-700/50', i % 2 === 0 ? '' : 'bg-slate-800/50')}>
                      <td className="p-3">
                        <Link href={`/mac-analizi/${f.fixture.id}`} className="hover:text-emerald-400 transition-colors">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {f.league.logo && <Image src={f.league.logo} alt="" width={12} height={12} />}
                            <span className="text-xs text-slate-500">{LEAGUE_NAMES[f.league.id] ?? f.league.name}</span>
                          </div>
                          <span className="text-slate-200 font-medium">{f.teams.home.name} <span className="text-slate-500">vs</span> {f.teams.away.name}</span>
                        </Link>
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono text-xs">{formatTurkeyTime(f.fixture.date)}</td>
                      <OddCell value={odd1} highlight={!!isHomeValue} />
                      <OddCell value={oddX} highlight={!!isDrawValue} />
                      <OddCell value={odd2} highlight={!!isAwayValue} />
                      <OddCell value={over25} highlight={!!isOver25Value} />
                      <OddCell value={under25} highlight={!!isUnder25Value} />
                      <OddCell value={bttsYes} highlight={!!isBttsValue} />
                      <td className="p-3 text-center">
                        {hasAnyValue ? (
                          <Badge className="bg-yellow-600 text-white text-xs">Değer</Badge>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OddCell({ value, highlight }: { value?: string; highlight?: boolean }) {
  return (
    <td className={cn('p-3 text-center font-bold', highlight ? 'text-yellow-400' : 'text-slate-300')}>
      {value ? (
        <span className={cn('px-2 py-0.5 rounded', highlight ? 'bg-yellow-900/40' : '')}>
          {formatOdd(value)}
        </span>
      ) : <span className="text-slate-600">-</span>}
    </td>
  );
}

function getValueScore(
  fixture: Fixture,
  allOdds: Record<number, import('@/types/api-football').FixtureOdds> | undefined,
  allPredictions: Record<number, import('@/types/api-football').FixturePrediction> | undefined
): number {
  const odds = allOdds?.[fixture.fixture.id];
  const pred = allPredictions?.[fixture.fixture.id];
  if (!odds || !pred) return 0;

  const mw = odds.bookmakers?.[0]?.bets?.find((b) => b.name === 'Match Winner');
  const odd1 = mw?.values?.find((v) => v.value === 'Home')?.odd;
  const odd2 = mw?.values?.find((v) => v.value === 'Away')?.odd;
  const homePct = percentToFloat(pred.predictions.percent.home);
  const awayPct = percentToFloat(pred.predictions.percent.away);

  let score = 0;
  if (odd1 && homePct > 0) score += Math.max(0, homePct - 1 / parseFloat(odd1));
  if (odd2 && awayPct > 0) score += Math.max(0, awayPct - 1 / parseFloat(odd2));
  return score;
}
