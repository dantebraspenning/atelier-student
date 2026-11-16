'use server';

import { runAction, fail } from '@/lib/errors';
import { parseEuros } from '@/lib/money';
import { bool, localeOf, str } from '@/lib/request-meta';
import { requireActor } from '@/lib/session';
import { paymentsSimulated } from '@/lib/env';
import { cancelRequest, createQuote, createRequest, passRequest, withdrawQuote } from '@/lib/domain/requests';
import {
  cancelPendingPayment, confirmPayment, confirmReceived, markSent, openDispute, proposeCancellation,
  requestAlteration, respondToCancellation, startCheckout, studentCancel
} from '@/lib/domain/commissions';
import { createReview, replyToReview } from '@/lib/domain/reviews';
import { createReport } from '@/lib/domain/reports';
import { sendMessage } from '@/lib/domain/messages';
import { getDb } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

// ─────────────── customer ───────────────

/** The request wizard posts its draft as JSON. */
export async function createRequestAction(payload: string) {
  return runAction(async () => {
    const actor = await requireActor('customer');
    const id = await createRequest(actor, JSON.parse(payload));
    return { id };
  });
}

export async function cancelRequestAction(_: unknown, fd: FormData) {
  return runAction(async () => cancelRequest(await requireActor('customer'), str(fd, 'id')));
}

export async function acceptQuoteAction(_: unknown, fd: FormData) {
  return runAction(async () => ({ redirect: await startCheckout(await requireActor('customer'), str(fd, 'quoteId'), localeOf(fd)) }));
}

export async function abandonCheckoutAction(commissionId: string) {
  return runAction(async () => cancelPendingPayment(commissionId, await requireActor('customer')));
}

export async function confirmReceivedAction(_: unknown, fd: FormData) {
  return runAction(async () => confirmReceived(await requireActor('customer'), str(fd, 'id')));
}

export async function alterationAction(_: unknown, fd: FormData) {
  return runAction(async () => requestAlteration(await requireActor('customer'), str(fd, 'id'), str(fd, 'note')));
}

export async function disputeAction(_: unknown, fd: FormData) {
  return runAction(async () => openDispute(await requireActor('customer'), str(fd, 'id'), { reason: str(fd, 'reason') as never, details: str(fd, 'details') }));
}

export async function reviewAction(_: unknown, fd: FormData) {
  return runAction(async () => createReview(await requireActor('customer'), str(fd, 'id'), { rating: Number(fd.get('rating')), body: str(fd, 'body') }));
}

// ─────────────── both sides ───────────────

export async function proposeCancelAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const refund = parseEuros(str(fd, 'refund'));
    if (refund === null || Number.isNaN(refund)) fail('invalidAmount');
    await proposeCancellation(await requireActor(['customer', 'student']), str(fd, 'id'), refund!, str(fd, 'reason'));
  });
}

export async function respondCancelAction(_: unknown, fd: FormData) {
  return runAction(async () => respondToCancellation(await requireActor(['customer', 'student']), str(fd, 'id'), str(fd, 'answer') === 'accept'));
}

export async function sendMessageAction(requestId: string, studentId: string, body: string, photoIds: string[]) {
  return runAction(async () => sendMessage(await requireActor(['customer', 'student']), requestId, studentId, { body, photoIds }));
}

export async function reportAction(_: unknown, fd: FormData) {
  return runAction(async () => createReport(await requireActor(), {
    targetType: str(fd, 'targetType') as never, targetId: str(fd, 'targetId'), reason: str(fd, 'reason') as never, details: str(fd, 'details')
  }));
}

export async function markNotificationsReadAction() {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    await db.update(notification).set({ readAt: new Date() }).where(and(eq(notification.userId, actor.id), isNull(notification.readAt)));
  });
}

// ─────────────── student ───────────────

export async function quoteAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    await createQuote(await requireActor('student'), str(fd, 'requestId'), {
      labour: str(fd, 'labour'), fabric: str(fd, 'fabric'), shipping: str(fd, 'shipping'), handover: str(fd, 'handover') as never,
      alteration: bool(fd, 'alteration'), readyBy: str(fd, 'readyBy') || null, message: str(fd, 'message')
    });
  });
}

export async function passAction(_: unknown, fd: FormData) {
  return runAction(async () => passRequest(await requireActor('student'), str(fd, 'requestId')));
}

export async function withdrawQuoteAction(_: unknown, fd: FormData) {
  return runAction(async () => withdrawQuote(await requireActor('student'), str(fd, 'quoteId')));
}

export async function markSentAction(_: unknown, fd: FormData) {
  return runAction(async () => markSent(await requireActor('student'), str(fd, 'id'), str(fd, 'tracking') || undefined));
}

export async function studentCancelAction(_: unknown, fd: FormData) {
  return runAction(async () => studentCancel(await requireActor('student'), str(fd, 'id'), str(fd, 'reason')));
}

export async function replyReviewAction(_: unknown, fd: FormData) {
  return runAction(async () => replyToReview(await requireActor('student'), str(fd, 'id'), str(fd, 'reply')));
}

// ─────────────── development only ───────────────

/** Stand-in for Stripe's webhook while payments run in simulated mode. */
export async function simulatePaymentAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    if (!paymentsSimulated()) fail('forbidden', 403);
    const actor = await requireActor('customer');
    const id = str(fd, 'commissionId');
    await confirmPayment({ commissionId: id, paymentIntentId: `pi_sim_${id}` });
    return { redirect: `/${localeOf(fd)}/requests/${str(fd, 'requestId')}?paid=1`, actor: actor.id };
  });
}

