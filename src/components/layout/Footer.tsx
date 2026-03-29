import { formatTurkeyDateTime } from '@/lib/utils';

interface FooterProps {
  lastUpdated?: string;
}

export function Footer({ lastUpdated }: FooterProps) {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 py-4 mt-auto">
      <div className="max-w-screen-2xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} İddaa Analiz — Sadece eğlence amaçlıdır</span>
        {lastUpdated && (
          <span>Son güncelleme: {formatTurkeyDateTime(lastUpdated)}</span>
        )}
      </div>
    </footer>
  );
}
