import { NextRequest, NextResponse } from 'next/server';
import { getCache } from '@/lib/data-cache';

export const dynamic = 'force-dynamic';

type DataType =
  | 'fixtures'
  | 'odds'
  | 'predictions'
  | 'injuries'
  | 'standings'
  | 'h2h'
  | 'team-stats'
  | 'meta';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const dataType = type as DataType;
  const { searchParams } = req.nextUrl;
  const leagueId = searchParams.get('league') ? Number(searchParams.get('league')) : null;
  const fixtureId = searchParams.get('fixture') ? Number(searchParams.get('fixture')) : null;
  const teamId = searchParams.get('team') ? Number(searchParams.get('team')) : null;

  try {
    const cache = await getCache();

    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    };

    switch (dataType) {
      case 'meta':
        return NextResponse.json(cache.meta, { headers });

      case 'fixtures': {
        const day = searchParams.get('day'); // 'today' | 'tomorrow' | undefined
        if (day === 'today') return NextResponse.json(cache.fixtures.today, { headers });
        if (day === 'tomorrow') return NextResponse.json(cache.fixtures.tomorrow, { headers });
        if (leagueId) return NextResponse.json(cache.fixtures.byLeague[leagueId] ?? [], { headers });
        return NextResponse.json(cache.fixtures, { headers });
      }

      case 'odds': {
        if (fixtureId) return NextResponse.json(cache.odds.byFixture[fixtureId] ?? null, { headers });
        return NextResponse.json(cache.odds.byFixture, { headers });
      }

      case 'predictions': {
        if (fixtureId) return NextResponse.json(cache.predictions.byFixture[fixtureId] ?? null, { headers });
        return NextResponse.json(cache.predictions.byFixture, { headers });
      }

      case 'injuries': {
        if (leagueId) return NextResponse.json(cache.injuries.byLeague[leagueId] ?? [], { headers });
        if (teamId) return NextResponse.json(cache.injuries.byTeam[teamId] ?? [], { headers });
        return NextResponse.json(cache.injuries, { headers });
      }

      case 'standings': {
        if (leagueId) return NextResponse.json(cache.standings.byLeague[leagueId] ?? [], { headers });
        return NextResponse.json(cache.standings.byLeague, { headers });
      }

      case 'h2h': {
        const pair = searchParams.get('pair'); // "teamA_teamB"
        if (pair) return NextResponse.json(cache.h2h.byFixturePair[pair] ?? [], { headers });
        return NextResponse.json(cache.h2h.byFixturePair, { headers });
      }

      case 'team-stats': {
        if (teamId) return NextResponse.json(cache.teamStats.byTeam[teamId] ?? null, { headers });
        return NextResponse.json(cache.teamStats.byTeam, { headers });
      }

      default:
        return NextResponse.json({ error: 'Geçersiz veri tipi' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
