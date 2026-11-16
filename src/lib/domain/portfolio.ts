import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { commission, GARMENTS, photo, portfolioPiece, request } from '@/lib/db/schema';
import { fail, forbidden, notFound } from '@/lib/errors';
import { attachPhotos, deleteFiles, photosFor, PHOTO_LIMITS } from './photos';
import type { Actor } from './types';

export const pieceInput = z.object({
  title: z.string().trim().min(2).max(100),
  garment: z.enum(GARMENTS),
  material: z.string().trim().max(80).default(''),
  story: z.string().trim().max(2000).default(''),
  kind: z.enum(['commission', 'coursework']).default('coursework'),
  commissionId: z.uuid().nullish(),
  photoIds: z.array(z.uuid()).max(PHOTO_LIMITS.portfolio).default([])
});

export async function addPiece(actor: Actor, input: z.input<typeof pieceInput>) {
  if (actor.role !== 'student') forbidden();
  const v = pieceInput.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    let kind = v.kind;
    if (v.commissionId) {
      const [c] = await tx.select().from(commission).where(and(eq(commission.id, v.commissionId), eq(commission.studentId, actor.id))).for('update');
      if (!c) notFound();
      if (c!.status !== 'completed') fail('onlyCompletedToPortfolio', 409);
      if (c!.inPortfolio) fail('alreadyInPortfolio', 409);
      await tx.update(commission).set({ inPortfolio: true }).where(eq(commission.id, c!.id));
      kind = 'commission';
    }
    const [p] = await tx.insert(portfolioPiece).values({ studentId: actor.id, title: v.title, garment: v.garment, material: v.material, story: v.story, kind, commissionId: v.commissionId ?? null }).returning();
    await attachPhotos(tx, actor.id, v.photoIds, { portfolioId: p.id }, PHOTO_LIMITS.portfolio);
    return p.id;
  });
}

export async function addPiecePhotos(actor: Actor, pieceId: string, photoIds: string[]) {
  const db = await getDb();
  const [p] = await db.select().from(portfolioPiece).where(and(eq(portfolioPiece.id, pieceId), eq(portfolioPiece.studentId, actor.id)));
  if (!p) notFound();
  if (!photoIds.length) fail('photoRequired');
  await db.transaction((tx) => attachPhotos(tx, actor.id, photoIds, { portfolioId: pieceId }, PHOTO_LIMITS.portfolio));
}

export async function deletePiece(actor: Actor, pieceId: string) {
  const db = await getDb();
  const files = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(portfolioPiece).where(and(eq(portfolioPiece.id, pieceId), eq(portfolioPiece.studentId, actor.id)));
    if (!p) notFound();
    const photos = await tx.select().from(photo).where(eq(photo.portfolioId, pieceId));
    await tx.delete(portfolioPiece).where(eq(portfolioPiece.id, pieceId));
    if (p!.commissionId) await tx.update(commission).set({ inPortfolio: false }).where(eq(commission.id, p!.commissionId));
    return photos;
  });
  await deleteFiles(files);
}

export async function ownPortfolio(actor: Actor) {
  const db = await getDb();
  const pieces = await db.select().from(portfolioPiece).where(eq(portfolioPiece.studentId, actor.id)).orderBy(desc(portfolioPiece.createdAt));
  const photos = await photosFor(db, 'portfolioId', pieces.map((p) => p.id));
  return pieces.map((p) => ({ ...p, photos: photos.get(p.id) ?? [] }));
}

/** Completed commissions not yet in the portfolio, with their request title for prefilling. */
export async function portfolioCandidates(actor: Actor) {
  const db = await getDb();
  return db.select({ id: commission.id, title: request.title, garment: request.garment }).from(commission)
    .innerJoin(request, eq(request.id, commission.requestId))
    .where(and(eq(commission.studentId, actor.id), eq(commission.status, 'completed'), eq(commission.inPortfolio, false), isNull(commission.cancelledAt)));
}
