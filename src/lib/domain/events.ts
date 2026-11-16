import type { DB } from '@/lib/db';
import { message, threadRead } from '@/lib/db/schema';

/**
 * Add a lifecycle event (quote accepted, shipped, released…) to the conversation timeline.
 * Stored as a translation key so each reader sees it in their own language.
 */
export async function postEvent(tx: DB, requestId: string, studentId: string, actorId: string | null, key: string, values: Record<string, string | number>) {
  const [m] = await tx.insert(message).values({ requestId, studentId, senderId: actorId, kind: 'event', event: { key, values } }).returning({ id: message.id });
  if (actorId) await markRead(tx, actorId, requestId, studentId, m.id);
  return m.id;
}

export async function markRead(tx: DB, userId: string, requestId: string, studentId: string, lastId: number) {
  await tx.insert(threadRead).values({ userId, requestId, studentId, lastReadId: lastId })
    .onConflictDoUpdate({ target: [threadRead.userId, threadRead.requestId, threadRead.studentId], set: { lastReadId: lastId } });
}
