import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { commission, request } from '@/lib/db/schema';
import { paymentsSimulated } from '@/lib/env';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { Link } from '@/i18n/navigation';
import { DevPayButton } from '@/components/dev-checkout';

/** Stand-in for Stripe Checkout while no Stripe key is configured. Unavailable once payments are live. */
export default async function DevCheckout({ params }: PageProps<'/[locale]/dev/checkout/[id]'>) {
  const { locale, id } = await params;
  if (!paymentsSimulated()) notFound();
  const actor = await requirePageActor(locale, `/dev/checkout/${id}`, 'customer');
  const db = await getDb();
  const [row] = await db.select({ c: commission, title: request.title }).from(commission).innerJoin(request, eq(request.id, commission.requestId)).where(eq(commission.id, id));
  if (!row || row.c.customerId !== actor.id) notFound();
  return (
    <div className="wrap-narrow flex max-w-[520px] flex-col gap-5 py-16">
      <span className="badge badge-clay w-fit">Test checkout — no real payment</span>
      <h1 className="h2">{row.title}</h1>
      <p className="font-serif text-[48px]">{formatEuro(row.c.totalCents, locale)}</p>
      {row.c.status === 'pending_payment'
        ? <DevPayButton commissionId={id} requestId={row.c.requestId} label={locale === 'nl' ? 'Betalen (test)' : 'Pay (test)'} />
        : <p className="notice notice-sand">Status: {row.c.status}</p>}
      <Link className="text-link" href={`/requests/${row.c.requestId}?checkout=cancelled&commission=${id}`}>{locale === 'nl' ? 'Annuleren' : 'Cancel'}</Link>
    </div>
  );
}
