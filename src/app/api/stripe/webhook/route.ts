import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getDb } from '@/lib/db';
import { commission, paymentEvent } from '@/lib/db/schema';
import { cancelPendingPayment, confirmPayment } from '@/lib/domain/commissions';
import { alertAdmins } from '@/lib/domain/notify';
import { syncPayoutStatus } from '@/lib/domain/students';
import { env } from '@/lib/env';
import { stripeClient } from '@/lib/payments';

/**
 * Stripe → us. Signature-verified and idempotent (each event id is processed once).
 * Subscribe to: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.expired, account.updated, charge.dispute.created.
 */
export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret || !env().STRIPE_SECRET_KEY) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const stripe = await stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  const db = await getDb();
  const [fresh] = await db.insert(paymentEvent).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status === 'paid' && s.metadata?.commissionId && typeof s.payment_intent === 'string') {
          await confirmPayment({ commissionId: s.metadata.commissionId, paymentIntentId: s.payment_intent });
        }
        break;
      }
      case 'checkout.session.expired': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.commissionId) await cancelPendingPayment(s.metadata.commissionId);
        break;
      }
      case 'account.updated': {
        const a = event.data.object as Stripe.Account;
        await syncPayoutStatus({ accountId: a.id });
        break;
      }
      case 'charge.dispute.created': {
        const d = event.data.object as Stripe.Dispute;
        const [c] = typeof d.charge === 'string' ? await db.select().from(commission).where(eq(commission.chargeId, d.charge)) : [];
        await alertAdmins('Card chargeback opened', `Stripe dispute ${d.id} (${d.reason}) on commission ${c?.id ?? 'unknown'} — respond in the Stripe dashboard.`, '/admin/payments');
        break;
      }
    }
  } catch (e) {
    // Let Stripe retry: forget the event so the retry is processed.
    await db.delete(paymentEvent).where(eq(paymentEvent.id, event.id));
    console.error(JSON.stringify({ level: 'error', msg: 'stripe webhook failed', type: event.type, error: String(e) }));
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
