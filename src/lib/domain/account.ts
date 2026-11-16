import { and, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import {
  account, commission, message, notification, portfolioPiece, quote, request, review, session, studentProfile, taxDetails, threadRead, user
} from '@/lib/db/schema';
import { audit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { fail } from '@/lib/errors';
import { deleteUserPhotos } from './photos';
import type { Actor } from './types';

export const settingsInput = z.object({
  name: z.string().trim().min(2).max(80),
  locale: z.enum(['nl', 'en']),
  notifyMessages: z.boolean()
});

export async function updateSettings(actor: Actor, input: z.input<typeof settingsInput>) {
  const v = settingsInput.parse(input);
  const db = await getDb();
  await db.update(user).set({ ...v, updatedAt: new Date() }).where(eq(user.id, actor.id));
}

/** GDPR article 15/20: everything we hold about the user, as JSON. */
export async function exportData(actor: Actor) {
  const db = await getDb();
  const [me] = await db.select().from(user).where(eq(user.id, actor.id));
  const [profile] = await db.select().from(studentProfile).where(eq(studentProfile.userId, actor.id));
  const [tax] = await db.select().from(taxDetails).where(eq(taxDetails.userId, actor.id));
  return {
    exportedAt: new Date().toISOString(),
    account: { id: me.id, name: me.name, email: me.email, role: me.role, locale: me.locale, createdAt: me.createdAt, notifyMessages: me.notifyMessages },
    studentProfile: profile ?? null,
    taxDetails: tax ? { ...tax, tinEncrypted: '[stored encrypted — available on request]' } : null,
    requests: await db.select().from(request).where(eq(request.customerId, actor.id)),
    quotes: await db.select().from(quote).where(eq(quote.studentId, actor.id)),
    commissions: await db.select().from(commission).where(or(eq(commission.customerId, actor.id), eq(commission.studentId, actor.id))),
    portfolio: await db.select().from(portfolioPiece).where(eq(portfolioPiece.studentId, actor.id)),
    reviews: await db.select().from(review).where(or(eq(review.customerId, actor.id), eq(review.studentId, actor.id))),
    messagesSent: await db.select({ id: message.id, requestId: message.requestId, body: message.body, createdAt: message.createdAt }).from(message).where(eq(message.senderId, actor.id)),
    notifications: await db.select().from(notification).where(eq(notification.userId, actor.id))
  };
}

/**
 * Delete an account. Personal data is erased; records we must keep for bookkeeping (payments, commissions)
 * stay, linked to an anonymised user. Not possible while money is held or a dispute is open.
 */
export async function deleteAccount(actor: Actor) {
  const db = await getDb();
  const active = await db.select({ id: commission.id }).from(commission)
    .where(and(or(eq(commission.customerId, actor.id), eq(commission.studentId, actor.id)), inArray(commission.status, ['pending_payment', 'making', 'sent', 'altering', 'disputed'])));
  if (active.length) fail('activeCommissionsBlockDeletion', 409);
  const [me] = await db.select().from(user).where(eq(user.id, actor.id));
  await deleteUserPhotos(db, actor.id);
  await db.transaction(async (tx) => {
    await tx.update(request).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(request.customerId, actor.id), eq(request.status, 'open')));
    await tx.update(quote).set({ status: 'withdrawn' }).where(and(eq(quote.studentId, actor.id), eq(quote.status, 'pending')));
    await tx.update(message).set({ body: '' }).where(eq(message.senderId, actor.id));
    await tx.delete(portfolioPiece).where(eq(portfolioPiece.studentId, actor.id));
    await tx.update(studentProfile).set({ bio: '', skills: [], rates: [], accepting: false, programme: '', school: '', city: '', slug: `deleted-${actor.id.slice(0, 8)}` }).where(eq(studentProfile.userId, actor.id));
    await tx.delete(notification).where(eq(notification.userId, actor.id));
    await tx.delete(threadRead).where(eq(threadRead.userId, actor.id));
    await tx.delete(session).where(eq(session.userId, actor.id));
    await tx.delete(account).where(eq(account.userId, actor.id));
    await tx.update(user).set({ name: 'Deleted user', email: `deleted-${actor.id}@invalid.local`, image: null, emailVerified: false, deletedAt: new Date(), updatedAt: new Date() }).where(eq(user.id, actor.id));
    await audit(tx, actor.id, 'account.deleted', 'user', actor.id);
  });
  // Tax details are kept for the DAC7 reporting period, then purged by retention policy (see README).
  await sendEmail({ to: me.email, template: 'accountDeleted', locale: me.locale, values: { name: me.name.split(' ')[0] } });
}
