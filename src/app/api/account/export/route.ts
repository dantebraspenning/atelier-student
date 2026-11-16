import { NextResponse } from 'next/server';
import { exportData } from '@/lib/domain/account';
import { errorResponse } from '@/lib/http';
import { requireActor } from '@/lib/session';

export async function GET() {
  try {
    const data = await exportData(await requireActor());
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="atelier-student-data.json"', 'Cache-Control': 'no-store' }
    });
  } catch (e) { return errorResponse(e); }
}
