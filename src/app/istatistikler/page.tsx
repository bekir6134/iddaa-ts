'use client';

import { useState } from 'react';
import { useTodayFixtures, useTomorrowFixtures, useAllPredictions, useAllStandings } from '@/hooks/useData';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAGUE_IDS, LEAGUE_NAMES, cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#6b7280', '#3b82f6'];

export default function IstatistiklerPage() {
  const [selectedLeague, setSelectedLeague] = useState(203);
  const { data: todayFixtures } = useTodayFixtures();
  const { data: tomorrowFixtures } = useTomorrowFixtures();
  const { data: allPredictions } = useAllPredictions();
  const { data: allStandings } = useAllStandings();

  const allFixtures = [...(todayFixtures ?? []), ...(tomorrowFixtures ?? [])];

  // Prediction distribution (home/draw/away) across all fixtures with predictions
  const predDist = { home: 0, draw: 0, away: 0 };
  let predCount = 0;
  for (const [, pred] of Object.entries(allPredictions ?? {})) {
    const h = parseFloat(pred.predictions.percent.home);
    const d = parseFloat(pred.predictions.percent.draw);
    const a = parseFloat(pred.predictions.percent.away);
    if (pred.predictions.winner?.id) {
      const fid = pred.fixture.id;
      const fixture = allFixtures.find((f) => f.fixture.id === fid);
      if (fixture) {
        if (pred.predictions.winner.id === fixture.teams.home.id) predDist.home++;
        else if (pred.predictions.winner.id === fixture.teams.away.id) predDist.away++;
        else predDist.draw++;
        predCount++;
      }
    }
    void h; void d; void a;
  }

  const pieData = [
    { name: 'Ev Sahibi', value: predDist.home },
    { name: 'Beraberlik', value: predDist.draw },
    { name: 'Deplasman', value: predDist.away },
  ].filter((d) => d.value > 0);

  // Standing form data for selected league
  const standings = allStandings?.[selectedLeague]?.[0] ?? [];
  const formChartData = standings.slice(0, 10).map((entry) => {
    const form = entry.form ?? '';
    const wins = form.split('').filter((c) => c === 'W').length;
    const draws = form.split('').filter((c) => c === 'D').length;
    const losses = form.split('').filter((c) => c === 'L').length;
    return {
      name: entry.team.name.slice(0, 10),
      G: wins,
      B: draws,
      M: losses,
    };
  });

  // Goals per league
  const goalsData = Object.entries(allStandings ?? {}).map(([idStr, groups]) => {
    const id = Number(idStr);
    const entries = groups?.[0] ?? [];
    const totalGoals = entries.reduce((acc, e) => acc + e.all.goals.for + e.all.goals.against, 0);
    const totalMatches = entries.reduce((acc, e) => acc + e.all.played, 0) / 2;
    return {
      name: LEAGUE_NAMES[id]?.slice(0, 10) ?? `Lig ${id}`,
      avg: totalMatches > 0 ? Math.round((totalGoals / totalMatches) * 10) / 10 : 0,
    };
  }).filter((d) => d.avg > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">İstatistikler</h1>
      <p className="text-slate-400 text-sm mb-6">Görsel analiz ve istatistiksel veriler</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Prediction distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Tahmin Dağılımı (Bugün + Yarın)</h3>
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
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                />
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
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
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
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
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
