import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AppError } from '@/lib/errors';
import { confirmSchoolEmail } from '@/lib/domain/students';
import { requirePageActor } from '@/lib/session';

/** Target of the school-email verification link. */
export default async function VerifySchoolEmail({ params, searchParams }: PageProps<'/[locale]/studio/verify'>) {
  const { locale } = await params;
  const token = String((await searchParams).token ?? '');
  const actor = await requirePageActor(locale, `/studio/verify?token=${encodeURIComponent(token)}`, 'student');
  const t = await getTranslations('setup');
  const te = await getTranslations('errors');
  let ok = true;
  try { await confirmSchoolEmail(actor, token); } catch (e) { if (!(e instanceof AppError)) throw e; ok = false; }
  return (
    <section className="card flex max-w-[620px] flex-col gap-4">
      <div className={`notice ${ok ? 'notice-sage' : 'notice-clay'}`}>{ok ? t('schoolVerified') : te('invalidOrExpiredLink')}</div>
      <div><Link className="btn btn-sage" href="/studio/setup">{t('title')}</Link></div>
    </section>
  );
}
