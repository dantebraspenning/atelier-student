import { getFormatter, getTranslations } from 'next-intl/server';
import { getDb } from '@/lib/db';
import { readiness, getOwnProfile } from '@/lib/domain/students';
import { studentFeed } from '@/lib/domain/requests';
import { earningsOf, studentCommissions } from '@/lib/domain/commissions';
import { ownPortfolio } from '@/lib/domain/portfolio';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { Link } from '@/i18n/navigation';
import { AcceptingSwitch } from '@/components/account-forms';
import { StudioNav } from '@/components/studio-nav';
import { Check } from '@/components/icons';

export default async function StudioLayout({ children, params }: LayoutProps<'/[locale]/studio'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/studio', 'student');
  const db = await getDb();
  const [profile, ready, feed, commissions, pieces] = await Promise.all([
    getOwnProfile(actor.id), readiness(db, actor.id), studentFeed(actor), studentCommissions(actor), ownPortfolio(actor)
  ]);
  const active = commissions.filter((c) => ['making', 'sent', 'altering', 'disputed'].includes(c.status));
  const earnings = earningsOf(commissions);
  const t = await getTranslations('studio');
  const f = await getFormatter();
  const steps = [['profile', t('setupProfile'), '/studio/profile'], ['verified', t('setupVerified'), '/studio/setup'], ['tax', t('setupTax'), '/studio/setup'], ['payouts', t('setupPayouts'), '/studio/setup']] as const;
  return (
    <div className="wrap grid gap-10 py-10 lg:grid-cols-[230px_1fr]">
      <aside className="flex flex-col gap-6"><StudioNav counts={{ requests: feed.length, commissions: active.length }} /></aside>
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1"><span className="text-[14px] text-muted">{f.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <h1 className="h1 !text-[clamp(38px,4vw,56px)]">{t('hello', { name: actor.name.split(' ')[0] })}</h1></div>
          <AcceptingSwitch accepting={profile.accepting} />
        </div>
        {!ready.ready && (
          <section className="card flex flex-col gap-4 !border-clay/50" aria-labelledby="setup-h">
            <div className="flex flex-col gap-1"><h2 id="setup-h" className="h3">{t('setupTitle')}</h2><p className="text-ink-soft">{t('setupLead')}</p></div>
            <ol className="grid list-none gap-2 p-0 sm:grid-cols-2">
              {steps.map(([k, label, href]) => (
                <li key={k}><Link href={href} className={`list-row !py-3 ${ready[k] ? 'opacity-70' : ''}`}>
                  <span className={`grid size-7 flex-none place-items-center rounded-full ${ready[k] ? 'bg-sage text-linen' : 'border border-seam-strong'}`}>{ready[k] ? <Check size={16} /> : null}</span>
                  <span className="flex-1">{label}</span><span className="text-[13px] text-muted">{ready[k] ? t('setupDone') : '→'}</span></Link></li>
              ))}
            </ol>
          </section>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          <div className="card flex flex-col gap-1"><span className="text-[13px] text-muted">{t('statRequests')}</span><span className="font-serif text-[40px] leading-none">{feed.length}</span></div>
          <div className="card flex flex-col gap-1"><span className="text-[13px] text-muted">{t('statActive')}</span><span className="font-serif text-[40px] leading-none">{active.length}</span></div>
          <div className="card flex flex-col gap-1 !border-sage-deep !bg-sage-deep text-linen"><span className="text-[13px] text-sage-mist">{t('statEarned')}</span>
            <span className="font-serif text-[40px] leading-none">{formatEuro(earnings.releasedCents, locale)}</span>
            <span className="text-[12px] text-sage-mist">{t('statHeld', { amount: formatEuro(earnings.heldCents, locale) })}</span></div>
          <div className="card flex flex-col gap-1"><span className="text-[13px] text-muted">{t('statPieces')}</span><span className="font-serif text-[40px] leading-none">{pieces.length}</span></div>
        </div>
        {children}
      </div>
    </div>
  );
}
