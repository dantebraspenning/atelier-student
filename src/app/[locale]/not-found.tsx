import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="wrap-narrow py-24"><div className="empty flex flex-col items-center gap-4">
      <h1 className="h2">{t('notFoundTitle')}</h1><p>{t('notFound')}</p><Link className="btn btn-sage" href="/">{t('home')}</Link>
    </div></div>
  );
}
