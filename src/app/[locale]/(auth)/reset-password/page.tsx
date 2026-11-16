import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth-shell';
import { ResetForm } from '@/components/auth-forms';

export default async function Reset({ searchParams }: PageProps<'/[locale]/reset-password'>) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  const te = await getTranslations('errors');
  const token = typeof sp.token === 'string' ? sp.token : '';
  return (
    <AuthShell eyebrow={t('signInTitle')} title={t('resetTitle')}>
      {!token || sp.error ? <div className="form-error">{te('invalidToken')}</div> : <ResetForm token={token} />}
    </AuthShell>
  );
}
