import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { env } from '@/lib/env';

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const e = env();
  return (
    <footer className="mt-24 border-t border-seam bg-cotton">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-baseline gap-2 no-underline"><span className="font-serif text-[28px]">atelier</span><span className="text-[11px] uppercase tracking-[.14em] text-muted">student</span></Link>
          <p className="max-w-xs text-[15px] text-ink-soft">{t('tagline')}</p>
        </div>
        <nav aria-label={t('marketplace')} className="flex flex-col gap-2 text-[15px]">
          <span className="eyebrow mb-1">{t('marketplace')}</span>
          <Link href="/makers">{nav('findMaker')}</Link>
          <Link href="/request">{nav('request')}</Link>
          <Link href="/sign-up?role=student">{t('becomeMaker')}</Link>
        </nav>
        <nav aria-label={t('legal')} className="flex flex-col gap-2 text-[15px]">
          <span className="eyebrow mb-1">{t('legal')}</span>
          <Link href="/legal/terms">{t('terms')}</Link>
          <Link href="/legal/privacy">{t('privacy')}</Link>
          <Link href="/legal/cookies">{t('cookies')}</Link>
          <Link href="/legal/imprint">{t('imprint')}</Link>
        </nav>
        <div className="flex flex-col gap-2 text-[15px]">
          <span className="eyebrow mb-1">{t('company')}</span>
          <a href={`mailto:${e.SUPPORT_EMAIL}`}>{t('contact')}</a>
          <span className="text-muted">{e.COMPANY_NAME}</span>
          {e.COMPANY_KVK && <span className="text-muted">{t('kvk', { kvk: e.COMPANY_KVK })}</span>}
          {e.COMPANY_ADDRESS && <span className="text-muted">{e.COMPANY_ADDRESS}</span>}
        </div>
      </div>
      <span className="sr-only">{locale}</span>
    </footer>
  );
}
