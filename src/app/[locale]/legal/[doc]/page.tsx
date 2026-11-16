import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { LEGAL, LEGAL_UPDATED } from '@/content/legal';
import { env } from '@/lib/env';

const fill = (s: string) => {
  const e = env();
  return s.replace(/\{(\w+)\}/g, (_, k) => ({
    company: e.COMPANY_NAME, address: e.COMPANY_ADDRESS || '[address]', kvk: e.COMPANY_KVK || '[KvK number]', email: e.SUPPORT_EMAIL,
    days: String(e.AUTO_RELEASE_DAYS), fee: String(e.PLATFORM_FEE_PERCENT)
  } as Record<string, string>)[k] ?? '');
};

export async function generateMetadata({ params }: PageProps<'/[locale]/legal/[doc]'>) {
  const { doc, locale } = await params;
  const d = LEGAL[doc as keyof typeof LEGAL]?.[locale as 'nl' | 'en'];
  return d ? { title: d.title } : {};
}

export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[doc]'>) {
  const { doc, locale } = await params;
  const d = LEGAL[doc as keyof typeof LEGAL]?.[locale as 'nl' | 'en'];
  if (!d) notFound();
  const t = await getTranslations('legal');
  const f = await getFormatter();
  return (
    <article className="wrap-narrow flex max-w-[780px] flex-col gap-6 py-14">
      <div className="notice notice-clay text-[14px]">{t('draft')}</div>
      <h1 className="h1">{d.title}</h1>
      <p className="text-[14px] text-muted">{t('updated', { date: f.dateTime(new Date(LEGAL_UPDATED), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
      {d.sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2">
          <h2 className="h4 text-[20px]">{fill(s.h)}</h2>
          {s.p.length > 2 ? <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">{s.p.map((p) => <li key={p}>{fill(p)}</li>)}</ul>
            : s.p.map((p) => <p key={p} className="text-ink-soft">{fill(p)}</p>)}
        </section>
      ))}
    </article>
  );
}
