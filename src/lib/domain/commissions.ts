import { and, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DB } from '@/lib/db';
import { commission, dispute, quote, request, studentProfile, user } from '@/lib/db/schema';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { fail, forbidden, notFound } from '@/lib/errors';
import { platformFee } from '@/lib/money';
import { payments } from '@/lib/payments';
import { postEvent } from './events';
import { alertAdmins, deliver, type Notice } from './notify';
import { shortName } from './students';
import type { Actor } from './types';

type Commission = typeof commission.$inferSelect;

const days = () => env().AUTO_RELEASE_DAYS;

/** While a piece is still being made, a problem can be reported 3 days after the agreed ready date. */
export function overdueForReport(readyBy: string | null | undefined) {
  return !!readyBy && readyBy < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const releaseDate = (sentAt: Date) => new Date(sentAt.getTime() + days() * 24 * 60 * 60 * 1000);

async function load(db: DB, id: string, lock = false) {
  const q = db.select().from(commission).where(eq(commission.id, id));
  const [c] = lock ? await q.for('update') : await q;
  if (!c) notFound();
  return c!;
}

async function titleOf(db: DB, requestId: string) {
  const [r] = await db.select({ title: request.title }).from(request).where(eq(request.id, requestId));
  return r?.title ?? '';
}

async function nameOf(db: DB, id: string) {
  const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return u?.name ?? '';
}

// ─────────────── checkout & payment ───────────────

/** Customer accepts a quote → a pending commission and a payment page. Nothing is final until payment succeeds. */
export async function startCheckout(actor: Actor, quoteId: string, locale: 'nl' | 'en' = actor.locale) {
  if (actor.role !== 'customer') forbidden();
  const db = await getDb();
  const [row] = await db.select({ q: quote, r: request, payouts: studentProfile.payoutsEnabled, makerName: user.name })
    .from(quote).innerJoin(request, eq(request.id, quote.requestId)).innerJoin(studentProfile, eq(studentProfile.userId, quote.studentId))
    .innerJoin(user, eq(user.id, quote.studentId)).where(eq(quote.id, quoteId));
  if (!row || row.r.customerId !== actor.id) notFound();
  if (row!.r.status !== 'open') fail('requestNotOpen', 409);
  if (row!.q.status !== 'pending') fail('quoteNotAvailable', 409);
  if (!row!.payouts) fail('makerCannotReceivePayments', 409);
  const total = row!.q.labourCents + row!.q.fabricCents + row!.q.shippingCents;

  // Replace any earlier, unfinished payment attempt for this request.
  const stale = await db.update(commission).set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: 'checkout_replaced', updatedAt: new Date() })
    .where(and(eq(commission.requestId, row!.r.id), eq(commission.status, 'pending_payment'))).returning();
  for (const s of stale) if (s.checkoutSessionId) await payments().expireCheckout(s.checkoutSessionId);

  const [c] = await db.insert(commission).values({
    requestId: row!.r.id, quoteId, studentId: row!.q.studentId, customerId: actor.id, totalCents: total, feeCents: platformFee(total),
    handover: row!.q.handover, alterationIncluded: row!.q.alteration
  }).returning();
  try {
    const base = `${env().APP_URL}/${locale}/requests/${row!.r.id}`;
    const session = await payments().createCheckout({
      commissionId: c.id, amountCents: total, customerEmail: actor.email, locale,
      description: `${row!.r.title} — ${row!.makerName}`, successUrl: `${base}?paid=1`, cancelUrl: `${base}?checkout=cancelled&commission=${c.id}`
    });
    await db.update(commission).set({ checkoutSessionId: session.sessionId }).where(eq(commission.id, c.id));
    return session.url;
  } catch (e) {
    await db.update(commission).set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: 'checkout_failed' }).where(eq(commission.id, c.id));
    throw e;
  }
}

/**
 * Payment succeeded (Stripe webhook, or the simulated checkout). Idempotent.
 * Accepts the quote, declines the others and starts the commission — or refunds if the request moved on meanwhile.
 */
export async function confirmPayment(input: { commissionId: string; paymentIntentId: string }) {
  const db = await getDb();
  const chargeId = await payments().chargeFor(input.paymentIntentId);
  const result = await db.transaction(async (tx) => {
    const c = await load(tx, input.commissionId, true);
    if (c.paymentIntentId === input.paymentIntentId && c.status !== 'pending_payment') return { kind: 'duplicate' as const };
    const [r] = await tx.select().from(request).where(eq(request.id, c.requestId)).for('update');
    const [q] = await tx.select().from(quote).where(eq(quote.id, c.quoteId));
    const usable = c.status === 'pending_payment' && r.status === 'open' && q.status === 'pending';
    if (!usable) {
      // Paid for something that is no longer available (cancelled request, expired attempt…): refund in full.
      const refundId = await payments().refund({ paymentIntentId: input.paymentIntentId, amountCents: c.totalCents, commissionId: c.id, reason: 'not_available' });
      await tx.update(commission).set({ status: 'cancelled', paymentStatus: 'refunded', paymentIntentId: input.paymentIntentId, chargeId, refundedCents: c.totalCents, cancelledAt: new Date(), cancelReason: 'paid_after_unavailable', updatedAt: new Date() })
        .where(eq(commission.id, c.id));
      await audit(tx, null, 'payment.refunded_unavailable', 'commission', c.id, { refundId });
      return { kind: 'refunded' as const, c };
    }
    await tx.update(commission).set({ status: 'making', paymentStatus: 'held', paymentIntentId: input.paymentIntentId, chargeId, paidAt: new Date(), updatedAt: new Date() })
      .where(eq(commission.id, c.id));
    await tx.update(quote).set({ status: 'accepted' }).where(eq(quote.id, q.id));
    const declined = await tx.update(quote).set({ status: 'declined' })
      .where(and(eq(quote.requestId, r.id), ne(quote.id, q.id), eq(quote.status, 'pending'))).returning({ studentId: quote.studentId });
    await tx.update(request).set({ status: 'accepted', updatedAt: new Date() }).where(eq(request.id, r.id));
    await postEvent(tx, r.id, c.studentId, c.customerId, 'paid', { total: c.totalCents });
    await audit(tx, c.customerId, 'payment.held', 'commission', c.id, { amount: c.totalCents });
    return { kind: 'accepted' as const, c, r, declined };
  });
  if (result.kind === 'accepted') {
    const { c, r, declined } = result;
    const customer = await nameOf(db, c.customerId);
    const maker = await nameOf(db, c.studentId);
    await deliver([
      { userId: c.customerId, type: 'paymentConfirmed', values: { maker, total: c.totalCents, title: r.title }, path: `/requests/${r.id}`, email: 'paymentConfirmed' },
      { userId: c.studentId, type: 'quoteAccepted', values: { customer: shortName(customer), total: c.totalCents, title: r.title }, path: '/studio/commissions', email: 'quoteAccepted' },
      ...declined.map((d) => ({ userId: d.studentId, type: 'quoteDeclined', values: { title: r.title }, path: '/studio', email: 'quoteDeclined' as const }))
    ]);
  }
  return result.kind;
}

/** Checkout abandoned or expired. */
export async function cancelPendingPayment(commissionId: string, actor?: Actor) {
  const db = await getDb();
  const [c] = await db.update(commission).set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: 'checkout_abandoned', updatedAt: new Date() })
    .where(and(eq(commission.id, commissionId), eq(commission.status, 'pending_payment'), ...(actor ? [eq(commission.customerId, actor.id)] : []))).returning();
  if (c?.checkoutSessionId && actor) await payments().expireCheckout(c.checkoutSessionId);
}

/** Cron: payment attempts that never finished. */
export async function expireStalePayments() {
  const db = await getDb();
  const stale = await db.select().from(commission)
    .where(and(eq(commission.status, 'pending_payment'), lte(commission.createdAt, new Date(Date.now() - 2 * 60 * 60 * 1000))));
  for (const c of stale) {
    if (c.checkoutSessionId) await payments().expireCheckout(c.checkoutSessionId);
    await cancelPendingPayment(c.id);
  }
  return stale.length;
}

// ─────────────── settling money ───────────────

/**
 * Pay out and/or refund a held payment and close the commission. Runs inside the caller's transaction,
 * which has already claimed the row; provider calls use idempotency keys so retries never double-pay.
 */
async function settle(tx: DB, c: Commission, opts: { refundCents: number; status: 'completed' | 'cancelled'; by: 'customer' | 'auto' | 'admin' | 'mutual' | 'student'; reason: string }) {
  if (c.paymentStatus !== 'held') fail('paymentNotHeld', 409);
  const refund = Math.max(0, Math.min(opts.refundCents, c.totalCents));
  const gross = c.totalCents - refund;
  const fee = gross > 0 ? platformFee(gross) : 0;
  const payout = gross - fee;
  let transferId: string | null = null;
  if (refund > 0) {
    const refundId = await payments().refund({ paymentIntentId: c.paymentIntentId!, amountCents: refund, commissionId: c.id, reason: opts.reason });
    await audit(tx, null, 'payment.refund', 'commission', c.id, { refund, refundId, reason: opts.reason });
  }
  if (payout > 0) {
    const [p] = await tx.select({ account: studentProfile.stripeAccountId }).from(studentProfile).where(eq(studentProfile.userId, c.studentId));
    if (!p?.account) fail('makerCannotReceivePayments', 409);
    transferId = await payments().transfer({ destination: p.account!, amountCents: payout, chargeId: c.chargeId, commissionId: c.id });
    await audit(tx, null, 'payment.transfer', 'commission', c.id, { payout, fee, transferId });
  }
  const paymentStatus = refund === 0 ? 'released' : refund === c.totalCents ? 'refunded' : 'partially_refunded';
  await tx.update(commission).set({
    status: opts.status, paymentStatus, refundedCents: refund, releasedCents: payout, feeCents: fee, transferId,
    ...(opts.status === 'completed'
      ? { completedAt: new Date(), completedBy: opts.by === 'auto' ? 'auto' : opts.by === 'admin' ? 'admin' : 'customer' }
      : { cancelledAt: new Date(), cancelReason: opts.reason }),
    cancelProposedBy: null, cancelRefundCents: null, cancelProposedAt: null, updatedAt: new Date()
  }).where(eq(commission.id, c.id));
  return { refund, payout, fee };
}

// ─────────────── lifecycle ───────────────

export async function markSent(actor: Actor, id: string, trackingUrl?: string) {
  const db = await getDb();
  const tracking = trackingUrl?.trim() ? z.url().max(500).parse(trackingUrl.trim()) : null;
  const c = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.studentId !== actor.id) notFound();
    if (c.status !== 'making' && c.status !== 'altering') fail('invalidCommissionState', 409);
    const sentAt = new Date();
    await tx.update(commission).set({ status: 'sent', sentAt, trackingUrl: tracking, reminderSentAt: null, updatedAt: sentAt }).where(eq(commission.id, id));
    await postEvent(tx, c.requestId, c.studentId, actor.id, c.status === 'altering' ? 'sentAgain' : 'sent', { how: c.handover });
    return { ...c, sentAt };
  });
  await deliver([{ userId: c.customerId, type: 'pieceSent', values: { maker: actor.name, title: await titleOf(db, c.requestId), how: c.handover, date: releaseDate(c.sentAt).toISOString() }, path: `/requests/${c.requestId}`, email: 'pieceSent' }]);
}

export async function confirmReceived(actor: Actor, id: string) {
  const db = await getDb();
  const { c, money } = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.customerId !== actor.id) notFound();
    if (c.status !== 'sent') fail('invalidCommissionState', 409);
    const money = await settle(tx, c, { refundCents: 0, status: 'completed', by: 'customer', reason: 'received' });
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'received', { amount: money.payout + money.fee });
    return { c, money };
  });
  await notifyReleased(db, c, money);
}

async function notifyReleased(db: DB, c: Commission, money: { payout: number; fee: number }) {
  await deliver([{ userId: c.studentId, type: 'paymentReleased', values: { amount: money.payout, fee: money.fee, title: await titleOf(db, c.requestId) }, path: '/studio/commissions', email: 'paymentReleased' }]);
}

export async function requestAlteration(actor: Actor, id: string, note: string) {
  const text = z.string().trim().min(5).max(1000).parse(note);
  const db = await getDb();
  const c = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.customerId !== actor.id) notFound();
    if (!c.alterationIncluded) fail('noAlterationIncluded', 409);
    if (c.alterationUsed) fail('alterationUsed', 409);
    if (c.status !== 'sent') fail('invalidCommissionState', 409);
    await tx.update(commission).set({ status: 'altering', alterationUsed: true, alterationNote: text, sentAt: null, updatedAt: new Date() }).where(eq(commission.id, id));
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'alterationRequested', { note: text });
    return c;
  });
  await deliver([{ userId: c.studentId, type: 'alterationRequested', values: { customer: shortName(actor.name), note: text, title: await titleOf(db, c.requestId) }, path: '/studio/commissions', email: 'alterationRequested' }]);
}

// ─────────────── cancellation ───────────────

/** While the piece is being made, either side can propose to cancel with a refund amount the other must accept. */
export async function proposeCancellation(actor: Actor, id: string, refundCents: number, reason: string) {
  const text = z.string().trim().min(5).max(500).parse(reason);
  const db = await getDb();
  const c = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.customerId !== actor.id && c.studentId !== actor.id) notFound();
    if (c.status !== 'making') fail('invalidCommissionState', 409);
    if (!Number.isInteger(refundCents) || refundCents < 0 || refundCents > c.totalCents) fail('invalidAmount');
    await tx.update(commission).set({ cancelProposedBy: actor.id, cancelRefundCents: refundCents, cancelProposedAt: new Date(), cancelReason: text, updatedAt: new Date() }).where(eq(commission.id, id));
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'cancelProposed', { refund: refundCents, reason: text });
    return c;
  });
  const other = actor.id === c.customerId ? c.studentId : c.customerId;
  await deliver([{ userId: other, type: 'cancellationProposed', values: { from: actor.name, refund: refundCents, reason: text, title: await titleOf(db, c.requestId) }, path: other === c.customerId ? `/requests/${c.requestId}` : '/studio/commissions', email: 'cancellationProposed' }]);
}

export async function respondToCancellation(actor: Actor, id: string, accept: boolean) {
  const db = await getDb();
  const out = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.customerId !== actor.id && c.studentId !== actor.id) notFound();
    if (c.status !== 'making' || !c.cancelProposedBy || c.cancelProposedBy === actor.id) fail('noCancellationToAnswer', 409);
    if (!accept) {
      await tx.update(commission).set({ cancelProposedBy: null, cancelRefundCents: null, cancelProposedAt: null, updatedAt: new Date() }).where(eq(commission.id, id));
      await postEvent(tx, c.requestId, c.studentId, actor.id, 'cancelDeclined', {});
      return { c, money: null };
    }
    const money = await settle(tx, c, { refundCents: c.cancelRefundCents ?? c.totalCents, status: 'cancelled', by: 'mutual', reason: `mutual: ${c.cancelReason}` });
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'cancelled', { refund: money.refund, payout: money.payout });
    return { c, money };
  });
  if (out.money) await notifyCancelled(db, out.c, out.money);
}

/** The maker can't finish: full refund, no proposal needed. */
export async function studentCancel(actor: Actor, id: string, reason: string) {
  const text = z.string().trim().min(5).max(500).parse(reason);
  const db = await getDb();
  const out = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.studentId !== actor.id) notFound();
    if (c.status !== 'making') fail('invalidCommissionState', 409);
    const money = await settle(tx, c, { refundCents: c.totalCents, status: 'cancelled', by: 'student', reason: `student: ${text}` });
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'studentCancelled', { reason: text });
    return { c, money };
  });
  await notifyCancelled(db, out.c, out.money);
}

async function notifyCancelled(db: DB, c: Commission, money: { refund: number; payout: number }) {
  const title = await titleOf(db, c.requestId);
  await deliver([
    { userId: c.customerId, type: 'commissionCancelled', values: { title, refund: money.refund, payout: money.payout }, path: `/requests/${c.requestId}`, email: 'commissionCancelled' },
    { userId: c.studentId, type: 'commissionCancelled', values: { title, refund: money.refund, payout: money.payout }, path: '/studio/commissions', email: 'commissionCancelled' }
  ]);
}

// ─────────────── disputes ───────────────

export const disputeInput = z.object({
  reason: z.enum(['not_received', 'not_as_agreed', 'poor_quality', 'damaged', 'other']),
  details: z.string().trim().min(20).max(3000)
});

/** Customer reports a problem: payment is frozen (no auto-release) until an admin resolves it. */
export async function openDispute(actor: Actor, id: string, input: z.input<typeof disputeInput>) {
  const v = disputeInput.parse(input);
  const db = await getDb();
  const c = await db.transaction(async (tx) => {
    const c = await load(tx, id, true);
    if (c.customerId !== actor.id) notFound();
    if (c.status === 'making') {
      const [q] = await tx.select({ readyBy: quote.readyBy }).from(quote).where(eq(quote.id, c.quoteId));
      if (!overdueForReport(q.readyBy)) fail('tooEarlyToReport', 409);
    } else if (c.status !== 'sent' && c.status !== 'altering') fail('invalidCommissionState', 409);
    await tx.insert(dispute).values({ commissionId: c.id, openedBy: actor.id, reason: v.reason, details: v.details });
    await tx.update(commission).set({ status: 'disputed', updatedAt: new Date() }).where(eq(commission.id, id));
    await postEvent(tx, c.requestId, c.studentId, actor.id, 'disputeOpened', {});
    return c;
  });
  const title = await titleOf(db, c.requestId);
  await deliver([
    { userId: c.customerId, type: 'disputeOpened', values: { title }, path: `/requests/${c.requestId}`, email: 'disputeOpened' },
    { userId: c.studentId, type: 'disputeOpened', values: { title }, path: '/studio/commissions', email: 'disputeOpened' }
  ]);
  await alertAdmins(`Dispute: ${title}`, `${actor.name} reported a problem (${v.reason}).`, '/admin/disputes');
}

export const resolveInput = z.object({
  resolution: z.enum(['release', 'refund', 'split']),
  refundCents: z.number().int().min(0).optional(),
  note: z.string().trim().max(2000).default('')
});

export async function resolveDispute(admin: Actor, disputeId: string, input: z.input<typeof resolveInput>) {
  if (admin.role !== 'admin') forbidden();
  const v = resolveInput.parse(input);
  const db = await getDb();
  const out = await db.transaction(async (tx) => {
    const [d] = await tx.select().from(dispute).where(eq(dispute.id, disputeId)).for('update');
    if (!d || d.status !== 'open') notFound();
    const c = await load(tx, d!.commissionId, true);
    if (c.status !== 'disputed') fail('invalidCommissionState', 409);
    const refundCents = v.resolution === 'release' ? 0 : v.resolution === 'refund' ? c.totalCents : v.refundCents ?? -1;
    if (refundCents < 0 || refundCents > c.totalCents) fail('invalidAmount');
    const money = await settle(tx, c, { refundCents, status: v.resolution === 'refund' ? 'cancelled' : 'completed', by: 'admin', reason: `dispute: ${v.resolution}` });
    await tx.update(dispute).set({ status: 'resolved', resolution: v.resolution, refundCents: money.refund, resolvedBy: admin.id, resolvedAt: new Date(), note: v.note }).where(eq(dispute.id, disputeId));
    await postEvent(tx, c.requestId, c.studentId, admin.id, 'disputeResolved', { refund: money.refund, payout: money.payout });
    await audit(tx, admin.id, 'dispute.resolved', 'commission', c.id, { ...v, ...money });
    return { c, money };
  });
  const title = await titleOf(db, out.c.requestId);
  const values = { title, refund: out.money.refund, payout: out.money.payout, note: v.note };
  await deliver([
    { userId: out.c.customerId, type: 'disputeResolved', values, path: `/requests/${out.c.requestId}`, email: 'disputeResolved' },
    { userId: out.c.studentId, type: 'disputeResolved', values, path: '/studio/commissions', email: 'disputeResolved' }
  ]);
}

// ─────────────── scheduled jobs ───────────────

/** Cron: release payments the customer didn't confirm or dispute in time. */
export async function releaseDuePayments() {
  const db = await getDb();
  const due = await db.select({ id: commission.id }).from(commission)
    .where(and(eq(commission.status, 'sent'), lte(commission.sentAt, new Date(Date.now() - days() * 24 * 60 * 60 * 1000))));
  let released = 0;
  for (const { id } of due) {
    try {
      const out = await db.transaction(async (tx) => {
        const c = await load(tx, id, true);
        if (c.status !== 'sent') return null; // changed since we looked
        const money = await settle(tx, c, { refundCents: 0, status: 'completed', by: 'auto', reason: 'auto_release' });
        await postEvent(tx, c.requestId, c.studentId, null, 'autoReleased', { days: days(), amount: money.payout + money.fee });
        return { c, money };
      });
      if (out) { released++; await notifyReleased(db, out.c, out.money); }
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', msg: 'auto-release failed', commissionId: id, error: String(e) }));
    }
  }
  return released;
}

/** Cron: two days before auto-release, remind the customer to confirm or report a problem. */
export async function sendReceiptReminders() {
  const db = await getDb();
  const threshold = new Date(Date.now() - Math.max(1, days() - 2) * 24 * 60 * 60 * 1000);
  const rows = await db.update(commission).set({ reminderSentAt: new Date() })
    .where(and(eq(commission.status, 'sent'), lte(commission.sentAt, threshold), isNull(commission.reminderSentAt))).returning();
  const notices: Notice[] = [];
  for (const c of rows) notices.push({ userId: c.customerId, type: 'receiptReminder', values: { title: await titleOf(db, c.requestId), date: releaseDate(c.sentAt!).toISOString() }, path: `/requests/${c.requestId}`, email: 'receiptReminder' });
  await deliver(notices);
  return rows.length;
}

// ─────────────── reads ───────────────

export async function studentCommissions(actor: Actor) {
  if (actor.role !== 'student') forbidden();
  const db = await getDb();
  const rows = await db.select({ c: commission, title: request.title, garment: request.garment, customer: user.name, readyBy: quote.readyBy })
    .from(commission).innerJoin(request, eq(request.id, commission.requestId)).innerJoin(user, eq(user.id, commission.customerId)).innerJoin(quote, eq(quote.id, commission.quoteId))
    .where(and(eq(commission.studentId, actor.id), inArray(commission.status, ['making', 'sent', 'altering', 'disputed', 'completed', 'cancelled']), sql`${commission.paidAt} is not null`))
    .orderBy(sql`${commission.status} in ('completed','cancelled')`, desc(commission.updatedAt));
  return rows.map(({ c, ...rest }) => ({ ...c, ...rest, customer: shortName(rest.customer), releaseAt: c.sentAt ? releaseDate(c.sentAt) : null }));
}

export function earningsOf(list: Pick<Commission, 'status' | 'paymentStatus' | 'totalCents' | 'releasedCents'>[]) {
  const out = { releasedCents: 0, heldCents: 0 };
  for (const c of list) {
    if (c.paymentStatus === 'held') out.heldCents += c.totalCents;
    out.releasedCents += c.releasedCents;
  }
  return out;
}

export { releaseDate };
