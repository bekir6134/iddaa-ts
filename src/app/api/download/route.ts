import { NextRequest, NextResponse } from 'next/server';
import { readExcel, getCache, saveExcel } from '@/lib/data-cache';
import { generateExcel } from '@/lib/excel-generator';
import { getTurkeyDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    let buffer = await readExcel();

    // If no Excel file exists yet, generate on-demand
    if (!buffer) {
      const cache = await getCache();
      buffer = await generateExcel(cache);
      await saveExcel(buffer);
    }

    const dateStr = getTurkeyDate();
    const filename = `iddaa-analiz-${dateStr}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Excel oluşturma hatası';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
