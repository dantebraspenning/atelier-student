import { getTranslations } from 'next-intl/server';
import { overview } from '@/lib/domain/admin';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';

export default async function AdminHome({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params;
  const s = await overview(await requirePageActor(locale, '/admin', 'admin'));
  const t = await getTranslations('admin');
  const tiles: [string, string | number][] = [
    [t('users'), s.users], [t('students'), s.students], [t('openRequests'), s.openRequests], [t('activeCommissions'), s.activeCommissions],
    [t('held'), formatEuro(s.heldCents, locale)], [t('fees'), formatEuro(s.feesCents, locale)], [t('openDisputes'), s.openDisputes],
    [t('openReports'), s.openReports], [t('pendingVerifications'), s.pendingVerifications]
  ];
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">{tiles.map(([l, v]) => <div key={l} className="card flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><span className="font-serif text-[36px] leading-none">{v}</span></div>)}</div>;
}
