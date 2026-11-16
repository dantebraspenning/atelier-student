import { env, paymentsSimulated } from '@/lib/env';

/**
 * Money model (Stripe Connect, "separate charges and transfers"):
 * the customer pays the platform, the platform holds the funds, and on release
 * transfers the student's share to their Express account. Refunds go back to the
 * customer's original payment method.
 */
export interface Payments {
  readonly simulated: boolean;
  createCheckout(input: { commissionId: string; amountCents: number; description: string; customerEmail: string; successUrl: string; cancelUrl: string; locale: 'nl' | 'en' }): Promise<{ url: string; sessionId: string }>;
  expireCheckout(sessionId: string): Promise<void>;
  /** Resolve the charge behind a completed checkout. */
  chargeFor(paymentIntentId: string): Promise<string | null>;
  refund(input: { paymentIntentId: string; amountCents: number; commissionId: string; reason: string }): Promise<string>;
  transfer(input: { destination: string; amountCents: number; chargeId: string | null; commissionId: string }): Promise<string>;
  createConnectAccount(input: { userId: string; email: string }): Promise<string>;
  onboardingLink(input: { accountId: string; returnUrl: string; refreshUrl: string }): Promise<string>;
  accountStatus(accountId: string): Promise<{ payoutsEnabled: boolean; detailsSubmitted: boolean }>;
  dashboardLink(accountId: string): Promise<string>;
}

class SimulatedPayments implements Payments {
  readonly simulated = true;
  async createCheckout(i: { commissionId: string; locale: 'nl' | 'en' }) {
    return { url: `${env().APP_URL}/${i.locale}/dev/checkout/${i.commissionId}`, sessionId: `cs_sim_${i.commissionId}` };
  }
  async expireCheckout() {}
  async chargeFor(pi: string) { return `ch_sim_${pi}`; }
  async refund(i: { commissionId: string; amountCents: number }) { return `re_sim_${i.commissionId}_${i.amountCents}`; }
  async transfer(i: { commissionId: string }) { return `tr_sim_${i.commissionId}`; }
  async createConnectAccount(i: { userId: string }) { return `acct_sim_${i.userId.slice(0, 8)}`; }
  async onboardingLink(i: { returnUrl: string }) { return `${i.returnUrl}${i.returnUrl.includes('?') ? '&' : '?'}simulated=1`; }
  async accountStatus() { return { payoutsEnabled: true, detailsSubmitted: true }; }
  async dashboardLink() { return `${env().APP_URL}/nl/studio/payouts?simulated=1`; }
}

class StripePayments implements Payments {
  readonly simulated = false;
  private stripe: Promise<import('stripe').Stripe>;
  constructor(key: string) {
    this.stripe = import('stripe').then(({ default: Stripe }) => new Stripe(key, { appInfo: { name: 'Atelier Student' }, maxNetworkRetries: 2 }));
  }
  async createCheckout(i: Parameters<Payments['createCheckout']>[0]) {
    const s = await (await this.stripe).checkout.sessions.create({
      mode: 'payment',
      locale: i.locale,
      customer_email: i.customerEmail,
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: i.amountCents, product_data: { name: i.description } } }],
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      metadata: { commissionId: i.commissionId },
      payment_intent_data: { transfer_group: i.commissionId, metadata: { commissionId: i.commissionId } }
    }, { idempotencyKey: `checkout-${i.commissionId}` });
    return { url: s.url!, sessionId: s.id };
  }
  async expireCheckout(sessionId: string) {
    try { await (await this.stripe).checkout.sessions.expire(sessionId); } catch { /* already completed or expired */ }
  }
  async chargeFor(paymentIntentId: string) {
    const pi = await (await this.stripe).paymentIntents.retrieve(paymentIntentId);
    return typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;
  }
  async refund(i: Parameters<Payments['refund']>[0]) {
    const r = await (await this.stripe).refunds.create(
      { payment_intent: i.paymentIntentId, amount: i.amountCents, metadata: { commissionId: i.commissionId, reason: i.reason } },
      { idempotencyKey: `refund-${i.commissionId}-${i.amountCents}` });
    return r.id;
  }
  async transfer(i: Parameters<Payments['transfer']>[0]) {
    const t = await (await this.stripe).transfers.create({
      amount: i.amountCents, currency: 'eur', destination: i.destination, transfer_group: i.commissionId,
      ...(i.chargeId ? { source_transaction: i.chargeId } : {}), metadata: { commissionId: i.commissionId }
    }, { idempotencyKey: `release-${i.commissionId}` });
    return t.id;
  }
  async createConnectAccount(i: { userId: string; email: string }) {
    const a = await (await this.stripe).accounts.create({
      type: 'express', country: 'NL', email: i.email, business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: 'Made-to-measure clothing commissioned through Atelier Student' },
      metadata: { userId: i.userId }
    }, { idempotencyKey: `connect-${i.userId}` });
    return a.id;
  }
  async onboardingLink(i: Parameters<Payments['onboardingLink']>[0]) {
    const l = await (await this.stripe).accountLinks.create({ account: i.accountId, return_url: i.returnUrl, refresh_url: i.refreshUrl, type: 'account_onboarding' });
    return l.url;
  }
  async accountStatus(accountId: string) {
    const a = await (await this.stripe).accounts.retrieve(accountId);
    return { payoutsEnabled: !!a.payouts_enabled, detailsSubmitted: !!a.details_submitted };
  }
  async dashboardLink(accountId: string) {
    return (await (await this.stripe).accounts.createLoginLink(accountId)).url;
  }
}

let instance: Payments | undefined;
export function payments(): Payments {
  instance ??= paymentsSimulated() ? new SimulatedPayments() : new StripePayments(env().STRIPE_SECRET_KEY!);
  return instance;
}

export async function stripeClient() {
  const { default: Stripe } = await import('stripe');
  return new Stripe(env().STRIPE_SECRET_KEY!);
}
