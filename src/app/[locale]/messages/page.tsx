import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listThreads } from '@/lib/domain/messages';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { initials } from '@/components/flat';

export async function generateMetadata() { return { title: (await getTranslations('messages'))('title'), robots: { index: false } }; }

export default async function Inbox({ params }: PageProps<'/[locale]/messages'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/messages', ['customer', 'student']);
  const threads = await listThreads(actor);
  const t = await getTranslations('messages');
  const ts = await getTranslations('status');
  const te = await getTranslations('events');
  const f = await getFormatter();
  const student = actor.role === 'student';
  const stage = (s: string) => (['pending', 'declined', 'withdrawn', 'accepted'].includes(s) ? ts(`quote_${s}`) : ts.has(s) ? ts(s, { how: 'shipping' }) : s);
  const preview = (th: (typeof threads)[number]) => {
    const l = th.last;
    if (!l) return <em>{t('noMessagesYet')}</em>;
    if (l.kind === 'event' && l.event && te.has(l.event.key)) {
      const v = Object.fromEntries(Object.entries(l.event.values ?? {}).map(([k, x]) => [k, typeof x === 'number' && ['total', 'amount', 'refund', 'payout'].includes(k) ? formatEuro(x, locale) : x]));
      return <em>{te(l.event.key, v)}</em>;
    }
    return <>{l.mine ? t('you') : ''}{l.body || <em>{t('photo', { count: l.photos })}</em>}</>;
  };
  return (
    <div className="wrap-narrow flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-2"><span className="eyebrow">{t('eyebrow')}</span><h1 className="h1">{t('title')}</h1>
        <p className="text-ink-soft">{student ? t('leadStudent') : t('leadCustomer')}</p></div>
      {threads.length ? (
        <ul className="flex list-none flex-col gap-3 p-0">
          {threads.map((th) => (
            <li key={`${th.requestId}-${th.studentId}`}>
              <Link className={`list-row ${th.unread ? '!border-clay' : ''}`} href={`/messages/${th.requestId}/${th.studentId}`}>
                <span className={`avatar ${student ? 'tint-clay' : 'tint-sage'}`}>{initials(th.with)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex justify-between gap-3"><span className="h4 text-[17px]">{th.with}</span>
                    {th.last && <time className="text-[13px] text-muted" dateTime={th.last.createdAt}>{f.relativeTime(new Date(th.last.createdAt))}</time>}</span>
                  <span className="text-[13px] text-muted">{th.title} · {stage(th.stage)}</span>
                  <span className={`truncate text-[14px] ${th.unread ? 'text-ink' : 'text-ink-soft'}`}>{preview(th)}</span>
                </span>
                {th.unread > 0 && <span className="count count-clay">{th.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : <div className="empty flex flex-col gap-2"><p>{t('empty')}</p><p className="text-[14px]">{student ? t('emptyStudent') : t('emptyCustomer')}</p></div>}
    </div>
  );
}
