import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getActor, homeFor } from '@/lib/session';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/auth-forms';

export async function generateMetadata() { return { title: (await getTranslations('auth'))('signInTitle'), robots: { index: false } }; }

export default async function SignIn({ params, searchParams }: PageProps<'/[locale]/sign-in'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await getActor();
  if (actor) redirect(`/${locale}${homeFor(actor.role)}`);
  const t = await getTranslations('auth');
  return (
    <AuthShell eyebrow={t('signInEyebrow')} title={t('signInTitle')} lead={t('signInLead')}>
      {sp.reset && <div className="notice notice-sage">{t('resetDone')}</div>}
      <SignInForm next={typeof sp.next === 'string' ? sp.next : undefined} />
    </AuthShell>
  );
}
