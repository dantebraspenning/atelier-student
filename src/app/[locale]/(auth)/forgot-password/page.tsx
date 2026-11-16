import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth-shell';
import { ForgotForm } from '@/components/auth-forms';

export default async function Forgot() {
  const t = await getTranslations('auth');
  return <AuthShell eyebrow={t('signInTitle')} title={t('forgotTitle')} lead={t('forgotLead')}><ForgotForm /></AuthShell>;
}
