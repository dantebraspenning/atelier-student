import { NextResponse } from 'next/server';
import { dac7Export } from '@/lib/domain/admin';
import { errorResponse } from '@/lib/http';
import { requireActor } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const year = Number(new URL(request.url).searchParams.get('year')) || new Date().getUTCFullYear() - 1;
    const csv = await dac7Export(await requireActor('admin'), year);
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dac7-${year}.csv"`, 'Cache-Control': 'no-store' }
    });
  } catch (e) { return errorResponse(e); }
}
