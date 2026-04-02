'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAllOdds, useAllPredictions, useWeekFixtures, useAllInjuries, useAllPoisson, useAllH2H, useAllTeamStats } from '@/hooks/useData';
import { generateCoupon } from '@/lib/coupon-engine';
import { saveCoupon, getHistory, deleteFromHistory } from '@/lib/coupon-history';
import type { SavedCoupon } from '@/lib/coupon-history';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, X, Info, RefreshCw, Copy, Check, Bookmark, Trash2, History, Zap } from 'lucide-react';
import type { AppCache } from '@/types/cache';
import type { CouponFilters, CouponSelection, GeneratedCoupon, BetType } from '@/types/coupon';
import { DEFAULT_FILTERS, BET_TYPE_LABELS, CONFIDENCE_LABELS, RISK_LABELS } from '@/types/coupon';
import { formatTurkeyTime, formatTurkeyDateTime, formatOdd, LEAGUE_IDS, LEAGUE_NAMES, cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

const ALL_BET_TYPES: BetType[] = ['1X2', 'Over2.5', 'Over1.5', 'Under2.5', 'BTTS', 'DNB'];

export default function KuponPage() {
  const [filters, setFilters] = useState<CouponFilters>({ ...DEFAULT_FILTERS, minConfidence: 'low' });
  const [coupon, setCoupon] = useState<GeneratedCoupon | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<SavedCoupon[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [poissonMinConf, setPoissonMinConf] = useState(0);
  const [poissonOnlyFull, setPoissonOnlyFull] = useState(false);

  useEffect(() => { setHistory(getHistory()); }, []);

  const { data: weekFixtures } = useWeekFixtures();
  const { data: allOdds } = useAllOdds();
  const { data: allPredictions } = useAllPredictions();
  const { data: allInjuries } = useAllInjuries();
  const { data: allPoisson } = useAllPoisson();
  const { data: allH2H } = useAllH2H();
  const { data: allTeamStats } = useAllTeamStats();

  const isLoaded = !!(weekFixtures && allOdds && allPredictions);

  function buildCache(): AppCache {
    return {
      meta: { lastUpdated: '', nextUpdate: '', requestsUsed: 0, requestBudget: 7500, leagues: [], fixtureCount: 0, status: 'ok' },
      fixtures: { today: [], tomorrow: [], byLeague: {}, byDate: weekFixtures ?? {} },
      odds: { byFixture: allOdds! },
      predictions: { byFixture: allPredictions! },
      injuries: allInjuries ?? { byLeague: {}, byTeam: {} },
      standings: { byLeague: {} },
      h2h: { byFixturePair: allH2H ?? {} },
      teamStats: { byTeam: allTeamStats ?? {} },
      results: { byLeague: {}, byFixture: {} },
      poisson: { byFixture: allPoisson ?? {} },
    };
  }

  const handleGenerate = useCallback(() => {
    if (!isLoaded) return;
    setGenerating(true);
    setTimeout(() => {
      const result = generateCoupon(filters, buildCache());
      setCoupon(result);
      setGenerating(false);
    }, 300);
  }, [filters, isLoaded, weekFixtures, allOdds, allPredictions, allInjuries, allPoisson, allH2H, allTeamStats]);

  const handleSave = () => {
    if (!coupon) return;
    const updated = saveCoupon(coupon);
    setHistory(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    setHistory(deleteFromHistory(id));
  };

  const handleCopy = () => {
    if (!coupon) return;
    const text = coupon.selections.map((s) =>
      `${s.homeTeam} vs ${s.awayTeam} — ${BET_TYPE_LABELS[s.betType]}: ${s.selection} @ ${formatOdd(s.odds)}`
    ).join('\n') + `\nToplam Oran: ${coupon.totalOdds}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleBetType = (bt: BetType) => {
    setFilters((f) => ({
      ...f,
      betTypes: f.betTypes.includes(bt) ? f.betTypes.filter((x) => x !== bt) : [...f.betTypes, bt],
    }));
  };

  const toggleLeague = (id: number) => {
    setFilters((f) => ({
      ...f,
      leagues: f.leagues.includes(id) ? f.leagues.filter((x) => x !== id) : [...f.leagues, id],
    }));
  };

  const riskColor: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    'very-high': 'text-red-400',
  };

  // ── Poisson value bets ────────────────────────────────────────────────────────
  const allFixtures = Object.values(weekFixtures ?? {}).flat();

  const poissonValueBets = allFixtures
    .flatMap((fixture) => {
      const p = allPoisson?.[fixture.fixture.id];
      if (!p || p.dataQuality === 'none') return [];
      if (poissonOnlyFull && p.dataQuality !== 'full') return [];
      if (p.confidence < poissonMinConf) return [];

      const bets: { fixture: typeof fixture; type: '1' | 'X' | '2'; prob: number; odd: number | null }[] = [];

      const getOdd = (val: string) => {
        const raw = allOdds?.[fixture.fixture.id]?.bookmakers?.[0]?.bets
          ?.find((b) => b.name === 'Match Winner')
          ?.values?.find((v) => v.value === val)?.odd;
        const n = parseFloat(String(raw ?? ''));
        return isNaN(n) ? null : n;
      };

      if (p.valueHome) bets.push({ fixture, type: '1', prob: p.probHome, odd: getOdd('Home') });
      if (p.valueDraw) bets.push({ fixture, type: 'X', prob: p.probDraw, odd: getOdd('Draw') });
      if (p.valueAway) bets.push({ fixture, type: '2', prob: p.probAway, odd: getOdd('Away') });

      return bets.map((b) => ({ ...b, confidence: p.confidence, dataQuality: p.dataQuality }));
    })
    .sort((a, b) => {
      const evA = a.odd ? a.prob * a.odd - 1 : 0;
      const evB = b.odd ? b.prob * b.odd - 1 : 0;
      return evB - evA;
    });

  const typeLabel: Record<string, string> = { '1': 'Ev Sahibi', 'X': 'Beraberlik', '2': 'Deplasman' };
  const typeColor: Record<string, string> = { '1': 'bg-emerald-700', 'X': 'bg-slate-600', '2': 'bg-blue-700' };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Kupon Oluşturucu</h1>
      <p className="text-slate-400 text-sm mb-6">İstatistiklere dayalı akıllı kupon önerileri</p>

      <Tabs defaultValue="smart">
        <TabsList className="bg-slate-800 mb-6">
          <TabsTrigger value="smart" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-1.5">
            <Sparkles size={14} /> Akıllı Kupon
          </TabsTrigger>
          <TabsTrigger value="poisson" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-1.5">
            <Zap size={14} /> Poisson Kuponu
            {poissonValueBets.length > 0 && (
              <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{poissonValueBets.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Akıllı Kupon Sekmesi ─────────────────────────────────────────────── */}
        <TabsContent value="smart">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filters */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-4">Filtreler</h3>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-2 block">Ligler (boş = tümü)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(LEAGUE_IDS).map(([, id]) => (
                      <button
                        key={id}
                        onClick={() => toggleLeague(id)}
                        className={cn('px-2 py-1 text-xs rounded-md border transition-colors', filters.leagues.includes(id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-emerald-500')}
                      >
                        {LEAGUE_NAMES[id]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-2 block">Bahis Türleri</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_BET_TYPES.map((bt) => (
                      <button
                        key={bt}
                        onClick={() => toggleBetType(bt)}
                        className={cn('px-2 py-1 text-xs rounded-md border transition-colors', filters.betTypes.includes(bt) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-blue-500')}
                      >
                        {BET_TYPE_LABELS[bt]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Min. Oran</label>
                    <input type="number" step="0.1" min="1" value={filters.minOdds}
                      onChange={(e) => setFilters((f) => ({ ...f, minOdds: parseFloat(e.target.value) }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Max. Oran</label>
                    <input type="number" step="0.1" min="1" value={filters.maxOdds}
                      onChange={(e) => setFilters((f) => ({ ...f, maxOdds: parseFloat(e.target.value) }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Min. Seçim</label>
                    <input type="number" min="2" max="10" value={filters.minSelections}
                      onChange={(e) => setFilters((f) => ({ ...f, minSelections: parseInt(e.target.value) }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Max. Seçim</label>
                    <input type="number" min="2" max="10" value={filters.maxSelections}
                      onChange={(e) => setFilters((f) => ({ ...f, maxSelections: parseInt(e.target.value) }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                <Button onClick={handleGenerate} disabled={!isLoaded || generating} className="w-full bg-emerald-600 hover:bg-emerald-500 gap-2">
                  {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? 'Oluşturuluyor...' : 'Kupon Oluştur'}
                </Button>

                {!isLoaded && <p className="text-xs text-slate-500 text-center mt-2">Veriler yükleniyor...</p>}
              </div>
            </div>

            {/* Coupon result */}
            <div className="lg:col-span-2">
              {!coupon ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                  <Sparkles size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">Filtreleri ayarlayıp &ldquo;Kupon Oluştur&rdquo; butonuna tıklayın</p>
                </div>
              ) : generating ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full bg-slate-800" />)}
                </div>
              ) : (
                <div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">{coupon.totalOdds.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">Toplam Oran</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{coupon.selections.length}</div>
                          <div className="text-xs text-slate-500">Seçim</div>
                        </div>
                        <div className="text-center">
                          <div className={cn('text-lg font-bold', riskColor[coupon.overallRisk])}>{RISK_LABELS[coupon.overallRisk]}</div>
                          <div className="text-xs text-slate-500">Risk</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopy} className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-1.5">
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied ? 'Kopyalandı' : 'Kopyala'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSave} className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-1.5">
                          {saved ? <Check size={14} /> : <Bookmark size={14} />}
                          {saved ? 'Kaydedildi' : 'Kaydet'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleGenerate} className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-1.5">
                          <RefreshCw size={14} /> Yenile
                        </Button>
                      </div>
                    </div>
                  </div>

                  {coupon.selections.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">Filtrelerle eşleşen seçim bulunamadı</div>
                  ) : (
                    <div className="space-y-3">
                      {coupon.selections.map((sel, i) => (
                        <SelectionCard key={`${sel.fixtureId}-${sel.betType}`} selection={sel} index={i + 1} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Poisson Kuponu Sekmesi ───────────────────────────────────────────── */}
        <TabsContent value="poisson">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filtreler */}
            <div className="lg:col-span-1">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-white">Poisson Filtreleri</h3>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Min. Güven Skoru: {poissonMinConf}</label>
                  <input
                    type="range" min={0} max={90} step={5} value={poissonMinConf}
                    onChange={(e) => setPoissonMinConf(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>0</span><span>45</span><span>90</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={poissonOnlyFull}
                    onChange={(e) => setPoissonOnlyFull(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">Sadece tam veri (her iki takım istatistiği tam)</span>
                </label>

                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs text-blue-300">
                  <p className="font-semibold mb-1">Poisson Değer Bahsi Nedir?</p>
                  <p className="text-blue-400">Model olasılığı × oran &gt; 1 ise bahisçinin oranı gerçek olasılığı hafife alıyor demektir. Yüksek beklenen değer = daha iyi fırsat.</p>
                </div>

                <div className="text-xs text-slate-500">
                  <span className="text-white font-bold">{poissonValueBets.length}</span> değer bahsi bulundu
                </div>
              </div>
            </div>

            {/* Value bets listesi */}
            <div className="lg:col-span-2">
              {!allPoisson ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-slate-800" />)}
                </div>
              ) : poissonValueBets.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                  <Zap size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">Filtrelere uygun değer bahsi bulunamadı</p>
                  <p className="text-xs text-slate-600 mt-1">Min. güven skorunu düşürün veya tam veri filtresini kaldırın</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {poissonValueBets.map((vb, i) => {
                    const p = allPoisson[vb.fixture.fixture.id];
                    const ev = vb.odd ? (vb.prob * vb.odd - 1) : null;
                    return (
                      <div key={`${vb.fixture.fixture.id}-${vb.type}`} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-slate-600 font-bold shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {vb.fixture.league.logo && <Image src={vb.fixture.league.logo} alt="" width={12} height={12} />}
                                <span className="text-xs text-slate-500">{LEAGUE_NAMES[vb.fixture.league.id] ?? vb.fixture.league.name}</span>
                                <span className="text-xs text-slate-600">• {formatTurkeyTime(vb.fixture.fixture.date)}</span>
                              </div>
                              <Link href={`/mac-analizi/${vb.fixture.fixture.id}`} className="font-medium text-slate-200 text-sm hover:text-emerald-400 transition-colors">
                                {vb.fixture.teams.home.name} vs {vb.fixture.teams.away.name}
                              </Link>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`${typeColor[vb.type]} text-white text-xs`}>{typeLabel[vb.type]}</Badge>
                            {vb.odd && (
                              <div className="text-right">
                                <div className="text-emerald-400 font-bold">{formatOdd(vb.odd)}</div>
                                <div className="text-[10px] text-slate-500">oran</div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-slate-500">Olasılık </span>
                            <span className="text-white font-bold">{Math.round(vb.prob * 100)}%</span>
                          </div>
                          {ev !== null && (
                            <div>
                              <span className="text-slate-500">Beklenen Değer </span>
                              <span className={cn('font-bold', ev > 0.1 ? 'text-emerald-400' : 'text-yellow-400')}>+{(ev * 100).toFixed(1)}%</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-500">λ </span>
                            <span className="text-slate-300">{p?.homeLambda} / {p?.awayLambda}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Güven </span>
                            <span className="text-white font-bold">{vb.confidence}</span>
                          </div>
                          {vb.dataQuality === 'partial' && (
                            <Badge className="bg-yellow-900/40 text-yellow-500 border border-yellow-800 text-[10px]">Kısmi Veri</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Kupon Geçmişi */}
      <div className="mt-8">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
        >
          <History size={16} />
          <span className="font-semibold">Kaydedilen Kuponlar</span>
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{history.length}</span>
          <span className="text-xs text-slate-600">{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          history.length === 0 ? (
            <p className="text-slate-500 text-sm">Henüz kaydedilen kupon yok.</p>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold text-lg">{h.totalOdds.toFixed(2)}</span>
                      <span className="text-slate-400 text-sm">{h.selections.length} seçim</span>
                      <span className={cn('text-xs font-medium', {
                        'text-emerald-400': h.overallRisk === 'low',
                        'text-yellow-400': h.overallRisk === 'medium',
                        'text-orange-400': h.overallRisk === 'high',
                        'text-red-400': h.overallRisk === 'very-high',
                      })}>{RISK_LABELS[h.overallRisk]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{formatTurkeyDateTime(h.savedAt)}</span>
                      <button onClick={() => handleDelete(h.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {h.selections.map((s, i) => (
                      <span key={i} className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
                        {s.homeTeam} vs {s.awayTeam} — {s.selection} @ {formatOdd(s.odds)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SelectionCard({ selection: s, index }: { selection: CouponSelection; index: number }) {
  const confColor: Record<string, string> = { high: 'bg-emerald-600', medium: 'bg-yellow-600', low: 'bg-slate-600' };
  const riskColor: Record<string, string> = { low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-orange-400', 'very-high': 'text-red-400' };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-slate-600 font-bold text-lg shrink-0">{index}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {s.leagueLogo && <Image src={s.leagueLogo} alt="" width={14} height={14} />}
              <span className="text-xs text-slate-500">{s.leagueName}</span>
              <span className="text-xs text-slate-600">• {formatTurkeyTime(s.matchDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              {s.homeTeamLogo && <Image src={s.homeTeamLogo} alt="" width={18} height={18} />}
              <span className="font-medium text-slate-200 text-sm">{s.homeTeam} vs {s.awayTeam}</span>
              {s.awayTeamLogo && <Image src={s.awayTeamLogo} alt="" width={18} height={18} />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`${confColor[s.confidence]} text-white text-xs`}>{CONFIDENCE_LABELS[s.confidence]}</Badge>
          <div className="text-right">
            <div className="text-emerald-400 font-bold text-lg">{formatOdd(s.odds)}</div>
            <div className="text-xs text-slate-500">{BET_TYPE_LABELS[s.betType]}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-slate-700 text-slate-200 font-semibold px-3 py-1 rounded-lg text-sm">{s.selection}</span>
          <span className={cn('text-xs font-medium', riskColor[s.riskRating])}>{RISK_LABELS[s.riskRating]}</span>
        </div>

        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-slate-500 hover:text-slate-300 cursor-help">
              <Info size={14} />
              <span className="text-xs">{s.scoreBreakdown.total}/100</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border-slate-700 p-3 w-56">
            <p className="text-xs font-semibold text-white mb-2">Puan Dağılımı</p>
            <div className="space-y-1 text-xs">
              <ScoreLine label="Tahmin" value={s.scoreBreakdown.predictionScore} max={30} />
              <ScoreLine label="Form" value={s.scoreBreakdown.formScore} max={25} />
              <ScoreLine label="H2H" value={s.scoreBreakdown.h2hScore} max={20} />
              <ScoreLine label="Ev Avantajı" value={s.scoreBreakdown.homeAdvantageScore} max={15} />
              <ScoreLine label="Sakatlık" value={s.scoreBreakdown.injuryImpactScore} max={0} negative />
            </div>
            {s.reasoning.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                {s.reasoning.map((r, i) => (
                  <p key={i} className="text-[10px] text-slate-400">• {r}</p>
                ))}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ScoreLine({ label, value, max, negative }: { label: string; value: number; max: number; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400">{label}</span>
      <span className={cn('font-bold', negative && value < 0 ? 'text-red-400' : 'text-emerald-400')}>
        {value > 0 ? `+${value}` : value}/{max}
      </span>
    </div>
  );
}
