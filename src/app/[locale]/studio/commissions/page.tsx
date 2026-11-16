import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { studentCommissions } from '@/lib/domain/commissions';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { Chat } from '@/components/icons';
import { CommissionProgress } from '@/components/progress';
import { MarkSentForm, ProposeCancelForm, RespondCancelButtons, StudentCancelForm } from '@/components/commission-forms';

export default async function StudioCommissions({ params }: PageProps<'/[locale]/studio/commissions'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/studio/commissions', 'student');
  const list = await studentCommissions(actor);
  const t = await getTranslations('studio');
  const ts = await getTranslations('status');
  const tc = await getTranslations('commission');
  const tr = await getTranslations('requests');
  const f = await getFormatter();
  const eur = (c: number) => formatEuro(c, locale);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="h3">{t('commissionsTitle')}</h2>
      {list.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((c) => (
            <article key={c.id} className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1"><h3 className="h4">{c.title}</h3>
                  <span className="text-[13px] text-muted">{t('forCustomer', { name: c.customer, total: eur(c.totalCents) })}{c.readyBy ? ` · ${t('readyBy')} ${f.dateTime(new Date(`${c.readyBy}T12:00:00`), { day: 'numeric', month: 'short' })}` : ''}</span></div>
                <span className={`badge ${c.status === 'completed' ? 'badge-sage' : c.status === 'making' ? 'badge-sand' : 'badge-clay'}`}>{ts(c.status, { how: c.handover })}</span>
              </div>
              {c.status !== 'cancelled' && <CommissionProgress status={c.status} handover={c.handover} />}
              {c.status === 'altering' && <div className="notice notice-clay text-[14px]">{t('alterationRequested', { note: c.alterationNote })}</div>}
              <p className="text-[14px] text-muted">
                {c.status === 'completed' ? t('released', { payout: eur(c.releasedCents), fee: eur(c.feeCents) })
                  : c.status === 'cancelled' ? t('cancelledLine', { refund: eur(c.refundedCents), payout: eur(c.releasedCents) })
                  : c.status === 'disputed' ? t('disputedLine')
                  : c.status === 'sent' && c.releaseAt ? t('heldSent', { total: eur(c.totalCents), name: c.customer.split(' ')[0], date: f.dateTime(c.releaseAt, { day: 'numeric', month: 'long' }) })
                  : t('held', { total: eur(c.totalCents) })}
              </p>
              {c.cancelProposedBy && c.status === 'making' && (
                <div className="notice notice-sand flex-col">
                  {c.cancelProposedBy === actor.id ? <span>{tc('proposalFromYou', { refund: eur(c.cancelRefundCents ?? 0) })}</span>
                    : <><span>{tc('proposalFromOther', { name: c.customer.split(' ')[0], refund: eur(c.cancelRefundCents ?? 0), reason: c.cancelReason })}</span><RespondCancelButtons id={c.id} /></>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {(c.status === 'making' || c.status === 'altering') && <MarkSentForm id={c.id} handover={c.handover} />}
                {c.status === 'completed' && !c.inPortfolio && <Link className="btn btn-sage btn-sm" href={`/studio/portfolio?from=${c.id}`}>{t('addToPortfolio')}</Link>}
                {c.inPortfolio && <span className="badge badge-sand">{t('inPortfolio')}</span>}
                <Link className="btn btn-ghost btn-sm" href={`/messages/${c.requestId}/${actor.id}`}><Chat /> {tr('message')}</Link>
              </div>
              {c.status === 'making' && !c.cancelProposedBy && <ProposeCancelForm id={c.id} max={c.totalCents} totalLabel={eur(c.totalCents)} />}
              {c.status === 'making' && <StudentCancelForm id={c.id} />}
            </article>
          ))}
        </div>
      ) : <div className="empty">{t('noCommissions')}</div>}
    </section>
  );
}
