'use client';

import { use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useWeekFixtures, useFixtureOdds, useFixturePrediction, useH2H, useTeamInjuries } from '@/hooks/useData';
import { formatTurkeyDateTime, formatOdd, formToColor, formatScore, cn, LEAGUE_NAMES } from '@/lib/utils';
import type { Fixture } from '@/types/api-football';

export default function MatchDetailPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId: fixtureIdStr } = use(params);
  const fixtureId = Number(fixtureIdStr);

  const { data: weekFixtures } = useWeekFixtures();
  const { data: odds, isLoading: loadingOdds } = useFixtureOdds(fixtureId);
  const { data: prediction, isLoading: loadingPred } = useFixturePrediction(fixtureId);

  const fixture = Object.values(weekFixtures ?? {}).flat().find(
    (f) => f.fixture.id === fixtureId
  );

  const homeId = fixture?.teams.home.id ?? null;
  const awayId = fixture?.teams.away.id ?? null;

  const { data: h2h, isLoading: loadingH2H } = useH2H(homeId, awayId);
  const { data: homeInjuries } = useTeamInjuries(homeId);
  const { data: awayInjuries } = useTeamInjuries(awayId);

  if (!fixture) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Maç bulunamadı. Veriler henüz yüklenmemiş olabilir.</p>
        <Link href="/mac-analizi" className="text-emerald-400 hover:underline mt-2 block">
          ← Maç Listesine Dön
        </Link>
      </div>
    );
  }

  const { home, away } = fixture.teams;
  const pred = prediction?.predictions;

  return (
    <div>
      {/* Back */}
      <Link href="/mac-analizi" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
        <ArrowLeft size={16} /> Maç Listesi
      </Link>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {fixture.league.logo && (
            <Image src={fixture.league.logo} alt={fixture.league.name} width={20} height={20} />
          )}
          <span className="text-slate-400 text-sm">{LEAGUE_NAMES[fixture.league.id] ?? fixture.league.name}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 text-sm">{formatTurkeyDateTime(fixture.fixture.date)}</span>
          <StatusBadge status={fixture.fixture.status.short} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <TeamDisplay team={home} highlight={pred?.winner?.id === home.id} />
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {formatScore(fixture.goals.home, fixture.goals.away)}
            </div>
            {fixture.fixture.status.short === 'NS' && (
              <span className="text-xs text-slate-500 mt-1 block">Başlamadı</span>
            )}
          </div>
          <TeamDisplay team={away} highlight={pred?.winner?.id === away.id} reverse />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prediction">
        <TabsList className="bg-slate-800 mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="prediction" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Tahmin</TabsTrigger>
          <TabsTrigger value="odds" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Oranlar</TabsTrigger>
          <TabsTrigger value="h2h" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">H2H</TabsTrigger>
          <TabsTrigger value="form" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Form</TabsTrigger>
          <TabsTrigger value="injuries" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Sakatlıklar</TabsTrigger>
        </TabsList>

        {/* Prediction Tab */}
        <TabsContent value="prediction">
          {loadingPred ? <Skeleton className="h-48 w-full bg-slate-800" /> : !prediction ? (
            <EmptyInfo text="Bu maç için tahmin verisi mevcut değil" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-1">Maç Tahmini</h3>
                <p className="text-xs text-slate-500 mb-4">Son form, H2H geçmişi, ev/deplasman istatistikleri ve takım gücüne göre hesaplanır.</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Kazanma Olasılıkları</span>
                  </div>
                  <div className="space-y-2">
                    <PredBar label={home.name} value={parseFloat(pred!.percent.home)} color="bg-emerald-500" />
                    <PredBar label="Beraberlik" value={parseFloat(pred!.percent.draw)} color="bg-slate-500" />
                    <PredBar label={away.name} value={parseFloat(pred!.percent.away)} color="bg-blue-500" />
                  </div>
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-slate-400 text-xs mb-1">Tahmin Özeti</p>
                    <p className="text-emerald-400 font-medium text-sm">
                      {pred!.winner?.name
                        ? `${pred!.winner.name} kazanır`
                        : 'Beraberlik bekleniyor'}
                    </p>
                  </div>
                  {pred!.under_over && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Alt/Üst Tahmini</p>
                      <Badge className={Number(pred!.under_over) < 0 ? 'bg-slate-600' : 'bg-blue-600'}>
                        {Number(pred!.under_over) < 0
                          ? `${Math.abs(Number(pred!.under_over))} Alt`
                          : `${pred!.under_over} Üst`}
                      </Badge>
                    </div>
                  )}
                  {pred!.goals &&
                    pred!.goals.home !== null &&
                    pred!.goals.away !== null &&
                    Number(pred!.goals.home) >= 0 &&
                    Number(pred!.goals.away) >= 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Tahmini Skor</p>
                      <span className="text-white font-bold">{pred!.goals.home} - {pred!.goals.away}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparison */}
              {prediction.comparison && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <h3 className="font-semibold text-white mb-4">Karşılaştırma</h3>
                  <div className="space-y-3">
                    {Object.entries(prediction.comparison).map(([key, val]) => {
                      if (typeof val !== 'object') return null;
                      const labelMap: Record<string, string> = {
                        form: 'Form', att: 'Atak', def: 'Savunma',
                        poisson_distribution: 'Dağılım', h2h: 'Karşılaşma',
                        goals: 'Goller', total: 'Toplam',
                      };
                      const homeVal = parseFloat(val.home);
                      const awayVal = parseFloat(val.away);
                      const total = homeVal + awayVal || 1;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{val.home}</span>
                            <span>{labelMap[key] ?? key}</span>
                            <span>{val.away}</span>
                          </div>
                          <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                            <div className="bg-emerald-500 transition-all" style={{ width: `${(homeVal / total) * 100}%` }} />
                            <div className="bg-blue-500 transition-all" style={{ width: `${(awayVal / total) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Odds Tab */}
        <TabsContent value="odds">
          {loadingOdds ? <Skeleton className="h-48 w-full bg-slate-800" /> : !odds ? (
            <EmptyInfo text="Bu maç için oran verisi mevcut değil" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {odds.bookmakers?.[0]?.bets?.map((bet) => (
                <div key={bet.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <h4 className="font-medium text-slate-300 mb-3 text-sm">{bet.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {bet.values.map((v) => (
                      <div key={v.value} className="flex flex-col items-center bg-slate-700 rounded-lg px-3 py-2 min-w-[64px]">
                        <span className="text-[10px] text-slate-400">{v.value}</span>
                        <span className="text-sm font-bold text-emerald-400">{formatOdd(v.odd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* H2H Tab */}
        <TabsContent value="h2h">
          {loadingH2H ? <Skeleton className="h-48 w-full bg-slate-800" /> : !h2h?.length ? (
            <EmptyInfo text="H2H verisi mevcut değil" />
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900">
                    <th className="text-left p-3 text-slate-400 font-medium">Tarih</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Ev Sahibi</th>
                    <th className="text-center p-3 text-slate-400 font-medium">Skor</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Deplasman</th>
                    <th className="text-left p-3 text-slate-400 font-medium hidden md:table-cell">Lig</th>
                  </tr>
                </thead>
                <tbody>
                  {h2h.map((f, i) => {
                    const hg = f.score.fulltime.home;
                    const ag = f.score.fulltime.away;
                    const homeWon = hg !== null && ag !== null && hg > ag;
                    const awayWon = hg !== null && ag !== null && ag > hg;
                    return (
                      <tr key={f.fixture.id} className={cn('border-b border-slate-700/50', i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50')}>
                        <td className="p-3 text-slate-500 text-xs">{f.fixture.date?.slice(0, 10)}</td>
                        <td className={cn('p-3 text-right font-medium', homeWon ? 'text-emerald-400' : 'text-slate-300')}>{f.teams.home.name}</td>
                        <td className="p-3 text-center font-bold text-white">{hg ?? '-'} - {ag ?? '-'}</td>
                        <td className={cn('p-3 font-medium', awayWon ? 'text-emerald-400' : 'text-slate-300')}>{f.teams.away.name}</td>
                        <td className="p-3 text-slate-500 text-xs hidden md:table-cell">{f.league.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Form Tab */}
        <TabsContent value="form">
          {!prediction ? <EmptyInfo text="Form verisi mevcut değil" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormCard team={home} teamData={prediction.teams.home} />
              <FormCard team={away} teamData={prediction.teams.away} />
            </div>
          )}
        </TabsContent>

        {/* Injuries Tab */}
        <TabsContent value="injuries">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InjuryList teamName={home.name} teamLogo={home.logo} injuries={homeInjuries ?? []} />
            <InjuryList teamName={away.name} teamLogo={away.logo} injuries={awayInjuries ?? []} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamDisplay({ team, highlight, reverse }: { team: Fixture['teams']['home']; highlight: boolean; reverse?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 flex-1', reverse ? 'flex-row-reverse' : '')}>
      {team.logo && <Image src={team.logo} alt={team.name} width={48} height={48} />}
      <span className={cn('text-lg font-bold', highlight ? 'text-emerald-400' : 'text-white', reverse ? 'text-right' : '')}>{team.name}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = { FT: 'bg-slate-600', NS: 'bg-blue-600', '1H': 'bg-green-600', '2H': 'bg-green-600', HT: 'bg-yellow-600' };
  const labelMap: Record<string, string> = { FT: 'Bitti', NS: 'Başlamadı', '1H': '1. Yarı', '2H': '2. Yarı', HT: 'Devre Arası' };
  return <Badge className={`${colorMap[status] ?? 'bg-slate-600'} text-white text-xs`}>{labelMap[status] ?? status}</Badge>;
}

function PredBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span className="truncate max-w-[160px]">{label}</span>
        <span className="font-bold text-white ml-2 shrink-0">{value}%</span>
      </div>
      <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FormCard({ team, teamData }: { team: Fixture['teams']['home']; teamData: import('@/types/api-football').PredictionTeamForm }) {
  const form = teamData.last_5?.form ?? '';
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {team.logo && <Image src={team.logo} alt={team.name} width={24} height={24} />}
        <span className="font-semibold text-white">{team.name}</span>
      </div>
      <div className="flex gap-1 mb-3">
        {form.split('').map((c, i) => (
          <span key={i} className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white', formToColor(c))}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <StatBox label="Ort Gol (Ev)" value={teamData.last_5?.goals?.for?.average ?? '-'} />
        <StatBox label="Ort Yenilen" value={teamData.last_5?.goals?.against?.average ?? '-'} />
        <StatBox label="Son 5 Puan" value={String(teamData.last_5?.goals?.for?.total ?? '-')} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700 rounded-lg p-2">
      <div className="text-emerald-400 font-bold text-sm">{value}</div>
      <div className="text-slate-500 text-[10px]">{label}</div>
    </div>
  );
}

function InjuryList({ teamName, teamLogo, injuries }: { teamName: string; teamLogo: string; injuries: import('@/types/api-football').InjuryRecord[] }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {teamLogo && <Image src={teamLogo} alt={teamName} width={24} height={24} />}
        <span className="font-semibold text-white">{teamName}</span>
        {injuries.length > 0 && (
          <Badge className="bg-red-600 text-white text-xs ml-auto">{injuries.length} sakatlık</Badge>
        )}
      </div>
      {injuries.length === 0 ? (
        <p className="text-slate-500 text-sm">Bilinen sakatlık yok</p>
      ) : (
        <div className="space-y-2">
          {injuries.map((inj) => (
            <div key={inj.player.id} className="flex items-center gap-2 text-sm">
              <div className={cn('w-2 h-2 rounded-full shrink-0', inj.type === 'Missing Fixture' ? 'bg-red-500' : 'bg-yellow-500')} />
              <span className="text-slate-300 font-medium">{inj.player.name}</span>
              <span className="text-slate-500 text-xs ml-auto">{inj.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyInfo({ text }: { text: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
      {text}
    </div>
  );
}
