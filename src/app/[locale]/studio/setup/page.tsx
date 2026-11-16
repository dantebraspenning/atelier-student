import { getTranslations } from 'next-intl/server';
import { env, paymentsSimulated } from '@/lib/env';
import { getDb } from '@/lib/db';
import { getOwnProfile, getTaxDetails, readiness, syncPayoutStatus } from '@/lib/domain/students';
import { requirePageActor } from '@/lib/session';
import { Check } from '@/components/icons';
import { DocumentForm, PayoutButton, SchoolEmailForm, TaxForm } from '@/components/studio-forms';

function Done({ children }: { children: React.ReactNode }) {
  return <div className="notice notice-sage"><Check /><span>{children}</span></div>;
}

export default async function StudioSetup({ params, searchParams }: PageProps<'/[locale]/studio/setup'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await requirePageActor(locale, '/studio/setup', 'student');
  // Back from Stripe onboarding: refresh payout status (the webhook also does this).
  if (sp.payouts === 'return') await syncPayoutStatus({ userId: actor.id }).catch(() => null);
  const db = await getDb();
  const [p, tax, ready] = await Promise.all([getOwnProfile(actor.id), getTaxDetails(actor), readiness(db, actor.id)]);
  const t = await getTranslations('setup');
  const tc = await getTranslations('common');
  return (
    <section className="flex max-w-[820px] flex-col gap-6">
      <h2 className="h3">{t('title')}</h2>
      {ready.ready && <Done>{t('allSet')}</Done>}

      <div className="card flex flex-col gap-4">
        <h3 className="h4">{t('verifyTitle')}</h3>
        {p.verification === 'verified' ? <Done>{t('verified')}</Done> : (<>
          <p className="text-ink-soft">{t('verifyLead')}</p>
          {p.verification === 'pending' && <div className="notice notice-sand">{t('pending')}</div>}
          {p.verification === 'rejected' && <div className="notice notice-clay">{t('rejected')}</div>}
          <SchoolEmailForm domains={env().SCHOOL_EMAIL_DOMAINS.join(', ')} />
          <div className="flex items-center gap-3 text-[13px] uppercase tracking-wider text-muted"><hr className="stitch flex-1" />{t('or')}<hr className="stitch flex-1" /></div>
          <DocumentForm />
        </>)}
      </div>

      <div className="card flex flex-col gap-4">
        <h3 className="h4">{t('taxTitle')}</h3>
        <p className="text-ink-soft">{t('taxLead')}</p>
        {tax && <Done>{t('taxOnFile', { name: tax.legalName, tin: tax.tinMasked })}</Done>}
        <details open={!tax}><summary className="text-link">{tax ? t('update') : t('taxTitle')}</summary>
          <div className="mt-4"><TaxForm initial={tax ? { legalName: tax.legalName, dateOfBirth: tax.dateOfBirth, addressLine: tax.addressLine, postalCode: tax.postalCode, city: tax.city, country: tax.country } : null} /></div>
        </details>
      </div>

      <div className="card flex flex-col gap-4">
        <h3 className="h4">{t('payoutsTitle')}</h3>
        <p className="text-ink-soft">{t('payoutsLead')}</p>
        {p.payoutsEnabled ? <><Done>{t('payoutsReady')}</Done>{!paymentsSimulated() && <div><PayoutButton dashboard label={t('payoutsDashboard')} /></div>}</>
          : <>{p.stripeAccountId && <div className="notice notice-sand">{t('payoutsPending')}</div>}
              <div><PayoutButton label={p.stripeAccountId ? t('payoutsContinue') : t('payoutsStart')} /></div>
              {paymentsSimulated() && <span className="hint">{tc('simulatedPayments')}</span>}</>}
      </div>
    </section>
  );
}
