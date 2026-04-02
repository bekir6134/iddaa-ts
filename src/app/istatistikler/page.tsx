'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useWeekFixtures, useAllPredictions, useAllStandings, useAllOdds, useAllInjuries, useAllH2H, useAllTeamStats, useResults, useAllPoisson } from '@/hooks/useData';
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
  const [sortCol, setSortCol] = useState<'score' | 'odds' | 'bet' | 'confidence'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const { data: weekFixtures, isLoading: loadingFixtures } = useWeekFixtures();
  const { data: allPredictions } = useAllPredictions();
  const { data: allStandings } = useAllStandings();
  const { data: allOdds } = useAllOdds();
  const { data: allInjuries } = useAllInjuries();
  const { data: allH2H } = useAllH2H();
  const { data: allTeamStats } = useAllTeamStats();
  const { data: results } = useResults();
  const { data: allPoisson } = useAllPoisson();

  const allFixtures = useMemo(() => Object.values(weekFixtures ?? {}).flat(), [weekFixtures]);

  // ── Tahmin doğruluğu (geçmiş sonuçlar vs predictions) ───────────────────────
  const accuracy = useMemo(() => {
    if (!results || !allPredictions) return null;
    let correct = 0, total = 0;
    const rows: { home: string; away: string; predicted: string; actual: string; ok: boolean }[] = [];
    for (const f of Object.values(results.byFixture)) {
      if (f.fixture.status.short !== 'FT') continue;
      const pred = allPredictions[f.fixture.id];
      if (!pred?.predictions?.winner) continue;
      const winnerId = pred.predictions.winner.id;
      if (!winnerId) continue;
      const gh = f.goals.home, ga = f.goals.away;
      if (gh === null || ga === null) continue;
      const actualId = gh > ga ? f.teams.home.id : ga > gh ? f.teams.away.id : null;
      const predicted = winnerId === f.teams.home.id ? f.teams.home.name : f.teams.away.name;
      const actual = actualId === f.teams.home.id ? f.teams.home.name : actualId === f.teams.away.id ? f.teams.away.name : 'Beraberlik';
      const ok = actualId === winnerId;
      if (ok) correct++;
      total++;
      rows.push({ home: f.teams.home.name, away: f.teams.away.name, predicted, actual, ok });
    }
    return total === 0 ? null : { correct, total, rate: Math.round((correct / total) * 100), rows: rows.slice(0, 15) };
  }, [results, allPredictions]);

  // ── Gol dağılımı — zaman dilimi (seçili lig, predictions'dan) ────────────────
  const goalTimeData = useMemo(() => {
    const slots = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '91-105', '106-120'];
    const totals: Record<string, number> = {};
    slots.forEach((s) => { totals[s] = 0; });

    for (const pred of Object.values(allPredictions ?? {})) {
      if (pred.league?.id !== selectedLeague) continue;
      for (const side of ['home', 'away'] as const) {
        const minuteData = pred.teams?.[side]?.league?.goals?.for?.minute ?? {};
        for (const [slot, val] of Object.entries(minuteData)) {
          if (slot in totals && val?.total) totals[slot] += val.total;
        }
      }
    }
    return slots.map((s) => ({ slot: s, goals: totals[s] })).filter((d) => d.goals > 0);
  }, [allPredictions, selectedLeague]);

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
      results: { byLeague: {}, byFixture: {} },
      poisson: { byFixture: allPoisson ?? {} },
      meta: undefined as never,
    };
    return rankSelections(cache, ['1X2', 'Over2.5', 'Over1.5', 'BTTS']);
  }, [weekFixtures, allOdds, allPredictions, allInjuries, allH2H, allTeamStats, allPoisson]);

  const sortedPicks = useMemo(() => {
    const picks = [...topPicks];
    const dir = sortDir === 'asc' ? 1 : -1;
    picks.sort((a, b) => {
      if (sortCol === 'score') return dir * (a.scoreBreakdown.total - b.scoreBreakdown.total);
      if (sortCol === 'odds') return dir * (a.odds - b.odds);
      if (sortCol === 'bet') return dir * a.betType.localeCompare(b.betType);
      if (sortCol === 'confidence') {
        const order = { high: 3, medium: 2, low: 1 };
        return dir * ((order[a.confidence] ?? 0) - (order[b.confidence] ?? 0));
      }
      return 0;
    });
    return picks.slice(0, 20);
  }, [topPicks, sortCol, sortDir]);

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
                  <SortTh label="Bahis" col="bet" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="text-center p-3">Seçim</th>
                  <SortTh label="Oran" col="odds" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Güven Skoru" col="score" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" extraClass="w-40" />
                  <SortTh label="Seviye" col="confidence" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedPicks.map((sel, i) => (
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

      {/* Değer Bahisler (Poisson) */}
      {(() => {
        const valueBets = allFixtures
          .map((f) => ({ f, p: allPoisson?.[f.fixture.id] }))
          .filter(({ p }) => p && p.dataQuality !== 'none' && (p.valueHome || p.valueDraw || p.valueAway))
          .sort((a, b) => (b.p?.confidence ?? 0) - (a.p?.confidence ?? 0))
          .slice(0, 20);
        if (valueBets.length === 0) return null;
        return (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-6 mt-6">
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-700 flex items-center gap-3">
              <h3 className="font-semibold text-white">Değer Bahisler (Poisson)</h3>
              <span className="text-xs text-slate-400">model_olasılık × oran &gt; 1</span>
              <span className="ml-auto text-xs text-emerald-400">{valueBets.length} maç</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th className="text-left p-3">Maç</th>
                    <th className="text-center p-3">λ Ev / Dep</th>
                    <th className="text-center p-3">Poisson Olasılık (1/X/2)</th>
                    <th className="text-center p-3">Değer</th>
                    <th className="text-center p-3">Güven</th>
                  </tr>
                </thead>
                <tbody>
                  {valueBets.map(({ f, p }, i) => (
                    <tr key={f.fixture.id} className={cn('border-b border-slate-700/50', i % 2 === 0 ? '' : 'bg-slate-800/50')}>
                      <td className="p-3">
                        <Link href={`/mac-analizi/${f.fixture.id}`} className="hover:text-emerald-400 transition-colors">
                          <p className="text-xs text-slate-500">{LEAGUE_NAMES[f.league.id] ?? f.league.name}</p>
                          <p className="text-slate-200 text-xs font-medium">{f.teams.home.name} <span className="text-slate-500">vs</span> {f.teams.away.name}</p>
                        </Link>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-400">{p!.homeLambda} / {p!.awayLambda}</td>
                      <td className="p-3 text-center text-xs text-slate-300">
                        {Math.round(p!.probHome * 100)}% / {Math.round(p!.probDraw * 100)}% / {Math.round(p!.probAway * 100)}%
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {p!.valueHome && <Badge className="bg-emerald-700 text-white text-[10px]">1</Badge>}
                          {p!.valueDraw && <Badge className="bg-slate-600 text-white text-[10px]">X</Badge>}
                          {p!.valueAway && <Badge className="bg-blue-700 text-white text-[10px]">2</Badge>}
                        </div>
                      </td>
                      <td className="p-3 text-center text-xs font-bold text-emerald-400">{p!.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Gol Dağılımı — Zaman Dilimi */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mt-6">
        <h3 className="font-semibold text-white mb-1">Gol Dağılımı — Dakika Bazlı</h3>
        <p className="text-xs text-slate-400 mb-4">Seçili lig tahminlerindeki gol beklentisinin dakika dağılımı</p>
        {goalTimeData.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Bu lig için tahmin verisi yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={goalTimeData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="slot" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#f1f5f9' }} formatter={(v) => [`${v} gol`, 'Toplam']} />
              <Bar dataKey="goals" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Gol" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tahmin Doğruluğu */}
      {accuracy && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mt-6">
          <div className="bg-slate-900 px-5 py-3 border-b border-slate-700 flex items-center gap-4">
            <h3 className="font-semibold text-white">Tahmin Doğruluğu</h3>
            <span className="text-xs text-slate-400">Geçmiş maçlarda API tahminleri vs gerçek sonuçlar</span>
            <span className={cn('ml-auto font-bold text-lg', accuracy.rate >= 60 ? 'text-emerald-400' : accuracy.rate >= 45 ? 'text-yellow-400' : 'text-red-400')}>
              %{accuracy.rate}
            </span>
            <span className="text-xs text-slate-500">{accuracy.correct}/{accuracy.total} doğru</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {accuracy.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-300 text-xs">{r.home} vs {r.away}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">Tahmin: <span className="text-slate-200">{r.predicted}</span></span>
                  <span className="text-slate-400">Sonuç: <span className="text-slate-200">{r.actual}</span></span>
                  <span className={r.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{r.ok ? '✓' : '✗'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label, col, sortCol, sortDir, onSort, align = 'center', extraClass = '',
}: {
  label: string;
  col: 'score' | 'odds' | 'bet' | 'confidence';
  sortCol: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: 'score' | 'odds' | 'bet' | 'confidence') => void;
  align?: 'left' | 'center';
  extraClass?: string;
}) {
  const active = sortCol === col;
  const Icon = active ? (sortDir === 'desc' ? ChevronDown : ChevronUp) : ChevronsUpDown;
  return (
    <th
      className={cn(`p-3 cursor-pointer select-none hover:text-white transition-colors ${extraClass}`, align === 'left' ? 'text-left' : 'text-center')}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <Icon size={12} className={active ? 'text-emerald-400' : 'text-slate-600'} />
      </span>
    </th>
  );
}
