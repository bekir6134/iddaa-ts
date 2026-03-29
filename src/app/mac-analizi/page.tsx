'use client';

import { useState, useMemo } from 'react';
import { useWeekFixtures, useAllOdds, useAllPredictions } from '@/hooks/useData';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Fixture } from '@/types/api-football';

function formatTabLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Bugün';
  if (date.getTime() === tomorrow.getTime()) return 'Yarın';

  return date.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function MacAnaliziPage() {
  const [leagueFilter, setLeagueFilter] = useState(0);
  const { data: weekFixtures, isLoading } = useWeekFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();

  const sortedDates = useMemo(() => {
    if (!weekFixtures) return [];
    return Object.keys(weekFixtures).sort();
  }, [weekFixtures]);

  const defaultTab = sortedDates[0] ?? '';

  const allFixtures = useMemo(() => {
    if (!weekFixtures) return [] as Fixture[];
    return Object.values(weekFixtures).flat();
  }, [weekFixtures]);

  const counts: Record<number, number> = {};
  allFixtures.forEach((f) => {
    counts[f.league.id] = (counts[f.league.id] ?? 0) + 1;
  });

  const filter = (arr: Fixture[]) =>
    leagueFilter === 0 ? arr : arr.filter((f) => f.league.id === leagueFilter);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Maç Analizi</h1>
      <p className="text-slate-400 text-sm mb-6">Detaylı tahmin, H2H ve oran analizi için bir maça tıklayın</p>

      <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} counts={counts} />

      {isLoading ? (
        <GridSkeleton />
      ) : sortedDates.length === 0 ? (
        <p className="text-slate-400 text-sm">Bu hafta maç bulunamadı.</p>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-slate-800 mb-4 flex-wrap h-auto gap-1">
            {sortedDates.map((date) => {
              const filtered = filter(weekFixtures?.[date] ?? []);
              return (
                <TabsTrigger
                  key={date}
                  value={date}
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  {formatTabLabel(date)}
                  {filtered.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">({filtered.length})</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {sortedDates.map((date) => {
            const fixtures = filter(weekFixtures?.[date] ?? []);
            return (
              <TabsContent key={date} value={date}>
                {fixtures.length === 0 ? (
                  <p className="text-slate-400 text-sm">Bu gün için maç yok.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {fixtures.map((f) => (
                      <MatchCard
                        key={f.fixture.id}
                        fixture={f}
                        odds={allOdds?.[f.fixture.id]}
                        prediction={allPredictions?.[f.fixture.id]}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-32 bg-slate-700" />
          <Skeleton className="h-8 w-full bg-slate-700" />
          <Skeleton className="h-6 w-full bg-slate-700" />
        </div>
      ))}
    </div>
  );
}
