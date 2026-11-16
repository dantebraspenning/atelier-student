import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listCustomerRequests } from '@/lib/domain/requests';
import { listThreads } from '@/lib/domain/messages';
import { requirePageActor } from '@/lib/session';
import { Flat, TINT } from '@/components/flat';
import { Chat } from '@/components/icons';

export async function generateMetadata() { return { title: (await getTranslations('requests'))('title') }; }

export default async function MyRequests({ params }: PageProps<'/[locale]/requests'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/requests', 'customer');
  const [requests, threads] = await Promise.all([listCustomerRequests(actor), listThreads(actor)]);
  const t = await getTranslations('requests');
  const ts = await getTranslations('status');
  const tg = await getTranslations('garment');
  const f = await getFormatter();
  return (
    <div className="wrap flex flex-col gap-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2"><span className="eyebrow">{t('eyebrow')}</span><h1 className="h1">{t('title')}</h1></div>
        <Link className="btn btn-sage" href="/request">{t('new')}</Link>
      </div>
      {requests.length ? (
        <ul className="flex list-none flex-col gap-3 p-0">
          {requests.map((r) => {
            const unread = threads.filter((th) => th.requestId === r.id).reduce((n, th) => n + th.unread, 0);
            const c = r.commission?.c;
            return (
              <li key={r.id}>
                <Link className="list-row" href={`/requests/${r.id}`}>
                  <span className={`thumb ${TINT[r.garment]}`}><Flat garment={r.garment} width={38} height={50} bold /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="h4 text-[17px]">{r.title}</span>
                    <span className="text-[13px] text-muted">{tg(r.garment)} · {t('posted', { date: f.dateTime(r.createdAt, { day: 'numeric', month: 'short' }) })}</span>
                  </span>
                  {unread > 0 && <span className="badge badge-clay"><Chat />{t('newMessage')}</span>}
                  {c ? <span className={`badge ${c.status === 'sent' ? 'badge-clay' : 'badge-sage'}`}>{c.status === 'sent' ? t('confirmReceipt') : ts(c.status, { how: c.handover })} · {r.commission!.maker}</span>
                    : r.status === 'open' ? <span className={`badge ${r.pendingQuotes ? 'badge-sage' : 'badge-clay'}`}>{r.pendingQuotes ? ts('quotesToReview', { count: r.pendingQuotes }) : ts('open')}</span>
                    : <span className="badge badge-sand">{ts(r.status)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty flex flex-col items-center gap-4"><p>{t('empty')}</p><Link className="btn btn-sage" href="/request">{t('first')}</Link></div>
      )}
    </div>
  );
}
