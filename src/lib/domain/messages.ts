import { and, asc, count, desc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DB } from '@/lib/db';
import { message, quote, request, threadRead, user } from '@/lib/db/schema';
import { fail, notFound } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { threadAccess } from './access';
import { markRead } from './events';
import { deliver } from './notify';
import { attachPhotos, photosFor, PHOTO_LIMITS, type PhotoRef } from './photos';
import { shortName } from './students';
import type { Actor } from './types';

export type ThreadMessage = {
  id: number; kind: 'text' | 'event'; body: string; event: { key: string; values?: Record<string, string | number> } | null;
  mine: boolean; createdAt: string; photos: PhotoRef[];
};

async function serialize(db: DB, viewerId: string, rows: (typeof message.$inferSelect)[]): Promise<ThreadMessage[]> {
  const photos = await photosFor(db, 'messageId', rows.filter((r) => r.kind === 'text').map((r) => r.id));
  return rows.map((m) => ({
    id: m.id, kind: m.kind, body: m.hiddenAt ? '' : m.body, event: m.event ?? null, mine: m.senderId === viewerId,
    createdAt: m.createdAt.toISOString(), photos: m.hiddenAt ? [] : photos.get(m.id) ?? []
  }));
}

/** Messages after `afterId` (0 = all). Marks them read for the viewer. */
export async function getThread(actor: Actor, requestId: string, studentId: string, afterId = 0) {
  const db = await getDb();
  const access = await threadAccess(db, actor, requestId, studentId);
  if (!access) notFound();
  const rows = await db.select().from(message)
    .where(and(eq(message.requestId, requestId), eq(message.studentId, studentId), gt(message.id, afterId))).orderBy(asc(message.id)).limit(500);
  if (rows.length && actor.role !== 'admin') await markRead(db, actor.id, requestId, studentId, rows[rows.length - 1].id);
  const { request: r, student, quote: q, commission: c } = access!;
  const [customer] = await db.select({ name: user.name }).from(user).where(eq(user.id, r.customerId));
  return {
    thread: {
      requestId, studentId, title: r.title, garment: r.garment, requestStatus: r.status, canWrite: access!.canWrite,
      customer: { id: r.customerId, name: shortName(customer?.name ?? '') }, student: { id: student.id, name: student.name },
      quote: q ? { status: q.status, totalCents: q.labourCents + q.fabricCents + q.shippingCents } : null,
      commission: c ? { id: c.id, status: c.status, handover: c.handover } : null
    },
    messages: await serialize(db, actor.id, rows)
  };
}

export const messageInput = z.object({
  body: z.string().max(4000).default(''),
  photoIds: z.array(z.uuid()).max(PHOTO_LIMITS.message).default([])
});

export async function sendMessage(actor: Actor, requestId: string, studentId: string, input: z.input<typeof messageInput>) {
  const v = messageInput.parse(input);
  const body = v.body.trim();
  if (!body && !v.photoIds.length) fail('emptyMessage');
  await rateLimit(`msg:${actor.id}`, 60, 10 * 60);
  const db = await getDb();
  const access = await threadAccess(db, actor, requestId, studentId);
  if (!access || (actor.id !== access.request.customerId && actor.id !== studentId)) notFound();
  if (!access!.canWrite) fail('conversationClosed', 409);
  const id = await db.transaction(async (tx) => {
    const [m] = await tx.insert(message).values({ requestId, studentId, senderId: actor.id, body }).returning();
    await attachPhotos(tx, actor.id, v.photoIds, { messageId: m.id }, PHOTO_LIMITS.message);
    await markRead(tx, actor.id, requestId, studentId, m.id);
    return m.id;
  });
  await emailRecipientIfIdle(db, actor, access!.request, studentId, body || '📷');
  const [row] = await db.select().from(message).where(eq(message.id, id));
  return (await serialize(db, actor.id, [row]))[0];
}

/** Email the other side about new messages at most every 30 minutes per thread, and only if they haven't read the thread since. */
async function emailRecipientIfIdle(db: DB, sender: Actor, r: typeof request.$inferSelect, studentId: string, preview: string) {
  const recipientId = sender.id === studentId ? r.customerId : studentId;
  const [rec] = await db.select({ notify: user.notifyMessages, deletedAt: user.deletedAt }).from(user).where(eq(user.id, recipientId));
  if (!rec || rec.deletedAt) return;
  const [read] = await db.select().from(threadRead).where(and(eq(threadRead.userId, recipientId), eq(threadRead.requestId, r.id), eq(threadRead.studentId, studentId)));
  const recently = read?.lastEmailedAt && read.lastEmailedAt.getTime() > Date.now() - 30 * 60 * 1000;
  const path = recipientId === r.customerId ? `/messages/${r.id}/${studentId}` : `/messages/${r.id}/${studentId}`;
  await deliver([{ userId: recipientId, type: 'newMessage', values: { from: sender.role === 'student' ? sender.name : shortName(sender.name), title: r.title, preview: preview.slice(0, 160) }, path, email: rec.notify && !recently ? 'newMessage' : undefined }]);
  if (rec.notify && !recently) {
    await db.insert(threadRead).values({ userId: recipientId, requestId: r.id, studentId, lastReadId: read?.lastReadId ?? 0, lastEmailedAt: new Date() })
      .onConflictDoUpdate({ target: [threadRead.userId, threadRead.requestId, threadRead.studentId], set: { lastEmailedAt: new Date() } });
  }
}

/** Every conversation a user takes part in, newest activity first. */
export async function listThreads(actor: Actor) {
  const db = await getDb();
  const isStudent = actor.role === 'student';
  const pairs = isStudent
    ? await db.selectDistinct({ requestId: message.requestId, studentId: message.studentId }).from(message).where(eq(message.studentId, actor.id))
      .union(db.selectDistinct({ requestId: quote.requestId, studentId: quote.studentId }).from(quote).where(eq(quote.studentId, actor.id)))
    : await db.selectDistinct({ requestId: message.requestId, studentId: message.studentId }).from(message).innerJoin(request, eq(request.id, message.requestId)).where(eq(request.customerId, actor.id))
      .union(db.selectDistinct({ requestId: quote.requestId, studentId: quote.studentId }).from(quote).innerJoin(request, eq(request.id, quote.requestId)).where(eq(request.customerId, actor.id)));
  const out = [];
  for (const p of pairs) {
    const access = await threadAccess(db, actor, p.requestId, p.studentId);
    if (!access) continue;
    const [last] = await db.select().from(message).where(and(eq(message.requestId, p.requestId), eq(message.studentId, p.studentId))).orderBy(desc(message.id)).limit(1);
    const [read] = await db.select({ id: threadRead.lastReadId }).from(threadRead).where(and(eq(threadRead.userId, actor.id), eq(threadRead.requestId, p.requestId), eq(threadRead.studentId, p.studentId)));
    const [{ n }] = await db.select({ n: count() }).from(message).where(and(eq(message.requestId, p.requestId), eq(message.studentId, p.studentId), gt(message.id, read?.id ?? 0),
      or(isNull(message.senderId), ne(message.senderId, actor.id))));
    const [cust] = await db.select({ name: user.name }).from(user).where(eq(user.id, access.request.customerId));
    const lastPhotos = last && !last.body && last.kind === 'text' ? (await photosFor(db, 'messageId', [last.id])).get(last.id)?.length ?? 0 : 0;
    out.push({
      requestId: p.requestId, studentId: p.studentId, title: access.request.title, garment: access.request.garment,
      with: isStudent ? shortName(cust?.name ?? '') : access.student.name,
      stage: access.commission?.status ?? (access.quote ? access.quote.status : access.request.status === 'open' ? 'question' : 'closed'),
      last: last ? { body: last.hiddenAt ? '' : last.body, kind: last.kind, event: last.event, mine: last.senderId === actor.id, photos: lastPhotos, createdAt: last.createdAt.toISOString() } : null,
      unread: Number(n), canWrite: access.canWrite,
      updatedAt: (last?.createdAt ?? access.quote?.createdAt ?? access.request.createdAt).toISOString()
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Total unread messages across all threads (header badge). */
export async function unreadCount(actor: Actor) {
  const db = await getDb();
  const res = await db.execute(sql`
    select count(*)::int as n from ${message} m
    join ${request} r on r.id = m.request_id
    left join ${threadRead} tr on tr.user_id = ${actor.id} and tr.request_id = m.request_id and tr.student_id = m.student_id
    where (r.customer_id = ${actor.id} or m.student_id = ${actor.id})
      and (m.sender_id is null or m.sender_id <> ${actor.id})
      and m.id > coalesce(tr.last_read_id, 0)`);
  return (res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
}

