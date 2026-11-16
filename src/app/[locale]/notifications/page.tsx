import { and, desc, eq } from 'drizzle-orm';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getDb } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { MarkAllRead } from '@/components/account-forms';

export async function generateMetadata() { return { title: (await getTranslations('notifications'))('title'), robots: { index: false } }; }

const MONEY = new Set(['total', 'amount', 'fee', 'refund', 'payout']);

export default async function Notifications({ params }: PageProps<'/[locale]/notifications'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/notifications');
  const db = await getDb();
  const rows = await db.select().from(notification).where(and(eq(notification.userId, actor.id))).orderBy(desc(notification.createdAt)).limit(100);
  const t = await getTranslations('notifications');
  const f = await getFormatter();
  return (
    <div className="wrap-narrow flex flex-col gap-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4"><h1 className="h1">{t('title')}</h1>{rows.some((r) => !r.readAt) && <MarkAllRead />}</div>
      {rows.length ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {rows.map((n) => {
            const values = Object.fromEntries(Object.entries(n.values).map(([k, v]) => [k, MONEY.has(k) && typeof v === 'number' ? formatEuro(v, locale) : v]));
            return (
              <li key={n.id}>
                <Link href={n.href} className={`list-row ${n.readAt ? '' : '!border-sage bg-cotton'}`}>
                  {!n.readAt && <span className="dot text-clay" aria-hidden />}
                  <span className="flex-1">{t.has(n.type) ? t(n.type, values) : n.type}</span>
                  <time className="text-[13px] text-muted" dateTime={n.createdAt.toISOString()}>{f.relativeTime(n.createdAt)}</time>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <div className="empty">{t('empty')}</div>}
    </div>
  );
}
