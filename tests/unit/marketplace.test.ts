import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { closeDb, getDb } from '@/lib/db';
import { commission, photo, quote, request, studentProfile, user } from '@/lib/db/schema';
import { AppError } from '@/lib/errors';
import { platformFee } from '@/lib/money';
import { deleteAccount, exportData } from '@/lib/domain/account';
import { dac7Export } from '@/lib/domain/admin';
import {
  cancelPendingPayment, confirmPayment, confirmReceived, markSent, openDispute, proposeCancellation, releaseDuePayments,
  requestAlteration, resolveDispute, respondToCancellation, sendReceiptReminders, startCheckout, studentCancel, studentCommissions, earningsOf
} from '@/lib/domain/commissions';
import { getThread, listThreads, sendMessage, unreadCount } from '@/lib/domain/messages';
import { canViewPhoto, uploadPhoto, getPhotoFile } from '@/lib/domain/photos';
import { addPiece } from '@/lib/domain/portfolio';
import { cancelRequest, createQuote, createRequest, getCustomerRequest, studentFeed } from '@/lib/domain/requests';
import { createReview } from '@/lib/domain/reviews';
import { getMakerBySlug, listMakers, readiness, validBsn } from '@/lib/domain/students';
import { emailsTo, jpegWithExif, makeUser, readyStudent, trousersRequest } from './helpers';

beforeAll(async () => { await getDb(); });
afterAll(closeDb);

const rejects = async (p: Promise<unknown>, key: string) => {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.key === key);
};

/** Request → quote → paid commission, returning everything a test needs. */
async function paidCommission(opts: { alteration?: boolean; handover?: 'in_person' | 'shipping' } = {}) {
  const customer = await makeUser('customer');
  const maker = await readyStudent(['trousers']);
  const rival = await readyStudent(['trousers']);
  const requestId = await createRequest(customer, trousersRequest);
  const quoteId = await createQuote(maker, requestId, { labour: '95', fabric: '30', shipping: '8', handover: opts.handover ?? 'shipping', alteration: opts.alteration ?? true, readyBy: '2099-01-01' });
  const rivalQuote = await createQuote(rival, requestId, { labour: '120', handover: 'in_person' });
  const checkoutUrl = await startCheckout(customer, quoteId);
  const db = await getDb();
  const [pending] = await db.select().from(commission).where(eq(commission.quoteId, quoteId));
  expect(await confirmPayment({ commissionId: pending.id, paymentIntentId: `pi_${pending.id}` })).toBe('accepted');
  return { customer, maker, rival, requestId, quoteId, rivalQuote, commissionId: pending.id, checkoutUrl, total: 9500 + 3000 + 800 };
}

describe('commission lifecycle', () => {
  test('request → quote → pay → ship → alteration → receive → payout → portfolio → review', async () => {
    const { customer, maker, rival, requestId, quoteId, rivalQuote, commissionId, checkoutUrl, total } = await paidCommission();
    const db = await getDb();
    expect(checkoutUrl).toContain(`/dev/checkout/${commissionId}`);

    // payment accepted the quote and closed the request; the rival was declined and told
    const view = await getCustomerRequest(customer, requestId);
    expect(view.request.status).toBe('accepted');
    expect(view.commission?.status).toBe('making');
    expect(view.commission?.paymentStatus).toBe('held');
    expect(view.quotes.find((q) => q.id === quoteId)?.status).toBe('accepted');
    expect(view.quotes.find((q) => q.id === rivalQuote)?.status).toBe('declined');
    expect((await emailsTo(rival.email)).map((e) => e.template)).toContain('quoteDeclined');
    expect((await emailsTo(maker.email)).map((e) => e.template)).toContain('quoteAccepted');

    // webhooks can arrive twice
    expect(await confirmPayment({ commissionId, paymentIntentId: `pi_${commissionId}` })).toBe('duplicate');

    // only the maker can ship, only the customer can confirm
    await rejects(markSent(rival, commissionId), 'notFound');
    await rejects(confirmReceived(customer, commissionId), 'invalidCommissionState');
    await markSent(maker, commissionId, 'https://tracking.example/123');
    expect((await emailsTo(customer.email)).map((e) => e.template)).toContain('pieceSent');

    // the included alteration round, once
    await requestAlteration(customer, commissionId, 'Hem 2 cm shorter please');
    let [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    expect(c.status).toBe('altering');
    expect(c.paymentStatus).toBe('held');
    await markSent(maker, commissionId);
    await rejects(requestAlteration(customer, commissionId, 'Again please'), 'alterationUsed');

    // receipt releases payment minus the platform fee
    await confirmReceived(customer, commissionId);
    [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    expect(c.status).toBe('completed');
    expect(c.paymentStatus).toBe('released');
    expect(c.feeCents).toBe(platformFee(total));
    expect(c.releasedCents).toBe(total - platformFee(total));
    expect(c.transferId).toMatch(/^tr_sim_/);
    await rejects(confirmReceived(customer, commissionId), 'invalidCommissionState');
    expect(earningsOf(await studentCommissions(maker))).toEqual({ releasedCents: total - platformFee(total), heldCents: 0 });

    // the timeline shows every step
    const { messages } = await getThread(maker, requestId, maker.id);
    expect(messages.filter((m) => m.kind === 'event').map((m) => m.event?.key)).toEqual(['paid', 'sent', 'alterationRequested', 'sentAgain', 'received']);

    // portfolio + review
    await addPiece(maker, { title: 'Extra-long linen trousers', garment: 'trousers', commissionId });
    await rejects(addPiece(maker, { title: 'Again', garment: 'trousers', commissionId }), 'alreadyInPortfolio');
    await createReview(customer, commissionId, { rating: 5, body: 'Perfect length!' });
    await rejects(createReview(customer, commissionId, { rating: 4 }), 'alreadyReviewed');
    const [{ slug }] = await db.select({ slug: studentProfile.slug }).from(studentProfile).where(eq(studentProfile.userId, maker.id));
    const page = await getMakerBySlug(slug);
    expect(page?.maker.delivered).toBe(1);
    expect(page?.maker.rating).toBe(5);
    expect(page?.portfolio[0].kind).toBe('commission');
    expect(page?.reviews[0].body).toBe('Perfect length!');
  });

  test('students must be verified, have payouts and tax details, and be accepting to quote', async () => {
    const customer = await makeUser('customer');
    const s = await makeUser('student');
    const db = await getDb();
    await db.update(studentProfile).set({ specialities: ['dress'], city: 'Leiden' }).where(eq(studentProfile.userId, s.id));
    const id = await createRequest(customer, { ...trousersRequest, garment: 'dress', measurements: {}, measureInPerson: true });
    expect((await studentFeed(s)).map((r) => r.id)).toContain(id);
    expect(await readiness(db, s.id)).toMatchObject({ profile: true, verified: false, tax: false, payouts: false, ready: false });
    await rejects(createQuote(s, id, { labour: '80', handover: 'in_person' }), 'notReadyToQuote');
    const ready = await readyStudent(['dress']);
    await db.update(studentProfile).set({ accepting: false }).where(eq(studentProfile.userId, ready.id));
    await rejects(createQuote(ready, id, { labour: '80', handover: 'in_person' }), 'pausedCannotQuote');
  });

  test('quotes must respect the customer’s delivery choice and sensible amounts', async () => {
    const customer = await makeUser('customer');
    const s = await readyStudent(['skirt']);
    const id = await createRequest(customer, { ...trousersRequest, garment: 'skirt', delivery: 'in_person', city: 'Amsterdam' });
    await rejects(createQuote(s, id, { labour: '80', handover: 'shipping' }), 'customerWantsInPerson');
    await rejects(createQuote(s, id, { labour: '2', handover: 'in_person' }), 'invalidAmount');
    await rejects(createQuote(s, id, { labour: 'abc', handover: 'in_person' }), 'invalidAmount');
    await createQuote(s, id, { labour: '80,50', handover: 'in_person' });
    await rejects(createQuote(s, id, { labour: '90', handover: 'in_person' }), 'alreadyQuoted');
    const db = await getDb();
    const [q] = await db.select().from(quote).where(eq(quote.requestId, id));
    expect(q.labourCents).toBe(8050);
  });

  test('paying for a request that was cancelled meanwhile refunds in full', async () => {
    const customer = await makeUser('customer');
    const s = await readyStudent(['jacket']);
    const id = await createRequest(customer, { ...trousersRequest, garment: 'jacket' });
    const qid = await createQuote(s, id, { labour: '200', handover: 'shipping' });
    await startCheckout(customer, qid);
    const db = await getDb();
    const [pending] = await db.select().from(commission).where(eq(commission.quoteId, qid));
    await rejects(cancelRequest(customer, id), 'paymentInProgress');
    await cancelPendingPayment(pending.id, customer);
    await cancelRequest(customer, id);
    expect(await confirmPayment({ commissionId: pending.id, paymentIntentId: 'pi_late' })).toBe('refunded');
    const [c] = await db.select().from(commission).where(eq(commission.id, pending.id));
    expect(c).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundedCents: 20000 });
  });

  test('mutual cancellation splits the money as agreed', async () => {
    const { customer, maker, commissionId, total } = await paidCommission();
    await rejects(respondToCancellation(customer, commissionId, true), 'noCancellationToAnswer');
    await proposeCancellation(customer, commissionId, 10000, 'Plans changed, fabric already bought');
    await rejects(respondToCancellation(customer, commissionId, true), 'noCancellationToAnswer');
    await respondToCancellation(maker, commissionId, true);
    const db = await getDb();
    const [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    const gross = total - 10000;
    expect(c).toMatchObject({ status: 'cancelled', paymentStatus: 'partially_refunded', refundedCents: 10000, releasedCents: gross - platformFee(gross) });
  });

  test('a maker who cannot finish refunds the customer in full', async () => {
    const { customer, maker, commissionId, total } = await paidCommission();
    await studentCancel(maker, commissionId, 'Broke my wrist, so sorry');
    const db = await getDb();
    const [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    expect(c).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundedCents: total, releasedCents: 0 });
    expect((await emailsTo(customer.email)).map((e) => e.template)).toContain('commissionCancelled');
  });

  test('a dispute freezes payment until an admin resolves it', async () => {
    const { customer, maker, commissionId, total } = await paidCommission();
    const admin = await makeUser('admin');
    await rejects(openDispute(customer, commissionId, { reason: 'poor_quality', details: 'The seams are coming apart already.' }), 'tooEarlyToReport');
    await markSent(maker, commissionId);
    await openDispute(customer, commissionId, { reason: 'poor_quality', details: 'The seams are coming apart already.' });
    const db = await getDb();
    // auto-release skips disputed commissions even when they're old
    await db.update(commission).set({ sentAt: new Date(Date.now() - 30 * 86400000) }).where(eq(commission.id, commissionId));
    await releaseDuePayments();
    expect((await db.select().from(commission).where(eq(commission.id, commissionId)))[0].status).toBe('disputed');
    expect((await emailsTo(admin.email)).map((e) => e.template)).toContain('adminAlert');
    const { dispute } = await import('@/lib/db/schema');
    const [d] = await db.select().from(dispute).where(eq(dispute.commissionId, commissionId));
    await rejects(resolveDispute(maker, d.id, { resolution: 'release' }), 'forbidden');
    await resolveDispute(admin, d.id, { resolution: 'split', refundCents: 5000, note: 'Partial refund for the seams.' });
    const [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    expect(c).toMatchObject({ status: 'completed', completedBy: 'admin', refundedCents: 5000, releasedCents: total - 5000 - platformFee(total - 5000) });
  });

  test('payment is released automatically after the waiting period, with a reminder first', async () => {
    const { customer, maker, commissionId } = await paidCommission({ alteration: false });
    await markSent(maker, commissionId);
    const db = await getDb();
    await db.update(commission).set({ sentAt: new Date(Date.now() - 6 * 86400000) }).where(eq(commission.id, commissionId));
    expect(await sendReceiptReminders()).toBeGreaterThanOrEqual(1);
    expect((await emailsTo(customer.email)).map((e) => e.template)).toContain('receiptReminder');
    expect(await releaseDuePayments()).toBe(0);
    await db.update(commission).set({ sentAt: new Date(Date.now() - 8 * 86400000) }).where(eq(commission.id, commissionId));
    expect(await releaseDuePayments()).toBeGreaterThanOrEqual(1);
    const [c] = await db.select().from(commission).where(eq(commission.id, commissionId));
    expect(c).toMatchObject({ status: 'completed', completedBy: 'auto', paymentStatus: 'released' });
    await rejects(requestAlteration(customer, commissionId, 'Too late for this'), 'noAlterationIncluded');
  });
});

describe('messages', () => {
  test('conversation access, unread counts and closing for makers who weren’t chosen', async () => {
    const customer = await makeUser('customer');
    const maker = await readyStudent(['shirt']);
    const other = await readyStudent(['shirt']);
    const outsider = await readyStudent(['dress']);
    const id = await createRequest(customer, { ...trousersRequest, garment: 'shirt' });
    // a student can ask before quoting; outsiders (wrong garment) can't
    await sendMessage(maker, id, maker.id, { body: 'Do you want a button-down collar?' });
    await sendMessage(other, id, other.id, { body: 'Hi! Cotton or linen?' });
    await rejects(sendMessage(outsider, id, outsider.id, { body: 'hello' }), 'notFound');
    await rejects(sendMessage(maker, id, other.id, { body: 'sneaky' }), 'notFound');
    await rejects(getThread(outsider, id, maker.id), 'notFound');
    expect(await unreadCount(customer)).toBe(2);
    const threads = await listThreads(customer);
    expect(threads.map((t) => t.with).sort()).toEqual([maker.name, other.name].sort());
    await getThread(customer, id, maker.id);
    expect(await unreadCount(customer)).toBe(1);
    await rejects(sendMessage(customer, id, maker.id, { body: '   ' }), 'emptyMessage');
    await sendMessage(customer, id, maker.id, { body: 'Yes please!' });
    await sendMessage(customer, id, maker.id, { body: 'And long sleeves.' });
    // the maker is emailed once, not for every message
    expect((await emailsTo(maker.email)).filter((e) => e.template === 'newMessage')).toHaveLength(1);

    // once someone else is paid, the other conversation closes
    const qid = await createQuote(maker, id, { labour: '70', handover: 'shipping' });
    await startCheckout(customer, qid);
    const db = await getDb();
    const [pending] = await db.select().from(commission).where(eq(commission.quoteId, qid));
    await confirmPayment({ commissionId: pending.id, paymentIntentId: 'pi_msg' });
    expect((await getThread(other, id, other.id)).thread.canWrite).toBe(false);
    await rejects(sendMessage(other, id, other.id, { body: 'Still there?' }), 'conversationClosed');
    expect((await getThread(maker, id, maker.id)).thread.canWrite).toBe(true);
  });
});

describe('photos', () => {
  test('uploads are resized, stripped of metadata, and only visible to the right people', async () => {
    const customer = await makeUser('customer');
    const maker = await readyStudent(['rework']);
    const outsider = await readyStudent(['dress']);
    const stranger = await makeUser('customer');
    const ref = await uploadPhoto(customer, await jpegWithExif());
    const db = await getDb();
    const [row] = await db.select().from(photo).where(eq(photo.id, ref.id));
    expect(Math.max(row.width, row.height)).toBe(2000);
    const stored = await getPhotoFile(customer, ref.id, 'full');
    const meta = await sharp(stored.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
    expect(await canViewPhoto(db, maker, row)).toBe(false);

    await rejects(uploadPhoto(customer, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'photoInvalid');
    // someone else's upload can't be attached
    await rejects(createRequest(stranger, { ...trousersRequest, garment: 'rework', photoIds: [ref.id] }), 'photoNotAttachable');

    const id = await createRequest(customer, { ...trousersRequest, garment: 'rework', photoIds: [ref.id] });
    const [attached] = await db.select().from(photo).where(eq(photo.id, ref.id));
    expect(attached.requestId).toBe(id);
    expect(await canViewPhoto(db, maker, attached)).toBe(true);
    expect(await canViewPhoto(db, outsider, attached)).toBe(false);
    expect(await canViewPhoto(db, stranger, attached)).toBe(false);
    expect(await canViewPhoto(db, null, attached)).toBe(false);

    // portfolio photos are public
    const p = await uploadPhoto(maker, await jpegWithExif(800, 1200));
    const pieceId = await addPiece(maker, { title: 'Reworked trench', garment: 'rework', photoIds: [p.id] });
    const [pub] = await db.select().from(photo).where(eq(photo.portfolioId, pieceId));
    expect(await canViewPhoto(db, null, pub)).toBe(true);
    expect((await listMakers({ garment: 'rework' })).find((m) => m.id === maker.id)?.cover?.id).toBe(p.id);
  });
});

describe('accounts, tax and reporting', () => {
  test('BSN check, DAC7 export and account deletion rules', async () => {
    expect(validBsn('111222333')).toBe(true);
    expect(validBsn('123456789')).toBe(false);
    const { customer, maker, commissionId, total } = await paidCommission();
    const admin = await makeUser('admin');
    await rejects(deleteAccount(customer), 'activeCommissionsBlockDeletion');
    await markSent(maker, commissionId);
    await confirmReceived(customer, commissionId);

    const csv = await dac7Export(admin, new Date().getUTCFullYear());
    const line = csv.split('\n').find((l) => l.includes(maker.id))!;
    expect(line).toContain('"111222333"');
    expect(line).toContain(`"${(total / 100).toFixed(2)}"`);

    const data = await exportData(customer);
    expect(data.account.email).toBe(customer.email);
    expect(data.commissions).toHaveLength(1);

    await deleteAccount(customer);
    const db = await getDb();
    const [u] = await db.select().from(user).where(eq(user.id, customer.id));
    expect(u.name).toBe('Deleted user');
    expect(u.email).not.toBe(customer.email);
    expect(u.deletedAt).not.toBeNull();
    // bookkeeping records survive
    expect((await db.select().from(commission).where(eq(commission.id, commissionId)))[0].status).toBe('completed');
    expect((await db.select().from(request).where(eq(request.customerId, customer.id))).length).toBe(1);
  });
});

describe('emails', () => {
  test('handover method is written out in the recipient’s language', async () => {
    const { customer, maker, commissionId } = await paidCommission({ handover: 'shipping' });
    await markSent(maker, commissionId);
    const mail = (await emailsTo(customer.email)).find((e) => e.template === 'pieceSent')!;
    expect(mail.subject).toContain('verzonden');
    expect(mail.subject).not.toContain('shipping');
  });
});
