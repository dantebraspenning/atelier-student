'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div className="wrap-narrow py-24"><div className="empty flex flex-col items-center gap-4">
      <h1 className="h2">{t('unexpected')}</h1>
      <button type="button" className="btn btn-sage" onClick={reset}>↻</button>
    </div></div>
  );
}
