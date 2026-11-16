import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { appRateLimit } from '@/lib/db/schema';
import { expireStalePayments, releaseDuePayments, sendReceiptReminders } from '@/lib/domain/commissions';
import { cleanupOrphanPhotos } from '@/lib/domain/photos';
import { expireOldRequests } from '@/lib/domain/requests';
import { env, isProduction } from '@/lib/env';

/**
 * Scheduled jobs. Call with `Authorization: Bearer $CRON_SECRET`:
 *   every 15 min: /api/cron/payments   (auto-release, reminders, stale checkouts)
 *   daily:        /api/cron/daily      (expire old requests, delete orphan uploads, prune rate limits)
 */
const JOBS: Record<string, () => Promise<Record<string, number>>> = {
  payments: async () => ({ released: await releaseDuePayments(), reminded: await sendReceiptReminders(), expiredCheckouts: await expireStalePayments() }),
  daily: async () => {
    const db = await getDb();
    const pruned = await db.delete(appRateLimit).where(lt(appRateLimit.windowStart, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))).returning();
    return { expiredRequests: await expireOldRequests(), orphanPhotos: await cleanupOrphanPhotos(), prunedRateLimits: pruned.length };
  }
};

function authorised(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return !isProduction();
  const given = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request, { params }: RouteContext<'/api/cron/[job]'>) {
  if (!authorised(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const job = JOBS[(await params).job];
  if (!job) return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  const started = Date.now();
  const result = await job();
  console.info(JSON.stringify({ level: 'info', msg: 'cron', job: (await params).job, ms: Date.now() - started, ...result }));
  return NextResponse.json({ ok: true, ...result });
}

export { run as GET, run as POST };
