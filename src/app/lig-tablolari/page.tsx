'use client';

import { useState } from 'react';
import { useAllStandings } from '@/hooks/useData';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAGUE_IDS, LEAGUE_NAMES, cn } from '@/lib/utils';
import Image from 'next/image';
import type { StandingEntry } from '@/types/api-football';

const leagues = Object.values(LEAGUE_IDS);

export default function LigTabloPage() {
  const [selected, setSelected] = useState<number>(203);
  const { data: allStandings, isLoading } = useAllStandings();

  const groups = allStandings?.[selected] ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Lig Tabloları</h1>
      <p className="text-slate-400 text-sm mb-6">Güncel puan durumu ve form</p>

      {/* League selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {leagues.map((id) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              selected === id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-emerald-500'
            )}
          >
            {LEAGUE_NAMES[id]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full bg-slate-800" />
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">Bu lig için tablo verisi yok</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <div key={gi} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700 text-xs text-slate-400">
                      <th className="p-3 text-left w-8">#</th>
                      <th className="p-3 text-left">Takım</th>
                      <th className="p-3 text-center w-10">O</th>
                      <th className="p-3 text-center w-10">G</th>
                      <th className="p-3 text-center w-10">B</th>
                      <th className="p-3 text-center w-10">M</th>
                      <th className="p-3 text-center w-10">AG</th>
                      <th className="p-3 text-center w-10">YG</th>
                      <th className="p-3 text-center w-10">AV</th>
                      <th className="p-3 text-center w-12 font-bold">Puan</th>
                      <th className="p-3 text-center">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((entry: StandingEntry, i: number) => (
                      <tr key={entry.team.id} className={cn('border-b border-slate-700/50', i % 2 === 0 ? '' : 'bg-slate-800/50')}>
                        <td className="p-3 text-slate-500 text-xs font-medium">{entry.rank}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {entry.team.logo && <Image src={entry.team.logo} alt={entry.team.name} width={20} height={20} className="shrink-0" />}
                            <span className="font-medium text-slate-200">{entry.team.name}</span>
                            {entry.description && (
                              <DescriptionDot desc={entry.description} />
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center text-slate-400">{entry.all.played}</td>
                        <td className="p-3 text-center text-emerald-400 font-medium">{entry.all.win}</td>
                        <td className="p-3 text-center text-slate-400">{entry.all.draw}</td>
                        <td className="p-3 text-center text-red-400">{entry.all.lose}</td>
                        <td className="p-3 text-center text-slate-300">{entry.all.goals.for}</td>
                        <td className="p-3 text-center text-slate-300">{entry.all.goals.against}</td>
                        <td className={cn('p-3 text-center font-medium', entry.goalsDiff > 0 ? 'text-emerald-400' : entry.goalsDiff < 0 ? 'text-red-400' : 'text-slate-400')}>
                          {entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : entry.goalsDiff}
                        </td>
                        <td className="p-3 text-center font-bold text-white text-base">{entry.points}</td>
                        <td className="p-3">
                          <FormDots form={entry.form ?? ''} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormDots({ form }: { form: string }) {
  const colorMap: Record<string, string> = { W: 'bg-emerald-500', D: 'bg-yellow-500', L: 'bg-red-500' };
  return (
    <div className="flex gap-1 justify-center">
      {form.slice(-5).split('').map((c, i) => (
        <span key={i} title={c} className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white', colorMap[c] ?? 'bg-slate-600')}>
          {c}
        </span>
      ))}
    </div>
  );
}

function DescriptionDot({ desc }: { desc: string }) {
  const color = desc.toLowerCase().includes('champion') ? 'bg-yellow-500' :
    desc.toLowerCase().includes('league') ? 'bg-blue-500' :
    desc.toLowerCase().includes('relegate') ? 'bg-red-500' : 'bg-slate-500';
  return (
    <span title={desc} className={cn('w-2 h-2 rounded-full inline-block shrink-0', color)} />
  );
}
