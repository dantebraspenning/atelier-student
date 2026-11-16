import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth-shell';
import { ResendForm } from '@/components/auth-forms';
import { emailLoggedOnly } from '@/lib/env';
import { Link } from '@/i18n/navigation';

export default async function CheckEmail({ searchParams }: PageProps<'/[locale]/check-email'>) {
  const email = String((await searchParams).email ?? '');
  const t = await getTranslations('auth');
  return (
    <AuthShell eyebrow={t('submitSignUp')} title={t('checkEmailTitle')}>
      <div className="card card-lg flex flex-col gap-5">
        <p className="text-[17px]">{t('checkEmail', { email })}</p>
        {email && <ResendForm email={email} />}
        {emailLoggedOnly() && <Link className="text-link" href="/dev/mail">Dev: open the local mailbox →</Link>}
      </div>
    </AuthShell>
  );
}
