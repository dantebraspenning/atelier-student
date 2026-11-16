import { and, asc, count, eq, inArray, isNull, lt } from 'drizzle-orm';
import { getDb, type DB } from '@/lib/db';
import { commission, message, photo, portfolioPiece, request } from '@/lib/db/schema';
import { fail, notFound } from '@/lib/errors';
import { processPhoto } from '@/lib/images';
import { rateLimit } from '@/lib/ratelimit';
import { storage } from '@/lib/storage';
import { studentCanSeeRequest, threadAccess } from './access';
import type { Actor } from './types';

export const PHOTO_LIMITS = { request: 6, portfolio: 8, message: 4, verification: 2 } as const;
const MAX_PENDING = 40;

export type PhotoRef = { id: string; url: string; thumbUrl: string; width: number; height: number };
type PhotoRow = typeof photo.$inferSelect;

export const photoRef = (p: Pick<PhotoRow, 'id' | 'width' | 'height'>): PhotoRef =>
  ({ id: p.id, url: `/api/photos/${p.id}`, thumbUrl: `/api/photos/${p.id}?size=thumb`, width: p.width, height: p.height });

const unattached = and(isNull(photo.requestId), isNull(photo.portfolioId), isNull(photo.messageId), isNull(photo.verificationId));

/** Process (resize, strip metadata), store and record an upload. Only the uploader can see it until it is attached. */
export async function uploadPhoto(actor: Actor, data: Buffer): Promise<PhotoRef> {
  await rateLimit(`upload:${actor.id}`, 120, 60 * 60);
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(photo).where(and(eq(photo.ownerId, actor.id), unattached));
  if (n >= MAX_PENDING) fail('tooManyPendingPhotos', 429);
  const processed = await processPhoto(data);
  const id = crypto.randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  const storageKey = `photos/${month}/${id}.jpg`;
  const thumbKey = `thumbs/${month}/${id}.webp`;
  await storage().put(storageKey, processed.full, 'image/jpeg');
  await storage().put(thumbKey, processed.thumb, 'image/webp');
  const [row] = await db.insert(photo).values({ id, ownerId: actor.id, storageKey, thumbKey, width: processed.width, height: processed.height, bytes: processed.full.length }).returning();
  return photoRef(row);
}

type Target = { requestId: string } | { portfolioId: string } | { messageId: number } | { verificationId: string };

/** Attach the owner's pending uploads to a request / piece / message / verification. Must run inside the caller's transaction. */
export async function attachPhotos(tx: DB, ownerId: string, ids: string[], target: Target, max: number) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const [[col, value]] = Object.entries(target) as [[keyof Target & string, string | number]];
  const column = { requestId: photo.requestId, portfolioId: photo.portfolioId, messageId: photo.messageId, verificationId: photo.verificationId }[col as 'requestId'];
  const [{ n: existing }] = await tx.select({ n: count() }).from(photo).where(eq(column, value as string));
  if (existing + unique.length > max) fail('tooManyPhotos', 400, { max });
  for (const [i, id] of unique.entries()) {
    const updated = await tx.update(photo).set({ [col]: value, position: existing + i })
      .where(and(eq(photo.id, id), eq(photo.ownerId, ownerId), unattached)).returning({ id: photo.id });
    if (!updated.length) fail('photoNotAttachable');
  }
}

export async function photosFor(db: DB, by: 'requestId' | 'portfolioId' | 'messageId', ids: (string | number)[], { includeHidden = false } = {}) {
  const map = new Map<string | number, PhotoRef[]>();
  if (!ids.length) return map;
  const column = { requestId: photo.requestId, portfolioId: photo.portfolioId, messageId: photo.messageId }[by];
  const rows = await db.select().from(photo)
    .where(includeHidden ? inArray(column, ids as string[]) : and(inArray(column, ids as string[]), isNull(photo.hiddenAt)))
    .orderBy(asc(photo.position), asc(photo.createdAt));
  for (const r of rows) {
    const key = r[by]!;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(photoRef(r));
  }
  return map;
}

/**
 * Portfolio photos are public. Request photos follow who can see the request, message photos who is in the
 * conversation, verification documents only the owner and admins. Unattached uploads: only the owner.
 */
export async function canViewPhoto(db: DB, viewer: Pick<Actor, 'id' | 'role'> | null, p: PhotoRow): Promise<boolean> {
  if (viewer?.role === 'admin') return true;
  if (viewer && p.ownerId === viewer.id) return true;
  if (p.hiddenAt) return false;
  if (p.portfolioId) {
    const [piece] = await db.select({ hiddenAt: portfolioPiece.hiddenAt }).from(portfolioPiece).where(eq(portfolioPiece.id, p.portfolioId));
    return !!piece && !piece.hiddenAt;
  }
  if (!viewer) return false;
  if (p.requestId) {
    const [r] = await db.select({ customerId: request.customerId }).from(request).where(eq(request.id, p.requestId));
    if (!r) return false;
    if (r.customerId === viewer.id) return true;
    return viewer.role === 'student' && (await studentCanSeeRequest(db, viewer.id, p.requestId));
  }
  if (p.messageId) {
    const [m] = await db.select({ requestId: message.requestId, studentId: message.studentId, hiddenAt: message.hiddenAt }).from(message).where(eq(message.id, p.messageId));
    if (!m || m.hiddenAt) return false;
    const access = await threadAccess(db, viewer, m.requestId, m.studentId);
    return !!access && (viewer.id === access.request.customerId || viewer.id === m.studentId);
  }
  return false;
}

export async function getPhotoFile(viewer: Pick<Actor, 'id' | 'role'> | null, id: string, size: 'full' | 'thumb') {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [p] = await db.select().from(photo).where(eq(photo.id, id));
  if (!p || !(await canViewPhoto(db, viewer, p))) notFound();
  const data = await storage().get(size === 'thumb' ? p!.thumbKey : p!.storageKey);
  if (!data) notFound();
  return { data: data!, contentType: size === 'thumb' ? 'image/webp' : 'image/jpeg', isPublic: !!p!.portfolioId && !p!.hiddenAt };
}

/** Remove an upload that hasn't been sent or saved yet. */
export async function discardPhoto(actor: Actor, id: string) {
  const db = await getDb();
  const [p] = await db.delete(photo).where(and(eq(photo.id, id), eq(photo.ownerId, actor.id), unattached)).returning();
  if (!p) notFound();
  await storage().delete([p.storageKey, p.thumbKey]);
}

/** Delete stored files for rows that are about to be (or were) deleted. */
export async function deleteFiles(rows: Pick<PhotoRow, 'storageKey' | 'thumbKey'>[]) {
  if (rows.length) await storage().delete(rows.flatMap((r) => [r.storageKey, r.thumbKey]));
}

/** Cron: remove uploads that were never attached within a day. */
export async function cleanupOrphanPhotos() {
  const db = await getDb();
  const stale = await db.delete(photo).where(and(unattached, lt(photo.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))).returning();
  await deleteFiles(stale);
  return stale.length;
}

/** Used by account deletion: drop every photo a user owns except evidence attached to commissions under dispute. */
export async function deleteUserPhotos(db: DB, userId: string) {
  const rows = await db.select().from(photo).where(eq(photo.ownerId, userId));
  const keep = new Set<string>();
  const disputed = await db.select({ requestId: commission.requestId }).from(commission)
    .where(and(eq(commission.status, 'disputed'), eq(commission.customerId, userId)));
  for (const r of rows) if (r.requestId && disputed.some((d) => d.requestId === r.requestId)) keep.add(r.id);
  const doomed = rows.filter((r) => !keep.has(r.id));
  if (doomed.length) await db.delete(photo).where(inArray(photo.id, doomed.map((r) => r.id)));
  await deleteFiles(doomed);
}
