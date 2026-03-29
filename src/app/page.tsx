'use client';

import { useState } from 'react';
import { useTodayFixtures, useTomorrowFixtures, useAllOdds, useAllPredictions, useAllInjuries, useMeta } from '@/hooks/useData';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { StatsBar } from '@/components/dashboard/StatsBar';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [leagueFilter, setLeagueFilter] = useState<number>(0);

  const { data: todayFixtures, isLoading: loadingToday } = useTodayFixtures();
  const { data: tomorrowFixtures, isLoading: loadingTomorrow } = useTomorrowFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();
  const { data: allInjuries } = useAllInjuries();
  const { data: meta } = useMeta();

  const filterFixtures = (fixtures: typeof todayFixtures) => {
    if (!fixtures) return [];
    if (leagueFilter === 0) return fixtures;
    return fixtures.filter((f) => f.league.id === leagueFilter);
  };

  const todayFiltered = filterFixtures(todayFixtures);
  const tomorrowFiltered = filterFixtures(tomorrowFixtures);

  const leagueCounts: Record<number, number> = {};
  [...(todayFixtures ?? []), ...(tomorrowFixtures ?? [])].forEach((f) => {
    leagueCounts[f.league.id] = (leagueCounts[f.league.id] ?? 0) + 1;
  });

  const injuriesCount = Object.values(allInjuries?.byLeague ?? {}).reduce(
    (acc, arr) => acc + arr.length, 0
  );

  const noData = !loadingToday && !loadingTomorrow && (todayFixtures?.length ?? 0) === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Güncel maç tahminleri ve oran analizi</p>
        </div>
        <a href="/api/download" download>
          <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
            <Download size={16} />
            Excel İndir
          </Button>
        </a>
      </div>

      {meta && (
        <StatsBar
          meta={meta}
          todayCount={todayFixtures?.length ?? 0}
          predictionsCount={Object.keys(allPredictions ?? {}).length}
          injuriesCount={injuriesCount}
        />
      )}

      {noData && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6 text-center mb-6">
          <AlertTriangle className="mx-auto mb-2 text-yellow-500" size={32} />
          <p className="text-yellow-300 font-semibold">Henüz veri yok</p>
          <p className="text-slate-400 text-sm mt-1">
            Veriler her gün saat 07:00&apos;de (TR saati) otomatik güncellenir.
          </p>
        </div>
      )}

      <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} counts={leagueCounts} />

      <Tabs defaultValue="today">
        <TabsList className="bg-slate-800 mb-4">
          <TabsTrigger value="today" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Bugün {todayFiltered.length > 0 && `(${todayFiltered.length})`}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Yarın {tomorrowFiltered.length > 0 && `(${tomorrowFiltered.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          {loadingToday ? <MatchGridSkeleton /> : todayFiltered.length === 0 ? (
            <EmptyState message="Bugün için maç bulunamadı" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {todayFiltered.map((f) => (
                <MatchCard key={f.fixture.id} fixture={f} odds={allOdds?.[f.fixture.id]} prediction={allPredictions?.[f.fixture.id]} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tomorrow">
          {loadingTomorrow ? <MatchGridSkeleton /> : tomorrowFiltered.length === 0 ? (
            <EmptyState message="Yarın için maç bulunamadı" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tomorrowFiltered.map((f) => (
                <MatchCard key={f.fixture.id} fixture={f} odds={allOdds?.[f.fixture.id]} prediction={allPredictions?.[f.fixture.id]} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-32 bg-slate-700" />
          <Skeleton className="h-8 w-full bg-slate-700" />
          <Skeleton className="h-6 w-full bg-slate-700" />
          <Skeleton className="h-4 w-full bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-slate-500">
      <p className="text-lg">{message}</p>
    </div>
  );
}
