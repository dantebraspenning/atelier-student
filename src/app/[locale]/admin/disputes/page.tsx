import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { openDisputes } from '@/lib/domain/admin';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { DisputeResolution } from '@/components/admin-forms';

export default async function AdminDisputes({ params }: PageProps<'/[locale]/admin/disputes'>) {
  const { locale } = await params;
  const rows = await openDisputes(await requirePageActor(locale, '/admin', 'admin'));
  const t = await getTranslations('admin');
  const tc = await getTranslations('commission');
  if (!rows.length) return <div className="empty">{t('nothing')}</div>;
  return (
    <div className="flex flex-col gap-4">
      {rows.map(({ d, c, title, requestId }) => (
        <article key={d.id} className="card flex flex-wrap gap-6">
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <span className="h4">{title} · {formatEuro(c.totalCents, locale)}</span>
            <span className="badge badge-clay w-fit">{tc(`problemReasons.${d.reason}`)}</span>
            <p className="whitespace-pre-line text-[15px] text-ink-soft">{d.details}</p>
            <Link className="text-link w-fit" href={`/messages/${requestId}/${c.studentId}`}>{t('viewThread')}</Link>
          </div>
          <div className="flex-[1_1_300px]"><DisputeResolution id={d.id} /></div>
        </article>
      ))}
    </div>
  );
}
