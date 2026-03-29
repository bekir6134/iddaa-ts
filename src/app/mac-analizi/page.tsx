'use client';

import { useState } from 'react';
import { useTodayFixtures, useTomorrowFixtures, useAllOdds, useAllPredictions } from '@/hooks/useData';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MacAnaliziPage() {
  const [leagueFilter, setLeagueFilter] = useState(0);
  const { data: todayFixtures, isLoading: loadingToday } = useTodayFixtures();
  const { data: tomorrowFixtures, isLoading: loadingTomorrow } = useTomorrowFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();

  const filter = (arr: typeof todayFixtures) =>
    arr ? (leagueFilter === 0 ? arr : arr.filter((f) => f.league.id === leagueFilter)) : [];

  const counts: Record<number, number> = {};
  [...(todayFixtures ?? []), ...(tomorrowFixtures ?? [])].forEach((f) => {
    counts[f.league.id] = (counts[f.league.id] ?? 0) + 1;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Maç Analizi</h1>
      <p className="text-slate-400 text-sm mb-6">Detaylı tahmin, H2H ve oran analizi için bir maça tıklayın</p>

      <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} counts={counts} />

      <Tabs defaultValue="today">
        <TabsList className="bg-slate-800 mb-4">
          <TabsTrigger value="today" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Bugün {filter(todayFixtures).length > 0 && `(${filter(todayFixtures).length})`}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Yarın {filter(tomorrowFixtures).length > 0 && `(${filter(tomorrowFixtures).length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          {loadingToday ? <GridSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filter(todayFixtures).map((f) => (
                <MatchCard key={f.fixture.id} fixture={f} odds={allOdds?.[f.fixture.id]} prediction={allPredictions?.[f.fixture.id]} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tomorrow">
          {loadingTomorrow ? <GridSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filter(tomorrowFixtures).map((f) => (
                <MatchCard key={f.fixture.id} fixture={f} odds={allOdds?.[f.fixture.id]} prediction={allPredictions?.[f.fixture.id]} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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
