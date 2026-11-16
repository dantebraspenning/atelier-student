import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePageActor } from '@/lib/session';

export const metadata = { robots: { index: false } };

export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]/admin'>) {
  const { locale } = await params;
  await requirePageActor(locale, '/admin', 'admin');
  const t = await getTranslations('admin');
  const items = [['/admin', 'overview'], ['/admin/verifications', 'verifications'], ['/admin/disputes', 'disputes'], ['/admin/reports', 'reports'], ['/admin/users', 'users'], ['/admin/payments', 'payments'], ['/admin/dac7', 'dac7']] as const;
  return (
    <div className="wrap flex flex-col gap-8 py-10">
      <h1 className="h1">{t('title')}</h1>
      <nav className="tabs" aria-label={t('title')}>{items.map(([href, k]) => <Link key={href} href={href} className="tab">{t(`nav.${k}`)}</Link>)}</nav>
      {children}
    </div>
  );
}
