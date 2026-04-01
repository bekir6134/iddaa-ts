'use client';

import { useState } from 'react';
import { useAllInjuries } from '@/hooks/useData';
import { LeagueFilter } from '@/components/dashboard/LeagueFilter';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAGUE_NAMES, LEAGUE_IDS, cn } from '@/lib/utils';
import Image from 'next/image';

export default function SakatlıklarPage() {
  const [leagueFilter, setLeagueFilter] = useState(0);
  const { data: injuries, isLoading } = useAllInjuries();

  const allLeagueIds = Object.values(LEAGUE_IDS);

  const counts: Record<number, number> = {};
  if (injuries) {
    for (const [idStr, arr] of Object.entries(injuries.byLeague)) {
      counts[Number(idStr)] = arr.length;
    }
  }

  const displayLeagues = leagueFilter === 0
    ? allLeagueIds
    : [leagueFilter];

  const totalInjuries = Object.values(injuries?.byLeague ?? {}).reduce((a, b) => a + b.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Sakatlıklar</h1>
        {totalInjuries > 0 && (
          <Badge className="bg-red-600 text-white">{totalInjuries} sakatlık</Badge>
        )}
      </div>
      <p className="text-slate-400 text-sm mb-6">Güncel sakatlık ve ceza listesi</p>

      <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} counts={counts} />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full bg-slate-800" />)}
        </div>
      ) : totalInjuries === 0 ? (
        <div className="text-center py-16 text-slate-500">Kayıtlı sakatlık verisi yok</div>
      ) : (
        <div className="space-y-4">
          {displayLeagues.map((leagueId) => {
            const leagueInjuries = injuries?.byLeague[leagueId];
            if (!leagueInjuries?.length) return null;

            // Tekrar eden oyuncuları kaldır (aynı oyuncu birden fazla maç için listelenebiliyor)
            const seenPlayers = new Set<string>();
            const uniqueInjuries = leagueInjuries.filter((inj) => {
              const key = `${inj.team.id}_${inj.player.id}`;
              if (seenPlayers.has(key)) return false;
              seenPlayers.add(key);
              return true;
            });

            // Group by team
            const byTeam: Record<string, typeof leagueInjuries> = {};
            for (const inj of uniqueInjuries) {
              const key = `${inj.team.id}_${inj.team.name}`;
              if (!byTeam[key]) byTeam[key] = [];
              byTeam[key].push(inj);
            }

            return (
              <div key={leagueId} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-900 px-4 py-3 flex items-center gap-2 border-b border-slate-700">
                  <span className="font-semibold text-white">{LEAGUE_NAMES[leagueId] ?? `Lig ${leagueId}`}</span>
                  <Badge className="bg-slate-700 text-slate-300 text-xs">{uniqueInjuries.length}</Badge>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {Object.entries(byTeam).map(([teamKey, teamInjuries]) => {
                    const team = teamInjuries[0].team;
                    return (
                      <div key={teamKey} className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {team.logo && <Image src={team.logo} alt={team.name} width={20} height={20} />}
                          <span className="font-medium text-slate-200 text-sm">{team.name}</span>
                          <Badge className="bg-red-900/50 text-red-400 text-xs border border-red-800">{teamInjuries.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {teamInjuries.map((inj) => (
                            <div key={inj.player.id} className={cn('flex items-start gap-2 text-xs p-2 rounded-lg', inj.type === 'Missing Fixture' ? 'bg-red-900/20 border border-red-900/40' : 'bg-yellow-900/20 border border-yellow-900/40')}>
                              {inj.player.photo && (
                                <Image src={inj.player.photo} alt={inj.player.name} width={28} height={28} className="rounded-full shrink-0" />
                              )}
                              <div>
                                <p className="font-medium text-slate-200">{inj.player.name}</p>
                                <p className="text-slate-500">{inj.reason}</p>
                                <Badge className={cn('text-[10px] mt-1', inj.type === 'Missing Fixture' ? 'bg-red-600' : 'bg-yellow-600')}>
                                  {inj.type === 'Missing Fixture' ? 'Yok' : 'Şüpheli'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
