import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { commission, request, review } from '@/lib/db/schema';
import { fail, notFound } from '@/lib/errors';
import { deliver } from './notify';
import { shortName } from './students';
import type { Actor } from './types';

export const reviewInput = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).default('') });

/** Customers review a completed commission once. */
export async function createReview(actor: Actor, commissionId: string, input: z.input<typeof reviewInput>) {
  const v = reviewInput.parse(input);
  const db = await getDb();
  const [c] = await db.select().from(commission).where(and(eq(commission.id, commissionId), eq(commission.customerId, actor.id)));
  if (!c) notFound();
  if (c!.status !== 'completed') fail('reviewOnlyCompleted', 409);
  const [r] = await db.insert(review).values({ commissionId, customerId: actor.id, studentId: c!.studentId, rating: v.rating, body: v.body }).onConflictDoNothing().returning();
  if (!r) fail('alreadyReviewed', 409);
  const [req] = await db.select({ title: request.title }).from(request).where(eq(request.id, c!.requestId));
  await deliver([{ userId: c!.studentId, type: 'reviewReceived', values: { rating: v.rating, customer: shortName(actor.name), title: req.title }, path: '/studio/reviews', email: 'reviewReceived' }]);
}

export async function replyToReview(actor: Actor, reviewId: string, reply: string) {
  const text = z.string().trim().min(2).max(1000).parse(reply);
  const db = await getDb();
  const [r] = await db.update(review).set({ reply: text, repliedAt: new Date() })
    .where(and(eq(review.id, reviewId), eq(review.studentId, actor.id))).returning();
  if (!r) notFound();
}

export async function reviewForCommission(commissionId: string) {
  const db = await getDb();
  const [r] = await db.select().from(review).where(eq(review.commissionId, commissionId));
  return r ?? null;
}

export async function ownReviews(actor: Actor) {
  const db = await getDb();
  return db.select().from(review).where(eq(review.studentId, actor.id));
}
