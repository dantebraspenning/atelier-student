import { getFormatter, getTranslations } from 'next-intl/server';
import { recentPayments } from '@/lib/domain/admin';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';

export default async function AdminPayments({ params }: PageProps<'/[locale]/admin/payments'>) {
  const { locale } = await params;
  const rows = await recentPayments(await requirePageActor(locale, '/admin', 'admin'));
  const ts = await getTranslations('status');
  const f = await getFormatter();
  const eur = (c: number) => formatEuro(c, locale);
  return (
    <div className="overflow-x-auto rounded-[24px] border border-seam bg-cotton">
      <table className="w-full text-left text-[14px]">
        <thead className="text-muted"><tr><th className="p-3 font-medium">Commission</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Total</th><th className="p-3 font-medium">Paid out</th><th className="p-3 font-medium">Fee</th><th className="p-3 font-medium">Refunded</th><th className="p-3 font-medium">Updated</th></tr></thead>
        <tbody>
          {rows.map(({ c, title }) => (
            <tr key={c.id} className="border-t border-seam">
              <td className="p-3">{title}<br /><span className="font-mono text-[11px] text-muted">{c.paymentIntentId ?? c.id}</span></td>
              <td className="p-3">{ts(c.status, { how: c.handover })} · {c.paymentStatus}</td>
              <td className="p-3">{eur(c.totalCents)}</td><td className="p-3">{eur(c.releasedCents)}</td>
              <td className="p-3">{eur(c.paymentStatus === 'held' ? 0 : c.feeCents)}</td><td className="p-3">{eur(c.refundedCents)}</td>
              <td className="p-3 text-muted">{f.dateTime(c.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
