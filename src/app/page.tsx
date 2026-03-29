'use client';

import { useState, useMemo, useEffect } from 'react';
import { useWeekFixtures, useAllOdds, useAllPredictions, useAllInjuries, useMeta } from '@/hooks/useData';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { StatsBar } from '@/components/dashboard/StatsBar';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function DashboardPage() {
  const [leagueFilter, setLeagueFilter] = useState<number>(0);
  const [activeDate, setActiveDate] = useState<string>('');

  const { data: weekFixtures, isLoading } = useWeekFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();
  const { data: allInjuries } = useAllInjuries();
  const { data: meta } = useMeta();

  const allFixtures = useMemo((): Fixture[] => {
    if (!weekFixtures) return [];
    return Object.values(weekFixtures).flat();
  }, [weekFixtures]);

  // Seçili lig için maç olan tarihleri bul
  const activeDates = useMemo(() => {
    if (!weekFixtures) return [];
    return Object.keys(weekFixtures)
      .sort()
      .filter((date) => {
        const fixtures = weekFixtures[date] ?? [];
        return leagueFilter === 0
          ? fixtures.length > 0
          : fixtures.some((f) => f.league.id === leagueFilter);
      });
  }, [weekFixtures, leagueFilter]);

  // Lig değişince ilk geçerli tarihe atla
  useEffect(() => {
    if (activeDates.length > 0) {
      setActiveDate(activeDates[0]);
    } else {
      setActiveDate('');
    }
  }, [leagueFilter, activeDates]);

  const leagueCounts: Record<number, number> = {};
  allFixtures.forEach((f) => {
    leagueCounts[f.league.id] = (leagueCounts[f.league.id] ?? 0) + 1;
  });

  const injuriesCount = Object.values(allInjuries?.byLeague ?? {}).reduce(
    (acc, arr) => acc + arr.length, 0
  );

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return weekFixtures?.[today]?.length ?? 0;
  }, [weekFixtures]);

  const noData = !isLoading && allFixtures.length === 0;

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
          todayCount={todayCount}
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

      {isLoading ? (
        <MatchGridSkeleton />
      ) : activeDates.length === 0 ? (
        <EmptyState message="Bu lig için yaklaşan maç bulunamadı" />
      ) : (
        <Tabs value={activeDate} onValueChange={setActiveDate}>
          <TabsList className="bg-slate-800 mb-4 flex-wrap h-auto gap-1">
            {activeDates.map((date) => {
              const count = (weekFixtures?.[date] ?? []).filter(
                (f) => leagueFilter === 0 || f.league.id === leagueFilter
              ).length;
              return (
                <TabsTrigger
                  key={date}
                  value={date}
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  {formatTabLabel(date)}
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {activeDates.map((date) => {
            const fixtures = (weekFixtures?.[date] ?? []).filter(
              (f) => leagueFilter === 0 || f.league.id === leagueFilter
            );
            return (
              <TabsContent key={date} value={date}>
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
              </TabsContent>
            );
          })}
        </Tabs>
      )}
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
