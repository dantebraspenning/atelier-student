import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AppError } from '@/lib/errors';
import { getThread } from '@/lib/domain/messages';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { initials } from '@/components/flat';
import { Back } from '@/components/icons';
import { ReportButton } from '@/components/report';
import { Thread } from '@/components/thread';

export async function generateMetadata() { return { title: (await getTranslations('messages'))('title'), robots: { index: false } }; }

export default async function ThreadPage({ params }: PageProps<'/[locale]/messages/[requestId]/[studentId]'>) {
  const { locale, requestId, studentId } = await params;
  const actor = await requirePageActor(locale, `/messages/${requestId}/${studentId}`);
  const data = await getThread(actor, requestId, studentId).catch((e) => { if (e instanceof AppError) notFound(); throw e; });
  const { thread: th, messages } = data;
  const t = await getTranslations('messages');
  const ts = await getTranslations('status');
  const student = actor.id === studentId;
  const other = student ? th.customer : th.student;
  const back = student ? '/studio' : `/requests/${requestId}`;
  const context = th.commission ? ts(th.commission.status, { how: th.commission.handover })
    : th.quote ? t('quoteContext', { total: formatEuro(th.quote.totalCents, locale), status: ts(`quote_${th.quote.status}`) })
    : th.requestStatus === 'open' ? t('noQuoteYet') : ts(th.requestStatus);
  const closed = th.requestStatus === 'cancelled' || th.requestStatus === 'expired' ? t('closedCancelled') : th.commission ? t('closedOld') : t('closedOther');
  return (
    <div className="wrap-narrow flex flex-col gap-5 py-10">
      <div className="flex flex-wrap gap-5 text-[14px]">
        <Link href={back} className="inline-flex items-center gap-2 text-muted no-underline"><Back /> {student ? 'Studio' : th.title}</Link>
        <Link href="/messages" className="text-muted no-underline">{t('all')}</Link>
      </div>
      <section className="card !p-0 overflow-hidden">
        <header className="flex flex-wrap items-center gap-3.5 border-b border-seam px-5 py-4">
          <span className={`avatar ${student ? 'tint-clay' : 'tint-sage'}`}>{initials(other.name)}</span>
          <div className="flex min-w-0 flex-1 flex-col"><span className="h4 text-[19px]">{other.name}</span><span className="text-[13px] text-muted">{th.title}</span></div>
          <span className="badge badge-sand">{context}</span>
          <ReportButton targetType="user" targetId={student ? th.customer.id : th.student.id} />
        </header>
        <Thread requestId={requestId} studentId={studentId} initial={messages} canWrite={th.canWrite} locale={locale}
          emptyHint={student ? t('askHint', { name: other.name.split(' ')[0] }) : t('sayHello', { name: other.name.split(' ')[0] })} />
        {!th.canWrite && <p className="m-0 border-t border-seam px-5 py-4 text-center text-[14px] text-muted">{closed}</p>}
      </section>
      <p className="text-center text-[13px] text-muted">{t('safety')}</p>
    </div>
  );
}
