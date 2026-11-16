import { NextResponse } from 'next/server';
import { and, count, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { unreadCount } from '@/lib/domain/messages';
import { getActor } from '@/lib/session';

/** Header badges: unread messages and notifications. */
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ messages: 0, notifications: 0 });
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(notification).where(and(eq(notification.userId, actor.id), isNull(notification.readAt)));
  return NextResponse.json({ messages: await unreadCount(actor), notifications: Number(n) }, { headers: { 'Cache-Control': 'no-store' } });
}
