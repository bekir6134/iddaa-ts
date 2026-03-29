import { NextRequest, NextResponse } from 'next/server';
import { getStandings, getFixturesLast } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

// GET /api/debug?secret=xxx — ham API cevabını görmek için
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const [standingsRes, fixturesRes] = await Promise.all([
      getStandings(203),      // Süper Lig
      getFixturesLast(203, 5), // Süper Lig last 5
    ]);

    return NextResponse.json({
      standings: {
        results: standingsRes.results,
        errors: standingsRes.errors,
        firstResponseKeys: standingsRes.response?.[0] ? Object.keys(standingsRes.response[0]) : [],
        sample: standingsRes.response?.[0],
      },
      fixtures: {
        results: fixturesRes.results,
        errors: fixturesRes.errors,
        firstFixture: fixturesRes.response?.[0] ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
