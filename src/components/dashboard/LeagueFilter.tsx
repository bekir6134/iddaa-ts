'use client';

import { LEAGUE_IDS, LEAGUE_NAMES } from '@/lib/utils';
import { cn } from '@/lib/utils';

const leagues = [
  { id: 0, name: 'Tümü' },
  ...Object.entries(LEAGUE_IDS).map(([, id]) => ({ id, name: LEAGUE_NAMES[id] })),
];

interface LeagueFilterProps {
  selected: number;
  onChange: (id: number) => void;
  counts?: Record<number, number>;
}

export function LeagueFilter({ selected, onChange, counts }: LeagueFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {leagues.map((league) => {
        const count = league.id === 0 ? undefined : counts?.[league.id];
        return (
          <button
            key={league.id}
            onClick={() => onChange(league.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              selected === league.id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-white'
            )}
          >
            {league.name}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
