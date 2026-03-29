import { NextRequest, NextResponse } from 'next/server';
import { runDailyRefresh } from '@/lib/request-planner';
import { generateExcel } from '@/lib/excel-generator';
import { getCache, saveExcel, invalidateCache } from '@/lib/data-cache';

export const dynamic = 'force-dynamic';
// For Railway: no timeout limit needed. For Vercel Pro: set maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// POST /api/cron — main trigger (called by scheduler or manual)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // 1. Fetch all data from API
    invalidateCache();
    const result = await runDailyRefresh();

    // 2. Generate Excel
    const cache = await getCache();
    const excelBuffer = await generateExcel(cache);
    await saveExcel(excelBuffer);

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      status: result.status,
      requestsUsed: result.requestsUsed,
      fixtureCount: result.fixtureCount,
      errors: result.errors,
      durationSeconds: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET /api/cron — health check, returns cache meta
export async function GET(req: NextRequest) {
  // Allow unauthenticated health checks
  try {
    const cache = await getCache();
    return NextResponse.json({
      status: cache.meta.status,
      lastUpdated: cache.meta.lastUpdated,
      nextUpdate: cache.meta.nextUpdate,
      requestsUsed: cache.meta.requestsUsed,
      fixtureCount: cache.meta.fixtureCount,
      leagues: cache.meta.leagues,
    });
  } catch {
    return NextResponse.json({ status: 'error', message: 'Cache okunamadı' }, { status: 500 });
  }
}
