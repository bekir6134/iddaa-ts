'use client';

import { Calendar, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import type { CacheMeta } from '@/types/cache';
import { formatTurkeyDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatsBarProps {
  meta: CacheMeta;
  todayCount: number;
  predictionsCount: number;
  injuriesCount: number;
}

export function StatsBar({ meta, todayCount, predictionsCount, injuriesCount }: StatsBarProps) {
  const statusColors = {
    ok: 'bg-emerald-600',
    partial: 'bg-yellow-600',
    stale: 'bg-slate-600',
    error: 'bg-red-600',
  };
  const statusLabels = {
    ok: 'Güncel',
    partial: 'Kısmi',
    stale: 'Eski',
    error: 'Hata',
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-emerald-400" />
            <span className="text-slate-400">Bugünkü Maçlar:</span>
            <span className="font-bold text-white">{todayCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-slate-400">Toplam Maç:</span>
            <span className="font-bold text-white">{predictionsCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="text-orange-400" />
            <span className="text-slate-400">Sakatlıklar:</span>
            <span className="font-bold text-white">{injuriesCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw size={16} className="text-slate-400" />
            <span className="text-slate-400">API İstekleri:</span>
            <span className="font-bold text-white">{meta.requestsUsed}/{meta.requestBudget}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors[meta.status]} text-white text-xs`}>
            {statusLabels[meta.status]}
          </Badge>
          {meta.lastUpdated && (
            <span className="text-xs text-slate-500">
              {formatTurkeyDateTime(meta.lastUpdated)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
