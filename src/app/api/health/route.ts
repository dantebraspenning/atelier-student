import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

/** Liveness + database check for the load balancer / uptime monitor. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
