import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getActor, homeFor } from '@/lib/session';
import { AuthShell } from '@/components/auth-shell';
import { SignUpForm } from '@/components/auth-forms';

export async function generateMetadata() { return { title: (await getTranslations('auth'))('submitSignUp') }; }

export default async function SignUp({ params, searchParams }: PageProps<'/[locale]/sign-up'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await getActor();
  if (actor) redirect(`/${locale}${homeFor(actor.role)}`);
  const role = sp.role === 'student' ? 'student' : 'customer';
  const t = await getTranslations('auth');
  const tn = await getTranslations('nav');
  return (
    <AuthShell eyebrow={role === 'student' ? tn('forStudents') : t('submitSignUp')} title={role === 'student' ? t('signUpStudent') : t('signUpCustomer')}
      lead={role === 'student' ? t('signUpStudentLead') : t('signUpCustomerLead')}>
      <SignUpForm role={role} next={typeof sp.next === 'string' ? sp.next : undefined} />
    </AuthShell>
  );
}
