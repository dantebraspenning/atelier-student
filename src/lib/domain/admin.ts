import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  commission, dispute, message, photo, portfolioPiece, report, request, review, session, studentProfile, studentVerification, taxDetails, user
} from '@/lib/db/schema';
import { audit } from '@/lib/audit';
import { decrypt } from '@/lib/crypto';
import { forbidden, notFound } from '@/lib/errors';
import { photoRef } from './photos';
import type { Actor } from './types';

const assertAdmin = (a: Actor) => { if (a.role !== 'admin') forbidden(); };

export async function overview(admin: Actor) {
  assertAdmin(admin);
  const db = await getDb();
  const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  return {
    users: await one(db.select({ n: count() }).from(user).where(isNull(user.deletedAt))),
    students: await one(db.select({ n: count() }).from(user).where(and(eq(user.role, 'student'), isNull(user.deletedAt)))),
    openRequests: await one(db.select({ n: count() }).from(request).where(eq(request.status, 'open'))),
    activeCommissions: await one(db.select({ n: count() }).from(commission).where(inArray(commission.status, ['making', 'sent', 'altering', 'disputed']))),
    heldCents: Number((await db.select({ n: sql<number>`coalesce(sum(${commission.totalCents}),0)` }).from(commission).where(eq(commission.paymentStatus, 'held')))[0].n),
    feesCents: Number((await db.select({ n: sql<number>`coalesce(sum(${commission.feeCents}),0)` }).from(commission).where(inArray(commission.paymentStatus, ['released', 'partially_refunded'])))[0].n),
    openDisputes: await one(db.select({ n: count() }).from(dispute).where(eq(dispute.status, 'open'))),
    openReports: await one(db.select({ n: count() }).from(report).where(eq(report.status, 'open'))),
    pendingVerifications: await one(db.select({ n: count() }).from(studentVerification).where(and(eq(studentVerification.status, 'pending'), eq(studentVerification.method, 'document'))))
  };
}

export async function pendingVerifications(admin: Actor) {
  assertAdmin(admin);
  const db = await getDb();
  const rows = await db.select({ v: studentVerification, name: user.name, email: user.email, school: studentProfile.school, programme: studentProfile.programme })
    .from(studentVerification).innerJoin(user, eq(user.id, studentVerification.userId)).innerJoin(studentProfile, eq(studentProfile.userId, studentVerification.userId))
    .where(and(eq(studentVerification.status, 'pending'), eq(studentVerification.method, 'document'))).orderBy(studentVerification.createdAt);
  const photos = rows.length ? await db.select().from(photo).where(inArray(photo.verificationId, rows.map((r) => r.v.id))) : [];
  return rows.map((r) => ({ ...r, photos: photos.filter((p) => p.verificationId === r.v.id).map(photoRef) }));
}

export async function openDisputes(admin: Actor) {
  assertAdmin(admin);
  const db = await getDb();
  return db.select({ d: dispute, c: commission, title: request.title, requestId: request.id })
    .from(dispute).innerJoin(commission, eq(commission.id, dispute.commissionId)).innerJoin(request, eq(request.id, commission.requestId))
    .where(eq(dispute.status, 'open')).orderBy(dispute.createdAt);
}

export async function openReports(admin: Actor) {
  assertAdmin(admin);
  const db = await getDb();
  return db.select({ r: report, reporter: user.name }).from(report).leftJoin(user, eq(user.id, report.reporterId))
    .where(eq(report.status, 'open')).orderBy(report.createdAt).limit(200);
}

/** Close a report; "actioned" can hide the reported content or suspend the reported user. */
export async function handleReport(admin: Actor, reportId: string, outcome: 'dismissed' | 'hide' | 'suspend', note = '') {
  assertAdmin(admin);
  const db = await getDb();
  const [r] = await db.select().from(report).where(eq(report.id, reportId));
  if (!r) notFound();
  await db.transaction(async (tx) => {
    if (outcome === 'hide') {
      const now = new Date();
      const t = r!.targetId;
      if (r!.targetType === 'message') await tx.update(message).set({ hiddenAt: now }).where(eq(message.id, Number(t)));
      if (r!.targetType === 'photo') await tx.update(photo).set({ hiddenAt: now }).where(eq(photo.id, t));
      if (r!.targetType === 'portfolio') await tx.update(portfolioPiece).set({ hiddenAt: now }).where(eq(portfolioPiece.id, t));
      if (r!.targetType === 'review') await tx.update(review).set({ hiddenAt: now }).where(eq(review.id, t));
      if (r!.targetType === 'request') await tx.update(request).set({ status: 'cancelled' }).where(eq(request.id, t));
    }
    if (outcome === 'suspend' && r!.targetType === 'user') await suspend(tx, r!.targetId, true);
    await tx.update(report).set({ status: outcome === 'dismissed' ? 'dismissed' : 'actioned', handledBy: admin.id, handledAt: new Date(), note }).where(eq(report.id, reportId));
    await audit(tx, admin.id, `report.${outcome}`, r!.targetType, r!.targetId, { reportId, note });
  });
}

async function suspend(tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0], userId: string, on: boolean) {
  await tx.update(user).set({ suspendedAt: on ? new Date() : null }).where(eq(user.id, userId));
  if (on) {
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.update(studentProfile).set({ accepting: false }).where(eq(studentProfile.userId, userId));
  }
}

export async function setSuspended(admin: Actor, userId: string, on: boolean) {
  assertAdmin(admin);
  if (userId === admin.id) forbidden();
  const db = await getDb();
  await db.transaction(async (tx) => { await suspend(tx, userId, on); await audit(tx, admin.id, on ? 'user.suspended' : 'user.unsuspended', 'user', userId); });
}

export async function searchUsers(admin: Actor, q: string) {
  assertAdmin(admin);
  const db = await getDb();
  const like = `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`;
  return db.select({ id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, suspendedAt: user.suspendedAt, deletedAt: user.deletedAt, createdAt: user.createdAt })
    .from(user).where(q.trim() ? or(ilike(user.name, like), ilike(user.email, like)) : undefined).orderBy(desc(user.createdAt)).limit(100);
}

/**
 * DAC7 report data for a calendar year: per student, identification details and the
 * consideration paid out per quarter plus the number of completed activities.
 */
export async function dac7Export(admin: Actor, year: number) {
  assertAdmin(admin);
  const db = await getDb();
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await db.select({ studentId: commission.studentId, completedAt: commission.completedAt, cancelledAt: commission.cancelledAt, released: commission.releasedCents, fee: commission.feeCents })
    .from(commission).where(and(sql`${commission.releasedCents} > 0`, sql`coalesce(${commission.completedAt}, ${commission.cancelledAt}) >= ${from}`, sql`coalesce(${commission.completedAt}, ${commission.cancelledAt}) < ${to}`));
  const byStudent = new Map<string, { q: number[]; fees: number[]; count: number }>();
  for (const r of rows) {
    const at = r.completedAt ?? r.cancelledAt!;
    const q = Math.floor(at.getUTCMonth() / 3);
    const s = byStudent.get(r.studentId) ?? { q: [0, 0, 0, 0], fees: [0, 0, 0, 0], count: 0 };
    s.q[q] += r.released + r.fee; s.fees[q] += r.fee; s.count++;
    byStudent.set(r.studentId, s);
  }
  const ids = [...byStudent.keys()];
  const details = ids.length ? await db.select({ t: taxDetails, email: user.email, account: studentProfile.stripeAccountId })
    .from(taxDetails).innerJoin(user, eq(user.id, taxDetails.userId)).innerJoin(studentProfile, eq(studentProfile.userId, taxDetails.userId))
    .where(inArray(taxDetails.userId, ids)) : [];
  const header = ['student_id', 'legal_name', 'date_of_birth', 'address', 'postal_code', 'city', 'country', 'tin', 'email', 'payout_account', 'activities',
    'consideration_q1_eur', 'consideration_q2_eur', 'consideration_q3_eur', 'consideration_q4_eur', 'fees_q1_eur', 'fees_q2_eur', 'fees_q3_eur', 'fees_q4_eur'];
  const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const id of ids) {
    const s = byStudent.get(id)!;
    const d = details.find((x) => x.t.userId === id);
    lines.push([id, d?.t.legalName ?? 'MISSING', d?.t.dateOfBirth, d?.t.addressLine, d?.t.postalCode, d?.t.city, d?.t.country, d ? decrypt(d.t.tinEncrypted) : 'MISSING', d?.email, d?.account,
      s.count, ...s.q.map((c) => (c / 100).toFixed(2)), ...s.fees.map((c) => (c / 100).toFixed(2))].map(csv).join(','));
  }
  await audit(db, admin.id, 'dac7.export', 'report', String(year), { students: ids.length });
  return lines.join('\n');
}

export async function recentPayments(admin: Actor) {
  assertAdmin(admin);
  const db = await getDb();
  return db.select({ c: commission, title: request.title }).from(commission).innerJoin(request, eq(request.id, commission.requestId))
    .where(sql`${commission.paidAt} is not null`).orderBy(desc(commission.updatedAt)).limit(100);
}
