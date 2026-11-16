import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getDb } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { requirePageActor } from '@/lib/session';
import { DeleteAccountForm, PasswordForm, SettingsForm } from '@/components/account-forms';

export async function generateMetadata() { return { title: (await getTranslations('account'))('title'), robots: { index: false } }; }

export default async function Account({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/account');
  const db = await getDb();
  const [u] = await db.select().from(user).where(eq(user.id, actor.id));
  const t = await getTranslations('account');
  return (
    <div className="wrap-narrow flex max-w-[760px] flex-col gap-6 py-12">
      <div className="flex flex-col gap-1"><h1 className="h1">{t('title')}</h1><p className="text-ink-soft">{u.email}</p></div>
      <SettingsForm name={u.name} language={u.locale} notifyMessages={u.notifyMessages} />
      <PasswordForm />
      <section className="card flex flex-col gap-3"><h2 className="h3">{t('dataTitle')}</h2><p className="text-ink-soft">{t('dataLead')}</p>
        <div><a className="btn btn-line" href="/api/account/export" download>{t('export')}</a></div></section>
      <section className="card flex flex-col gap-3 border-clay/40"><h2 className="h3">{t('deleteTitle')}</h2><p className="text-ink-soft">{t('deleteLead')}</p><DeleteAccountForm /></section>
    </div>
  );
}
