'use client';

import { useState, useMemo } from 'react';
import { useWeekFixtures, useAllPredictions, useAllStandings, useAllOdds, useAllInjuries, useAllH2H, useAllTeamStats } from '@/hooks/useData';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LEAGUE_IDS, LEAGUE_NAMES, cn } from '@/lib/utils';
import { rankSelections } from '@/lib/coupon-engine';
import { CONFIDENCE_LABELS, BET_TYPE_LABELS } from '@/types/coupon';
import type { AppCache } from '@/types/cache';
import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#6b7280', '#3b82f6'];

export default function IstatistiklerPage() {
  const [selectedLeague, setSelectedLeague] = useState(203);

  const { data: weekFixtures, isLoading: loadingFixtures } = useWeekFixtures();
  const { data: allPredictions } = useAllPredictions();
  const { data: allStandings } = useAllStandings();
  const { data: allOdds } = useAllOdds();
  const { data: allInjuries } = useAllInjuries();
  const { data: allH2H } = useAllH2H();
  const { data: allTeamStats } = useAllTeamStats();

  const allFixtures = useMemo(() => Object.values(weekFixtures ?? {}).flat(), [weekFixtures]);

  // ── Top picks via coupon engine ──────────────────────────────────────────────
  const topPicks = useMemo(() => {
    if (!weekFixtures || !allOdds) return [];
    const cache: AppCache = {
      fixtures: { today: [], tomorrow: [], byLeague: {}, byDate: weekFixtures },
      odds: { byFixture: allOdds },
      predictions: { byFixture: allPredictions ?? {} },
      injuries: allInjuries ?? { byLeague: {}, byTeam: {} },
      h2h: { byFixturePair: allH2H ?? {} },
      teamStats: { byTeam: allTeamStats ?? {} },
      standings: { byLeague: {} },
      meta: undefined as never,
    };
    return rankSelections(cache, ['1X2', 'Over2.5', 'Over1.5', 'BTTS']).slice(0, 20);
  }, [weekFixtures, allOdds, allPredictions, allInjuries, allH2H, allTeamStats]);

  // ── Prediction distribution (bu hafta) ──────────────────────────────────────
  const predDist = { home: 0, draw: 0, away: 0 };
  let predCount = 0;
  for (const [, pred] of Object.entries(allPredictions ?? {})) {
    if (!pred?.predictions?.winner?.id) continue;
    const fid = pred.fixture?.id;
    if (!fid) continue;
    const fixture = allFixtures.find((f) => f.fixture?.id === fid);
    if (!fixture?.teams?.home?.id || !fixture?.teams?.away?.id) continue;
    if (pred.predictions.winner.id === fixture.teams.home.id) predDist.home++;
    else if (pred.predictions.winner.id === fixture.teams.away.id) predDist.away++;
    else predDist.draw++;
    predCount++;
  }

  const pieData = [
    { name: 'Ev Sahibi', value: predDist.home },
    { name: 'Beraberlik', value: predDist.draw },
    { name: 'Deplasman', value: predDist.away },
  ].filter((d) => d.value > 0);

  // ── Goals per league ─────────────────────────────────────────────────────────
  const goalsData = Object.entries(allStandings ?? {}).map(([idStr, groups]) => {
    const id = Number(idStr);
    const entries = (groups?.[0] ?? []).filter((e) => e?.all?.goals);
    const totalGoals = entries.reduce((acc, e) => acc + (e.all.goals.for ?? 0) + (e.all.goals.against ?? 0), 0);
    const totalMatches = entries.reduce((acc, e) => acc + (e.all.played ?? 0), 0) / 2;
    return {
      name: LEAGUE_NAMES[id]?.slice(0, 10) ?? `Lig ${id}`,
      avg: totalMatches > 0 ? Math.round((totalGoals / totalMatches) * 10) / 10 : 0,
    };
  }).filter((d) => d.avg > 0);

  // ── Form chart ───────────────────────────────────────────────────────────────
  const standings = allStandings?.[selectedLeague]?.[0] ?? [];
  const formChartData = standings.slice(0, 10).filter((entry) => entry?.team).map((entry) => {
    const form = entry.form ?? '';
    const wins = form.split('').filter((c) => c === 'W').length;
    const draws = form.split('').filter((c) => c === 'D').length;
    const losses = form.split('').filter((c) => c === 'L').length;
    return { name: (entry.team.name ?? '').slice(0, 10), G: wins, B: draws, M: losses };
  });

  const confidenceColor: Record<string, string> = {
    high: 'bg-emerald-600',
    medium: 'bg-yellow-600',
    low: 'bg-slate-600',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">İstatistikler</h1>
      <p className="text-slate-400 text-sm mb-6">Görsel analiz ve en güçlü bahis önerileri</p>

      {/* En Güçlü Bahisler */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-6">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-white">En Güçlü Bahisler</h3>
          <span className="text-xs text-slate-400">Kupon motoruna göre 0-100 puanlı sıralama</span>
        </div>

        {loadingFixtures ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-slate-700" />)}
          </div>
        ) : topPicks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Oran verisi bekleniyor</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="text-left p-3">Maç</th>
                  <th className="text-center p-3">Bahis</th>
                  <th className="text-center p-3">Seçim</th>
                  <th className="text-center p-3">Oran</th>
                  <th className="text-left p-3 w-40">Güven Skoru</th>
                  <th className="text-center p-3">Seviye</th>
                </tr>
              </thead>
              <tbody>
                {topPicks.map((sel, i) => (
                  <tr key={`${sel.fixtureId}-${sel.betType}-${i}`} className={cn('border-b border-slate-700/50', i % 2 === 0 ? '' : 'bg-slate-800/50')}>
                    <td className="p-3">
                      <Link href={`/mac-analizi/${sel.fixtureId}`} className="hover:text-emerald-400 transition-colors">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {sel.leagueLogo && <Image src={sel.leagueLogo} alt="" width={12} height={12} />}
                          <span className="text-xs text-slate-500">{sel.leagueName}</span>
                        </div>
                        <span className="text-slate-200 font-medium text-xs">{sel.homeTeam} <span className="text-slate-500">vs</span> {sel.awayTeam}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-center text-slate-400 text-xs">{BET_TYPE_LABELS[sel.betType]}</td>
                    <td className="p-3 text-center font-medium text-slate-200 text-xs">{sel.selection}</td>
                    <td className="p-3 text-center font-bold text-emerald-400 text-xs">{sel.odds > 0 ? sel.odds.toFixed(2) : '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                          <div
                            className={cn('h-1.5 rounded-full', sel.scoreBreakdown.total >= 68 ? 'bg-emerald-500' : sel.scoreBreakdown.total >= 45 ? 'bg-yellow-500' : 'bg-slate-500')}
                            style={{ width: `${sel.scoreBreakdown.total}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-6 text-right">{sel.scoreBreakdown.total}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={cn('text-white text-[10px]', confidenceColor[sel.confidence])}>
                        {CONFIDENCE_LABELS[sel.confidence]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Prediction distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Tahmin Dağılımı (Bu Hafta)</h3>
          {predCount === 0 ? (
            <div className="text-center py-12 text-slate-500">Veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} />
                <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Goals per league */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Ortalama Gol / Maç (Lig Bazlı)</h3>
          {goalsData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={goalsData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} />
                <Bar dataKey="avg" fill="#10b981" radius={[4, 4, 0, 0]} name="Ort. Gol" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Form chart by league */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-white">Son Form (İlk 10 Takım)</h3>
          <div className="flex gap-1.5 flex-wrap">
            {Object.values(LEAGUE_IDS).map((id) => (
              <button
                key={id}
                onClick={() => setSelectedLeague(id)}
                className={cn('px-2 py-1 text-xs rounded-md border transition-colors', selectedLeague === id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-emerald-500')}
              >
                {LEAGUE_NAMES[id]}
              </button>
            ))}
          </div>
        </div>

        {formChartData.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Bu lig için tablo verisi yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={formChartData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} />
              <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>} />
              <Bar dataKey="G" name="Galibiyet" stackId="a" fill="#10b981" />
              <Bar dataKey="B" name="Beraberlik" stackId="a" fill="#6b7280" />
              <Bar dataKey="M" name="Mağlubiyet" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
